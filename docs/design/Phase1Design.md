# Phase 1 Design

Concrete implementation design derived from
[Phase1Options.md](Phase1Options.md). No code yet — pseudo-code,
contracts, and effort estimates only.

## 0. Decisions carried forward

From annotations on Phase1Options.md:

| Question                | Decision                                                                 |
| ----------------------- | ------------------------------------------------------------------------ |
| Model                   | **Option C** (basic demographic-fiscal), shaped to extend to Option D    |
| 3D framing              | **2D plots** for Phase 1; 3D deferred to MeridianWorlds integration     |
| Sim ownership           | **Client runs the sim**; server stores results & is re-runnable from data |
| Time anchor             | Absolute time = **seconds since epoch**; UI increment = **weeks or months** |
| Non-Turchin models      | Welcome — colonists are not prey, so predator-prey-with-humans-as-prey is out |
| Units                   | Small dependent colony to start (hundreds-thousands of people)           |
| Out of Phase 1          | Economics, social breakdown, logistic-chain limits — all later phases   |

One implication of "dependent colony" worth flagging: Turchin's $k(S)$ is the
*internal* carrying capacity. A dependent colony also has an **external
resupply** term that doesn't appear in the book. Treated as an extension hook
in §6.7 below — not Phase 1 core, but the model API should leave room for it.

## 1. Architecture at a glance

```
+--------------------------------------------------+        +-----------------+
|                     CLIENT                       |        |     SERVER      |
|                                                  |        |                 |
|  +-----------------+   +------------------+      |        |  +-----------+  |
|  |   UI (React)    |<->|  Sim Runtime     |      | HTTP   |  | Express   |  |
|  |  - sliders      |   |  - model         |<-----+--JSON--+->| /api/...  |  |
|  |  - timeline     |   |  - integrator    |      |        |  +-----------+  |
|  |  - 2D plots     |   |  - replay engine |      |        |        |        |
|  +-----------------+   +------------------+      |        |        v        |
|                                                  |        |  SQLite (file)  |
|  Zustand store: { runId, events, snapshots,      |        |   runs          |
|                   currentT, params }             |        |   events        |
+--------------------------------------------------+        |   snapshots     |
                                                            +-----------------+
```

- **Client** owns the model: it runs RK4, derives all snapshots from the
  authoritative event timeline, and renders 2D plots.
- **Server** owns durability: it stores the event timeline and the materialized
  snapshots, and serves them back so any client (today, or MeridianWorlds
  later) can re-derive the run.
- The **event timeline** — not the snapshot stream — is the source of truth.
  Snapshots are a derived cache.

## 2. Time and units

Internal sim time is **years (floating-point)**, because Turchin's $r \approx
0.02\,\text{yr}^{-1}$ stays legible that way and the integrator math is simpler.

External / persisted time is **seconds since epoch (UNIX time)**. Conversion at
the boundary only:

```ts
const SECS_PER_YEAR = 31_556_952;       // Gregorian average, used everywhere
const epochToYears = (epoch: number, t0: number) => (epoch - t0) / SECS_PER_YEAR;
const yearsToEpoch = (years: number, t0: number) => t0 + years * SECS_PER_YEAR;
```

`t0` is the run's "founding epoch" (the colony's first day), persisted with
the run.

UI time increment is a **discrete tick**, configurable per run:

| Tick label | seconds       | years      |
| ---------- | ------------- | ---------- |
| week       | 604,800       | 0.01917    |
| month      | 2,629,746     | 0.08333    |

Internal integrator step `dt_integ` is smaller than the UI tick (default
**1 day = 1/365.25 yr**). Each UI tick advances the integrator
`tick_seconds / dt_integ_seconds` times and emits exactly one snapshot.

## 3. Domain types (TypeScript-flavored pseudo-code)

```ts
type RunId = string;          // nanoid

type ModelKind = "C-basic-demfisc";   // Phase 1 has one; the discriminator is here for forward-compat with "D-class-structured", "lotka-volterra", etc.

type ParamsC = {              // Option C params, all scaled per Turchin
  r:     number;              // intrinsic per capita growth rate, yr^-1
  beta:  number;              // per capita state expenditure rate
  c:     number;              // max gain in carrying capacity from S
  s0:    number;              // half-saturation point of k(S)
};

type StateC = {               // structural variables
  N: number;                  // population (scaled)
  S: number;                  // accumulated state resources (scaled)
};

type Run = {
  id:            RunId;
  name:          string;        // human-readable, required at creation
  modelKind:     ModelKind;
  t0Epoch:       number;        // founding date, seconds since epoch
  tickSeconds:   number;        // week or month
  peoplePerUnit: number;        // display-only multiplier; 1.0 scaled-N = peoplePerUnit settlers
  initialState:  StateC;        // stored in *scaled* units (matches Turchin)
  initialParams: ParamsC;
  createdAt:     number;
};

type Event =                  // append-only timeline; the source of truth
  | { kind: "param-set";  tEpoch: number; param: keyof ParamsC; value: number }
  | { kind: "state-poke"; tEpoch: number; patch: Partial<StateC> }   // for "what if N halves now"
  | { kind: "stop";        tEpoch: number };

type Snapshot = {             // derived; one per UI tick
  tEpoch: number;
  state:  StateC;
};
```

The discriminator on `ModelKind` is the seam for Option D: when the model
becomes class-structured, `StateC` widens to `{P, E, S}` and `ParamsC` widens,
but `Event` and `Snapshot` shapes stay the same.

## 4. The model (Option C)

Right-hand side of the ODE, as one pure function:

```ts
// Eq 7.4 (Turchin, scaled). Pure function — no time-dependence beyond state.
function rhsC(s: StateC, p: ParamsC): StateC {
  const kS = 1 + p.c * (s.S / (p.s0 + s.S));
  const production = s.N * (1 - s.N / kS);
  return {
    N: p.r * production,
    S: production - p.beta * s.N,
  };
}
```

Two model invariants enforced *outside* the RHS, around the integrator:

- $N \ge 0$ — clamp on the way out of each step.
- $S \ge 0$ — Turchin handles this as a manual reset, not by the ODE. After
  every integrator step: if $S < 0$, set $S = 0$. This is the "state cannot go
  into debt" rule from §7.2.1.

## 5. Integrator

Plain RK4. ~20 lines, no library needed.

```ts
function rk4Step(s: StateC, p: ParamsC, dt: number): StateC {
  const k1 = rhsC(s, p);
  const k2 = rhsC(addScaled(s, k1, dt/2), p);
  const k3 = rhsC(addScaled(s, k2, dt/2), p);
  const k4 = rhsC(addScaled(s, k3, dt),   p);
  const incr = combine(k1, k2, k3, k4);     // (k1 + 2k2 + 2k3 + k4) / 6
  return clampNonNeg(addScaled(s, incr, dt));
}
```

A "driver" advances by exactly one UI tick:

```ts
function advanceTick(s: StateC, p: ParamsC, tickYears: number, dtIntegYears: number): StateC {
  const nSteps = Math.round(tickYears / dtIntegYears);
  let cur = s;
  for (let i = 0; i < nSteps; i++) cur = rk4Step(cur, p, dtIntegYears);
  return cur;
}
```

## 6. Replay engine

The heart of the system. Everything else hangs off this.

### 6.1 Active parameters at any $t$

```ts
function paramsAt(run: Run, events: Event[], tEpoch: number): ParamsC {
  let p = { ...run.initialParams };
  for (const e of events) {
    if (e.tEpoch > tEpoch) break;          // events are stored sorted by tEpoch
    if (e.kind === "param-set") p[e.param] = e.value;
  }
  return p;
}
```

### 6.2 Replay from $t_0$ to a target

```ts
function replayTo(run: Run, events: Event[], targetEpoch: number): Snapshot[] {
  const tickSec      = run.tickSeconds;
  const tickYears    = tickSec / SECS_PER_YEAR;
  const dtIntegYears = 1 / 365.25;

  let state  = run.initialState;
  let tEpoch = run.t0Epoch;
  let p      = { ...run.initialParams };
  const out: Snapshot[] = [{ tEpoch, state }];

  // Merge tick boundaries with event boundaries.
  let eventIdx = 0;
  while (tEpoch < targetEpoch) {
    // Apply any events landing at-or-before the upcoming tick.
    const nextTickEpoch = tEpoch + tickSec;
    while (eventIdx < events.length && events[eventIdx].tEpoch <= nextTickEpoch) {
      const e = events[eventIdx++];
      // If event is mid-tick, advance to event time, apply, then continue.
      const partial = (e.tEpoch - tEpoch) / SECS_PER_YEAR;
      if (partial > 0) state = advanceTick(state, p, partial, dtIntegYears);
      tEpoch = e.tEpoch;
      if (e.kind === "param-set")  p[e.param] = e.value;
      if (e.kind === "state-poke") state = { ...state, ...e.patch };
    }
    // Finish the tick.
    const remaining = (nextTickEpoch - tEpoch) / SECS_PER_YEAR;
    if (remaining > 0) state = advanceTick(state, p, remaining, dtIntegYears);
    tEpoch = nextTickEpoch;
    out.push({ tEpoch, state });
  }
  return out;
}
```

Two things to note:

- The integrator step never crosses an event. Parameter changes are honored
  exactly when they happen, not at the next UI tick.
- Snapshots land **only** on UI-tick boundaries. Mid-tick states exist
  transiently during a single replay; they're not persisted.

### 6.3 Rewind

Rewind to time $t_r$ is just `replayTo(run, events.filter(e => e.tEpoch <= tr), tr)`.
No mutation of state; no undo stack.

### 6.4 Edit-after-rewind ("branching")

When the user is at $t_r$ and adjusts a parameter:

1. **Drop** all events with $t > t_r$.
2. **Drop** all snapshots with $t > t_r$ (server-side cache invalidation).
3. **Append** the new param-set event at $t_r$.
4. Replay forward from $t_r$ on demand.

This is destructive. If "branching with history" is desired in a later phase,
you'd version the event list — but Phase 1 doesn't need it.

### 6.5 Snapshot cache

For interactive scrubbing, full replay every frame is wasteful. The optimization:

- After any `replayTo(...)` call, persist all snapshots up to that point.
- For a subsequent rewind to $t_r$, just pick the nearest snapshot $\le t_r$
  and replay forward from there (a few ticks, not thousands).

Because the events list is the source of truth, the cache can always be
rebuilt by re-replaying from $t_0$. Loss of the snapshot cache is recoverable.

### 6.6 Determinism

RK4 is deterministic. Same events → same snapshots, byte-for-byte. The server
can verify a client's snapshots by re-replaying locally if needed — useful
for cross-validation when MeridianWorlds (or another client) re-derives a run.

### 6.7 Extension hook: exogenous resupply

The "dependent colony" notion fits as either:

- a `resupplyRate` parameter (constant or piecewise) added to the $\dot S$
  equation: `S: production - β·N + resupplyRate`
- or a new event kind `{kind: "supply-drop", tEpoch, amount}` that adds a
  delta to $S$ instantaneously.

Either way: pure data-layer change, replay engine untouched. Not in Phase 1
core, but worth a 1-line `// TODO: supply` in `rhsC` so we know where it lands.

## 7. Server contract

Express routes, JSON bodies, SQLite storage.

### 7.1 Schema

```sql
CREATE TABLE runs (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  model_kind      TEXT NOT NULL,
  t0_epoch        INTEGER NOT NULL,        -- seconds since epoch
  tick_seconds    INTEGER NOT NULL,
  people_per_unit REAL NOT NULL,           -- display-only multiplier
  initial_state   JSON NOT NULL,           -- scaled units
  initial_params  JSON NOT NULL,
  created_at      INTEGER NOT NULL
);

CREATE TABLE events (
  run_id    TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  t_epoch   INTEGER NOT NULL,
  seq       INTEGER NOT NULL,             -- tiebreaker if two events share t_epoch
  payload   JSON NOT NULL,
  PRIMARY KEY (run_id, t_epoch, seq)
);

CREATE TABLE snapshots (
  run_id    TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  t_epoch   INTEGER NOT NULL,
  state     JSON NOT NULL,
  PRIMARY KEY (run_id, t_epoch)
);
```

### 7.2 Endpoints

```
POST   /api/runs                       create a Run, returns {id}
GET    /api/runs                       list runs (id, modelKind, createdAt)
GET    /api/runs/:id                   get Run record
DELETE /api/runs/:id                   delete run + events + snapshots

GET    /api/runs/:id/events            list events sorted by t_epoch, seq
POST   /api/runs/:id/events            append one event
DELETE /api/runs/:id/events?after=T    drop events with t_epoch > T (branch op)

GET    /api/runs/:id/snapshots         list snapshots
PUT    /api/runs/:id/snapshots         bulk upsert (client just replayed; here are the results)
DELETE /api/runs/:id/snapshots?after=T drop snapshots with t_epoch > T
```

No real-time / SSE / WebSocket in Phase 1. Polling-free because the client
already knows when its own simulation advanced — no remote notifications
needed.

### 7.3 What the server does *not* do

- It does not run the model. The server has no integrator and no ODE code.
- It does not derive snapshots from events. The client does that and PUTs.
- It does not lock or coordinate concurrent edits. Phase 1 is single-user.

This keeps the server tiny and trivially replaceable later (e.g. by a
MeridianWorlds-internal store).

## 8. Client runtime

### 8.1 State store (Zustand)

```ts
type Store = {
  run:       Run | null;
  events:    Event[];
  snapshots: Snapshot[];          // cache, sorted by tEpoch
  cursor:    number;              // tEpoch the UI is currently displaying
  isDirty:   boolean;             // has snapshots after cursor that aren't on server yet

  // commands
  createRun(initial: Omit<Run, "id"|"createdAt">): Promise<void>;
  appendEvent(e: Event):                          Promise<void>;
  setCursor(tEpoch: number):                      void;
  advance(ticks: number):                         void;
  rewindTo(tEpoch: number):                       void;
  flushToServer():                                Promise<void>;
};
```

### 8.2 Tick loop (when "play" is on)

```ts
function play(store: Store) {
  // Default speed: 1 sim-year / real-second at month tick = 12 ticks/sec ≈ 83 ms.
  // Speed control multiplies / divides this interval.
  const handle = setInterval(() => {
    store.advance(1);
    if (everyNTicks(10)) store.flushToServer();
  }, 83);
  return () => clearInterval(handle);
}
```

`advance(n)` runs the replay engine forward `n * tickSeconds` from `cursor`,
appends snapshots, moves cursor.

**Flush triggers.** The client PUTs snapshots to the server on (a) every 10
ticks while playing, (b) pause, (c) any rewind, and (d) any branch (after the
server has dropped the truncated future).

### 8.3 Plotting (2D)

`recharts` for Phase 1:

- One **`<LineChart>`** with two `<Line>` series (N and S) against time.
- A `<ReferenceLine>` for the cursor so the user can see where they are when
  scrubbing.
- Click on the chart → `setCursor(tEpoch)` → triggers `rewindTo`.

**Display units.** Snapshots store scaled values; the plot layer multiplies
`N * run.peoplePerUnit` for the people-count axis. Tooltip shows both the
people-count and the underlying scaled N. `S` gets the same treatment — same
multiplier, since S is denominated in "person-years of production" in
Turchin's scaling.

When the model widens to `(P, E, S)` (Option D), it's just one more `<Line>`.

### 8.4 Controls

Minimum useful set:

- Play / pause / step-once buttons.
- Speed multiplier (0.25x / 1x / 4x / 16x), defaulting to 1x = 1 sim-year/sec.
- Tick-size selector (week / month).
- Rewind slider, bound to `cursor`.
- One parameter slider per param ($r, \beta, c, s_0$). Editing a slider while
  paused emits a `param-set` event at the current cursor.
- "Branch from here" button — appears whenever the cursor is behind the latest
  snapshot and an edit is about to be made; warns that future snapshots will
  be dropped before applying the param-set.

## 9. Recommended libraries

| Concern               | Pick                  | Why                                                                    |
| --------------------- | --------------------- | ---------------------------------------------------------------------- |
| ODE integration       | **hand-rolled RK4**   | 20 lines. Adding an ODE library is more work than writing one.         |
| Client state          | **zustand**           | One-file store, no Provider needed. Right-sized for this app.          |
| 2D plotting           | **recharts**          | React-native, declarative. `uPlot` is faster but uglier in React.      |
| Server framework      | **express** (already) | No change.                                                             |
| Persistence           | **better-sqlite3**    | Sync API, single-file DB, zero ops. SQLite handles JSON columns since 3.38. |
| ID generation         | **nanoid**            | Smaller and faster than `uuid` for our purposes.                       |
| Validation at boundary| **zod**               | Validate POSTed event payloads; share schemas client/server.           |
| Tests                 | **vitest**            | First-class TS + ESM, same config style as Vite.                       |

Note: deliberately no `mathjs`, no `ode-solver`, no `d3` for plotting. Each
of those is bigger than the code that uses it.

## 10. Module / file layout

```
server/src/
  index.ts                  Express bootstrap (already exists)
  db.ts                     better-sqlite3 init, migrations
  routes/
    runs.ts                 POST/GET/DELETE /api/runs
    events.ts               event timeline endpoints
    snapshots.ts            snapshot cache endpoints
  types.ts                  shared Run/Event/Snapshot/Params interfaces (re-export)

client/src/
  main.tsx                  React bootstrap (already exists)
  App.tsx                   layout: header, plot, controls
  sim/
    model.ts                rhsC + ModelKind dispatcher
    integrator.ts           rk4Step, advanceTick
    replay.ts               paramsAt, replayTo, rewindTo
    types.ts                shared with server (consider a workspace shared/)
  store/
    runStore.ts             Zustand store
    api.ts                  fetch wrappers around /api/runs/...
  ui/
    Plot.tsx                <LineChart> + cursor
    Controls.tsx            play/pause/step + param sliders
    Timeline.tsx            event chips on a horizontal time axis
```

The shared-types story is best handled by a third workspace `shared/`
containing only types — no runtime. Add it to the npm-workspaces config
when both ends start referencing the same interfaces.

## 11. Effort estimate (person-months)
==> You are going to be doing all the progarmmings


Solo developer, part-time. PM = "person-month at full-time"; multiply by your
own factor for part-time. These are honest, not optimistic.

| # | Module                                              | PM    | Depends on |
| - | --------------------------------------------------- | ----- | ---------- |
| 1 | Shared types workspace                              | 0.05  | —          |
| 2 | Model + integrator (rhsC, rk4Step, advanceTick)     | 0.10  | 1          |
| 3 | Replay engine (paramsAt, replayTo, branching)       | 0.20  | 2          |
| 4 | Server: DB schema, migrations, repos                | 0.15  | 1          |
| 5 | Server: HTTP routes + zod validation                | 0.20  | 4          |
| 6 | Client: Zustand store + api wrappers                | 0.15  | 1, 5       |
| 7 | Client: Plot (recharts integration, cursor, click-to-rewind) | 0.20  | 6  |
| 8 | Client: Controls (sliders, play/pause, branch UX)  | 0.25  | 6          |
| 9 | Tests: integrator vs analytic logistic; replay determinism; HTTP round-trip | 0.25 | 3, 5 |
| 10 | Wire-up + polish + bug shakedown                   | 0.25  | all        |
| 11 | Docs: README run instructions, Phase 1 demo recipe | 0.05  | 10         |
|   | **Total**                                           | **~1.85 PM** |    |

For one part-time evening-and-weekends developer (say 25% capacity), that's
**~6-8 calendar weeks**.

## 12. Suggested sequencing

Goal: get a meaningful demo running end-to-end as early as possible, then
deepen.

**Week 1.** Vertical slice: shared types → `rhsC` + `rk4Step` → a hardcoded
client page that advances 200 years and renders one `LineChart`. No server,
no events, no rewind. Validates the math and the plot stack.

**Week 2.** Persistence: add server schema, `POST /api/runs` and
`PUT /api/snapshots`, client flushes on every advance. Now refreshing the
page restores the run.

**Week 3.** Events: introduce the timeline, replay-from-zero, parameter
sliders that emit events. Branching as a destructive operation.

**Week 4.** Rewind + scrub: cursor, slider, click-on-plot navigation. Sort
out the snapshot-cache reuse for performance.

**Weeks 5-6.** Tests, polish, demo recipe. Sanity-check Turchin's cited
period (~200-300 yr) emerges from default parameters.

**Slack.** Two of the eight weeks are slack — they will get consumed.

## 13. Non-Turchin models worth considering (no humans-as-prey)

Per the annotation: ecological models that treat colonists as the *prey* are
out. Plausible alternatives that fit the same `rhsC`-style interface:

- **Resource-limited logistic (Lotka-Volterra Eq 2.7 with humans as predator
  on a renewable resource).** Pop preys on a substrate (food crop / habitat
  patches), substrate regrows. Closer to ecology than to political history.
  Three parameters, one extra state variable. Comparable in shape to
  Option C.
- **Allee effect logistic.** $\dot N = r N (1 - N/K)(N/A - 1)$. Small
  colonies below threshold $A$ shrink (mate-finding, social cohesion,
  redundancy in critical skills). This is *very* on-theme for a small
  dependent colony — "go below 200 settlers and the colony cannot sustain
  itself even if resources are fine." Cheap to add (one extra parameter).
- **Discrete-generation maps (Ricker, Beverton-Holt).** Replace the ODE
  with a recurrence $N_{t+1} = N_t \exp(r(1 - N_t / K))$. Generation-scale
  models, naturally produce overshoot cycles. Less mathematically elegant
  but cheap to compose.

These can all be added later as additional `ModelKind` values without
disturbing the replay engine or the server schema.

## 14. Forward look (out of scope for Phase 1)

- **Option D** lands as `ModelKind = "D-class-structured"`: widens `StateC`
  to `{P, E, S}` and `ParamsC` to seven entries. Replay engine, server,
  plot all unchanged in structure.
- **Economics / supply chain / social breakdown** (annotation): each is one
  more `ModelKind` or a parameter on an existing one. The integrator
  framework absorbs them.
- **MeridianWorlds integration**: at that point the "3D framing" question
  resurfaces. Likely shape — MeridianWorlds is the **canvas**, ColonyModels'
  snapshot stream is **content** anchored to a body/system. ColonyModels
  stays the source of truth for time series; MeridianWorlds renders them
  spatially. The seconds-since-epoch time anchor and the JSON snapshot
  format are designed to make that join cheap.

## 15. Open items before coding (resolved)

These were the things to pin before opening the first file. All resolved.

1. **Tick default.** Week or month? → **month**.
2. **Initial colony scale.** Default for blank-run template → take as input
   from the user on run creation; default suggestion **200 settlers,
   0 stored surplus, $t_0$ = canonical sci-fi epoch 2300-01-01**. See §16.
3. **Persistence flavor.** SQLite vs. in-memory → **SQLite (durable)**.
4. **Shared types workspace.** Set up now or defer? → **set up now**.

## 16. Follow-up decisions (2026-05-23)

Resolved in conversation, captured here so the next pass doesn't re-litigate.

1. **Display units.** Internal storage is **scaled** (matches Turchin). Each
   run carries `peoplePerUnit: number` (default **1000**) that the UI applies
   only at the plot/readout layer. The user sets it on run creation; the
   integrator and replay engine never see it.
2. **Founding date default.** Blank-run template uses **2300-01-01 UTC** as
   `t0Epoch`. Concretely: `Date.UTC(2300, 0, 1) / 1000 = 10_413_792_000`.
   Users can override per run.
3. **Run names.** Required at creation. Schema: `name TEXT NOT NULL`.
   The "create run" form refuses an empty name. No uniqueness constraint —
   runs are still identified by `id` (nanoid).
4. **Default playback speed.** **1 sim-year per real second** at month tick
   = 12 ticks/sec ≈ 83 ms timer. UI exposes a multiplier
   (0.25x / 1x / 4x / 16x); default 1x.

These are reflected upstream in §3 (Run type), §7.1 (schema), §8.2 (tick
loop), §8.3 (plot units), §8.4 (controls).

## 17. Blank-run template (canonical defaults)

What the server seeds when a user clicks "New run" and accepts everything:

```ts
const BLANK_RUN: Omit<Run, "id" | "createdAt"> = {
  name:          "",                          // user must fill in
  modelKind:     "C-basic-demfisc",
  t0Epoch:       10_413_792_000,              // 2300-01-01 UTC
  tickSeconds:   2_629_746,                   // 1 month
  peoplePerUnit: 1000,                        // 1 scaled unit = 1000 settlers
  initialState:  { N: 0.2, S: 0.0 },          // 200 settlers, no surplus
  initialParams: { r: 0.02, beta: 0.25, c: 3, s0: 1 },  // Turchin's "reasonable" set, scaled
};
```

`initialParams` come from Turchin §7.2.1 / Fig 7.1: $r=0.02\,\text{yr}^{-1}$,
$\beta=0.25$, $c=3$, $s_0=1$. With these, the system runs a ~200-yr secular
cycle — the canonical sanity-check for the integrator.

# Phase 1 Design

Concrete implementation design derived from
[Phase1Options.md](Phase1Options.md). No code yet — pseudo-code,
contracts, and effort estimates only.

## Companion documents

This document is the design *intent*. Several companion documents handle
execution and process. Quick map:

| Document | Purpose |
| -------- | ------- |
| [README.md](README.md) | Index of `docs/design/` with reading order. |
| [Phase1Checklist.md](Phase1Checklist.md) | Step-by-step execution log; numbered by slice. |
| [Phase1AutomatedTests.md](Phase1AutomatedTests.md) | Detailed specs for every **automated** test, numbered in alignment with the checklist. |
| [Phase1TestCases.md](Phase1TestCases.md) | Detailed procedures for every **manual** verification, numbered in alignment with the checklist. |
| [Phase1DoD.md](Phase1DoD.md) | Slice-agnostic Definition of Done; gate every green review. |
| [Phase1PBT.md](Phase1PBT.md) | Property-based testing plan; companion to TestCases for the math layer. |
| [Phase1RiskRegister.md](Phase1RiskRegister.md) | Active risks + mitigations; reviewed at every green review. |
| [Phase1Retros.md](Phase1Retros.md) | One section per slice; written at green review. |
| [adr/](adr/) | Architecture Decision Records. |
| [HANDOVER.md](HANDOVER.md) | Cross-session continuity doc; read first if starting fresh. |

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

Plain RK4, generic in the state type and the RHS function. ~20 lines, no
library needed. See [Decision 0004](adr/0004-generic-rk4-integrator.md) for
why `rk4Step` takes the RHS as a parameter rather than calling `rhsC`
directly.

```ts
function rk4Step<S>(s: S, dt: number, rhs: (s: S) => S): S {
  const k1 = rhs(s);
  const k2 = rhs(addScaled(s, k1, dt/2));
  const k3 = rhs(addScaled(s, k2, dt/2));
  const k4 = rhs(addScaled(s, k3, dt));
  const incr = combine(k1, k2, k3, k4);     // (k1 + 2k2 + 2k3 + k4) / 6
  return clampNonNeg(addScaled(s, incr, dt));
}
```

A "driver" advances by exactly one UI tick, binding `rhsC` (and the
active `ParamsC`) at the call site:

```ts
function advanceTick(s: StateC, p: ParamsC, tickYears: number, dtIntegYears: number): StateC {
  const nSteps = Math.round(tickYears / dtIntegYears);
  const rhs = (st: StateC) => rhsC(st, p);
  let cur = s;
  for (let i = 0; i < nSteps; i++) cur = rk4Step(cur, dtIntegYears, rhs);
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
| ODE integration       | **hand-rolled RK4**   | 20 lines. Adding an ODE library is more work than writing one. See [Decision 0002](adr/0002-hand-rolled-rk4-over-ode-library.md). |
| Client state          | **zustand**           | One-file store, no Provider needed. Right-sized for this app.          |
| 2D plotting           | **recharts**          | React-native, declarative. `uPlot` is faster but uglier in React.      |
| Server framework      | **express** (already) | No change.                                                             |
| Persistence           | **better-sqlite3**    | Sync API, single-file DB, zero ops. SQLite handles JSON columns since 3.38. See [Decision 0001](adr/0001-sqlite-for-phase-1-persistence.md). |
| ID generation         | **nanoid**            | Smaller and faster than `uuid` for our purposes.                       |
| Validation at boundary| **zod**               | Validate POSTed event payloads; share schemas client/server.           |
| Tests (examples)      | **vitest**            | First-class TS + ESM, same config style as Vite.                       |
| Tests (HTTP)          | **supertest**         | In-process express round-trip; no port binding required.               |
| Tests (properties)    | **fast-check**        | Generative testing for the math layer. See [Phase1PBT.md](Phase1PBT.md). |

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

## 11. Effort estimate

Claude implements; the user supervises and reviews. The implementation PM
figures are kept for sizing intuition; the second column is what actually
costs the user wall-clock time.

> **Vocabulary used in this section:** *red test*, *red review*, *red commit*,
> *green*, *slice*, *anchor*, *double-approval gate*, *math-correctness
> review* are all defined in §18 Glossary. Methodology origin is TDD
> (Kent Beck, *Test-Driven Development: By Example*, 2002).
>
> **Companion docs for this section:**
> - [Phase1Checklist.md](Phase1Checklist.md) is the step-by-step execution log
>   of the slicing in §12.
> - [Phase1DoD.md](Phase1DoD.md) is the explicit Definition of Done; every
>   green review fills it in and signs off.
> - [Phase1AutomatedTests.md](Phase1AutomatedTests.md) holds the detailed
>   specs for automated tests; [Phase1TestCases.md](Phase1TestCases.md)
>   holds the procedures for manual verifications.
> - [Phase1PBT.md](Phase1PBT.md) adds property-based tests to the math layer.
> - [Phase1RiskRegister.md](Phase1RiskRegister.md) is reviewed at every green
>   review.
> - [Phase1Retros.md](Phase1Retros.md) gets a new entry at every green review.

**Test-first discipline.** Each module slice begins by writing the tests
for the behavior the slice will deliver. Those tests are committed (or at
least running in the watcher) in a failing state — the imports resolve to
not-yet-written modules and `vitest` reports red. The slice is "done" when
the red tests for that slice turn green and stay that way. Details and
rules in §11.2; per-slice test inventory in §12. Test work is bundled into
each row's Impl column — there is no separate "write the tests" row.

| # | Module                                              | Impl (Claude, PM) | Human supervision + review |
| - | --------------------------------------------------- | ----------------- | -------------------------- |
| 0 | Test harness + red regression anchors               | 0.10              | ~1 hr — confirm anchors are right, red, and meaningful |
| 1 | Shared types workspace                              | 0.05              | ~30 min                    |
| 2 | Model + integrator (rhsC, rk4Step, advanceTick) + unit tests | 0.15     | ~1 hr — sanity-check math against Turchin |
| 3 | Replay engine (paramsAt, replayTo, branching) + unit tests   | 0.25     | ~2 hr — branching semantics; high-bug-density area |
| 4 | Server: DB schema, migrations, repos + repo tests   | 0.20              | ~45 min                    |
| 5 | Server: HTTP routes + zod validation + integration tests | 0.25         | ~1 hr — boundary contracts |
| 6 | Client: Zustand store + api wrappers + store tests  | 0.20              | ~1 hr                      |
| 7 | Client: Plot (recharts, cursor, click-to-rewind)    | 0.20              | ~1.5 hr — UX feel calls    |
| 8 | Client: Controls (sliders, play/pause, branch UX)   | 0.25              | ~2 hr — UX feel calls      |
| 9 | Wire-up + polish + bug shakedown                    | 0.25              | ~2 hr — running the app, finding rough edges |
| 10 | Docs: README run instructions, demo recipe         | 0.05              | ~30 min                    |
|    | **Total**                                          | **~1.95 PM**      | **~13-14 hr human time**  |

Row 9 of the old plan ("Tests") has been **distributed** into rows 0, 2, 3,
4, 5, 6 — testing is no longer a final-week activity. The PM total ticks
up slightly because writing tests first carries a small ceremony overhead,
but the wire-up/polish row should shrink in practice as fewer bugs survive
to integration.

The supervision column assumes the per-slice review cadence in §11.1 — drop
or skip reviews at your own risk.

### 11.1 Review cadence

Reviews happen at predictable seams so the user can budget time, and so
Claude knows when to stop and ask rather than barrel through.

- **Double-approval gate (every [HUMAN] approval step — mandatory, no
  exceptions).** Claude does not proceed on a single approval. After the
  user says "proceed" / "approved" / "go" / equivalent, Claude **echoes
  the specific next action** ("Confirming: about to commit X with message
  Y — proceed?") and waits for a second explicit confirmation. Only after
  the second "yes" does Claude advance. The redundancy is the point:
  short approvals are typo-prone (`n` intended as `no` can read as noise;
  `ok` can be sent by mistake), and the cost of asking again is almost
  zero. Even if the first approval is a full unambiguous sentence, still
  echo and wait — the echo is the user's chance to catch a slip on the
  first message. Do not optimise this away.
- **Red review (start of every slice).** Claude writes the slice's failing
  tests first, runs them, and pauses with a summary: which tests exist,
  what each one asserts, and confirmation that all of them are red for the
  right reason (missing module, missing function — not a typo). The user
  signs off that the tests *describe the right behaviour* before any
  implementation lands. ~15-30 min per slice. Subject to the
  double-approval gate above.
- **Green review (end of every slice, mandatory).** Implementation done,
  all slice tests pass, no previously-green tests turned red. Claude posts
  a "ready for review" summary listing changed files, the test output, and
  what to look at first. Claude also (a) updates
  [Phase1RiskRegister.md](Phase1RiskRegister.md) with any new risks or
  status changes, (b) drafts a slice entry in
  [Phase1Retros.md](Phase1Retros.md), and (c) fills in the slice's
  [Phase1DoD.md](Phase1DoD.md) checklist. The user reads the diff, walks
  the DoD, signs off on the retro, and either signs off or sends back
  changes. ~1-2 hr per slice.
- **Mid-slice check-in (on judgement calls).** When Claude hits a decision
  the design doesn't pin down — naming, an API shape, a UX micro-decision
  — stop and ask in chat rather than picking and apologising later. Cheap
  interrupt, expensive rework.
- **Pre-commit triage (every commit).** Claude does not push commits
  unprompted. Before any `git commit`, summarise what would land and get
  explicit go-ahead. A red commit (failing tests intentionally) is fine
  but must be flagged as such in the commit message.
- **Math-correctness review (after Slice 0 and after Slice 5).** The two
  numerical regression anchors — analytic logistic and Turchin cycle
  period — get a longer look. After Slice 0, the user confirms the
  assertions and tolerances are sane while the tests are still red. After
  Slice 5, the user confirms the tests are now green and the integrator
  output matches expectation when plotted.

### 11.2 Test-first discipline (rules)

Operational rules that make "test-first" actually happen rather than slide
into "tests at the end" by attrition.

1. **No production code without a red test for it.** If Claude is about to
   write a function whose behaviour is not pinned by a failing test, stop
   and write the test first. Trivial glue (re-exports, type aliases, file
   layout) is exempt.
2. **The test must fail for the right reason.** A missing-module error
   counts as red, but only on the first run — once the module exists, the
   test must fail at an *assertion*, not an *import*. Otherwise the red
   doesn't tell you anything.
3. **Tests committed red are explicitly labelled.** Commit message starts
   with `red:` if any test in the commit is expected to fail. The follow-up
   commit that turns them green starts with `green:`. This makes the TDD
   rhythm visible in `git log`.
4. **`npm test` runs the whole suite.** No selective skipping by default.
   Slow tests (the Turchin cycle-period anchor is the candidate) can sit
   behind a `--run-slow` flag or a separate `npm run test:slow` if they
   start hurting the inner loop — but only once they actually do.
5. **Watcher is the inner loop.** `vitest --watch` runs continuously during
   a slice. The red → green transition is observed live, not retrofitted.
6. **UI components are out of scope.** Per the recommendation accepted
   earlier, Plot and Controls get manual smoke-testing, not RTL tests.
   The Zustand *store* (rows 6) is testable headlessly and *is* covered —
   that's where the UI's interesting behaviour lives anyway.
   *Property-based tests* (specs that hold for many generated inputs)
   apply to the math layer only: model, integrator, replay engine. See
   [Phase1PBT.md](Phase1PBT.md) for generators, properties, and run-count
   policy. Asserts tests live alongside example tests in the same `*.test.ts`
   files.
7. **CI is not part of Phase 1.** "Automated" here means the local
   `vitest --watch` loop plus the discipline of running the full suite
   before any commit. A GitHub Action wrapping `npm test` is a 10-line
   add when the project leaves the prototype phase; not now.

## 12. Suggested sequencing

Goal: get a meaningful demo running end-to-end as early as possible, then
deepen. Each slice begins with failing tests (red review) and ends with
those tests passing (green review). The per-slice test inventory below is
what should be red at slice start.

**Slice 0 — Test harness + red anchors.** Install `vitest`, `supertest`,
shared workspace skeleton. Write the two numerical regression anchors as
failing tests:
- `logistic.analytic.test.ts` — imports `rk4Step` (doesn't exist yet),
  integrates pure logistic to year 200, asserts within `1e-6` of the
  closed-form $N(t) = K / (1 + ((K-N_0)/N_0) e^{-rt})$.
- `turchin.cycle.test.ts` — imports `replayTo` (doesn't exist yet), runs
  600 yr with §17 defaults, asserts first peak in `[80, 220]` yr and next
  trough at least 100 yr after the peak. Loose tolerances on purpose.

Also write the HTTP round-trip skeleton (`runs.roundtrip.test.ts`) against
not-yet-existent routes. All red on `npm test`. Commit message: `red:`.

**Slice 1 — Shared types + integrator.** Write `model.test.ts` and
`integrator.test.ts` (rhsC algebra, single-step RK4 against hand-computed
values, $S \ge 0$ clamp behavior). All red. Then implement
`shared/`, `sim/model.ts`, `sim/integrator.ts` until those tests *and* the
Slice 0 analytic-logistic anchor go green. Hardcoded client page renders
the result; no server, no events. Math-correctness review on green.

**Slice 2 — Replay engine.** Write `replay.test.ts` covering: `paramsAt`
with zero/one/many param-set events; `replayTo` determinism (same events →
same output, bit-identical); branching (drop-after-T then append) producing
a different trajectory; mid-tick event handling lands at the exact event
time, not the next tick boundary. All red. Implement `sim/replay.ts` until
green. The Turchin cycle-period anchor from Slice 0 should also turn green
here.

**Slice 3 — Persistence + HTTP.** Write `db.test.ts` (repo CRUD against an
in-memory SQLite) and complete `runs.roundtrip.test.ts` (create run, POST
events, PUT snapshots, GET them back, byte-equal). All red. Implement
`server/src/db.ts`, routes, zod schemas, until green.

**Slice 4 — Client store wiring.** Write `runStore.test.ts` covering the
store commands (`createRun`, `appendEvent`, `rewindTo`, `advance`,
`flushToServer`) with a mocked fetch layer. All red. Implement
`client/src/store/`. Page now restores on refresh.

**Slice 5 — UI controls + scrubbing.** Plot, Controls, Timeline. No
component tests; manual smoke-test against the running app. Slice ends with
a math-correctness review: defaults produce a visible cycle, scrubbing
rewinds correctly, branching warns and works.

**Slice 6 — Polish + demo recipe.** Bug shakedown, README run instructions,
short demo recipe doc. Full `npm test` green throughout.

**Slack.** Two of the eight weeks are slack — they will get consumed by
real-world bug surprises and review turnaround.

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
  initialState:  { N: 0.5, S: 0.0 },          // k₀/2 = 500 settlers, no surplus (Turchin p.123)
  initialParams: { r: 0.02, beta: 0.25, c: 3, s0: 10 }, // Turchin Fig 7.1 / §7.2.1 verbatim
};
```

`initialParams` and `initialState` come from Turchin §7.2.1 / Fig 7.1 caption
(p.124) and prose (p.123): $r = 0.02\,\text{yr}^{-1}$, $\beta = 0.25$,
$c = 3$, $s_0 = 10$, with $N_0 = k_0/2$ and $S_0 = 0$. With these, the
deterministic model runs **one** state-building / collapse excursion of
2-3 centuries (Turchin p.126) and then settles to the stateless equilibrium
$(N = k_0, S = 0)$ for the rest of the horizon (Turchin p.123: "in a
deterministic world, once the state collapses, it cannot arise again").
Recurring cycles like Turchin's Fig 7.2 require stochastic forcing, which
Phase 1 does not implement. This single-excursion behavior is the canonical
sanity-check for the integrator; see [Phase1MathDerivations.md](Phase1MathDerivations.md)
for the citation-anchored derivation.

## 18. Glossary

Terms used throughout this document and its companions
([Phase1Checklist.md](Phase1Checklist.md),
[Phase1TestCases.md](Phase1TestCases.md),
[HANDOVER.md](HANDOVER.md)). When a term is defined here, prose in those
documents uses it without restating the definition.

### TDD vocabulary

Methodology origin: Kent Beck, *Test-Driven Development: By Example*
(Addison-Wesley, 2002). Part of the Extreme Programming (XP) family. The
red/green colour convention comes from the JUnit GUI test runner's
red-bar/green-bar display, c. 2000.

- **Red test.** A test that is *currently failing on purpose*, written
  before the production code that will make it pass. Per §11.2 rule 2, on
  the very first run a red test may fail at *import* (the module under
  test does not yet exist); after the module exists it must fail at an
  *assertion*, not an import. Either failure mode counts as red.
- **Red phase.** The portion of a slice in which Claude writes the
  slice's failing tests and runs them.
- **Red review.** The [HUMAN] gate at the end of the red phase: the user
  reads the failing tests and signs off that they describe the right
  behaviour, *before* any implementation lands. See §11.1.
- **Red commit.** A commit that intentionally contains failing tests.
  Marked with the `red:` commit-message prefix (§11.2 rule 3) so the TDD
  rhythm is visible in `git log`.
- **Green.** State after the implementation lands and previously red
  tests pass. **Green commit** = `green:` prefix. **Green review** = the
  [HUMAN] sign-off after implementation, also called the end-of-slice
  review (§11.1).
- **Red-Green-Refactor.** Beck's canonical TDD cycle: write failing test
  (red) → write minimum code to pass (green) → improve structure without
  breaking tests (refactor). Phase 1 applies Red-Green strictly;
  refactoring is opportunistic and not separately gated.

### Project-specific vocabulary

- **Slice.** A vertical chunk of work, roughly one week, that begins with
  a red phase and ends with a green review. Sliced sequencing in §12;
  per-slice checklist in [Phase1Checklist.md](Phase1Checklist.md).
- **Anchor (regression anchor).** A high-stakes automated test that pins
  a behaviour the rest of the project depends on. Phase 1 has two:
  analytic-logistic (TestCases 0.2.1) and Turchin cycle period
  (TestCases 0.2.2). Anchors are red at Slice 0 and turn green at Slices
  1 and 2 respectively.
- **Math-correctness review.** A specific [HUMAN] review (§11.1)
  performed after Slice 0 (confirm anchor specs are right while still
  red) and after Slice 5 (confirm anchors are green and the live UI
  reproduces expected dynamics).
- **Double-approval gate.** The protocol in §11.1 first bullet: at every
  [HUMAN] approval step, Claude waits for two explicit user
  confirmations (with Claude echoing the specific next action in between)
  before advancing.
- **Blank-run template.** The canonical default values used when a user
  creates a new run. The constant lives in §17.
- **Branching.** The destructive operation of dropping all events and
  snapshots after a cursor time $t_r$, then appending a new event at
  $t_r$. The original "future" is gone — not versioned, not undoable in
  Phase 1. See §6.4.
- **Cursor.** The point in run-time the UI is currently displaying. Stored
  in the client store; advanced by Play / step; rewound by the slider or
  click-on-plot. See §8.1.

### Model / math vocabulary

- **Secular cycle.** Turchin's term for the slow boom-and-bust dynamics
  (period ~200-300 yr in his cited parameter range) that emerge from the
  two-equation coupling between population and accumulated state
  resources. See [Phase1Options.md](Phase1Options.md) §1.
- **Carrying capacity, $k(S)$.** The maximum sustainable population, here
  modelled as a saturating function of accumulated state resources $S$.
  See §4.
- **Tick.** One UI-time increment. Default = 1 month = 2,629,746 s.
  Internally the integrator runs many small RK4 steps per tick (default
  dt = 1 day = 1/365.25 yr). See §2.
- **Snapshot.** The persisted (N, S) state at one tick boundary. Derived
  from the event timeline; never the source of truth. See §3, §6.5.
- **Event.** An append-only entry in a run's timeline. Phase 1 kinds:
  `param-set`, `state-poke`, `stop`. The full event list **is** the run's
  source of truth; snapshots are a derived cache. See §3, §6.
- **Replay engine.** The pure-function code (`paramsAt`, `replayTo`) that
  turns a run plus its event list into a snapshot sequence. Deterministic
  by construction. See §6.
- **Scaled units.** Turchin's Eq 7.4 is written in units where the base
  carrying capacity = 1. We store N and S in those units; the
  `peoplePerUnit` field on a `Run` multiplies for display only. See §16
  item 1.

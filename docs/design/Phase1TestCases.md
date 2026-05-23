# Phase 1 Test Cases

Companion to [Phase1Checklist.md](Phase1Checklist.md). One entry per
verification step in the checklist, numbered identically. Use this document
when:

- **Writing a test (red phase)** — the case spec tells you what the test
  must assert.
- **Reviewing a red test** — confirm the test matches the spec.
- **Running a manual verification** — follow the procedure; record the
  result in the **Execution log** block at the bottom of each entry.
- **Re-running after a fix** — append a new dated line to the execution
  log; do not overwrite history.

**Conventions.**

- *Type:* `Automated` (runs in `npm test`) or `Manual` (requires a human).
- *Owner:* `[AI]` writes/runs it, or `[HUMAN]` executes it.
- *Pass criteria:* concrete, measurable. No "looks ok."
- *Status values:* `pending` → `pass` / `fail` / `blocked`. Always include
  date (ISO) and either a commit hash, a `npm test` excerpt, or a
  screenshot path as evidence.

---

## Index

| Case | Type | Description |
| ---- | ---- | ----------- |
| **Slice 0** | | |
| 0.2.1 | Auto | Analytic logistic regression anchor |
| 0.2.2 | Auto | Turchin cycle-period regression anchor |
| 0.2.3 | Auto | HTTP round-trip skeleton (red) |
| 0.3.3 | Manual | Red review: assertion bounds + tolerances are correct |
| **Slice 1** | | |
| 1.1.2 | Auto | `rhsC` algebra on hand-computed inputs |
| 1.1.3 | Auto | RK4 single-step + clamps |
| 1.3.3 | Manual | Hardcoded run plot renders correctly |
| 1.3.4 | Manual | Math-correctness anchor (post-integrator) |
| **Slice 2** | | |
| 2.1.1 | Auto | Replay engine: paramsAt, determinism, branching, mid-tick |
| 2.3.3 | Manual | Plot identical to Slice 1's reference plot |
| **Slice 3** | | |
| 3.1.1 | Auto | DB repo CRUD + cascade |
| 3.1.2 | Auto | HTTP round-trip full + zod rejection |
| 3.3.3 | Manual | Live `curl` round-trip against the running server |
| **Slice 4** | | |
| 4.1.1 | Auto | Zustand store commands + state transitions |
| 4.3.3 | Manual | Refresh restores byte-identical state |
| **Slice 5** | | |
| 5.3.2.a | Manual | Create-run form requires name |
| 5.3.2.b | Manual | Play / pause / step controls |
| 5.3.2.c | Manual | Speed multiplier |
| 5.3.2.d | Manual | Rewind slider |
| 5.3.2.e | Manual | Click-on-plot rewind |
| 5.3.2.f | Manual | Slider edit at latest tick (no branch warn) |
| 5.3.2.g | Manual | Slider edit behind latest tick (branch warn) |
| 5.3.2.h | Manual | Reload restores state |
| 5.3.3 | Manual | Math-correctness anchor 2: UI-observable determinism |
| **Slice 6** | | |
| 6.5.1 | Auto | Full suite green at sign-off |
| 6.x.y | Auto + Manual | Ad-hoc bug-fix tests added during triage |

---

## Slice 0 — Test harness + red regression anchors

### 0.2.1 — Analytic logistic regression anchor

- **Aligned with checklist step:** 0.2.1 (write the test). Turns green at 1.2.5.
- **Type:** Automated unit test.
- **Owner:** [AI] writes, runs.
- **File:** `client/src/sim/logistic.analytic.test.ts`.

**What it verifies.** That `rk4Step` integrates the pure logistic equation
$\dot N = r N (1 - N/K)$ to within numerical-noise tolerance of the
closed-form solution over 200 years.

**Setup (test inputs).**
- `r = 0.05` per year
- `K = 1000`
- `N0 = 10`
- Integrator step `dt = 1/365.25` years
- Total horizon: 200 years (`n = 73050` steps)

**Reference (closed form).**
$$N(t) = \frac{K}{1 + \left(\frac{K - N_0}{N_0}\right) e^{-rt}}$$

**Procedure.** `npm test --workspace client`.

**Pass criteria.**
- At each of `t ∈ {50, 100, 150, 200}` years, $|N_\text{rk4}(t) - N_\text{analytic}(t)| < 10^{-6}$.

**Failure modes to watch for.**
- Missing `1/6` factor in RK4 combine → error grows monotonically.
- `dt` mistakenly passed in seconds instead of years → divergence.
- Sign error in $\dot N$ → exponential blow-up.
- Clamp `N ≥ 0` triggering inside a passing run (shouldn't, for these inputs).

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: —
- Notes: —

---

### 0.2.2 — Turchin cycle-period regression anchor

- **Aligned with checklist step:** 0.2.2. Turns green at 2.2.3.
- **Type:** Automated unit test (slow-ish; consider behind `--run-slow` later).
- **Owner:** [AI] writes, runs.
- **File:** `client/src/sim/turchin.cycle.test.ts`.

**What it verifies.** That the full coupled Eq 7.4 system, run with the §17
canonical defaults via `replayTo` (not just `rk4Step`), produces Turchin's
characteristic secular cycle in a recognisable period band.

**Setup (test inputs).** §17 `BLANK_RUN` defaults verbatim:
`r=0.02, beta=0.25, c=3, s0=1; N=0.2, S=0; tickSeconds = 2_629_746 (1 month)`.
Horizon: 600 years.

**Procedure.** Call `replayTo(run, [], targetEpoch = t0Epoch + 600 * SECS_PER_YEAR)`.
Scan returned snapshots' `state.N` for local extrema.

**Pass criteria.**
- First local maximum of `N` occurs at `t ∈ [80, 220]` years after `t0`.
- The next local minimum occurs at least 100 years after that first peak.
- Final `N` at year 600 is in `(0, 1.5]` (no blow-up, no extinction).

Tolerances are deliberately loose — the goal is "secular cycle appears,"
not "matches Turchin's figure to three decimal places."

**Failure modes to watch for.**
- `S ≥ 0` reset missing → state runs negative, dynamics wrong.
- Tick / dt unit confusion → wrong period (off by SECS_PER_YEAR).
- `k(S)` denominator-zero glitch at `S = 0` (shouldn't, since `s0 > 0`).

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: —
- Notes: —

---

### 0.2.3 — HTTP round-trip skeleton

- **Aligned with checklist step:** 0.2.3. Skeleton stays red until 3.2.5.
- **Type:** Automated integration test (`supertest`).
- **Owner:** [AI] writes, runs.
- **File:** `server/src/routes/runs.roundtrip.test.ts`.

**What it verifies (skeleton scope).** That an HTTP client can:
1. `POST /api/runs` with a valid Run body → receives `{id}`.
2. `GET /api/runs/:id` → receives the run back, byte-equal on persisted fields.
3. `POST /api/runs/:id/events` with one event → 200.
4. `GET /api/runs/:id/events` → receives the event back.
5. `PUT /api/runs/:id/snapshots` with one snapshot → 200.
6. `GET /api/runs/:id/snapshots` → receives the snapshot back.

**Procedure.** `npm test --workspace server`. Uses in-memory SQLite
(`:memory:`); no on-disk side effects.

**Pass criteria (full, post-Slice 3).**
- Every step returns HTTP 200.
- Every GET response has fields byte-equal to the corresponding POST/PUT body.
- The run record persists across the test's express-app boot.

**Failure modes to watch for.**
- Numbers silently coerced to strings via JSON.
- `JSON` SQLite columns stored as strings vs parsed objects on read.
- Missing `JSON.parse` in repo layer → response shape wrong.
- Wrong status codes (201 vs 200) — pick one in Slice 3 and stick to it.

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: —
- Notes: —

---

### 0.3.3 — Red review of anchors (math-correctness review #1)

- **Aligned with checklist step:** 0.3.3.
- **Type:** Manual review.
- **Owner:** [HUMAN].

**Prerequisites.** 0.2.1 + 0.2.2 + 0.2.3 committed in red state. `npm test`
output captured by [AI] in 0.3.2.

**Procedure.**
1. Open `logistic.analytic.test.ts`. Verify:
   - Closed-form formula written correctly (compare to entry 0.2.1 above).
   - Tolerance is `1e-6`, not `1e-3` or `1e-9`.
   - Sample points are at least 4, spanning the horizon.
2. Open `turchin.cycle.test.ts`. Verify:
   - `BLANK_RUN` defaults are imported, not duplicated inline.
   - Peak-search logic actually finds extrema (not just `max(N)`, which a
     monotonic run would also satisfy).
   - Bounds `[80, 220]` and `≥ 100 yr` match this document.
3. Open `runs.roundtrip.test.ts` skeleton. Verify:
   - Each request goes through `supertest(app)`, not over a real port.
   - Uses an in-memory SQLite instance, freshly initialised per test.
4. Confirm test output shows all three failing at *import* (missing module)
   — that's the expected red at Slice 0.

**Pass criteria.**
- All three test files describe behaviours that match this document's specs.
- No test asserts something the design doesn't require.
- No test misses something the design *does* require.
- Failures are import-time (not e.g. silent passes via `expect.skip`).

**Failure modes to watch for.**
- Test passes when it shouldn't (e.g. uses `toBeDefined()` instead of
  numerical comparison).
- Tolerance set so loose the test would pass even with a broken integrator.
- Off-by-one in sample times (e.g. asserting at t=200 when run only goes
  to 199).

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: —
- Notes: —

---

## Slice 1 — Shared types + model + integrator

### 1.1.2 — `rhsC` algebra on hand-computed inputs

- **Aligned with checklist step:** 1.1.2.
- **Type:** Automated unit test.
- **File:** `client/src/sim/model.test.ts`.

**What it verifies.** `rhsC(s, p)` produces the correct dN/dt and dS/dt for
known states, including boundary cases.

**Setup.** Use §17 params. Hand-compute three cases:

| Case | N | S | Expected dN/dt | Expected dS/dt |
| ---- | - | - | -------------- | -------------- |
| Low N | 0.01 | 0 | r * 0.01 * (1 - 0.01/1) = 0.000198 | 0.01 * (1 - 0.01) - 0.25 * 0.01 = 0.0074 |
| Near k | 0.99 | 0 | r * 0.99 * (1 - 0.99) ≈ 0.000198 | tiny positive minus 0.25 * 0.99 |
| With state | 0.5 | 1.0 | k = 1 + 3*(1/2) = 2.5; dN = 0.02 * 0.5 * (1 - 0.5/2.5) | (production) - 0.25*0.5 |

Pre-compute the expected numbers exactly with a calculator and bake them
into the test; do not derive them inside the test or you'll just test the
implementation against itself.

**Pass criteria.**
- Each expected value matches `rhsC(s, p)` output to `1e-12`.

**Failure modes.**
- `k(S)` formula has wrong shape (e.g. `c*S/s0` instead of `c*S/(s0+S)`).
- `beta` subtracted from wrong equation.
- Production term missing the `(1 - N/k)` factor in dS/dt.

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: —
- Notes: —

---

### 1.1.3 — RK4 single-step + clamps

- **Aligned with checklist step:** 1.1.3.
- **Type:** Automated unit test.
- **File:** `client/src/sim/integrator.test.ts`.

**What it verifies.** That one `rk4Step` for a trivial RHS gives the
analytically correct value, and that the post-step clamps behave correctly.

**Setup A (trivial RHS, no clamp issue).** Substitute a temporary RHS
`f(x) = x` (dx/dt = x). One RK4 step of size `h` from `x = 1` should
return `1 + h + h²/2 + h³/6 + h⁴/24` (Taylor expansion of $e^h$ to 4th
order).

**Setup B (N clamp).** Use `rhsC` with a state that the integrator would
drive negative within a step (large beta, low N). After the step, assert
`N >= 0`.

**Setup C (S manual reset).** State `{N: 0.1, S: 0.01}` with large `beta`
designed to push S negative in one step. Assert `S === 0` afterwards
(strict equality — the reset is `S = 0`, not `S = abs(S)`).

**Pass criteria.**
- Setup A: result matches Taylor sum to `1e-12` for `h ∈ {0.01, 0.1}`.
- Setup B: `N >= 0` after step.
- Setup C: `S === 0` after step (not negative, not original value).

**Failure modes.**
- Clamps applied to RHS output rather than state.
- `S` clamp implemented as `max(S, ε)` for some `ε > 0` (drifts state).
- RK4 coefficients off by one (e.g. `2*k3` typo as `k3`).

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: —
- Notes: —

---

### 1.3.3 — Hardcoded run plot renders correctly

- **Aligned with checklist step:** 1.3.3.
- **Type:** Manual (requires display).
- **Owner:** [HUMAN].

**Prerequisites.** Slice 1 implementation merged; `npm run dev` running;
browser at `http://localhost:5173`.

**Procedure.**
1. Open the app in a browser.
2. Wait for the chart to render (should be instant; if not, something
   else is wrong).
3. Inspect the chart visually.

**Pass criteria.**
- A `<LineChart>` is visible (not a blank canvas, not an error overlay).
- Two distinct data series rendered, with a legend identifying them as `N`
  and `S`.
- X-axis label: years (or year-from-t0); ticks readable.
- Y-axis label: people (since `peoplePerUnit = 1000`, the N axis should
  top out near 1000-3000 for the §17 defaults).
- Both series are non-negative throughout.
- `N` has at least one visible peak and one visible trough within the
  600-yr horizon.
- The first peak's x-coordinate is between year 80 and year 220 (eyeballed
  to the nearest 20 yr is fine; precise check is automated in 0.2.2).
- No browser-console errors (open devtools, confirm clean).

**Failure modes.**
- Plot renders but axes are unlabelled or in wrong units.
- N series drowns S (S is much smaller-magnitude; may need a secondary axis
  — flag if so).
- Cycle period clearly outside [80, 220] yr → bug in integrator or in the
  hardcoded params; do not pass.

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: (paste screenshot path or describe) —
- Notes: —

---

### 1.3.4 — Math-correctness anchor (post-integrator)

- **Aligned with checklist step:** 1.3.4.
- **Type:** Manual review of automated test output + visual cross-check.
- **Owner:** [HUMAN].

**Prerequisites.** 1.1.3 and 0.2.1 (logistic anchor) green. App running.

**Procedure.**
1. Run `npm test`. Confirm `logistic.analytic.test.ts` reports pass.
2. Confirm `turchin.cycle.test.ts` is still red (no `replayTo` yet) — *for
   the right reason* (missing module, not silent skip).
3. Cross-check the running app's plot against the cycle-period bounds from
   0.2.2: first peak between year 80 and 220.

**Pass criteria.**
- Logistic test green.
- Turchin test still failing at import (this confirms the Slice 0
  discipline held — we did not silently make it pass by hacking around it).
- Visual cycle period within the 0.2.2 bounds.

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: —
- Notes: —

---

## Slice 2 — Replay engine

### 2.1.1 — Replay engine: paramsAt, determinism, branching, mid-tick

- **Aligned with checklist step:** 2.1.1.
- **Type:** Automated unit test (multi-case).
- **File:** `client/src/sim/replay.test.ts`.

**What it verifies.** Each row below is a sub-case in the test file.

| Sub-case | Setup | Expected |
| -------- | ----- | -------- |
| paramsAt-empty | events = [] | `paramsAt(...)` returns initialParams unchanged |
| paramsAt-one | one `param-set` event at t=50 | Before 50 → initial; at/after 50 → new value |
| paramsAt-many | three param-set events at t=50,100,150 on the same param | Returns the latest before/at the cursor |
| determinism | Same run + events, call `replayTo` twice | Two outputs are deep-equal (use `expect(a).toEqual(b)`) |
| branch-divergence | Build run, replay, then drop-after-T and append a different param value, replay again | New trajectory's values past T differ by > 1e-3 from original |
| mid-tick-event | Event at t = t0 + 1.5 * tickSeconds (1.5 ticks in) | After replay, state at the snapshot following the event reflects partial-tick integration to event time, then event applied, then continuation |

**Pass criteria.** Every sub-case passes.

**Failure modes.**
- `paramsAt` returns the *first* matching event instead of the last.
- `replayTo` cached state leaks between calls → non-deterministic.
- Mid-tick event applied at next tick boundary instead of exact event time.

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: —
- Notes: —

---

### 2.3.3 — Plot identical to Slice 1's reference plot

- **Aligned with checklist step:** 2.3.3.
- **Type:** Manual (requires display + reference screenshot from 1.3.3).
- **Owner:** [HUMAN].

**Prerequisites.** Slice 1's plot screenshot captured and stored
(filename suggested: `docs/design/refplots/slice1.png`). Slice 2 merged;
app running.

**Procedure.**
1. Open the app.
2. Visually compare the rendered plot against the Slice 1 reference
   screenshot — overlay in your head, or open side-by-side.
3. Sample three points (e.g. year 100, 300, 500) by hovering on each plot.
4. Read the (N, S) values from the tooltips.

**Pass criteria.**
- Visual shape is the same (peaks, troughs, asymptotes in the same places).
- At each of the three sampled points, (N, S) values agree with the
  Slice 1 reference to within 1%. (Replay should be bit-equal for an
  empty event list; any drift indicates a regression in the integrator
  or the replay wrapper.)

**Failure modes.**
- Replay introduces an off-by-one tick (everything shifted by one month).
- Replay re-clamps differently than the bare integrator (e.g. clamps S
  before it should).

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: —
- Notes: —

---

## Slice 3 — Persistence + HTTP

### 3.1.1 — DB repo CRUD + cascade

- **Aligned with checklist step:** 3.1.1.
- **Type:** Automated integration test.
- **File:** `server/src/db.test.ts`.

**What it verifies.**

| Sub-case | Verification |
| -------- | ------------ |
| runs-create-read | Create run, read it back, fields byte-equal |
| events-append | Append three events for one run, list them, ordered by `(t_epoch, seq)` |
| snapshots-bulk-upsert | PUT N snapshots, then PUT M overlapping ones, GET — final state is N ∪ M with M's values winning on the overlap |
| events-drop-after | Append, then drop-after-T, list — only events with `t_epoch <= T` remain |
| cascade-delete | Delete a run, list its events and snapshots — both empty |

**Pass criteria.** All sub-cases pass against an in-memory SQLite
(`:memory:` URL).

**Failure modes.**
- `INSERT OR REPLACE` used where `INSERT` was meant → silent overwrite.
- Cascade not declared in schema → orphaned rows after run-delete.
- JSON column read as string, not parsed.

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: —
- Notes: —

---

### 3.1.2 — HTTP round-trip full + zod rejection

- **Aligned with checklist step:** 3.1.2.
- **Type:** Automated integration test (extends 0.2.3 skeleton).
- **File:** `server/src/routes/runs.roundtrip.test.ts`.

**What it verifies.**
1. The full happy-path sequence from 0.2.3 (now green).
2. Zod rejection cases:
   - POST `/api/runs` with missing `name` → 400, error body mentions `name`.
   - POST events with `t_epoch` as a string → 400.
   - PUT snapshots with state `{N: -1}` → 400 (negative N invalid).
   - DELETE `events?after=` with non-numeric `after` → 400.

**Pass criteria.** All sub-cases pass; on 400 responses, body is structured
(`{ error: ..., issues: [...] }`), not a stack trace.

**Failure modes.**
- Zod errors leaked as 500 instead of 400.
- Numeric coercion in query strings silently allowed (e.g. `after=NaN`).
- Stack traces returned in production-mode response bodies.

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: —
- Notes: —

---

### 3.3.3 — Live `curl` round-trip against the running server

- **Aligned with checklist step:** 3.3.3.
- **Type:** Manual (requires terminal + running server).
- **Owner:** [HUMAN].

**Why this in addition to 3.1.2.** `supertest` calls `app` in-process; it
does not exercise the `app.listen(...)` bootstrap path, port binding, CORS
headers, or process-env config. The manual `curl` proves the deploy-shaped
path works.

**Prerequisites.** Server running: `npm --workspace server run dev`.
Confirm `/health` first: `curl -s http://localhost:8001/health` → JSON.

**Procedure.**

```bash
# 1. Create a run
RUN=$(curl -s -X POST http://localhost:8001/api/runs \
  -H 'content-type: application/json' \
  -d '{
    "name":"smoke",
    "modelKind":"C-basic-demfisc",
    "t0Epoch":10413792000,
    "tickSeconds":2629746,
    "peoplePerUnit":1000,
    "initialState":{"N":0.2,"S":0},
    "initialParams":{"r":0.02,"beta":0.25,"c":3,"s0":1}
  }')
ID=$(echo "$RUN" | jq -r .id)
echo "Run id: $ID"

# 2. Read it back
curl -s "http://localhost:8001/api/runs/$ID" | jq .

# 3. Append one event
curl -s -X POST "http://localhost:8001/api/runs/$ID/events" \
  -H 'content-type: application/json' \
  -d '{"kind":"param-set","tEpoch":10413792000,"param":"r","value":0.03}'

# 4. List events
curl -s "http://localhost:8001/api/runs/$ID/events" | jq .

# 5. PUT one snapshot
curl -s -X PUT "http://localhost:8001/api/runs/$ID/snapshots" \
  -H 'content-type: application/json' \
  -d '[{"tEpoch":10413792000,"state":{"N":0.2,"S":0}}]'

# 6. List snapshots
curl -s "http://localhost:8001/api/runs/$ID/snapshots" | jq .

# 7. Cleanup
curl -s -X DELETE "http://localhost:8001/api/runs/$ID"
```

**Pass criteria.**
- All seven requests return HTTP 200 (verify with `-w '\nHTTP %{http_code}\n'`
  on any response that looks wrong).
- Step 2's body matches the POST body in step 1 plus `id` and `createdAt`.
- Steps 4 and 6 return JSON arrays containing the items posted in steps 3
  and 5 respectively.
- Step 7 returns 200 or 204; a follow-up `GET /api/runs/$ID` returns 404.

**Failure modes.**
- Server fails to start (port already in use → check
  `lsof -i :8001`).
- CORS headers missing (browser would block; `curl` would still pass).
- Numbers returned as strings.

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: paste output —
- Notes: —

---

## Slice 4 — Client store + api wrappers

### 4.1.1 — Zustand store commands + state transitions

- **Aligned with checklist step:** 4.1.1.
- **Type:** Automated unit test (mocked fetch).
- **File:** `client/src/store/runStore.test.ts`.

**What it verifies.** Each store command produces the correct state
transition; failures are surfaced, not swallowed.

| Sub-case | Action | Expected state change |
| -------- | ------ | --------------------- |
| create | `createRun(template)` | `run` set, `events=[]`, `snapshots=[t0 snap]`, `cursor=t0Epoch`, `isDirty=true` |
| append-event | `appendEvent({param-set ...})` | event appended; subsequent `advance` uses new param |
| advance-1 | `advance(1)` | One snapshot added, `cursor` += tickSeconds, `isDirty=true` |
| flush | `flushToServer()` after dirty advance | `isDirty=false`; mocked PUT called with the right body |
| rewind | `rewindTo(t0Epoch + 5*tick)` | `cursor` set to target; snapshots ≤ target preserved; subsequent `advance` re-derives from there |
| branch | `appendEvent` while `cursor < latest snapshot tEpoch` | server-side DELETE-after invoked with cursor; snapshots past cursor dropped; new event appended |
| api-error | fetch mock rejects on PUT | store state unchanged; error surfaced (e.g. `lastError` field, or thrown promise) |

**Pass criteria.** All sub-cases pass. Mock fetch records the exact URL +
method + body of each call; assertions check those, not just call counts.

**Failure modes.**
- Optimistic state update not rolled back on PUT failure.
- `rewindTo` mutates events array (should not).
- `flushToServer` silently no-ops when not dirty (acceptable) or silently
  no-ops when dirty (bug).

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: —
- Notes: —

---

### 4.3.3 — Refresh restores byte-identical state

- **Aligned with checklist step:** 4.3.3.
- **Type:** Manual (requires browser).
- **Owner:** [HUMAN].

**Prerequisites.** Server + client both running. A run created and advanced
through several ticks.

**Procedure.**
1. Create a run, give it a memorable name (e.g. "refresh-test-A").
2. Advance the simulation to a recognisable point (e.g. press play, wait
   ~5 seconds at default speed, press pause). Note the cursor's tEpoch
   from the URL or a debug readout.
3. Capture (write down or screenshot): run name, cursor tEpoch, current
   N, current S, every param slider's value.
4. Hard-reload the browser (Ctrl-Shift-R / Cmd-Shift-R, bypass cache).
5. After reload, re-read the same six values.

**Pass criteria.**
- Run name identical.
- Cursor tEpoch identical (to the second).
- N identical to 6 significant figures.
- S identical to 6 significant figures.
- Every param slider position matches.
- No browser-console errors during the refresh cycle.

**Failure modes.**
- Cursor resets to t0 on reload.
- Snapshots re-fetched but events lost → re-derivation diverges.
- Run name silently lost.

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: (paste before/after values) —
- Notes: —

---

## Slice 5 — UI controls + scrubbing

### 5.3.2 — Smoke-test walk

Each sub-case below has its own action and pass criterion. Record results
in each sub-case's execution log. Walk them in order; later cases assume
state from earlier ones.

### 5.3.2.a — Create-run form requires name

- **Type:** Manual.
- **Owner:** [HUMAN].

**Procedure.**
1. From the runs list, click "New run".
2. Leave the name field empty.
3. Click "Create".

**Pass criteria.**
- Form does not submit; an inline error is shown identifying the name field
  as required.
- No POST to `/api/runs` is fired (check devtools network tab).
- Repeat with a non-empty name → form submits, new run created.

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: —

---

### 5.3.2.b — Play / pause / step controls

- **Type:** Manual.
- **Owner:** [HUMAN].

**Procedure.**
1. With a fresh run loaded, press **Play**.
2. Wait ~5 s.
3. Press **Pause**.
4. Press **Step** three times.

**Pass criteria.**
- Play: cursor advances visibly and continuously. Button label switches
  to "Pause" while playing.
- Pause: cursor stops within ≤ 1 tick of the press; button switches back
  to "Play".
- Step: each press advances exactly one tick (cursor tEpoch increases by
  `tickSeconds`). The plot updates each press.

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: —

---

### 5.3.2.c — Speed multiplier

- **Type:** Manual.
- **Owner:** [HUMAN].

**Procedure.**
1. With paused state at default 1x, time how long the cursor takes to
   advance 12 ticks (1 sim-year) under Play. Should be ~1 s.
2. Set multiplier to 4x. Time 48 ticks → should be ~1 s.
3. Set multiplier to 0.25x. Time 3 ticks → should be ~1 s.

**Pass criteria.**
- Each setting produces wall-clock duration within ±20% of the expected
  value (eye-balled stopwatch is fine).
- Changing multiplier mid-play takes effect within ≤ 1 s.

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: —

---

### 5.3.2.d — Rewind slider

- **Type:** Manual.
- **Owner:** [HUMAN].

**Procedure.**
1. From a run advanced to year ~400, grab the rewind slider.
2. Drag it to roughly year 200.
3. Release.

**Pass criteria.**
- The cursor reference line on the plot snaps to the released position
  within ≤ 1 tick.
- The plot does not visibly truncate (snapshots past the cursor remain
  displayed in a distinguishable style, e.g. faded, OR are hidden — pick
  one in the design and stick to it; either is acceptable here as long as
  the choice is consistent).
- No event is created (check by inspecting the events list before/after).

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: —

---

### 5.3.2.e — Click-on-plot rewind

- **Type:** Manual.
- **Owner:** [HUMAN].

**Procedure.**
1. From a run advanced past year 400, click directly on the plot at
   roughly year 150.

**Pass criteria.**
- The cursor jumps to year 150 ± 1 tick.
- Behaviour is identical to dragging the rewind slider to the same point.

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: —

---

### 5.3.2.f — Slider edit at latest tick (no branch warn)

- **Type:** Manual.
- **Owner:** [HUMAN].

**Procedure.**
1. Confirm cursor is at the latest snapshot (right end of the plot).
2. Drag the `r` slider from 0.02 to 0.03.

**Pass criteria.**
- No "you will discard future snapshots" warning is shown.
- A new `param-set` event is appended to the events list at the cursor.
- Future Play continues from the cursor with the new `r`.

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: —

---

### 5.3.2.g — Slider edit behind latest tick (branch warn)

- **Type:** Manual.
- **Owner:** [HUMAN].

**Procedure.**
1. Advance the run to year 400.
2. Rewind cursor to year 200.
3. Drag the `r` slider to a different value.

**Pass criteria.**
- A modal/dialog appears warning that snapshots and events after year 200
  will be discarded.
- Confirming proceeds: events list truncated to ≤ year 200, new param-set
  appended at year 200, snapshots after year 200 cleared from cache, server
  invoked with DELETE-after.
- Cancelling: nothing happens; slider snaps back to previous value.

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: —

---

### 5.3.2.h — Reload restores state

- **Type:** Manual.
- **Owner:** [HUMAN].

**Procedure.** Same as 4.3.3, but now with the full UI in play. Capture
also: the speed multiplier, the tick-size selector, and the play/pause
state.

**Pass criteria.**
- All criteria from 4.3.3, plus:
- Speed multiplier restored to last value (or reset to 1x — pick one and
  document; either is acceptable as long as consistent).
- Tick-size selector restored.
- Play/pause: app restores in **paused** state regardless of pre-reload
  state (safer default; the user can resume).

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: —

---

### 5.3.3 — Math-correctness anchor 2: UI-observable determinism

- **Aligned with checklist step:** 5.3.3.
- **Type:** Manual (requires display).
- **Owner:** [HUMAN].

**Prerequisites.** Full UI working through 5.3.2.h.

**Procedure.**
1. Create a fresh run with §17 defaults. Advance to year 600.
2. Hover the plot at year 600; record `(N₁, S₁)` from the tooltip.
3. Drag the rewind slider to year 100.
4. Press Play; let it run back to year 600.
5. Hover at year 600 again; record `(N₂, S₂)`.

**Pass criteria.**
- `|N₁ - N₂| < 10⁻⁹` and `|S₁ - S₂| < 10⁻⁹`. (Replay is deterministic;
  any drift here points to nondeterminism in the snapshot-cache reuse
  path.)
- Visual cycle period in the displayed plot: first peak still in
  `[80, 220]` yr, matching 0.2.2.

**Failure modes.**
- Snapshot cache reused with stale param state → drift on the rerun.
- `recharts` interpolating between adjacent snapshots and displaying
  interpolated values in the tooltip → looks like drift but is actually a
  presentation bug.

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: (paste before/after tuples) —
- Notes: —

---

## Slice 6 — Polish + demo recipe

### 6.5.1 — Full suite green at sign-off

- **Aligned with checklist step:** 6.5.1.
- **Type:** Automated (`npm test`) + summary.
- **Owner:** [AI] runs; [HUMAN] reads the summary.

**Procedure.**
1. From repo root: `npm test`.
2. Capture: total test count, pass count, fail count, skipped count.
3. Confirm no skipped tests are anchors from Slices 0-4 (i.e. nothing
   silently disabled).

**Pass criteria.**
- All tests pass.
- No tests skipped without an entry in this document explaining why.
- Slice 0 anchors (`logistic.analytic`, `turchin.cycle`, `runs.roundtrip`)
  are present and green.

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: paste `npm test` summary —
- Notes: —

---

### 6.x.y — Ad-hoc bug-fix tests

For each bug found during Slice 5 smoke-testing or Slice 6 triage, add a
new entry below using this template:

```
### 6.x.y — <short bug description>

- **Aligned with checklist step:** 6.2.1 (bug-fix iteration N).
- **Type:** Automated | Manual.
- **Owner:** [AI] | [HUMAN].
- **File / interface:** ...

**Symptom (observed).** ...
**Root cause.** ...

**Red test (specification).** ...
**Procedure.** ...
**Pass criteria.** ...

**Execution log.**
- Status: pending
- Date: —
- Evidence: —
- Notes: —
```

*(no ad-hoc cases yet)*

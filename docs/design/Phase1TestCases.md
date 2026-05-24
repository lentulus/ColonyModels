# Phase 1 Test Cases (Manual)

Companion to [Phase1Checklist.md](Phase1Checklist.md). Sibling to
[Phase1AutomatedTests.md](Phase1AutomatedTests.md).

- **This document** — detailed procedures for **manual** test cases
  (require a human at a display, terminal, or other interactive
  interface).
- **[Phase1AutomatedTests.md](Phase1AutomatedTests.md)** — automated test
  specs (run via `npm test`).

One entry per checklist verification step that is manual, numbered
identically to the checklist step. Use this document when:

- **Running a manual verification** — follow the procedure; record the
  result in the **Execution log** block at the bottom of each entry.
- **Re-running after a fix** — append a new dated line to the execution
  log; do not overwrite history.

**Conventions.**

- *Owner:* always `[HUMAN]` (these are by definition human-executed).
- *Prerequisites:* what state must be set up before the procedure runs.
- *Pass criteria:* concrete, measurable. No "looks ok."
- *Status values:* `pending` → `pass` / `fail` / `blocked`. Always include
  date (ISO) and evidence — screenshot path, paste of recorded values,
  or terminal output.

---

## Index

| Case | Description |
| ---- | ----------- |
| **Slice 0** | |
| 0.3.3 | Red review of anchors (math-correctness review #1) |
| **Slice 1** | |
| 1.3.3 | Hardcoded run plot renders correctly |
| 1.3.4 | Math-correctness anchor (post-integrator) |
| **Slice 2** | |
| 2.3.3 | Plot identical to Slice 1's reference plot |
| **Slice 3** | |
| 3.3.3 | Live `curl` round-trip against the running server |
| **Slice 4** | |
| 4.3.3 | Refresh restores byte-identical state |
| **Slice 5** | |
| 5.3.2.a | Create-run form requires name |
| 5.3.2.b | Play / pause / step controls |
| 5.3.2.c | Speed multiplier |
| 5.3.2.d | Rewind slider |
| 5.3.2.e | Click-on-plot rewind |
| 5.3.2.f | Slider edit at latest tick (no branch warn) |
| 5.3.2.g | Slider edit behind latest tick (branch warn) |
| 5.3.2.h | Reload restores state |
| 5.3.3 | Math-correctness anchor 2: UI-observable determinism |
| **Slice 6** | |
| 6.x.y | Ad-hoc manual verifications |

---

## Slice 0 — Test harness + red regression anchors

### 0.3.3 — Red review of anchors (math-correctness review #1)

- **Aligned with checklist step:** 0.3.3.
- **Owner:** [HUMAN].

**Prerequisites.** [Phase1AutomatedTests.md](Phase1AutomatedTests.md) 0.2.1
+ 0.2.2 + 0.2.3 committed in red state. `npm test` output captured by
[AI] in checklist step 0.3.2.

**Procedure.**
1. Open `logistic.analytic.test.ts`. Verify:
   - Closed-form formula written correctly (compare to
     [Phase1AutomatedTests.md](Phase1AutomatedTests.md) 0.2.1).
   - Tolerance is `1e-6`, not `1e-3` or `1e-9`.
   - Sample points are at least 4, spanning the horizon.
2. Open `turchin.cycle.test.ts`. Verify:
   - `BLANK_RUN` defaults are imported, not duplicated inline.
   - Peak-search logic actually finds extrema (not just `max(N)`, which a
     monotonic run would also satisfy).
   - Bounds `[80, 220]` and `≥ 100 yr` match
     [Phase1AutomatedTests.md](Phase1AutomatedTests.md) 0.2.2.
3. Open `runs.roundtrip.test.ts` skeleton. Verify:
   - Each request goes through `supertest(app)`, not over a real port.
   - Uses an in-memory SQLite instance, freshly initialised per test.
4. Confirm test output shows all three failing at *import* (missing module)
   — that's the expected red at Slice 0.

**Pass criteria.**
- All three test files describe behaviours that match the specs in
  [Phase1AutomatedTests.md](Phase1AutomatedTests.md).
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

### 1.3.3 — Hardcoded run plot renders correctly

- **Aligned with checklist step:** 1.3.3.
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
  to the nearest 20 yr is fine; precise check is automated in
  [Phase1AutomatedTests.md](Phase1AutomatedTests.md) 0.2.2).
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
- **Owner:** [HUMAN].
- **Type:** Review of automated test output + visual cross-check.

**Prerequisites.** [Phase1AutomatedTests.md](Phase1AutomatedTests.md)
1.1.3 and 0.2.1 (logistic anchor) green. App running.

**Procedure.**
1. Run `npm test`. Confirm `logistic.analytic.test.ts` reports pass.
2. Confirm `turchin.cycle.test.ts` is still red (no `replayTo` yet) — *for
   the right reason* (missing module, not silent skip).
3. Cross-check the running app's plot against the cycle-period bounds from
   [Phase1AutomatedTests.md](Phase1AutomatedTests.md) 0.2.2: first peak
   between year 80 and 220.

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

### 2.3.3 — Plot identical to Slice 1's reference plot

- **Aligned with checklist step:** 2.3.3.
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

### 3.3.3 — Live `curl` round-trip against the running server

- **Aligned with checklist step:** 3.3.3.
- **Owner:** [HUMAN].

**Why this in addition to the automated test
[Phase1AutomatedTests.md](Phase1AutomatedTests.md) 3.1.2.** `supertest`
calls `app` in-process; it does not exercise the `app.listen(...)`
bootstrap path, port binding, CORS headers, or process-env config. The
manual `curl` proves the deploy-shaped path works.

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

### 4.3.3 — Refresh restores byte-identical state

- **Aligned with checklist step:** 4.3.3.
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
  `[80, 220]` yr, matching
  [Phase1AutomatedTests.md](Phase1AutomatedTests.md) 0.2.2.

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

### 6.x.y — Ad-hoc manual verifications

For each bug found during Slice 5 smoke-testing or Slice 6 triage that
needs a **manual** verification (e.g. visual UI fix, layout regression,
behaviour that's hard to assert programmatically), add a new entry below
using this template. For bugs that need an automated regression test,
use the ad-hoc template in
[Phase1AutomatedTests.md](Phase1AutomatedTests.md) instead.

```
### 6.x.y — <short bug description>

- **Aligned with checklist step:** 6.2.1 (bug-fix iteration N).
- **Owner:** [HUMAN].

**Symptom (observed).** ...
**Root cause.** ...

**Prerequisites.** ...
**Procedure.** ...
**Pass criteria.** ...

**Execution log.**
- Status: pending
- Date: —
- Evidence: —
- Notes: —
```

*(no ad-hoc manual verifications yet)*

# Phase 1 Automated Tests

Companion to [Phase1Checklist.md](Phase1Checklist.md). Sibling to
[Phase1TestCases.md](Phase1TestCases.md).

- **This document** — detailed specs for **automated** test cases (run
  via `npm test`).
- **[Phase1TestCases.md](Phase1TestCases.md)** — manual / human
  verifications.

One entry per checklist verification step that is automated, numbered
identically to the checklist step. Use this document when:

- **Writing a test (red phase)** — the spec tells you what the test must
  assert.
- **Reviewing a red test** — confirm the test matches the spec.
- **Re-running after a fix** — append a new dated line to the execution
  log; do not overwrite history.

Property-based tests for the math layer are spec'd separately in
[Phase1PBT.md](Phase1PBT.md); they live alongside example-based tests in
the same `*.test.ts` files.

**Conventions.**

- *Owner:* `[AI]` writes and runs it; `[HUMAN]` reviews the spec at red
  review.
- *Pass criteria:* concrete, measurable. No "looks ok."
- *Status values:* `pending` → `pass` / `fail`. Always include date (ISO)
  and a commit hash or `npm test` excerpt as evidence.

---

## Index

| Case | Description |
| ---- | ----------- |
| **Slice 0** | |
| 0.2.1 | Analytic logistic regression anchor |
| 0.2.2 | Turchin cycle-period regression anchor |
| 0.2.3 | HTTP round-trip skeleton (red until Slice 3) |
| **Slice 1** | |
| 1.1.2 | `rhsC` algebra on hand-computed inputs |
| 1.1.3 | RK4 single-step + clamps |
| **Slice 2** | |
| 2.1.1 | Replay engine: paramsAt, determinism, branching, mid-tick |
| **Slice 3** | |
| 3.1.1 | DB repo CRUD + cascade |
| 3.1.2 | HTTP round-trip full + zod rejection |
| **Slice 4** | |
| 4.1.1 | Zustand store commands + state transitions |
| **Slice 6** | |
| 6.5.1 | Full suite green at sign-off |
| 6.x.y | Ad-hoc bug-fix regression tests |

---

## Slice 0 — Test harness + red regression anchors

### 0.2.1 — Analytic logistic regression anchor

- **Aligned with checklist step:** 0.2.1 (write the test). Turns green at 1.2.5.
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
- **File:** `client/src/sim/turchin.cycle.test.ts`.
- **Note:** slow-ish; consider behind `--run-slow` later (see
  [Phase1Design.md](Phase1Design.md) §11.2 rule 4).

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
- **File:** `server/src/routes/runs.roundtrip.test.ts`.
- **Library:** `supertest`.

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

## Slice 1 — Shared types + model + integrator

### 1.1.2 — `rhsC` algebra on hand-computed inputs

- **Aligned with checklist step:** 1.1.2.
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

### 1.3.4b — Demographic-fiscal cycle features (math-correctness anchor)

- **Aligned with checklist step:** 1.3.4b (retroactively added 2026-05-25
  to address the 1.3.4 verification gap — project lead cannot personally
  audit Turchin's math).
- **File:** `client/src/sim/model.cycle.test.ts`.
- **Derivation source:** [Phase1MathDerivations.md](Phase1MathDerivations.md)
  §3 (citation-anchored to Turchin, *Historical Dynamics* Ch. 7 pp.122-131).

**What it verifies.** Integrates [advanceTick](../../client/src/sim/integrator.ts#L42)
for 1000 yr with [Phase1Design §17](Phase1Design.md) "blank-run" defaults
(`r=0.02, β=0.25, c=3, s0=10, N₀=0.5, S₀=0` — matches Turchin Fig 7.1
verbatim), then asserts the seven derived cycle features against the
resulting trajectory.

**Setup.** Direct integrator driver (no replay engine — that's Slice 2):

| Knob | Value | Source |
| ---- | ----- | ------ |
| Params | `{r: 0.02, beta: 0.25, c: 3, s0: 10}` | Phase1Design §17 |
| Initial state | `{N: 0.5, S: 0}` | Phase1Design §17 (Turchin p.123: $N_0 = k_0/2$) |
| Horizon | 1000 yr | Long enough to confirm post-collapse equilibrium |
| Sample tick | 1 yr | Annual resolution for extrema detection |
| Integrator sub-step | 1/365.25 yr | Daily; matches production replay loop in §6.2 |

**Pass criteria (seven assertions).**

| # | Assertion | Source |
| - | --------- | ------ |
| 1 | At $t = 1000$: $N \in [0.99, 1.01]$ AND $S = 0$ exactly | §3.1 — Turchin p.123 "equilibrium $N = k_0$, $S = 0$ is locally stable" |
| 2 | Exactly one local N-maximum over $t \in [1, 999]$ | §3.3 — Turchin p.123 "once the state collapses, it cannot arise again" + p.131 |
| 3 | N-peak time in [200, 260] yr | §3.5 — Turchin Fig 7.1a peak at $t \approx 225$ yr; tolerance ±30 yr |
| 4 | N-peak amplitude in [2.8, 3.6) | §3.6 — Turchin Eq 7.3 bounds $k(S) < 1+c$; Fig 7.1a peak height |
| 5 | S-peak time strictly < N-peak time | §3.4 — Turchin p.123 "expenditures lag revenues" + Fig 7.1a |
| 6 | $\max_t k(S(t)) \in [3.0, 3.7)$ | §3.2 — Eq 7.3 envelope; observed 3.49 with §17 params |
| 7 | $\min_t N(t) \ge 0$, $\min_t S(t) \ge 0$, both final-state values finite | §3.7 — Phase1Design §4 clamp invariants |

**Failure modes.**
- `rhsC` sign error in dS/dt (production - β·N): would invert N/S phase ordering, breaking #5.
- Manual S-reset disabled or moved outside `advanceTick`: would leave S < 0 transiently; breaks #1 and #7.
- N-clamp removed: post-collapse N could overshoot to negative; breaks #7.
- RK4 coefficients wrong (e.g. `(k1 + k2 + k3 + k4)/4` instead of `(k1 + 2k2 + 2k3 + k4)/6`): cycle period drifts; breaks #3.
- `k(S)` formula off (`c·S/s0` instead of `c·S/(s0+S)`): saturation behavior changes; breaks #6 + #4.
- Parameter mis-bind in `advanceTick`'s closure: cycle features go random; breaks several.

**Execution log.**
- Status: `green`
- Date: 2026-05-25
- Evidence: 7/7 assertions pass under `npm test` at Slice 1.3.4b.fix-5 verification (commit pending Slice 1 green).
- Notes: Sanity-run output captured during development: N-peak `(t=227, N=3.13)`; S-peak `(t=159, S=48.87)`; N at S-peak = 2.62 = exactly `(1-β)·k(S_peak)` = `0.75·3.49` (analytic match to 2 dp); max k(S) = 3.49; final state N=0.9999, S=0. Matches Turchin Fig 7.1a visually (peak ≈ 225 yr).

---

## Slice 2 — Replay engine

### 2.1.1 — Replay engine: paramsAt, determinism, branching, mid-tick

- **Aligned with checklist step:** 2.1.1.
- **File:** `client/src/sim/replay.test.ts`.
- **Type:** Multi-case unit test.

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

## Slice 3 — Persistence + HTTP

### 3.1.1 — DB repo CRUD + cascade

- **Aligned with checklist step:** 3.1.1.
- **File:** `server/src/db.test.ts`.
- **Type:** Integration test against in-memory SQLite.

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
- **File:** `server/src/routes/runs.roundtrip.test.ts` (extends Slice 0 skeleton).

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

## Slice 4 — Client store + api wrappers

### 4.1.1 — Zustand store commands + state transitions

- **Aligned with checklist step:** 4.1.1.
- **File:** `client/src/store/runStore.test.ts`.
- **Type:** Unit test with mocked fetch.

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

## Slice 6 — Polish + demo recipe

### 6.5.1 — Full suite green at sign-off

- **Aligned with checklist step:** 6.5.1.
- **Procedure:** Run `npm test` from repo root. [HUMAN] reads the summary.

**Procedure.**
1. From repo root: `npm test`.
2. Capture: total test count, pass count, fail count, skipped count.
3. Confirm no skipped tests are anchors from Slices 0-4 (i.e. nothing
   silently disabled).

**Pass criteria.**
- All tests pass.
- No tests skipped without an entry in this document or in
  [Phase1TestCases.md](Phase1TestCases.md) explaining why.
- Slice 0 anchors (0.2.1, 0.2.2, 0.2.3) are present and green.
- All Asserts properties from [Phase1PBT.md](Phase1PBT.md) pass.

**Execution log.**
- Status: `pending`
- Date: —
- Evidence: paste `npm test` summary —
- Notes: —

---

### 6.x.y — Ad-hoc bug-fix regression tests

For each bug found during Slice 5 smoke-testing or Slice 6 triage that
needs an **automated** regression, add a new entry below using this
template. For bugs that need a manual verification (e.g. a UI fix
needing visual confirmation), use the ad-hoc template in
[Phase1TestCases.md](Phase1TestCases.md) instead.

```
### 6.x.y — <short bug description>

- **Aligned with checklist step:** 6.2.1 (bug-fix iteration N).
- **File:** ...

**Symptom (observed).** ...
**Root cause.** ...

**Red test (specification).** ...
**Procedure.** `npm test`.
**Pass criteria.** ...

**Execution log.**
- Status: pending
- Date: —
- Evidence: —
- Notes: —
```

*(no ad-hoc auto regression tests yet)*

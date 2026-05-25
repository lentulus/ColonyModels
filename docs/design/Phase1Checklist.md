# Phase 1 Checklist

Operational checklist for Phase 1, derived from [Phase1Design.md](Phase1Design.md)
§11.1 (review cadence), §11.2 (test-first rules), and §12 (slice sequencing).
Use this document as the running record: tick boxes as items complete, fill
in `Result:` lines with whatever is worth remembering (commit hashes, test
output excerpts, decisions, links to chat exchanges).

For every verification step in this checklist, the **detailed
specification, procedure, pass criteria, and execution log** live in one
of two companion documents, under the matching item number:

- **Automated tests** (run via `npm test`) — see
  [Phase1AutomatedTests.md](Phase1AutomatedTests.md).
- **Manual verifications** (require a human at a display / terminal) —
  see [Phase1TestCases.md](Phase1TestCases.md).

Update the relevant doc's execution log as work proceeds; the checklist's
`Result:` line should reference back to that entry (e.g. "see TestCases
1.3.3 — pass on 2026-05-30" or "see AutomatedTests 1.1.3 — pass at
commit `abc123`").

**Legend.** `[AI]` = Claude does it. `[HUMAN]` = the user does it. Items
without a tag are joint or automatic (e.g. the test runner producing output).

**Commit convention** (§11.2 rule 3). Commits with intentionally failing
tests start with `red:`. Commits that turn them green start with `green:`.
UI-only commits (Slice 5) use plain descriptive messages.

**Double-approval gate** (Phase1Design.md §11.1). At every `[HUMAN]`
approval step in this document, Claude waits for **two explicit
confirmations** before proceeding: the user says "proceed" (or
equivalent), Claude echoes the specific next action ("Confirming: about
to X — proceed?"), the user confirms a second time. Only then does
Claude advance. This guards against typo-driven misinterpretation of
short answers. Apply without exception, even when the first approval
looks unambiguous — the echo is what gives the user a chance to catch a
slip on their first message. This rule is not negotiable mid-execution;
if it ever feels like friction, that's it working as intended.

**Checklist-is-the-contract.** Every action that gets done on this
project must correspond to a numbered step in this document. If
something needs to happen and there is no step for it — a carry-over
from a prior slice's retro, a newly discovered prerequisite, an
architectural decision that didn't fit a slice when first planned, a
bug-fix that surfaces mid-slice — **add the numbered step(s) here
first** (which is itself a checklist-amend action subject to the
double-approval gate), *then* execute. This rule applies retroactively:
if work has already happened off-checklist, the next step is to amend
the checklist to record it before continuing. Retro action-item tables
and HANDOVER.md prose are advisory only; only this checklist is the
contract.

**Green-review tracking sweep.** Every green review (the `N.3` block of
each slice) includes a tracking sweep, sub-numbered as `N.3.{n}a`. In
this step Claude:
1. updates [Phase1RiskRegister.md](Phase1RiskRegister.md) — add new
   risks, change status on existing ones;
2. drafts the slice's entry in [Phase1Retros.md](Phase1Retros.md) —
   *what surprised me / what worked / what I'd change*;
3. fills in the slice's row in [Phase1DoD.md](Phase1DoD.md) sign-off
   table, and marks every DoD item as green or explicitly waived.

The existing `Green sign-off` step then becomes the **DoD sign-off** —
the user confirms the DoD checklist is complete (all green or waived
in writing) and the retro entry is approved.

---

## Slice 0 — Test harness + red regression anchors

Goal: a working `npm test` that reports two anchor tests **failing for the
right reason** (missing modules). No production code yet.

### 0.1 Setup

- [x] **0.1.1 [AI]** Propose vitest + supertest configuration and where to
      put it (root vs. per-workspace). Post a one-screen plan.
      *Result:* Proposal posted 2026-05-24 in chat. Per-workspace vitest
      configs (`vitest.config.ts` each), `environment: "node"`, `fast-check`
      in client + `supertest` in server. Three decisions surfaced for the
      user: coverage reporting (recommend defer), workspace test order
      (recommend sequential), strict-mode flags (recommend default).
      Awaiting double-approval at 0.1.2.
- [x] **0.1.2 [HUMAN]** Approve the configuration approach (or redirect).
      *Result:* —
- [x] **0.1.3 [AI]** Add `shared/` workspace skeleton with `package.json`,
      `tsconfig.json`, and root `workspaces` entry.
      *Result:* Created on 2026-05-24. Files: `shared/package.json` (name
      `@colonymodels/shared`, build/typecheck/test scripts), `shared/tsconfig.json`
      (extends base, NodeNext, declaration + declarationMap),
      `shared/src/index.ts` (empty placeholder, `export {};`). Root
      `package.json` `workspaces` array now `["client", "server", "shared"]`.
- [x] **0.1.4 [AI]** Install `vitest` in client + server (and shared if
      needed); install `supertest` + `@types/supertest` in server.
      *Result:* Installed 2026-05-24. `vitest@^4.1.7` in client/server/shared;
      `fast-check` in client (per Phase1PBT.md); `supertest` + `@types/supertest`
      in server. Three `npm install` calls returned clean (totals: 40 + 24 + 1
      packages added, 391/415/417 audited, 0 install errors). `npm audit`
      flagged 2 moderate vulnerabilities (esbuild ≤ 0.24.2 transitive via
      vite 5.4.11; advisory GHSA-67mh-4wv8-2f99) — filed as R-013 in
      [Phase1RiskRegister.md](Phase1RiskRegister.md) on 2026-05-24.
- [x] **0.1.5 [AI]** Add `test` script to root `package.json` running
      `npm --workspaces run test` (or equivalent). Add `test` and
      `test:watch` to each workspace.
      *Result:* Done 2026-05-24. Three new files:
      `client/vitest.config.ts`, `server/vitest.config.ts`,
      `shared/vitest.config.ts` (all identical: `defineConfig`,
      `environment: "node"`, `include: ["src/**/*.test.ts"]`).
      Each workspace `package.json` now has `"test": "vitest run"` and
      `"test:watch": "vitest"`. Root `package.json` has
      `"test": "npm --workspaces run test"`. Verified by running `npm test`:
      vitest runs in all 3 workspaces, finds no test files, exits with code 1
      ("No test files found") — pipeline is wired; tests are next.

### 0.2 Test-first (write the red anchors)

- [x] **0.2.1 [AI]** Write `client/src/sim/logistic.analytic.test.ts`:
      imports `rk4Step` from `./integrator` (doesn't exist yet), integrates
      pure logistic `dN/dt = rN(1 − N/K)` to year 200 with chosen
      `(r, K, N0)`, asserts within `1e-6` of closed-form
      `N(t) = K / (1 + ((K−N0)/N0) · exp(−rt))`.
      *Result:* Written 2026-05-24 — `client/src/sim/logistic.analytic.test.ts`.
      Uses the production `rk4Step(s, p, dt)` API with `params = {r: 0.05,
      beta: 0, c: 0, s0: 1}` to reduce Turchin Eq 7.4 to pure logistic
      (k(S)=1 when c=0). Initial state `{N: 0.01, S: 0}`, dt = 1/365.25 yr,
      horizon 200 yr; samples at t = 50, 100, 150, 200 against K=1 sigmoid
      closed form. Fails at import — `./integrator` missing. See
      [Phase1AutomatedTests.md](Phase1AutomatedTests.md) 0.2.1.
- [x] **0.2.2 [AI]** Write `client/src/sim/turchin.cycle.test.ts`: imports
      `replayTo` from `./replay` (doesn't exist yet), runs 600 yr with §17
      defaults, asserts first peak in `[80, 220]` yr and next trough at
      least 100 yr after the peak.
      *Result:* Written 2026-05-24 — `client/src/sim/turchin.cycle.test.ts`.
      Embeds §17 BLANK_RUN verbatim (kept in sync with Phase1Design.md
      §17). Calls `replayTo(run, [], t0 + 600·SECS_PER_YEAR)`, scans
      returned snapshots for local extrema in N, asserts first peak ∈
      [80, 220] yr, next trough ≥ 100 yr after, final N ∈ (0, 1.5]. Fails
      at import — `./replay` missing. See
      [Phase1AutomatedTests.md](Phase1AutomatedTests.md) 0.2.2.
- [x] **0.2.3 [AI]** Write `server/src/routes/runs.roundtrip.test.ts`
      skeleton: imports routes that don't exist yet, exercises
      `POST /api/runs → POST /api/runs/:id/events → PUT /api/runs/:id/snapshots → GET …`
      with `supertest`, asserts byte-equal round-trip.
      *Result:* Written 2026-05-24 —
      `server/src/routes/runs.roundtrip.test.ts`. Three `it` blocks:
      run round-trip, event round-trip, snapshot round-trip. Imports
      `app` from `../app` (Slice 3 will extract the express instance
      from index.ts into a port-less `app.ts` for supertest). Zod
      rejection sub-cases deferred to Slice 3.1.2. Fails at import —
      `../app` missing. See
      [Phase1AutomatedTests.md](Phase1AutomatedTests.md) 0.2.3.

### 0.3 Verify red

- [x] **0.3.1 [AI]** Run `npm test`, capture output.
      *Result:* Ran 2026-05-24. Client: 2 test files, both fail at
      `Cannot find module` (./integrator, ./replay). Server: 1 test file,
      fails at `Cannot find module ../app`. Shared: no test files. All
      workspaces exit with code 1.
- [x] **0.3.2 [AI]** Confirm each anchor fails at *import* (missing module)
      for now — that's the expected red state at Slice 0. Post the failure
      summary listing each test name and its failure reason.
      *Result:* Confirmed 2026-05-24. All three anchors fail for the
      right reason per §11.2 rule 2 (missing-module error, not assertion).
      Red-review summary posted in chat awaiting 0.3.3.
- [x] **0.3.3 [HUMAN]** **Red review** — confirm the assertions and
      tolerances describe the right behaviour while the tests are still
      red. This is also the first **math-correctness review** anchor per
      §11.1: scrutinise the analytic-logistic formula and the Turchin
      cycle-period bounds.
      *Result:* Implicitly approved 2026-05-24 via the user message
      "Proceed to 0.4.0a and 0.4.1" (no explicit edits requested to test
      specs or bounds).

### 0.4 Commit

- [x] **0.4.0a [AI]** Tracking sweep (Slice 0 variant — no DoD sign-off
      since Slice 0 is intentionally red-only): update
      [Phase1RiskRegister.md](Phase1RiskRegister.md) with anything found
      during setup; draft Slice 0 entry in
      [Phase1Retros.md](Phase1Retros.md); note Slice 0 in
      [Phase1DoD.md](Phase1DoD.md) Waivers table (DoD "all tests green"
      item does not apply to a red-only slice).
      *Result:* Done 2026-05-24. RiskRegister: no new risks this sweep
      (R-013 already filed at 0.1.4). Retros: Slice 0 entry written with
      4 action items (rk4Step API call, shared/`exports`, TS path mapping,
      R-013 follow-up at Slice 6). DoD Waivers: 4 rows added for Slice 0
      red-only items (all flagged "n/a for a red-only slice").
- [x] **0.4.1 [AI]** Pre-commit triage: list what would land, paste the
      proposed `red:` commit message.
      *Result:* Posted in chat 2026-05-24. Six files in the commit: three
      new test files (logistic.analytic, turchin.cycle, runs.roundtrip)
      and three modified tracking docs (Phase1Checklist with 0.2.1-0.4.0a
      marks, Phase1Retros with Slice 0 entry, Phase1DoD with Slice 0
      waivers). Proposed message uses `red:` prefix per §11.2 rule 3.
- [x] **0.4.2 [HUMAN]** Approve the commit.
      *Result:* Approved 2026-05-24 via "commit approved" → echoed exact
      `git add` + `git commit` commands → confirmed via "proceed".
- [x] **0.4.3 [AI]** Run `git commit` with `red:` prefix. Report hash.
      *Result:* Committed 2026-05-24 as `e9cbad9 red: Slice 0 anchor tests`
      (6 files changed, 386 insertions, 24 deletions). `git status` clean
      after commit. Branch `main` now 1 commit ahead of `origin/main`; no
      push performed.

---

## Slice 0 → Slice 1 bridge — Decision 0004 (rk4Step API decision)

Goal: resolve Slice 0 retro action item #1 (rk4Step API generic vs
bound) before any Slice 1 code. Lands as a `docs:` commit per
[HANDOVER.md](HANDOVER.md) "Slice 1 expected commit cadence". This
section was added retroactively per the **Checklist-is-the-contract**
rule above, after the underlying Decision drafting had already begun in
chat; the steps below record what was done so the checklist accurately
reflects executed work.

- [x] **0.5.1 [AI]** Surface the rk4Step API trade-off (Option A
      generic vs Option B bound to `rhsC`) to the user; obtain a
      decision.
      *Result:* Posted 2026-05-24 in chat with side-by-side previews;
      user picked **Option A** (generic integrator).
- [x] **0.5.2 [AI]** Draft [adr/0004-generic-rk4-integrator.md](adr/0004-generic-rk4-integrator.md);
      edit [Phase1Design.md §5](Phase1Design.md) to swap signature to
      `rk4Step<S>(s, dt, rhs)` and update `advanceTick` to bind `rhsC`
      via a closure; add row to [adr/README.md](adr/README.md) Current
      Decisions table; mark Slice 0 retro action item #1 resolved in
      [Phase1Retros.md](Phase1Retros.md).
      *Result:* Done 2026-05-24. Four files modified/created. Decision
      explicitly notes that Slice 0's `logistic.analytic.test.ts`
      (0.2.1) will be re-written against the new API in Slice 1.2.x
      when `integrator.ts` lands — not a separate task.
- [x] **0.5.3 [AI]** Pre-commit triage; post proposed `docs:` commit
      message.
      *Result:* Posted in chat 2026-05-24. Five files (the four above
      plus this checklist update once 0.5.x are recorded). Subject:
      "docs: Decision 0004 — generic rk4Step decoupled from rhsC".
- [x] **0.5.4 [HUMAN]** Approve the `docs:` commit.
      *Result:* Approved 2026-05-24 via "you may commit" → second
      confirmation given the same message ("Confirming: about to run
      `git add` … Proceed?" was already in flight).
- [x] **0.5.5 [AI]** Run `git commit` with `docs:` prefix. Report hash.
      *Result:* Committed 2026-05-24 as
      `7160f01 docs: Decision 0004 + checklist amendments for off-checklist work`
      (5 files changed, 215 insertions, 10 deletions). `git status`
      clean after commit. Branch `main` now 1 commit ahead of
      `origin/main`; no push.

---

## Slice 1 — Shared types + model + integrator

Goal: pure functions for the ODE RHS and one RK4 step land. The Slice 0
**logistic anchor turns green** by end-of-slice; the Turchin anchor stays
red until Slice 2.

### 1.1 Test-first

- [x] **1.1.1 [AI]** Write `shared/src/types.test.ts` (if any non-trivial
      type helpers exist; otherwise skip with a note — types per §11.2
      rule 1 exemption).
      *Result:* Skipped 2026-05-24. [Phase1Design.md §3](Phase1Design.md)
      defines only pure data shapes (`RunId` alias, `ModelKind` literal
      union, `ParamsC` / `StateC` / `Run` / `Event` / `Snapshot` record
      types) — zero runtime behaviour to test. §11.2 rule 1 exempts
      "type aliases" from the test-first requirement; no
      `shared/src/types.test.ts` written. Slice 1.2.1.c will create the
      types in `shared/src/` directly. If a future slice adds a runtime
      type helper (constructor, validator, narrowing function), it gets
      its own test file at that point.
- [x] **1.1.2 [AI]** Write `client/src/sim/model.test.ts`: asserts `rhsC`
      output on hand-computed inputs for at least three cases (low N, near
      carrying capacity, S = 0).
      *Result:* Written 2026-05-24 — `client/src/sim/model.test.ts`.
      Three cases using §17 defaults (r=0.02, β=0.25, c=3, s0=1):
      (1) low N (N=0.01, S=0) — expects dN=0.000198, dS=0.0074;
      (2) near k (N=0.99, S=0) — expects dN=0.000198, dS=−0.2376
      (also pins dS<0); (3) mid N with S>0 (N=0.5, S=1) — expects
      dN=0.008, dS=0.275 (exercises k(S)=1+c·S/(s0+S)=2.5).
      All arithmetic shown in test comments for red-review audit.
      Tolerance 1e-12. Fails at import — `./model` missing. See
      [Phase1AutomatedTests.md](Phase1AutomatedTests.md) 1.1.2.
- [x] **1.1.3 [AI]** Write `client/src/sim/integrator.test.ts`:
      single-step RK4 against hand-computed values for a trivial RHS
      (e.g. `dx/dt = x` for one step); `N ≥ 0` clamp; `S ≥ 0` manual
      reset (post-step, not in RHS).
      *Result:* Written 2026-05-24 — `client/src/sim/integrator.test.ts`.
      Three setups per AutomatedTests 1.1.3: (A) `rk4Step` against
      analytic RK4 Taylor-4 of e^h for dN/dt=N at h ∈ {0.01, 0.1},
      tolerance 1e-12; closed-form derivation in test comments. (B)
      forcing RHS returning dN/dt=−100 from N=0.1 with dt=1 — unclamped
      would be −99.9; asserts N ≥ 0 (clamp inside rk4Step). (C) tests
      `advanceTick` (where the S reset lives per Decision 0004 + §4) with
      β=10, c=0 driving dS/dt ≈ −0.901; asserts S === 0 (strict
      equality — not abs, not ε). Uses generic `rk4Step` signature from
      Decision 0004. Fails at import — `./integrator` missing. See
      [Phase1AutomatedTests.md](Phase1AutomatedTests.md) 1.1.3.
- [x] **1.1.4 [AI]** Run `npm test`, confirm Slice 1 tests fail at
      assertion or import.
      *Result:* Ran 2026-05-24. All five test files fail at import
      (missing-module), per §11.2 rule 2 first-run allowance.
      **Client (4 fails):**
      `integrator.test.ts` → missing `./integrator` (Slice 1.1.3 new);
      `model.test.ts` → missing `./model` (Slice 1.1.2 new);
      `logistic.analytic.test.ts` → missing `./integrator` (Slice 0 anchor, still red — green at 1.2.x);
      `turchin.cycle.test.ts` → missing `./replay` (Slice 0 anchor, still red until Slice 2).
      **Server (1 fail):** `runs.roundtrip.test.ts` → missing `../app`
      (Slice 0 anchor, still red until Slice 3).
      **Shared:** no test files (1.1.1 skipped per §11.2 rule 1 type
      exemption); vitest exits with code 1 "No test files found" — same
      state as after Slice 0. All three workspaces exit code 1.
- [x] **1.1.5 [AI]** Post **red-review summary**: list each new test, what
      it asserts, why it's red.
      *Result:* Posted 2026-05-24 in chat. Three sections (1.1.1 skipped,
      1.1.2 model with the three hand-computed cases, 1.1.3 integrator
      Setups A/B/C); Slice 0 anchors' status restated; four explicit
      asks for the red review (numerics, boundary semantics,
      architectural fit for Setup C via `advanceTick`, tolerances).
- [x] **1.1.6 [HUMAN]** **Red review** — sign off that the tests describe
      the right behaviour.
      *Result:* Implicitly approved 2026-05-24: user advanced directly
      to 1.1.7 ("1.1.7 approved") without flagging the three
      hand-computed (dN, dS) pairs, the RK4 Taylor-4 formula, the
      N≥0 / strict S===0 boundary assertions, or the Setup C
      test-via-`advanceTick` choice surfaced in 1.1.5. Matches the
      Slice 0 0.3.3 implicit-approval pattern.
- [x] **1.1.7 [HUMAN]** Approve red commit.
      *Result:* Approved 2026-05-24 via "1.1.7 approved". Echo +
      second-confirmation in flight per double-approval gate before
      `git commit` runs at 1.1.8.
- [x] **1.1.8 [AI]** Commit with `red:` prefix. Report hash.
      *Result:* Committed 2026-05-24 as
      `996b079 red: Slice 1 anchor tests — model + integrator`
      (3 files changed, 251 insertions, 18 deletions). `git status`
      clean after commit. Branch `main` now 2 commits ahead of
      `origin/main`; no push.

### 1.1B — Bridge: jargon cleanup (prose-only, runs before 1.2 implementation)

Goal: replace the project-management jargon abbreviations in prose,
headings, and code comments per user instruction 2026-05-24 ("project
management jargon is bullshit; avoid three-letter abbreviations
without explicit approval"). The two specific remappings agreed: the
old A-D-R abbreviation → "Decision" / "Decisions", and the old P-B-T
abbreviation → "Asserts". Directory `docs/design/adr/`, file
`Phase1PBT.md`, and link href targets stay unchanged (option 1 of
three offered). Lands as a `docs:` commit before any Slice 1.2 work
begins. Saved as durable feedback in the
[no-abbreviations memory note](../../../.claude/projects/-home-lentulus-projects-ColonyModels/memory/feedback_no_tlas.md).

- [x] **1.1B.1 [AI]** Apply substitutions across 12 doc files in
      `docs/design/` and `docs/design/adr/` plus 3 comment-only
      occurrences in `client/src/sim/integrator.test.ts`. Patterns
      handled: the bare three-letter forms → the long words above;
      plural form → "Decisions"; numbered references (hyphen + four
      digits) → "Decision NNNN" with a space; per-decision-file H1
      headings rewritten correspondingly. Long-form "property-based
      testing" stays (already plain English). Link href targets and
      file paths unchanged. Grammar fix-up pass for "an Decision" →
      "a Decision" and similar artifacts. Memory note keeps its
      abbreviation references (it is *about* the rule).
      *Result:* Done 2026-05-24 via two `sed` passes (substitution +
      grammar). 15 files touched: 5 decision files + 9 design docs +
      1 test-file comment block. `+102 / −69` net. Spot-checked: all
      four per-decision H1 headings now read "# Decision NNNN: …";
      `Phase1PBT.md` path preserved in HANDOVER + Phase1Design (the
      file/path identifier was not renamed per option 1). Final grep
      for old patterns came back clean except inside this very 1.1B
      description (intentional — meta-text about the rule).
- [ ] **1.1B.2 [AI]** Pre-commit triage; post proposed `docs:` commit
      message.
      *Result:* —
- [x] **1.1B.3 [HUMAN]** Approve the `docs:` commit.
      *Result:* Approved 2026-05-24 via "Add, commit, and PUSH". User
      explicitly amended my "no push" echo to include a push to
      `origin/main` — one-time authorization for this commit batch,
      not a standing rule.
- [ ] **1.1B.4 [AI]** Run `git commit` with `docs:` prefix. Report hash.
      *Result:* —

### 1.2 Implementation

- [ ] **1.2.1.a [AI]** Switch `shared/package.json` `main` → `exports`
      with `./src/index.ts` (resolves Slice 0 retro action item #2).
      *Result:* —
- [ ] **1.2.1.b [AI]** Add TS path mapping for `@colonymodels/shared`
      in client + server tsconfigs (resolves Slice 0 retro action item #3).
      *Result:* —
- [ ] **1.2.1.c [AI]** Define shared types (`StateC`, `ParamsC`, `Run`,
      `Event`, `Snapshot`, `ModelKind`) in `shared/src/`.
      *Result:* —
- [ ] **1.2.2 [AI]** Implement `client/src/sim/model.ts` exporting `rhsC`.
      Add `// TODO: supply` per §6.7.
      *Result:* —
- [ ] **1.2.3 [AI]** Implement `client/src/sim/integrator.ts` exporting
      `rk4Step` and `advanceTick`, with `N ≥ 0` clamp inside the step and
      `S ≥ 0` reset around it.
      *Result:* —
- [ ] **1.2.4 [AI]** Replace `client/src/App.tsx` R3F canvas with a
      hardcoded 200-yr run using §17 defaults, rendered as a single
      `recharts <LineChart>` with N and S series. Install `recharts`.
      *Result:* —
- [ ] **1.2.5 [AI]** Run `npm test`; confirm Slice 1 tests green AND
      Slice 0 `logistic.analytic.test.ts` green. Turchin anchor still red
      (expected).
      *Result:* —

### 1.3 Review

- [ ] **1.3.1 [AI]** Post **ready-for-review summary**: changed files,
      test output (green count, remaining reds = Turchin anchor + HTTP
      skeleton), what to look at first.
      *Result:* —
- [ ] **1.3.2 [HUMAN]** Read the diff.
      *Result:* —
- [ ] **1.3.3 [HUMAN]** Run the client (`npm run dev`), visually confirm
      the plot.
      *Result:* —
- [ ] **1.3.4 [HUMAN]** **Math-correctness review** (§11.1): the cycle
      should be *visible* with §17 defaults even though only the integrator
      is wired up (no replay yet, so this is a single straight integration).
      *Result:* —
- [ ] **1.3.4a [AI]** Tracking sweep: update
      [Phase1RiskRegister.md](Phase1RiskRegister.md); draft Slice 1 entry
      in [Phase1Retros.md](Phase1Retros.md); fill in
      [Phase1DoD.md](Phase1DoD.md) Slice 1 row.
      *Result:* —
- [ ] **1.3.5 [HUMAN]** **DoD sign-off** — confirm DoD all-green or
      explicitly waived; retro entry approved.
      *Result:* —
- [ ] **1.3.6 [AI]** Pre-commit triage.
      *Result:* —
- [ ] **1.3.7 [HUMAN]** Approve commit.
      *Result:* —
- [ ] **1.3.8 [AI]** Commit with `green:` prefix. Report hash.
      *Result:* —

---

## Slice 2 — Replay engine

Goal: `paramsAt`, `replayTo`, branching. The Slice 0 **Turchin cycle anchor
turns green** by end-of-slice.

### 2.1 Test-first

- [ ] **2.1.1 [AI]** Write `client/src/sim/replay.test.ts` covering:
      `paramsAt` with zero / one / many `param-set` events; `replayTo`
      determinism (same events → byte-equal output across two runs);
      branching (drop-after-T then append a different value produces a
      visibly different trajectory); mid-tick event lands at the exact
      event time, not the next tick boundary.
      *Result:* —
- [ ] **2.1.2 [AI]** Run `npm test`, confirm Slice 2 tests fail and
      Turchin anchor still fails at import.
      *Result:* —
- [ ] **2.1.3 [AI]** Post red-review summary.
      *Result:* —
- [ ] **2.1.4 [HUMAN]** Red review.
      *Result:* —
- [ ] **2.1.5 [HUMAN]** Approve red commit.
      *Result:* —
- [ ] **2.1.6 [AI]** Commit `red:`. Report hash.
      *Result:* —

### 2.2 Implementation

- [ ] **2.2.1 [AI]** Implement `client/src/sim/replay.ts` per §6.1-6.4
      (`paramsAt`, `replayTo`, branching helpers).
      *Result:* —
- [ ] **2.2.2 [AI]** Update `App.tsx` to drive the plot via `replayTo` so
      the Turchin anchor exercises the same code path as the demo page.
      *Result:* —
- [ ] **2.2.3 [AI]** Run `npm test`; confirm Slice 2 tests + Turchin
      anchor green. Remaining red: `runs.roundtrip.test.ts` skeleton only.
      *Result:* —

### 2.3 Review

- [ ] **2.3.1 [AI]** Ready-for-review summary.
      *Result:* —
- [ ] **2.3.2 [HUMAN]** Read diff.
      *Result:* —
- [ ] **2.3.3 [HUMAN]** Run client; spot-check that the plot still looks
      right (no regressions vs. Slice 1).
      *Result:* —
- [ ] **2.3.3a [AI]** Tracking sweep: update
      [Phase1RiskRegister.md](Phase1RiskRegister.md); draft Slice 2 entry
      in [Phase1Retros.md](Phase1Retros.md); fill in
      [Phase1DoD.md](Phase1DoD.md) Slice 2 row.
      *Result:* —
- [ ] **2.3.4 [HUMAN]** **DoD sign-off** — confirm DoD all-green or
      explicitly waived; retro entry approved.
      *Result:* —
- [ ] **2.3.5 [AI]** Pre-commit triage.
      *Result:* —
- [ ] **2.3.6 [HUMAN]** Approve commit.
      *Result:* —
- [ ] **2.3.7 [AI]** Commit `green:`. Report hash.
      *Result:* —

---

## Slice 3 — Persistence + HTTP

Goal: SQLite repos + HTTP routes. The `runs.roundtrip.test.ts` skeleton
gets fleshed out and turns green.

### 3.1 Test-first

- [ ] **3.1.1 [AI]** Write `server/src/db.test.ts`: in-memory SQLite,
      runs / events / snapshots repo CRUD, foreign-key cascade on
      `DELETE FROM runs`.
      *Result:* —
- [ ] **3.1.2 [AI]** Flesh out `server/src/routes/runs.roundtrip.test.ts`
      from the Slice 0 skeleton: full create-run → POST events → PUT
      snapshots → GET back, byte-equal. Add zod-rejection cases (bad
      payload → 400).
      *Result:* —
- [ ] **3.1.3 [AI]** Run `npm test`, confirm Slice 3 tests fail.
      *Result:* —
- [ ] **3.1.4 [AI]** Post red-review summary.
      *Result:* —
- [ ] **3.1.5 [HUMAN]** Red review (boundary contracts — confirm the
      HTTP shapes match §7.2).
      *Result:* —
- [ ] **3.1.6 [HUMAN]** Approve red commit.
      *Result:* —
- [ ] **3.1.7 [AI]** Commit `red:`. Report hash.
      *Result:* —

### 3.2 Implementation

- [ ] **3.2.1 [AI]** Install `better-sqlite3`, `nanoid`, `zod`.
      *Result:* —
- [ ] **3.2.2 [AI]** Implement `server/src/db.ts` with schema migrations
      per §7.1.
      *Result:* —
- [ ] **3.2.3 [AI]** Implement `server/src/routes/runs.ts`,
      `events.ts`, `snapshots.ts` per §7.2 with zod validation at the
      boundary.
      *Result:* —
- [ ] **3.2.4 [AI]** Wire routes into `server/src/index.ts`.
      *Result:* —
- [ ] **3.2.5 [AI]** Run `npm test`; full suite green.
      *Result:* —

### 3.3 Review

- [ ] **3.3.1 [AI]** Ready-for-review summary.
      *Result:* —
- [ ] **3.3.2 [HUMAN]** Read diff.
      *Result:* —
- [ ] **3.3.3 [HUMAN]** Manually `curl` (or REST-client) one round-trip
      against the running server.
      *Result:* —
- [ ] **3.3.3a [AI]** Tracking sweep: update
      [Phase1RiskRegister.md](Phase1RiskRegister.md); draft Slice 3 entry
      in [Phase1Retros.md](Phase1Retros.md); fill in
      [Phase1DoD.md](Phase1DoD.md) Slice 3 row.
      *Result:* —
- [ ] **3.3.4 [HUMAN]** **DoD sign-off** — confirm DoD all-green or
      explicitly waived; retro entry approved.
      *Result:* —
- [ ] **3.3.5 [AI]** Pre-commit triage.
      *Result:* —
- [ ] **3.3.6 [HUMAN]** Approve commit.
      *Result:* —
- [ ] **3.3.7 [AI]** Commit `green:`. Report hash.
      *Result:* —

---

## Slice 4 — Client store + api wrappers

Goal: Zustand store with mocked fetch in tests; refreshing the page
restores the run.

### 4.1 Test-first

- [ ] **4.1.1 [AI]** Write `client/src/store/runStore.test.ts` covering
      `createRun`, `appendEvent`, `rewindTo`, `advance`, `flushToServer`
      with a mocked fetch layer. Assert state transitions, not just method
      calls.
      *Result:* —
- [ ] **4.1.2 [AI]** Run `npm test`, confirm Slice 4 tests fail.
      *Result:* —
- [ ] **4.1.3 [AI]** Post red-review summary.
      *Result:* —
- [ ] **4.1.4 [HUMAN]** Red review.
      *Result:* —
- [ ] **4.1.5 [HUMAN]** Approve red commit.
      *Result:* —
- [ ] **4.1.6 [AI]** Commit `red:`. Report hash.
      *Result:* —

### 4.2 Implementation

- [ ] **4.2.1 [AI]** Install `zustand`.
      *Result:* —
- [ ] **4.2.2 [AI]** Implement `client/src/store/api.ts` (fetch wrappers
      around `/api/runs/...`).
      *Result:* —
- [ ] **4.2.3 [AI]** Implement `client/src/store/runStore.ts` per §8.1.
      *Result:* —
- [ ] **4.2.4 [AI]** Update `App.tsx` to load/create a run via the store
      and persist on every advance.
      *Result:* —
- [ ] **4.2.5 [AI]** Run `npm test`; suite green.
      *Result:* —

### 4.3 Review

- [ ] **4.3.1 [AI]** Ready-for-review summary.
      *Result:* —
- [ ] **4.3.2 [HUMAN]** Read diff.
      *Result:* —
- [ ] **4.3.3 [HUMAN]** Run client + server; refresh the page and confirm
      the run is restored.
      *Result:* —
- [ ] **4.3.3a [AI]** Tracking sweep: update
      [Phase1RiskRegister.md](Phase1RiskRegister.md); draft Slice 4 entry
      in [Phase1Retros.md](Phase1Retros.md); fill in
      [Phase1DoD.md](Phase1DoD.md) Slice 4 row.
      *Result:* —
- [ ] **4.3.4 [HUMAN]** **DoD sign-off** — confirm DoD all-green or
      explicitly waived; retro entry approved.
      *Result:* —
- [ ] **4.3.5 [AI]** Pre-commit triage.
      *Result:* —
- [ ] **4.3.6 [HUMAN]** Approve commit.
      *Result:* —
- [ ] **4.3.7 [AI]** Commit `green:`. Report hash.
      *Result:* —

---

## Slice 5 — UI controls + scrubbing

Goal: Plot, Controls, Timeline components. No component tests — manual
smoke-testing per §11.2 rule 6. Store-level changes (if any) still get
unit tests.

### 5.1 Smoke-test plan (in lieu of test-first)

- [ ] **5.1.1 [AI]** Draft a manual smoke-test checklist: create run →
      name required → play/pause/step → speed multiplier → rewind slider
      → click-on-plot rewind → slider edit while at latest tick (no warn)
      → slider edit while behind latest tick (branch warn) → reload page
      restores state.
      *Result:* —
- [ ] **5.1.2 [HUMAN]** Approve the smoke-test checklist or add cases.
      *Result:* —
- [ ] **5.1.3 [AI]** If new store behaviour is needed (e.g. cursor logic,
      branch warn flag), write red tests for those first per §11.2 rule 1
      and gate progress on red review. Otherwise note "no new store
      behaviour" and proceed to 5.2.
      *Result:* —

### 5.2 Implementation

- [ ] **5.2.1 [AI]** Implement `client/src/ui/Plot.tsx` per §8.3.
      *Result:* —
- [ ] **5.2.2 [AI]** Implement `client/src/ui/Controls.tsx` per §8.4
      (play / pause / step, speed multiplier, tick-size selector, param
      sliders, branch-from-here button).
      *Result:* —
- [ ] **5.2.3 [AI]** Implement `client/src/ui/Timeline.tsx` (event chips
      on a horizontal axis).
      *Result:* —
- [ ] **5.2.4 [AI]** Wire into `App.tsx`; replace any remaining hardcoded
      demo code with the full controlled UI.
      *Result:* —
- [ ] **5.2.5 [AI]** Run `npm test`; suite green (store tests, if any
      from 5.1.3, now pass).
      *Result:* —

### 5.3 Review

- [ ] **5.3.1 [AI]** Ready-for-review summary.
      *Result:* —
- [ ] **5.3.2 [HUMAN]** Walk the smoke-test checklist against the running
      app. Record each item's outcome under 5.3.2 below.
      *Result:* —
- [ ] **5.3.3 [HUMAN]** **Math-correctness review** (§11.1, second
      anchor): with §17 defaults, the secular cycle is visible; scrubbing
      to year 100 then back to year 600 produces the same plot (replay
      determinism observable through the UI).
      *Result:* —
- [ ] **5.3.3a [AI]** Tracking sweep: update
      [Phase1RiskRegister.md](Phase1RiskRegister.md); draft Slice 5 entry
      in [Phase1Retros.md](Phase1Retros.md); fill in
      [Phase1DoD.md](Phase1DoD.md) Slice 5 row.
      *Result:* —
- [ ] **5.3.4 [HUMAN]** **DoD sign-off** — confirm DoD all-green or
      explicitly waived; retro entry approved.
      *Result:* —
- [ ] **5.3.5 [AI]** Pre-commit triage.
      *Result:* —
- [ ] **5.3.6 [HUMAN]** Approve commit.
      *Result:* —
- [ ] **5.3.7 [AI]** Commit (plain message, no `green:` prefix — UI slice).
      Report hash.
      *Result:* —

---

## Slice 6 — Polish + demo recipe

Goal: bug shakedown, README, demo recipe. Full `npm test` stays green
throughout.

### 6.1 Triage

- [ ] **6.1.1 [HUMAN]** Hand Claude a list of rough edges noticed during
      Slice 5 (or pull from the running-results sections above).
      *Result:* —
- [ ] **6.1.2 [AI]** Triage: for each item, is it a bug (needs a red test
      first) or polish (no test required)?
      *Result:* —
- [ ] **6.1.3 [HUMAN]** Approve triage.
      *Result:* —

### 6.2 Bug fixes (test-first per item)

- [ ] **6.2.1 [AI]** For each bug: red test → confirm red → implement →
      green. Commit each bug as a `red:` + `green:` pair, or a single
      `fix:` commit if the bug is too small for the ceremony.
      *Result:* —

### 6.3 Polish

- [ ] **6.3.1 [AI]** Style / copy / layout adjustments per the triage
      list. No tests required.
      *Result:* —
- [ ] **6.3.2 [AI]** Revisit R-013 (`esbuild`/`vite` vulnerability,
      resolves Slice 0 retro action item #4): try
      `npm audit fix --force`, evaluate impact on the dev server,
      update R-013 status in [Phase1RiskRegister.md](Phase1RiskRegister.md).
      *Result:* —

### 6.4 Documentation

- [ ] **6.4.1 [AI]** Update `README.md` with run instructions, screenshot
      placeholder, demo recipe (load defaults → play → branch at year 200
      → observe divergence).
      *Result:* —
- [ ] **6.4.2 [HUMAN]** Read and approve the README.
      *Result:* —

### 6.5 Phase-1 sign-off

- [ ] **6.5.1 [AI]** Final `npm test` run; full suite green. Post
      summary: test count, slice-commit list, any deferred items.
      *Result:* —
- [ ] **6.5.1a [AI]** Final tracking sweep: walk every Open risk in
      [Phase1RiskRegister.md](Phase1RiskRegister.md) — close, mitigate, or
      carry into Phase 2; fill in the Phase 1 wrap-up section of
      [Phase1Retros.md](Phase1Retros.md); fill in Slice 6 row of
      [Phase1DoD.md](Phase1DoD.md) sign-off table.
      *Result:* —
- [ ] **6.5.2 [HUMAN]** Phase 1 sign-off (DoD complete; wrap-up retro
      approved; risk register cleared or carried), or list of carry-overs
      into Phase 2.
      *Result:* —
- [ ] **6.5.3 [AI]** Update [HANDOVER.md](HANDOVER.md) to reflect "Phase 1
      complete" and point at Phase 2 planning.
      *Result:* —

---

## Carry-overs / Deferred

Use this section to record anything we decide *not* to do in Phase 1 (with
a one-line reason). Helps Phase 2 planning later.

- *(none yet)*

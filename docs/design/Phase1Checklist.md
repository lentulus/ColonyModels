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
- [x] **1.1B.2 [AI]** Pre-commit triage; post proposed `docs:` commit
      message.
      *Result:* —
- [x] **1.1B.3 [HUMAN]** Approve the `docs:` commit.
      *Result:* Approved 2026-05-24 via "Add, commit, and PUSH". User
      explicitly amended my "no push" echo to include a push to
      `origin/main` — one-time authorization for this commit batch,
      not a standing rule.
- [x] **1.1B.4 [AI]** Run `git commit` with `docs:` prefix. Report hash.
      *Result:* Committed 2026-05-24 as
      `8f968e6 docs: jargon cleanup — Decisions/Asserts substitutions`
      (15 files changed, 112 insertions, 69 deletions). Note: a small
      user-authored commit `94af448 slice 1.1` (Phase1Checklist.md only,
      +6/-2) landed between Slice 1.1's `996b079` and this docs commit
      — it was the project lead tidying the 1.1.8 Result line that I
      had left filled-in but uncommitted; `8f968e6` rebased cleanly on
      top.
- [x] **1.1B.5 [AI]** Push `origin/main` per user's "Add, commit, and
      PUSH" instruction. Retroactive entry — the push action was not
      part of the original 1.1B plan; added now per the
      checklist-is-the-contract rule.
      *Result:* Push attempted 2026-05-24 by Claude, failed at HTTPS
      authentication (no credential helper in this env). Project lead
      pushed `8f968e6` from their normal shell between 2026-05-24 and
      2026-05-25; `git status` at the start of Slice 1.3.1 reported
      "up to date with origin/main", confirming `8f968e6` reached
      origin.

### 1.2 Implementation

- [x] **1.2.1.a [AI]** Switch `shared/package.json` `main` → `exports`
      with `./src/index.ts` (resolves Slice 0 retro action item #2).
      *Result:* Done 2026-05-25. `shared/package.json` now exposes
      `exports: { ".": { "types": "./src/index.ts", "default":
      "./src/index.ts" } }`; old `main` and `types` fields removed.
      The conditional form lets both Bundler (client) and NodeNext
      (server) resolutions hit the TypeScript source directly; no
      build step needed for dev/test.
- [x] **1.2.1.b [AI]** Add TS path mapping for `@colonymodels/shared`
      in client + server tsconfigs (resolves Slice 0 retro action item #3).
      *Result:* Done 2026-05-25. Both `client/tsconfig.json` and
      `server/tsconfig.json` now have `baseUrl: "."` plus
      `paths: { "@colonymodels/shared": ["../shared/src/index.ts"] }`.
      Belt-and-suspenders with the package.json `exports`; ensures
      TypeScript compile-time resolution under both Bundler and
      NodeNext.
- [x] **1.2.1.c [AI]** Define shared types (`StateC`, `ParamsC`, `Run`,
      `Event`, `Snapshot`, `ModelKind`) in `shared/src/`.
      *Result:* Done 2026-05-25. `shared/src/index.ts` now exports
      `RunId`, `ModelKind`, `ParamsC`, `StateC`, `Run`, `Event`,
      `Snapshot` per Phase1Design §3 (verbatim shape, comments
      preserved). `Event` is a discriminated union over `param-set` /
      `state-poke` / `stop`. The placeholder `export {};` was replaced.
- [x] **1.2.2 [AI]** Implement `client/src/sim/model.ts` exporting `rhsC`.
      Add `// TODO: supply` per §6.7.
      *Result:* Done 2026-05-25. `rhsC(s, p): StateC` implements
      Turchin Eq 7.4 verbatim from §4 — `kS = 1 + c·S/(s0+S)`,
      `production = N·(1 - N/kS)`, returns `{N: r·production,
      S: production - β·N}`. The `// TODO: supply` 1-line marker per
      §6.7 sits on the S equation, naming the future
      `+ resupplyRate` extension hook.
- [x] **1.2.3.a [AI]** Implement `client/src/sim/integrator.ts` exporting
      `rk4Step` and `advanceTick`, with `N ≥ 0` clamp inside the step and
      `S ≥ 0` reset around it. Uses the generic
      `rk4Step<S>(s, dt, rhs)` signature from [Decision 0004](adr/0004-generic-rk4-integrator.md).
      *Result:* Done 2026-05-25. Signature realized as
      `rk4Step<S extends StateC>(s: S, dt: number, rhs: (s: S) => S): S`
      with three private helpers (`addScaled`, `combine`,
      `clampNonNeg`) also generic over `S extends StateC` — they
      spread the input so subtype fields survive. `clampNonNeg` only
      clamps `N` (S manual-reset is intentionally outside). `advanceTick`
      is StateC-typed; binds `rhsC` via closure
      `(st) => rhsC(st, p)` inside the loop; resets `S = 0` between
      `rk4Step` calls if it went negative. Total: ~50 lines.
- [x] **1.2.3.b [AI]** Rewrite `client/src/sim/logistic.analytic.test.ts`
      (the Slice 0 anchor 0.2.1) to use the new generic `rk4Step(state,
      dt, rhs)` signature with `rhs = (s) => rhsC(s, params)`. Replace
      the local `StateC` / `ParamsC` declarations with imports from
      `@colonymodels/shared`. This step is mandated by
      [Decision 0004](adr/0004-generic-rk4-integrator.md) and is a
      prerequisite of 1.2.5's pass criterion. Added as a numbered step
      per the checklist-is-the-contract rule.
      *Result:* Done 2026-05-25. Local `type StateC` / `type ParamsC`
      removed in favor of `import type { StateC, ParamsC } from
      "@colonymodels/shared"`. Test body now binds `rhsC` via closure
      `const rhs = (s: StateC): StateC => rhsC(s, params)` and calls
      `rk4Step(state, dt, rhs)` per the new signature. The closed-form
      sigmoid assertions and 1e-6 tolerance are unchanged. Header
      comment updated to reflect the rewrite + Decision 0004 reference.
- [x] **1.2.4 [AI]** Replace `client/src/App.tsx` R3F canvas with a
      hardcoded 200-yr run using §17 defaults, rendered as a single
      `recharts <LineChart>` with N and S series. Install `recharts`.
      *Result:* Done 2026-05-25. `npm install --workspace client
      recharts` added 37 packages (`npm audit` still flags the 2
      moderate transitive vulns from R-013 — no change). App.tsx
      rewritten: `useMemo`-cached 201-point series (year 0 → 200) from
      `advanceTick` driven by §17 blank-run defaults; rendered as a
      single full-viewport `<LineChart>` with N (blue) and S (orange)
      lines, `CartesianGrid`, `XAxis` (years), `YAxis`, `Tooltip`,
      `Legend`. Header copy notes the slice context (no replay yet).
      `isAnimationActive={false}` so the deterministic trace renders
      immediately. R3F dependencies untouched in `package.json` —
      cleanup deferred (no checklist step for that yet).
- [x] **1.2.5 [AI]** Run `npm test`; confirm Slice 1 tests green AND
      Slice 0 `logistic.analytic.test.ts` green. Turchin anchor still red
      (expected).
      *Result:* Ran 2026-05-25. **Client:** 4 test files; 3 passed
      (`logistic.analytic.test.ts`, `model.test.ts`,
      `integrator.test.ts`) = 8 tests green; 1 failed
      (`turchin.cycle.test.ts`) at `Cannot find module './replay'` —
      expected red until Slice 2. **Server:** 1 file fails at
      `Cannot find module '../app'` — expected red until Slice 3.
      **Shared:** still "No test files found" (1.1.1 skip);
      shared workspace exits 1 same as before. All four green-criteria
      assertions hold: (a) Slice 1 model + integrator tests green; (b)
      Slice 0 logistic anchor green (post-1.2.3.b rewrite); (c)
      Turchin anchor still red for the right reason; (d) runs-roundtrip
      still red for the right reason. Next gate: 1.3.1 ready-for-review
      summary, then 1.3.2 [HUMAN] read the diff.

### 1.3 Review

- [x] **1.3.1 [AI]** Post **ready-for-review summary**: changed files,
      test output (green count, remaining reds = Turchin anchor + HTTP
      skeleton), what to look at first.
      *Result:* Posted 2026-05-25 in chat. Working-tree diff vs.
      `8f968e6`: 9 modified + 2 new = 11 files, +626/−49.
      Green tests: 8 of 8 expected (model 3, integrator 4, logistic
      anchor 1). Remaining reds (both fail-at-import for the right
      reason): `turchin.cycle.test.ts` (missing `./replay` until
      Slice 2), `runs.roundtrip.test.ts` (missing `../app` until
      Slice 3). Reviewer ordering recommended in the summary:
      (1) shared types contract, (2) model.ts arithmetic, (3)
      integrator.ts algorithm + helpers, (4) logistic anchor rewrite
      diff, (5) App.tsx + recharts UI, (6) tsconfig + package.json
      plumbing.
- [x] **1.3.2 [HUMAN]** Read the diff.
      *Result:* Marked complete 2026-05-25 via "mark 1.3.2 complete".
      User advanced without flagging issues — implicit accept of the
      Slice 1.2 working-tree diff (+626/−49, 11 files) presented in
      the 1.3.1 ready-for-review summary.
- [x] **1.3.3 [HUMAN]** Run the client (`npm run dev`), visually confirm
      the plot.
      *Result:* First viewing 2026-05-25 by project lead — **not
      accepted**; three defects logged. Gates 1.3.4. Tick once defects
      are remediated and re-viewed. **Accepted 2026-05-25** after the
      fix-1..fix-20 cascade landed the simplified chart (per fix-20's
      *Result:* — decades-only, no brush, no scale toggle; N/S +
      Indexed toggles retained). Closed by fix-21 acceptance.

      **Defects (D-1.3.3-1, D-1.3.3-2, D-1.3.3-3):**

      1. **People-count vs scaled units missing.** Y-axis currently
         shows raw scaled values (e.g. `N=0.2`). Phase1Design §8.3 says
         the plot should multiply by `run.peoplePerUnit` (default
         1000) so the axis reads in people, with the tooltip showing
         both the people-count *and* the underlying scaled value. May
         also need either a unit toggle or a clearly-labelled axis.
         **App.tsx never reads peoplePerUnit.**
      2. **Bottom area smooshed.** The XAxis label ("t (years since
         founding)") is positioned `insideBottom` and collides with
         tick labels + the Legend. Needs more bottom margin, or move
         the axis label outside the chart area, or move the Legend.
      3. **Caption under title illegible.** The grey (#555) paragraph
         is hard to read against white. Either darken or drop — it is
         dev-context noise, not user-facing content.

      Remediations chosen 2026-05-25: option A on all three (inline
      fix, not deferred to Slice 6 triage). Numbered fix sub-steps
      below per the checklist-is-the-contract rule. 1.3.3 stays
      unticked until 1.3.3.fix-4 lands.

- [x] **1.3.3.fix-1 [AI]** Fix D-1.3.3-1 — implement §8.3 display
      semantics. Multiply N and S by a local `PEOPLE_PER_UNIT = 1000`
      constant for the y-axis values; expose both people-count and
      scaled-value fields in the chart data; supply a custom
      `<Tooltip>` that renders each line as
      `200 settlers (scaled 0.20)` / `300 person-yr (scaled 0.30)`.
      Update Y-axis + legend labels to communicate units in plain
      English.
      *Result:* Done 2026-05-25 in `client/src/App.tsx`. Added
      `PEOPLE_PER_UNIT = 1000`. `SamplePoint` now carries
      `{t, N_people, N_scaled, S_people, S_scaled}`. Custom
      `<CustomTooltip>` renders `"N: 200 settlers (scaled 0.2000)"` /
      `"S: 300 person-yr (scaled 0.3000)"` with line-coloured rows
      and a styled wrapper. Line `dataKey`s now point at
      `N_people` / `S_people`. Legend labels: `"N (settlers)"` /
      `"S (person-years of production)"`. Y-axis label
      `"people / person-years of production"` (rotated −90°,
      `insideLeft`). Matches §8.3 verbatim.
- [x] **1.3.3.fix-2 [AI]** Fix D-1.3.3-2 — relieve bottom-area
      crowding. Move the XAxis label from `position: "insideBottom"`
      to `position: "bottom"` (outside the chart area, below ticks);
      raise the chart's `bottom` margin enough to fit ticks + label
      + legend (target ~60px from 24px).
      *Result:* Done 2026-05-25. XAxis label position changed to
      `"bottom"` with `offset: 18` (now sits outside the chart, below
      tick labels). `LineChart` `margin.bottom` raised from 24 → 60.
      `Legend` moved to top (`verticalAlign="top" height={28}`) so
      it no longer competes with the axis label for bottom space.
- [x] **1.3.3.fix-3 [AI]** Fix D-1.3.3-3 — delete the grey caption
      `<p>` under the title. Header `<h2>` stays. Dev/slice-context
      lives in checklist + retro docs, not in the user-facing UI.
      *Result:* Done 2026-05-25. The `<p style={{ color: "#555", ... }}>`
      block is gone from App.tsx; only the `<h2>` title remains above
      the chart. `<h2>` `margin-bottom` raised 6 → 12 to fill the gap
      gracefully.
- [x] **1.3.3.fix-4 [HUMAN]** Re-view in browser (`npm run dev`).
      If accepted, tick 1.3.3 above. If new defects surface,
      re-log under D-1.3.3-N and we iterate.
      *Result:* Re-viewed 2026-05-25. First-round fixes accepted
      ("better."). Four new defects logged in this iteration:

      - **D-1.3.3-4** — Rotated Y-axis label overlaps the `<h2>`
        title area.
      - **D-1.3.3-5** — Y-axis tick numbers shown in full (e.g.
        `80000`); user wants compact form (`80k`, `1.2M`).
      - **D-1.3.3-6** — S scale dominates the chart, hiding the
        shape of the N curve. Need toggle controls so user can
        view either line in isolation with axis auto-rescale.
      - **D-1.3.3-7** — Need an "Indexed" display mode where each
        line shows value(t) / value(t0) — a multiplier rather than
        absolute. Edge case: S(0) = 0 with §17 defaults makes S
        unindexable.

      Remediations chosen 2026-05-25 ("go with those choices"):
      option A for D-4/5/6 (drop label / compact formatter / toggle
      buttons + clickable legend) and the proposed indexed-toggle
      with auto-hide-S-when-S0=0 for D-7. Numbered fix sub-steps
      below.
- [x] **1.3.3.fix-5 [AI]** Fix D-1.3.3-4 — drop the rotated Y-axis
      label. Legend already communicates which line is which; the
      label was redundant.
      *Result:* Done 2026-05-25. `<YAxis>` no longer carries a
      `label` prop. The chart title `<h2>` no longer competes for
      the upper-left margin region.
- [x] **1.3.3.fix-6 [AI]** Fix D-1.3.3-5 — supply a `tickFormatter`
      on YAxis. `<1k` → integer; `1k ≤ n < 1M` → `80k`; `≥ 1M` →
      `1.2M`. Tooltip keeps the full number with thousand-
      separators for precision.
      *Result:* Done 2026-05-25. Helper `compactNumber(v)` returns
      `200`, `80k`, `1.2M` per the threshold rule; trailing `.0`
      stripped. Wired onto `<YAxis tickFormatter={tickFormatter} />`
      (where `tickFormatter` swaps to the indexed-mode formatter
      when indexed mode is active — see fix-8). Tooltip uses
      `.toLocaleString()` for the full count.
- [x] **1.3.3.fix-7 [AI]** Fix D-1.3.3-6 — add per-line toggle
      buttons above the chart for N and S. Also make the Legend
      clickable as a free bonus. Recharts auto-rescales Y to the
      visible series.
      *Result:* Done 2026-05-25. Two coloured pill buttons above
      the chart (`N (settlers) on/off`, `S (person-yr) on/off`)
      using `aria-pressed` for accessibility and the line colour
      for filled/outlined state. Each button toggles a `useState`
      flag; flag drives the corresponding `<Line hide={!show*} />`
      so recharts auto-rescales Y. `<Legend onClick>` calls the
      same toggles when a legend entry is clicked; `cursor:
      pointer` hint added.
- [x] **1.3.3.fix-8 [AI]** Fix D-1.3.3-7 — add an "Indexed" toggle
      button. When ON: lines display as `value(t) / value(t0)`;
      Y-axis tick formatter switches to `1×`, `1.5×`, etc.;
      tooltip retains scaled + absolute alongside the multiplier.
      Edge case: when `S(0) = 0` (true in §17 default Slice 1
      run), S line auto-hides in indexed mode and a small note
      `"(S can't be indexed when S(0)=0)"` appears next to the
      controls. S toggle button stays clickable; its effect is
      overridden by the indexed+S0=0 guard.
      *Result:* Done 2026-05-25. Third toggle button (slate
      grey) sits separated from the per-line toggles. New
      `indexedTick(v)` formatter outputs `"1×"`, `"1.5×"`, `"10×"`
      (1 decimal for `< 10`, otherwise integer). Data
      `useMemo([baseData, indexed, N0, S0, sIndexable])` derives
      `N_y = indexed ? N_scaled/N0 : N_people` (similar for S,
      returning `null` when `indexed && !sIndexable`). The
      `sIndexable = S0 > 0` guard threads through both the tooltip
      and `<Line hide>` so S vanishes cleanly when unindexable.
      The grey hint string renders only when `indexed &&
      !sIndexable`. Typecheck clean (only expected Slice 2 anchor
      red remains).
- [ ] **1.3.3.fix-9 [HUMAN]** Re-view in browser (`npm run dev`).
      If accepted, tick 1.3.3 above. If new defects surface,
      re-log under D-1.3.3-N and we iterate.
      *Result:* Reviewed 2026-05-25; one new defect logged.

      - **D-1.3.3-8** — Current indexed equation
        `indexed_X(t) = X(t) / X(0)` blanks S entirely when
        `S(0) = 0` (§17 default). Annoying — the S shape vs N
        shape comparison is the *whole point* of the indexed
        mode. User prefers: index each series against its own
        first non-zero sample, i.e.
        `indexed_X(t) = X(t) / X(t*_X)` where
        `t*_X = min{ t : X(t) > 0 }`; the series is plotted
        only from `t*_X` onward. Practical effect for §17:
        N indexes from t=0, S indexes from t≈1.

      Remediation chosen 2026-05-25 ("log it and execute") —
      single fix-10 below.
- [x] **1.3.3.fix-10 [AI]** Fix D-1.3.3-8 — refine indexed
      semantics. Compute `t*_X` per series (smallest sample index
      where the scaled value is `> 0`). In indexed mode, set
      `X_y(t) = X(t)/X(t*_X)` for `t ≥ t*_X` and `null` otherwise;
      recharts renders a gap before `t*_X` so the line visually
      starts at its first indexable point. Drop the `sIndexable`
      guard and the `(S can't be indexed when S(0)=0)` grey hint
      — neither is needed once per-series indexing lands. Tooltip
      silently omits the S row at `t < t*_S` (no
      "not-yet-indexable" placeholder; less noise).
      *Result:* Done 2026-05-25 in [App.tsx](../../client/src/App.tsx).
      New `indices` useMemo finds `iN` and `iS` (first sample index
      where each series' scaled value is `> 0`). Data useMemo now
      branches: non-indexed mode uses people-count straight; indexed
      mode divides each series by its respective reference value
      (`baseData[iN].N_scaled` / `baseData[iS].S_scaled`) and emits
      `null` for samples before the reference index. `DisplayPoint`
      widened: `N_y` is `number | null`; recharts skips null
      samples and renders the line starting at the first non-null
      point. The `sIndexable` constant, `effectiveShowS` derived
      flag, and the grey hint span are all gone. Tooltip uses
      `p.{N,S}_y !== null` to decide whether to show each row in
      indexed mode. Typecheck clean (only expected Slice 2 anchor
      red remains).
- [ ] **1.3.3.fix-11 [HUMAN]** Re-view in browser (`npm run dev`).
      If accepted, tick 1.3.3 above. If new defects surface,
      re-log under D-1.3.3-N and we iterate.
      *Result:* —

**Feature requests during 1.3.3 review (2026-05-25)** — user asked for
two additional UI capabilities to make the chart usable for the §17
math review. These are Slice 5 controls landing early; some of the
code will be replaced when Slice 5's real `Controls.tsx` ships
(acknowledged scope-creep, accepted in chat).

- **F-1.3.3-1** — extend the hardcoded run horizon from 200 → 1000
  years (so a full secular cycle is visible) and add a display-only
  Years/Decades toggle for the X axis (integrator resolution stays at
  daily sub-steps; nothing changes in the math layer).
- **F-1.3.3-2** — pan/zoom along the X axis via recharts' built-in
  `<Brush>` component (draggable mini-timeline below the chart).

- [x] **1.3.3.fix-12 [AI]** Implement F-1.3.3-1 — horizon 200→1000,
      Years/Decades toggle. Bump `HORIZON_YEARS`; update title copy.
      Add a `timeScale` `useState` (`"years"` | `"decades"`, default
      `"years"`). Add a fourth toggle button to the controls row,
      pattern-consistent with the others (`Decades on/off`). XAxis
      `tickFormatter` divides by 10 in decades mode; XAxis `label`
      switches between `"t (years since founding)"` and `"t (decades
      since founding)"`. Tooltip header switches between `"t = 500
      yr"` and `"t = 50 dec"`. **Data array unchanged** — `t` field
      stays in years; only display layer is affected.
      *Result:* Done 2026-05-25. `HORIZON_YEARS` bumped 200 → 1000;
      title uses `{HORIZON_YEARS}` interpolation so it auto-updates
      to "1000-year hardcoded run". `TimeScale` type added
      (`"years" | "decades"`); `useState<TimeScale>("years")`. New
      "Decades on/off" button matches the existing toggle styling
      (slate grey). `makeXTickFormatter(scale)` factory returns a
      formatter that divides by 10 in decades mode and strips
      trailing `.0`; wired onto both `<XAxis>` and `<Brush>` via the
      memoized `xTickFormatter`. `xAxisLabel` derived from
      `timeScale` (Years/Decades since founding). Tooltip header
      uses a shared `formatTimeLabel(t, scale)` helper —
      `t = 500 yr` or `t = 50 dec` (1 decimal for non-integer
      decade values, 0 decimals when integer). Data array `t`
      stays in years; integrator untouched.
- [x] **1.3.3.fix-13 [AI]** Implement F-1.3.3-2 — `<Brush>` for
      pan/zoom. One `<Brush dataKey="t" height={30} stroke="#888"
      tickFormatter={xTickFormatter} />` line inside the
      `<LineChart>` after the `<Line>` elements. Default behavior
      (initial window = full range). Brush honours the
      Years/Decades tick formatter automatically (shared function).
      *Result:* Done 2026-05-25. `Brush` imported from `recharts`;
      inserted at the bottom of `<LineChart>` with
      `dataKey="t" height={28} stroke="#888"
      tickFormatter={xTickFormatter} travellerWidth={8}`. No
      explicit `startIndex` / `endIndex` so the initial window is
      the full 0–1000 yr range (user-discoverable narrowing by
      dragging the handles). Reuses the same `xTickFormatter` as
      the XAxis so brush ticks honour Years/Decades automatically.
      Typecheck clean.
- [ ] **1.3.3.fix-14 [HUMAN]** Re-view in browser (`npm run dev`).
      Test both: Years/Decades toggle relabels X-axis + brush ticks;
      brush handles narrow + pan the visible range; main chart
      auto-rescales. If accepted, tick 1.3.3 above. If new
      defects/requests surface, re-log and we iterate.
      *Result:* Re-viewed 2026-05-25. Positive: brush UI works
      well. Math interpretation of curves deferred to 1.3.4 once
      the interface is more complete. Three new defects logged:

      - **D-1.3.3-9** — Decades mode produces decimal tick labels
        (e.g. `17.5 dec`) at narrow brush zooms. Recharts
        auto-picks tick values from the continuous range; the
        `tickFormatter` divides by 10. When picks land at non-
        decade boundaries (e.g. year 175 → 17.5 dec), the label
        is non-integer.
      - **D-1.3.3-10** — Y axis "goes mental" when scrolling /
        panning via brush. Recharts auto-rescales Y to the
        currently-visible time slice, so Y jumps as the brush
        moves through high-S vs low-S regions.
      - **D-1.3.3-11** — Years mode tick spacing doesn't match
        the prior 0–200 version's "feel" (which had ticks at 0,
        50, 100, 150, 200). With 0–1000 range the auto-picker
        lands on 0, 200, 400, …; sparser per-unit-width.

      Remediation chosen 2026-05-25 ("proceed with those
      changes") — single fix-15 step covering all three (new
      `t_display` field, explicit integer X ticks per mode,
      locked Y domain over visible series across full time).
- [x] **1.3.3.fix-15 [AI]** Fix D-1.3.3-9/10/11 — stabilise X
      ticks and Y domain.
      (a) Add `t_display` to display data: `t` in years mode,
      `t/10` in decades mode. XAxis + Brush switch to
      `dataKey="t_display"` so the displayed values *are* the
      values in display units (no double-divide).
      (b) Compute an explicit `xTicks` array: every 50 years
      (`[0, 50, …, 1000]`) in years mode; every 1 decade
      (`[0, 1, …, 100]`) in decades mode. Pass as
      `<XAxis ticks={xTicks} interval="preserveStartEnd" />` so
      recharts shows integer-valued labels and auto-thins overlap
      at wide zooms.
      (c) Compute `yDomain` from the max of currently-visible
      series across the full time range (not the visible brush
      window). Pass as `<YAxis domain={yDomain} />`. Y stays
      still as the user pans, only rescales when they toggle a
      series on/off. 5% headroom above max.
      (d) Tooltip `formatTimeLabel` updated to expect the value
      in display units (no division needed any more).
      *Result:* Done 2026-05-25. Refactor:
      • New helper `toDisplayUnit(t, scale)` (years pass-through,
        decades divides by 10); `makeXTickFormatter` removed.
      • `DisplayPoint` widened with `t_display: number`.
      • Data `useMemo` extracts a local `addDisplay()` to attach
        `t_display` + `N_y` + `S_y` consistently in both
        non-indexed and indexed branches; depends on `timeScale`.
      • `xTicks` useMemo loops `0 → HORIZON_YEARS` in steps of
        50 yr (years mode) or 10 yr (= 1 decade, decades mode),
        mapping through `toDisplayUnit`. Years gives 21 ticks,
        decades 101.
      • `yDomain` useMemo scans `data` for the max of currently-
        visible series (gated on `showN` / `showS`); returns
        `[0, max * 1.05]`. Depends on `data`, `showN`, `showS` —
        does *not* depend on brush window state.
      • `<XAxis>`: `dataKey="t_display"`, `type="number"`,
        `domain=[0, toDisplayUnit(HORIZON_YEARS, scale)]`,
        `ticks={xTicks}`, `interval="preserveStartEnd"`.
      • `<YAxis>`: `domain={yDomain}` + `allowDataOverflow` so the
        pinned domain is honoured even when brush narrows.
      • `<Brush>`: `dataKey="t_display"`; default ticks (recharts
        picks integer values from the display-unit data).
      • Tooltip `formatTimeLabel` simplified — value is already
        in display units, no division.
      Typecheck clean.
- [ ] **1.3.3.fix-16 [HUMAN]** Re-view in browser (`npm run dev`).
      Confirm: integer-only tick labels in both modes (try
      brushing narrow); Y axis stays put as you pan; toggling
      N/S rescales Y as expected. If accepted, tick 1.3.3 above.
      If new defects/requests surface, re-log and we iterate.
      *Result:* Re-viewed 2026-05-25. Three new defects logged
      ("One more crack" — user signalled patience is finite):

      - **D-1.3.3-12** — Curve peak appears at different X
        positions in years vs decades mode. Y vs X relationship
        should be invariant in physical years, not pixels —
        a peak at year 200 in one mode should be at year 200
        (= 20 dec) in the other.
      - **D-1.3.3-13** — X-axis tick density too sparse to read
        precise positions. User wants "multiples of 5" in years
        mode when every-year is too dense.
      - **D-1.3.3-14** — Brush "changes the start of the curve
        rather than the scope of the display" — i.e. brush is
        culling data instead of zooming the X axis.

      Root-cause analysis: D-12 and D-14 share a root cause —
      the explicit `domain={[0, max]}` added on XAxis in fix-15
      is overriding the brush's natural zoom. With fixed domain,
      brush narrows just filter data; the axis frame stays full
      and curve positions look inconsistent across modes.

      Remediation chosen 2026-05-25 ("implement those changes")
      — single fix-17 step covering all three.
- [x] **1.3.3.fix-17 [AI]** Fix D-1.3.3-12/13/14.
      (a) Drop the explicit `domain` prop from `<XAxis>`.
      `type="number"` stays so positions remain proportional to
      `t_display`; without an enforced domain, recharts
      auto-scales to the brush-visible data range — brush zooms
      again. Fixes D-12 + D-14 in one move.
      (b) Densify `xTicks`: years mode every 5 years (201 ticks);
      decades mode every 1 decade (101 ticks). Keep
      `interval="preserveStartEnd"` so recharts thins overlapping
      labels at wide zooms and reveals finer ticks at narrow
      zooms. Fixes D-13.
      (c) `yDomain` locked behavior from fix-15 is unchanged —
      Y still doesn't bounce on brush.
      *Result:* Done 2026-05-25. Two surgical edits in
      [App.tsx](../../client/src/App.tsx):
      • XAxis `domain={[0, toDisplayUnit(HORIZON_YEARS, timeScale)]}`
        prop removed; everything else on `<XAxis>` unchanged.
        With no enforced domain, recharts auto-scales to the
        brush-visible range, restoring the zoom behavior.
      • `xTicks` step changed from 50 → 5 in years mode (201
        candidates instead of 21); decades mode unchanged at
        every 1 decade (101). `interval="preserveStartEnd"`
        handles the thinning.
      `yDomain` (locked over visible series, full data extent,
      computed independent of brush) is unchanged. Typecheck
      clean.
- [x] **1.3.3.fix-18 [HUMAN]** Re-view in browser (`npm run dev`).
      Confirm: brush handles now zoom (not cull); curve peaks
      sit at the same physical year regardless of mode; tick
      density readable at all zoom levels. If accepted, tick
      1.3.3 above. If new defects/requests surface, re-log; per
      the "one more crack" comment, consider whether to keep
      iterating or revert to a simpler chart and defer the
      remaining tuning to Slice 5.
      *Result:* Re-viewed 2026-05-25. One new defect; user
      opting for a fresh Claude session rather than another
      fix attempt.

      - **D-1.3.3-15** — *"The curve remains identical on the
        screen when I toggle decades mode."* User reports the
        Decades toggle produces no visible change in the chart.
        Two interpretations to investigate fresh-eyes:
        (a) The X-axis labels and brush ticks ARE supposed to
        change (years labels like "200, 400" → decades like "20,
        40"), and the *curve* is supposed to look identical
        (same physical positions, just relabeled). If the user
        sees labels unchanged too, that's a real bug — most
        likely cause is recharts re-using a cached scale or my
        `t_display` dataKey not re-binding when `timeScale`
        changes. (b) If only the curve looks unchanged but
        labels do switch, this is a misunderstanding of what
        the toggle is supposed to do — labels are the entire
        point — and the UX needs to communicate that more
        loudly (header copy, legend hint, animated transition).

      No further fix attempts this session — see fix-19.
- [x] **1.3.3.fix-19 [AI]** Prepare a handover document for a
      fresh Claude session. User has signalled drift/fatigue
      from the 17+ fix-step iteration cycle on the Slice 1.3.3
      visual review. Rewrite [HANDOVER.md](HANDOVER.md) to
      reflect current state (Slice 1.2 fully complete, Slice
      1.3 stuck at visual review with 15 defects across 18
      attempts); enumerate every D-1.3.3-N defect with current
      status; document the unstaged working-tree state from
      Slice 1.2 + 1.3; recommend that the new session pull
      back to a simpler chart and treat the remaining
      visual-UI ambition as Slice 5 scope. Single AI step; no
      double-approval gate (it's documentation).
      *Result:* Done 2026-05-25. Full rewrite of
      [HANDOVER.md](HANDOVER.md) (~340 lines): TL;DR for the
      fresh session, the open D-15 with two interpretations,
      full defect catalog table (fixed / open / deferred),
      "simplify and defer to Slice 5" recommendation with the
      §8.3-aligned simpler chart as the reference target,
      two-option commit strategy, repo state snapshot (HEAD
      `899ef24`, 9 modified + 2 untracked, +1330/−62, tests
      8-green + 2-expected-red), pointers to all working-style
      memory files. Working-tree changes not staged or
      committed (the user's choice — see commit-strategy
      section of HANDOVER.md).
- [x] **1.3.3.fix-20 [AI]** Simplify App.tsx per user direction
      (2026-05-25): remove `<Brush>` (scroll) and the Decades toggle
      button; hardcode `timeScale = "decades"` as the only display
      mode (the only scale at which the cycle is visible at the
      1000-year horizon). Integration cadence unchanged (`TICK_YEARS =
      1` year per sample; sub-day RK4 substeps internal to
      `advanceTick`). Keep: N/S per-line toggle, Indexed-mode toggle,
      custom tooltip (people + scaled), Y-axis lock + 5% headroom,
      compact-number Y formatter, integer-decade X ticks.

      **Carry-overs / Deferred to Slice 5:** F-1.3.3-1 (time-scale
      toggle) and F-1.3.3-2 (brush). *Reason:* Slice 5's
      `Controls.tsx` is the controls-layer home — components have a
      place to share state, sibling controls establish UX patterns
      (button styling, layout, labels), and feature additions don't
      accumulate as ad-hoc machinery in App.tsx. Building these two
      controls there is cheaper than retrofitting them into App.tsx
      now and reworking them later.

      **Closes by removal:**
      - D-1.3.3-15 — Decades toggle produces no visible change. No
        toggle now → defect dissolves.
      - D-1.3.3-12 — Curve peak at different X positions in years vs
        decades modes. Only one display mode now → no cross-mode
        discrepancy possible.

      *Result:* Done 2026-05-25. App.tsx: removed `Brush` import,
      removed `<Brush>` element, removed Decades `<button>`, replaced
      `useState<TimeScale>("years")` with `const timeScale: TimeScale =
      "decades"`. ~25 LOC removed. `TimeScale` type, `toDisplayUnit`,
      `formatTimeLabel`, and the tooltip's `timeScale` prop left
      intact for clean Slice-5 re-introduction. No test changes (UI
      excluded per test-first rule).
- [x] **1.3.3.fix-21 [HUMAN]** Re-view in browser (`npm run dev`).
      Verify: X axis labelled in decades with integer ticks every
      decade (0, 10, 20, … 100); N and S per-line toggles work;
      Indexed toggle works; no brush below the chart; no Decades
      toggle button. If accepted, tick 1.3.3 above and proceed to
      1.3.4. If new defects surface, re-log under D-1.3.3-N at a
      gated checklist amendment — do not chain another fix without
      explicit direction.
      *Result:* Accepted 2026-05-25 ("looks good"). Simplified chart
      passes visual review; fix-1..fix-20 cascade closed.
- [x] **1.3.4 [HUMAN]** **Math-correctness review** (§11.1): the cycle
      should be *visible* with §17 defaults even though only the integrator
      is wired up (no replay yet, so this is a single straight integration).
      *Result:* Marked approved 2026-05-25 by project lead — but the
      project lead flagged that they cannot personally verify the math
      ("I really can't do the math myself"). The tick is a process
      formality, NOT a substantive math-correctness confirmation.
      **Verification gap raised as a structural concern** — see
      `1.3.4b` below before Slice 1 commits.
- [ ] **1.3.4b [AI]** Math-correctness verification — derivation +
      codified test. Addresses the 1.3.4 verification gap (project
      lead cannot personally verify the math). Steps:
      1. Read Turchin *Historical Dynamics* §7 (demographic-fiscal
         model chapter, PDF in [docs/reference/](../reference/)) for
         the §17 defaults (r=0.02, β=0.25, c=3, s0=1).
      2. Derive expected cycle features for a 1000-year integration
         from those defaults: period range, peak count over horizon,
         N/S phase lag direction, amplitude bounds, equilibrium
         properties. Cite specific Turchin equations / page numbers
         for each derived feature.
      3. Write the derivation to
         [Phase1MathDerivations.md](Phase1MathDerivations.md) (new
         file). User reviews this at 1.3.4c by checking that each
         cited Turchin passage actually exists — verifying the chain
         of citations, not the derivation itself.
      4. Codify the accepted features as a quantitative test at
         `client/src/sim/model.cycle.test.ts` (named to avoid
         collision with the Slice 2 anchor `turchin.cycle.test.ts`).
         The test integrates with §17 defaults and asserts each
         derived feature.
      5. Run `npm test`; confirm `model.cycle.test.ts` passes.
      *Result:* Done 2026-05-25. Read Turchin Ch. 7 §7.1, §7.2.1 (Eq
      7.1-7.4, Fig 7.1 p.124, Fig 7.2 p.125) from
      [docs/reference/](../reference/dokumen.pub_historical-dynamics-why-states-rise-and-fall-1400889316-9781400889310.pdf).
      Wrote new file
      [Phase1MathDerivations.md](Phase1MathDerivations.md) with seven
      citation-anchored derivations (§3.1 stateless equilibrium and
      stability, §3.2 k(S) envelope, §3.3 single-excursion structure,
      §3.4 S-peak-before-N-peak phase ordering, §3.5 centuries-scale
      duration via r-scaling, §3.6 amplitude bound by k_max, §3.7
      non-negativity). Codified as
      [client/src/sim/model.cycle.test.ts](../../client/src/sim/model.cycle.test.ts)
      — 7 tests, all green. `npm test`: client 15/15 pass (was 8;
      +7); turchin.cycle.test.ts still red at import (Slice 2);
      runs.roundtrip.test.ts still red at import (Slice 3); shared
      still skip per 1.1.1. **Three findings surfaced (do not
      execute here, flagged for follow-up):**
      - **F-1.3.4b-1.** §17 uses s₀=1 but Turchin Fig 7.1 / Fig 7.2
        use s₀=10. Per Turchin p.125, smaller s₀ amplifies the cycle
        excursion. Decision needed before Slice 2: amend §17 or
        document deliberate deviation.
      - **F-1.3.4b-2.** §17 uses N₀=0.2 but Turchin Fig 7.1 prose
        (p.123) uses N₀=k₀/2=0.5. Extends the growth phase by
        ~50 yr; affects timing tolerances.
      - **F-1.3.4b-3.** Slice 0 anchor
        [turchin.cycle.test.ts](../../client/src/sim/turchin.cycle.test.ts)
        asserts "first peak in [80, 220] yr" — with §17 defaults the
        actual N-peak is at t ≈ 318 yr. The anchor will fail at
        Slice 2.2.3 when `replayTo` lands. Needs amendment before
        Slice 2's red-review gate.

      Remediation chosen 2026-05-25 ("on 1,2,3 use the [parameter]
      set and initial values per Turchin; this is not an immutable
      decision but it is the best way to verify your code"): adopt
      Turchin Fig 7.1 / §7.2.1 exact params so the integrator can be
      cross-checked against the published plot. Numbered fix
      sub-steps below per the checklist-is-the-contract rule.
- [x] **1.3.4b.fix-1 [AI]** Amend [Phase1Design.md §17](Phase1Design.md):
      `s0: 1 → 10`, `initialState.N: 0.2 → 0.5` (Turchin's k₀/2, Fig
      7.1 prose p.123). Resolves F-1.3.4b-1 and F-1.3.4b-2.
      *Result:* Done 2026-05-25. §17 BLANK_RUN now uses Turchin Fig
      7.1 / §7.2.1 verbatim. Prose paragraph below the code block
      rewritten to note one-excursion behavior (vs the prior
      misleading "~200-yr secular cycle" phrasing) and point at
      [Phase1MathDerivations.md](Phase1MathDerivations.md) for the
      citation-anchored derivation.
- [x] **1.3.4b.fix-2 [AI]** Re-run sanity-check integration with
      new defaults; rewrite §3 numerical-confirmation lines and §2
      parameter table in
      [Phase1MathDerivations.md](Phase1MathDerivations.md); retire
      F-1 and F-2 from §5. Update tolerances in
      [client/src/sim/model.cycle.test.ts](../../client/src/sim/model.cycle.test.ts)
      to match the new trajectory.
      *Result:* Done 2026-05-25. Sim with new defaults gives:
      N-peak (t=227, N=3.13) — matches Fig 7.1a (p.124) peak at
      t≈225 ✓; S-peak (t=159, S=48.87); N_crit check exact to 2 dp
      (N at S-peak = 2.62 = 0.75·k(S-peak) = 0.75·3.49); max k(S) =
      3.49; final state (t=1000) N=0.9999, S=0. §2 table now shows
      ✓ on every parameter row; §3 numerics all updated; §4 test
      tolerance table tightened (N-peak time [150,500]→[200,260];
      amplitude [2.5,4.0)→[2.8,3.6); k_max [3.0,4.0)→[3.0,3.7)); §5
      strikes F-1 and F-2 as resolved. Test file
      [model.cycle.test.ts](../../client/src/sim/model.cycle.test.ts)
      params + assertion bounds updated to match.
- [x] **1.3.4b.fix-3 [AI]** Re-evaluate F-1.3.4b-3 under new params.
      If the Slice 0 anchor bound "first peak in [80, 220] yr" now
      matches the actual peak time, dissolve F-3 in the derivation
      doc. If not, narrow the description with the new observed peak
      time and leave for a Slice 2 red-review amendment (do NOT
      touch the anchor test file under this slice — its content is
      locked until Slice 2.2.3).
      *Result:* F-3 narrowed, not dissolved. Actual N-peak with the
      revised §17 defaults is at t=227 yr — 7 yr above the anchor's
      upper bound of 220. Phase1MathDerivations §5 now describes
      the narrowed finding and proposes widening the anchor to
      [180, 280] when Slice 2.2.3 lands. Anchor file unchanged.
- [x] **1.3.4b.fix-4 [AI]** Verify [App.tsx](../../client/src/App.tsx)
      tracks the new §17 defaults. If hardcoded inline (not sourced
      from a shared constant), update the hardcoded values in
      lockstep so the chart matches the test inputs.
      *Result:* Done 2026-05-25. App.tsx hardcodes §17 inline at
      lines 17–18 (`BLANK_PARAMS`, `BLANK_INITIAL`) — no shared
      constant module. Both values updated in lockstep: `s0: 1 →
      10`, `N: 0.2 → 0.5`. The chart will re-render with the new
      trajectory on next `npm run dev` (no behavioral retest
      required under this slice — the math gate is the only
      contract on the deterministic output; visual review already
      passed at 1.3.3.fix-21).
- [x] **1.3.4b.fix-5 [AI]** Run `npm test`; confirm model.cycle.test.ts
      and all prior client tests green; only the expected Slice 2
      and Slice 3 anchor reds remain.
      *Result:* Done 2026-05-25. `npm --workspace client run test`:
      4 test files pass, 15 tests green (model.test.ts 3, integrator.test.ts
      4, logistic.analytic.test.ts 1, model.cycle.test.ts 7); 1 file fails
      at import — `turchin.cycle.test.ts` missing `./replay` (Slice 2
      anchor, expected red until Slice 2.2.3). Server and shared workspaces
      unchanged (`runs.roundtrip.test.ts` missing `../app` until Slice 3;
      shared has no test files per 1.1.1).
- [x] **1.3.4c [HUMAN]** Review
      [Phase1MathDerivations.md](Phase1MathDerivations.md). For each
      cycle-feature assertion in `model.cycle.test.ts`, verify the
      cited Turchin passage exists (open the PDF, locate the
      equation/page). Do NOT validate the derivation math itself —
      that's the AI's work; you're checking sourcing integrity.
      Either accept (proceed to 1.3.4a) or reject (request
      re-derivation under a new checklist amendment; do NOT proceed
      to 1.3.5 with this gate red).
      *Result:* Accepted 2026-05-25 ("citations confirmed"). All
      eight citation clusters across Turchin pp.122-131 verified:
      Eq 7.3 / Eq 7.4 / Fig 7.1 (model construction), p.123 (local
      stability + S≥0 invariant + N₀=k₀/2 + deterministic single-
      excursion + revenue-lag), p.125 (r-scaling + s₀ role +
      stochastic-forcing description), p.126 ("2-3 centuries"
      quote), p.131 (single-excursion confirmation). Citation-
      integrity gate green.
- [x] **1.3.4a [AI]** Tracking sweep: update
      [Phase1RiskRegister.md](Phase1RiskRegister.md); draft Slice 1 entry
      in [Phase1Retros.md](Phase1Retros.md); fill in
      [Phase1DoD.md](Phase1DoD.md) Slice 1 row.
      *Result:* Done 2026-05-25. RiskRegister: added R-014 (Slice 0
      anchor bound [80,220] now 7 yr too tight under Turchin
      verbatim params — fires at Slice 2.2.3) and R-015 (typecheck
      and build pre-existing broken since Slice 0.2.3 commit
      `e9cbad9`; surfaced at this DoD assessment, three remediation
      options on the table for 1.3.5 decision). Retros: Slice 1
      entry written — six surprises (1.3.3 UI cascade, 1.3.4 math-
      verification gap, F-1/F-2 latent §17 errors, deterministic
      single-excursion correctness, git-stash near-miss, R-015
      surprise), five "what worked" items, four "next time", and
      five action items. DoD: Slice 1 row filled in the sign-off
      table (pending [HUMAN] at 1.3.5); four waivers proposed and
      filed in the Waivers table — "Anchors still green" partial,
      "Asserts properties green" (Slice 1's Asserts properties not
      yet implemented), "Test execution logs populated"
      (Phase1AutomatedTests.md has no 1.3.4b section), and
      "typecheck/build" (R-015). Each waiver has a target slice for
      satisfaction or an explicit "decide at 1.3.5" handoff.
- [x] **1.3.4d [AI]** Remediate R-015 (pre-existing typecheck/build
      failure since Slice 0.2.3). Added 2026-05-25 per
      checklist-is-the-contract after the 1.3.4a DoD assessment
      surfaced the gap. **Decision history:** initial direction
      (2026-05-25, "execute option A") was to add `.js` to the
      NodeNext-violating server import. Execution showed (a) was
      insufficient — fixed TS2834 syntactic but exposed TS2307
      (module genuinely missing). The same missing-module pattern
      affects client's `turchin.cycle.test.ts` (importing `./replay`).
      Pivoted (2026-05-25, "path 1" + scope extension to client) to
      option (c) on both workspaces: tsconfig `exclude` for test
      files. Executed:
      1. Kept the `.js` edit on
         [server/src/routes/runs.roundtrip.test.ts](../../server/src/routes/runs.roundtrip.test.ts)
         (forward-correct for Slice 3 when `app.ts` lands).
      2. Added `"exclude": ["src/**/*.test.ts"]` to both
         [server/tsconfig.json](../../server/tsconfig.json) and
         [client/tsconfig.json](../../client/tsconfig.json).
      3. Verified `npm run typecheck` clean across all 3 workspaces;
         `npm run build` clean across all 3 workspaces.
      4. Verified vitest still finds and red-imports both anchor
         tests with semantics unchanged (client: 15 green + 1 file
         red at `./replay`; server: 1 file red at `../app.js`).

      **Trade-off accepted:** test files are no longer type-checked
      by tsc — vitest type-checks them at run time via its own
      resolver. A type error in a test file that vitest doesn't
      exercise (unreachable branch, dead code) will not surface
      until the test is run. Acceptable in this project's TDD
      cadence because every test file is exercised on every
      `npm test`.
      *Result:* Done 2026-05-25. Working-tree changes: M
      `server/src/routes/runs.roundtrip.test.ts` (.js extension), M
      `server/tsconfig.json` (+exclude), M `client/tsconfig.json`
      (+exclude). `npm run typecheck` and `npm run build` both
      clean. R-015 status updated to Mitigated in
      [Phase1RiskRegister.md](Phase1RiskRegister.md); Slice 1 DoD
      waiver row for typecheck/build removed (Slice 1 row now
      reflects 3 waivers, not 4). Closes naturally at Slice 2.2.3
      / Slice 3.2.4.
- [x] **1.3.4b.fix-6 [AI]** Backfill
      [Phase1AutomatedTests.md](Phase1AutomatedTests.md) with a
      "1.3.4b — model.cycle.test.ts" section mirroring the format
      of the existing 1.1.2 / 1.1.3 sections (purpose, setup,
      pass criteria, failure modes, execution log). Resolves the
      Slice 1 DoD waiver "Test execution logs populated" per the
      1.3.5 walk-through recommendation accepted 2026-05-25.
      *Result:* Done 2026-05-25. New section "1.3.4b —
      Demographic-fiscal cycle features" added between 1.1.3 and
      Slice 2's section in
      [Phase1AutomatedTests.md](Phase1AutomatedTests.md). Includes
      purpose, setup table, seven pass-criteria assertions (each
      cited to a derivation §), six failure modes, and a green
      Execution log dated 2026-05-25 with the
      `(t=227, N=3.13) / (t=159, S=48.87)` sanity-run evidence and
      the analytic `N at S-peak = (1-β)·k(S-peak) = 2.62` cross-
      check. Slice 1 DoD waiver row for "Test execution logs
      populated" struck through as resolved.
- [x] **1.3.4e [AI]** Write Slice 1 Asserts properties to satisfy
      the Slice 1 DoD waiver "Asserts properties green" per the
      1.3.5 walk-through recommendation accepted 2026-05-25.
      [Phase1PBT.md](Phase1PBT.md) §"Conventions" mandates
      properties live alongside example-based tests in the same
      `*.test.ts` file under a `describe("properties", ...)` block
      — so this step extends the existing
      [client/src/sim/model.test.ts](../../client/src/sim/model.test.ts)
      and [client/src/sim/integrator.test.ts](../../client/src/sim/integrator.test.ts)
      rather than creating new files.
      Scope: 13 properties — P-M-1..7 (model) and P-I-1..6
      (integrator) from Phase1PBT.md tables. Default 100 runs per
      property. After implementation, run `npm test` and confirm
      all properties green at 100 runs/property; existing
      example-based tests still green; anchors still expected-red.
      *Result:* Done 2026-05-25. Added `describe("properties", ...)`
      blocks to both files; 13 properties total. **Two deviations
      from Phase1PBT.md, both annotated inline:**
      (i) `fc.float` → `fc.double` throughout — the doc's
      verbatim generators use `fc.float` but fast-check 4.x (what's
      installed) restricts `fc.float` to 32-bit IEEE-754; arbitrary
      double ranges need `fc.double`. Suggested Phase1PBT.md doc
      update logged as a Slice 1 retro action item.
      (ii) P-I-2 written against `advanceTick` rather than
      `rk4Step` — the S≥0 reset lives in `advanceTick` per
      Phase1Design §4 + [Decision 0004](adr/0004-generic-rk4-integrator.md);
      a literal rk4Step-only assertion would fail by design.
      **One useful Asserts find during execution:** P-M-2
      ("below k, dN > 0") originally failed on the subnormal
      `N=5e-324` — `r·N` underflows to exact 0. Resolved by
      tightening `arbN` lower bound from `0` to `1e-100`,
      consistent with Phase1PBT.md §"Conventions" guidance to
      bound generators to physically meaningful ranges. Logged
      in Slice 1 retro per Phase1PBT.md §"Failure handling" rule
      3. Final tally: `npm test` reports 28 client tests pass
      (15 prior + 13 new properties). Slice 1 DoD waiver row for
      "Asserts properties green" struck through as resolved.
- [x] **1.3.5 [HUMAN]** **DoD sign-off** — confirm DoD all-green or
      explicitly waived; retro entry approved. **Blocked until 1.3.4c
      is green** — the DoD claim "demographic-fiscal model math
      correct" requires the codified test from 1.3.4b passing AND
      the derivation accepted at 1.3.4c.
      *Result:* Signed off 2026-05-25 by Lentulus ("We are good to
      mark done"). Final state: 12 of 13 DoD items green; 1 item
      waived ("Anchors still green" — partial — Slice 0 anchors
      0.2.2 and 0.2.3 stay red at import until Slices 2.2.3 and
      3.2.4 respectively; this is structural and continues the
      Slice 0 waiver pattern). Of the four waivers originally
      proposed at 1.3.4a, three were resolved via in-slice
      remediations: 1.3.4d (typecheck/build via tsconfig exclude),
      1.3.4b.fix-6 (Phase1AutomatedTests.md backfill), 1.3.4e
      (Asserts properties P-M-1..7 + P-I-1..6, 13 properties green
      at 100 runs each). Retro entry approved as drafted at
      1.3.4a (six surprises, five "what worked", four "next time",
      seven action items with three crossed-through as resolved
      in-slice). Risk register reviewed: R-013 still Open
      (deferred to Slice 6 polish per original plan), R-014 Open
      and tracked (Slice 0 anchor bound mismatch — surfaces at
      Slice 2.2.3), R-015 Mitigated (closes at Slice 2.2.3 + Slice
      3.2.4 when anchor modules land).
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

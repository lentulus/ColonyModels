# Phase 1 Handover

Written 2026-05-23, last refresh 2026-05-24. If the Claude window closes
mid-task, this is the file the next assistant should read first. It is a
pointer document — it does not restate the design; it tells you what's
been decided and what to do next.

## TL;DR for a fresh session

Phase 1 is **in progress**. Slice 0 setup block complete (test harness
installed and wired across `client`, `server`, `shared` workspaces; the
`shared/` workspace is newly created with a placeholder `src/index.ts`).
No production code, no tests yet — `npm test` runs the pipeline cleanly
but reports "No test files found" in each workspace.

The next concrete action is [Phase1Checklist.md](Phase1Checklist.md) step
**0.2.1 [AI]**: write `client/src/sim/logistic.analytic.test.ts` per the
spec in [Phase1AutomatedTests.md](Phase1AutomatedTests.md) 0.2.1. It will
fail at import (the `./integrator` module doesn't exist yet) — that's
the expected red state.

**Uncommitted work to consider committing first** (see "Current repo
state" below): the 16 planning docs in `docs/design/`, the entire
`shared/` workspace, three `vitest.config.ts` files, script edits to
every `package.json`, and `package-lock.json` from the dep installs.
The user may want a commit-or-not decision before proceeding to 0.2.1.

If the user's first message in the new session is a continuation cue
("ok, proceed", "ready", or similar), treat it as the prompt to *ask*
about commit cadence and then start 0.2.1. Writing a test file is
reversible and is gated separately by the 0.3.3 red review; no
double-approval needed for the file write itself. But the double-approval
gate **does** apply to any `git commit` or `npm install`. See
"Working-style rules" below.

## What the project is

R&D sandbox for interstellar-colony models. Phase 1 implements Turchin's
"basic demographic-fiscal" model (Eq 7.4 in *Historical Dynamics*, 2003) as a
single-user web app: client owns the simulation, server is durable storage.
Winners get promoted into the sibling project **MeridianWorlds** (port 8000);
this project runs on **port 8001**.

## What to read, in order

1. [README.md](README.md) — one-screen index of everything in
   `docs/design/`, with reading order and "what goes where."
2. [intent.md](intent.md) — one screen, the user's original goals.
3. [Phase1Options.md](Phase1Options.md) — survey of model choices with the
   user's annotated decisions inline (`==>` markers).
4. [Phase1Design.md](Phase1Design.md) — **the authoritative design**.
   Section 18 is the glossary — read it first if any vocabulary in the
   other docs is unfamiliar (red/green tests, slices, anchors, etc.).
   Sections 15, 16, 17 capture every resolved decision and the blank-run
   defaults.
5. [Phase1Checklist.md](Phase1Checklist.md) — **the running record of
   execution**. Numbered by slice, sub-numbered by phase (test-first /
   implementation / review), with `[AI]` / `[HUMAN]` tags on every step
   and `Result:` lines that get filled in as we go. **This is where to
   look first to know what's next.**
6. [Phase1AutomatedTests.md](Phase1AutomatedTests.md) — detailed
   specifications for every **automated** test (run via `npm test`),
   numbered in alignment with the checklist. Use when writing a test
   (red phase) or reviewing a red test.
6b. [Phase1TestCases.md](Phase1TestCases.md) — detailed procedures for
   every **manual** verification (display / terminal / visual checks),
   numbered in alignment with the checklist. Use when running a manual
   procedure.
7. [Phase1DoD.md](Phase1DoD.md) — slice-agnostic Definition of Done.
   Gate every green review against this checklist; record sign-off in
   the table.
8. [Phase1PBT.md](Phase1PBT.md) — property-based testing plan
   (`fast-check`). Companion to TestCases for the math layer; properties
   live alongside example tests.
9. [Phase1RiskRegister.md](Phase1RiskRegister.md) — active risks with
   mitigations. Reviewed at every green review.
10. [Phase1Retros.md](Phase1Retros.md) — one section per slice, filled in
    at the slice's green review.
11. [adr/README.md](adr/README.md) — Architecture Decision Records.
    Three initial ADRs (SQLite, hand-rolled RK4, client-owned sim) plus
    a backlog of further decisions worth capturing.
12. [../../README.md](../../README.md) — how to run the existing scaffold.

Reference material: `docs/reference/` contains the Turchin PDF (gitignored).
Equations cited in the design are from Chapter 7 and Appendix A.

## Decisions already made (do not re-litigate)

- **Model:** Option C (basic demographic-fiscal), with the type system shaped
  to extend to Option D later.
- **Architecture:** Client runs the sim (RK4 by hand, ~20 lines). Server is
  Express + better-sqlite3 storing runs, events, and a snapshot cache.
- **Source of truth:** the append-only event timeline. Snapshots are a
  derived cache.
- **Time:** scaled years internally, seconds-since-epoch externally,
  month-sized UI ticks by default.
- **Display units:** stored scaled; multiplied by `peoplePerUnit` (default
  1000) only in the plot layer.
- **Founding date default:** 2300-01-01 UTC (epoch 10,413,792,000).
- **Run names:** required at creation.
- **Default play speed:** 1 sim-year per real-second (12 month-ticks/sec).
- **Persistence:** SQLite, durable.
- **Shared types workspace:** set up now, in the first PR.
- **No real-time / SSE / WebSocket** in Phase 1. No multi-user. No 3D.

## Current repo state

```
ColonyModels/
├── client/    Vite + React + R3F scaffold (App.tsx renders a spinning cube)
│              + vitest.config.ts; vitest + fast-check installed (0.1.4)
├── server/    Express scaffold (only /health endpoint, port 8001)
│              + vitest.config.ts; vitest + supertest installed (0.1.4)
├── shared/    NEW (0.1.3): workspace skeleton w/ placeholder src/index.ts,
│              tsconfig.json, vitest.config.ts; vitest installed (0.1.4)
└── docs/
    ├── design/  16 planning docs (see README.md for the index); adr/ subdir
    └── reference/  Turchin PDF (gitignored)
```

Single commit on `main`: `d94f60e Initial scaffold: npm-workspaces TS monorepo (client + server)`.
**No application code yet** — only scaffolding, vitest configs, and
planning docs. **No test files yet** either — 0.2.1-0.2.3 write them as
intentionally-red anchors. The R3F canvas in
[client/src/App.tsx](../../client/src/App.tsx) will be replaced by the 2D
plot UI starting in Slice 1.

**Uncommitted as of 2026-05-24** (verify with `git status`): all 16
planning docs in `docs/design/`, the entire `shared/` workspace, three
`vitest.config.ts` files, script additions to every `package.json`, and
`package-lock.json` updates from the dep installs. See "First steps in
a new session" for the recommended commit cadence.

**Known risk filed during Slice 0:** R-013 in
[Phase1RiskRegister.md](Phase1RiskRegister.md) — `esbuild` ≤ 0.24.2
vulnerability via `vite` 5.4.11 in client. Low impact in our
localhost-only context; planned mitigation evaluation in Slice 6.

## Sequencing — what to build next

Phase1Design.md §12 has the authoritative slice list. Each slice is **test-
first**: write failing tests, get a red review, implement, get a green
review. Don't skip the red review.

Slice summary (full detail in §12 + the test-first rules in §11.2):

| Slice | What it lands | Tests that must be red at start |
|-------|---------------|----------------------------------|
| 0 | Test harness + numerical regression anchors | `logistic.analytic.test.ts`, `turchin.cycle.test.ts`, `runs.roundtrip.test.ts` (skeleton) |
| 1 | Shared types + integrator | `model.test.ts`, `integrator.test.ts` (+ Slice 0 logistic anchor turns green) |
| 2 | Replay engine | `replay.test.ts` (+ Slice 0 Turchin anchor turns green) |
| 3 | Persistence + HTTP | `db.test.ts`, `runs.roundtrip.test.ts` (full) |
| 4 | Client store + api wrappers | `runStore.test.ts` |
| 5 | UI controls + scrubbing | No component tests; manual smoke-test |
| 6 | Polish + demo recipe | Full `npm test` green |

The "blank-run template" in §17 is the single source of truth for default
parameters; reference that constant rather than inlining numbers.

Commit-message convention (per §11.2 rule 3): commits with intentionally
failing tests start with `red:`; commits that turn them green start with
`green:`. Makes the TDD rhythm visible in `git log`.

## Sanity check that must pass

With the §17 defaults (r=0.02, β=0.25, c=3, s0=1, N=0.2, S=0), running for
~600 years should produce a clear secular cycle with period ~200-300 years.
If you get monotonic growth or runaway oscillation, the integrator or the
$S \ge 0$ clamp is broken — fix before moving on.

## Libraries already chosen (Phase1Design.md §9)

**Installed (as of Slice 0, 2026-05-24):**
- `vitest@^4.1.7` — in `client`, `server`, `shared`
- `fast-check` — in `client` only (PBT, see [Phase1PBT.md](Phase1PBT.md))
- `supertest` + `@types/supertest` — in `server` only

**Not yet installed** (land in their respective slices):
- `better-sqlite3` (server persistence, Slice 3) — see [ADR-0001](adr/0001-sqlite-for-phase-1-persistence.md)
- `zod` (boundary validation, Slice 3)
- `nanoid` (RunId, Slice 1 or 3)
- `recharts` (2D plotting, Slice 1)
- `zustand` (client state, Slice 4)

## Working-style rules (non-negotiable)

- **The user is not writing code. Claude implements; the user supervises
  and reviews.** Plan for the review cadence in Phase1Design.md §11.1:
  red review at the start of every slice, green review at the end of
  every slice (mandatory), mid-slice check-in on judgement calls,
  pre-commit triage on every commit, math-correctness review after
  Slice 0 and Slice 5. Don't push commits unprompted.
- **Double-approval gate on every [HUMAN] approval step.** Never proceed
  on a single approval. After the user approves, echo the specific next
  action and wait for a second explicit "yes." This defends against
  typos and ambiguous short answers — the user is self-aware that their
  messages contain typos and explicitly asked for this safeguard. Even
  an unambiguous first approval still gets the echo-and-confirm cycle.
  Full rule in Phase1Design.md §11.1.
- **Test-first.** Phase1Design.md §11.2 lays out the rules: no
  production code without a red test for it; tests must fail for the
  right reason; commits use `red:` / `green:` prefixes; vitest in watch
  mode is the inner loop. CI is not Phase 1 scope.
- **Green review = Definition of Done.** Use [Phase1DoD.md](Phase1DoD.md)
  as the explicit gate. Every green review fills in the DoD checklist
  and signs off the sign-off table.
- **Slice retro at every green review.** Claude drafts an entry in
  [Phase1Retros.md](Phase1Retros.md); user approves or edits. Past
  retros are immutable.
- **Risk register check at every green review.** Walk
  [Phase1RiskRegister.md](Phase1RiskRegister.md), add new risks, update
  statuses on existing ones.
- **ADRs for architecturally significant choices.** When a non-trivial
  design decision is made (or reversed), file a new
  [adr/NNNN-…md](adr/README.md) rather than burying it in a design-doc edit.

## Working-style preferences (durable)

- Strong preference for explicit, terse design docs with the *why* alongside
  the *what*. The user annotates options with `==>` markers and expects
  later changes to thread back to those annotations.
- Design pinned before code. The current ask was design + handover,
  **not** implementation. Confirm before starting Slice 0 unless told to go.
- Conversation continuity is fragile — the user has closed the Claude
  window mid-task before. Write durable artifacts, not just chat replies.

## Open seams flagged for later phases (do NOT build now)

- Exogenous resupply (`resupplyRate` param or `supply-drop` event) — design
  §6.7. Leave a `// TODO: supply` comment in `rhsC` so the seam is visible.
- Option D widening to `(P, E, S)` — design §3 and §14. The discriminator on
  `ModelKind` is already there for this.
- MeridianWorlds integration — design §14. The seconds-since-epoch time
  anchor and JSON snapshot shape are deliberately compatible.
- Non-Turchin alternatives (Allee, resource-limited LV without humans as
  prey, Ricker/Beverton-Holt) — design §13. Each lands as a new `ModelKind`.

## First steps in a new session

If the session is fresh and the user has not given specific direction:

1. Read [README.md](README.md) — gets you oriented in 30 seconds.
2. `git log --oneline -20` and `git status` — confirm what's been
   committed and what's mid-flight. **Currently a large block of work is
   uncommitted** (see "Current repo state" above); the user may want a
   commit-or-not decision before continuing.
3. Open [Phase1Checklist.md](Phase1Checklist.md) and look for the first
   unchecked box. The current expected starting point is **step 0.2.1**
   (write `client/src/sim/logistic.analytic.test.ts` per
   [Phase1AutomatedTests.md](Phase1AutomatedTests.md) 0.2.1).
4. Compare `client/src/` and `server/src/` against the file layout in
   Phase1Design.md §10. If files exist past what the checklist shows
   done, the user did something between sessions — ask before proceeding.
5. Read this file's "Decisions already made" and "Working-style rules"
   sections and confirm the user hasn't superseded any of them in a more
   recent design-doc edit (check `git log --oneline docs/design/` and
   inspect Phase1Design.md for any `==>` annotations you don't recognise).

**Recommended commit cadence at this exact moment** (suggest to the user,
don't act unilaterally):
- One commit for **planning docs** — all 16 files under `docs/design/`
  including the `adr/` subdir.
- One `red:` commit for **Slice 0 setup** — `shared/` workspace,
  vitest configs, package.json edits, package-lock.json updates.
- Then proceed to 0.2 test-writing; commit 0.2 as a separate `red:`
  commit once the three anchor tests are written and confirmed red.

## If you're resuming mid-slice

1. Open [Phase1Checklist.md](Phase1Checklist.md) and find the most
   recent ticked box.
2. Open [Phase1TestCases.md](Phase1TestCases.md) and find the most
   recent populated `Execution log` entry — confirms what's been
   verified.
3. Open [Phase1Retros.md](Phase1Retros.md) — the current slice's
   entry may have notes-in-progress.
4. The next unchecked step in the checklist is your target. Apply the
   double-approval gate before doing anything irreversible.

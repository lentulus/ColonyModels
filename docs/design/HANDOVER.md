# Phase 1 Handover

Written 2026-05-23, last refresh 2026-05-24 (post-Slice 0). If the Claude
window closes mid-task, this is the file the next assistant should read
first. It is a pointer document — it does not restate the design; it
tells you what's been decided and what to do next.

## TL;DR for a fresh session

**Slice 0 is complete.** All three regression anchors are written and
intentionally red at import. Committed as `e9cbad9 red: Slice 0 anchor
tests`. Working tree has only one trivial uncommitted change
(`docs/design/Phase1Checklist.md` — the 0.4.2 and 0.4.3 mark-offs after
the commit landed; will travel with the next commit naturally).

The next concrete action is [Phase1Checklist.md](Phase1Checklist.md)
**Slice 1**, starting with step **1.1.1 [AI]** — but **STOP** and resolve
the rk4Step API decision first; see "Pre-Slice-1 decision required" below.

If the user's first message in the new session is a continuation cue
("ok, proceed", "ready", "go"), treat it as the prompt to surface the
rk4Step decision, not to dive into 1.1.1. The decision needs the user's
input; charging ahead would force a refactor mid-slice.

## Pre-Slice-1 decision required (do this first)

The Slice 0 retro identified an architectural call that should land
before any Slice 1 implementation code. Currently [Phase1Design.md §5](Phase1Design.md)
defines `rk4Step(s: StateC, p: ParamsC, dt: number)` — bound to the
project's `rhsC` function. Two upcoming tests are in tension with that:

- **TestCases 0.2.1** (already written, in commit `e9cbad9`) — sidestepped
  the issue by using the production `rk4Step` with `c=0, beta=0` to
  reduce Turchin Eq 7.4 to pure logistic.
- **TestCases 1.1.3** (about to be written in Slice 1) — explicitly
  "substitute a temporary RHS `f(x) = x`" for unit-testing the integrator
  algorithm. This **cannot** work with the current bound-to-rhsC API.

Two options:

- **Option A: Generic integrator.** Change §5 to
  `rk4Step<S>(s: S, dt: number, rhs: (s: S) => S): S` (or similar). 1.1.3
  works as specified; 0.2.1 needs to be re-written to pass `rhsLogistic`
  as a function. Cleaner separation between integrator and model. **An
  Decision 0004 candidate** if accepted.
- **Option B: Bound to rhsC.** Keep §5 as written. Rewrite 1.1.3 to
  substitute parameters that turn `rhsC` into a known form, the way 0.2.1
  did. Avoids generalising; harder to unit-test the integrator
  algorithm in isolation.

**Recommended approach:** post the trade-off summary to the user, ask
which option, file Decision 0004 if option A is chosen, then proceed to
Slice 1.1.1. The retro's action item table flags this; see Phase1Retros.md
Slice 0 "Action items".

## What it means if any of the above is unfamiliar

The TL;DR depends on knowing what `rk4Step`, "test-first", "Slice 0",
"red commit" mean. Read [Phase1Design.md §18 Glossary](Phase1Design.md)
first if those phrases don't land.

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
    Three initial Decisions (SQLite, hand-rolled RK4, client-owned sim) plus
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
├── client/    Vite + React + R3F scaffold (App.tsx still renders the spinning cube)
│              + vitest.config.ts; vitest + fast-check installed
│              + src/sim/logistic.analytic.test.ts (red, → green at 1.2.5)
│              + src/sim/turchin.cycle.test.ts     (red, → green at 2.2.3)
├── server/    Express scaffold (only /health endpoint, port 8001)
│              + vitest.config.ts; vitest + supertest installed
│              + src/routes/runs.roundtrip.test.ts (red, → green at 3.2.5)
├── shared/    Workspace skeleton w/ placeholder src/index.ts,
│              tsconfig.json, vitest.config.ts; vitest installed
└── docs/
    ├── design/  16 planning docs (see README.md for the index); adr/ subdir
    └── reference/  Turchin PDF (gitignored)
```

**Git log (most recent first):**

```
e9cbad9 red: Slice 0 anchor tests                  ← Slice 0 close
ab90532 Step 0.1 complete                          ← Slice 0 setup
a4c56e8 almost done design
2f98311 Phase 1 design updated
925bfce Phase 1 design first draft
d94f60e Initial scaffold: npm-workspaces TS monorepo
```

Branch `main` is 1 commit ahead of `origin/main` (`e9cbad9`); no push
performed. **No production code yet** — all three sim/route source
modules are still missing on purpose; the red anchor tests assert their
contracts ahead of implementation. The R3F canvas in
[client/src/App.tsx](../../client/src/App.tsx) will be replaced by the 2D
plot UI starting in Slice 1.

**Uncommitted as of 2026-05-24 (handoff):** `docs/design/Phase1Checklist.md`
only — contains the 0.4.2 + 0.4.3 mark-offs that happened after the
`e9cbad9` commit landed. Will travel with the next commit. Verify with
`git status`.

**`npm test` snapshot (run after `e9cbad9`):**
- client: 2 test files, both fail at `Cannot find module` (`./integrator`,
  `./replay`) → expected red
- server: 1 test file, fails at `Cannot find module ../app` → expected red
- shared: no test files → "exit code 1, No test files found" → expected

**Known risks** (see [Phase1RiskRegister.md](Phase1RiskRegister.md)):
- **R-013** filed during Slice 0: `esbuild` ≤ 0.24.2 vulnerability via
  `vite` 5.4.11 in client. Low impact in our localhost-only context;
  planned mitigation evaluation in Slice 6.
- R-001 – R-012: pre-Slice-0 risks, all Open.

**Pending action items from Slice 0 retro** (in priority order, repeated
from [Phase1Retros.md](Phase1Retros.md)):
1. **rk4Step API decision** — see "Pre-Slice-1 decision required" above.
2. Switch `shared/package.json` `main` → `exports` with `./src/index.ts`
   (Slice 1, step 1.2.1).
3. Add TS path mapping for `@colonymodels/shared` in client + server
   tsconfigs (Slice 1, step 1.2.1).
4. Revisit R-013 — try `npm audit fix --force` (Slice 6 polish).

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
- `fast-check` — in `client` only (Asserts, see [Phase1PBT.md](Phase1PBT.md))
- `supertest` + `@types/supertest` — in `server` only

**Not yet installed** (land in their respective slices):
- `better-sqlite3` (server persistence, Slice 3) — see [Decision 0001](adr/0001-sqlite-for-phase-1-persistence.md)
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
- **Decisions for architecturally significant choices.** When a non-trivial
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
2. `git log --oneline -20` and `git status` — confirm what's committed
   and what's mid-flight. Expected: `e9cbad9` at HEAD, one uncommitted
   modification (`Phase1Checklist.md` with the 0.4.x mark-offs).
3. Read **"Pre-Slice-1 decision required"** above. The rk4Step API
   call needs to be made before Slice 1.1.1; surface it to the user
   before any test-writing.
4. Once the API call is made (and Decision 0004 filed if Option A is
   chosen), open [Phase1Checklist.md](Phase1Checklist.md) and start at
   step **1.1.1 [AI]** (write `shared/src/types.test.ts` or skip with
   a note per §11.2 rule 1 exemption).
5. Sanity check: `client/src/sim/`, `server/src/routes/` exist with the
   three red anchor test files; no source modules (`integrator.ts`,
   `replay.ts`, `app.ts`) exist yet. If anything's different, the user
   did something between sessions — ask before proceeding.
6. Read this file's "Decisions already made" and "Working-style rules"
   sections and confirm none have been superseded since `e9cbad9`
   (check `git log --oneline docs/design/`).

**Slice 1 expected commit cadence** (subject to double-approval per
[Phase1Design.md §11.1](Phase1Design.md)):
- After Decision 0004 lands (if Option A): a separate small commit
  containing the Decision and any Phase1Design.md §5 edits, prefix `docs:`.
- One `red:` commit at end of Slice 1.1.x (tests written, all red for
  the right reason — confirmed at 1.1.6 red review).
- One `green:` commit at end of Slice 1.2.x (implementation lands, the
  Slice 1 tests AND the Slice 0 logistic anchor all turn green —
  confirmed at 1.3 green review).

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

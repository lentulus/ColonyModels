# Phase 1 Handover

Written 2026-05-23, last refresh 2026-05-25 (mid-Slice-1.3, after 18
fix-iterations on the Slice 1 visual-review chart). If the Claude window
closes mid-task, this is the file the next assistant should read first.
Pointer document — it does not restate the design; it tells you what's
been decided, where we are, and what to do next.

## TL;DR for a fresh session

**Slice 0, Slice 1.1, Slice 1.1B (jargon cleanup), and Slice 1.2 are
complete.** All eight expected-green tests pass; the two Slice-0 anchor
reds are red for the right reason (Slice 2 and Slice 3 modules still
missing). The shared types workspace is wired up; `rhsC` and `rk4Step` /
`advanceTick` are implemented; the chart UI exists.

**Slice 1.3 is in trouble.** The 1.3.3 visual review descended into a
17-step defect-fix iteration on [client/src/App.tsx](../../client/src/App.tsx)
chasing recharts-rendering issues (axis ticks, brush behavior, Y-axis
stability, scale-mode toggle). 15 distinct defects logged, one still
open. The project lead has signalled drift and is starting a fresh
session. **Recommendation for the fresh session:** pull back to a
simpler chart in App.tsx, defer the rich UI controls (toggles, brush,
indexed mode, scale switcher) to Slice 5 where they actually belong,
then close out 1.3 cleanly.

## Critical: D-1.3.3-15 still open

The Decades-mode toggle button visibly toggles `aria-pressed`, but
**the user reports the chart looks identical** — no visible change when
toggling Years ↔ Decades. Two interpretations to investigate fresh:

- **(a)** Real bug: the chart re-renders but the X-axis labels never
  update, despite `t_display` being recomputed and `xTicks` being
  swapped. Most plausible cause is recharts caching a scale or the
  `dataKey` not re-binding when the data array reference changes.
- **(b)** UX misunderstanding: labels DO change ("200" → "20") but
  the *curve* looks identical (which is correct — only labels and tick
  values should change). If this is the case, the toggle UI doesn't
  communicate visibly enough that the change is purely cosmetic.

Verify by opening the dev server, clicking Decades on, and reading the
X-axis tick labels. If they read in years (e.g. "200"), interpretation
(a) is correct. If they read in decades ("20"), interpretation (b).

## What's complete

| Slice | What landed | Tests |
|---|---|---|
| 0 | Vitest harness, three red anchor tests, fast-check installed | 3 red anchors (intended) |
| 0 → 1 bridge | [Decision 0004](adr/0004-generic-rk4-integrator.md) for generic `rk4Step` API | docs only |
| 1.1 | `model.test.ts`, `integrator.test.ts` (red) | 2 new red test files |
| 1.1B | Jargon cleanup (ADR → Decisions, PBT → Asserts) across 15 doc/comment files | docs only |
| 1.2 | `shared/` types, `rhsC`, `rk4Step<S>` + `advanceTick`, App.tsx as recharts chart, recharts installed | **8 green** + 3 expected reds |

[Phase1Checklist.md](Phase1Checklist.md) has every step ticked through
**1.1B.5** (push of `8f968e6`) and **1.2.5** (green `npm test`); the new
**1.2.3.b** step (added retroactively per checklist-is-the-contract
rule) rewrote the Slice 0 logistic anchor for the Decision 0004 API.

## What's in progress (Slice 1.3 — STUCK)

**1.3.1** posted; **1.3.2** marked done by user ("mark 1.3.2 complete").
**1.3.3** is unticked and has accumulated 19 nested fix sub-steps
(1.3.3.fix-1 through 1.3.3.fix-19) chasing recharts UI defects. **Fix-19
is THIS handover** — added retroactively when the user opted to start
fresh.

The work since the last commit (`899ef24 Jargon clense`) is
**unstaged** in the working tree:

- `client/src/sim/model.ts`, `integrator.ts` — NEW (Slice 1.2.2, 1.2.3.a)
- `client/src/sim/logistic.analytic.test.ts` — MODIFIED (1.2.3.b rewrite)
- `client/src/App.tsx` — MODIFIED extensively (Slice 1.2.4 + 19 fix
  iterations through Slice 1.3.3)
- `client/tsconfig.json`, `server/tsconfig.json` — `paths` + `baseUrl`
- `shared/package.json` — `main`/`types` → conditional `exports`
- `shared/src/index.ts` — placeholder replaced with types per §3
- `client/package.json` + `package-lock.json` — `recharts` added
- `docs/design/Phase1Checklist.md` — heavy edits: 1.2.x complete,
  1.3.3.fix-N chain logged

**Tests are green; the open defect is purely visual.** A fresh session
can safely commit the uncommitted work as `green: Slice 1.2 complete`
(or similar) before touching anything new. See "Recommended commit
strategy" below.

## Defect catalog (Slice 1.3.3 visual-review iteration)

All defects below were surfaced during the 1.3.3 visual review. The
checklist has the full Result-line detail on each fix attempt; this
catalog is the index.

### Fixed

| ID | Defect | Fixed by | Notes |
|---|---|---|---|
| D-1.3.3-1 | Y-axis showed raw scaled values, not people-count per §8.3 | 1.3.3.fix-1 | `peoplePerUnit=1000` multiplied; custom tooltip shows both forms |
| D-1.3.3-2 | Bottom area smooshed (axis label overlapped legend) | 1.3.3.fix-2 | Label `position: "bottom"`; margin 60; Legend moved to top |
| D-1.3.3-3 | Grey caption under title illegible | 1.3.3.fix-3 | Deleted |
| D-1.3.3-4 | Rotated Y-axis label overlapped `<h2>` title | 1.3.3.fix-5 | Y-axis label dropped (legend conveys units) |
| D-1.3.3-5 | Y-axis tick numbers shown in full (`80000`) | 1.3.3.fix-6 | `compactNumber()` → `80k`, `1.2M` |
| D-1.3.3-6 | S scale dominated, hiding N curve shape | 1.3.3.fix-7 | Per-line toggle buttons + clickable legend |
| D-1.3.3-7 | Needed "Indexed" mode (value × t0 multiplier) | 1.3.3.fix-8 | Indexed toggle button; initial S(0)=0 handled |
| D-1.3.3-8 | Indexed S broken when S(0)=0 (annoying) | 1.3.3.fix-10 | Per-series first-nonzero reference: `indexed_X(t) = X(t)/X(t*_X)` |
| D-1.3.3-9 | Decades mode showed decimal tick labels (`17.5 dec`) at narrow brush | 1.3.3.fix-15 | `t_display` field + explicit integer `xTicks` |
| D-1.3.3-10 | Y axis "went mental" on brush pan | 1.3.3.fix-15 | `yDomain` locked over full-data extent of visible series |
| D-1.3.3-11 | Years mode tick spacing too sparse (only 0, 200, 400…) | 1.3.3.fix-15, refined in fix-17 | Now every 5 years, `interval="preserveStartEnd"` thins |
| D-1.3.3-13 | Need "multiples of 5" tick density readable at narrow zoom | 1.3.3.fix-17 | `xTicks` step 50→5 in years mode |
| D-1.3.3-14 | Brush culled data instead of zooming X axis | 1.3.3.fix-17 | Removed explicit XAxis `domain` (was blocking brush zoom) |

### Open

| ID | Defect | Status |
|---|---|---|
| **D-1.3.3-12** | Curve peak appeared at different X positions in years vs decades mode | Believed fixed by fix-17 (root-cause shared with D-14), **but D-15 below suggests the toggle may not be working at all — re-verify** |
| **D-1.3.3-15** | Decades toggle produces no visible change | **NEW, OPEN.** See "Critical" section above for the two interpretations. |

### Deferred (scope creep into Slice 1)

| ID | Item | Notes |
|---|---|---|
| F-1.3.3-1 / F-1.3.3-2 | Time-scale toggle + Brush were originally Slice 5 controls scope, landing early in Slice 1 for math-review usability. The chart is now overweight for Slice 1; consider reverting and deferring. | See "Recommendation" |

## Recommended next-session strategy

The Slice 1.3.3 chart UI has accumulated ~280 LOC of toggle/brush/indexing
machinery that **isn't asked for by Phase1Design §8.3** (which spec'd
"one `<LineChart>` with two `<Line>` series … `<ReferenceLine>` cursor
for scrubbing"). The current UI is Slice-5-feature-creep that landed
prematurely to make the math review usable.

**Suggested play for the fresh session:**

1. **Revert App.tsx to a simple version.** Strip the toggle buttons,
   the indexed mode, the time-scale switcher, and the brush. Keep:
   one `<LineChart>` with N and S lines (in people-count via
   `peoplePerUnit`), custom tooltip showing both scaled and people,
   compact Y-axis tick formatter, X-axis labelled in years, 200-year
   horizon (or 500 if the user wants more for math review). That's
   what Slice 1.2.4 was supposed to produce.
2. **Move F-1.3.3-1 (time-scale toggle) and F-1.3.3-2 (brush) into
   Slice 5's `Controls.tsx` scope explicitly.** Add a `Carry-overs /
   Deferred` entry in [Phase1Checklist.md](Phase1Checklist.md).
3. **Close 1.3.3 with the simpler chart.** The user can do the math-
   correctness review at 1.3.4 on a static 200-yr (or 500-yr) plot;
   that's all the design called for.
4. **Continue from 1.3.4** (math review), then through 1.3 to green
   commit.

If the user prefers to keep the rich UI and just debug D-15, the
investigation path is in the "Critical" section above — most likely
needs to inspect rendered output in the DOM to see whether axis labels
update on toggle, then either fix the recharts wiring or add visible UX
to make the toggle's effect clear.

## Recommended commit strategy (for the fresh session, before any new edits)

The working tree carries Slice 1.2 implementation AND the Slice 1.3.3
UI iteration. **All tests pass.** Two options:

- **(a) Commit as one `green: Slice 1.2` and one `wip: 1.3.3 UI` pair.**
  Cleanest history: Slice 1.2 work (model, integrator, shared types,
  tsconfig plumbing, logistic anchor rewrite, simple chart) lands as
  `green: Slice 1.2`. The Slice 1.3.3 UI accretion (toggles, brush,
  indexed, time-scale, 1000-yr horizon, 17 fix steps) lands as a
  separate `wip:` or `chore:` commit so it can be cleanly reverted if
  the fresh session takes the "pull back to simple chart" recommendation.
- **(b) Commit the lot as one `wip: Slice 1.2 + 1.3.3 iteration` and
  leave the cleanup decision for the fresh session.** Simpler now;
  messier history.

The user's commit cadence so far has been pragmatic (`Jargon clense`,
`slice 1.1`, etc. — short messages, project-lead authored). Either
option is fine. **Do not push without explicit ask.**

If reverting App.tsx to a simpler form, useful reference points:
- The post-fix-3 version (N/S lines, no toggles, no brush, no time-scale)
  is roughly what §8.3 calls for. Reachable from git history of the
  unstaged App.tsx — between fix-3 and fix-5 there is no committed
  snapshot, so reconstruct from §8.3 directly.

## Working-style rules (non-negotiable, durable)

Saved in session memory as:
- `feedback_double_approval` — wait for two explicit confirmations at
  every `[HUMAN]` gate (user echoes, Claude confirms back, user
  re-confirms).
- `feedback_checklist_authoritative` — if it isn't a numbered step in
  [Phase1Checklist.md](Phase1Checklist.md), it doesn't get done. Amend
  the checklist before executing.
- `feedback_test_first` — failing tests committed before
  implementation; `red:` / `green:` commit-message prefixes. UI excluded.
- `feedback_implementation_model` — Claude implements, user reviews per
  the structured slice cadence. **Never push commits unprompted.**
- `feedback_no_tlas` — avoid three-letter abbreviations / PM jargon in
  prose. Math/protocol abbreviations are fine. ADR → Decisions,
  PBT → Asserts.

All of these will load automatically with the fresh session via the
MEMORY.md index.

## What to read, in order (for a fresh session)

1. This file (you're reading it).
2. [Phase1Checklist.md](Phase1Checklist.md) — the running record.
   Search for the most recent ticked box; the next unchecked is your
   target. Be wary of the 1.3.3.fix-N chain — that's the iteration
   trap; see "Recommended strategy" above.
3. [Phase1Design.md §0, §11, §12](Phase1Design.md) — decisions,
   review cadence, slice sequence.
4. [adr/0004-generic-rk4-integrator.md](adr/0004-generic-rk4-integrator.md)
   — the one architectural decision from this cycle.
5. [Phase1Retros.md](Phase1Retros.md) Slice 0 entry — context for the
   process rules.

Skim only if you have time:
6. [Phase1AutomatedTests.md](Phase1AutomatedTests.md) — test specs;
   useful when reviewing what 1.1.2 / 1.1.3 / 1.2.5 should achieve.
7. [Phase1RiskRegister.md](Phase1RiskRegister.md) — R-013 still open
   (esbuild vuln, deferred to Slice 6).
8. [Phase1DoD.md](Phase1DoD.md) — Done definition; Slice 1 row will
   need filling at 1.3.4a tracking sweep.

## Repo state at handover write time (2026-05-25)

```
HEAD: 899ef24 Jargon clense                                ← user
      8f968e6 docs: jargon cleanup — Decisions/Asserts substitutions  ← me
      94af448 slice 1.1                                    ← user
      996b079 red: Slice 1 anchor tests — model + integrator
      7160f01 docs: ADR-0004 + checklist amendments for off-checklist work
      2828efe Slice 0 complete                             ← user
      e9cbad9 red: Slice 0 anchor tests
      …

Branch: main, up to date with origin/main.

Unstaged: 9 modified + 2 new (Slice 1.2 + 1.3.3 work).
Untracked: client/src/sim/integrator.ts, client/src/sim/model.ts
Total: +1330 / −62 across 11 files.
```

**`npm test`:** client 3-of-4 pass (8 tests green); server 1 fail
(expected, missing `../app` until Slice 3); shared "no test files"
(intentional skip per 1.1.1). The remaining red is
`turchin.cycle.test.ts` (missing `./replay`, Slice 2 anchor).

**`npm install`:** `recharts` is in `client/package.json`. Other deps
unchanged.

## Decisions already made (do not re-litigate)

- **Model:** Option C (basic demographic-fiscal) per Eq 7.4. Forward-
  compat to Option D via `ModelKind` discriminator.
- **Integrator:** generic `rk4Step<S extends StateC>(s, dt, rhs): S` +
  StateC-typed `advanceTick(s, p, tickYears, dtIntegYears)`.
  N≥0 clamp inside `rk4Step` (via `clampNonNeg`), S≥0 reset between
  `rk4Step` sub-steps inside `advanceTick`. See
  [Decision 0004](adr/0004-generic-rk4-integrator.md).
- **Shared package:** `exports: { ".": { "types": …, "default": … } }`
  pointing at `./src/index.ts`. Both client (Bundler) and server
  (NodeNext) resolve via paths mapping in tsconfigs.
- **Architecture, time, units, founding date, persistence, libraries**
  unchanged from earlier handover — see Phase1Design §0, §16, §17.

## Open seams flagged for later phases (do NOT build now)

- Exogenous resupply (`resupplyRate` param or `supply-drop` event) —
  `// TODO: supply` marker is already in [model.ts](../../client/src/sim/model.ts).
- Option D widening to `(P, E, S)` — `ModelKind` discriminator ready.
- MeridianWorlds integration.
- Non-Turchin alternatives (Allee, Ricker, etc.).

## First steps in a new session

1. **Read this file in full** (especially "Critical" and "Recommended
   strategy").
2. `git status` + `git diff --stat` — confirm 9 modified + 2 new files
   unchanged from the snapshot above. If different, the user did
   something between sessions; ask before touching anything.
3. Open [Phase1Checklist.md](Phase1Checklist.md) and locate the 1.3.3
   block. Skim the 1.3.3.fix-1 through 1.3.3.fix-19 cascade for
   context, but **do not try to continue the cascade** — that's the
   trap that prompted the handover.
4. Decide: **simplify-and-defer** (recommended) or **debug D-15 in
   place**? Surface this as the first decision to the user; let them
   pick.
5. Whichever path: amend the checklist first per
   `feedback_checklist_authoritative` (e.g. add 1.3.3.fix-20 = "revert
   App.tsx" or "diagnose D-15 in browser DOM"), then execute under
   double-approval.
6. Treat all retained behaviors carefully — `peoplePerUnit` display,
   the §8.3 tooltip-shows-both-units rule, and the locked Y axis idea
   are good and should survive any revert.

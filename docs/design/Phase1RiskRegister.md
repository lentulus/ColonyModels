# Phase 1 Risk Register

Running list of project risks for Phase 1. Reviewed at each green review
([Phase1Design.md](Phase1Design.md) §11.1) as part of the
[Definition of Done](Phase1DoD.md).

## Scoring

- **Likelihood** — `Low` / `Med` / `High`. Probability the risk
  materialises during Phase 1.
- **Impact** — `Low` (annoyance), `Med` (slice rework), `High` (rework
  the design or lose data).
- **Status** — `Open` (active), `Mitigated` (mitigation in place but the
  risk persists), `Closed` (cannot materialise any more), `Escalated`
  (warrants design-doc change).

## Active risks

| ID | Risk | Likelihood | Impact | Mitigation | Owner | Status |
| -- | ---- | ---------- | ------ | ---------- | ----- | ------ |
| R-001 | RK4 numerically unstable in some valid `(r, β, c, s₀)` region | Low | High | Analytic-logistic anchor ([AutomatedTests](Phase1AutomatedTests.md) 0.2.1) and Turchin cycle anchor (0.2.2). Asserts property P-I-3 ([Phase1PBT.md](Phase1PBT.md)) sweeps the parameter space. | Claude (tests) / project lead (review) | Open |
| R-002 | SQLite single-file = single-point-of-loss; an `rm` or disk failure loses all runs | Med | Med | Document a backup recipe in the README (cron `cp` or manual). Phase 1 is exploratory so individual run loss is recoverable by re-running. | Project lead | Open |
| R-003 | Snapshot-cache reuse drifts from from-scratch replay (cache poisoning) | Med | High | Determinism test ([AutomatedTests](Phase1AutomatedTests.md) 2.1.1, sub-case `determinism`), Asserts property P-R-1, UI-observable check ([TestCases](Phase1TestCases.md) 5.3.3). | Claude (tests) | Open |
| R-004 | Recharts performance with ~7,200 snapshots (600 yr × 12 ticks/yr) — UI jank on play/scrub | Med | Med | Spike during Slice 5 implementation: profile the live plot at 600 yr; if `>16 ms/frame`, downsample to ≤ 2000 visible points. Recharts has known issues above ~5k points. | Claude (spike) | Open |
| R-005 | Numerical-precision tolerance choices in tests (1e-6, 1e-9, 1e-12) too tight → flaky, or too loose → broken-but-passes | Med | Low | Tune empirically at Slice 0 red review; raise/lower until stable. Asserts runs explore wider input ranges than examples, surfacing tolerance issues earlier. | Project lead (red review) | Open |
| R-006 | Conversation continuity — the Claude window may close mid-slice, losing context | High | Low | [HANDOVER.md](HANDOVER.md) is durable; [Phase1Checklist.md](Phase1Checklist.md) `Result:` lines updated incrementally; [Phase1Retros.md](Phase1Retros.md) captures surprises at slice end. Memory files (`~/.claude/projects/.../memory/`) persist across sessions. | Both | Mitigated |
| R-007 | Schema evolution between Phase 1 and Phase 2 will break stored runs | High | Med | Punt to Phase 2 with explicit awareness; Phase 1 runs are explicitly exploratory and not data-of-record. Add `schema_version INTEGER` column to runs table in Slice 3 to make Phase 2 migration tractable. | Claude (Slice 3) | Open |
| R-008 | Short typo-laden approvals from project lead misinterpreted by Claude → unintended action | Med | High (if commit / delete) | Double-approval gate ([Phase1Design.md](Phase1Design.md) §11.1, first bullet) — Claude echoes the specific next action and waits for a second confirmation. Memory file `feedback_double_approval` keeps this durable across sessions. | Both | Mitigated |
| R-009 | Browser-refresh state restoration drifts from server state (e.g. cursor lost, slider positions wrong) | Med | Med | Manual [TestCases](Phase1TestCases.md) 4.3.3 (post-Slice 4) and 5.3.2.h (post-Slice 5) check byte-identical restoration. | Claude (tests) | Open |
| R-010 | Property-based tests too slow to keep `vitest --watch` responsive | Low | Low | Default to 100 runs per property; raise to 1000 only for anchor properties at end of Slice 5 ([Phase1PBT.md](Phase1PBT.md) "When to run Asserts"). | Claude | Open |
| R-011 | `peoplePerUnit` display scaling confuses users when comparing runs with different scaling factors | Low | Low | UI surfaces the scaling factor in run-list and run-detail views. Tooltip always shows the underlying scaled value alongside the people-count. Documented in Phase1Design.md §8.3. | Claude (Slice 5) | Open |
| R-012 | Effort estimate (Phase1Design.md §11) optimistic for solo human + AI cadence with double-approval and TDD overhead | Med | Low (timeline only) | Slack built into the schedule (~2 of 8 weeks). Retro at each green review tracks whether slices ran to estimate; recalibrate after Slice 2. | Project lead | Open |
| R-013 | `esbuild` ≤ 0.24.2 (transitive via `vite` 5.4.11 in client) — a website visited in the same browser as the dev server can coax the dev server into making/returning arbitrary HTTP requests. Pre-existing as of 2026-05-24 `npm install`. Advisory: [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99). | Low (in our context) | Low (in our context) | Localhost-only dev, no internet exposure. `npm audit fix --force` would upgrade to `vite@8` — breaking change; evaluate in Slice 6 cleanup. Until then: avoid running `npm run dev` on shared / untrusted networks. | Project lead / Claude | Open |
| R-017 | `better-sqlite3` ≥ 12.10 dropped GitHub-release prebuilds for Node ABI v115 (Node 20.x); this system lacks a C build toolchain (no `make`, `gcc`, `g++`) so the `node-gyp` source-compile fallback fails. Discovered Slice 3.2.1. The bad warning message (`libc=` empty) misleads the diagnosis; only `prebuild-install --verbose` reveals the actual 404. | Low (with pin) | High (was blocking the slice) | Pinned to `^12.9.0` in `server/package.json` (last release with v115 prebuild). Mitigated. Re-evaluate when the system gets `build-essential` *or* when Node upgrades to 22+ (different ABI may have prebuilds in later better-sqlite3 versions). | Claude (Slice 6 polish — document in README) | Mitigated |
| R-018 | Server's `tsc` resolves `@colonymodels/shared` via package.json `exports` → `shared/dist/index.d.ts`. If `shared/src` changes without a rebuild, server's typecheck reads stale types. No TypeScript project references in place. Discovered Slice 3.2.2 when `db.ts` first imported shared types. | Med | Low (caught quickly at next build) | Workspace build order runs `shared` before `server` (`npm --workspaces run build`); fresh-dist is implied. Long-term fix: TS composite project references so `tsc -b server` builds `shared` first automatically. | Claude (Slice 4 setup) | Mitigated |

## Closed / superseded

| ID | Risk | Resolution | Date closed |
| -- | ---- | ---------- | ----------- |
| R-014 | Slice 0 anchor `turchin.cycle.test.ts` bound "first N-peak in [80, 220] yr" was 7 yr too tight under §17 verbatim (actual peak at t ≈ 227 yr). Surfaced at Slice 1.3.4b. | Slice 2.1.0 amendment (commit `30a1522`): anchor's `BLANK_RUN` synced to §17 verbatim (`N0=0.5, s0=10`); peak-window widened to `[180, 280]` yr per Phase1MathDerivations §5. Anchor green for the right reason at Slice 2.2.3 (commit `eae0a5f`). | 2026-05-26 |
| R-016 | Slice 0 anchor `turchin.cycle.test.ts` post-peak assertions (`nextTrough` exists; peak→trough ≥ 100 yr) were written under pre-1.3.4b params and incompatible with §17 verbatim's single-excursion behaviour. R-014's Slice 2.1.0 amendment widened the peak window but did not audit these post-peak assertions; they fired assertion-red during Slice 2.2.1 implementation. | Slice 2.2.0 amendment (commit `8d96242`): trough-existence + period assertions replaced with (a) `peakCount === 1`, (b) `\|N(500yr) - 1\| < 0.05` (5% settling to k₀), (c) final-100yr non-increasing. Anchor green for the right reason at Slice 2.2.3 (commit `eae0a5f`). | 2026-05-26 |
| R-015 | `npm run typecheck` and `npm run build` failed project-wide because anchor tests imported not-yet-existent modules (`./replay`, `../app`); tsc rejected, vitest tolerated. Mitigated 2026-05-25 at Slice 1.3.4d via `"exclude": ["src/**/*.test.ts"]` on both client/server tsconfigs. | Both anchor modules have now landed (`replay.ts` at Slice 2.2.1, `app.ts` at Slice 3.2.4 commit `17ba11e`). Decision at the re-evaluation point: **keep** the excludes — vitest owns test typechecking and the separation is defensible. The original failure mode is permanently removed. | 2026-05-26 |

## Review cadence

- **At each green review**, walk this table. For each `Open` risk, ask:
  *did anything this slice change its likelihood, impact, or mitigation
  status?* For new risks discovered, add a row.
- **At Phase 1 sign-off** (DoD §6.5.2), revisit every `Open` risk and
  decide: close, carry into Phase 2, or escalate to a design-doc change.

## How to file a new risk

Append a row at the bottom of the active table with a new `R-NNN` ID
(monotonically increasing — never reuse). Even tiny risks are worth a
row; the cost is one line.

## How to close a risk

Move the row to the *Closed / superseded* table. Note the date and the
resolution (test now passes, code no longer relevant, etc.). Do not
delete — the trail is part of the project's history.

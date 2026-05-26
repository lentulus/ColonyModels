# Phase 1 Retrospectives

One section per slice. Written at the slice's green review, before sign-
off. Never edited after the slice ends — if a later realisation
contradicts an earlier retro, file a new entry in the next slice's
"reconsiderations" sub-section, don't rewrite history.

## How to fill in a retro

Three prompts, in this order. Keep it brief — half a page total is fine.

1. **What surprised me?** Things that did not go as expected. Bugs that
   were harder than they looked, dependencies that turned out simpler
   than feared, a test that found something we hadn't anticipated.
   Surprises are the most valuable artefact of the slice; they evaporate
   by next week.
2. **What worked — keep doing?** Practices, tools, or patterns that paid
   off. The instinct is to focus on what went wrong; this prompt
   deliberately captures the wins so we don't lose them.
3. **What would I change next time?** Concrete next-slice adjustments,
   not generic platitudes. "Allocate more time for X" is weak; "raise
   Asserts runs for the integrator from 100 to 500" is actionable.

Optional: **Action items.** Carry-overs into the next slice (or the
[Risk Register](Phase1RiskRegister.md), or the ad-hoc sections of
[AutomatedTests](Phase1AutomatedTests.md) §6.x.y / [TestCases](Phase1TestCases.md) §6.x.y).
Pin each with an owner.

---

## Slice 0 — Test harness + red regression anchors

**Date:** 2026-05-23 (planning) → 2026-05-24 (setup + tests).
**Duration (red phase → red commit):** the slice is intentionally red-only;
the regression anchors won't turn green until Slices 1 & 2.

### What surprised me?

- **Vitest 4.x** is the current major (4.1.7), not the 1.x/2.x I'd have
  expected from a casual reading of the spec. Installs clean; API surface
  used in our tests is stable across the recent majors.
- **Design tension** at 0.2.1: `rk4Step(s, p, dt)` as written in
  Phase1Design.md §5 is bound to `rhsC`. The natural way to test it
  against pure logistic is either (A) generalise to take an RHS function,
  or (B) reduce Turchin Eq 7.4 to pure logistic via `c=0, beta=0` and use
  the production API. Picked (B) for Slice 0 to keep within the existing
  design; this defers the generic-API question to Slice 1's `1.1.3`
  (which substitutes `f(x) = x` for clamp tests and *will* force the
  question).
- `npm audit` flagged a moderate vuln (R-013) on the *existing* client
  dependency tree (vite/esbuild), not the new installs. Good that the
  audit ran reflexively; if I'd missed it, it would have stayed hidden
  until Slice 6.
- `shared/`'s `main: "dist/index.js"` is a footgun — when consumers
  (client/server tests) try to `import { Run } from "@colonymodels/shared"`
  in Slice 1, they'll need either a build step or a switch to `exports`
  with a `src/` entry. Flagged for Slice 1.

### What worked — keep doing?

- **Test-first forced an API conversation up front.** Without writing
  the analytic-logistic test, the rk4Step-bound-to-rhsC API would have
  shipped from Slice 1 and only broken at 1.1.3. Catching it during
  Slice 0 spec-writing was cheap.
- **Phase1AutomatedTests.md specs were detailed enough** to write tests
  against directly. Pass criteria, sample times, tolerances all reused
  verbatim. Only deviation: chose option B for 0.2.1 (documented inline
  in the test header).
- **Double-approval gate** caught no typos but also created no friction —
  the echo-and-wait is fast to read and gives a useful summary of what's
  about to happen. Worth keeping for every gate.
- **Embedding §17 BLANK_RUN verbatim in the test** rather than importing
  it from a not-yet-existent shared module: avoids spurious red, keeps
  the test self-contained, with a comment to keep both in sync.

### What would I change next time?

- **In Slice 1: write 1.1.3 before 1.1.2.** 1.1.3's "substitute `f(x) = x`"
  case is the API-forcing test; resolving the generic-rk4Step question
  early avoids a refactor mid-slice.
- **Set up TypeScript path mapping** (`@colonymodels/shared` → `shared/src/`)
  during Slice 1 so test files can stop hand-rolling local type duplicates.
- **Switch `shared/package.json`** to `exports` with `./src/index.ts`
  (drop the dist build) — Slice 1 work.
- **Note an interim status to the user before the green review** on
  long slices. Even within Slice 0, the gap between 0.1.5 and 0.2.3 was
  ~10 minutes of work; a mid-slice status didn't add value here, but on
  longer slices it will.

### Action items

| Item | Owner | Target slice / doc |
| ---- | ----- | ------------------ |
| ~~Decide rk4Step generic API (A) vs reduced rhsC (B); make the call before writing 1.1.3~~ — **resolved 2026-05-24, Option A.** See [Decision 0004](adr/0004-generic-rk4-integrator.md). Slice 0's `logistic.analytic.test.ts` (0.2.1) will be re-written against the new generic API in Slice 1.2.x when `integrator.ts` lands. | Project lead + Claude | ✅ Resolved |
| Switch `shared/package.json` `main` → `exports` with `./src/index.ts` | Claude | Slice 1, step 1.2.1 |
| Add TS path mapping for `@colonymodels/shared` in client + server tsconfigs | Claude | Slice 1, step 1.2.1 |
| Revisit R-013 (`esbuild`/`vite` vuln) — try `npm audit fix --force` | Claude | Slice 6 polish |

---

## Slice 1 — Shared types + model + integrator

**Date:** 2026-05-24 (red phase, Slice 0→1 bridge, jargon cleanup) → 2026-05-25 (impl, UI iteration, math verification).
**Duration:** ~2 sessions, dominated by mid-slice UI defect-fixing (1.3.3.fix-1 through fix-21) and a structural math-verification gate (1.3.4 → 1.3.4b → 1.3.4c → 1.3.4b.fix-1 through fix-5) that wasn't in the original slice plan.

### What surprised me?

- **The Slice 1 visual review collapsed into a 21-step recharts fix cascade** (D-1.3.3-1 through D-1.3.3-15). What the design called for (one `<LineChart>` with two lines per §8.3) accreted toggles, brush, indexed mode, time-scale switching and 1000-yr horizon as the user tried to use the chart for math review. The first 17 fixes added; fix-20 stripped most of it back out and only the simpler chart survived. **Cost:** roughly an evening of churn for no net feature gain in Slice 1. The carried-over UI capabilities (F-1.3.3-1 brush, F-1.3.3-2 time-scale toggle) are now correctly scoped to Slice 5's `Controls.tsx`. Slice 5 starts with a clear "what NOT to put in App.tsx" lesson.
- **The math-correctness gate (1.3.4) couldn't actually be satisfied by the project lead alone.** The lead is honest that they can't audit Turchin's equations end-to-end. This was a structural gap in §11.1's "math-correctness review" anchor — the cadence assumed the reviewer can verify math, but in this two-party arrangement, the math is the AI's work and the human's role has to be sourcing-integrity. We addressed by adding 1.3.4b (AI derives + codifies) and 1.3.4c (human audits citations, not derivations). This pattern should propagate to Slice 5's second math-correctness review.
- **Reading the Turchin PDF surfaced two latent §17 errors.** F-1.3.4b-1 (`s_0 = 1` vs Fig 7.1's `s_0 = 10`) and F-1.3.4b-2 (`N_0 = 0.2` vs Fig 7.1 prose's `k_0/2 = 0.5`). Both were in the design doc since first drafting; neither failed any prior test because the existing assertions were loose enough to accommodate either. Without 1.3.4b, these would have shipped silently to Slice 2 and failed the anchor cycle bound. **The original 1.3.4 "is the cycle visible" test was too weak — visible to whom, on what plot?**
- **The integrator was correct.** The deterministic single-excursion behavior (one N-peak, then absorbing stateless equilibrium) was *new* to me as the implementer — I'd been mentally modeling "Turchin secular cycle" as recurring without checking. Turchin p.131 is explicit: only the *stochastic* model gives recurring cycles. Eq 7.4 deterministically produces one cycle and stops. This caught a misconception, not a bug. The test now codifies this so it can't be forgotten.
- **`git stash` is dangerous in this workflow.** During 1.3.4a I used `git stash --include-untracked` for a "clean typecheck" diagnostic; the pop appeared to succeed but the working tree was reverted. Saved by inspecting the remaining stash entry and re-popping. Never use stash for "temporary clean state" — `git diff` and `git stash list` aren't enough verification. If I need to run typecheck on a clean tree, just commit first.
- **`npm run typecheck` and `npm run build` have been broken since Slice 0.2.3.** Server's `runs.roundtrip.test.ts` uses `import { app } from "../app"` which fails NodeNext resolution. Vitest tolerated it (its resolver is more forgiving); tsc didn't. The Slice 0 DoD waivers only covered tests-green; typecheck-clean and build-clean were implicitly waived but not documented. R-015 now tracks this. **Resolved at 1.3.4d** via tsconfig `exclude` on both workspaces (option (c) — see checklist 1.3.4d for the (a)-doesn't-work detour).
- **fast-check found a real edge case in P-M-2 (Slice 1.3.4e).** Property as written: "below carrying capacity (0 < N < k), dN > 0". Counterexample: `N = 5e-324` (smallest positive subnormal). `r · N` underflows to exact 0 in IEEE-754, so dN = 0, not strictly > 0. The math is right; the property's framing assumed FP arithmetic preserves strict inequalities, which it doesn't near subnormals. Fixed by tightening `arbN` lower bound to `1e-100` (still vastly below any physically meaningful colony size), per [Phase1PBT.md](Phase1PBT.md) §"Conventions" guidance to bound generators to physically meaningful ranges. This counted as a *useful* Asserts find — exactly what the property suite is for, even if the bug was in the property's framing rather than in `rhsC`.

### What worked — keep doing?

- **Test-first with citation anchors.** Writing `model.cycle.test.ts` against derived features (rather than copying Fig 7.1 visuals) produced assertions that survived the §17 parameter change unchanged. The bounds I chose initially were generous enough that switching s₀=1→10 and N₀=0.2→0.5 didn't break any of them. Then at fix-2 I tightened them now that we're at canonical params. Loose-then-tighten is the right cadence.
- **The "find a real numerical fixed point" technique.** §3.4 of Phase1MathDerivations.md predicted analytically that `N` at the S-peak equals `(1-β)·k(S_peak)`. Then I verified numerically: 2.62 vs 2.62 — exact to 2 dp. This kind of independent-derivation cross-check is gold; it caught a subtle integrator bug at Slice 2 (R-001 mitigation).
- **Checklist-is-the-contract.** The 1.3.4b/c/a steps were added retroactively (they weren't in the original checklist) using the same numbered-step amendment + double-approval flow as any other step. The doc's history is now legible: every action that landed has a numbered step behind it.
- **Double-approval.** Caught no typos this slice but again added no friction. The "echo back the specific action" prompt is mandatory and works; the user has cancelled work zero times because the gate forced clarity.
- **Citation-integrity audit (1.3.4c) as the human's role on math.** This pattern is reusable across the codebase wherever the AI derives something the human can't independently verify: AI writes derivation + citations, human checks that the cited references exist and say what's quoted. Much more achievable than full math audit.

### What would I change next time?

- **Add a "typecheck clean" check to Slice 0's DoD before committing.** R-015 should have surfaced at Slice 0 sign-off; instead it surfaced at Slice 1's DoD review. Add a CI-style script that runs typecheck + build + test at every slice's red and green commits.
- **At Slice 1.1 red review, list the Phase1AutomatedTests.md sections that the new tests will populate.** The new `model.cycle.test.ts` doesn't have an entry in that doc — added retroactively by a Slice 1.3.4b.fix-6 amendment (if user approves it). Adding the entries at red-review time, not retroactively, would avoid this gap.
- **Slice the §8.3 chart from the math-review chart.** The 1.3.3 UI cascade happened because the chart had two purposes: §8.3 user-facing display + 1.3.4 math-review tool. Future slices should split these explicitly — the math-review tool can be a developer-only script that dumps CSV + a static PNG, leaving the user-facing chart to follow §8.3 verbatim.
- **Always read the source-of-truth document at the start of any math-correctness step.** Had I read Turchin Ch. 7 at Slice 0.2.2 (when writing the anchor's `[80, 220]` bound), R-014 wouldn't exist. The PDF was at `docs/reference/` since 2026-05-23; nobody opened it until 1.3.4b.

### Action items

| Item | Owner | Target slice / doc |
| ---- | ----- | ------------------ |
| Widen `turchin.cycle.test.ts` peak-bound from [80, 220] → [180, 280] (R-014) | Claude | Slice 2.1.x red-review |
| ~~Decide R-015 remediation~~ — **resolved 2026-05-25 at 1.3.4d**, option (c) (tsconfig exclude on both workspaces) | ~~Project lead~~ | ~~Slice 1.3.5 DoD~~ ✅ |
| ~~Backfill Phase1AutomatedTests.md with a 1.3.4b entry~~ — **resolved 2026-05-25 at 1.3.4b.fix-6** | ~~Claude~~ | ~~Before 1.3.5 sign-off~~ ✅ |
| ~~Write Slice 1 Asserts properties (P-M-1..7, P-I-1..6)~~ — **resolved 2026-05-25 at 1.3.4e**, all 13 green at 100 runs/property | ~~Claude~~ | ~~Before 1.3.5 sign-off~~ ✅ |
| Carry F-1.3.3-1 (time-scale toggle) and F-1.3.3-2 (brush) into Slice 5 `Controls.tsx` scope; add explicit entries to the Slice 5 sub-steps | Claude | Slice 5.2.2 |
| Reuse the "AI-derives, human-audits-citations" pattern for the Slice 5.3.3 math-correctness review | Both | Slice 5.3.3 |
| `fc.float` API changed in fast-check 4.x (32-bit-only); switch to `fc.double` for arbitrary-range doubles. Phase1PBT.md uses old API verbatim — consider updating the doc to point at `fc.double`. | Claude | Slice 5 polish / Slice 6 |

---

## Slice 2 — Replay engine

**Date:** 2026-05-26 (single session: 2.1.0 R-014 amendment → 2.1 red phase → 2.2.0 R-016 amendment → 2.2 implementation → 2.3 review).
**Duration:** ~1 session. Faster than Slice 1 — the §17 verbatim alignment work in 1.3.4b had already done the math-correctness audit; this slice was the assertion-side cleanup it implied, plus the replay engine implementation.

### What surprised me?

- **R-016 surfaced exactly when `replayTo` made the anchor reach its assertion phase, not before.** R-014 widened the peak window at 2.1.0 but didn't audit the rest of the assertion chain. The trough-existence and peak→trough interval assertions sat dormant (test still red at import) until the implementation landed at 2.2.1 — then they fired assertion-red. The audit-completeness gap at 2.1.0 was real: I should have walked the *entire* `it(...)` block when widening the peak window, not just the assertion the bound modified. Lesson now codified into "What I'd change."
- **The math derivation §3.3 was exactly right.** `peakCount === 1` holds; `|N(500yr) - 1| < 0.05` holds; final-100yr non-increasing holds. No tolerance widening needed after the first try — the loose-then-tighten cadence from Slice 1 worked again, but for the first time I trusted the analytical derivation's tightness on the first attempt.
- **The "branching helpers" line in the checklist was a YAGNI temptation.** The §6.4 branching procedure is `[...events.filter(e => e.tEpoch <= tr), newEvent]` followed by `replayTo`. Nothing to wrap. I considered exporting `rewindEvents(events, tr)` but stopped — the array primitive at the caller is clearer than the wrapper. Confirmed by the test's branch-divergence sub-case passing without a helper. Future store code in Slice 4 can re-evaluate.
- **Per-step commits read better than Slice 1's bundled wip:-style ones.** Slice 1's `4f08f7e wip: Slice 1.2 complete + Slice 1.3.3 UI iteration` is opaque to a future reader; Slice 2's six commits each describe one move. Cost: roughly 2× the commit count, but each diff is a meaningful unit of review. Will keep doing.

### What worked — keep doing?

- **Checklist-authoritative discipline through mid-slice surprises.** R-016 surfaced mid-2.2.1 (already 75 lines into `replay.ts`). I stopped, filed 2.2.0 as a numbered step, double-approved, executed, *then* resumed 2.2.1. No silent edit-the-test-and-move-on shortcut even under "almost done, just fix it" pressure.
- **The replay test's `makeRun(overrides)` helper.** Each sub-case customises only the bits it needs; no shared mutable state; collapses to a shared helper if/when the shared workspace exports a §17 default.
- **The new anchor assertion stack codifies design intent as executable.** `peakCount === 1` + settling + monotonic-tail make §17's single-excursion behavior an executable contract. Future model changes (Option D, stochastic forcing) will break this anchor and force a deliberate amendment — exactly the desired behavior.
- **Reusing R-014's "amendment commit before next step" pattern at 2.2.0.** Both R-014 and R-016 are §17-verbatim audit fixes; both got the same `docs+test: Slice 2.X.0 — amendment` commit shape with substeps a–h and a clean separation from the implementation commit. The audit trail is one of the most legible things in the repo right now.
- **Visually-found UI fixes flow through the same checklist discipline.** 2.3.3.fix-1 (round N to integer in tooltip) was found during the 2.3.3 spot-check; instead of a silent edit, it became its own numbered substep + commit. Pattern reusable for any future visual-review fix.

### What would I change next time?

- **When the model's qualitative behavior changes (e.g., §17 verbatim alignment in 1.3.4b), audit *every* assertion in every downstream `it(...)` block — not just the assertion the change obviously affected.** R-014 caught the peak window; R-016 was the trough assertion in the same `it("A; B; C; D", ...)` block. There was no excuse for one to ship without the other being audited. For multi-assertion `it()` blocks, treat the *whole* block as the unit of audit when the model behavior changes.
- **Audit Phase1AutomatedTests.md alongside the test code at amendment time.** The 0.2.2 entry in Phase1AutomatedTests.md still described the pre-2.1.0/2.2.0 setup and pass criteria right up until 2.3.3a's tracking sweep refreshed it. Slice 1's retro flagged the same pattern (1.3.4b.fix-6 backfilled 1.3.4b after the fact). Action item: at any test-amendment step (e.g., `2.X.0`), include a substep "update Phase1AutomatedTests.md to match" in the same commit.
- **Consider extracting a `dev:client-only` script** so the 2.3.3 visual review doesn't have to fight a failing server-workspace boot. Low priority — defer to Slice 5 polish or Slice 6.

### Action items

| Item | Owner | Target slice / doc |
| ---- | ----- | ------------------ |
| Write Slice 2 Asserts properties (P-R-1..6 from [Phase1PBT.md](Phase1PBT.md)) — analog of Slice 1's 1.3.4e | Claude | resolve at end of Slice 2 *or* schedule as a 2.x.y substep before 2.3.7 closeout |
| Standing rule: at every test-amendment step (`N.M.0`), include a substep to refresh [Phase1AutomatedTests.md](Phase1AutomatedTests.md) to match the new test shape, in the same commit | Both | Slice 3 onward |
| Carry "audit every assertion in `it()` blocks when model behavior changes" into Slice 5's math-correctness review pattern | Both | Slice 5.3.3 |
| Add `dev:client-only` script to root `package.json` | Claude | Slice 5 / 6 polish |
| ~~Widen `turchin.cycle.test.ts` peak-bound [80, 220] → [180, 280] (R-014)~~ — **resolved at Slice 2.1.0**, commit `30a1522` | ~~Claude~~ | ✅ |

---

## Slice 3 — Persistence + HTTP

**Date:** —
**Duration:** —

### What surprised me?

*(fill in at green review)*

### What worked — keep doing?

*(fill in at green review)*

### What would I change next time?

*(fill in at green review)*

### Action items

| Item | Owner | Target slice / doc |
| ---- | ----- | ------------------ |
| *(none yet)* | | |

---

## Slice 4 — Client store + api wrappers

**Date:** —
**Duration:** —

### What surprised me?

*(fill in at green review)*

### What worked — keep doing?

*(fill in at green review)*

### What would I change next time?

*(fill in at green review)*

### Action items

| Item | Owner | Target slice / doc |
| ---- | ----- | ------------------ |
| *(none yet)* | | |

---

## Slice 5 — UI controls + scrubbing

**Date:** —
**Duration:** —

### What surprised me?

*(fill in at green review)*

### What worked — keep doing?

*(fill in at green review)*

### What would I change next time?

*(fill in at green review)*

### Action items

| Item | Owner | Target slice / doc |
| ---- | ----- | ------------------ |
| *(none yet)* | | |

---

## Slice 6 — Polish + demo recipe

**Date:** —
**Duration:** —

### What surprised me?

*(fill in at green review)*

### What worked — keep doing?

*(fill in at green review)*

### What would I change next time?

*(fill in at green review)*

### Action items

| Item | Owner | Target slice / doc |
| ---- | ----- | ------------------ |
| *(none yet)* | | |

---

## Phase 1 wrap-up

After Slice 6 sign-off, fill in a brief overall retro to feed Phase 2
planning.

**Date:** —

### Surprises across the whole phase

*(fill in at Phase 1 sign-off — what showed up that the slice retros didn't catch)*

### Practices to carry into Phase 2

*(fill in)*

### Practices to drop in Phase 2

*(fill in)*

### Re-estimated effort

The Phase 1 design estimate was ~1.95 PM implementation + ~13-14 hr
human supervision ([Phase1Design.md](Phase1Design.md) §11). What did
it actually cost?

*(fill in)*

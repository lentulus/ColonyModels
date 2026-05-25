# Phase 1 Handover

Last refreshed 2026-05-25 at the end of Slice 1. Slice 1 just shipped
clean (`4d497ef green: Slice 1`); the next session starts **Slice 2
(replay engine)**.

This document is the cross-session continuity index — read it first if
you're picking up the project from a fresh Claude window. It points to
the authoritative docs rather than restating them.

---

## TL;DR for a fresh session

**Slices 0 and 1 are complete and green.** The math layer (`rhsC`,
`rk4Step`, `advanceTick`) is implemented and audited against Turchin's
*Historical Dynamics* Ch. 7 via a citation-anchored derivation in
[Phase1MathDerivations.md](Phase1MathDerivations.md). Asserts properties
(13 of them, P-M-1..7 + P-I-1..6) lock the math layer at 100
runs/property.

**Next action: Slice 2 — replay engine.** First checklist step is
**2.1.1 [AI]** (write `client/src/sim/replay.test.ts`). But see the
critical carry-over below — there's an amendment to file *before*
2.1.1 fires.

### Critical pre-2.1.1 carry-over (R-014)

The Slice 0 anchor
[client/src/sim/turchin.cycle.test.ts](../../client/src/sim/turchin.cycle.test.ts)
asserts the first N-peak is in `[80, 220]` yr. With §17 now at Turchin
verbatim (s₀=10, N₀=0.5, aligned 2026-05-25 at Slice 1.3.4b.fix-1), the
actual peak is at t≈227 yr — 7 yr above the bound. **The anchor WILL
fail at Slice 2.2.3 when `replayTo` lands.**

**Required action before 2.1.1:** per checklist-is-the-contract, file a
new step (probably numbered 2.1.0) to widen the bound from `[80, 220]`
to `[180, 280]`, then execute under double-approval. Full analysis is
in [Phase1MathDerivations.md §5](Phase1MathDerivations.md).

---

## Current state

```
HEAD: 4d497ef green: Slice 1 — model + integrator + math-correctness anchors
      b5512f0 Walked bak UI changes to another phase
      4f08f7e wip: Slice 1.2 complete + Slice 1.3.3 UI iteration (D-15 open)
      ...

Branch: main, 1 ahead of origin/main (Slice 1 commit unpushed).
Working tree: clean.
```

**Verifications (all should still pass at session start):**
- `npm test`: client 28/28 green (15 example + 13 properties); server
  `runs.roundtrip.test.ts` red at import (`Cannot find module '../app.js'`
  — Slice 3 anchor, expected); shared no test files (1.1.1 documented
  skip).
- `npm run typecheck`: clean across all 3 workspaces.
- `npm run build`: clean across all 3 workspaces.

If any of these don't match: somebody touched the tree between sessions
— **ask the user before proceeding.**

---

## What landed in Slice 1

| Slice block | What landed |
|---|---|
| 1.1 | Red anchor tests for model + integrator (example-based) |
| 1.1B | Jargon cleanup (ADR→Decisions, PBT→Asserts) |
| 1.2 | Shared types, rhsC (Turchin Eq 7.4), rk4Step + advanceTick, App.tsx chart |
| 1.3.3 | Visual review — fix-1..21 cascade closed by simplification |
| 1.3.4 / 4b / 4c | Math-correctness verification (derivation + citation audit) |
| 1.3.4a | Tracking sweep (RiskRegister R-014/R-015, Retros, DoD) |
| 1.3.4d | R-015 mitigation — tsconfig exclude for test files on both workspaces |
| 1.3.4b.fix-1..5 | §17 aligned to Turchin Fig 7.1 verbatim |
| 1.3.4b.fix-6 | Phase1AutomatedTests.md backfill for 1.3.4b |
| 1.3.4e | Asserts properties P-M-1..7 + P-I-1..6 (13 total) |
| 1.3.5 | DoD sign-off by Lentulus — 12/13 green, 1 explicit waiver |
| 1.3.6/7/8 | Pre-commit triage → approve → commit `4d497ef` |

Major shifts vs the prior handover (which was written mid-1.3.3 panic
about D-15): the rich-UI accretion was reverted at fix-20 (App.tsx
back to a simple chart per §8.3 intent); the time-scale toggle (F-1.3.3-1)
and brush (F-1.3.3-2) are deferred to Slice 5's `Controls.tsx`; D-1.3.3-15
dissolved when the toggle was removed.

---

## What to read, in order

1. **This file** (you're reading it).
2. [Phase1Checklist.md](Phase1Checklist.md) — find the most recent
   ticked box (1.3.8); the next unchecked is the Slice 2 block.
3. [Phase1MathDerivations.md §5](Phase1MathDerivations.md) — R-014
   carry-over analysis.
4. [Phase1Design.md §6](Phase1Design.md) — replay engine pseudo-code
   (paramsAt, replayTo, branching, mid-tick events).
5. [Phase1PBT.md §"Properties — replay"](Phase1PBT.md) — the P-R-*
   properties Slice 2 will need (analogous to Slice 1's P-M-*/P-I-*).

Skim only if time permits:
6. [Phase1AutomatedTests.md §2.1.1](Phase1AutomatedTests.md) — replay
   engine test spec.
7. [Phase1Retros.md Slice 1 entry](Phase1Retros.md) — surprises,
   what-worked, what-to-change, six surviving action items.
8. [Phase1RiskRegister.md](Phase1RiskRegister.md) — R-001..R-015.

---

## Behavioral rules (loaded automatically via MEMORY.md)

All durable feedback memories remain active. Most consequential in
practice:

- **`feedback_double_approval`** — every `[HUMAN]` gate gets two
  explicit approvals with an echo in between. Apply without exception.
  **Confirmed working** during Slice 1: caught a cat-induced typo'd
  approval (`aaaaaaaaaaaaszapprove commit`) during the green commit
  gate; user re-confirmed clear ("Sorry, cat. Which is indeed why we
  have the rule").
- **`feedback_checklist_authoritative`** — if a task isn't a numbered
  step, it doesn't get done; amend the checklist first, then execute.
  Slice 1 made heavy use of this (1.3.4b/c/a/d/e, 1.3.4b.fix-1..6, all
  added retroactively).
- **`feedback_test_first`** — `red:` then `green:` commit prefixes;
  failing tests before implementation.
- **`feedback_implementation_model`** — never push without explicit ask.
- **`feedback_explain_errors_in_output`** — annotate every error / FAIL
  in tool output (added 2026-05-25 after the user noted "I forget
  things"). Don't leave raw error text uncontextualized.
- **`feedback_no_tlas`** — avoid PM-jargon abbreviations.
- **`feedback_positive_deferral_reasons`** — positive engineering
  reason for defers, not "wasn't in the plan."

---

## Decisions already made (do not re-litigate)

- **Model:** Option C (basic demographic-fiscal) — Turchin Eq 7.4.
- **Integrator:** Generic `rk4Step<S>(s, dt, rhs)`; `advanceTick` binds
  `rhsC` via closure. `N ≥ 0` clamp inside `rk4Step`; `S ≥ 0` manual
  reset between `rk4Step` calls in `advanceTick`. See
  [Decision 0004](adr/0004-generic-rk4-integrator.md).
- **§17 BLANK_RUN:** Turchin Fig 7.1 / §7.2.1 verbatim —
  `r=0.02, β=0.25, c=3, s0=10, N0=0.5, S0=0`. Aligned 2026-05-25.
- **Asserts:** properties live in the same file as example tests under
  a separate `describe("properties", ...)` block per
  [Phase1PBT.md §"Conventions"](Phase1PBT.md). Use `fc.double` (not
  `fc.float`) for arbitrary-range doubles — fast-check 4.x restricts
  `fc.float` to 32-bit IEEE-754. Phase1PBT.md tables still show the
  old `fc.float` form; doc update is a Slice 5/6 polish item.
- **tsconfig:** test files excluded from tsc on both workspaces
  (`"exclude": ["src/**/*.test.ts"]`); vitest type-checks tests at run
  time via its own resolver. Re-evaluate at Slice 2.2.3 / 3.2.4.
- **Math correctness:** AI derives + cites; human audits citations,
  not derivations. Pattern reusable for Slice 5.3.3's second
  math-correctness anchor.
- **Architecture / time / units / founding date / persistence /
  libraries:** unchanged from earlier handover — see
  [Phase1Design.md §0, §16, §17](Phase1Design.md).

---

## Open active risks

In [Phase1RiskRegister.md](Phase1RiskRegister.md):

| ID | Status | Notes |
|---|---|---|
| R-001..R-012 | Open | Distributed across slices per their target. |
| R-013 | Open | esbuild/vite moderate vuln; deferred to Slice 6 polish per original plan. |
| **R-014** | **Open** | **Slice 0 turchin.cycle.test.ts peak-bound mismatch; will fire at Slice 2.2.3. Address at Slice 2.1.0 amendment (above).** |
| R-015 | Mitigated | tsconfig exclude on both workspaces; closes at Slice 2.2.3 + 3.2.4 when anchor modules land. |

---

## Open seams flagged for later phases (do NOT build now)

- Exogenous resupply (`resupplyRate` param or `supply-drop` event) —
  `// TODO: supply` marker in
  [model.ts](../../client/src/sim/model.ts).
- Option D widening to `(P, E, S)` — `ModelKind` discriminator ready
  in [shared/src/index.ts](../../shared/src/index.ts).
- MeridianWorlds integration.
- Non-Turchin alternatives (Allee, Ricker, etc.).
- F-1.3.3-1 (time-scale toggle) + F-1.3.3-2 (brush) — deferred from
  Slice 1.3.3 to Slice 5's `Controls.tsx`.

---

## First steps in a new session

1. Read this file in full (especially "Critical pre-2.1.1 carry-over").
2. `git status` + `git log --oneline -5` — confirm HEAD is `4d497ef`
   and working tree is clean. If different, the user did something
   between sessions; **ask before touching anything**.
3. Run `npm test`, `npm run typecheck`, `npm run build` — confirm they
   match the "Verifications" block above. If anything has drifted, ask.
4. Open [Phase1Checklist.md](Phase1Checklist.md), find the Slice 2
   block. The first unchecked step is 2.1.1. Surface the R-014
   amendment to the user *first* — propose adding it as a numbered
   step (likely 2.1.0) before 2.1.1 fires. Get double-approval, then
   execute the amendment and proceed.
5. Once R-014 is filed and the anchor bound is widened, Slice 2 red
   phase (2.1.1 → 2.1.6) begins.

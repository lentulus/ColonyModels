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
   PBT runs for the integrator from 100 to 500" is actionable.

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
| ~~Decide rk4Step generic API (A) vs reduced rhsC (B); make the call before writing 1.1.3~~ — **resolved 2026-05-24, Option A.** See [ADR-0004](adr/0004-generic-rk4-integrator.md). Slice 0's `logistic.analytic.test.ts` (0.2.1) will be re-written against the new generic API in Slice 1.2.x when `integrator.ts` lands. | Project lead + Claude | ✅ Resolved |
| Switch `shared/package.json` `main` → `exports` with `./src/index.ts` | Claude | Slice 1, step 1.2.1 |
| Add TS path mapping for `@colonymodels/shared` in client + server tsconfigs | Claude | Slice 1, step 1.2.1 |
| Revisit R-013 (`esbuild`/`vite` vuln) — try `npm audit fix --force` | Claude | Slice 6 polish |

---

## Slice 1 — Shared types + model + integrator

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

## Slice 2 — Replay engine

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

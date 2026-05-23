# ADR-0002: Hand-rolled RK4 over an ODE library

- **Status:** Proposed
- **Date:** 2026-05-23
- **Decision-makers:** project lead; drafted by Claude
- **Related:** Phase1Design.md §5 (integrator), §9 (libraries),
  [Phase1TestCases.md](../Phase1TestCases.md) 0.2.1 (analytic-logistic anchor)

## Context

The Phase 1 model is a system of two coupled ODEs (Turchin Eq 7.4) with
manual constraints ($N \ge 0$, $S \ge 0$ reset). The integrator needs to
advance the state in many small steps for each UI tick, deterministically,
with predictable error behaviour over horizons of hundreds of years.

Candidate approaches:

- **`mathjs`** (general math library, includes ODE solvers). ~3 MB
  install, far more surface area than we need.
- **`numericjs`** (older numerical-methods library). Unmaintained since
  2018; not actively maintained for modern Node/browser.
- **`ode-rk4`** or similar focused npm packages. Tiny, but adds a
  dependency for ~20 lines of code we can write ourselves.
- **Hand-roll RK4** in `client/src/sim/integrator.ts`.

The Turchin dynamics are non-stiff in our parameter range and the period
of interest is ~200 years, so an adaptive solver is overkill (and would
complicate the rewind / event-replay story by introducing variable step
sizes). A fixed-step explicit RK4 at `dt = 1/365.25 yr` gives effectively
closed-form accuracy at zero cost.

## Decision

**Implement RK4 by hand as ~20 lines of TypeScript in
`client/src/sim/integrator.ts`.** No ODE library dependency.

Apply the $N \ge 0$ clamp inside `rk4Step` (post-step). Apply the
$S \ge 0$ manual reset around `rk4Step`, per Turchin's "state cannot go
into debt" rule (§7.2.1 of his book).

## Consequences

**Positive.**

- Trivial dependency footprint — zero new npm packages for the math
  layer.
- Full control over the clamp semantics, which Turchin handles outside
  the ODE. A library wouldn't know about our domain constraints.
- Trivially testable: we own every code path, can unit-test rk4Step
  against hand-computed values, and can regression-test against the
  analytic-logistic closed form ([TestCases 0.2.1](../Phase1TestCases.md)).
- No library surprises (deprecations, breaking changes, subtle
  step-size adaptations).
- Easy to extend later (e.g. add a `step` event for instrumentation,
  swap in RK45 if the dynamics ever need adaptive stepping).

**Negative.**

- We own the bugs. Mitigated by the analytic-logistic regression anchor
  (TestCases 0.2.1) and the Turchin cycle-period anchor
  (TestCases 0.2.2).
- Cannot offload to optimised native code. Acceptable: at `dt = 1/365.25 yr`
  and 600-yr horizon, ~219k RK4 steps complete in tens of milliseconds in
  modern JS engines.
- If a later phase introduces stiff dynamics (rare in human-history
  models), we'll need to either implement an implicit solver or revisit
  this decision.

**Neutral / followups.**

- Property-based tests (see [Phase1PBT.md](../Phase1PBT.md)) will cover
  the integrator across a wider parameter range than the example tests
  reach. This decision is more defensible *with* PBT than without.
- A future ADR may revisit this if/when we need adaptive stepping or
  symplectic integrators.

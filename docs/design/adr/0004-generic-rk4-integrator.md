# ADR-0004: Generic rk4Step decoupled from rhsC

- **Status:** Proposed
- **Date:** 2026-05-24
- **Decision-makers:** project lead; drafted by Claude
- **Related:** [ADR-0002](0002-hand-rolled-rk4-over-ode-library.md) (hand-rolled RK4),
  Phase1Design.md §5 (integrator), §6.7 (extension seams),
  [Phase1Retros.md](../Phase1Retros.md) Slice 0 action item #1,
  [Phase1AutomatedTests.md](../Phase1AutomatedTests.md) 0.2.1, 1.1.3

## Context

[ADR-0002](0002-hand-rolled-rk4-over-ode-library.md) settled *whether* to
hand-roll RK4 (yes). It left open *how to shape the signature*. The
initial Phase1Design.md §5 wrote it bound to the project's RHS:

```ts
function rk4Step(s: StateC, p: ParamsC, dt: number): StateC {
  // calls rhsC(...) internally
}
```

This signature ran into a Slice 1 test-first tension caught during the
Slice 0 retro (see [Phase1Retros.md](../Phase1Retros.md) "Slice 0 →
Action items" and Phase1AutomatedTests.md 1.1.3):

- **0.2.1** (already committed in `e9cbad9`) verifies the *integrator + model
  pipeline* against the analytic logistic. It sidestepped the bound API
  by choosing parameters (`c = 0, beta = 0`) that reduce Turchin Eq 7.4 to
  pure logistic, so the bound `rk4Step(s, p, dt)` still produces a
  closed-form-matchable trajectory.
- **1.1.3** (about to be written) is intended to verify the *integrator
  algorithm itself* in isolation — the classical move is to integrate a
  trivial RHS like $f(x) = x$ for one step and compare against the
  hand-computed RK4 value. That **cannot** be expressed against a
  rhsC-bound signature; there is no parameter choice that turns Turchin
  Eq 7.4 into $dx/dt = x$ on a scalar state.

The bound signature also couples two concerns that Phase 2 will want to
split: the numerical algorithm and the model RHS. §6.7 already flags
`// TODO: supply` and `ModelKind` widening; a generic integrator makes
adding a second `ModelKind` (Option D, alternative non-Turchin models) a
one-line call-site change rather than an integrator edit.

Two candidates were evaluated:

- **Option A — Generic integrator.** `rk4Step<S>(s, dt, rhs): S` takes
  the RHS as a parameter. Caller supplies `rhsC` (or any other RHS).
- **Option B — Keep bound.** Leave `rk4Step(s, p, dt)` bound to `rhsC`.
  Rewrite 1.1.3 to substitute parameters that reduce `rhsC` to a known
  form (the same trick 0.2.1 uses).

Option B avoids one layer of indirection but pays for it forever in
testability: every future "is the integrator algorithm correct?"
question has to be answered through `rhsC`, which makes algorithm bugs
and model bugs hard to disentangle. It also blocks the clean Phase 2
extension point.

## Decision

**Adopt Option A. Change Phase1Design.md §5 to**

```ts
function rk4Step<S>(s: S, dt: number, rhs: (s: S) => S): S {
  const k1 = rhs(s);
  const k2 = rhs(addScaled(s, k1, dt/2));
  const k3 = rhs(addScaled(s, k2, dt/2));
  const k4 = rhs(addScaled(s, k3, dt));
  const incr = combine(k1, k2, k3, k4);     // (k1 + 2k2 + 2k3 + k4) / 6
  return clampNonNeg(addScaled(s, incr, dt));
}
```

The $N \ge 0$ clamp stays inside `rk4Step` (post-step, via
`clampNonNeg`); the $S \ge 0$ manual reset stays outside, around the
caller of `rk4Step` (per [ADR-0002](0002-hand-rolled-rk4-over-ode-library.md)
and Phase1Design.md §5). `advanceTick` becomes the place where `rhsC` is
bound:

```ts
function advanceTick(s: StateC, p: ParamsC, tickYears: number, dtIntegYears: number): StateC {
  const nSteps = Math.round(tickYears / dtIntegYears);
  const rhs = (st: StateC) => rhsC(st, p);
  let cur = s;
  for (let i = 0; i < nSteps; i++) cur = rk4Step(cur, dtIntegYears, rhs);
  return cur;
}
```

The `clampNonNeg` step inside `rk4Step` is generic over `S`: for the
Phase 1 `StateC = { N: number; S: number }` it clamps `N`. The detail of
*which* fields get clamped is part of the `S`-specific helpers
(`addScaled`, `combine`, `clampNonNeg`) and stays type-driven — Slice 1
implements concrete versions over `StateC`; later `ModelKind`s supply
their own.

## Consequences

**Positive.**

- 1.1.3 can verify the integrator algorithm against `f(x) = x` (and any
  other RHS with a known closed form) without going through `rhsC`. Bug
  attribution becomes mechanical: algorithm bugs surface in
  `integrator.test.ts`, model bugs in `model.test.ts`.
- Phase 2 extension to alternative `ModelKind`s (Option D widening,
  non-Turchin models per §13) reuses `rk4Step` unchanged; only the
  call site in `advanceTick` (or its per-kind cousins) needs a new RHS.
- Property-based tests on the integrator (see [Phase1PBT.md](../Phase1PBT.md))
  can use synthetic RHSs with known invariants (linear systems, harmonic
  oscillators) without needing to coax `rhsC` into those shapes.

**Negative.**

- One extra function-call indirection per RK4 step. The cost is
  negligible (~219k steps × 4 rhs calls / 600-yr run is still
  sub-100-ms in modern engines), but it is real.
- The already-committed 0.2.1 anchor (`logistic.analytic.test.ts` in
  `e9cbad9`) was written against the bound signature and will fail to
  compile against the new API. **It must be re-written in Slice 1.2.x**
  when `integrator.ts` lands — pass an `rhs = (st) => rhsC(st, params)`
  closure to `rk4Step` instead of the current `rk4Step(state, params, dt)`
  call. This is captured as part of Slice 1.2.x scope, not a separate
  task.
- The `clampNonNeg` and `addScaled` helpers need to be generic over `S`
  (or supplied per `ModelKind`). Slice 1.2.3 will implement concrete
  versions over `StateC`; the generic abstraction can be introduced
  later if/when a second `ModelKind` actually exists, per YAGNI.

**Neutral / Followups.**

- Does not supersede [ADR-0002](0002-hand-rolled-rk4-over-ode-library.md):
  the choice to hand-roll RK4 still holds; this ADR only refines the
  signature.
- The Phase1Design.md §5 code block is the only design-doc edit needed.
  §10 (file layout) is unchanged. §6 (replay) does not depend on the
  rk4Step signature.
- The `// TODO: supply` seam in §6.7 lands unchanged; the generic
  integrator does not affect how exogenous resupply would be modeled.

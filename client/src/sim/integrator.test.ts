import { describe, it, expect } from "vitest";
// Neither symbol exists yet — these imports will fail until Slice 1.2.x.
// That's the expected red state at Slice 1 step 1.1.4.
import { rk4Step, advanceTick } from "./integrator";

/**
 * Slice 1 step 1.1.3 — RK4 single-step + clamps.
 *
 * Three setups per [Phase1AutomatedTests.md](../../../docs/design/Phase1AutomatedTests.md)
 * 1.1.3:
 *
 *   A) Trivial RHS dN/dt = N: one RK4 step from N=1 with step h returns
 *      N · (1 + h + h²/2 + h³/6 + h⁴/24), i.e. the 4th-order Taylor sum
 *      of e^h (since RK4 reproduces Taylor to 4th order on a linear
 *      autonomous scalar ODE). Tests the algorithm in isolation, using
 *      the generic rhs parameter introduced in
 *      [Decision 0004](../../../docs/design/adr/0004-generic-rk4-integrator.md).
 *
 *   B) `N >= 0` clamp inside rk4Step: drive the unclamped result
 *      strongly negative with a forcing RHS; assert N comes back non-
 *      negative. Per [Phase1Design.md §4](../../../docs/design/Phase1Design.md)
 *      the clamp lives *inside* `rk4Step` (post-step, via
 *      `clampNonNeg`).
 *
 *   C) `S >= 0` manual reset *outside* rk4Step (around it, in
 *      `advanceTick`). Strict equality: the reset is `S = 0`, not
 *      `S = abs(S)` and not `S = max(S, ε)`. Tests through `advanceTick`
 *      because that's the API surface that hosts the reset per §4 and
 *      Decision 0004.
 *
 * Status at write time (Slice 1 red): expected to fail at *import* —
 * `./integrator` does not yet exist. Turns green at Slice 1.2.x.
 */

// Local types — shared workspace exports them in Slice 1.2.1.c.
type StateC = { N: number; S: number };
type ParamsC = { r: number; beta: number; c: number; s0: number };

const TOL = 1e-12;

describe("rk4Step — algorithm correctness against analytic RK4 (Setup A)", () => {
  // RHS: dN/dt = N, dS/dt = 0. Closed-form RK4 step:
  //   k1 = N
  //   k2 = N · (1 + h/2)
  //   k3 = N · (1 + h/2 + h²/4)
  //   k4 = N · (1 + h + h²/2 + h³/4)
  //   incr = h/6 · (k1 + 2k2 + 2k3 + k4)
  //        = N · (h + h²/2 + h³/6 + h⁴/24)
  //   N'   = N · (1 + h + h²/2 + h³/6 + h⁴/24)
  //
  // For N=1 this is the 4th-order Taylor expansion of e^h.
  const rhsLinearN = (s: StateC): StateC => ({ N: s.N, S: 0 });

  const taylor4 = (h: number) =>
    1 + h + (h * h) / 2 + (h * h * h) / 6 + (h * h * h * h) / 24;

  it.each([0.01, 0.1])("matches Taylor-4 of e^h to within 1e-12 (h=%s)", (h) => {
    const out = rk4Step({ N: 1, S: 0 }, h, rhsLinearN);
    const expected = taylor4(h);
    expect(Math.abs(out.N - expected)).toBeLessThan(TOL);
    // S stays at 0 — rhsLinearN returns dS/dt = 0 unconditionally.
    expect(out.S).toBe(0);
  });
});

describe("rk4Step — N >= 0 clamp inside the step (Setup B)", () => {
  // Constant forcing RHS: dN/dt = -100 (decoupled from S). One step of
  // size dt=1 from N=0.1 would, unclamped, give N = 0.1 + 1·(-100) = -99.9.
  // The clampNonNeg inside rk4Step must bring this back to >= 0.
  const rhsForceNegN = (_s: StateC): StateC => ({ N: -100, S: 0 });

  it("forcing rhsC-style RHS strongly negative is clamped to N >= 0 after one step", () => {
    const out = rk4Step({ N: 0.1, S: 0 }, 1, rhsForceNegN);
    expect(out.N).toBeGreaterThanOrEqual(0);
  });
});

describe("advanceTick — S >= 0 manual reset outside the step (Setup C)", () => {
  // Use rhsC via advanceTick (which binds rhsC under the hood per
  // Phase1Design §5 post-Decision 0004). Parameters chosen so dS/dt is
  // strongly negative immediately and S would overshoot below zero in
  // a single sub-step:
  //   At start: N=0.1, S=0.01, c=0 → k(S)=1 → production = 0.1·0.99 = 0.099
  //   dS/dt = 0.099 - beta·N = 0.099 - 10·0.1 = -0.901
  //   After one step of dt=0.1: ΔS ≈ -0.0901, so S → 0.01 - 0.0901 ≈ -0.08
  //   Reset must bring S to exactly 0.
  const p: ParamsC = { r: 0.02, beta: 10, c: 0, s0: 1 };

  it("S driven negative by one advanceTick sub-step is reset to exactly 0", () => {
    // tickYears == dtIntegYears so the inner loop runs exactly once.
    const out = advanceTick({ N: 0.1, S: 0.01 }, p, 0.1, 0.1);
    // Strict equality — the reset writes literal 0, not abs(S) or max(S,ε).
    expect(out.S).toBe(0);
    // N should not have been damaged: it grows slowly under §17-like
    // dynamics. Just sanity-check it's non-negative.
    expect(out.N).toBeGreaterThanOrEqual(0);
  });
});

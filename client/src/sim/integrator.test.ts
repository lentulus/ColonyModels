import { describe, it, expect } from "vitest";
import fc from "fast-check";
// Neither symbol exists yet — these imports will fail until Slice 1.2.x.
// That's the expected red state at Slice 1 step 1.1.4.
import { rk4Step, advanceTick } from "./integrator";
import { rhsC } from "./model";

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

/**
 * Slice 1.3.4e — Asserts properties P-I-1..P-I-6 for rk4Step and advanceTick.
 *
 * Properties per [Phase1PBT.md](../../../docs/design/Phase1PBT.md)
 * §"Properties — integrator". Phase1PBT.md tables don't supply explicit
 * generators for this section (only the table of properties); generators
 * below are derived from the model-section ranges and bounded for
 * physical sensibility.
 *
 * Convention (Phase1PBT.md §"Conventions"): properties live in the same
 * file as example-based tests, under a separate `describe("properties")`
 * block.
 *
 * Documented deviation — P-I-2 is written against `advanceTick`, not
 * `rk4Step`. The S>=0 manual reset lives in `advanceTick` per Phase1Design
 * §4 and [Decision 0004](../../../docs/design/adr/0004-generic-rk4-integrator.md);
 * a literal rk4Step-only assertion would fail on any input that pushes S
 * negative (rk4Step intentionally does not clamp S). The property's
 * underlying invariant — "manual reset upholds S non-negativity" — is
 * exercised correctly at the advanceTick boundary.
 */

// arbN lower bound 1e-100 to exclude IEEE-754 subnormals — see model.test.ts header.
const arbN = fc.double({ min: 1e-100, max: 5, noNaN: true });
const arbS = fc.double({ min: 0, max: 50, noNaN: true });
const arbR = fc.double({ min: 0.001, max: 0.5, noNaN: true });
const arbBeta = fc.double({ min: 0, max: 2, noNaN: true });
const arbC = fc.double({ min: 0, max: 10, noNaN: true });
const arbS0 = fc.double({ min: 0.01, max: 10, noNaN: true });
const arbState = fc.record({ N: arbN, S: arbS });
const arbParams = fc.record({ r: arbR, beta: arbBeta, c: arbC, s0: arbS0 });
// Integrator sub-step in [1/365.25, 1/10]: bounded inside daily-resolution
// regime where RK4 stays stable for the §17 parameter ranges.
const arbDt = fc.double({ min: 1 / 365.25, max: 0.1, noNaN: true });
// Tick horizon in [1/100 yr, 1 yr]: bracketed away from zero and one yr
// so advanceTick's nSteps = round(tick/dt) loop runs a meaningful count.
const arbTickYears = fc.double({ min: 0.01, max: 1, noNaN: true });

describe("rk4Step + advanceTick — Asserts properties", () => {
  it("P-I-1: rk4Step(s, dt, rhs).N >= 0 for all valid (s, p, dt) (clamp upholds N invariant)", () => {
    fc.assert(
      fc.property(arbState, arbParams, arbDt, (s, p, dt) => {
        const rhs = (st: StateC): StateC => rhsC(st, p);
        const out = rk4Step(s, dt, rhs);
        expect(out.N).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it("P-I-2: advanceTick(s, p, tick, dt).S >= 0 (manual reset upholds S invariant)", () => {
    // Deviation from doc — see file header. Underlying invariant tested.
    fc.assert(
      fc.property(arbState, arbParams, arbTickYears, arbDt, (s, p, tick, dt) => {
        const out = advanceTick(s, p, tick, dt);
        expect(out.S).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it("P-I-3: one full-dt step ≈ two half-dt steps within RK4's O(dt⁵) local error", () => {
    // For the linear RHS dN/dt = N, RK4 is exact through Taylor-4. The
    // residual between (full step) and (two half steps) is O(dt⁵).
    // Concrete bound for our parameter domain: ≤ 1e-10 at dt = 0.01,
    // which scales as dt⁵ — empirically 1e-9 is a generous fixed bound.
    const rhsLinearN = (st: StateC): StateC => ({ N: st.N, S: 0 });
    const dt = 0.01;
    fc.assert(
      fc.property(arbN, (N) => {
        const s = { N, S: 0 };
        const oneStep = rk4Step(s, dt, rhsLinearN);
        const halfA = rk4Step(s, dt / 2, rhsLinearN);
        const twoHalfSteps = rk4Step(halfA, dt / 2, rhsLinearN);
        // The closed-form solution is N · e^dt; both schemes agree on
        // Taylor terms up to dt⁴. Residual ~ N · dt⁵ / k where k is an
        // RK4-specific constant — bounded by 1e-9 for our N ∈ [0, 5].
        expect(Math.abs(oneStep.N - twoHalfSteps.N)).toBeLessThanOrEqual(1e-9);
      }),
    );
  });

  it("P-I-4: advanceTick is deterministic — two calls with identical inputs return identical outputs", () => {
    fc.assert(
      fc.property(arbState, arbParams, arbTickYears, arbDt, (s, p, tick, dt) => {
        const a = advanceTick(s, p, tick, dt);
        const b = advanceTick(s, p, tick, dt);
        expect(a.N).toBe(b.N);
        expect(a.S).toBe(b.S);
      }),
    );
  });

  it("P-I-5: advancing a fixed horizon in two halves equals advancing in one (composability)", () => {
    // Composability holds when both halves dispatch the same total number
    // of integrator sub-steps. To guarantee that, pick a fixed dt and a
    // total tick that's an even multiple of dt — then tick/2 is an
    // integer multiple of dt as well and the round() in advanceTick
    // doesn't split steps differently.
    const dt = 0.01;
    const tick = 0.1; // 10 sub-steps total, 5 + 5 if split.
    fc.assert(
      fc.property(arbState, arbParams, (s, p) => {
        const oneShot = advanceTick(s, p, tick, dt);
        const half1 = advanceTick(s, p, tick / 2, dt);
        const twoHalves = advanceTick(half1, p, tick / 2, dt);
        expect(Math.abs(oneShot.N - twoHalves.N)).toBeLessThanOrEqual(1e-9);
        expect(Math.abs(oneShot.S - twoHalves.S)).toBeLessThanOrEqual(1e-9);
      }),
    );
  });

  it("P-I-6: N=0 stays N=0 under advanceTick (no spontaneous resurrection)", () => {
    fc.assert(
      fc.property(arbS, arbParams, arbTickYears, arbDt, (S, p, tick, dt) => {
        const out = advanceTick({ N: 0, S }, p, tick, dt);
        // Zero-N is a fixed point of rhsC.N = r·N·(1 - N/k) (factor of N).
        // RK4 of a zero-N fixed point produces zero increments at each
        // stage; the N clamp doesn't have to act, but if it did it would
        // also pin N to 0.
        expect(out.N).toBe(0);
      }),
    );
  });
});

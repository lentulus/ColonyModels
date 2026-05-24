import { describe, it, expect } from "vitest";
// `rk4Step` doesn't exist yet — this import will fail until Slice 1.2.5.
// That's the expected red state at Slice 0.
import { rk4Step } from "./integrator";

/**
 * Slice 0 regression anchor — pure logistic vs analytic closed form.
 *
 * Verifies the RK4 integrator's numerical accuracy on a problem with a
 * known exact solution. Uses the production `rk4Step` with parameters
 * that reduce the Turchin Eq 7.4 system to pure logistic: setting c=0
 * makes k(S) = 1 (constant), and the S dynamics decouple from N. The
 * N component then follows dN/dt = r * N * (1 - N), which has the
 * standard closed-form sigmoid solution.
 *
 * If this drifts, the integrator is broken — the Turchin cycle anchor
 * (turchin.cycle.test.ts) and every downstream use of the integrator
 * depend on this being correct.
 *
 * Status at write time (Slice 0): expected to fail at *import* — the
 * integrator module does not yet exist. Turns green at Slice 1.2.5.
 */

// Local types — shared workspace exports them in Slice 1.
type StateC = { N: number; S: number };
type ParamsC = { r: number; beta: number; c: number; s0: number };

describe("logistic anchor — rk4Step vs analytic logistic (Turchin reduced via c=0)", () => {
  // With c=0, k(S) = 1 for all S → dN/dt = r * N * (1 - N) (pure logistic, K=1).
  // beta=0 lets S evolve passively; we only compare N.
  const params: ParamsC = { r: 0.05, beta: 0, c: 0, s0: 1 };
  const N0 = 0.01;
  const dt = 1 / 365.25; // 1 day in years
  const horizonYears = 200;

  // Closed-form solution for pure logistic with K=1.
  const analytic = (t: number) =>
    1 / (1 + ((1 - N0) / N0) * Math.exp(-params.r * t));

  it("matches analytic solution within 1e-6 at t = 50, 100, 150, 200 yr", () => {
    let state: StateC = { N: N0, S: 0 };
    let elapsed = 0;
    const sampleTimes = [50, 100, 150, 200];
    const samples = new Map<number, { actualT: number; observed: number }>();

    const nSteps = Math.round(horizonYears / dt);
    for (let i = 1; i <= nSteps; i++) {
      state = rk4Step(state, params, dt);
      elapsed = i * dt;
      for (const target of sampleTimes) {
        if (!samples.has(target) && elapsed >= target) {
          samples.set(target, { actualT: elapsed, observed: state.N });
        }
      }
    }

    for (const target of sampleTimes) {
      const sample = samples.get(target);
      expect(sample, `no sample taken for t=${target}`).toBeDefined();
      const { actualT, observed } = sample!;
      const expected = analytic(actualT);
      const error = Math.abs(observed - expected);
      expect(
        error,
        `at t≈${actualT.toFixed(4)} yr (target ${target}): ` +
          `rk4=${observed.toFixed(10)}, analytic=${expected.toFixed(10)}, ` +
          `|err|=${error.toExponential(3)}`,
      ).toBeLessThan(1e-6);
    }
  });
});

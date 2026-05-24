import { describe, it, expect } from "vitest";
// `rhsC` doesn't exist yet — this import will fail until Slice 1.2.x.
// That's the expected red state at Slice 1 step 1.1.4.
import { rhsC } from "./model";

/**
 * Slice 1 step 1.1.2 — `rhsC` algebra on hand-computed inputs.
 *
 * Verifies the Option-C right-hand side of Turchin Eq 7.4 produces the
 * correct (dN/dt, dS/dt) for three states that exercise different
 * regimes:
 *
 *   - Low N, S = 0           — tests the small-N production term.
 *   - Near k, S = 0          — tests the near-saturation factor (1 - N/k).
 *   - Mid N, S > 0           — tests the k(S) = 1 + c·S/(s0+S) formula
 *                              with a non-trivial S contribution.
 *
 * All expected values are hand-computed below; the arithmetic is shown
 * in the comments so a red-review reader can audit it without trusting
 * the implementation.
 *
 * Per [Phase1AutomatedTests.md](../../../docs/design/Phase1AutomatedTests.md)
 * 1.1.2 and [Phase1Design.md §4](../../../docs/design/Phase1Design.md).
 *
 * Status at write time (Slice 1 red): expected to fail at *import* —
 * `./model` does not yet exist. Turns green at Slice 1.2.x.
 */

// Local types — shared workspace exports them in Slice 1.2.1.c.
type StateC = { N: number; S: number };
type ParamsC = { r: number; beta: number; c: number; s0: number };

// §17 blank-run defaults (canonical).
const P: ParamsC = { r: 0.02, beta: 0.25, c: 3, s0: 1 };

const TOL = 1e-12;

describe("rhsC — Turchin Eq 7.4 (Option C), hand-computed cases", () => {
  it("Case 1 — Low N (N=0.01, S=0): low-N production regime", () => {
    // S/(s0+S) = 0/(1+0) = 0          → k(S) = 1 + 3·0 = 1
    // N/k     = 0.01/1 = 0.01         → (1 - N/k) = 0.99
    // production = 0.01 · 0.99       = 0.0099
    // dN = r · production = 0.02 · 0.0099 = 0.000198
    // dS = production - β·N = 0.0099 - 0.25·0.01 = 0.0099 - 0.0025 = 0.0074
    const s: StateC = { N: 0.01, S: 0 };
    const out = rhsC(s, P);
    expect(out.N).toBeCloseTo(0.000198, 12);
    expect(out.S).toBeCloseTo(0.0074, 12);
    // Sanity (strict): the rounded literals above ARE the exact products
    // for these finite-decimal inputs, modulo IEEE-754 representation.
    expect(Math.abs(out.N - 0.000198)).toBeLessThan(TOL);
    expect(Math.abs(out.S - 0.0074)).toBeLessThan(TOL);
  });

  it("Case 2 — Near k (N=0.99, S=0): saturation regime, dS goes negative", () => {
    // S/(s0+S) = 0                    → k(S) = 1
    // N/k     = 0.99                  → (1 - N/k) = 0.01
    // production = 0.99 · 0.01       = 0.0099
    // dN = 0.02 · 0.0099 = 0.000198
    // dS = 0.0099 - 0.25·0.99 = 0.0099 - 0.2475 = -0.2376
    const s: StateC = { N: 0.99, S: 0 };
    const out = rhsC(s, P);
    expect(Math.abs(out.N - 0.000198)).toBeLessThan(TOL);
    expect(Math.abs(out.S - -0.2376)).toBeLessThan(TOL);
    // Pin the sign explicitly — Case 2's diagnostic value is that dS < 0
    // when N is near k and S has nothing to subsidise expenditure.
    expect(out.S).toBeLessThan(0);
  });

  it("Case 3 — Mid N, S>0 (N=0.5, S=1): exercises k(S) = 1 + c·S/(s0+S)", () => {
    // S/(s0+S) = 1/(1+1) = 0.5        → k(S) = 1 + 3·0.5 = 2.5
    // N/k     = 0.5/2.5 = 0.2         → (1 - N/k) = 0.8
    // production = 0.5 · 0.8         = 0.4
    // dN = 0.02 · 0.4               = 0.008
    // dS = 0.4 - 0.25·0.5 = 0.4 - 0.125 = 0.275
    const s: StateC = { N: 0.5, S: 1 };
    const out = rhsC(s, P);
    expect(Math.abs(out.N - 0.008)).toBeLessThan(TOL);
    expect(Math.abs(out.S - 0.275)).toBeLessThan(TOL);
  });
});

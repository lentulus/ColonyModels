import { describe, it, expect } from "vitest";
import fc from "fast-check";
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

/**
 * Slice 1.3.4e — Asserts properties P-M-1..P-M-7 for `rhsC`.
 *
 * Properties per [Phase1PBT.md](../../../docs/design/Phase1PBT.md) §"Properties — model".
 * Generators verbatim from the same doc; default 100 runs/property.
 *
 * Convention (Phase1PBT.md §"Conventions"): properties live in the same
 * file as example-based tests, under a separate `describe("properties")`
 * block. Every property comment names the invariant in plain English.
 */

// Generators per Phase1PBT.md §"Properties — model". One deviation from
// the doc table's verbatim `min: 0`: arbN lower bound is 1e-100 rather
// than 0, to exclude IEEE-754 subnormals where `r · N` can underflow to
// exact zero even though the math says `> 0`. Subnormal N values
// (≤ ~1e-308) are below any physically meaningful colony scale —
// even at peoplePerUnit = 10^308 that's < 1 settler — so excluding them
// preserves Phase1PBT.md §"Conventions" intent that generators stay in
// the "physically meaningful" range. P-M-1 explicitly tests N = 0 with
// a hardcoded state, so the generator's lower bound doesn't affect it.
const arbN = fc.double({ min: 1e-100, max: 5, noNaN: true });
const arbS = fc.double({ min: 0, max: 50, noNaN: true });
const arbR = fc.double({ min: 0.001, max: 0.5, noNaN: true });
const arbBeta = fc.double({ min: 0, max: 2, noNaN: true });
const arbC = fc.double({ min: 0, max: 10, noNaN: true });
const arbS0 = fc.double({ min: 0.01, max: 10, noNaN: true });
const arbState = fc.record({ N: arbN, S: arbS });
const arbParams = fc.record({ r: arbR, beta: arbBeta, c: arbC, s0: arbS0 });

// k(S, p) — k is not exported from model.ts (lives inline inside rhsC),
// so we replicate the formula locally for property assertions that need
// it. Single source of truth is the inline form in rhsC.
function kFn(S: number, p: ParamsC): number {
  return 1 + p.c * (S / (p.s0 + S));
}

describe("rhsC — Asserts properties", () => {
  it("P-M-1: at N=0, dN/dt >= 0 (population cannot go negative spontaneously)", () => {
    fc.assert(
      fc.property(arbS, arbParams, (S, p) => {
        const out = rhsC({ N: 0, S }, p);
        expect(out.N).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it("P-M-2: below carrying capacity (0 < N < k(S, p)), dN/dt > 0", () => {
    fc.assert(
      fc.property(arbState, arbParams, ({ N, S }, p) => {
        const k = kFn(S, p);
        fc.pre(N > 0 && N < k);
        const out = rhsC({ N, S }, p);
        expect(out.N).toBeGreaterThan(0);
      }),
    );
  });

  it("P-M-3: above carrying capacity (N > k(S, p)), dN/dt < 0", () => {
    fc.assert(
      fc.property(arbState, arbParams, ({ N, S }, p) => {
        const k = kFn(S, p);
        // r > 0 is guaranteed by arbR's lower bound 0.001.
        fc.pre(N > k);
        const out = rhsC({ N, S }, p);
        expect(out.N).toBeLessThan(0);
      }),
    );
  });

  it("P-M-4: at carrying capacity (N = k(S, p)), dN/dt ≈ 0 within 1e-9", () => {
    fc.assert(
      fc.property(arbS, arbParams, (S, p) => {
        const N = kFn(S, p);
        const out = rhsC({ N, S }, p);
        // (1 - N/k) is computed numerically and won't be exactly zero
        // for all generated p, so allow 1e-9 IEEE-754 slack per the
        // Phase1PBT.md P-M-4 spec.
        expect(Math.abs(out.N)).toBeLessThanOrEqual(1e-9);
      }),
    );
  });

  it("P-M-5: k(S, p) is monotonically non-decreasing in S", () => {
    fc.assert(
      fc.property(arbS, arbS, arbParams, (S1, S2, p) => {
        const lo = Math.min(S1, S2);
        const hi = Math.max(S1, S2);
        expect(kFn(lo, p)).toBeLessThanOrEqual(kFn(hi, p));
      }),
    );
  });

  it("P-M-6: k(0, p) === 1 (base carrying capacity is the scaling convention)", () => {
    fc.assert(
      fc.property(arbParams, (p) => {
        // arbS0's min = 0.01 ensures s0 > 0; k(0) = 1 + c·0/(s0+0) = 1 exactly.
        expect(kFn(0, p)).toBe(1);
      }),
    );
  });

  it("P-M-7: rhsC returns finite (non-NaN, non-Infinity) numbers for all valid inputs", () => {
    fc.assert(
      fc.property(arbState, arbParams, (s, p) => {
        const out = rhsC(s, p);
        expect(Number.isFinite(out.N)).toBe(true);
        expect(Number.isFinite(out.S)).toBe(true);
      }),
    );
  });
});

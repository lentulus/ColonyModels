import { describe, it, expect } from "vitest";
// `replayTo` doesn't exist yet — this import will fail until Slice 2.2.3.
// That's the expected red state at Slice 0.
import { replayTo } from "./replay";

/**
 * Slice 0 regression anchor — §17 BLANK_RUN defaults produce Turchin's
 * deterministic single excursion.
 *
 * Verifies the full integrator + replay pipeline against Turchin's
 * cited behaviour: with r = 0.02 yr⁻¹, β = 0.25, c = 3, s₀ = 10,
 * N₀ = 0.5, S₀ = 0 the model runs **one** boom-and-bust excursion of
 * ~2-3 centuries (Historical Dynamics §7.2.1 prose p.123, Fig 7.1
 * caption p.124), then settles to the stateless equilibrium
 * (N = k₀ = 1, S = 0). Recurring cycles (Turchin Fig 7.2) require
 * stochastic forcing, which the Phase 1 deterministic model does not
 * implement.
 *
 * Assertions (Slice 2.2.0 amendment shape):
 *   1. Exactly one N-peak in the horizon, landing in [180, 280] yr
 *      (peak at t ≈ 227 yr per Phase1MathDerivations §3.5/§5).
 *   2. By t = 500 yr (well past the peak), N is within 5% of k₀ = 1.
 *   3. Final 100 yr non-increasing — asymptotic settling, no late
 *      oscillation (consistent with the single-excursion derivation
 *      in Phase1MathDerivations §3.3).
 *   4. Sanity: 0 < final N ≤ 1.5 (no extinction, no runaway).
 *
 * Loose tolerances on purpose — the goal is "single excursion + settle,"
 * not "matches Turchin's figure to three decimal places."
 *
 * Status (Slice 2.2.0 amendment, 2026-05-26): expected to fail at
 * *import* — the replay module does not yet exist. Turns green at
 * Slice 2.2.3 when `replayTo` lands.
 */

const SECS_PER_YEAR = 31_556_952;

// Local types — shared workspace exports them in Slice 1.
type StateC = { N: number; S: number };
type ParamsC = { r: number; beta: number; c: number; s0: number };
type Run = {
  id: string;
  name: string;
  modelKind: "C-basic-demfisc";
  t0Epoch: number;
  tickSeconds: number;
  peoplePerUnit: number;
  initialState: StateC;
  initialParams: ParamsC;
  createdAt: number;
};
type Event = never;
type Snapshot = { tEpoch: number; state: StateC };

// §17 BLANK_RUN — kept in sync with Phase1Design.md §17 (Turchin Fig 7.1
// / §7.2.1 verbatim: r = 0.02, β = 0.25, c = 3, s₀ = 10, N₀ = k₀/2 = 0.5,
// S₀ = 0).
const BLANK_RUN: Run = {
  id: "anchor",
  name: "turchin-cycle-anchor",
  modelKind: "C-basic-demfisc",
  t0Epoch: 10_413_792_000, // 2300-01-01 UTC
  tickSeconds: 2_629_746, // 1 month
  peoplePerUnit: 1000,
  initialState: { N: 0.5, S: 0.0 },
  initialParams: { r: 0.02, beta: 0.25, c: 3, s0: 10 },
  createdAt: 0,
};

describe("turchin cycle anchor — §17 defaults produce a single deterministic excursion", () => {
  it("exactly 1 peak in [180, 280] yr; N settles within 5% of k₀ by 500 yr; tail non-increasing; no blow-up", () => {
    const horizonYears = 600;
    const targetEpoch = BLANK_RUN.t0Epoch + horizonYears * SECS_PER_YEAR;
    const snapshots: Snapshot[] = replayTo(BLANK_RUN, [] as Event[], targetEpoch);

    // Convert each snapshot's tEpoch to years since t0.
    const series = snapshots.map((snap) => ({
      tYears: (snap.tEpoch - BLANK_RUN.t0Epoch) / SECS_PER_YEAR,
      N: snap.state.N,
      S: snap.state.S,
    }));

    expect(series.length, "replay returned no snapshots").toBeGreaterThan(10);
    expect(series[0].tYears).toBeCloseTo(0, 5);
    expect(series[series.length - 1].tYears).toBeGreaterThanOrEqual(horizonYears - 1);

    // Find local extrema in N.
    type Extremum = { kind: "peak" | "trough"; tYears: number; N: number };
    const extrema: Extremum[] = [];
    for (let i = 1; i < series.length - 1; i++) {
      const prev = series[i - 1].N;
      const curr = series[i].N;
      const next = series[i + 1].N;
      if (curr > prev && curr > next) {
        extrema.push({ kind: "peak", tYears: series[i].tYears, N: curr });
      }
      if (curr < prev && curr < next) {
        extrema.push({ kind: "trough", tYears: series[i].tYears, N: curr });
      }
    }

    const firstPeak = extrema.find((e) => e.kind === "peak");
    expect(firstPeak, "no local maximum of N found in 600-yr run").toBeDefined();
    expect(
      firstPeak!.tYears,
      `first peak at ${firstPeak!.tYears.toFixed(1)} yr — outside [180, 280]`,
    ).toBeGreaterThanOrEqual(180);
    expect(firstPeak!.tYears).toBeLessThanOrEqual(280);

    // Single-excursion behavior per Phase1Design §17: exactly one local N-peak
    // in the horizon. Recurring cycles (Turchin Fig 7.2) require stochastic
    // forcing, which the deterministic model does not exhibit — Turchin p.123:
    // "in a deterministic world, once the state collapses, it cannot arise
    // again" (also Phase1MathDerivations §3.3).
    const peakCount = extrema.filter((e) => e.kind === "peak").length;
    expect(
      peakCount,
      `expected exactly 1 N-peak in ${horizonYears} yr; found ${peakCount}`,
    ).toBe(1);

    // Settling: by t = 500 yr (well past the peak at t ≈ 227 yr), N has
    // returned close to the stateless equilibrium k₀ = 1. Tolerance of 5%
    // keeps the assertion meaningful without coupling to exact numerics.
    const t500Idx = series.findIndex((s) => s.tYears >= 500);
    expect(t500Idx, "horizon too short to verify settling at t=500yr").toBeGreaterThan(-1);
    const nAt500 = series[t500Idx].N;
    expect(
      Math.abs(nAt500 - 1),
      `N at t=500yr (${nAt500.toFixed(4)}) > 5% from k₀=1 — did not settle`,
    ).toBeLessThan(0.05);

    // Final 100 yr non-increasing — asymptotic approach to k₀ with no
    // late oscillation (consistent with the "exactly 1 peak" finding above).
    const tailStart = series.findIndex((s) => s.tYears >= horizonYears - 100);
    for (let i = tailStart + 1; i < series.length; i++) {
      expect(
        series[i].N,
        `N rose between t=${series[i - 1].tYears.toFixed(1)} and t=${series[i].tYears.toFixed(1)} yr — late oscillation`,
      ).toBeLessThanOrEqual(series[i - 1].N);
    }

    const finalN = series[series.length - 1].N;
    expect(finalN, "final N non-positive (extinction or numerical blow-up)").toBeGreaterThan(0);
    expect(finalN, "final N > 1.5 — runaway").toBeLessThanOrEqual(1.5);
  });
});

import { describe, it, expect } from "vitest";
// `replayTo` doesn't exist yet — this import will fail until Slice 2.2.3.
// That's the expected red state at Slice 0.
import { replayTo } from "./replay";

/**
 * Slice 0 regression anchor — §17 BLANK_RUN defaults produce Turchin's
 * secular cycle in the expected period band.
 *
 * Verifies the full integrator + replay pipeline against Turchin's
 * cited behaviour: with r = 0.02 yr⁻¹, β = 0.25, c = 3, s₀ = 10,
 * N₀ = 0.5, S₀ = 0 the model runs one boom-and-bust excursion of
 * ~2-3 centuries (Historical Dynamics §7.2.1 prose p.123, Fig 7.1
 * caption p.124). With §17 at Turchin verbatim the actual N-peak
 * lands at t ≈ 227 yr; the [180, 280] yr window matches the bound
 * derived in Phase1MathDerivations §3.5/§5.
 *
 * Loose tolerances on purpose — the goal is "secular cycle appears,"
 * not "matches Turchin's figure to three decimal places."
 *
 * Status (Slice 2.1.0 amendment, 2026-05-26): expected to fail at
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

describe("turchin cycle anchor — §17 defaults produce a secular cycle", () => {
  it("first peak in [180, 280] yr; next trough at least 100 yr later; no blow-up", () => {
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

    const firstPeakIdx = extrema.indexOf(firstPeak!);
    const nextTrough = extrema
      .slice(firstPeakIdx + 1)
      .find((e) => e.kind === "trough");
    expect(nextTrough, "no local minimum after the first peak").toBeDefined();
    const period = nextTrough!.tYears - firstPeak!.tYears;
    expect(
      period,
      `peak → trough interval ${period.toFixed(1)} yr — expected ≥ 100`,
    ).toBeGreaterThanOrEqual(100);

    const finalN = series[series.length - 1].N;
    expect(finalN, "final N non-positive (extinction or numerical blow-up)").toBeGreaterThan(0);
    expect(finalN, "final N > 1.5 — runaway").toBeLessThanOrEqual(1.5);
  });
});

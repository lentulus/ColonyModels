import { describe, it, expect } from "vitest";
import type { StateC, ParamsC } from "@colonymodels/shared";
import { advanceTick } from "./integrator";

/**
 * Slice 1.3.4b — math-correctness verification of the basic
 * demographic-fiscal model (Turchin Eq 7.4) with Phase1Design §17
 * "blank run" defaults, integrated over 1000 yr.
 *
 * Each assertion is grounded in Phase1MathDerivations.md §3.x, which in
 * turn cites Turchin, Historical Dynamics (Princeton, 2003) Ch. 7.
 *
 * Distinct from the Slice 0 anchor turchin.cycle.test.ts, which gates on
 * the (not-yet-existing) replay module from Slice 2; this test exercises
 * advanceTick directly so it can pass now and lock the math behavior
 * before Slice 1 commits green.
 */

const PARAMS: ParamsC = { r: 0.02, beta: 0.25, c: 3, s0: 10 };
const INITIAL: StateC = { N: 0.5, S: 0.0 };
const HORIZON_YEARS = 1000;
const TICK_YEARS = 1;
const DT_INTEG = 1 / 365.25;

type Sample = { t: number; N: number; S: number };

function simulate(): Sample[] {
  const series: Sample[] = [{ t: 0, N: INITIAL.N, S: INITIAL.S }];
  let state: StateC = INITIAL;
  for (let t = 1; t <= HORIZON_YEARS; t++) {
    state = advanceTick(state, PARAMS, TICK_YEARS, DT_INTEG);
    series.push({ t, N: state.N, S: state.S });
  }
  return series;
}

type Extremum = { kind: "peak" | "trough"; t: number; value: number };

function localExtrema(series: Sample[], key: "N" | "S"): Extremum[] {
  const out: Extremum[] = [];
  for (let i = 1; i < series.length - 1; i++) {
    const a = series[i - 1][key];
    const b = series[i][key];
    const c = series[i + 1][key];
    if (b > a && b > c) out.push({ kind: "peak", t: series[i].t, value: b });
    if (b < a && b < c) out.push({ kind: "trough", t: series[i].t, value: b });
  }
  return out;
}

describe("basic demographic-fiscal model — §17 defaults over 1000 yr", () => {
  const series = simulate();
  const Npeaks = localExtrema(series, "N").filter((e) => e.kind === "peak");
  const Speaks = localExtrema(series, "S").filter((e) => e.kind === "peak");
  const finalSample = series[series.length - 1];
  const Nmin = Math.min(...series.map((s) => s.N));
  const Smin = Math.min(...series.map((s) => s.S));
  const kSeries = series.map((s) => 1 + PARAMS.c * (s.S / (PARAMS.s0 + s.S)));
  const kMax = Math.max(...kSeries);

  it("settles to the stateless equilibrium (N → k₀ = 1, S → 0) by t = 1000 yr", () => {
    // Phase1MathDerivations §3.1 — Turchin p.123 "The equilibrium N = k₀ and S = 0 is locally stable."
    expect(finalSample.t).toBe(HORIZON_YEARS);
    expect(finalSample.N).toBeGreaterThan(0.99);
    expect(finalSample.N).toBeLessThan(1.01);
    expect(finalSample.S).toBe(0); // exact: hits the manual clamp.
  });

  it("produces exactly one N-peak over [1, 999] yr (deterministic single excursion)", () => {
    // Phase1MathDerivations §3.3 — Turchin p.123 "in a deterministic world, once the
    // state collapses, it cannot arise again." Reinforced p.131.
    expect(
      Npeaks.length,
      `expected exactly 1 N-peak; got ${Npeaks.length} at t=${Npeaks.map((p) => p.t).join(", ")}`,
    ).toBe(1);
  });

  it("N-peak lands in [200, 260] yr — matches Turchin Fig 7.1a peak at ~225 yr", () => {
    // Phase1MathDerivations §3.5 — Turchin p.126 "For this estimate of r [0.02], the
    // model predicts oscillations of 2-3 centuries in duration."  Fig 7.1a (p.124)
    // shows the N-peak at t ≈ 225 yr; tolerance ±30 yr around that.
    const peak = Npeaks[0];
    expect(peak.t).toBeGreaterThanOrEqual(200);
    expect(peak.t).toBeLessThanOrEqual(260);
  });

  it("N-peak amplitude lies in [2.8, 3.6) — matches Turchin Fig 7.1a peak height", () => {
    // Phase1MathDerivations §3.6 — Turchin Eq 7.3 (p.122): k(S) ≤ 1 + c = 4.
    // Fig 7.1a (p.124) shows the N-peak between k₀ = 1 and k_max = 4; ±0.4 around
    // the observed amplitude of 3.13 with these params.
    const peak = Npeaks[0];
    expect(peak.value).toBeGreaterThanOrEqual(2.8);
    expect(peak.value).toBeLessThan(3.6);
  });

  it("S peaks before N peaks (revenues outpace expenditure during growth phase)", () => {
    // Phase1MathDerivations §3.4 — Turchin p.123 "growth in state expenditures lags
    // the revenues, and the state's surplus accumulates."  Fig 7.1a (p.124).
    expect(Speaks.length, "expected at least one S-peak").toBeGreaterThanOrEqual(1);
    const firstSpeakT = Speaks[0].t;
    const firstNpeakT = Npeaks[0].t;
    expect(
      firstSpeakT,
      `S-peak (t=${firstSpeakT}) must strictly precede N-peak (t=${firstNpeakT})`,
    ).toBeLessThan(firstNpeakT);
  });

  it("k(S) stays inside [1, 1+c) with the excursion driving k_max ∈ [3.0, 3.7)", () => {
    // Phase1MathDerivations §3.2 — Eq 7.3 construction bounds k(S) in [1, 1+c) = [1, 4).
    // Observed k_max with §17 defaults: 3.49.  Tolerance allows ±0.2 around that.
    expect(kMax).toBeGreaterThanOrEqual(3.0);
    expect(kMax).toBeLessThan(3.7);
  });

  it("respects the non-negativity clamps on N and S throughout the horizon", () => {
    // Phase1MathDerivations §3.7 — Turchin p.123 (S ≥ 0) + Phase1Design §4 (N ≥ 0).
    expect(Nmin).toBeGreaterThanOrEqual(0);
    expect(Smin).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(finalSample.N)).toBe(true);
    expect(Number.isFinite(finalSample.S)).toBe(true);
  });
});

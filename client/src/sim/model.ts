import type { StateC, ParamsC } from "@colonymodels/shared";

// Turchin Eq 7.4 (Historical Dynamics, 2003), scaled per Phase1Design §4.
// Pure function — no time-dependence beyond state.
export function rhsC(s: StateC, p: ParamsC): StateC {
  const kS = 1 + p.c * (s.S / (p.s0 + s.S));
  const production = s.N * (1 - s.N / kS);
  return {
    N: p.r * production,
    // TODO: supply — exogenous resupply hook (Phase1Design §6.7).
    // When that lands: `S: production - p.beta * s.N + resupplyRate`.
    S: production - p.beta * s.N,
  };
}

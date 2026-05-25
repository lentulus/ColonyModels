import type { StateC, ParamsC } from "@colonymodels/shared";
import { rhsC } from "./model";

// RK4 per Phase1Design §5 and Decision 0004 (generic in S, decoupled from rhsC).
// The N ≥ 0 clamp lives inside the step (post-step via clampNonNeg per §4).
// The S ≥ 0 manual reset lives outside, in advanceTick — Turchin §7.2.1
// "state cannot go into debt" — applied between rk4Step calls.
//
// S is constrained to extend StateC so the {N, S} field-wise helpers below
// type-check. A future ModelKind that widens the state shape supplies its own
// integrator (per Decision 0004 "Negative / Followups").

function addScaled<S extends StateC>(s: S, k: S, scale: number): S {
  return { ...s, N: s.N + k.N * scale, S: s.S + k.S * scale };
}

function combine<S extends StateC>(k1: S, k2: S, k3: S, k4: S): S {
  return {
    ...k1,
    N: (k1.N + 2 * k2.N + 2 * k3.N + k4.N) / 6,
    S: (k1.S + 2 * k2.S + 2 * k3.S + k4.S) / 6,
  };
}

function clampNonNeg<S extends StateC>(s: S): S {
  return s.N >= 0 ? s : { ...s, N: 0 };
}

export function rk4Step<S extends StateC>(
  s: S,
  dt: number,
  rhs: (s: S) => S,
): S {
  const k1 = rhs(s);
  const k2 = rhs(addScaled(s, k1, dt / 2));
  const k3 = rhs(addScaled(s, k2, dt / 2));
  const k4 = rhs(addScaled(s, k3, dt));
  const incr = combine(k1, k2, k3, k4);
  return clampNonNeg(addScaled(s, incr, dt));
}

export function advanceTick(
  s: StateC,
  p: ParamsC,
  tickYears: number,
  dtIntegYears: number,
): StateC {
  const nSteps = Math.round(tickYears / dtIntegYears);
  const rhs = (st: StateC): StateC => rhsC(st, p);
  let cur = s;
  for (let i = 0; i < nSteps; i++) {
    cur = rk4Step(cur, dtIntegYears, rhs);
    if (cur.S < 0) cur = { ...cur, S: 0 };
  }
  return cur;
}

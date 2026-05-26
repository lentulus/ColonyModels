import type { Event, ParamsC, Run, Snapshot, StateC } from "@colonymodels/shared";
import { advanceTick } from "./integrator";

// Replay engine per Phase1Design §6.
//
// Pure functions of (run, events, target). No internal cache — callers
// maintain their own snapshot cache per §6.5.
//
// `paramsAt` walks the (tEpoch-sorted) event list to produce the active
// parameters at any cursor. `replayTo` simulates from t0 to a target epoch,
// never integrating across an event boundary: parameter changes are honoured
// exactly when they happen, not at the next UI-tick boundary. Snapshots land
// **only** on UI-tick boundaries — mid-tick states are transient.
//
// Branching (§6.4) is left to the caller: rewind = filter events on tEpoch,
// then `replayTo` with the new event list. No dedicated helper — the array
// primitives are clearer than wrapping a one-liner.

const SECS_PER_YEAR = 31_556_952;
const DT_INTEG_YEARS = 1 / 365.25; // daily sub-step per §5

export function paramsAt(run: Run, events: Event[], tEpoch: number): ParamsC {
  const p: ParamsC = { ...run.initialParams };
  for (const e of events) {
    if (e.tEpoch > tEpoch) break;
    if (e.kind === "param-set") p[e.param] = e.value;
  }
  return p;
}

export function replayTo(
  run: Run,
  events: Event[],
  targetEpoch: number,
): Snapshot[] {
  const tickSec = run.tickSeconds;

  let state: StateC = run.initialState;
  let tEpoch = run.t0Epoch;
  const p: ParamsC = { ...run.initialParams };
  const out: Snapshot[] = [{ tEpoch, state }];

  let eventIdx = 0;
  while (tEpoch < targetEpoch) {
    const nextTickEpoch = tEpoch + tickSec;

    // Apply any events landing at-or-before the next tick boundary. Each event
    // splits the tick: integrate to the event time with the current params,
    // apply the event, then continue.
    while (
      eventIdx < events.length &&
      events[eventIdx].tEpoch <= nextTickEpoch
    ) {
      const e = events[eventIdx++];
      const partialYears = (e.tEpoch - tEpoch) / SECS_PER_YEAR;
      if (partialYears > 0) {
        state = advanceTick(state, p, partialYears, DT_INTEG_YEARS);
      }
      tEpoch = e.tEpoch;
      if (e.kind === "param-set") {
        p[e.param] = e.value;
      } else if (e.kind === "state-poke") {
        state = { ...state, ...e.patch };
      }
      // `stop` is a UI-loop signal (§8.2), not a replay-side effect.
    }

    // Finish the tick (no-op if an event landed exactly on the boundary).
    const remainingYears = (nextTickEpoch - tEpoch) / SECS_PER_YEAR;
    if (remainingYears > 0) {
      state = advanceTick(state, p, remainingYears, DT_INTEG_YEARS);
    }
    tEpoch = nextTickEpoch;
    out.push({ tEpoch, state });
  }

  return out;
}

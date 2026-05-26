import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { paramsAt, replayTo } from "./replay";
import type { Event, Run } from "@colonymodels/shared";

/**
 * Slice 2 step 2.1.1 — Replay engine: paramsAt, determinism, branching, mid-tick.
 *
 * Six sub-cases per
 * [Phase1AutomatedTests.md §2.1.1](../../../docs/design/Phase1AutomatedTests.md):
 *
 *   - paramsAt-empty: events = [] → paramsAt returns initialParams unchanged.
 *   - paramsAt-one: one param-set at t0 + 50yr → before/at/after correct values.
 *   - paramsAt-many: three param-sets on the same param → latest-before-cursor wins.
 *   - determinism: same (run, events) → two replays deep-equal.
 *   - branch-divergence: drop-after-T then append a different value → trajectory
 *     differs past T by > 1e-3.
 *   - mid-tick-event: event at 1.5 ticks lands at the event time, not the next
 *     tick boundary — the snapshot at tick 2 must differ from the boundary case
 *     (event at exactly 2.0 ticks).
 *
 * Per [Phase1Design.md §6](../../../docs/design/Phase1Design.md), `replayTo`
 * never integrates across an event: parameter changes are honoured exactly when
 * they happen. Snapshots land **only** on UI-tick boundaries.
 *
 * Status at write time (Slice 2 red): expected to fail at *import* —
 * `./replay` does not yet exist. Turns green at Slice 2.2.3.
 */

const SECS_PER_YEAR = 31_556_952;

// §17 BLANK_RUN — kept in sync with Phase1Design.md §17 (Turchin Fig 7.1
// / §7.2.1 verbatim: r = 0.02, β = 0.25, c = 3, s₀ = 10, N₀ = 0.5, S₀ = 0).
// Local helper so each test can take an overrides patch.
function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: "replay-test",
    name: "replay-test-run",
    modelKind: "C-basic-demfisc",
    t0Epoch: 10_413_792_000, // 2300-01-01 UTC
    tickSeconds: 2_629_746, // 1 month
    peoplePerUnit: 1000,
    initialState: { N: 0.5, S: 0.0 },
    initialParams: { r: 0.02, beta: 0.25, c: 3, s0: 10 },
    createdAt: 0,
    ...overrides,
  };
}

describe("paramsAt — active parameters at any t", () => {
  it("paramsAt-empty: with no events, returns initialParams unchanged", () => {
    const run = makeRun();
    const cursor = run.t0Epoch + 100 * SECS_PER_YEAR;
    expect(paramsAt(run, [], cursor)).toEqual(run.initialParams);
  });

  it("paramsAt-one: returns initial before event, new value at and after event", () => {
    const run = makeRun();
    const eventEpoch = run.t0Epoch + 50 * SECS_PER_YEAR;
    const events: Event[] = [
      { kind: "param-set", tEpoch: eventEpoch, param: "r", value: 0.05 },
    ];

    // Before the event → still initial r.
    expect(paramsAt(run, events, eventEpoch - 1).r).toBe(0.02);
    // At the event boundary → event applies (per §6.1: loop breaks on `>`, so
    // `==` passes through and the event is applied).
    expect(paramsAt(run, events, eventEpoch).r).toBe(0.05);
    // After the event → new value persists.
    expect(paramsAt(run, events, eventEpoch + SECS_PER_YEAR).r).toBe(0.05);
    // Untouched params remain at initial values.
    expect(paramsAt(run, events, eventEpoch + SECS_PER_YEAR).beta).toBe(0.25);
  });

  it("paramsAt-many: three param-sets on the same param → latest-before-cursor wins", () => {
    const run = makeRun();
    const t50 = run.t0Epoch + 50 * SECS_PER_YEAR;
    const t100 = run.t0Epoch + 100 * SECS_PER_YEAR;
    const t150 = run.t0Epoch + 150 * SECS_PER_YEAR;
    const events: Event[] = [
      { kind: "param-set", tEpoch: t50, param: "r", value: 0.03 },
      { kind: "param-set", tEpoch: t100, param: "r", value: 0.04 },
      { kind: "param-set", tEpoch: t150, param: "r", value: 0.05 },
    ];

    // Cursor between t50 and t100 → latest applied is the t50 event.
    expect(paramsAt(run, events, t50 + 10 * SECS_PER_YEAR).r).toBe(0.03);
    // Cursor between t100 and t150 → latest applied is the t100 event.
    expect(paramsAt(run, events, t100 + 10 * SECS_PER_YEAR).r).toBe(0.04);
    // Cursor past t150 → latest applied is the t150 event.
    expect(paramsAt(run, events, t150 + 10 * SECS_PER_YEAR).r).toBe(0.05);
    // Exactly at t100 → t100 applies (boundary inclusive per §6.1).
    expect(paramsAt(run, events, t100).r).toBe(0.04);
  });
});

describe("replayTo — determinism, branching, mid-tick", () => {
  it("determinism: same (run, events) → two replays deep-equal", () => {
    const run = makeRun();
    const events: Event[] = [
      {
        kind: "param-set",
        tEpoch: run.t0Epoch + 30 * SECS_PER_YEAR,
        param: "r",
        value: 0.04,
      },
      {
        kind: "param-set",
        tEpoch: run.t0Epoch + 80 * SECS_PER_YEAR,
        param: "beta",
        value: 0.3,
      },
    ];
    const target = run.t0Epoch + 200 * SECS_PER_YEAR;
    const a = replayTo(run, events, target);
    const b = replayTo(run, events, target);
    expect(a).toEqual(b);
    // Sanity: replays actually produced snapshots (not empty).
    expect(a.length).toBeGreaterThan(10);
  });

  it("branch-divergence: drop-after-T and append a different value → trajectory differs past T by > 1e-3", () => {
    const run = makeRun();
    const T = run.t0Epoch + 100 * SECS_PER_YEAR;

    // Original timeline: one param-set before T (kept on branching), one after T
    // (would be dropped on branching).
    const originalEvents: Event[] = [
      { kind: "param-set", tEpoch: T - 30 * SECS_PER_YEAR, param: "r", value: 0.04 },
      { kind: "param-set", tEpoch: T + 30 * SECS_PER_YEAR, param: "beta", value: 0.4 },
    ];

    // Branched timeline at T: drop events with tEpoch > T, append a different
    // param value at T (sharp slowdown to make the divergence unambiguous).
    const branchedEvents: Event[] = [
      ...originalEvents.filter((e) => e.tEpoch <= T),
      { kind: "param-set", tEpoch: T, param: "r", value: 0.005 },
    ];

    const target = T + 100 * SECS_PER_YEAR; // 100 yr post-divergence
    const original = replayTo(run, originalEvents, target);
    const branched = replayTo(run, branchedEvents, target);

    // Same number of snapshots (snapshots are tick-boundary-only; both replays
    // share the same tick grid).
    expect(branched.length).toBe(original.length);

    // Snapshots strictly before T are byte-equal — the event lists agree on
    // [t0, T), so the integration must too.
    for (let i = 0; i < original.length; i++) {
      if (original[i].tEpoch >= T) break;
      expect(branched[i]).toEqual(original[i]);
    }

    // Final snapshot diverges meaningfully.
    const dN = Math.abs(
      original[original.length - 1].state.N -
        branched[branched.length - 1].state.N,
    );
    expect(dN, `final N differs by ${dN} — expected > 1e-3`).toBeGreaterThan(
      1e-3,
    );
  });

  it("mid-tick-event: event at 1.5 ticks ≠ same event at 2.0 ticks (next tick boundary)", () => {
    // Per §6.2, an event applied mid-tick splits the integration: partial-tick
    // with old params → apply event → continue partial-tick with new params →
    // record the next UI-tick snapshot. If `replayTo` deferred the event to the
    // next tick boundary, the snapshot at tick 2 would match the boundary case.
    //
    // Setup: identical (run, target). Two event lists differing only in event
    // time — one at 1.5 ticks, one at exactly 2.0 ticks (the boundary). Same
    // event payload: `param-set r=0` (kills growth). At snapshot index 2 the
    // mid-tick variant has had half a tick with r=0, while the boundary variant
    // has had a full tick at r=0.02 before the event takes effect.
    const run = makeRun();
    const tickSec = run.tickSeconds;
    const midTickEpoch = run.t0Epoch + Math.floor(1.5 * tickSec);
    const boundaryEpoch = run.t0Epoch + 2 * tickSec;

    const midTickEvents: Event[] = [
      { kind: "param-set", tEpoch: midTickEpoch, param: "r", value: 0 },
    ];
    const boundaryEvents: Event[] = [
      { kind: "param-set", tEpoch: boundaryEpoch, param: "r", value: 0 },
    ];

    const target = run.t0Epoch + 5 * tickSec;
    const midTick = replayTo(run, midTickEvents, target);
    const boundary = replayTo(run, boundaryEvents, target);

    // Both replays share the same tick grid.
    expect(midTick.length).toBe(boundary.length);
    expect(midTick.length).toBeGreaterThanOrEqual(3); // at least t0, tick1, tick2

    // Snapshot at index 2 (tick 2) has the same tEpoch in both replays...
    expect(midTick[2].tEpoch).toBe(boundary[2].tEpoch);

    // ...but the state must differ. The mid-tick variant lost growth over the
    // last half-tick (r=0 from 1.5 → 2.0); the boundary variant grew at r=0.02
    // for the full second tick. Strict inequality: any non-zero difference
    // proves `replayTo` did not defer the event to the boundary.
    expect(midTick[2].state.N).not.toBe(boundary[2].state.N);
    expect(midTick[2].state.N).toBeLessThan(boundary[2].state.N);
  });
});

/**
 * Slice 2.3.3b — Asserts properties P-R-1..P-R-6 for the replay engine.
 *
 * Properties per [Phase1PBT.md](../../../docs/design/Phase1PBT.md)
 * §"Properties — `client/src/sim/replay.test.ts`". Analog of Slice 1.3.4e's
 * P-M / P-I property suites.
 *
 * Convention (Phase1PBT.md §"Conventions"): properties live in the same
 * file as example-based tests under a separate `describe("properties")`
 * block.
 *
 * Generator notes:
 *   - `fc.double` (not `fc.float`) per the fast-check 4.x compatibility
 *     note carried from Slice 1.3.4e: `fc.float` is restricted to 32-bit
 *     IEEE-754 in 4.x; `fc.double` covers the full 64-bit range.
 *   - Parameter and state ranges bounded to physically sensible regions
 *     (no `Number.MAX_VALUE` cliff-chases) per Phase1PBT.md §"Conventions".
 *   - Property fixture uses **yearly** `tickSeconds` for replay speed
 *     (≤100 snapshots per replay), distinct from the example-test fixture
 *     which uses monthly `tickSeconds` for temporal fidelity. Both go
 *     through the same `replayTo` code path.
 */

const PROP_TICK_SECONDS = SECS_PER_YEAR; // yearly tick for fast property runs
const PROP_RUN: Run = {
  id: "prop-run",
  name: "replay-property-run",
  modelKind: "C-basic-demfisc",
  t0Epoch: 10_413_792_000,
  tickSeconds: PROP_TICK_SECONDS,
  peoplePerUnit: 1000,
  initialState: { N: 0.5, S: 0 },
  initialParams: { r: 0.02, beta: 0.25, c: 3, s0: 10 },
  createdAt: 0,
};

// Horizon and array sizes deliberately small for property-test speed.
// Each replayTo with a 20-yr horizon and yearly ticks runs ~20 ticks ×
// ~365 daily sub-steps = ~7300 RK4 sub-steps. At 100 runs/property and
// 6 properties (some doing 2 replayTo calls each), total work is well
// under the 5-second vitest timeout. Temporal fidelity (long cycles,
// settling behaviour) is the example tests' job, not the properties'.
const MAX_HORIZON_YEARS = 20;
const MAX_EVENTS_PER_ARRAY = 5;

// Bounded payload generators (physically sensible).
const arbParamValue = fc.double({ min: 0.001, max: 5, noNaN: true });
const arbPatchN = fc.double({ min: 0, max: 5, noNaN: true });
const arbParamKey = fc.constantFrom("r", "beta", "c", "s0" as const);

// Event tEpoch ∈ [t0, t0 + 40 yr] gives a realistic mix of before /
// at / after a target up to 20 yr.
const arbEventTEpoch = fc
  .integer({ min: 0, max: 40 * SECS_PER_YEAR })
  .map((offsetSec) => PROP_RUN.t0Epoch + offsetSec);

const arbParamSetEvent = fc.record({
  kind: fc.constant("param-set" as const),
  tEpoch: arbEventTEpoch,
  param: arbParamKey,
  value: arbParamValue,
});
// State-poke patches always carry N here. `withDeletedKeys` (which would
// also exercise the empty-patch / S-only-patch cases) was removed in
// fast-check 4.x; keeping patches non-empty avoids the API gap and is
// the case the replay engine cares about. Empty-patch coverage can be
// added with a `fc.oneof(..., fc.constant({}))` if it ever matters.
const arbStatePokeEvent = fc.record({
  kind: fc.constant("state-poke" as const),
  tEpoch: arbEventTEpoch,
  patch: fc.record({ N: arbPatchN }),
});
const arbEvent: fc.Arbitrary<Event> = fc.oneof(
  arbParamSetEvent,
  arbStatePokeEvent,
);

// §6.1 invariant: events stored sorted by tEpoch.
const arbEvents = fc
  .array(arbEvent, { maxLength: MAX_EVENTS_PER_ARRAY })
  .map((es): Event[] => [...es].sort((a, b) => a.tEpoch - b.tEpoch));

const arbTargetYears = fc.integer({ min: 1, max: MAX_HORIZON_YEARS });

describe("replay — Asserts properties", () => {
  it("P-R-1: replayTo(run, events, t) is deterministic — two calls return deep-equal output", () => {
    fc.assert(
      fc.property(arbEvents, arbTargetYears, (events, yrs) => {
        const target = PROP_RUN.t0Epoch + yrs * SECS_PER_YEAR;
        const a = replayTo(PROP_RUN, events, target);
        const b = replayTo(PROP_RUN, events, target);
        expect(a).toEqual(b);
      }),
    );
  });

  it("P-R-2: replayTo(run, [], t) baseline structure — first snapshot at t0, tick-spaced, last ≥ t", () => {
    // "Empty event list = baseline trajectory" (Phase1PBT.md). The property
    // pins down the snapshot grid produced by the no-events case so any
    // future regression in tick-boundary handling fails here.
    fc.assert(
      fc.property(arbTargetYears, (yrs) => {
        const target = PROP_RUN.t0Epoch + yrs * SECS_PER_YEAR;
        const snaps = replayTo(PROP_RUN, [], target);
        expect(snaps.length).toBeGreaterThan(0);
        expect(snaps[0].tEpoch).toBe(PROP_RUN.t0Epoch);
        expect(snaps[snaps.length - 1].tEpoch).toBeGreaterThanOrEqual(target);
        for (let i = 1; i < snaps.length; i++) {
          expect(snaps[i].tEpoch - snaps[i - 1].tEpoch).toBe(PROP_TICK_SECONDS);
        }
      }),
    );
  });

  it("P-R-3: paramsAt returns a value from {initial} ∪ {events' values up to cursor} — no invented values", () => {
    fc.assert(
      fc.property(arbEvents, arbTargetYears, (events, yrs) => {
        const cursor = PROP_RUN.t0Epoch + yrs * SECS_PER_YEAR;
        const result = paramsAt(PROP_RUN, events, cursor);
        for (const key of ["r", "beta", "c", "s0"] as const) {
          const allowed = new Set<number>([PROP_RUN.initialParams[key]]);
          for (const e of events) {
            if (e.kind === "param-set" && e.param === key && e.tEpoch <= cursor) {
              allowed.add(e.value);
            }
          }
          expect(allowed.has(result[key])).toBe(true);
        }
      }),
    );
  });

  it("P-R-4: replayTo at t2 > t1 — the t2 replay's snapshot at t1 matches the t1 replay's last snapshot", () => {
    fc.assert(
      fc.property(
        arbEvents,
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (events, yrs1, extraYrs) => {
          const target1 = PROP_RUN.t0Epoch + yrs1 * SECS_PER_YEAR;
          const target2 = PROP_RUN.t0Epoch + (yrs1 + extraYrs) * SECS_PER_YEAR;
          const a = replayTo(PROP_RUN, events, target1);
          const b = replayTo(PROP_RUN, events, target2);
          const lastA = a[a.length - 1];
          const matchInB = b.find((s) => s.tEpoch === lastA.tEpoch);
          expect(matchInB).toEqual(lastA);
        },
      ),
    );
  });

  it("P-R-5: adding a param-set event after t does not change replayTo(run, events, t) — causality", () => {
    fc.assert(
      fc.property(
        arbEvents,
        arbTargetYears,
        arbParamValue,
        arbParamKey,
        (events, yrs, value, param) => {
          const target = PROP_RUN.t0Epoch + yrs * SECS_PER_YEAR;
          const futureEvent: Event = {
            kind: "param-set",
            tEpoch: target + SECS_PER_YEAR,
            param,
            value,
          };
          const withFuture = [...events, futureEvent].sort(
            (a, b) => a.tEpoch - b.tEpoch,
          );
          expect(replayTo(PROP_RUN, withFuture, target)).toEqual(
            replayTo(PROP_RUN, events, target),
          );
        },
      ),
    );
  });

  it("P-R-6: every snapshot has N ≥ 0 and S ≥ 0 — clamps survive the replay-driver layer", () => {
    fc.assert(
      fc.property(arbEvents, arbTargetYears, (events, yrs) => {
        const target = PROP_RUN.t0Epoch + yrs * SECS_PER_YEAR;
        const snaps = replayTo(PROP_RUN, events, target);
        for (const s of snaps) {
          expect(s.state.N).toBeGreaterThanOrEqual(0);
          expect(s.state.S).toBeGreaterThanOrEqual(0);
        }
      }),
    );
  });
});

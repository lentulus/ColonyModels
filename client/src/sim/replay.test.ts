import { describe, it, expect } from "vitest";
// `paramsAt` and `replayTo` don't exist yet — these imports will fail until
// Slice 2.2.1 lands. That's the expected red state at Slice 2 step 2.1.1.
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

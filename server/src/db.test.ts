import { describe, it, expect, beforeEach, afterEach } from "vitest";
// `openDb` and `DbRepo` don't exist yet — this import will fail until
// Slice 3.2.2 lands `server/src/db.ts`. That is the expected red state at
// Slice 3.1; turns green at Slice 3.2.5.
import { openDb, type DbRepo } from "./db.js";
import type { Run, Event, Snapshot } from "@colonymodels/shared";

/**
 * Slice 3.1.1 test — db repo CRUD + foreign-key cascade.
 *
 * Integration test against an in-memory SQLite (`:memory:`) via the
 * not-yet-existent `db.ts` repo module. Per Phase1Design.md §7.1 the schema
 * has three tables (runs, events, snapshots) with ON DELETE CASCADE on
 * runs.id; per §7.3 the server is dumb storage — no model code, no derived
 * data — so the repo's only job is to round-trip what it is given.
 *
 * Five sub-cases per Phase1AutomatedTests.md §3.1.1:
 *   - runs-create-read       — created run reads back, JSON columns parsed
 *   - events-append          — three events listed back in (t_epoch, seq) order
 *   - snapshots-bulk-upsert  — overlapping PUTs, later values win
 *   - events-drop-after      — drop-after-T keeps only t_epoch <= T
 *   - cascade-delete         — deleting a run drops its events + snapshots
 *
 * The DbRepo contract surface committed here is the seam 3.2.2 implements:
 *   openDb(url): DbRepo
 *   DbRepo.close()
 *   DbRepo.runs.{create, get, delete}
 *   DbRepo.events.{append, list, dropAfter}    // seq auto-assigned by repo
 *   DbRepo.snapshots.{bulkUpsert, list}
 * Caller (HTTP layer) mints id + createdAt before calling runs.create — repo
 * does not generate identifiers.
 */

const SAMPLE_RUN: Run = {
  id: "run-test-1",
  name: "db-test",
  modelKind: "C-basic-demfisc",
  t0Epoch: 10_413_792_000, // 2300-01-01 founding, per §17
  tickSeconds: 2_629_746, // month
  peoplePerUnit: 1000,
  initialState: { N: 0.5, S: 0 },
  initialParams: { r: 0.02, beta: 0.25, c: 3, s0: 10 },
  createdAt: 1_700_000_000,
};

describe("server/db repo — CRUD + cascade against :memory: SQLite", () => {
  let db: DbRepo;

  beforeEach(() => {
    db = openDb(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("runs-create-read: created run reads back with all fields equal", () => {
    db.runs.create(SAMPLE_RUN);
    const read = db.runs.get(SAMPLE_RUN.id);
    expect(read).toEqual(SAMPLE_RUN);
    // Explicit object equality on JSON columns — guards against the
    // "JSON column read as string, not parsed" failure mode.
    expect(read?.initialState).toEqual(SAMPLE_RUN.initialState);
    expect(read?.initialParams).toEqual(SAMPLE_RUN.initialParams);
  });

  it("events-append: three events listed back in (t_epoch, seq) order", () => {
    db.runs.create(SAMPLE_RUN);

    // Two events share t_epoch=1_000_000 to exercise the seq tiebreaker;
    // append order is intentionally NOT chronological so the test catches
    // a missing ORDER BY on read.
    const eLater: Event = { kind: "param-set", tEpoch: 2_000_000, param: "r", value: 0.03 };
    const eA: Event = { kind: "param-set", tEpoch: 1_000_000, param: "beta", value: 0.30 };
    const eB: Event = { kind: "param-set", tEpoch: 1_000_000, param: "c", value: 4 };

    db.events.append(SAMPLE_RUN.id, eLater);
    db.events.append(SAMPLE_RUN.id, eA);
    db.events.append(SAMPLE_RUN.id, eB);

    const listed = db.events.list(SAMPLE_RUN.id);
    expect(listed).toHaveLength(3);
    // Two at t_epoch=1_000_000 come first (seq tiebreaker by append order:
    // eA appended before eB), then t_epoch=2_000_000.
    expect(listed[0]).toMatchObject(eA);
    expect(listed[1]).toMatchObject(eB);
    expect(listed[2]).toMatchObject(eLater);
  });

  it("snapshots-bulk-upsert: overlapping PUTs, later values win on overlap", () => {
    db.runs.create(SAMPLE_RUN);

    const initial: Snapshot[] = [
      { tEpoch: 1_000, state: { N: 0.5, S: 0.0 } },
      { tEpoch: 2_000, state: { N: 0.6, S: 0.1 } },
      { tEpoch: 3_000, state: { N: 0.7, S: 0.2 } },
    ];
    db.snapshots.bulkUpsert(SAMPLE_RUN.id, initial);

    const overlap: Snapshot[] = [
      { tEpoch: 2_000, state: { N: 0.99, S: 0.99 } }, // overwrites
      { tEpoch: 4_000, state: { N: 0.8, S: 0.3 } }, // new
    ];
    db.snapshots.bulkUpsert(SAMPLE_RUN.id, overlap);

    const listed = db.snapshots.list(SAMPLE_RUN.id);
    const byT = new Map(listed.map((s) => [s.tEpoch, s.state]));
    expect(byT.size).toBe(4);
    expect(byT.get(1_000)).toEqual({ N: 0.5, S: 0.0 });
    expect(byT.get(2_000)).toEqual({ N: 0.99, S: 0.99 }); // overlap winner
    expect(byT.get(3_000)).toEqual({ N: 0.7, S: 0.2 });
    expect(byT.get(4_000)).toEqual({ N: 0.8, S: 0.3 });
  });

  it("events-drop-after: drop-after-T keeps only events with t_epoch <= T", () => {
    db.runs.create(SAMPLE_RUN);

    db.events.append(SAMPLE_RUN.id, { kind: "param-set", tEpoch: 500, param: "r", value: 0.03 });
    db.events.append(SAMPLE_RUN.id, { kind: "param-set", tEpoch: 1_500, param: "r", value: 0.04 });
    db.events.append(SAMPLE_RUN.id, { kind: "param-set", tEpoch: 2_500, param: "r", value: 0.05 });

    // Drop strict-greater-than per §7.2 (`?after=T drop events with t_epoch > T`).
    db.events.dropAfter(SAMPLE_RUN.id, 1_500);

    const listed = db.events.list(SAMPLE_RUN.id);
    expect(listed).toHaveLength(2);
    expect(listed.map((e) => e.tEpoch)).toEqual([500, 1_500]);
  });

  it("cascade-delete: deleting a run drops its events and snapshots", () => {
    db.runs.create(SAMPLE_RUN);
    db.events.append(SAMPLE_RUN.id, {
      kind: "param-set",
      tEpoch: 1_000,
      param: "r",
      value: 0.03,
    });
    db.snapshots.bulkUpsert(SAMPLE_RUN.id, [{ tEpoch: 1_000, state: { N: 0.5, S: 0.1 } }]);

    db.runs.delete(SAMPLE_RUN.id);

    expect(db.runs.get(SAMPLE_RUN.id)).toBeNull();
    expect(db.events.list(SAMPLE_RUN.id)).toEqual([]);
    expect(db.snapshots.list(SAMPLE_RUN.id)).toEqual([]);
  });
});

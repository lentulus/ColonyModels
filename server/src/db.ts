import Database from "better-sqlite3";
import type { Run, RunId, Event, Snapshot, StateC, ParamsC } from "@colonymodels/shared";

export type DbRepo = {
  close: () => void;
  runs: {
    create: (run: Run) => void;
    get: (id: RunId) => Run | null;
    list: () => Run[];
    delete: (id: RunId) => void;
  };
  events: {
    append: (runId: RunId, event: Event) => void;
    list: (runId: RunId) => Event[];
    dropAfter: (runId: RunId, tEpoch: number) => void;
  };
  snapshots: {
    bulkUpsert: (runId: RunId, snapshots: Snapshot[]) => void;
    list: (runId: RunId) => Snapshot[];
    dropAfter: (runId: RunId, tEpoch: number) => void;
  };
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  model_kind      TEXT NOT NULL,
  t0_epoch        INTEGER NOT NULL,
  tick_seconds    INTEGER NOT NULL,
  people_per_unit REAL NOT NULL,
  initial_state   TEXT NOT NULL,
  initial_params  TEXT NOT NULL,
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  run_id    TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  t_epoch   INTEGER NOT NULL,
  seq       INTEGER NOT NULL,
  payload   TEXT NOT NULL,
  PRIMARY KEY (run_id, t_epoch, seq)
);

CREATE TABLE IF NOT EXISTS snapshots (
  run_id    TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  t_epoch   INTEGER NOT NULL,
  state     TEXT NOT NULL,
  PRIMARY KEY (run_id, t_epoch)
);
`;

type RunRow = {
  id: string;
  name: string;
  model_kind: string;
  t0_epoch: number;
  tick_seconds: number;
  people_per_unit: number;
  initial_state: string;
  initial_params: string;
  created_at: number;
};

function rowToRun(row: RunRow): Run {
  return {
    id: row.id,
    name: row.name,
    modelKind: row.model_kind as Run["modelKind"],
    t0Epoch: row.t0_epoch,
    tickSeconds: row.tick_seconds,
    peoplePerUnit: row.people_per_unit,
    initialState: JSON.parse(row.initial_state) as StateC,
    initialParams: JSON.parse(row.initial_params) as ParamsC,
    createdAt: row.created_at,
  };
}

export function openDb(url: string): DbRepo {
  const sqlite = new Database(url);
  // SQLite default is foreign_keys OFF; required for ON DELETE CASCADE.
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(SCHEMA);

  const stmts = {
    runsInsert: sqlite.prepare(`
      INSERT INTO runs (
        id, name, model_kind, t0_epoch, tick_seconds, people_per_unit,
        initial_state, initial_params, created_at
      ) VALUES (
        @id, @name, @modelKind, @t0Epoch, @tickSeconds, @peoplePerUnit,
        @initialState, @initialParams, @createdAt
      )
    `),
    runsGet: sqlite.prepare(`SELECT * FROM runs WHERE id = ?`),
    runsList: sqlite.prepare(`SELECT * FROM runs ORDER BY created_at`),
    runsDelete: sqlite.prepare(`DELETE FROM runs WHERE id = ?`),

    eventsNextSeq: sqlite.prepare(`
      SELECT COALESCE(MAX(seq) + 1, 0) AS next_seq
      FROM events WHERE run_id = ? AND t_epoch = ?
    `),
    eventsInsert: sqlite.prepare(`
      INSERT INTO events (run_id, t_epoch, seq, payload)
      VALUES (?, ?, ?, ?)
    `),
    eventsList: sqlite.prepare(`
      SELECT payload FROM events
      WHERE run_id = ?
      ORDER BY t_epoch, seq
    `),
    eventsDropAfter: sqlite.prepare(`
      DELETE FROM events WHERE run_id = ? AND t_epoch > ?
    `),

    snapshotsUpsert: sqlite.prepare(`
      INSERT INTO snapshots (run_id, t_epoch, state)
      VALUES (?, ?, ?)
      ON CONFLICT (run_id, t_epoch) DO UPDATE SET state = excluded.state
    `),
    snapshotsList: sqlite.prepare(`
      SELECT t_epoch, state FROM snapshots
      WHERE run_id = ?
      ORDER BY t_epoch
    `),
    snapshotsDropAfter: sqlite.prepare(`
      DELETE FROM snapshots WHERE run_id = ? AND t_epoch > ?
    `),
  };

  // Wrap bulk upserts in a transaction: atomic + faster than N round trips.
  const bulkUpsertSnapshots = sqlite.transaction((runId: RunId, snaps: Snapshot[]) => {
    for (const s of snaps) {
      stmts.snapshotsUpsert.run(runId, s.tEpoch, JSON.stringify(s.state));
    }
  });

  return {
    close: () => sqlite.close(),

    runs: {
      create: (r) => {
        stmts.runsInsert.run({
          id: r.id,
          name: r.name,
          modelKind: r.modelKind,
          t0Epoch: r.t0Epoch,
          tickSeconds: r.tickSeconds,
          peoplePerUnit: r.peoplePerUnit,
          initialState: JSON.stringify(r.initialState),
          initialParams: JSON.stringify(r.initialParams),
          createdAt: r.createdAt,
        });
      },
      get: (id) => {
        const row = stmts.runsGet.get(id) as RunRow | undefined;
        return row ? rowToRun(row) : null;
      },
      list: () => {
        const rows = stmts.runsList.all() as RunRow[];
        return rows.map(rowToRun);
      },
      delete: (id) => {
        stmts.runsDelete.run(id);
      },
    },

    events: {
      append: (runId, event) => {
        const { next_seq } = stmts.eventsNextSeq.get(runId, event.tEpoch) as {
          next_seq: number;
        };
        stmts.eventsInsert.run(runId, event.tEpoch, next_seq, JSON.stringify(event));
      },
      list: (runId) => {
        const rows = stmts.eventsList.all(runId) as { payload: string }[];
        return rows.map((r) => JSON.parse(r.payload) as Event);
      },
      dropAfter: (runId, tEpoch) => {
        stmts.eventsDropAfter.run(runId, tEpoch);
      },
    },

    snapshots: {
      bulkUpsert: (runId, snaps) => {
        bulkUpsertSnapshots(runId, snaps);
      },
      list: (runId) => {
        const rows = stmts.snapshotsList.all(runId) as {
          t_epoch: number;
          state: string;
        }[];
        return rows.map((r) => ({ tEpoch: r.t_epoch, state: JSON.parse(r.state) as StateC }));
      },
      dropAfter: (runId, tEpoch) => {
        stmts.snapshotsDropAfter.run(runId, tEpoch);
      },
    },
  };
}

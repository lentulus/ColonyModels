import { describe, it, expect } from "vitest";
import request from "supertest";
// `app` doesn't exist yet — this import will fail until Slice 3.2.4 wires up
// `server/src/app.ts` (extracting the express instance from index.ts so it
// can be used by supertest without binding a port). That's the expected red
// state at Slice 0 / Slice 3.1; turns green at Slice 3.2.5.
import { app } from "../app.js";

/**
 * Slice 0 anchor → Slice 3.1.2 extension — HTTP round-trip across all
 * run / event / snapshot endpoints, plus zod-boundary rejection cases.
 *
 * Sub-case layout:
 *   1. Per-endpoint round-trips (3 it()s, original Slice 0 skeleton — kept
 *      so a future regression isolates to a single endpoint).
 *   2. Full-sequence happy path (1 it()): POST run → POST events →
 *      PUT snapshots → GET each back, byte-equal.
 *   3. Zod rejection (4 it()s): missing name, string tEpoch, negative N,
 *      non-numeric `after=`. All return 400 with a structured
 *      `{ error: string, issues: ZodIssue[] }` body — never a stack trace.
 *
 * Uses supertest against the in-process express app — no port binding, no
 * real network. Tests assume the app is wired with an in-memory SQLite for
 * the test process (`:memory:`); test-env wiring lands at Slice 3.2.4.
 */

const SAMPLE_RUN = {
  name: "roundtrip-test",
  modelKind: "C-basic-demfisc",
  t0Epoch: 10_413_792_000,
  tickSeconds: 2_629_746,
  peoplePerUnit: 1000,
  initialState: { N: 0.2, S: 0 },
  initialParams: { r: 0.02, beta: 0.25, c: 3, s0: 1 },
};

// Boundary contract: every zod-rejected request returns 400 with a
// structured body (string `error` + array `issues`), and never leaks a
// stack trace. Slice 3.2.3 implements this in the route layer.
function expectZod400(res: {
  status: number;
  body: { error?: unknown; issues?: unknown };
}) {
  expect(res.status).toBe(400);
  expect(typeof res.body.error).toBe("string");
  expect(Array.isArray(res.body.issues)).toBe(true);
  // Heuristic: stack traces contain frames like "\n    at someFn (file:line)".
  expect(JSON.stringify(res.body)).not.toContain("\n    at ");
  return res.body as {
    error: string;
    issues: { path: (string | number)[]; message: string }[];
  };
}

describe("HTTP round-trip across runs + events + snapshots endpoints", () => {
  it("POST /api/runs → GET /api/runs/:id returns persisted fields byte-equal", async () => {
    const createRes = await request(app)
      .post("/api/runs")
      .send(SAMPLE_RUN)
      .expect(200);

    expect(typeof createRes.body.id).toBe("string");

    const readRes = await request(app)
      .get(`/api/runs/${createRes.body.id}`)
      .expect(200);

    expect(readRes.body.name).toBe(SAMPLE_RUN.name);
    expect(readRes.body.modelKind).toBe(SAMPLE_RUN.modelKind);
    expect(readRes.body.t0Epoch).toBe(SAMPLE_RUN.t0Epoch);
    expect(readRes.body.tickSeconds).toBe(SAMPLE_RUN.tickSeconds);
    expect(readRes.body.peoplePerUnit).toBe(SAMPLE_RUN.peoplePerUnit);
    expect(readRes.body.initialState).toEqual(SAMPLE_RUN.initialState);
    expect(readRes.body.initialParams).toEqual(SAMPLE_RUN.initialParams);
    // createdAt is server-assigned.
    expect(typeof readRes.body.createdAt).toBe("number");
  });

  it("POST /api/runs/:id/events → GET /api/runs/:id/events lists the appended event", async () => {
    const createRes = await request(app).post("/api/runs").send(SAMPLE_RUN).expect(200);
    const id = createRes.body.id;

    const event = {
      kind: "param-set",
      tEpoch: SAMPLE_RUN.t0Epoch,
      param: "r",
      value: 0.03,
    };

    await request(app).post(`/api/runs/${id}/events`).send(event).expect(200);

    const listRes = await request(app).get(`/api/runs/${id}/events`).expect(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0]).toMatchObject(event);
  });

  it("PUT /api/runs/:id/snapshots → GET /api/runs/:id/snapshots lists the snapshot", async () => {
    const createRes = await request(app).post("/api/runs").send(SAMPLE_RUN).expect(200);
    const id = createRes.body.id;

    const snapshot = {
      tEpoch: SAMPLE_RUN.t0Epoch,
      state: { N: 0.2, S: 0 },
    };

    await request(app)
      .put(`/api/runs/${id}/snapshots`)
      .send([snapshot])
      .expect(200);

    const listRes = await request(app)
      .get(`/api/runs/${id}/snapshots`)
      .expect(200);

    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].tEpoch).toBe(snapshot.tEpoch);
    expect(listRes.body[0].state).toEqual(snapshot.state);
  });
});

describe("HTTP round-trip — full sequence happy path", () => {
  it("POST run → POST 2 events → PUT 3 snapshots → GET each back, byte-equal", async () => {
    const createRes = await request(app).post("/api/runs").send(SAMPLE_RUN).expect(200);
    const id = createRes.body.id;
    expect(typeof id).toBe("string");

    const e1 = {
      kind: "param-set",
      tEpoch: SAMPLE_RUN.t0Epoch + 1000,
      param: "r",
      value: 0.03,
    };
    const e2 = {
      kind: "param-set",
      tEpoch: SAMPLE_RUN.t0Epoch + 2000,
      param: "beta",
      value: 0.3,
    };
    await request(app).post(`/api/runs/${id}/events`).send(e1).expect(200);
    await request(app).post(`/api/runs/${id}/events`).send(e2).expect(200);

    const snaps = [
      { tEpoch: SAMPLE_RUN.t0Epoch, state: SAMPLE_RUN.initialState },
      { tEpoch: SAMPLE_RUN.t0Epoch + 1000, state: { N: 0.21, S: 0.01 } },
      { tEpoch: SAMPLE_RUN.t0Epoch + 2000, state: { N: 0.22, S: 0.02 } },
    ];
    await request(app).put(`/api/runs/${id}/snapshots`).send(snaps).expect(200);

    // Read everything back.
    const runRes = await request(app).get(`/api/runs/${id}`).expect(200);
    expect(runRes.body).toMatchObject(SAMPLE_RUN);

    const eventsRes = await request(app).get(`/api/runs/${id}/events`).expect(200);
    expect(eventsRes.body).toHaveLength(2);
    // Events come back ordered by (t_epoch, seq) per §7.2.
    expect(eventsRes.body[0]).toMatchObject(e1);
    expect(eventsRes.body[1]).toMatchObject(e2);

    const snapsRes = await request(app).get(`/api/runs/${id}/snapshots`).expect(200);
    expect(snapsRes.body).toHaveLength(3);
    // List order is not contractually pinned by §7.2 — index by tEpoch.
    const byT = new Map(
      snapsRes.body.map((s: { tEpoch: number; state: unknown }) => [s.tEpoch, s.state]),
    );
    expect(byT.size).toBe(3);
    for (const s of snaps) {
      expect(byT.get(s.tEpoch)).toEqual(s.state);
    }
  });
});

describe("HTTP boundary — zod rejection returns 400 with structured body", () => {
  it("POST /api/runs missing name → 400, issues mention 'name'", async () => {
    const { name: _drop, ...noName } = SAMPLE_RUN;
    const res = await request(app).post("/api/runs").send(noName);
    const body = expectZod400(res);
    expect(body.issues.some((i) => i.path.includes("name"))).toBe(true);
  });

  it("POST event with string tEpoch → 400", async () => {
    const createRes = await request(app).post("/api/runs").send(SAMPLE_RUN).expect(200);
    const id = createRes.body.id;
    const badEvent = {
      kind: "param-set",
      tEpoch: "not-a-number",
      param: "r",
      value: 0.03,
    };
    const res = await request(app).post(`/api/runs/${id}/events`).send(badEvent);
    expectZod400(res);
  });

  it("PUT snapshots with state {N:-1} → 400 (negative N invalid)", async () => {
    const createRes = await request(app).post("/api/runs").send(SAMPLE_RUN).expect(200);
    const id = createRes.body.id;
    const badSnap = [{ tEpoch: SAMPLE_RUN.t0Epoch, state: { N: -1, S: 0 } }];
    const res = await request(app).put(`/api/runs/${id}/snapshots`).send(badSnap);
    expectZod400(res);
  });

  it("DELETE /api/runs/:id/events?after=foo (non-numeric) → 400", async () => {
    const createRes = await request(app).post("/api/runs").send(SAMPLE_RUN).expect(200);
    const id = createRes.body.id;
    const res = await request(app).delete(`/api/runs/${id}/events?after=foo`);
    expectZod400(res);
  });
});

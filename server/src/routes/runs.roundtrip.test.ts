import { describe, it, expect } from "vitest";
import request from "supertest";
// `app` doesn't exist yet — this import will fail until Slice 3 wires up
// `server/src/app.ts` (extracting the express instance from index.ts so it
// can be used by supertest without binding a port). That's the expected red
// state at Slice 0.
import { app } from "../app";

/**
 * Slice 0 regression anchor — HTTP round-trip across all run endpoints.
 *
 * Skeleton scope: confirms each endpoint round-trips a single payload
 * cleanly. Zod-rejection sub-cases (negative N, missing name, etc.) are
 * fleshed out at Slice 3.1.2. Live-server `curl` verification is
 * Phase1TestCases.md 3.3.3 (Slice 3 green review).
 *
 * Uses supertest against the in-process express app — no port binding,
 * no real network. Tests assume the app is wired with an in-memory SQLite
 * for the test process (`:memory:`); test-env wiring is Slice 3.1.1.
 *
 * Status at write time (Slice 0): expected to fail at *import* — the
 * `../app` module does not yet exist. Turns green at Slice 3.2.5.
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

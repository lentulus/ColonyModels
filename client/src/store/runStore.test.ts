// runStore — Zustand store unit tests with mocked fetch.
// Sub-cases per Phase1AutomatedTests.md §4.1.1:
//   create / append-event / advance / flush / rewind / branch / api-error.
// All assertions check both state transitions AND the exact URL/method/body
// of every fetch call — not just call counts (§4.1.1 pass criteria).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Event, Run } from "@colonymodels/shared";

import { useRunStore } from "./runStore";

// ---------------------------------------------------------------------------
// Fixtures + helpers
// ---------------------------------------------------------------------------

const SECS_PER_DAY = 86400;
const SECS_PER_WEEK = 7 * SECS_PER_DAY;

// §17 BLANK_RUN values, embedded as a Run template (Omit<Run, "id"|"createdAt">).
// Kept verbatim in sync with Phase1Design.md §17. r=0.02, β=0.25, c=3, s0=10,
// N0=0.5, S0=0. tickSeconds = 1 week (round Phase 1 value).
const TEMPLATE: Omit<Run, "id" | "createdAt"> = {
  name: "blank",
  modelKind: "C-basic-demfisc",
  t0Epoch: 0,
  tickSeconds: SECS_PER_WEEK,
  peoplePerUnit: 1000,
  initialState: { N: 0.5, S: 0 },
  initialParams: { r: 0.02, beta: 0.25, c: 3, s0: 10 },
};

const RUN_ID = "test-run-1";
const SERVER_CREATED_AT = 1234567890;

// Per-call recording of every fetch invocation.
type FetchCall = { url: string; method: string; body: unknown; query: URLSearchParams };
let fetchCalls: FetchCall[];

function recordFetch(url: string, init?: RequestInit): FetchCall {
  const method = (init?.method ?? "GET").toUpperCase();
  const parsed = new URL(url, "http://localhost");
  const body =
    init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;
  const call: FetchCall = {
    url,
    method,
    body,
    query: parsed.searchParams,
  };
  fetchCalls.push(call);
  return call;
}

// Default mock: returns 200 OK with shape-appropriate bodies for each endpoint.
// Individual tests override with mockImplementationOnce / mockResolvedValueOnce.
function defaultFetchMock(url: string, init?: RequestInit): Promise<Response> {
  const call = recordFetch(url, init);

  if (call.method === "POST" && call.url === "/api/runs") {
    return Promise.resolve(
      new Response(JSON.stringify({ id: RUN_ID }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }

  if (call.method === "GET" && call.url === `/api/runs/${RUN_ID}`) {
    const run: Run = {
      ...TEMPLATE,
      id: RUN_ID,
      createdAt: SERVER_CREATED_AT,
    };
    return Promise.resolve(
      new Response(JSON.stringify(run), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }

  // Generic OK for POST events, PUT snapshots, DELETE *.
  return Promise.resolve(
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

function findFetched(method: string, urlMatch: string | RegExp): FetchCall | undefined {
  return fetchCalls.find((c) => {
    if (c.method !== method) return false;
    return typeof urlMatch === "string" ? c.url === urlMatch : urlMatch.test(c.url);
  });
}

function findAllFetched(method: string, urlMatch: string | RegExp): FetchCall[] {
  return fetchCalls.filter((c) => {
    if (c.method !== method) return false;
    return typeof urlMatch === "string" ? c.url === urlMatch : urlMatch.test(c.url);
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  fetchCalls = [];
  globalThis.fetch = vi.fn(defaultFetchMock) as unknown as typeof fetch;

  // Reset zustand store to initial empty state between tests.
  useRunStore.setState({
    run: null,
    events: [],
    snapshots: [],
    cursor: 0,
    isDirty: false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Sub-case: create
// ---------------------------------------------------------------------------

describe("runStore — createRun", () => {
  it("sets run, empty events, single t0 snapshot, cursor=t0, isDirty=true; POSTs run with template body", async () => {
    await useRunStore.getState().createRun(TEMPLATE);

    const state = useRunStore.getState();
    expect(state.run).not.toBeNull();
    expect(state.run!.id).toBe(RUN_ID);
    expect(state.run!.name).toBe(TEMPLATE.name);
    expect(state.run!.modelKind).toBe(TEMPLATE.modelKind);
    expect(state.run!.initialState).toEqual(TEMPLATE.initialState);
    expect(state.run!.initialParams).toEqual(TEMPLATE.initialParams);

    expect(state.events).toEqual([]);
    expect(state.snapshots).toHaveLength(1);
    expect(state.snapshots[0]).toEqual({
      tEpoch: TEMPLATE.t0Epoch,
      state: TEMPLATE.initialState,
    });
    expect(state.cursor).toBe(TEMPLATE.t0Epoch);
    expect(state.isDirty).toBe(true);

    // POST /api/runs body matches the template exactly (no id/createdAt yet).
    const postRun = findFetched("POST", "/api/runs");
    expect(postRun).toBeDefined();
    expect(postRun!.body).toEqual(TEMPLATE);
  });
});

// ---------------------------------------------------------------------------
// Sub-case: append-event
// ---------------------------------------------------------------------------

describe("runStore — appendEvent", () => {
  it("appends event locally; POSTs to /events with the event body; subsequent advance uses new param", async () => {
    await useRunStore.getState().createRun(TEMPLATE);
    fetchCalls = []; // discard the createRun POST so per-test assertions are clean

    // Param-set: zero out r so subsequent advance leaves N untouched.
    const ev: Event = {
      kind: "param-set",
      tEpoch: TEMPLATE.t0Epoch,
      param: "r",
      value: 0,
    };
    await useRunStore.getState().appendEvent(ev);

    expect(useRunStore.getState().events).toEqual([ev]);

    const postEv = findFetched("POST", `/api/runs/${RUN_ID}/events`);
    expect(postEv).toBeDefined();
    expect(postEv!.body).toEqual(ev);

    // With r=0, dN/dt = 0 — N stays exactly at 0.5 after any number of RK4 sub-steps.
    useRunStore.getState().advance(1);
    const latestSnap = useRunStore.getState().snapshots.at(-1)!;
    expect(latestSnap.state.N).toBeCloseTo(0.5, 12);
  });
});

// ---------------------------------------------------------------------------
// Sub-case: advance
// ---------------------------------------------------------------------------

describe("runStore — advance", () => {
  it("adds one snapshot, moves cursor by tickSeconds, marks isDirty", async () => {
    await useRunStore.getState().createRun(TEMPLATE);
    // Pretend a flush happened so we can verify dirty re-flips on advance.
    useRunStore.setState({ isDirty: false });

    const snapsBefore = useRunStore.getState().snapshots.length;
    const cursorBefore = useRunStore.getState().cursor;

    useRunStore.getState().advance(1);

    const after = useRunStore.getState();
    expect(after.snapshots.length).toBe(snapsBefore + 1);
    expect(after.cursor).toBe(cursorBefore + TEMPLATE.tickSeconds);
    expect(after.snapshots.at(-1)!.tEpoch).toBe(after.cursor);
    expect(after.isDirty).toBe(true);
  });

  it("is local-only (does NOT touch fetch)", async () => {
    await useRunStore.getState().createRun(TEMPLATE);
    fetchCalls = [];

    useRunStore.getState().advance(3);

    expect(fetchCalls).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Sub-case: flush
// ---------------------------------------------------------------------------

describe("runStore — flushToServer", () => {
  it("PUTs the current snapshots cache and clears isDirty", async () => {
    await useRunStore.getState().createRun(TEMPLATE);
    useRunStore.getState().advance(3);
    const snapsBefore = useRunStore.getState().snapshots;
    fetchCalls = [];

    await useRunStore.getState().flushToServer();

    // PUT body is the bare array (matches snapshotArraySchema on server).
    const put = findFetched("PUT", `/api/runs/${RUN_ID}/snapshots`);
    expect(put).toBeDefined();
    expect(put!.body).toEqual(snapsBefore);

    expect(useRunStore.getState().isDirty).toBe(false);
    // Snapshots cache itself is unchanged after a successful flush.
    expect(useRunStore.getState().snapshots).toEqual(snapsBefore);
  });

  it("no-ops (no fetch) when isDirty=false", async () => {
    await useRunStore.getState().createRun(TEMPLATE);
    await useRunStore.getState().flushToServer(); // first call clears dirty
    fetchCalls = [];

    await useRunStore.getState().flushToServer();

    expect(fetchCalls).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Sub-case: rewind
// ---------------------------------------------------------------------------

describe("runStore — rewindTo", () => {
  it("sets cursor; preserves snapshots <= target; subsequent advance re-derives from there", async () => {
    await useRunStore.getState().createRun(TEMPLATE);
    useRunStore.getState().advance(10);
    const target = TEMPLATE.t0Epoch + 5 * TEMPLATE.tickSeconds;

    useRunStore.getState().rewindTo(target);
    const state = useRunStore.getState();
    expect(state.cursor).toBe(target);

    // Local snapshots cache is truncated at <= target.
    for (const snap of state.snapshots) {
      expect(snap.tEpoch).toBeLessThanOrEqual(target);
    }
    // The exact target snapshot is preserved.
    expect(state.snapshots.find((s) => s.tEpoch === target)).toBeDefined();

    // Subsequent advance picks up from cursor; tEpoch of newly-appended snapshot
    // is target + tickSeconds (not duplicated, not stale).
    useRunStore.getState().advance(1);
    const after = useRunStore.getState();
    expect(after.cursor).toBe(target + TEMPLATE.tickSeconds);
    expect(after.snapshots.at(-1)!.tEpoch).toBe(target + TEMPLATE.tickSeconds);
  });

  it("does NOT mutate the events array (failure mode listed in §4.1.1)", async () => {
    await useRunStore.getState().createRun(TEMPLATE);
    const ev: Event = {
      kind: "param-set",
      tEpoch: TEMPLATE.t0Epoch,
      param: "r",
      value: 0,
    };
    await useRunStore.getState().appendEvent(ev);
    useRunStore.getState().advance(10);

    const eventsBefore = useRunStore.getState().events.slice();
    useRunStore.getState().rewindTo(TEMPLATE.t0Epoch + 5 * TEMPLATE.tickSeconds);

    expect(useRunStore.getState().events).toEqual(eventsBefore);
  });
});

// ---------------------------------------------------------------------------
// Sub-case: branch
// ---------------------------------------------------------------------------

describe("runStore — branch (appendEvent while cursor < latest snapshot tEpoch)", () => {
  it("drops snapshots past cursor locally; DELETEs server snapshots+events after cursor; POSTs new event", async () => {
    await useRunStore.getState().createRun(TEMPLATE);
    useRunStore.getState().advance(10);
    const branchPoint = TEMPLATE.t0Epoch + 3 * TEMPLATE.tickSeconds;
    useRunStore.getState().rewindTo(branchPoint);
    // Sanity: rewind preserves snapshots <= branchPoint, but we're still at
    // the post-advance "cursor before latest snapshot" condition because the
    // local cache could be larger than the server's view. Reset fetchCalls so
    // per-branch assertions don't include create/advance noise.
    fetchCalls = [];

    const ev: Event = {
      kind: "param-set",
      tEpoch: branchPoint,
      param: "r",
      value: 0.05,
    };
    await useRunStore.getState().appendEvent(ev);

    const state = useRunStore.getState();

    // Local: snapshots past cursor are dropped.
    for (const snap of state.snapshots) {
      expect(snap.tEpoch).toBeLessThanOrEqual(branchPoint);
    }
    // Local: new event appended.
    expect(state.events.at(-1)).toEqual(ev);

    // Server-side: at least one DELETE-after invoked. The branch-correctness
    // contract requires dropping both snapshots and events after the branch
    // point — otherwise stale future state pollutes the next replay. Assert
    // both DELETEs were made with `?after=<branchPoint>`.
    const delSnaps = findFetched("DELETE", new RegExp(`/api/runs/${RUN_ID}/snapshots\\?`));
    expect(delSnaps).toBeDefined();
    expect(delSnaps!.query.get("after")).toBe(String(branchPoint));

    const delEvents = findFetched("DELETE", new RegExp(`/api/runs/${RUN_ID}/events\\?`));
    expect(delEvents).toBeDefined();
    expect(delEvents!.query.get("after")).toBe(String(branchPoint));

    // Server-side: the new event is POSTed.
    const postEv = findFetched("POST", `/api/runs/${RUN_ID}/events`);
    expect(postEv).toBeDefined();
    expect(postEv!.body).toEqual(ev);
  });
});

// ---------------------------------------------------------------------------
// Sub-case: api-error
// ---------------------------------------------------------------------------

describe("runStore — api error handling", () => {
  it("flushToServer: when PUT returns a non-OK response, store is unchanged and the promise rejects", async () => {
    await useRunStore.getState().createRun(TEMPLATE);
    useRunStore.getState().advance(3);

    // Override the next PUT to a 500. (The default mock handles GET/POST/PUT
    // uniformly with 200; we need a targeted failure.)
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementationOnce((url: string, init?: RequestInit) => {
      recordFetch(url, init);
      return Promise.resolve(
        new Response(JSON.stringify({ error: "boom" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      );
    });

    const before = {
      snapshots: useRunStore.getState().snapshots.slice(),
      isDirty: useRunStore.getState().isDirty,
      events: useRunStore.getState().events.slice(),
    };

    await expect(useRunStore.getState().flushToServer()).rejects.toThrow();

    const after = useRunStore.getState();
    expect(after.snapshots).toEqual(before.snapshots);
    expect(after.events).toEqual(before.events);
    // Failure mode from §4.1.1: "Optimistic state update not rolled back on PUT
    // failure." We assert isDirty stays TRUE on failure so a retry is possible.
    expect(after.isDirty).toBe(true);
    expect(after.isDirty).toBe(before.isDirty);
  });

  it("flushToServer: when fetch itself rejects (network error), store is unchanged and the promise rejects", async () => {
    await useRunStore.getState().createRun(TEMPLATE);
    useRunStore.getState().advance(3);

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementationOnce((url: string, init?: RequestInit) => {
      recordFetch(url, init);
      return Promise.reject(new Error("network down"));
    });

    const before = {
      snapshots: useRunStore.getState().snapshots.slice(),
      isDirty: useRunStore.getState().isDirty,
    };

    await expect(useRunStore.getState().flushToServer()).rejects.toThrow();

    const after = useRunStore.getState();
    expect(after.snapshots).toEqual(before.snapshots);
    expect(after.isDirty).toBe(true);
  });
});

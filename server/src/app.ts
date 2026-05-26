import express from "express";
import cors from "cors";
import { openDb } from "./db.js";
import { runsRouter } from "./routes/runs.js";
import { eventsRouter } from "./routes/events.js";
import { snapshotsRouter } from "./routes/snapshots.js";

// DB_URL is wired to ":memory:" by server/vitest.config.ts; production uses
// the local file. Single process-wide db instance — Phase 1 is single-user
// per Phase1Design.md §7.3.
const dbUrl = process.env.DB_URL ?? "./colonymodels.db";
const db = openDb(dbUrl);

export const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "colonymodels-server" });
});

// Three independent routers all mounted at /api/runs. No path overlap:
// runsRouter owns "/" and "/:id"; events owns "/:id/events"; snapshots
// owns "/:id/snapshots". Express tries each in order — order doesn't
// matter here because patterns are disjoint.
app.use("/api/runs", runsRouter(db));
app.use("/api/runs", eventsRouter(db));
app.use("/api/runs", snapshotsRouter(db));

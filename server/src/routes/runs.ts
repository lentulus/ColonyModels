import { Router } from "express";
import { nanoid } from "nanoid";
import type { DbRepo } from "../db.js";
import { createRunBodySchema } from "../schemas.js";

export function runsRouter(db: DbRepo): Router {
  const router = Router();

  router.post("/", (req, res) => {
    const r = createRunBodySchema.safeParse(req.body);
    if (!r.success) {
      return res.status(400).json({ error: "validation failed", issues: r.error.issues });
    }
    const run = {
      ...r.data,
      id: nanoid(),
      createdAt: Math.floor(Date.now() / 1000),
    };
    db.runs.create(run);
    res.json({ id: run.id });
  });

  router.get("/", (_req, res) => {
    res.json(db.runs.list());
  });

  router.get("/:id", (req, res) => {
    const run = db.runs.get(req.params.id);
    if (!run) return res.status(404).json({ error: "run not found" });
    res.json(run);
  });

  router.delete("/:id", (req, res) => {
    db.runs.delete(req.params.id);
    res.json({ ok: true });
  });

  return router;
}

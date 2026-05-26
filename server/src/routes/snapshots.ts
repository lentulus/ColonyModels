import { Router } from "express";
import type { DbRepo } from "../db.js";
import { snapshotArraySchema, afterQuerySchema } from "../schemas.js";

export function snapshotsRouter(db: DbRepo): Router {
  const router = Router();

  router.get("/:id/snapshots", (req, res) => {
    res.json(db.snapshots.list(req.params.id));
  });

  router.put("/:id/snapshots", (req, res) => {
    const r = snapshotArraySchema.safeParse(req.body);
    if (!r.success) {
      return res.status(400).json({ error: "validation failed", issues: r.error.issues });
    }
    db.snapshots.bulkUpsert(req.params.id, r.data);
    res.json({ ok: true });
  });

  router.delete("/:id/snapshots", (req, res) => {
    const r = afterQuerySchema.safeParse(req.query);
    if (!r.success) {
      return res.status(400).json({ error: "validation failed", issues: r.error.issues });
    }
    db.snapshots.dropAfter(req.params.id, r.data.after);
    res.json({ ok: true });
  });

  return router;
}

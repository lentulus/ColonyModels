import { Router } from "express";
import type { DbRepo } from "../db.js";
import { eventSchema, afterQuerySchema } from "../schemas.js";

export function eventsRouter(db: DbRepo): Router {
  const router = Router();

  router.get("/:id/events", (req, res) => {
    res.json(db.events.list(req.params.id));
  });

  router.post("/:id/events", (req, res) => {
    const r = eventSchema.safeParse(req.body);
    if (!r.success) {
      return res.status(400).json({ error: "validation failed", issues: r.error.issues });
    }
    db.events.append(req.params.id, r.data);
    res.json({ ok: true });
  });

  router.delete("/:id/events", (req, res) => {
    const r = afterQuerySchema.safeParse(req.query);
    if (!r.success) {
      return res.status(400).json({ error: "validation failed", issues: r.error.issues });
    }
    db.events.dropAfter(req.params.id, r.data.after);
    res.json({ ok: true });
  });

  return router;
}

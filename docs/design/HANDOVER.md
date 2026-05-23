# Phase 1 Handover

Written 2026-05-23. If the Claude window closes mid-task, this is the file the
next assistant should read first. It is a pointer document — it does not
restate the design; it tells you what's been decided and what to do next.

## What the project is

R&D sandbox for interstellar-colony models. Phase 1 implements Turchin's
"basic demographic-fiscal" model (Eq 7.4 in *Historical Dynamics*, 2003) as a
single-user web app: client owns the simulation, server is durable storage.
Winners get promoted into the sibling project **MeridianWorlds** (port 8000);
this project runs on **port 8001**.

## What to read, in order

1. [intent.md](intent.md) — one screen, the user's original goals.
2. [Phase1Options.md](Phase1Options.md) — survey of model choices with the
   user's annotated decisions inline (`==>` markers).
3. [Phase1Design.md](Phase1Design.md) — **the authoritative design**. Sections
   15, 16, 17 capture every resolved decision and the blank-run defaults.
4. [../../README.md](../../README.md) — how to run the existing scaffold.

Reference material: `docs/reference/` contains the Turchin PDF (gitignored).
Equations cited in the design are from Chapter 7 and Appendix A.

## Decisions already made (do not re-litigate)

- **Model:** Option C (basic demographic-fiscal), with the type system shaped
  to extend to Option D later.
- **Architecture:** Client runs the sim (RK4 by hand, ~20 lines). Server is
  Express + better-sqlite3 storing runs, events, and a snapshot cache.
- **Source of truth:** the append-only event timeline. Snapshots are a
  derived cache.
- **Time:** scaled years internally, seconds-since-epoch externally,
  month-sized UI ticks by default.
- **Display units:** stored scaled; multiplied by `peoplePerUnit` (default
  1000) only in the plot layer.
- **Founding date default:** 2300-01-01 UTC (epoch 10,413,792,000).
- **Run names:** required at creation.
- **Default play speed:** 1 sim-year per real-second (12 month-ticks/sec).
- **Persistence:** SQLite, durable.
- **Shared types workspace:** set up now, in the first PR.
- **No real-time / SSE / WebSocket** in Phase 1. No multi-user. No 3D.

## Current repo state

```
ColonyModels/
├── client/    Vite + React + R3F scaffold (App.tsx renders a spinning cube)
├── server/    Express scaffold (only /health endpoint, port 8001)
└── docs/
    ├── design/  intent.md, Phase1Options.md, Phase1Design.md, HANDOVER.md
    └── reference/  Turchin PDF (gitignored)
```

Single commit on `main`: `d94f60e Initial scaffold: npm-workspaces TS monorepo (client + server)`.
No application code yet — only scaffolding. The R3F canvas in
[client/src/App.tsx](../../client/src/App.tsx) will be replaced by the 2D plot UI.

## Sequencing — what to build next

From Phase1Design.md §12, the planned weekly slices. Pick up wherever the
last session left off (check `git log` and `git status`):

| Week | Slice | Files mostly touched |
|------|-------|----------------------|
| 1 | Shared types workspace + `rhsC` + `rk4Step` + hardcoded client page that runs 200 yr and plots one `LineChart`. No server, no events, no rewind. Validates math + plot stack. | new `shared/` workspace, `client/src/sim/`, replace `App.tsx`, add `recharts` |
| 2 | Persistence: SQLite schema (§7.1), `POST /api/runs`, `PUT /api/snapshots`, client flush on advance. Refresh-restores-run. | `server/src/db.ts`, `server/src/routes/`, `client/src/store/api.ts` |
| 3 | Events: timeline, replay-from-zero, parameter sliders emit param-set events. Branching as destructive op. | `client/src/sim/replay.ts`, `server/src/routes/events.ts`, `client/src/ui/Controls.tsx` |
| 4 | Rewind + scrub: cursor, slider, click-on-plot navigation. Snapshot-cache reuse. | `client/src/store/runStore.ts`, `client/src/ui/Plot.tsx` |
| 5-6 | Tests (integrator vs analytic logistic; replay determinism; HTTP round-trip), polish, demo recipe. | `*.test.ts` files, `README.md` |

The "blank-run template" in §17 is the single source of truth for default
parameters; reference that constant rather than inlining numbers.

## Sanity check that must pass

With the §17 defaults (r=0.02, β=0.25, c=3, s0=1, N=0.2, S=0), running for
~600 years should produce a clear secular cycle with period ~200-300 years.
If you get monotonic growth or runaway oscillation, the integrator or the
$S \ge 0$ clamp is broken — fix before moving on.

## Libraries already chosen (Phase1Design.md §9)

- `better-sqlite3` (server persistence)
- `zod` (boundary validation, shared between workspaces)
- `nanoid` (RunId)
- `recharts` (2D plotting)
- `zustand` (client state)
- `vitest` (tests)

None of these are installed yet — they go in with the first slice that needs
them.

## What the user has signaled about working style

- Strong preference for explicit, terse design docs with the *why* alongside
  the *what*. They annotate options with `==>` markers and expect later
  changes to thread back to those annotations.
- Wants the design pinned before code. The current ask was design + handover,
  **not** implementation. Confirm before starting Week 1 unless told to go.
- Conversation continuity is fragile — they have closed the window mid-task
  before. Write durable artifacts, not just chat replies.

## Open seams flagged for later phases (do NOT build now)

- Exogenous resupply (`resupplyRate` param or `supply-drop` event) — design
  §6.7. Leave a `// TODO: supply` comment in `rhsC` so the seam is visible.
- Option D widening to `(P, E, S)` — design §3 and §14. The discriminator on
  `ModelKind` is already there for this.
- MeridianWorlds integration — design §14. The seconds-since-epoch time
  anchor and JSON snapshot shape are deliberately compatible.
- Non-Turchin alternatives (Allee, resource-limited LV without humans as
  prey, Ricker/Beverton-Holt) — design §13. Each lands as a new `ModelKind`.

## If you're resuming and aren't sure where things stand

1. `git log --oneline -20` — what's been committed.
2. `git status` — what's mid-flight.
3. Compare `client/src/` and `server/src/` against the file layout in
   Phase1Design.md §10. The gap tells you which slice to work on.
4. Read this file's "Decisions already made" section and confirm the user
   hasn't superseded any of them in a more recent design-doc edit.

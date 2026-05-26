# Phase 1 Handover

Last refreshed 2026-05-26 at the end of Slice 3. Slice 3 shipped clean
(closeout commit `74583b9 green: Slice 3 — persistence + HTTP`); the
next session starts **Slice 4 (client store + api wrappers)**.

This document is the cross-session continuity index — read it first if
you're picking up the project from a fresh Claude window. It points to
the authoritative docs rather than restating them.

---

## TL;DR for a fresh session

**Slices 0, 1, 2, and 3 are complete and green.** Math layer (`rhsC`,
`rk4Step`, `advanceTick`), replay engine (`paramsAt`, `replayTo`), and
now the full server (SQLite repo + 10 REST endpoints under
`/api/runs/...` with zod validation at the boundary) are all
implemented and locked by 32 client tests + 13 server tests. All three
Slice 0 anchors are permanently green: `logistic.analytic.test.ts`
(0.2.1), `turchin.cycle.test.ts` (0.2.2), `runs.roundtrip.test.ts`
(0.2.3 closed this slice).

**Next action: Slice 4 — client store + api wrappers.** First
checklist step is **4.1.1 [AI]** (write `client/src/store/runStore.test.ts`
with a mocked fetch layer covering `createRun`, `appendEvent`,
`rewindTo`, `advance`, `flushToServer`).

### ⚠️ Mandatory prep before 4.1.1: set up TS project references

R-018 is the one carry-over that **must be done first**. Right now the
server's `tsc` resolves `@colonymodels/shared` via package.json
`exports` → `shared/dist/index.d.ts`; if `shared/src` changes without
a rebuild, server's typecheck reads stale types. Slice 4 starts wiring
client → shared → server cross-references for real; doing more
workspace-boundary work without composite project references will
multiply this hazard.

Concrete steps before 4.1.1:
- Add `"composite": true` to `shared/tsconfig.json` (requires
  `declaration: true`, already implied by emit).
- Add `references: [{ "path": "../shared" }]` to both
  `client/tsconfig.json` and `server/tsconfig.json`.
- Change build scripts to `tsc -b` (replaces `tsc -p`).
- Confirm `npm run typecheck` and `npm run build` still clean.
- File this as a numbered checklist step before 4.1.1 per
  [[feedback-checklist-authoritative]] — call it `4.0.1` or amend the
  Slice 4 block.

### What Slice 4 is for

Slice 4 wires the client to the server built in Slice 3:

- **`client/src/store/api.ts`** — thin fetch wrappers around
  `/api/runs/...` per [Phase1Design.md §10](Phase1Design.md).
- **`client/src/store/runStore.ts`** — Zustand store per
  [Phase1Design.md §8.1](Phase1Design.md): holds the current `run`,
  `events`, `snapshots` cache, `cursor`, `isDirty`; exposes
  `createRun`, `appendEvent`, `setCursor`, `advance`, `rewindTo`,
  `flushToServer`.
- **`App.tsx`** loads/creates a run via the store and persists every
  advance.

End-of-slice acceptance is **3.3.3 + 4.3.3**: refresh the page in the
browser and watch the run come back from the server.

---

## Current state

```
HEAD: 74583b9 green: Slice 3 — persistence + HTTP (closeout tracking sweep)
      17ba11e green: Slice 3.2 — persistence + HTTP routes
      589f82c red:   Slice 3.1 — db repo CRUD + HTTP roundtrip + zod rejection
      323ee28 docs:  refresh HANDOVER.md for Slice 2 → Slice 3 transition
      3660781 green: Slice 2 — replay engine
      ...

Branch: main, ahead of origin/main by 1 commit at refresh time
        (the closeout 74583b9; rest of Slice 3 already on origin since
        user pushed mid-slice). Working tree clean. Push when ready.
```

**Verifications (all should still pass at session start):**

- `npm test`: client 41/41 across 6 files; server 13/13 across 2 files
  (5 db sub-cases in `db.test.ts` + 8 HTTP sub-cases in
  `routes/runs.roundtrip.test.ts`, including 4 zod-rejection it()s);
  shared "No test files found" (1.1.1 documented skip — `npm test` at
  root will exit 1 for that reason alone, even though all real tests
  pass).
- `npm run typecheck`: clean across all 3 workspaces.
- `npm run build`: clean across all 3 workspaces.

If any of these don't match: somebody touched the tree between sessions
— **ask the user before proceeding.**

---

## What landed in Slice 3

| Slice block | What landed |
|---|---|
| 3.1 (`589f82c`) | Red phase: `server/src/db.test.ts` (5 sub-cases — runs-create-read, events-append with seq tiebreaker, snapshots-bulk-upsert, events-drop-after, cascade-delete); extended Slice 0 anchor `runs.roundtrip.test.ts` (8 it()s — 3 per-endpoint kept + 1 full-sequence + 4 zod-rejection). Commits the DbRepo + 400-body contracts via typed imports / helpers. |
| 3.2 (`17ba11e`) | Implementation: `server/src/db.ts` (better-sqlite3 with prepared statements, JSON columns, `PRAGMA foreign_keys=ON`, bulk-upsert in transaction); `server/src/schemas.ts` (zod schemas at I/O boundary, `N >= 0` enforced); `routes/{runs,events,snapshots}.ts` (10 endpoints, safeParse + 400 `{error,issues}` on failure); `app.ts` extracted from `index.ts`; `vitest.config.ts` sets `DB_URL=":memory:"` for tests. |
| 3.2 tooling | Two non-checklist adaptations forced by the environment: `better-sqlite3` pinned to `^12.9.0` ([[risk-017]] — v12.10+ dropped Node 20 prebuilds, system has no C toolchain); `shared/package.json` exports → `dist/` + `server/tsconfig.json` dropped paths mapping ([[risk-018]] — resolves rootDir conflict when server tsc tries to compile `shared/src`). |
| 3.3 (`74583b9`) | Closeout: tracking sweep across [Phase1Retros.md](Phase1Retros.md), [Phase1RiskRegister.md](Phase1RiskRegister.md) (R-015 closed, R-017 + R-018 filed), [Phase1DoD.md](Phase1DoD.md) (Slice 2's 0.2.3 waiver retired, Slice 3 sign-off 17/18 with README waiver to Slice 5), [Phase1AutomatedTests.md](Phase1AutomatedTests.md) (3.1.1 + 3.1.2 execution logs backfilled), [Phase1Checklist.md](Phase1Checklist.md) (3.1.1 through 3.3.5 ticked). |

Three pattern shifts vs Slice 2 worth noting:

- **Contract-by-test, then implement.** 3.1.1 committed the full
  `DbRepo` interface via `import { openDb, type DbRepo } from "./db.js"`
  before any of `db.ts` was written; 3.1.2's `expectZod400` helper
  committed the 400-body shape before any route existed. Slice 3.2's
  implementation phase was then pure transcription — no design
  decisions during implementation. Reusable pattern for any
  interface-driven slice.
- **Live curl demo as the slice's visible artifact.** Slice 3 has zero
  UI surface; the 3.3.3 demo (Node fetch script against a
  backgrounded server with `DB_URL=:memory:`) gave the otherwise
  invisible slice a concrete artifact the user could look at. Reusable
  template for any future server-only slice.
- **New behavioural rule: [[feedback-gui-only-review]].** User can't
  meaningfully review code-level contract decisions at `[HUMAN]`
  technical gates. Single-yes procedural ack for technical review;
  double-yes still applies for action authorization (commit, push).
  Saved this slice.

---

## What to read, in order

1. **This file** (you're reading it).
2. [Phase1Checklist.md](Phase1Checklist.md) — find the most recent
   ticked box (3.3.5); the next unchecked is the Slice 4 block (4.1.1),
   but file the TS-project-references step first (see Mandatory prep
   above).
3. [Phase1Design.md §8](Phase1Design.md) — client runtime, esp. §8.1
   (Zustand store shape) and §8.2 (tick loop).
4. [Phase1Design.md §6](Phase1Design.md) — replay engine semantics,
   esp. §6.4 branching (caller-side per Slice 2 decision: no helper
   exported).
5. [Phase1AutomatedTests.md §4.1.1](Phase1AutomatedTests.md) — store
   test spec for the upcoming red phase.
6. [Phase1Retros.md "Slice 3"](Phase1Retros.md) — surprises,
   what-worked, what-to-change, and the action item to set up TS
   project references before any Slice 4 cross-workspace work.

Skim only if time permits:

7. [Phase1RiskRegister.md](Phase1RiskRegister.md) — R-001..R-018 (Slice 3
   closed R-015; R-013, R-017, R-018 carry forward).
8. [Phase1DoD.md](Phase1DoD.md) — DoD checklist + Sign-off table
   showing Slices 1, 2, 3 signed off.

---

## Behavioural rules (loaded automatically via MEMORY.md)

All durable feedback memories remain active. Most consequential in
practice for the upcoming slice:

- **[[feedback-gui-only-review]]** (new in Slice 3) — `[HUMAN]`
  technical-review gates get single-yes procedural ack; no contract
  checklist. GUI gates with visible change get full presentation. Slice
  4 will hit 4.3.3 (refresh page, confirm run restored) which IS a
  visible-GUI gate — present that one in full.
- **[[feedback-double-approval]]** — still the rule for action gates
  (commit, push, destructive operations).
- **[[feedback-checklist-authoritative]]** — file the TS-project-references
  prep as a numbered step before doing it. Same pattern as Slice 2's
  R-014 / R-016 amendments.
- **[[feedback-test-first]]** — `red:` then `green:` commit prefixes;
  failing tests before implementation. (UI excluded — `fix:` for UI.)
- **[[feedback-implementation-model]]** — never push without explicit ask.
- **[[feedback-explain-errors-in-output]]** — annotate every error /
  FAIL in tool output.
- **[[feedback-no-tlas]]** — avoid PM-jargon abbreviations.
- **[[feedback-positive-deferral-reasons]]** — positive engineering
  reason for defers, not "wasn't in the plan."

---

## Decisions already made (do not re-litigate)

- **Server is a thin storage layer.** No model code on the server.
  Integration is client-side; the server stores `runs`, `events`, and
  client-computed `snapshots`. See
  [Phase1Design.md §7.3](Phase1Design.md). Slice 3 is locked.
- **Schema:** three tables (`runs`, `events`, `snapshots`) with
  `ON DELETE CASCADE` on `runs.id` (§7.1). Implemented at 3.2.2.
- **Validation:** `zod` at the HTTP boundary only. Internal calls trust
  internal types. 400 body shape is `{ error: string, issues: ZodIssue[] }`.
- **Client store:** Zustand per §8.1. Single store, no Provider.
- **Fetch wrappers:** plain `fetch` in `client/src/store/api.ts`. No
  axios, no react-query. Phase 1 is single-user, no auth, no retries.
- **Persistence:** local SQLite file at `./colonymodels.db` (default
  `DB_URL` if unset); `:memory:` for tests.
- **Libraries** for Slice 4: `zustand`. That's it. (Confirmed
  [Phase1Design.md §9](Phase1Design.md).)
- **Better-sqlite3 pin:** `^12.9.0` (see [[risk-017]]). Do not
  upgrade without first installing `build-essential` or upgrading
  Node.
- **Module:** Option C (Turchin Eq 7.4); §17 BLANK_RUN at Turchin Fig
  7.1 verbatim (`r=0.02, β=0.25, c=3, s0=10, N0=0.5, S0=0`).
- **Integrator:** Generic `rk4Step<S>` per
  [Decision 0004](adr/0004-generic-rk4-integrator.md); `N ≥ 0` clamp
  inside `rk4Step`, `S ≥ 0` manual reset in `advanceTick`.
- **Replay engine:** `paramsAt` walks sorted events; `replayTo` splits
  ticks around event boundaries. Branching is caller-side
  (`[...events.filter(e => e.tEpoch <= tr), newEvent]`) — no helper.
- **Asserts:** properties under `describe("properties", ...)` blocks
  in the same file as example tests; `fc.double` (not `fc.float`).
- **tsconfig test-excludes:** kept (vitest owns test typechecking).
  R-015 closed on that basis.
- **shared/exports → dist:** kept; resolves server's rootDir
  conflict. Coupling tracked as R-018 — fix via TS project references
  at Slice 4.0.

---

## Open active risks

In [Phase1RiskRegister.md](Phase1RiskRegister.md):

| ID | Status | Notes |
|---|---|---|
| R-001..R-012 | Open | Distributed across slices per their target. |
| R-013 | Open | `esbuild`/`vite` moderate vuln; deferred to Slice 6 polish per original plan. |
| ~~R-014~~ | Closed | Slice 2.1.0 + 2.2.3. |
| ~~R-015~~ | Closed | Slice 3 — decision: keep tsconfig excludes; vitest owns test typechecking. |
| ~~R-016~~ | Closed | Slice 2.2.0 + 2.2.3. |
| **R-017** | **Mitigated** | `better-sqlite3` pinned to `^12.9.0`; v12.10+ dropped Node 20 prebuilds. Re-evaluate on Node 22+ upgrade or `build-essential` install. |
| **R-018** | **Mitigated** | Server `tsc` reads `shared/dist/index.d.ts`; stale dist = stale types. **Fix planned for Slice 4.0 — TS composite project references.** Mandatory prep before 4.1.1. |

Slice 3 retro action items:
- Set up TS project references first (R-018) — Claude, Slice 4.0.
- Re-evaluate tsconfig test-excludes (keep vs remove) — Claude,
  Slice 4 or 5.
- Document `better-sqlite3@^12.9.0` pin in README — Claude, Slice 6
  polish (this is also the deferred README update from the Slice 3
  DoD waiver).
- Carry the "live curl demo" pattern into Slice 4 server-adjacent
  review gates as the visible-artifact substitute — Both.

---

## Open seams flagged for later phases (do NOT build now)

- Exogenous resupply (`resupplyRate` param or `supply-drop` event) —
  `// TODO: supply` marker in
  [model.ts](../../client/src/sim/model.ts).
- Option D widening to `(P, E, S)` — `ModelKind` discriminator ready
  in [shared/src/index.ts](../../shared/src/index.ts).
- MeridianWorlds integration.
- Non-Turchin alternatives (Allee, Ricker, etc.).
- F-1.3.3-1 (time-scale toggle) + F-1.3.3-2 (brush) — deferred from
  Slice 1.3.3 to Slice 5's `Controls.tsx`.
- `dev:client-only` script (from Slice 2 retro) — deferred to Slice 5
  / 6 polish.
- Snapshot cache lifecycle — Slice 4's store concern. The server
  stores snapshots when the client PUTs them; the client owns the
  cache lifecycle (per [Phase1Design.md §6.5](Phase1Design.md)).
- Schema versioning (`schema_version INTEGER` column on `runs` per
  R-007 mitigation) — was planned for Slice 3 but not actually
  implemented. Carry into Slice 6 polish or revisit before Phase 2
  begins.

---

## First steps in a new session

1. Read this file in full (especially the "Mandatory prep" + "What
   Slice 4 is for" blocks above).
2. `git status` + `git log --oneline -5` — confirm HEAD is `74583b9`
   and working tree is clean. If different, the user did something
   between sessions; **ask before touching anything**.
3. Run `npm test`, `npm run typecheck`, `npm run build` — confirm
   they match the "Verifications" block above. If anything has
   drifted, ask.
4. **Before 4.1.1:** file the TS-project-references prep as a
   numbered checklist step (e.g., `4.0.1` or amend the Slice 4 block
   header). Then echo + double-yes for the actual tsconfig edits
   (they affect typecheck behaviour across all workspaces). After
   that's green, proceed to 4.1.1.
5. 4.1.1 [AI] writes `client/src/store/runStore.test.ts` against
   mocked fetch — state-transition assertions per
   [Phase1AutomatedTests.md §4.1.1](Phase1AutomatedTests.md).
6. The first visible-GUI gate in Slice 4 is **4.3.3** (refresh page,
   confirm run restored). Present that one in full per
   [[feedback-gui-only-review]] — user has real signal there.

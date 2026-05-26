# Phase 1 Handover

Last refreshed 2026-05-26 at the end of Slice 2. Slice 2 shipped clean
(closeout commit `3660781 green: Slice 2 — replay engine`); the next
session starts **Slice 3 (persistence + HTTP)**.

This document is the cross-session continuity index — read it first if
you're picking up the project from a fresh Claude window. It points to
the authoritative docs rather than restating them.

---

## TL;DR for a fresh session

**Slices 0, 1, and 2 are complete and green.** The math layer (`rhsC`,
`rk4Step`, `advanceTick`) and the replay engine (`paramsAt`, `replayTo`)
are both implemented, both audited against Turchin Ch. 7 via citation-
anchored derivations in
[Phase1MathDerivations.md](Phase1MathDerivations.md), and both locked by
Asserts properties (P-M-1..7, P-I-1..6, P-R-1..6 — 19 properties total
at 100 runs each).

**Next action: Slice 3 — persistence + HTTP.** First checklist step is
**3.1.1 [AI]** (write `server/src/db.test.ts`). No critical carry-over
into this slice — Slice 2 closed clean.

### What Slice 3 is for

Slice 3 turns ColonyModels into a real client-server system. The server
(Express + SQLite via `better-sqlite3`) becomes a thin persistence layer:

- Three tables: `runs`, `events`, `snapshots` (per
  [Phase1Design.md §7.1](Phase1Design.md)).
- Ten REST endpoints under `/api/runs/...` (per §7.2): CRUD for runs,
  append/list/drop-after-T for events, bulk upsert/list/drop for
  snapshots.
- `zod` validation at the HTTP boundary; SQLite cascade on
  `DELETE FROM runs`.

Crucially, **the server does not run the model** (§7.3): integration
stays client-side, the server only stores and serves what the client
computed. This keeps the server tiny and trivially replaceable later
(e.g. by a MeridianWorlds-internal store).

End-of-slice, the Slice 0 HTTP-roundtrip anchor
[server/src/routes/runs.roundtrip.test.ts](../../server/src/routes/runs.roundtrip.test.ts)
flips from red-at-import to green, closing the last waived Slice 0
anchor and clearing the R-015 tsconfig-exclude carry-over.

---

## Current state

```
HEAD: 3660781 green: Slice 2 — replay engine
      fd09e7e test: Slice 2.3.3b — Asserts properties P-R-1..6 for replay engine
      77f4308 fix: Slice 2.3.3.fix-1 — round N tooltip display to integers
      673ecd5 green: Slice 2.2.2 — App.tsx drives the plot via replayTo
      eae0a5f green: Slice 2.2.1 — replay engine implementation (paramsAt, replayTo)
      8d96242 docs+test: Slice 2.2.0 — R-016 amendment
      59a9125 red: Slice 2.1 — replay engine anchor tests
      30a1522 docs+test: Slice 2.1.0 — R-014 amendment
      ...

Branch: main, ahead of origin/main by 2 commits at refresh time
        (the closeout `3660781` and `fd09e7e`; rest of Slice 2 is already
        on origin). Working tree clean. Push when ready.
```

**Verifications (all should still pass at session start):**
- `npm test`: client 41/41 green across 6 test files (replay engine
  example sub-cases + Asserts properties + the model / integrator /
  cycle / logistic suites from Slice 1; Turchin cycle anchor 0.2.2 is
  green for the right reason — single-excursion derivation per
  [Phase1MathDerivations.md §3.3](Phase1MathDerivations.md)). Server:
  `runs.roundtrip.test.ts` red at import (`Cannot find module
  '../app.js'`) — Slice 0 anchor 0.2.3, formally waived to 3.2.4 in
  [Phase1DoD.md](Phase1DoD.md). Shared: no test files (1.1.1 documented
  skip).
- `npm run typecheck`: clean across all 3 workspaces.
- `npm run build`: clean across all 3 workspaces.

If any of these don't match: somebody touched the tree between sessions
— **ask the user before proceeding.**

---

## What landed in Slice 2

| Slice block | What landed |
|---|---|
| 2.1.0 (`30a1522`) | R-014 amendment — anchor `BLANK_RUN` synced to §17 verbatim; peak window `[80, 220]` → `[180, 280]`. |
| 2.1 (`59a9125`) | Red anchor tests for `paramsAt` / `replayTo` / branching / mid-tick (6 sub-cases). |
| 2.2.0 (`8d96242`) | R-016 amendment — trough check replaced with `peakCount===1` + `\|N(500yr)-1\| < 0.05` + monotonic-tail. (Mid-slice surprise: R-014 widened the peak window but didn't audit the rest of the assertion chain; R-016 was the trough assertion in the same `it(...)` block that R-014 missed.) |
| 2.2.1 (`eae0a5f`) | `client/src/sim/replay.ts` — `paramsAt` + `replayTo`. 75 lines. Branching helpers left to caller per YAGNI. |
| 2.2.2 (`673ecd5`) | `App.tsx` drives the plot through `replayTo` — same code path as the Turchin anchor. |
| 2.3.3.fix-1 (`77f4308`) | UI fix — round `N_people` in the tooltip to integers (people are discrete; full precision retained in `N_scaled`). |
| 2.3.3b (`fd09e7e`) | Asserts properties P-R-1..6 added inline in `replay.test.ts` (analog of Slice 1.3.4e). |
| 2.3 closeout (`3660781`) | DoD sign-off; tracking sweep (`Phase1RiskRegister.md` R-014 + R-016 moved Open → Closed; `Phase1Retros.md` Slice 2 entry; `Phase1AutomatedTests.md` 0.2.2 refresh + execution-log backfill; `Phase1DoD.md` Slice 2 sign-off row). |

Two pattern shifts vs Slice 1 worth noting:

- **Per-step commits replaced bundled `wip:` commits.** Slice 2 has 8
  commits, each one a meaningful diff. Audit trail is dramatically more
  legible.
- **Two §17-verbatim audit amendments (2.1.0 and 2.2.0)** used the same
  `docs+test: Slice 2.X.0 — R-NNN amendment` commit shape with
  substeps a–h. Pattern is reusable for any future "test-amendment
  before next implementation step" need.

---

## What to read, in order

1. **This file** (you're reading it).
2. [Phase1Checklist.md](Phase1Checklist.md) — find the most recent
   ticked box (2.3.7); the next unchecked is the Slice 3 block (3.1.1).
3. [Phase1Design.md §7](Phase1Design.md) — server contract (schema +
   endpoints + what the server does NOT do).
4. [Phase1Design.md §10](Phase1Design.md) — module / file layout for
   the server.
5. [Phase1AutomatedTests.md §3.1.1 + §3.1.2](Phase1AutomatedTests.md) —
   db CRUD + HTTP roundtrip test specs.
6. [Phase1Retros.md "Slice 2"](Phase1Retros.md) — surprises,
   what-worked, what-to-change, action items including the standing
   rule to **refresh `Phase1AutomatedTests.md` alongside any test
   amendment** in the same commit.

Skim only if time permits:

7. [Phase1RiskRegister.md](Phase1RiskRegister.md) — R-001..R-016 (Slice 2
   closed R-014 + R-016; R-013 and R-015 carry forward).
8. [Phase1DoD.md](Phase1DoD.md) — DoD checklist + the Sign-off table
   showing Slices 1 and 2 signed off (Slice 2: 15/16 green, 1 partial
   waiver for 0.2.3 → closes at 3.2.4).

---

## Behavioral rules (loaded automatically via MEMORY.md)

All durable feedback memories remain active. Most consequential in
practice:

- **`feedback_double_approval`** — every `[HUMAN]` gate gets two
  explicit approvals with an echo in between. Apply without exception.
  Confirmed working across many gates in Slice 2.
- **`feedback_checklist_authoritative`** — if a task isn't a numbered
  step, it doesn't get done; amend the checklist first, then execute.
  Slice 2 made heavy use of this: 2.1.0 (R-014), 2.2.0 (R-016),
  2.3.3.fix-1, 2.3.3b (properties + 0.2.3 waiver) were all filed first.
- **`feedback_test_first`** — `red:` then `green:` commit prefixes;
  failing tests before implementation. (UI excluded — `fix:` for UI.)
- **`feedback_implementation_model`** — never push without explicit ask.
- **`feedback_explain_errors_in_output`** — annotate every error / FAIL
  in tool output.
- **`feedback_no_tlas`** — avoid PM-jargon abbreviations.
- **`feedback_positive_deferral_reasons`** — positive engineering
  reason for defers, not "wasn't in the plan."

---

## Decisions already made (do not re-litigate)

- **Server is a thin storage layer.** No model code on the server.
  Integration is client-side; the server stores `runs`, `events`, and
  client-computed `snapshots`. See
  [Phase1Design.md §7.3](Phase1Design.md).
- **Schema:** three tables (`runs`, `events`, `snapshots`) with
  `ON DELETE CASCADE` on `runs.id` (§7.1).
- **Validation:** `zod` at the HTTP boundary only. Internal calls trust
  internal types.
- **Libraries** for Slice 3: `better-sqlite3` (synchronous SQLite),
  `nanoid` (run IDs — already imported by shared as `RunId`), `zod`.
  Confirmed by [Phase1Design.md §9](Phase1Design.md).
- **Model:** Option C (Turchin Eq 7.4); §17 BLANK_RUN at Turchin Fig 7.1
  verbatim (`r=0.02, β=0.25, c=3, s0=10, N0=0.5, S0=0`).
- **Integrator:** Generic `rk4Step<S>` per
  [Decision 0004](adr/0004-generic-rk4-integrator.md); `N ≥ 0` clamp
  inside `rk4Step`, `S ≥ 0` manual reset in `advanceTick`.
- **Replay engine:** `paramsAt` walks sorted events; `replayTo` splits
  ticks around event boundaries (mid-tick event applied at exact event
  time, snapshots on tick boundaries only). Branching is caller-side
  (`[...events.filter(e => e.tEpoch <= tr), newEvent]`) — no helper
  exported.
- **Asserts:** properties under `describe("properties", ...)` blocks in
  the same file as example tests; `fc.double` (not `fc.float`) for
  arbitrary-range doubles in fast-check 4.x.
- **tsconfig:** test files excluded from tsc on both workspaces. **Up
  for re-evaluation at 3.2.4** when `app.ts` lands (per R-015 closure
  plan).
- **Math correctness:** AI derives + cites; human audits citations,
  not derivations. Pattern reusable for Slice 5.3.3.
- **Architecture / time / units / founding date / persistence /
  libraries:** unchanged — see
  [Phase1Design.md §0, §16, §17](Phase1Design.md).

---

## Open active risks

In [Phase1RiskRegister.md](Phase1RiskRegister.md):

| ID | Status | Notes |
|---|---|---|
| R-001..R-012 | Open | Distributed across slices per their target. |
| R-013 | Open | esbuild/vite moderate vuln; deferred to Slice 6 polish per original plan. |
| ~~R-014~~ | Closed | Closed 2026-05-26 at Slice 2.1.0 + 2.2.3. |
| **R-015** | **Mitigated** | tsconfig exclude on both workspaces. **Closes at 3.2.4** when `server/src/app.ts` lands — at that point the server exclude can stay (defensible: tests belong to vitest's pipeline) or be removed. Re-evaluate. |
| ~~R-016~~ | Closed | Closed 2026-05-26 at Slice 2.2.0 + 2.2.3. |

No new risks filed during Slice 2 retro beyond R-016. The Slice 2 retro
documented a standing-rule action item: **at every test-amendment step
(`N.M.0`), include a substep to refresh `Phase1AutomatedTests.md` to
match the new test shape, in the same commit.** Apply in Slice 3 if any
test amendments arise.

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
- `dev:client-only` script (from Slice 2 retro action items) — deferred
  to Slice 5 / 6 polish.
- Snapshot cache (Phase1Design §6.5) — Slice 4's store concern, not
  Slice 3's. The server stores snapshots when the client PUTs them; the
  client owns the cache lifecycle.

---

## First steps in a new session

1. Read this file in full (especially the "What Slice 3 is for" block
   above).
2. `git status` + `git log --oneline -5` — confirm HEAD is `3660781`
   and working tree is clean. If different, the user did something
   between sessions; **ask before touching anything**.
3. Run `npm test`, `npm run typecheck`, `npm run build` — confirm they
   match the "Verifications" block above. If anything has drifted, ask.
4. Open [Phase1Checklist.md](Phase1Checklist.md), find the Slice 3
   block. The first unchecked step is **3.1.1 [AI]** — write
   `server/src/db.test.ts` (in-memory SQLite; runs / events / snapshots
   CRUD; foreign-key cascade on `DELETE FROM runs`). Slice 3 has **no
   amendments to file before 3.1.1** (unlike Slice 2's R-014
   carry-over) — Slice 2 closed clean.
5. Slice 3 red phase (3.1.1 → 3.1.7) writes both `db.test.ts` (new) and
   fleshes out `runs.roundtrip.test.ts` (currently a Slice 0 skeleton).
   The red commit at 3.1.7 should leave both red at assertion or import
   per their respective dependencies.

# Phase 1 Handover

Last refreshed 2026-05-29 mid-Slice 4. Slice 4.0 closed clean
(`953cff8 chore: Slice 4.0 — TS composite project references`); Slice
4.1 is **in flight** — the red test file is written and confirmed red,
awaiting **4.1.4 [HUMAN] red review** before the `red:` commit at 4.1.6.

This document is the cross-session continuity index — read it first if
you're picking up the project from a fresh Claude window. It points to
the authoritative docs rather than restating them.

---

## TL;DR for a fresh session

**Slices 0, 1, 2, 3 are complete and green; Slice 4.0 is complete
(R-018 closed); Slice 4.1 is mid-red.** Math layer, replay engine, full
server (SQLite repo + 10 REST endpoints + zod validation), and the
TypeScript composite project references that wire the workspaces
together are all in. The client store test file
(`client/src/store/runStore.test.ts`, 10 `it()` blocks across the 7
sub-cases from [Phase1AutomatedTests.md §4.1.1](Phase1AutomatedTests.md))
is written and confirmed red at module resolution.

**Next action: 4.1.4 [HUMAN] red review.** The red-review summary was
posted at the close of the prior session — see the "Red review surface"
section below; bring it back into the new session's chat verbatim if
that's useful. After ack: 4.1.5 [HUMAN] approve red commit → 4.1.6
[AI] commit `red:`.

**Working tree is not clean.** Two uncommitted artifacts:
- `client/src/store/runStore.test.ts` — untracked, the Slice 4.1 red
  test file (~330 lines).
- `docs/design/Phase1Checklist.md` — modified; carries the backfilled
  `*Result:*` lines for 4.0.4, 4.1.1, 4.1.2 (and any HANDOVER refresh
  step if one gets filed retroactively, see "Off-checklist actions"
  below).

Both should land as a single `red: Slice 4.1` commit at 4.1.6.

---

## Current state

```
HEAD: 953cff8 chore: Slice 4.0 — TS composite project references (resolves R-018)
      f40ab17 docs: refresh HANDOVER.md for Slice 3 → Slice 4 transition
      74583b9 green: Slice 3 — persistence + HTTP (closeout tracking sweep)
      17ba11e green: Slice 3.2 — persistence + HTTP routes
      589f82c red:   Slice 3.1 — db repo CRUD + HTTP roundtrip + zod rejection
      ...

Branch: main, ahead of origin/main by 1 commit (953cff8).
Working tree DIRTY (see TL;DR above).
```

**Verifications expected at session start** (run all three to confirm
state matches this handover; if anything has drifted, ask the user
before proceeding):

- `git status`: shows `docs/design/Phase1Checklist.md` modified +
  `client/src/store/` untracked. If clean instead, the user committed
  the red phase between sessions — HEAD should be a `red: Slice 4.1`
  commit; skip ahead to 4.2 implementation prep.
- `cd client && npx vitest run`: 1 failed | 6 passed (7) files; 41
  passed tests; the failed file is `runStore.test.ts` with the line-11
  error `Cannot find module './runStore'` (expected red, §11.2 rule 2).
- `cd server && npx vitest run`: 13/13 across 2 files, unchanged.
- `npm run typecheck`: clean across all 3 workspaces.
- `npm run build`: clean across all 3 workspaces (`tsc -b` now in build
  scripts; client emits 507.97 kB bundle, vite chunk-size warning is
  pre-existing informational).
- `git ls-files --others --exclude-standard | grep tsbuildinfo`: empty
  (the `.gitignore` added at 4.0.1.d catches these).

---

## What landed in Slice 4 so far

| Slice block | What landed |
|---|---|
| 4.0 (`953cff8`) | TS composite project references — `shared/tsconfig.json` adds `composite: true`; `client/tsconfig.json` + `server/tsconfig.json` add `references: [{ "path": "../shared" }]`; all three `package.json` `build` scripts swap from `tsc -p tsconfig.json` to `tsc -b`; `.gitignore` adds `*.tsbuildinfo` (composite emits at workspace root, not under `dist/`). Verification: `npm run typecheck` clean, `npm run build` clean, 41+13 tests unchanged. R-018 closed (mitigation → closed by virtue of the fix landing). [Phase1Checklist.md §4.0](Phase1Checklist.md) ticked through 4.0.4. |
| 4.1.1 (uncommitted) | `client/src/store/runStore.test.ts` written — ~330 lines, 10 `it()` blocks across 7 sub-cases. Mocked `globalThis.fetch` with per-call `{url, method, body, query}` recording. Assertions check URL + method + body, not just call counts (§4.1.1 pass criteria). Sub-cases: create, append-event, advance (×2 — state-transition and local-only), flush (×2 — happy-path and no-op-when-clean), rewind (×2 — happy-path and events-untouched), branch, api-error (×2 — server 500 and fetch reject). |
| 4.1.2 (uncommitted) | Vitest run confirmed: file fails at line 11 (`import { useRunStore } from "./runStore"` → module not found). 6 prior client files still pass (41 tests). Server + shared unchanged. Expected red per §11.2 rule 2. |
| 4.1.3 (uncommitted) | Red-review summary posted in chat — see "Red review surface" below. |

Two pattern-relevant observations from 4.0:

- **Discovery-driven amendment honored mid-step.** Step 4.0.1 was filed
  with three subpoints (a)/(b)/(c); after running the build, discovered
  that composite mode emits `tsconfig.tsbuildinfo` at workspace root
  (outside `dist/`). Per [[feedback-checklist-authoritative]], filed a
  fourth subpoint (d) on `.gitignore` *before* editing the gitignore.
  Reusable pattern: when a step turns up a related sub-action mid-flight,
  amend → echo → execute.
- **Non-test-first commit category.** Slice 4.0 was build-graph
  scaffolding, not behavior. `chore:` prefix used (config-only, no
  `red:`/`green:` cycle). Precedent for future infrastructure-only
  changes — `chore:` covers tsconfig/package.json/gitignore tweaks
  that aren't covered by `docs:` (which is reserved for prose docs).

---

## Red review surface for 4.1.4

Posted at the close of the prior session. Bring this back into chat
verbatim if useful for the new session's red review gate.

**Contract decisions in the test file worth scrutinizing:**

1. **PUT body = bare array** (matches server's `snapshotArraySchema` at
   `server/src/schemas.ts:61`). Not wrapped in `{snapshots: [...]}`.
2. **api-error: `isDirty` stays TRUE on failure.** Interpretation of
   §4.1.1's "store state unchanged" + failure mode "Optimistic state
   update not rolled back on PUT failure" = don't undo local state,
   don't pretend the flush succeeded; isDirty stays true so retry is
   possible. Alternative `lastError` field was explicitly listed as
   acceptable in §4.1.1; I went with thrown promise.
3. **Branch fires BOTH `DELETE /snapshots?after=…` AND `DELETE
   /events?after=…`.** Spec says "DELETE-after invoked with cursor"
   (singular). I went strict because dropping only snapshots leaves
   stale events past the branch — they'd replay on the next `advance`
   and corrupt the future. If reviewer prefers lenient (only
   snapshots), the assertion in the branch test changes.
4. **No `setCursor` test.** §4.1.1 doesn't list it as a sub-case; §8.1
   lists it for chart scrubbing. Deferred to Slice 5.

Also worth flagging:

- The `appendEvent` test verifies "subsequent advance uses new param"
  numerically: param-set sets `r=0`, then `advance(1)` should leave
  `N=0.5 ±1e-12` (since `dN/dt = r·production = 0` for any r=0
  regardless of S, kS, etc.). This is the cleanest numerical sanity
  check available without coupling the test to specific RK4 output.
- Per [[feedback-gui-only-review]] this is a **technical** red review,
  not GUI — single-yes ack is appropriate. The 4.1.4 ack does not need
  a contract checklist.

---

## What Slice 4 is for (unchanged from prior handover)

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

End-of-slice acceptance is **4.3.3**: refresh the page in the browser
and watch the run come back from the server.

---

## Off-checklist actions worth recording

This HANDOVER refresh is itself not a numbered checklist step. Prior
HANDOVER refreshes (323ee28 Slice 2→3, f40ab17 Slice 3→4) were treated
as ad-hoc continuity actions and committed as `docs:`. Two options for
this refresh:

- (a) Treat as continuity-only, **don't commit yet** — it carries
  uncommitted Slice 4.1 work in flight which should go into the
  4.1.6 `red:` commit anyway. The handover refresh then either lands
  alongside the red commit (if user is fine with it riding along) or
  in a follow-up `docs:` commit after.
- (b) File a numbered "mid-slice handover refresh" sub-step
  retroactively in [Phase1Checklist.md](Phase1Checklist.md) under the
  4.1 block and commit it separately as `docs:` per the prior
  HANDOVER-refresh precedent.

Recommendation: **(a)** — letting the handover refresh ride along with
the 4.1.6 `red:` commit avoids a churn `docs:` commit between phases of
the same slice. If the user prefers (b), file the sub-step first then
echo-and-commit. Either way, the refresh itself is not a Slice-4
deliverable.

---

## What to read, in order

1. **This file** (you're reading it).
2. [Phase1Checklist.md §4.1](Phase1Checklist.md) — confirm 4.0.1
   through 4.1.2 are ticked with results, 4.1.3 is the next pending
   step (or already ticked depending on how this session closed),
   4.1.4 is the next [HUMAN] gate.
3. [Phase1AutomatedTests.md §4.1.1](Phase1AutomatedTests.md) — the
   spec the test file encodes; bring this up next to the test file
   for the red review.
4. [Phase1Design.md §8.1](Phase1Design.md) — store shape; §8.2 tick
   loop; §10 client→server protocol.
5. [server/src/schemas.ts](../../server/src/schemas.ts) — the zod
   schemas the client must satisfy at the wire boundary. Particularly
   `snapshotArraySchema` (bare array, not wrapped) and `eventSchema`
   (discriminated union, bare object).
6. [server/src/routes/](../../server/src/routes/) — the 10 endpoints.
   Mostly relevant for the URL shapes and the `?after=T` query
   convention on DELETE.

Skim only if time permits:

7. [Phase1RiskRegister.md](Phase1RiskRegister.md) — R-018 closed by
   Slice 4.0; R-001..R-012 open, R-013 deferred to Slice 6, R-017
   mitigated.
8. [Phase1DoD.md](Phase1DoD.md) — DoD checklist + Sign-off table.
9. [Phase1Retros.md](Phase1Retros.md) — Slice 3 retro action items
   (R-018 now done; tsconfig test-excludes still open for re-evaluation
   in Slice 4 or 5; better-sqlite3 README note deferred to Slice 6).

---

## Behavioural rules (loaded automatically via MEMORY.md)

All durable feedback memories remain active. Most consequential in
practice for the next session:

- **[[feedback-gui-only-review]]** — 4.1.4 red review is a technical
  gate (no GUI surface): single-yes procedural ack, no contract
  checklist. The first visible-GUI gate in Slice 4 is 4.3.3 (refresh
  page, confirm run restored); present that one in full.
- **[[feedback-double-approval]]** — still the rule for action gates
  (commit, push, destructive operations). The 4.1.5 ack for the red
  commit and the 4.1.6 commit-command echo follow the double-yes
  pattern.
- **[[feedback-checklist-authoritative]]** — Slice 4.0 already
  demonstrated this with the (d) gitignore amendment mid-step. Same
  discipline applies if 4.2 turns up surprises.
- **[[feedback-test-first]]** — the 4.1 red test landed *first*; 4.2
  implementation chases it green.
- **[[feedback-implementation-model]]** — never push without explicit
  ask. The 4.0.4 commit is sitting ahead of origin by 1; user has not
  asked for it to be pushed yet.
- **[[feedback-explain-errors-in-output]]** — annotate every error /
  FAIL in tool output (the line-11 module-not-found in the 4.1.2
  output is the canonical "right red" failure mode).
- **[[feedback-no-tlas]]** — avoid PM-jargon abbreviations.
- **[[feedback-positive-deferral-reasons]]** — positive engineering
  reason for defers, not "wasn't in the plan."

---

## Decisions already made (do not re-litigate)

Includes everything from the prior handover, plus 4.0:

- **TS project references in place.** Shared is a composite project;
  client and server reference it. `tsc -b` drives builds. Typecheck
  scripts kept as `tsc -p tsconfig.json --noEmit` — references-aware
  resolution still works in `-p` mode. R-018 hazard (server reading
  stale `shared/dist/*.d.ts`) is closed.
- **`*.tsbuildinfo` gitignored.** Composite mode emits these at
  workspace root, not under `dist/`. `.gitignore` line added at 4.0.1.d.
- **Pre-existing client path-mapping kept.** `client/tsconfig.json`
  still has `paths: { "@colonymodels/shared": ["../shared/src/index.ts"] }`
  from Slice 1.2.1.b. Coexists with the new reference; client-side
  R-018 was already effectively unimplicated (path mapping took
  precedence). Reference added anyway for graph consistency and for
  `tsc -b` ordering.
- **`chore:` commit prefix for build-graph scaffolding.** Not `docs:`,
  not `red:`/`green:`. Precedent set by 4.0.4.
- **Server is a thin storage layer.** No model code on the server.
  Integration is client-side. See [Phase1Design.md §7.3](Phase1Design.md).
- **Schema:** three tables (`runs`, `events`, `snapshots`) with
  `ON DELETE CASCADE` on `runs.id` (§7.1).
- **Validation:** `zod` at the HTTP boundary only. 400 body shape is
  `{ error: string, issues: ZodIssue[] }`.
- **Client store:** Zustand per §8.1. Single store, no Provider.
- **Fetch wrappers:** plain `fetch` in `client/src/store/api.ts`. No
  axios, no react-query. Phase 1 is single-user, no auth, no retries.
- **Persistence:** local SQLite file at `./colonymodels.db` (default
  `DB_URL` if unset); `:memory:` for tests.
- **Libraries** for Slice 4: `zustand`. Not yet installed — 4.2.1.
- **Better-sqlite3 pin:** `^12.9.0` (see [[risk-017]]). Do not upgrade
  without first installing `build-essential` or upgrading Node.
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
  Re-evaluate option still open (Slice 4 or 5).

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
| ~~R-018~~ | **Closed** by Slice 4.0 (`953cff8`). TS composite project references in place; server's typecheck graph reads through reference rather than via stale `shared/dist/*.d.ts`. RiskRegister entry should be flipped from "Mitigated" → "Closed" in the next tracking sweep (4.3.3a). |

Slice 3 retro action items, status update:
- ✓ Set up TS project references (R-018) — done at Slice 4.0.
- Re-evaluate tsconfig test-excludes (keep vs remove) — Claude,
  Slice 4 or 5. Still open.
- Document `better-sqlite3@^12.9.0` pin in README — Claude, Slice 6
  polish. Still open.
- Carry the "live curl demo" pattern into Slice 4 server-adjacent
  review gates as the visible-artifact substitute — Both. 4.1 has no
  GUI but the test-file IS the visible artifact, so this hasn't been
  needed yet; will matter at 4.3.3.

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
- Snapshot cache lifecycle — Slice 4's store concern. Server stores
  snapshots when client PUTs them; client owns the cache lifecycle
  (per [Phase1Design.md §6.5](Phase1Design.md)).
- Schema versioning (`schema_version INTEGER` column on `runs` per
  R-007 mitigation) — was planned for Slice 3 but not implemented.
  Carry into Slice 6 polish or revisit before Phase 2 begins.
- `setCursor` test coverage — §4.1.1 didn't include it; Slice 5
  scrubbing work.

---

## First steps in a new session

1. Read this file in full.
2. `git status` + `git log --oneline -5` — confirm HEAD is `953cff8`
   and the dirty-tree state matches the "Verifications" block above.
   If the tree is clean instead and HEAD is a `red: Slice 4.1` commit,
   the user committed 4.1 between sessions; skip to step 6 below.
3. Run `cd client && npx vitest run` — confirm `1 failed | 6 passed
   (7)` files, `41 passed` tests; the failed file is `runStore.test.ts`
   with the line-11 module-not-found error. If anything has drifted,
   ask.
4. Re-post (or restate) the 4.1.3 red-review summary from the "Red
   review surface" section above so the user has it in fresh chat
   context.
5. Wait for **4.1.4 [HUMAN] red review** (single-yes per
   [[feedback-gui-only-review]] — technical gate, no GUI). Then
   **4.1.5 [HUMAN] approve red commit** → echo `git add` + `git
   commit -m "..."` → second yes → **4.1.6 [AI] commit `red:`** and
   report hash. The single commit should bundle the test file, the
   checklist tick-and-results for 4.0.4/4.1.1/4.1.2/4.1.3 (and 4.1.4,
   4.1.5 if those land in the same session), and this HANDOVER
   refresh (per the "Off-checklist actions" recommendation above).
6. Proceed to **4.2.1 [AI]** — install `zustand` in client workspace.
7. **4.2.2 [AI]** writes `client/src/store/api.ts` (fetch wrappers).
8. **4.2.3 [AI]** writes `client/src/store/runStore.ts` per §8.1.
9. **4.2.4 [AI]** updates `App.tsx` to load/create a run via the store.
10. **4.2.5 [AI]** runs the suite green — `runStore.test.ts` should
    pass; nothing else should regress.
11. The first visible-GUI gate in Slice 4 is **4.3.3** (refresh page,
    confirm run restored). Present that one in full per
    [[feedback-gui-only-review]] — user has real signal there.

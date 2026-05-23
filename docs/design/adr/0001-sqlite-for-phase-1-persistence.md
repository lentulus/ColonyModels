# ADR-0001: Use better-sqlite3 for Phase 1 persistence

- **Status:** Proposed
- **Date:** 2026-05-23
- **Decision-makers:** project lead (les_howie@yahoo.com); drafted by Claude
- **Related:** Phase1Design.md §7 (server contract), §9 (libraries), §15 item 3

## Context

Phase 1 needs durable storage for runs, events, and snapshots. The
ColonyModels server runs on a single localhost machine, single-user, and
is intentionally decoupled from the sibling MeridianWorlds project (which
uses Postgres at a different scale).

The relevant data is small (kilobytes per run, a few dozen runs total
during exploration), the write rate is low (one append per UI tick at
~12 ticks/sec maximum), and there are no concurrent writers. The only
hard requirement is "survive a process restart and serve the same data
back."

Candidate stores considered:

- **In-memory only.** Cheapest. Loses everything on restart — defeats
  the entire reason a server exists in this design.
- **Postgres.** Production-grade. Requires a daemon, install dance,
  user/auth setup, separate dev/prod configs. Massive overhead for the
  scale.
- **JSON files on disk.** No dependency. Concurrent-write semantics are
  hand-rolled (race conditions waiting to happen). No query language for
  the future where we want "list runs created after X."
- **SQLite via `better-sqlite3`.** Single file, no daemon, synchronous
  API, full SQL. Built-in JSON column support since SQLite 3.38.

## Decision

**Use `better-sqlite3` with a single-file SQLite database stored in the
server workspace.**

The database file path is configurable via env var (default:
`server/data/colonymodels.db`); the file is gitignored.

## Consequences

**Positive.**

- Zero operational overhead — no daemon to start, no auth to configure,
  no separate dev/prod setup.
- Backup is `cp colonymodels.db colonymodels.db.bak`. Restore is the
  reverse.
- Synchronous API matches Phase 1's request-handling style; no async
  pool patterns required at this scale.
- JSON column support means we can store `initial_state`, `initial_params`,
  event `payload`, and snapshot `state` as structured blobs without
  shredding them across columns.
- Test setup is trivial: `:memory:` URL → fresh DB per test.
- The whole DB is portable across machines as a single file.

**Negative.**

- No multi-process write concurrency. Acceptable for single-user Phase 1;
  re-evaluate if/when multiple clients need to write the same run.
- Cannot serve the same DB from multiple ColonyModels server instances.
  Same caveat as above.
- Eventual MeridianWorlds integration will need a porting layer to that
  project's Postgres. Mitigated by keeping persistence behind a repo
  interface in `server/src/db.ts` — only the implementation moves, not
  the call sites.

**Neutral / followups.**

- A future ADR will be required if/when we move to a server-side store
  shared with MeridianWorlds.
- Versioned schema migrations are out of scope for Phase 1 (drop-and-
  recreate is acceptable); they need a framework (e.g. `umzug` or
  hand-rolled) once data starts mattering. Tracked in
  [Phase1RiskRegister.md](../Phase1RiskRegister.md).

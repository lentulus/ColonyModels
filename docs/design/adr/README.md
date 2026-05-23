# Architecture Decision Records

This directory holds the project's Architecture Decision Records (ADRs)
— one short markdown file per non-trivial design choice, capturing **why**
the choice was made so future readers can evaluate whether it still holds.

Format follows Michael Nygard's original 2011 template
([blog post](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions),
*Documenting Architecture Decisions*).

## When to write an ADR

A new ADR is warranted when a decision is:

- **Architecturally significant** — affects module boundaries, contracts,
  long-lived data, or which tool family the project depends on.
- **Reversible only at non-trivial cost** — undoing it later would touch
  multiple files or migrate stored data.
- **Likely to be re-questioned** — someone will eventually ask "why did
  we do that?" and we want a written answer.

Things that *don't* need an ADR: naming, formatting, single-file
refactors, choice of test assertion helper. Use commit messages or design
doc edits for those.

## File naming

`NNNN-short-kebab-case-title.md` where `NNNN` is a four-digit sequence,
starting at `0001`. Never reuse a number; if an ADR is reversed, write a
new one that *supersedes* the old, and mark the old one's status as
"Superseded by ADR-NNNN."

## Status lifecycle

- **Proposed** — drafted, not yet accepted by the user.
- **Accepted** — current decision; in effect.
- **Deprecated** — no longer recommended for new code, but existing code
  still relies on it.
- **Superseded by ADR-NNNN** — replaced by a later decision.

ADRs are *immutable once Accepted*. To change a decision, write a new ADR
and update the old one's status line + the corresponding "Superseded by"
back-pointer.

## Template

```markdown
# ADR-NNNN: <Title in title case>

- **Status:** Proposed | Accepted | Deprecated | Superseded by ADR-NNNN
- **Date:** YYYY-MM-DD
- **Decision-makers:** <names / roles>
- **Related:** ADR-NNNN, Phase1Design.md §X, etc.

## Context

What is the situation that forces a decision? Constraints, requirements,
relevant background. Be specific enough that a reader six months from now
can reconstruct the problem space without rereading the whole project.

## Decision

The choice. One sentence in bold, then a short paragraph if needed.

## Consequences

What becomes easier, what becomes harder, what new risks emerge. Be
honest about the downsides — pretending a decision has no costs is how
ADRs lose credibility.

- **Positive:** …
- **Negative:** …
- **Neutral / Followups:** …
```

## Current ADRs (Phase 1)

| # | Title | Status |
| - | ----- | ------ |
| [0001](0001-sqlite-for-phase-1-persistence.md) | Use better-sqlite3 for Phase 1 persistence | Proposed |
| [0002](0002-hand-rolled-rk4-over-ode-library.md) | Hand-rolled RK4 over an ODE library | Proposed |
| [0003](0003-client-owns-the-simulation.md) | Client owns the simulation; server is durable storage only | Proposed |

## Decisions worth capturing as ADRs (backlog)

Pulled from existing design docs and conversation history. Not yet drafted
— file as needed:

- Event-sourced run state (events as source of truth, snapshots as cache).
  Reference: Phase1Design.md §3, §6.
- Test-first discipline with `red:` / `green:` commit prefixes.
  Reference: Phase1Design.md §11.2.
- Double-approval gate at every `[HUMAN]` step.
  Reference: Phase1Design.md §11.1.
- Required `name` field on runs (no anonymous runs).
  Reference: Phase1Design.md §16 item 3.
- `t0Epoch` default = 2300-01-01 UTC (canonical sci-fi epoch).
  Reference: Phase1Design.md §16 item 2.
- `peoplePerUnit` display-only scaling on Runs.
  Reference: Phase1Design.md §16 item 1.
- Choice of library set: vitest, zustand, recharts, zod, better-sqlite3, nanoid.
  Reference: Phase1Design.md §9.
- Branching as destructive (no version history of branches in Phase 1).
  Reference: Phase1Design.md §6.4.

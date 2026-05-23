# ADR-0003: Client owns the simulation; server is durable storage only

- **Status:** Proposed
- **Date:** 2026-05-23
- **Decision-makers:** project lead; drafted by Claude
- **Related:** Phase1Design.md §1 (architecture), §7.3 (what the server
  does not do), Phase1Options.md §3.4 (server / client split)

## Context

The Phase 1 sim is small enough to run in either tier:

- **Client-side simulation.** Browser owns the model. UI feedback on
  parameter edits is sub-millisecond. Server stays small.
- **Server-side simulation.** Browser is a viewer; server runs the
  ODE. Required for multi-client observation of the same run, or when
  models grow expensive enough to stutter the browser.
- **Hybrid.** Server runs canonical, client runs preview. Maximum
  complexity, maximum flexibility.

Phase 1 is single-user, exploratory, on localhost. The user adjusts
parameters and watches what happens; they are not collaborating with
other observers. The model is cheap (few thousand RK4 steps per second
in JS).

The deeper question is *where the source of truth lives*. Our design
(Phase1Design.md §1) places the **event timeline** as the source of
truth, with snapshots as a derived cache. Either tier can be authoritative
about the event timeline; the simulation itself is *pure given the
events*, so where it runs is an implementation detail.

## Decision

**Client runs the simulation. Server stores runs, events, and snapshots
(as a derived cache).** The server does not contain any integrator code
and does not derive snapshots from events; that is the client's job.

The server **does** accept PUT requests on snapshots, since the client
just computed them — but it treats snapshots as untrusted: any client
can re-derive them from the event timeline, so an incorrect snapshot is
self-healing on the next replay.

## Consequences

**Positive.**

- Sub-millisecond UI feedback on slider edits — the integrator runs in
  the same browser process as the React render loop.
- Server stays tiny (a few hundred lines of routes + repo code), with no
  ODE math. Easy to maintain, easy to replace.
- The same TypeScript code that runs in the browser can run server-side
  if/when needed (e.g. for cross-validation, or for the future
  MeridianWorlds integration). The shared workspace already
  positions for this.
- Deterministic replay means any client can re-derive a run from its
  events — no client is privileged.

**Negative.**

- The server cannot independently validate that a client's snapshots are
  correct. Mitigated by determinism: any server-side audit can re-replay
  from events and compare. The PUT-snapshot endpoint is a *cache update*,
  not a *truth claim*.
- Mobile / low-end clients may struggle once models grow large.
  Out of scope for Phase 1; revisit when it bites.
- Multi-client scenarios (two browsers watching the same run) would
  require a real-time sync layer (SSE / WebSocket / polling). Explicitly
  deferred — see Phase1Design.md §7.2 ("No real-time / SSE / WebSocket in
  Phase 1").
- The fetch round-trip becomes a bottleneck for a hypothetical
  high-frequency-edit workflow (e.g. dragging a slider faster than
  flushes can keep up). Mitigated by the flush cadence in §8.2 — flushes
  are batched, not synchronous-on-edit.

**Neutral / followups.**

- The MeridianWorlds integration plan (Phase1Design.md §14) assumes
  ColonyModels exports its sim as a content stream. If that ever moves
  the sim server-side, this ADR will be superseded.
- A future ADR may need to cover the snapshot-cache reuse strategy more
  formally if/when it grows beyond the §6.5 sketch.

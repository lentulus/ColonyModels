# Phase 1 Definition of Done

A slice is not "done" until every item below is true. This document is
slice-agnostic; the same checklist applies to Slices 0 through 6.

Apply at the **green review** ([Phase1Design.md](Phase1Design.md) §11.1)
— Claude posts the DoD as a filled-in checklist; the user signs off only
when every box is ticked (or every gap is explicitly waived in writing).

## The checklist

### Tests

- [ ] **All slice tests green.** Every test introduced in this slice's
      red phase now passes. `npm test` reports zero failures across all
      workspaces.
- [ ] **No previously-green test now red.** No regressions in tests from
      earlier slices.
- [ ] **Anchors still green.** Slice 0's regression anchors
      ([Phase1AutomatedTests.md](Phase1AutomatedTests.md) 0.2.1, 0.2.2,
      0.2.3) all pass — once each has turned green for the first time,
      it stays green for the remainder of the project.
- [ ] **No silent skips.** `npm test` summary shows zero `skipped` /
      `todo` tests, *or* every skip is documented in
      [Phase1AutomatedTests.md](Phase1AutomatedTests.md) with a reason
      and a target slice for un-skipping.
- [ ] **PBT properties (where applicable) green.** Property-based tests
      from [Phase1PBT.md](Phase1PBT.md) covering code touched in this
      slice all pass at the configured run count.

### Documentation

- [ ] **Test execution logs populated.** Every case touched in this
      slice has a filled-in **Execution log** block (Status, Date,
      Evidence) in the appropriate doc —
      [Phase1AutomatedTests.md](Phase1AutomatedTests.md) for automated
      cases, [Phase1TestCases.md](Phase1TestCases.md) for manual cases.
- [ ] **Checklist `Result:` lines populated.** Every step completed in
      this slice has a meaningful `Result:` line in
      [Phase1Checklist.md](Phase1Checklist.md) — not just "done" but a
      pointer to a commit hash, test output, or chat exchange.
- [ ] **Glossary up to date.** Any new vocabulary introduced this slice
      is added to [Phase1Design.md](Phase1Design.md) §18.
- [ ] **ADRs filed for new architectural choices.** Any decision worth
      capturing per [adr/README.md](adr/README.md) has its own
      `NNNN-…md` file, status Proposed or Accepted.
- [ ] **README updated** if the slice changed user-visible behaviour
      (commands, ports, URLs, install steps).

### Process

- [ ] **Commit-message convention followed.** Every commit in this slice
      uses `red:`, `green:`, `fix:`, or a plain descriptive prefix per
      [Phase1Design.md](Phase1Design.md) §11.2 rule 3.
- [ ] **Double-approval gate honoured.** Every `[HUMAN]` step in
      [Phase1Checklist.md](Phase1Checklist.md) received its two explicit
      approvals before Claude advanced. (No silent advances.)
- [ ] **Retro entry written.** [Phase1Retros.md](Phase1Retros.md) has a
      filled-in entry for this slice with at minimum: *what surprised
      me*, *what worked*, *what I'd change*.
- [ ] **Risk register reviewed.** [Phase1RiskRegister.md](Phase1RiskRegister.md)
      checked for: new risks discovered during this slice, existing risks
      whose status changed (closed, escalated, mitigated).

### Build & runtime

- [ ] **`npm run typecheck` clean.** No TypeScript errors across
      workspaces.
- [ ] **`npm run build` succeeds.** Both client and server build artefacts
      produced.
- [ ] **App starts cleanly.** `npm run dev` brings up the client and
      server with no console errors on first load (verify by opening
      `http://localhost:5173` in a browser).
- [ ] **No `console.error` / `console.warn`** in the browser console
      during the smoke-test paths exercised in this slice.

## Waivers

If a DoD item cannot be satisfied this slice, document the waiver here
(append-only; do not remove past waivers):

| Slice | Item waived | Reason | Target slice to satisfy |
| ----- | ----------- | ------ | ----------------------- |
| 0 | "All slice tests green" | Slice 0 is intentionally red-only — it writes the regression anchors that the downstream slices then turn green. Per Phase1Design.md §12: "All red on `npm test`. Commit message: `red:`." | Slice 1 (logistic anchor) + Slice 2 (Turchin anchor) + Slice 3 (HTTP roundtrip) |
| 0 | "No previously-green test now red" | No tests existed before Slice 0; vacuously true. | n/a |
| 0 | "Anchors still green" | Same as above — anchors are red at end of Slice 0 by design. | Slices 1-3 |
| 0 | "PBT properties green" | PBT properties don't land until Slice 1 (model + integrator) and Slice 2 (replay). | Slices 1-2 |

A waiver requires explicit `[HUMAN]` approval (subject to the double-
approval gate, like any other gated decision).

## Sign-off

Each slice's green review records its DoD sign-off here:

| Slice | Date | DoD all-green? | Waivers | Signed off by |
| ----- | ---- | -------------- | ------- | ------------- |
| 0 | — | — | — | — |
| 1 | — | — | — | — |
| 2 | — | — | — | — |
| 3 | — | — | — | — |
| 4 | — | — | — | — |
| 5 | — | — | — | — |
| 6 | — | — | — | — |

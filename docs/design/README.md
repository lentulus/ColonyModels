# `docs/design/` index

Project-management and design artefacts for ColonyModels. Code lives under
[`/client`](../../client/) and [`/server`](../../server/); this directory
captures the *thinking*.

## Reading order

| # | File | Read when |
| - | ---- | --------- |
| 1 | [intent.md](intent.md) | First contact. One screen of "what is this project even for." |
| 2 | [Phase1Options.md](Phase1Options.md) | Understand the model-choice survey and the user's annotated decisions (`==>` markers). |
| 3 | [Phase1Design.md](Phase1Design.md) | **The authoritative design.** §18 Glossary if any vocabulary in the other docs is unfamiliar. |
| 4 | [Phase1Checklist.md](Phase1Checklist.md) | The running record of execution. **Look here first to know what's next.** |
| 5a | [Phase1AutomatedTests.md](Phase1AutomatedTests.md) | Detailed specs for every **automated** test case. Use when writing a test or reviewing a red test. |
| 5b | [Phase1TestCases.md](Phase1TestCases.md) | Detailed procedures for every **manual** verification. Use when running a manual check. |
| 6 | [Phase1DoD.md](Phase1DoD.md) | Per-slice Definition of Done. Gate every green review against this. |
| 7 | [Phase1PBT.md](Phase1PBT.md) | Property-based test plan. Companion to TestCases for the math layer. |
| 8 | [Phase1RiskRegister.md](Phase1RiskRegister.md) | Running list of project risks + mitigations. |
| 9 | [Phase1Retros.md](Phase1Retros.md) | One section per slice. Fill in at green review. |
| 10 | [HANDOVER.md](HANDOVER.md) | If you (or a future Claude session) just walked in and need to resume work. |
| 11 | [adr/README.md](adr/README.md) | Architecture Decision Records. Index of all `0001-…md`, `0002-…md`, etc. |

## What goes where

- **Phase1Design.md** — design *intent*. The "what we're building and why."
  Updated when intent or contract changes.
- **Phase1Checklist.md** — execution *progress*. Updated as work happens.
- **Phase1AutomatedTests.md** — automated test *contracts*. Updated
  when a new automated test is specified or its execution log is recorded.
- **Phase1TestCases.md** — manual verification *procedures*. Updated
  when a new manual check is added or its execution log is recorded.
- **Phase1DoD.md** — slice exit *criteria*. Rarely changes mid-project.
- **Phase1RiskRegister.md** — risk *log*. Reviewed at each green review.
- **Phase1Retros.md** — slice *reflections*. Written once per slice, never edited.
- **adr/NNNN-*.md** — architectural *decisions*. Immutable after Accepted;
  superseded by a new ADR if reversed.
- **HANDOVER.md** — *cross-session continuity*. Updated when the working
  agreement or current state changes materially.

## Document hygiene

These docs evolve. When you change `Phase1Design.md`, mention the change
in the next slice's retro entry so the *why* is captured alongside the
*what*. When a project-shaping decision lands (in either direction), file
a new ADR rather than burying it in a design-doc edit.

# Phase 1 Property-Based Testing Plan

Companion to [Phase1AutomatedTests.md](Phase1AutomatedTests.md). Whereas
AutomatedTests describes *example-based* tests (specific inputs → specific
outputs), this document specifies *property-based* tests (specifications
that should hold for many generated inputs).

The math layer — model, integrator, replay engine — is where Asserts earns
its keep most clearly. The UI, HTTP, and storage layers are out of scope:
their bugs are typically not the "subtle invariant violated in some
parameter region" kind that Asserts excels at finding.

## What is property-based testing

Instead of asserting `f(2) === 4`, you assert a *property* that should
hold for all valid inputs: `for any number x, f(x) === x * 2`. The
framework generates many inputs (often hundreds), tries each, and on
failure shrinks toward a minimal counterexample.

Originated as Haskell's QuickCheck (Claessen & Hughes, 2000). The JS port
we use is `fast-check`.

## Library

**`fast-check`** ([fast-check.dev](https://fast-check.dev)). Mature,
widely used, good TypeScript types, integrates cleanly with vitest.

Install at Slice 0 alongside vitest:

```bash
npm install -D --workspace client fast-check
```

(Server doesn't need it for Phase 1; HTTP layer is example-tested only.)

## Conventions

- Property-based tests live alongside example-based tests in the same
  `*.test.ts` file, under a `describe("properties", () => …)` block, so
  one file per module covers both styles.
- Default run count: `fast-check`'s default 100. Increase to 1000 for
  slow/anchor tests once the suite is stable.
- Every property must include a comment naming the *invariant* being
  asserted, in plain English. If you can't write the sentence, the
  property isn't worth running.
- Generators (`fc.float`, `fc.integer`, etc.) should be bounded to the
  parameter ranges that are physically meaningful. Letting `fast-check`
  feed `Number.MAX_VALUE` into `rhsC` finds bugs in JS arithmetic, not
  in the model.

## Properties — `client/src/sim/model.test.ts` (extends AutomatedTests 1.1.2)

For the `rhsC(s, p)` function. Generators:

```ts
const arbN     = fc.float({ min: 0,        max: 5,    noNaN: true });
const arbS     = fc.float({ min: 0,        max: 50,   noNaN: true });
const arbR     = fc.float({ min: 0.001,    max: 0.5,  noNaN: true });
const arbBeta  = fc.float({ min: 0,        max: 2,    noNaN: true });
const arbC     = fc.float({ min: 0,        max: 10,   noNaN: true });
const arbS0    = fc.float({ min: 0.01,     max: 10,   noNaN: true });
const arbState  = fc.record({ N: arbN, S: arbS });
const arbParams = fc.record({ r: arbR, beta: arbBeta, c: arbC, s0: arbS0 });
```

| ID | Property | Invariant |
| -- | -------- | --------- |
| P-M-1 | `rhsC(s, p).N >= 0` whenever `s.N == 0` | At zero population, dN/dt is non-negative — population cannot go negative spontaneously. |
| P-M-2 | `rhsC(s, p).N > 0` whenever `0 < s.N < k(s.S, p)` | Below carrying capacity, population grows. |
| P-M-3 | `rhsC(s, p).N < 0` whenever `s.N > k(s.S, p)` | Above carrying capacity, population shrinks. |
| P-M-4 | `rhsC(s, p).N == 0` whenever `s.N == k(s.S, p)` (within `1e-9`) | At carrying capacity, dN/dt is zero. |
| P-M-5 | `k(S, p)` is monotonically non-decreasing in S | Adding state resources cannot reduce carrying capacity. |
| P-M-6 | `k(0, p) === 1` for all valid p | Base carrying capacity is 1 (the scaling convention). |
| P-M-7 | `rhsC(s, p)` returns finite numbers for all valid inputs | No NaN, no Infinity. |

## Properties — `client/src/sim/integrator.test.ts` (extends AutomatedTests 1.1.3)

For `rk4Step` and `advanceTick`.

| ID | Property | Invariant |
| -- | -------- | --------- |
| P-I-1 | `rk4Step(s, p, dt).N >= 0` for all valid `(s, p, dt)` | Clamp upholds the non-negativity invariant. |
| P-I-2 | `rk4Step(s, p, dt).S >= 0` for all valid `(s, p, dt)` | Manual reset upholds the non-negativity invariant. |
| P-I-3 | For pure logistic (zero beta, c, etc.): `rk4Step` and 2-step half-`dt` Richardson extrapolation agree to within `O(dt⁵)` | Order of accuracy is at least 4 (RK4 hallmark). |
| P-I-4 | `advanceTick(s, p, t, dt)` is deterministic: two calls with identical inputs return identical outputs | Determinism baseline. |
| P-I-5 | `advanceTick(s, p, t1, dt) == advanceTick(advanceTick(s, p, t1/2, dt), p, t1/2, dt)` to within `1e-9` | Composability — advancing in two halves equals advancing in one. (Holds because params don't change mid-advance.) |
| P-I-6 | For `s.N == 0`: `advanceTick(...).N == 0` for all `(p, t)` | Zero population stays zero (no spontaneous resurrection). |

## Properties — `client/src/sim/replay.test.ts` (extends AutomatedTests 2.1.1)

For `paramsAt` and `replayTo`.

Generators:

```ts
const arbEvent = fc.oneof(
  fc.record({
    kind: fc.constant("param-set"),
    tEpoch: fc.integer({ min: 0, max: 10_000_000 }),
    param: fc.constantFrom("r", "beta", "c", "s0"),
    value: fc.float({ min: 0.001, max: 5, noNaN: true }),
  }),
  fc.record({
    kind: fc.constant("state-poke"),
    tEpoch: fc.integer({ min: 0, max: 10_000_000 }),
    patch: fc.record({ N: arbN }, { withDeletedKeys: true }),
  }),
);
const arbEvents = fc.array(arbEvent, { maxLength: 20 })
                    .map(es => es.sort((a, b) => a.tEpoch - b.tEpoch));
```

| ID | Property | Invariant |
| -- | -------- | --------- |
| P-R-1 | `replayTo(run, events, t) === replayTo(run, events, t)` deep-equal | Determinism (already in example tests; Asserts broadens the input space). |
| P-R-2 | `replayTo(run, [], t)` ignores events: result depends only on `(run, t)` | Empty event list = baseline trajectory. |
| P-R-3 | `paramsAt(run, events, t)` returns a value from `{initial} ∪ {events' values up to t}` | No invented parameter values. |
| P-R-4 | `replayTo(run, events, t1)` followed by `replayTo(run, events, t2)` (`t2 > t1`) — the latter's snapshot at `t1` matches the former's last snapshot | Replay extension is consistent. |
| P-R-5 | Adding a `param-set` event after `t` does not change `replayTo(run, events, t)` | Causality — future events can't affect past states. |
| P-R-6 | For any run + events: all snapshots have `N >= 0` and `S >= 0` | Clamps survive the replay-driver layer. |

## When to run Asserts

- **Locally during development.** `vitest --watch` runs everything;
  fast-check's default 100 runs per property keeps the loop tight.
- **At Slice 0 red review.** The properties for the integrator and
  replay engine are written *first*, alongside the example tests, and
  fail at import like the rest of the Slice 0 anchors.
- **Anchor Asserts properties** (the ones most likely to catch regressions —
  P-I-3, P-R-1, P-R-5) get their run counts raised to 1000 at the end of
  Slice 5, once the suite is stable. Marked in the test file with
  `numRuns: 1000`.

## Failure handling

When a property fails, fast-check reports the minimal counterexample.
Workflow:

1. Capture the counterexample in the test as a regression: convert it to
   a fixed-input `it("regression: <counterexample>", …)` example test in
   the same file. This guarantees the bug stays fixed even if the
   generator's random seed changes.
2. Fix the bug; both the example regression and the property go green.
3. Log the find in the slice's [Phase1Retros.md](Phase1Retros.md) entry
   under "what surprised me."

# Phase 1 — Math Derivations

Companion document to [Phase1Design.md](Phase1Design.md) §4 (the model) and
[Phase1Checklist.md](Phase1Checklist.md) Slice 1.3.4b. Filed because the
project lead is not in a position to personally audit the math, so we
substitute *citation-integrity review* — each predicted feature here is
anchored to a specific equation, page, or figure in
[Turchin, *Historical Dynamics: Why States Rise and Fall*, Princeton
University Press, 2003](../reference/dokumen.pub_historical-dynamics-why-states-rise-and-fall-1400889316-9781400889310.pdf).
The user verifies the derivations are sourced where claimed; the AI is
responsible for the derivations themselves.

Page numbers refer to the printed book pagination; PDF page = book page
+ ~12 due to front matter.

## 1. Model recap

The right-hand side in [client/src/sim/model.ts](../../client/src/sim/model.ts)
is the **basic demographic-fiscal model**, Turchin Eq 7.4 (p.123):

$$
\dot{N} = rN\!\left(1 - \frac{N}{k(S)}\right), \qquad
\dot{S} = N\!\left(1 - \frac{N}{k(S)}\right) - \beta N, \qquad
k(S) = 1 + c\,\frac{S}{s_0 + S}
$$

with the constraint $S \ge 0$ ("the state is not allowed to go into
debt", p.123). The integrator additionally enforces $N \ge 0$
([Phase1Design.md §4](Phase1Design.md), [integrator.ts:25](../../client/src/sim/integrator.ts#L25)).

Equations 7.1–7.3 (pp.122–123) build $k(S)$ in stages: logistic growth
for $N$ (Eq 7.1), state-resource balance from taxation minus
expenditure (Eq 7.2), and the saturating carrying-capacity gain (Eq
7.3). Eq 7.4 is the combination, rescaled to four parameters $(r, \beta,
c, s_0)$.

## 2. Parameter set used — matches Turchin verbatim

Phase 1's canonical "blank run" defaults from
[Phase1Design.md §17](Phase1Design.md):

| Parameter | Value | Turchin (Fig 7.1, p.124 / p.123 prose) |
|---|---|---|
| $r$  | 0.02 yr⁻¹ | 0.02 yr⁻¹ ✓ |
| $\beta$ | 0.25 | 0.25 ✓ |
| $c$  | 3 | 3 ✓ |
| $s_0$ | 10 | 10 ✓ |
| $N_0$ | 0.5 | $k_0/2 = 0.5$ ✓ |
| $S_0$ | 0 | 0 ✓ |

§17 was aligned to Turchin's verbatim values on 2026-05-25
(Phase1Checklist 1.3.4b.fix-1) so that the integrator can be
cross-checked directly against the published Fig 7.1. Earlier
deviations (F-1.3.4b-1 $s_0$, F-1.3.4b-2 $N_0$) are resolved.

## 3. Derived features for the §17 run over 1000 yr

Each subsection: (i) Turchin citation, (ii) analytic content for our
parameters, (iii) numerical confirmation via direct integration with
[advanceTick](../../client/src/sim/integrator.ts#L42) using $dt =
1/365.25$ yr (daily sub-step, matching the production replay loop in
[Phase1Design.md §6.2](Phase1Design.md)).

### 3.1 Stateless equilibrium $(N^* = k_0 = 1, \; S^* = 0)$ is locally stable

**Source:** Turchin p.123: "The equilibrium $N = k_0$ and $S = 0$ is
locally stable. This means that, once the state has collapsed, small
perturbations in either population size or state resources do not lead
away from this equilibrium."

**Analytic:** At $S = 0$ in our rescaled model, $k(0) = 1$. Setting
$\dot{N} = 0$ in Eq 7.4 gives $N = 0$ (unstable; $\partial_N \dot{N} =
r > 0$) or $N = 1$ ($\partial_N \dot{N} = -r = -0.02 < 0$, stable). At
$(N, S) = (1, 0)$, $\dot{S} = N(1 - N/k(0)) - \beta N = -\beta = -0.25
< 0$, but $S$ is clamped at 0, so the boundary equilibrium is held in
place by the clamp.

**Re-trigger threshold:** Turchin p.123 gives the exact perturbation
needed to escape the equilibrium: $N < 1 - \beta$ or $S > s_0 /
[c(\beta^{-1} - 1) - 1]$. For our parameters that's $N < 0.75$ or $S >
1/8 = 0.125$. Neither happens spontaneously in the deterministic
trajectory after the first collapse, so the post-collapse
phase is dynamically permanent (in the deterministic model).

**Numerical:** at $t = 1000$ yr, $N \approx 0.9999$, $S = 0.0000$
(exact, clamped). $N$ approaches the equilibrium asymptotically from
below at rate $\sim r = 0.02$. By $t = 700$ yr, $N$ is within $10^{-4}$
of the equilibrium.

### 3.2 Carrying-capacity bound $k(S) \in [1, 1+c) = [1, 4)$

**Source:** Eq 7.3 (p.122), the construction of $k(S)$. Turchin p.122:
"$c = k_\text{max} - k_0$ is the maximum possible gain in increasing
$k$ given unlimited funds."

**Analytic:** $k(S) = 1 + cS/(s_0 + S)$ is monotone in $S$, with $k(0)
= 1$ and $\lim_{S\to\infty} k(S) = 1 + c$. So $k(S) \in [1, 1+c)$ for
all finite $S \ge 0$. With $c = 3$: $k(S) \in [1, 4)$.

**Numerical:** over the 1000-yr trajectory, $k(S)$ takes values in
$[1.0000, 3.4904]$ (S-peak at $t = 159$, $S = 48.87$ gives $k = 3.49$).
Well within theoretical bounds.

### 3.3 Single deterministic excursion — exactly one N-peak

**Source:** Turchin p.123: "Thus, in a deterministic world, once the
state collapses, it cannot arise again."  Reinforced p.131: "A single
state building/state collapse episode followed by a stateless
equilibrium (in the absence of perturbations) is the dynamics typical
for most parameter combinations of the selfish elite model. It is also
the typical dynamics of the … basic demographic-fiscal model."

Recurring cycles in Turchin's Fig 7.2 (p.125) come from **stochastic**
forcing ("by adding once a year to $S$ a random Gaussian number with
mean 0 and a small standard deviation $\sigma = 0.1 s_0$"); Phase 1's
deterministic integrator does **not** produce sustained cycles.

**Analytic:** Combined with §3.1 (post-collapse equilibrium is
absorbing) and §3.2 ($k(S)$ bounded), the trajectory has exactly one
excursion: $N$ grows from $N_0 < 1 - \beta$, $S$ accumulates while $N
< (1-\beta)k(S)$, $N$ rises past $(1-\beta)k(S)$, $\dot{S}$ becomes
negative, $S$ collapses, $k(S)$ collapses with it, $N$ overshoots and
falls back to $N = 1$.

**Numerical:** local maxima of $N(t)$ over $t \in [1, 999]$ — **one
peak**, at $t = 227$ yr, $N = 3.13$. Matches Fig 7.1a (p.124) which
shows the N-peak at $t \approx 225$ yr.

### 3.4 Peak ordering — $S$ peaks before $N$

**Source:** Turchin p.123: "The rate of change of $S$ is determined by
the balance of two opposing forces: revenues and expenditures. When
$N$ is low, increasing it results in greater revenues … The growth in
state expenditures lags the revenues, and the state's surplus
accumulates. As $N$ increases, however, the growth in revenues
ceases, and actually begins to decline. … At population density $N =
N_\text{crit}$, the revenues and expenditure curves become (briefly)
balanced." Fig 7.1a (p.124) shows $S(t)$ peaking on the rising flank
of $N(t)$, before the $N$ peak.

**Analytic:** $\dot{S} = 0$ at $N = N_\text{crit}(S) := (1-\beta)k(S)$
(setting $\dot{S} = 0$ in Eq 7.2 above). For our $\beta = 0.25$,
$N_\text{crit}$ ranges over $[0.75, 3.0)$ as $S$ varies in $[0,
\infty)$. As the trajectory crosses $N = N_\text{crit}(S)$ from below,
$S$ stops growing; this is **before** $N$ itself peaks because $N$
still has positive $\dot{N}$ while it remains below the current
$k(S)$.

**Numerical:** $S$ peak at $t = 159$ yr (N at that point $= 2.62 \approx
N_\text{crit}(S = 48.9) = 0.75 \times 3.49 = 2.62$ ✓ — exact agreement
to 2 dp). $N$ peak at $t = 227$ yr. $S$ leads $N$ by 68 yr.

### 3.5 Excursion duration in centuries — order-of-magnitude period

**Source:** Turchin p.126: "For this estimate of $r$ [$r = 0.02$], the
model predicts oscillations of 2-3 centuries in duration (Figure
7.2). This is a quantitative prediction of the model that can be
tested empirically." And p.125: "the average length of a political
cycle was mainly determined by the value of $r$, and to a lesser
extent by $\beta$."

**Analytic:** During the growth phase $S \approx 0$, $k(S) \approx 1$,
so $\dot{N} \approx rN(1-N)$ — pure logistic with timescale $\sim 1/r
= 50$ yr. From $N_0 = 0.5$ (the inflection point of the logistic) the
characteristic growth time is $\sim 1/r$; the excursion to N-peak
takes a few such timescales as $k(S)$ climbs on top of the bare
logistic.

**Numerical:** N-peak at $t = 227$ yr ≈ 2.3 centuries from $t_0$ ✓.
Matches Fig 7.1a (p.124) where the N-peak is at $t \approx 225$ yr.

### 3.6 N-peak amplitude bounded by $k_\text{max}$

**Source:** Eq 7.3 (p.122): $k(S)$ is bounded above by $k_0 + c = 1 +
c$. Since $\dot{N} = rN(1 - N/k(S))$ changes sign at $N = k(S)$, $N$
can transiently exceed $k(S)$ during fast transitions but the upper
envelope is set by $k_\text{max}$.

**Analytic:** With $c = 3$, $N$ should not exceed ~$k_\text{max} = 4$
by more than a small overshoot. Lower bound on the peak: $N_\text{peak}
\ge (1 - \beta) k_\text{max} = 0.75 \times 4 = 3$ would be the
threshold if $S$ reached saturation; lower in practice because $S$
peaks at $S \sim 70$ (well above $s_0 = 1$ so $k(S)$ is close to
saturation).

**Numerical:** $N_\text{peak} = 3.13$, comfortably within $[1+c\cdot
S_\text{peak}/(s_0 + S_\text{peak}) \cdot (1 - \beta), \; 1 + c) =
[2.62, 4.0)$. Matches the height shown in Fig 7.1a (p.124) where the
N-peak sits between $k_0 = 1$ and $k_\text{max} = 4$.

### 3.7 Non-negativity and no numerical blow-up

**Source:** Turchin p.123 ($S \ge 0$ constraint) and the general
discussion that population can collapse but not go negative
(implicit). Implementation per [Phase1Design.md §4](Phase1Design.md):
$N \ge 0$ clamped inside [rk4Step](../../client/src/sim/integrator.ts#L29);
$S \ge 0$ manual reset between sub-steps in
[advanceTick](../../client/src/sim/integrator.ts#L42).

**Analytic:** Trajectory must satisfy $N(t) \ge 0$, $S(t) \ge 0$,
$N(t) < \infty$, $S(t) < \infty$ for all $t$.

**Numerical:** $\min_t N(t) = 0.5$ (the initial value; trajectory
grows monotonically from there during the growth phase, then collapses
toward $N = 1$); $\min_t S(t) = 0$ (exact, clamped from $t \approx
240$ yr onward); $\max_t N(t) = 3.13$, $\max_t S(t) = 48.87$ —
bounded.

## 4. Mapping to `client/src/sim/model.cycle.test.ts` assertions

The codified test asserts these features with tolerances chosen
loosely enough to absorb RK4 sub-step noise but tightly enough to flag
real regressions (e.g. a sign-flip in `rhsC`, a missing clamp, a
parameter mis-bind, an RK4-coefficient error).

| Assertion | Derivation | Tolerance |
|---|---|---|
| Final state $N(1000) \in [0.99, 1.01]$, $S(1000) = 0$ | §3.1 | wide; equilibrium is asymptotic |
| Exactly 1 local N-maximum over $[1, 999]$ yr | §3.3 | strict (deterministic) |
| N-peak time in $[200, 260]$ yr | §3.5 | $\pm 30$ yr around Fig 7.1's ~225 yr |
| N-peak amplitude in $[2.8, 3.6)$ | §3.6 | $\pm 0.4$ around observed 3.13 |
| $S$-peak time strictly before N-peak time | §3.4 | strict (causal ordering) |
| $\max_t k(S(t)) \in [3.0, 3.7)$ | §3.2 | tight; observed 3.49 |
| $\min_t N(t) \ge 0$ and $\min_t S(t) \ge 0$ | §3.7 | strict |

## 5. Carry-overs / follow-ups (do NOT execute under this slice)

- ~~**F-1.3.4b-1.** §17 $s_0$ deviation.~~ Resolved 2026-05-25 by
  Phase1Checklist 1.3.4b.fix-1; §17 now uses Turchin's $s_0 = 10$.
- ~~**F-1.3.4b-2.** §17 $N_0$ deviation.~~ Resolved 2026-05-25 by
  Phase1Checklist 1.3.4b.fix-1; §17 now uses Turchin's $N_0 = 0.5$.
- **F-1.3.4b-3 (narrowed).** Slice 0 anchor
  [client/src/sim/turchin.cycle.test.ts](../../client/src/sim/turchin.cycle.test.ts)
  asserts "first peak in [80, 220] yr". With §17 now at Turchin
  verbatim, the actual N-peak is at $t \approx 227$ yr — 7 yr above
  the anchor's upper bound. The bound needs widening (e.g. to
  $[180, 280]$, matching the test in this file) before Slice 2.2.3
  when `replayTo` lands; not addressed here because that test
  depends on the Slice 2 replay module that doesn't exist yet.

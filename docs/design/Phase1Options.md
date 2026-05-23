# Phase 1 Options

Combining [intent.md](intent.md) with equations extracted from Peter Turchin,
*Historical Dynamics: Why States Rise and Fall* (2003), Chapters 2, 7, and
Appendix A. Source PDF lives in [`docs/reference/`](../reference/) (gitignored).

## 1. What the sources actually say

### From intent.md

- Models are **systems of ODEs**.
- The user advances time in increments, pauses to **adjust parameters**, and
  may **rewind**.
- Topic queue: Population first, then Agriculture, Industry, Class Division,
  Wealth Distribution.
- Population is "logistic, but modified."

### From Turchin

Turchin builds a *family* of demographic-structural models on top of the
logistic equation. They map onto the intent.md topic list with surprising
fidelity:

| intent.md topic    | Turchin construct                                  |
| ------------------ | -------------------------------------------------- |
| Population         | Logistic with carrying capacity $K$ (Eq 7.1)       |
| Agriculture        | Diminishing-returns production $p(N) = c_1(1 - N/k)$, and $k(S)$ saturating in state resources |
| Industry           | Out of scope in the book ("model is applicable only to preindustrial societies"), but the same $k(S)$ slot is the natural place to plug in a technology term |
| Class Division     | Two-class commoner/elite split (Eqs A.13, A.15)    |
| Wealth Distribution | Coercive extraction $\theta a E / (1 + a E)$ between classes (Eq A.13) and state's share of surplus (Eq A.14) |

Useful equations, gathered in one place:

**Primer (Ch 2.1).** A taxonomy the rest of the book uses.

$$
\begin{aligned}
\dot X &= c                                    &&\text{(linear, 2.1)}\\
\dot X &= r X                                  &&\text{(exponential, 2.2)}\\
\dot X &= c - dX                               &&\text{(asymptotic, 2.3)}\\
\dot X &= (r_0 - gX)X                          &&\text{(logistic, 2.4)}\\
\dot X &= a(X - b)(c - X)X                     &&\text{(cubic / tipping, 2.5)}\\
\dot X &= c a X Y - d X,\ \dot Y = -a X Y + b Y &&\text{(Lotka-Volterra, 2.7)}
\end{aligned}
$$

**Basic demographic-fiscal model (Ch 7.2.1, Eq 7.4, scaled).** Population $N$
coupled to accumulated state resources $S$.

$$
\begin{aligned}
\dot N &= r N \left(1 - \frac{N}{k(S)}\right)\\
\dot S &= N \left(1 - \frac{N}{k(S)}\right) - \beta N\\
k(S) &= 1 + c\,\frac{S}{s_0 + S}
\end{aligned}
$$

(with $S \ge 0$ enforced as a constraint, not by the ODE). Free parameters:
$r, \beta, c, s_0$. Turchin's "reasonable" $r \approx 0.02\,\text{yr}^{-1}$
yields oscillations of ~200-300 yr.

**Class-structured selfish-elite model (Appendix A.3, scaled).** Adds elites
$E$ and the extraction-rate hyperbola.

$$
\begin{aligned}
\dot P &= \frac{\beta_1 P (1 - P)}{1 + E} - \delta_1 P\\
\dot E &= \frac{\beta_2 E (1 - P) P}{1 + E} - \frac{\delta_2}{1 + S} E\\
\dot S &= \gamma E - \alpha E
\end{aligned}
$$

(state-resource collapse acts on elite mortality, which is what closes the
cycle.)

**Process order (Ch 2.1.4, Ch 8.2).** Zero/first/second-order is the central
distinction. Pure logistic is **first-order** — it can only asymptote, never
oscillate. To get the booms and busts that make colony history *interesting*,
you need at least a **second** structural variable feeding back. That is the
whole reason Turchin adds $S$.

## 2. Phase 1 candidates

Four ways to spend Phase 1 effort. They aren't mutually exclusive — earlier
options compose into later ones — so the real decision is *how far* to push in
the first cut.

### Option A — Pure logistic, parameters $(r_0, K)$

$$
\dot N = r_0 N \left(1 - \frac{N}{K}\right)
$$

- **What works.** Smallest possible scope. One ODE. Closed-form solution
  exists, so you can validate the integrator against analytic truth. Easy to
  visualize: one number over time.
- **What doesn't.** First-order: cannot oscillate, cannot collapse, cannot
  show the secular cycle that motivates the book. Once you've watched the
  curve once you've seen everything it does.
- **Future fit.** Sets up nothing structurally — Phase 2 onward will throw
  this away as soon as $K$ becomes a function of another state variable.
- **Effort.** Hours. Almost all the effort is in the surrounding harness
  (integrator, rewind, UI), not the model.

### Option B — Logistic with dynamic $K(t)$ as an exogenous trend

$$
\dot N = r_0 N \left(1 - \frac{N}{K(t)}\right),\qquad K(t) = \text{user-defined}
$$

- **What works.** Lets the user "play God" with carrying capacity — bump $K$
  to simulate a tech breakthrough, drop it to simulate a blight. The
  parameter-adjustment story from intent.md immediately has something to do.
- **What doesn't.** Still first-order on $N$. $K$ is exogenous, not the
  result of a dynamic — there is no *model* of why $K$ changes.
- **Future fit.** Direct stepping stone to Option C: replace the user's
  hand-drawn $K(t)$ with a $K(S)$ function once $S$ is endogenized.
- **Effort.** Days.

### Option C — Basic demographic-fiscal model (Eq 7.4)

$$
\dot N = r N \left(1 - \frac{N}{k(S)}\right),\ \dot S = N\!\left(1 - \frac{N}{k(S)}\right) - \beta N,\ k(S) = 1 + c\frac{S}{s_0 + S}
$$

- **What works.** Second-order — produces the famous boom-and-bust cycle.
  Already implicitly covers two of intent.md's future chapters
  (Population *and* Agriculture, since $k(S)$ is the agricultural capacity
  with diminishing returns on state investment). Four free parameters, all
  with intuitive meanings, all worth letting the user adjust.
- **What doesn't.** No classes, no wealth split. The "state" $S$ is a single
  accumulated treasure; it does not yet represent who owns what.
- **Future fit.** Excellent. Class Division (Option D) is built by
  *promoting* $N$ into $(P, E)$ and reusing $S$.
- **Effort.** Week-ish.

### Option D — Selfish-elite class-structured model (Eq A.16, scaled)

The three-equation $(P, E, S)$ system above.

- **What works.** Covers Population + Agriculture + Class Division + Wealth
  Distribution in a single coherent model — the four largest items on the
  intent queue, all at once. Capable of stable equilibria, single
  boom-and-bust, and limit cycles depending on parameters.
- **What doesn't.** Seven parameters ($\beta_1, \beta_2, \delta_1, \delta_2,
  \gamma, \alpha$, plus initial conditions); harder to give the user
  intuition for them. The dynamics include singularities at $E = 0$ that
  need careful integration, and the $S \ge 0$ "state cannot go into debt"
  constraint is handled by Turchin as a manual reset, not by the ODE.
- **Future fit.** Already covers most of the queue, so the question becomes
  "what's Phase 2?" rather than "how do we extend Phase 1?"
- **Effort.** Two to three weeks if numerical edge cases are handled
  carefully.

## 3. The cross-cutting parts (independent of which model)

These problems show up identically in A, B, C, and D, and arguably matter
*more* than which equations Phase 1 uses, because they are reused for every
future phase.

### 3.1 Integration

- Pick a fixed-step explicit integrator. RK4 at $dt \le 0.1\,\text{yr}$ is
  overkill for cycles of $10^2$-yr period and gives you essentially
  closed-form accuracy.
- Step size is a model parameter, not a UI parameter — exposing it confuses
  the user. The UI's "time increment" is the *display* increment (e.g.
  "advance 5 years"), which internally runs $N$ integrator steps.
- Avoid adaptive solvers in Phase 1: their variable step size makes the
  rewind story harder.

### 3.2 Rewind

Two paths, only one is sane:

- **Replay from $t=0$** — store the full parameter timeline (parameter,
  value, $t$) and re-integrate forward to the requested rewind point. Cheap
  in memory, deterministic, and naturally handles "rewind, change a
  parameter, watch a *different* timeline play forward." Recommended.
- **Snapshot every step** — store $(N, S, \ldots)$ at every integrator step
  and pop the buffer on rewind. Faster to scrub *backward* but does the
  wrong thing when a parameter changes mid-rewind (the future is now
  inconsistent with the snapshots).

The replay-from-zero design also means the **timeline of parameter changes
is itself the saved state of the simulation** — easy to serialize, easy to
share, easy to diff between runs.

### 3.3 Parameter adjustment

- An adjustment at time $t$ is just an event $(t, \text{parameter},
  \text{new value})$ appended to the timeline. Re-integration from $t$
  forward picks it up automatically.
- "Branching" — adjusting a parameter *after* rewinding — is the same
  operation. The truncated future is discarded.
- Implication: parameters are not stored as a single dict on the model
  object; they are computed by walking the event list up to the current
  $t$.

### 3.4 Server / client split

Both flavors of split are tenable:

- **Client owns the sim, server is a save/load store.** Works because the
  computation is tiny (a few thousand RK4 steps per second of wall time).
  Faster UI feedback. Server stays simple.
- **Server owns the sim, client is a viewer.** Necessary if multiple
  clients ever observe the same run, or if the model grows expensive
  enough that the browser stutters. Higher latency on parameter edits.

Given Phase 1 is single-user exploration, client-side simulation is the
lighter path. The server can stay an empty Express shell with a `/health`
endpoint until there is a real reason to give it work — for example,
persisting interesting timelines, or comparing two runs side-by-side.

### 3.5 What the 3D view actually shows

This is genuinely open. Turchin's models are scalar — $N(t)$, $S(t)$ — so a
2D plot is the natural display. The R3F canvas is currently doing nothing
useful. Three plausible Phase 1 framings:

- **Plots-in-3D.** Cheapest. Render the $(t, N)$ curve as a tube in 3-space,
  unfold class structure as separate curves stacked on a third axis. Pretty
  but information-equivalent to a 2D chart.
- **Spatial colony.** Reinterpret $N$ as the *spatial extent or density*
  of a colony rendered on a sphere/plane. Visually motivated, but adds a
  spatial dimension the model does not actually have.
- **Phase portrait.** Show the trajectory in $(N, S)$ space as the 3D
  scene's primary content, with $t$ as a parametric variable along the
  curve. This is Turchin's Figure 7.1(b). Faithful to the math; novel
  visually; lets the user *see* the limit cycle directly.

The phase-portrait option is the most defensible "why is this 3D?" answer
and ports cleanly to higher-dimensional models ($P, E, S$ → 3D embedding
is literally just plotting).

## 4. Recommendation

**Skip Option A. Start with Option C (basic demographic-fiscal).**

- Option A is a one-day exercise that teaches you nothing about the cycles
  you actually want to model — and the integrator/rewind/UI plumbing
  underneath it is the *same* plumbing Option C needs.
- Option C is the smallest model that exhibits Turchin's central
  phenomenon (the secular cycle), satisfies intent.md's "logistic, but
  modified," and already covers the first two queue items (Population,
  Agriculture).
- Phase 2 then promotes $N \to (P, E)$ to land on Option D, with most of
  Phase 1's plumbing reused.

If that feels too ambitious for one phase, the natural smaller cut is
**Option B** as a deliberate stepping stone — same UI, exogenous $K(t)$
under user control, with the explicit understanding that $K(t)$ is
scaffolding to be replaced by $K(S)$ in Phase 2.

## 5. Open questions for next conversation

1. Phase 1 scope: Option B (stepping-stone) or Option C (full cycle)?
==> Option C but note furure extension to D
2. 3D framing: phase portrait, spatial colony, or plot-in-3D?
==> I was picturing this as 2D plots really.  But what happens when intgrated with MeridianWorlds
3. Sim ownership: client-side (faster) or server-side (sharable)?
==> Client side but must be re-runable from data on server, and results are stored by time increment on serevr.  Timestamps will be secods since epoch but time increment will be weeks or months 
4. Are non-Turchin models in scope for Phase 1? (e.g. a logistic with a
   *prey* population eating into $K$, à la Lotka-Volterra Eq 2.7 — closer
   to ecological models than political ones.) Turchin is one source among
   possible many.
   ==> Non turchin models are fine, suggets otions, but colonists are not being eaten
5. Units: are we modeling abstract colony numbers or trying to hit
   plausible interstellar magnitudes (millions of colonists, kilotons of
   stored grain, etc.)? Affects parameter defaults but nothing structural.
   ==> starting with a small dependent colony but will extend.  

==> Later phases will include economics, social brakdown, technical limitations on logistic chain.. But phase 1 is just option C

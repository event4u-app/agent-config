# Pre-registration — UI-track integrity, Measurements A and B

> Written **before** the first generated-candidate run, per the
> `road-to-ui-track-integrity-followup` prerequisites. Nothing in this file is
> adjusted after seeing a distribution. Amendments are allowed but must be
> **git-visible and dated** — an amendment recorded after the numbers land is
> not an amendment, it is a post-hoc threshold.
>
> Reviewed by a 2-member AI council (anthropic/claude-sonnet-4-5 +
> openai/gpt-4o, 2026-08-05, blind synthesis). Four decisions were put to it;
> the convergent outcomes are marked **council-convergent** below, the one
> split is marked and resolved explicitly.

## What is being measured

Two questions, one scorer, deliberately not collapsed:

- **Measurement A — model tier.** Every UI *builder* skill runs
  `model_tier: medium` (`fe-design`, `blade-ui`, `react-shadcn-ui`, `flux`,
  `livewire`, `tailwind-engineer`); the two skills that *grade* their output run
  `high` (`design-review`, `existing-ui-audit`). Two exceptions look deliberate
  and get their own arms (`accessibility-auditor` = medium grader,
  `ui-component-architect` = high builder). Question: does raising the builder
  tier buy fidelity worth its cost?
- **Measurement B — skill lane.** Does the generic lane's UI output match a
  framework-specific lane's at a fixed tier, and does the design-corpus query
  change the output rather than merely run? **Status: structurally blocked, see
  § Measurement B.**

## Frozen inputs (quoted, not re-derived)

### Component weights — unchanged from the scorer's own pre-registration

| # | Component | Weight | Reporting band |
|---|---|---:|---:|
| 1 | `pixel` — 8×8 windowed SSIM on luma at 375/768/1280, height-coverage scaled | 0.40 | 0.90 |
| 2 | `dom` — Sørensen–Dice over the component inventory (tag + ARIA, class names excluded) | 0.20 | 0.80 |
| 3 | `tokens` — recall of the truth's colour / spacing / radius values | 0.20 | 0.80 |
| 4 | `interactions` — declarative checklist through the real browser | 0.20 | 1.00 |

Source of truth: `internal/bench/ui/bench.config.json`. Bands are **reporting
bands, not gates** — the bench measures a distance, it does not adjudicate.

### Fixture pin — recorded here beside the weights, per the prerequisite

| File | SHA-256 |
|---|---|
| `tests/design-artifacts/fixtures/design.html` | `4b76d96843b857ba69e424a092ef264756127871e5b8d70980b12c59079f9484` |
| `tests/design-artifacts/fixtures/port-faithful.html` | `77b0164aba577515ba0fdc726123ce1ce483b7c874ec80410d691e15ea9a072a` |
| `tests/design-artifacts/fixtures/port-regenerated.html` | `e4483fa93e809ce388b7f37d0b9c4a563ee594f8ecca06c7b1e65a94ca088ed3` |

Enforced by `internal/bench/ui/fixtures.lock.json`: a mismatch **refuses** the
run. Any fixture added later is a **new set, scored separately** — never a
revision of this one.

### Render epoch

Absolute `pixel` scores compare only **within** one platform + browser epoch,
because the fixtures use generic font families rather than embedded faces. Every
arm of a measurement therefore runs on **one host in one session** — which the
"one harness session" acceptance criterion already demanded for an unrelated
reason. Epoch of the controls' scored run: `chromium 148.0.7778.96` /
`darwin-arm64` / `node v25.9.0`.

## Measurement A — design

### Arms

| Arm | Builder tier | Grader tier | What it isolates |
|---|---|---|---|
| `A1-medium` | medium (shipped default) | high (shipped default) | the baseline as shipped |
| `A2-high` | high | high | the proposed flip's builder half |
| `A3-outlier-a11y` | medium | `accessibility-auditor` at medium (as shipped) | whether the medium-grader exception survives |
| `A4-outlier-architect` | `ui-component-architect` at high (as shipped) | high | whether the high-builder exception survives |

The two outlier arms exist so that a flip cannot silently erase a distinction
that may be deliberate. They are arms, not a footnote, because the harness makes
that nearly free.

### Runnability — registered, not yet executable

**No paid run has been fired, and none can be yet.** The arms above are
registered so that the run, whenever it becomes possible, has nothing left to
decide. What is missing is not authorization or budget but the ability to set the
builder tier **per arm**: the tier → native `model:` rewrite lives only in
`install.ts::finalize_claude_model_tiers` on a consumer install with
`model.auto_switch: auto`, this checkout pins no `model:` on any projected skill,
and a session-level `--model` cannot express the two outlier arms, which are
per-skill facts. Tracked as `measurement-a-no-per-arm-builder-tier` on the
roadmap. Registering the design before the capability exists is the point: it is
what stops the eventual run from choosing its own thresholds.

### N and cost discipline

**Registered N = 5 generations per arm** (20 generations total). A single
generation per arm would report generator variance as a tier effect; N=5 gives a
median plus an observed spread at a cost that stays inside the standing
benchmark-spend authorization. A cost estimate is rendered and stated **before**
the first paid call; if the authorized budget caps N below 5, the achieved N is
recorded **before** scoring, never after.

### Endpoints

1. **Fidelity** — the weighted total per candidate, plus every component score.
2. **Cost** — input + cache + output tokens and wall-clock per generation, from
   the runner's own usage capture, summed per arm.
3. **The pairing** — Δ fidelity against Δ cost between `A1-medium` and
   `A2-high`. A fidelity gain is only reported as a gain **paired with** the cost
   it took; a bare fidelity number is not a result.

### Decision rule — registered before the run

Reported on the **median** weighted total per arm, with the per-component medians
alongside (council-convergent: a weighted delta must be decomposed back into the
components, because the tier question is fundamentally about visual output and
`pixel` carries 0.40 of the weight):

- **Median Δ(A2 − A1) < 0.05** → **no tier effect.** The allocation stays as
  shipped, and the null is published. This is the expected outcome given the
  cost asymmetry, and saying so in advance is what keeps it from reading as a
  disappointment.
- **0.05 ≤ median Δ(A2 − A1) < 0.15, with `pixel` median Δ < 0.05** →
  **non-visual difference only.** Report which components drove it; do **not**
  flip the tier on a `dom`/`tokens`/`interactions`-only delta, since those are
  the components a cheaper model can match.
- **Median Δ(A2 − A1) ≥ 0.15 AND `pixel` median Δ ≥ 0.05** → **visual fidelity
  difference detected.** The tier-allocation question is live; the flip is then
  argued against the measured cost delta, not adopted automatically.
- **Any arm's median below the regenerated control (0.5243 in the controls'
  epoch)** → the *task*, not the tier, is the finding: the port prompt is
  underspecified and must be fixed before the tier question can be asked.

The 0.05 / 0.15 anchors are the scorer's own registered separation floor (0.25)
halved and quartered — the floor is the smallest separation the instrument
claims to resolve, so a tier effect smaller than a fifth of it is noise, and one
above 0.15 is above half the floor. They are not chosen from a distribution
because no distribution exists yet.

### Pre-registered null path

The `high` lift not clearing the cost difference is a **result, published as
one**. Builders run first, run longest, and re-run up to `POLISH_CEILING = 2`
(effective 3 with the one-round extension) while graders run once — so the cost
side is the expensive one by construction, and a null here is the outcome that
the current allocation is already correct.

## The `interactions` component — instrument amendment (registered before the run)

**The problem.** `interactions` (weight 0.20) is a checklist of selectors taken
from the ground truth's own markup — `[aria-controls='screen-archive']`,
`#screen-archive`, `#disclosure-toggle`, `#subscribe-submit`, plus a
`@keyframes rule-draw` assertion. `port-faithful.html` satisfies it fully, so a
faithful port evidently keeps those hooks. A *generated* port may implement the
same behaviour under different ids and score ~0, depressing the weighted total
for a reason that has nothing to do with model tier. Both tier arms would land in
the same low band, the run would report a null, and the null path above would
freeze the allocation on an instrument artefact.

**The council split.** One member proposed stating the id contract in the port
prompt. The other objected that this measures instruction-following on an
arbitrary constraint, and proposed instead a deterministic weight-degradation
rule: below an `interactions` score of **0.50** — asserted to be "the signature
of ID mismatches, not behavioral absence" — re-weight the component to 0.05 and
redistribute the freed 0.15 across the other three in proportion.

**AMENDMENT 2026-08-05 — the degradation rule is WITHDRAWN. Its discriminator is
falsified by data already in the tree.** It was drafted, implemented, and then
measured before publication rather than after; the measurement killed it.

The claim the rule rests on is that a low `interactions` score indicates renamed
hooks. The committed `port-regenerated` control scores **0.25** on
`interactions` — comfortably under the proposed trigger — and it is not a
renamed port at all: it is the pre-fix rebuild that genuinely never built the
archive screen or the disclosure toggle. Its recorded per-step failures are

```
screen switch      waiting for locator('[aria-controls=\'screen-archive\']')  (timeout)
disclosure toggle  waiting for locator('#disclosure-toggle')                  (timeout)
subscribe submit   ok
rule-draw keyframe no CSS rule matching @keyframes rule-draw
```

— i.e. **selector-resolution failures**, which is exactly the failure shape a
renamed-hooks port produces. So neither the score threshold nor the finer
"selector-not-found vs assertion-failed" discriminator separates *renamed the
hooks* from *never built the behaviour*. There is no observable in the current
instrument that does.

Applying the rule to that control, with the numbers as they were registered:

| | weighted | separation vs `port-faithful` (0.9877) |
|---|---:|---:|
| registered weights | 0.5243 | 0.4634 |
| degradation applied | 0.5757 | 0.4120 |

The rule would have handed **+0.0514** to a port that never built the behaviour,
and eroded the instrument's own discriminating power by the same amount. A rule
whose stated purpose is to stop an artefact from faking a null would instead have
manufactured one in the other direction. The separation stays above the 0.25
floor, so no committed test would have caught it — which is the point: it would
have shipped silently.

**Adopted instead — fix 1 only, and the instrument is not touched.** The port
prompt states the interaction contract explicitly: the handed-over artifact's
interactive hooks are part of what is being ported. That removes the real
unfairness the first member identified — an arm scored on a requirement it was
never given — without pretending to a discriminator that does not exist. Weights,
thresholds, and the scoring path are **unchanged**, so Measurement A is scored in
the same epoch as the committed controls and the 0.9877 / 0.5243 / 0.4634
anchors stay directly comparable.

The remaining objection is answered rather than dismissed: if both arms honour
the stated contract, a flat `interactions` score across arms is a **true** null
on that component, not an artefact. If an arm ignores a contract it was given,
that is a fidelity failure and belongs in the score.

**Re-scope condition.** If a generated arm's `interactions` failures turn out to
be dominated by hook renaming *despite* the stated contract, the answer is
selector-agnostic behavioural assertions (assert that some control toggles some
panel, not that `#disclosure-toggle` does) — a change to what the component
measures, validated on its own before use, and a new scoring epoch. It is not a
weight adjustment.

## Measurement B — structurally blocked

**Council-convergent: do not run it, and do not work around it.**

Measurement B needs two stacks where **both** lanes exist. The framework lanes
with a full bundle are `blade-livewire-flux`, `blade-livewire`, `filament` (all
PHP/Blade) and `react-shadcn`, `react`. The generic-routing lanes are `vue`,
`plain`, `unknown` — which have **no** framework lane to be compared against.

The blocker is structural, not merely a missing runtime:

- **PHP lanes** — no `php` and no `composer` on the measurement host; installing
  them is a human act.
- **React lanes** — the scorer captures `file://` HTML only; a React candidate
  needs a build/serve step that does not exist.
- **Lane forcing** — `GENERIC_LANES` is derived from detected stack state; there
  is no supported override to force the generic lane on a stack that has a
  framework bundle.

So there is currently **no stack pair** where (a) both lanes are defined, (b) both
are host-renderable, and (c) the framework lane needs no build step that has not
been built. Naming only "no PHP" would understate it.

**Docker is available on the host and is deliberately NOT used.** Rendering one
arm in a container and one on the host would make the 0.40-weighted `pixel`
component a cross-epoch comparison, i.e. 40 % of the weighted score would be
noise; rendering both in a container opens an epoch in which the existing
calibration anchors are void. A cheaper-looking path that invalidates the
instrument is not a path.

**Re-scope condition.** Measurement B becomes executable when either a
host-renderable framework lane exists (a build/serve step for the React lane,
landed for its own reason) **or** a supported generic-lane override exists. Until
then it stays open with the blocker named, and Measurement A publishes alone —
a null on one is not a null on the other.

## What may still change, and how

| Item | May change? | How |
|---|---|---|
| Component weights | No | Frozen with the fixture lock |
| Fixture set | No (extensions form a new set) | `--update-lock` opens a new epoch, visibly |
| What `interactions` measures | Only on the re-scope condition above | Selector-agnostic assertions, validated first, new epoch |
| N per arm | Downward only, recorded before scoring | Budget cap; achieved N stated in the report |
| Measurement A decision rule | No | Registered above |
| Measurement B scope | Yes, on the re-scope condition | Recorded as an amendment |

---
model_tier: high
name: tippspiel-optimizer
description: "Optimize prediction-pool tips (kicktipp etc.): pool rules + market odds → the expected-points-maximizing tip per match. Triggers 'optimize my pool tips', 'best kicktipp picks'."
domain: product
personas: []
workspaces:
  - small-business
packs:
  - fun
lifecycle: experimental
trust:
  level: experimental
install:
  default: false
  removable: true
---

# tippspiel-optimizer

> Turn a prediction pool's **scoring rules** plus **market odds** into the
> tip that maximizes **expected points** — not the most likely outcome.
> Sport-agnostic core with per-sport probability blocks. Consumed by
> [`/tippspiel`](../../commands/tippspiel.md). The optimization target is
> the pool's score, so the chain is always **rules → odds → expected value
> → participant field → tip**, never "who wins this match?".

## When to use

Use when someone wants the best tips for a prediction / betting pool
(kicktipp-style company pools — football WM, basketball WM, …) and the
target is **pool points**, not match truth. Triggered by the
[`/tippspiel`](../../commands/tippspiel.md) command (Steps 3–5) or directly
when a user asks to optimize / maximize their pool picks.

**The one idea that makes this skill correct:** the highest-probability
result is **not** the highest-expected-value tip. Under most pool rules a
2:1 or 1:0 scores the same partial points as the "obvious" pick but hits
more often; under quote/rarity rules a rare-but-plausible result is worth
more. **Always optimize the pool's points, never the truth of the match.**

## Hard rules

- **Rules before tips.** Never produce a tip before the pool's scoring is
  parsed (Procedure step 1). Strategy is a function of the rules.
- **Odds are the primary signal.** Bookmaker / market probabilities already
  fold in form, squad, injuries, travel, climate. Use them as the
  calibration base; only override with *current* information (confirmed
  lineups, late injuries, suspensions, manager change).
- **No invented numbers.** Emit no probability you cannot derive from odds
  or from **actually executed** code. Tournament/outright numbers come from
  real outright odds **or** the executed Poisson helper — never a claimed
  "I ran 10,000 simulations".
- **One-sentence justification** per tip. Short.

## Procedure

### 1. Parse the pool rules

From the pool's rule page, extract and document:

- Points for **exact result** / **goal (point) difference** / **tendency**.
- **Bonus questions** (champion, top scorer, group winners …).
- **Joker / multiplier** rules.
- **Quote / rarity** scoring (rare correct tips score more)? — flips the
  whole strategy toward contrarian (step 4).
- Special scorings, **deadlines**, and **strategy limits** (e.g. max N
  identical tips).
- **The goal**: place well, or *win* a large pool? (changes variance — step 4.)

### 2. Build the data base

Primary: current bookmaker odds, aggregated market probabilities, model
forecasts (e.g. Opta), Elo/SPI ratings. Secondary (only when it adds signal
the odds have not yet absorbed): confirmed lineups, injuries, suspensions,
manager change, recent form, home advantage, head-to-head, rest/travel,
weather. De-vig the odds (remove the bookmaker margin) before treating them
as probabilities.

### 3. Per-match probabilities (sport block)

Compute, per match, the outcome distribution and the most plausible exact
results. Pick the block for the event's sport:

**Football / soccer**
- Model goals as **Poisson** per side from each team's expected goals;
  draws are real (~22–28% baseline) — people under-tip them.
- Outcome split: home-win / draw / away-win; then the exact-score grid.
- Common EV-strong exact results: 1:0, 2:1, 1:1, 2:0.

**Basketball**
- **No draws.** Model the points margin as roughly **Gaussian** around the
  market spread; pair with the moneyline for win probability and the
  total (over/under) for the score level.
- Tendency = sign of (margin); "exact result" rules are rare — read step 1.

**Generic fallback (other sports)**
- Derive the outcome split straight from de-vigged moneyline odds; estimate
  a plausible score from the market total. State the model used.

Cross-check the model against the market; on a large divergence, re-check
the data and explain the cause before trusting it.

### 4. Convert to the EV-maximizing tip

Map probabilities to the tip with the **highest expected points under the
step-1 rules** — not the prettiest match.

- **Standard fixed-point scoring + goal "place well"** → tip the EV-maximal
  result per match. Favourites with modest scorelines dominate. **No
  contrarian** — only your tip matters for your score, so deliberately
  tipping "different" just burns EV.
- **Quote / rarity scoring** → weigh rarer-but-plausible results against
  their higher payout; take rarity when `payout × probability` wins.
- **Goal = win a large pool** → on a *subset* of matches, take calculated
  variance (plausible underdogs) to create upside, poker-tournament style.

**Participant-field thresholds** (when two tips are close, prefer the one
with the higher edge over the typical participant):

- Pool **N < 20** → maximize EV, ignore the field.
- **20 ≤ N < 100 and you are in the prize positions** → maximize EV.
- **N ≥ 100, or you are outside the top ~20%** → add field-relative
  variance (move off the consensus on a subset; rough Kelly-fraction sizing).

Respect all strategy limits from step 1 (max identical tips, etc.).

### 5. Tournament & bonus questions (no hallucination)

For group winners, KO rounds, champion, and bonus questions, use **either**:

- real **outright market odds** ("to win group", "to reach final",
  "outright winner"), **or**
- the executed Poisson tournament simulator:

  ```bash
  python3 scripts/tippspiel/poisson_sim.py <teams-xg.json> --runs 20000
  ```

  It plays the bracket from per-team expected goals and prints empirical
  advancement / title probabilities. **Run it — never report simulated
  numbers you did not actually compute.**

Optimize bonus answers on the same expected-points basis. Re-run as late as
the deadline allows: re-check confirmed lineups, injuries, suspensions, and
odds movement, then adjust. The pool's per-match deadline is the only hard
constraint.

## Output format

1. **Approval table** — one row per match:

   ```
   Match | Tip | Prob / EV | Risk (low/med/high) | 1-line reason | Odds used
   ```

2. **Group standings, the full bracket, and bonus-question answers** where
   the event has them.
3. **Self-check note** — confirm the tips reconcile with
   [`reference/ev-fixtures.md`](reference/ev-fixtures.md) (known pool rules +
   market odds → a known-good EV tip). If your method disagrees with a
   fixture, your method is wrong — find the error (usually a forgotten
   partial-points term or un-de-vigged odds), don't ship the tip.

Handed back to [`/tippspiel`](../../commands/tippspiel.md) for the approval
gate — the skill never enters or submits anything.

## Gotcha

- **Tipping the modal result, not the EV-maximal one.** The single most
  likely scoreline rarely maximizes partial points — compute EV across the
  result grid, don't eyeball the favourite.
- **Forgetting to de-vig.** Raw bookmaker odds sum to >100%; treating them
  as probabilities inflates the favourite. Remove the margin first.
- **Contrarian under fixed points.** Deviating "to stand out" only helps
  under quote/rarity rules or a win-a-large-pool goal — otherwise it burns EV.
- **Claimed-but-unrun simulation.** Numbers like "I ran 10,000 tournaments"
  without executing `poisson_sim.py` are hallucinated — run the code or use
  outright odds.

## Do NOT

- Tip the most likely result instead of the EV-maximal one.
- Go contrarian under standard fixed-point scoring with a "place well" goal.
- Report Monte-Carlo numbers without running `poisson_sim.py`.
- Treat raw odds as probabilities without removing the vig.
- Give betting or financial advice — this optimizes a game; the human submits.

## See also

- [`/tippspiel`](../../commands/tippspiel.md) — the orchestrator (event,
  persistence, Playwright entry, gates).
- [`reference/ev-fixtures.md`](reference/ev-fixtures.md) — known-good
  rules+odds → EV examples.
- [`scripts/tippspiel/poisson_sim.py`](../../../../scripts/tippspiel/poisson_sim.py) —
  the executed tournament simulator.

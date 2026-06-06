---
model_tier: high
name: prediction-pool-optimizer
description: "Optimize prediction-pool tips (kicktipp etc.): rules + multi-book consensus odds → expected-points-max answer for every question, scores AND bonus. Triggers 'optimize my pool tips', 'predict'."
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

# prediction-pool-optimizer

> Turn a prediction pool's **scoring rules** plus a **consensus of the major
> bookmakers' odds** into the answer that maximizes **expected points** — not
> the most likely outcome — for **every open question in the pool**: match
> scores AND every bonus / award / special question (top scorer, group
> winners, champion, most cards …). Sport-agnostic core with per-sport
> probability blocks. Consumed by [`/prediction-pool`](../../commands/prediction-pool.md).
> The optimization target is the pool's score, so the chain is always
> **rules → odds → expected value → participant field → answer**, never
> "who wins this match?".

## When to use

When someone wants the best tips for a prediction / betting pool
(kicktipp-style company pools — football WM, basketball WM, …) and the
target is **pool points**, not match truth. Triggered by
[`/prediction-pool`](../../commands/prediction-pool.md) (Steps 3–5) or directly
when a user asks to optimize / maximize their pool picks.

**The one idea that makes this skill correct:** the highest-probability
result is **not** the highest-expected-value tip. Under most pool rules a
2:1 or 1:0 scores the same partial points as the "obvious" pick but hits
more often; under quote/rarity rules a rare-but-plausible result is worth
more. **Always optimize the pool's points, never the truth of the match.**

## Hard rules

- **Rules before tips.** Never produce a tip before the pool's scoring is
  parsed (Procedure step 1). Strategy is a function of the rules.
- **Answer EVERY open question.** A pool has scores *and* bonus / award /
  special questions ("which team supplies the top scorer?", "most yellow
  cards?", "champion?"). Scorelines only, bonus questions blank = a **failed
  run** — enumerate every open question in step 1, carry each to an answer
  (steps 5–6). No silent skips.
- **Odds are the primary signal — multi-book consensus, not one book.**
  Bookmaker probabilities already fold in form, squad, injuries, travel,
  climate. Build the base from a **consensus across the 5–10 biggest
  publicly-viewable books** (step 2), de-vigged, **sharpness-weighted** —
  never mirror a single portal. Override only with *current* info (confirmed
  lineups, late injuries, suspensions, manager change).
- **No invented numbers.** Emit no probability you cannot derive from real
  odds or **actually executed** code. Tournament/outright/award numbers come
  from real markets **or** the executed Poisson helper — never a claimed
  "I ran 10,000 simulations".
- **Scorelines computed, not guessed.** EV-max tip per match from the executed
  grid optimiser (`score_ev.py`, step 4a), never the eye. A 3:2 / 4:1 / 1:4 in
  the output = signature of a skipped computation.
- **One-sentence justification** per answer. Short.

## Procedure

### 1. Parse the pool rules AND enumerate every open question

From the pool's rule page, extract and document:

- Points for **exact result** / **goal (point) difference** / **tendency**.
- **Every bonus / award / special question** (champion, top scorer, "team of
  the top scorer", group winners, most cards, longest unbeaten,
  will-there-be-a-red-card, over/under totals …). **Write them all down as an
  explicit checklist** — this list is the run's contract; every entry must
  reach an answer.
- **Joker / multiplier** rules, per-question point weights.
- **Quote / rarity** scoring (rare correct tips score more)? — flips strategy
  toward contrarian (step 4).
- Special scorings, **per-question deadlines**, **strategy limits** (e.g. max
  N identical tips).
- **The goal**: place well, or *win* a large pool? (changes variance — step 4.)

### 2. Build the data base — a consensus across the major books

Primary signal: current bookmaker odds, **aggregated across the 5–10 biggest
publicly-viewable books**, not a single portal:

1. **Collect** odds for each market (1X2, exact-score, outrights, and each
   special/award market a bonus question needs) from several books.
   Odds-comparison aggregators (Oddschecker, Oddsportal / Betexplorer) show
   many books at once; supplement with named books. Book list + weighting
   recipe in [`reference/odds-and-bonus.md`](reference/odds-and-bonus.md).
2. **De-vig each book** independently (remove its margin) → per-book implied
   probabilities. Raw odds sum to >100%; never treat them as probabilities.
3. **Aggregate with a healthy weighting**, not a blind average: weight
   **sharp, low-margin books higher** (Pinnacle, Betfair Exchange),
   recreational books lower; weighted mean or trimmed median so one outlier
   book cannot swing the base. Result = the **consensus probability** — the
   calibration base.
4. **Single-book outlier = flag, not truth** — investigate *why* (priced-in
   injury? stale line?) before moving off consensus. Cross-portal agreement is
   signal; one portal disagreeing is a prompt to check, not to follow.

Secondary (only when it adds signal the consensus has not absorbed): confirmed
lineups, injuries, suspensions, manager change, recent form, home advantage,
head-to-head, rest/travel, weather, model forecasts (Opta), Elo/SPI ratings.

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

Cross-check the model against the consensus; on a large divergence, re-check
the data and explain the cause before trusting it.

### 4. Convert to the EV-maximizing tip

Map probabilities to the tip with the **highest expected points under the
step-1 rules** — not the prettiest match.

#### 4a. The EV-max scoreline is computed, never eyeballed

Don't hand-pick a scoreline. Run the executed grid optimiser — builds the full
Poisson score grid, returns the EV-max tip under the step-1 point tiers:

```bash
python3 scripts/prediction-pool/score_ev.py --lh <home-xg> --la <away-xg> \
    --tendency <t> --diff <d> --exact <e>          # one match
python3 scripts/prediction-pool/score_ev.py matches.json \
    --tendency <t> --diff <d> --exact <e>          # batch, prints a ranked table
```

Two facts the grid makes unavoidable, intuition gets wrong:

- **High scorelines almost never EV-max.** Under partial points a moderate
  favourite peaks at **1:0 / 2:0 / 2:1**; **1:0 wins surprisingly often**, top
  of the surface is *flat* (1:0 vs 2:1 vs 2:0 within hundredths). 3:2 / 4:1 /
  1:4 never optimal — such a tip means the grid wasn't run.
- **Draws under-tipped.** A correct draw banks the goal-difference tier on
  every draw scoreline, so in a close match (xG within ~0.4) a 1:1 can
  out-score a 1:0 — and for low-scoring even games (λ ≲ 1.0/side) a 0:0 is the
  EV-max. Let the grid decide; the eye tips too few draws.

- **Standard fixed-point scoring + goal "place well"** → tip the grid's EV-max
  per match. **No contrarian** — only your tip scores, tipping "different"
  burns EV.
- **Quote / rarity scoring** → weigh rarer-but-plausible results against payout;
  take rarity when `payout × probability` wins (raise `--exact` or post-process
  the ranked table by the multiplier).

#### 4b. Large pool, goal "win it" — measure P(finish 1st), don't guess

Goal = **win** a large pool → target flips from E(points) to **P(finish ahead
of the field)**; pure EV-max converges with the crowd, can't open a gap.
Measure it with the executed field simulator, not a "rough Kelly" hand-wave:

```bash
python3 scripts/prediction-pool/pool_winsim.py pool.json --runs 4000 --max-flips 4
```

Models the field as softmax-EV tippers, reports `P(win)` for EV-max-everywhere,
then greedily reports **which few tips to flip** off EV-max (EV cost + P(win)
gain each). Read it as the field threshold, empirically:

- Pool **N < 20** → sim shows flips barely move P(win); maximize EV, ignore the
  field.
- **20 ≤ N < 100 and in the prize positions** → maximize EV.
- **N ≥ 100, or outside the top ~20%** → take the sim's suggested flips: a
  handful of higher-variance scorelines on high-consensus matches lift P(win)
  most per unit EV given up. Flip only what the sim says pays — variance you
  don't need is wasted EV.

Respect all strategy limits from step 1 (max identical tips, etc.).

### 5. Tournament, bonus & special questions — answer every one (no hallucination)

Walk the **step-1 checklist** and answer **each** entry. Pick the method by
question type — full taxonomy + per-type method in
[`reference/odds-and-bonus.md`](reference/odds-and-bonus.md):

- **Tournament structure** (group winners, KO rounds, finalists, champion):
  real **outright market odds** ("to win group", "to reach final", "outright
  winner") aggregated per step 2, **or** the executed Poisson simulator:

  ```bash
  python3 scripts/prediction-pool/poisson_sim.py <teams-xg.json> --runs 20000
  ```

  It plays the bracket from per-team expected goals and prints empirical
  advancement / title probabilities. **Run it — never report simulated
  numbers you did not actually compute.**

- **Award / player markets** (top scorer, most assists, "which team supplies
  the top scorer", golden boot, most cards): use the matching **special
  market** — e.g. aggregate per-player "top goalscorer" odds **by team** to
  answer "which team has the top scorer". No clean market → derive from a
  stated model (squad strength × games-expected) and **label it a model
  estimate**, not a market number.

- **Binary / over-under specials** (red card yes/no, over/under total
  goals/cards): de-vig the consensus probability for the line, pick the EV-max
  side under the question's point weight.

Optimize every answer on the same expected-points basis as the scores. Re-run
as late as each question's deadline allows: re-check confirmed lineups,
injuries, suspensions, odds movement, then adjust. The per-question deadline is
the only hard constraint.

## Output format

1. **Approval table** — one row per match:

   ```
   Match | Tip | Prob / EV | Risk (low/med/high) | 1-line reason | Books used
   ```

   `Books used` names the consensus base (e.g. "consensus of 7 books, sharp-weighted").

2. **Bonus & special answers** — one row per open question from the step-1
   checklist, **every entry answered** (none blank):

   ```
   Question | Answer | Prob / EV | Risk | 1-line reason | Source (market / model)
   ```

3. **Group standings and the full bracket** where the event has them.
4. **Self-check note** — (a) tips reconcile with
   [`reference/ev-fixtures.md`](reference/ev-fixtures.md) (known rules + odds →
   known-good EV tip); (b) bonus table has the **same number of rows as the
   step-1 checklist** — a shorter table means a question was dropped. If your
   method disagrees with a fixture, your method is wrong — find the error
   (usually a forgotten partial-points term, un-de-vigged odds, or following
   one book instead of the consensus), don't ship the tip.

Handed back to [`/prediction-pool`](../../commands/prediction-pool.md) for the approval
gate — the skill never enters or submits anything.

## Gotcha

- **Answering only the scores.** Bonus / award questions carry real points;
  leaving them blank because they are "not a scoreline" forfeits them. The
  step-1 checklist exists so every question is answered.
- **Following one portal.** A single book can be stale or shaded; build the
  base from a sharp-weighted consensus across several; an outlier is a flag to
  investigate, not a number to copy.
- **Tipping the modal result, not the EV-maximal one.** The single most likely
  scoreline rarely maximizes partial points — run `score_ev.py` across the
  result grid, don't eyeball the favourite.
- **Hand-picking a high scoreline.** 3:2 / 4:1 / 1:4 never EV-max under partial
  points — moderate favourites peak at 1:0 / 2:0 / 2:1. A high tip = grid
  skipped; run `score_ev.py`.
- **Under-tipping draws.** A correct draw banks the goal-difference tier on
  every draw scoreline, so a close match can want 1:1 (or 0:0). Let the grid
  decide; the eye tips too few draws.
- **"Rough Kelly" variance for a large pool.** Don't guess deviation amount —
  run `pool_winsim.py`; returns the exact flips that raise P(finish 1st) most
  per unit EV given up.
- **Forgetting to de-vig.** Raw bookmaker odds sum to >100%; treating them as
  probabilities inflates the favourite. Remove the margin **per book** before
  aggregating.
- **Contrarian under fixed points.** Deviating "to stand out" only helps under
  quote/rarity rules or a win-a-large-pool goal — otherwise it burns EV.
- **Claimed-but-unrun simulation.** "I ran 10,000 tournaments" without
  executing `poisson_sim.py` is hallucinated — run the code or use outright odds.

## Do NOT

- Leave any open pool question (bonus / award / special) unanswered.
- Build the base from a single bookmaker, or skip de-vigging before aggregating.
- Tip the most likely result instead of the EV-maximal one.
- Hand-pick a scoreline instead of running `score_ev.py` — never emit a
  3:2 / 4:1 / 1:4 tip, never EV-max under partial points.
- Go contrarian under standard fixed-point scoring with a "place well" goal.
- Guess large-pool variance ("rough Kelly") instead of running `pool_winsim.py`.
- Report Monte-Carlo numbers without running `poisson_sim.py` / `pool_winsim.py`.
- Treat raw odds as probabilities without removing the vig.
- Give betting or financial advice — this optimizes a game; the human submits.

## See also

- [`/prediction-pool`](../../commands/prediction-pool.md) — the orchestrator (event,
  persistence, Playwright entry, gates).
- [`reference/odds-and-bonus.md`](reference/odds-and-bonus.md) — major-book list
  + sharpness-weighted consensus recipe, and the bonus / award / special
  question taxonomy with a per-type method.
- [`reference/ev-fixtures.md`](reference/ev-fixtures.md) — known-good
  rules+odds → EV examples.
- [`scripts/prediction-pool/score_ev.py`](../../../../scripts/prediction-pool/score_ev.py) —
  executed exact-score EV optimiser (step 4a; λ + rule → EV-max scoreline).
- [`scripts/prediction-pool/pool_winsim.py`](../../../../scripts/prediction-pool/pool_winsim.py) —
  executed field model + P(finish 1st) simulator and flip-finder (step 4b).
- [`scripts/prediction-pool/poisson_sim.py`](../../../../scripts/prediction-pool/poisson_sim.py) —
  the executed tournament simulator (step 5).

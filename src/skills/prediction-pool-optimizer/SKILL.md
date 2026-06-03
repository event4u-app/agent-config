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

Use when someone wants the best tips for a prediction / betting pool
(kicktipp-style company pools — football WM, basketball WM, …) and the
target is **pool points**, not match truth. Triggered by the
[`/prediction-pool`](../../commands/prediction-pool.md) command (Steps 3–5) or directly
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
  cards?", "champion?"). Producing scorelines only and leaving the bonus
  questions blank is a **failed run** — enumerate every open question in
  step 1 and carry each to an answer (steps 5–6). No silent skips.
- **Odds are the primary signal — as a multi-book consensus, not one book.**
  Bookmaker / market probabilities already fold in form, squad, injuries,
  travel, climate. Build the base from a **consensus across the 5–10 biggest
  publicly-viewable books** (step 2), de-vigged, **sharpness-weighted** — never
  mirror a single portal. Only override with *current* information (confirmed
  lineups, late injuries, suspensions, manager change).
- **No invented numbers.** Emit no probability you cannot derive from real
  odds or from **actually executed** code. Tournament/outright/award numbers
  come from real markets **or** the executed Poisson helper — never a claimed
  "I ran 10,000 simulations".
- **Scorelines are computed, not guessed.** The EV-max tip per match comes
  from the executed grid optimiser (`score_ev.py`, step 4a), never the eye. A
  3:2 / 4:1 / 1:4 in the output is the signature of a skipped computation.
- **One-sentence justification** per answer. Short.

## Procedure

### 1. Parse the pool rules AND enumerate every open question

From the pool's rule page, extract and document:

- Points for **exact result** / **goal (point) difference** / **tendency**.
- **Every bonus / award / special question** the pool asks (champion, top
  scorer, "team of the top scorer", group winners, most cards, longest
  unbeaten, will-there-be-a-red-card, over/under totals …). **Write them all
  down as an explicit checklist** — this list is the run's contract; every
  entry must reach an answer.
- **Joker / multiplier** rules, per-question point weights.
- **Quote / rarity** scoring (rare correct tips score more)? — flips the
  whole strategy toward contrarian (step 4).
- Special scorings, **per-question deadlines**, and **strategy limits**
  (e.g. max N identical tips).
- **The goal**: place well, or *win* a large pool? (changes variance — step 4.)

### 2. Build the data base — a consensus across the major books

Primary signal: current bookmaker odds, but **aggregated across the 5–10
biggest publicly-viewable books**, not a single portal:

1. **Collect** the odds for each market (1X2, exact-score, outrights, and
   each special/award market a bonus question needs) from several books.
   Odds-comparison aggregators (Oddschecker, Oddsportal / Betexplorer) show
   many books at once; supplement with named books. Concrete book list and
   the weighting recipe live in [`reference/odds-and-bonus.md`](reference/odds-and-bonus.md).
2. **De-vig each book** independently (remove its margin) → per-book implied
   probabilities. Raw odds sum to >100%; never treat them as probabilities.
3. **Aggregate with a healthy weighting**, not a blind average: weight
   **sharp, low-margin books higher** (Pinnacle, Betfair Exchange) and
   recreational books lower; use a weighted mean or a trimmed median so one
   outlier book cannot swing the base. The result is the **consensus
   probability** — the calibration base.
4. **Treat a single book's outlier as a flag, not a truth** — investigate
   *why* (a known injury already priced? a stale line?) before moving off
   consensus. Cross-portal agreement is signal; one portal disagreeing is a
   prompt to check, not to follow.

Secondary (only when it adds signal the consensus has not yet absorbed):
confirmed lineups, injuries, suspensions, manager change, recent form, home
advantage, head-to-head, rest/travel, weather, model forecasts (Opta),
Elo/SPI ratings.

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

Do **not** hand-pick a scoreline. Run the executed grid optimiser — it builds
the full Poisson score grid and returns the expected-points-max tip under the
step-1 point tiers:

```bash
python3 scripts/prediction-pool/score_ev.py --lh <home-xg> --la <away-xg> \
    --tendency <t> --diff <d> --exact <e>          # one match
python3 scripts/prediction-pool/score_ev.py matches.json \
    --tendency <t> --diff <d> --exact <e>          # batch, prints a ranked table
```

Two facts the grid makes unavoidable — and intuition gets wrong:

- **High scorelines are almost never EV-max.** Under any partial-points rule a
  moderate favourite peaks at **1:0 / 2:0 / 2:1**; **1:0 wins surprisingly
  often**, and the top of the EV surface is *flat* (1:0 vs 2:1 vs 2:0 separated
  by hundredths). A 3:2 / 4:1 / 1:4 tip is never the optimum — if a tip like
  that appears, the grid was not run.
- **Draws are under-tipped.** A correctly-tipped draw banks the goal-difference
  tier on every draw scoreline, so in a close match (xG within ~0.4) a 1:1 can
  out-score a 1:0. The grid surfaces this; the eye does not. People tip too few
  draws — let the computation, not the gut, decide.

- **Standard fixed-point scoring + goal "place well"** → tip the grid's
  EV-max per match. **No contrarian** — only your tip matters for your score,
  so deliberately tipping "different" just burns EV.
- **Quote / rarity scoring** → weigh rarer-but-plausible results against their
  higher payout; take rarity when `payout × probability` wins (raise `--exact`
  weight or post-process the ranked table by the multiplier).

#### 4b. Large pool, goal "win it" — measure P(finish 1st), don't guess

When the goal is to **win** a large pool (not place), the target flips from
E(points) to **P(finish ahead of the whole field)** — and pure EV-max converges
with the crowd, so it cannot open a gap. Measure it with the executed field
simulator instead of a "rough Kelly" hand-wave:

```bash
python3 scripts/prediction-pool/pool_winsim.py pool.json --runs 4000 --max-flips 4
```

It models the field as softmax-EV tippers, reports `P(win)` for the
EV-max-everywhere baseline, then greedily reports **which few tips to flip**
off EV-max (and the EV cost + P(win) gain of each). Read the output as the
field threshold, empirically:

- Pool **N < 20** → the sim shows flips barely move P(win); maximize EV, ignore
  the field.
- **20 ≤ N < 100 and you are in the prize positions** → maximize EV.
- **N ≥ 100, or you are outside the top ~20%** → take the simulator's
  suggested flips: a handful of higher-variance scorelines on high-consensus
  matches lift P(win) most per unit of EV given up. Flip only what the sim says
  pays — variance you don't need is wasted EV.

Respect all strategy limits from step 1 (max identical tips, etc.).

### 5. Tournament, bonus & special questions — answer every one (no hallucination)

Walk the **step-1 checklist** and answer **each** entry. Pick the method by
question type — full taxonomy + per-type method in
[`reference/odds-and-bonus.md`](reference/odds-and-bonus.md):

- **Tournament structure** (group winners, KO rounds, finalists, champion):
  use real **outright market odds** ("to win group", "to reach final",
  "outright winner") aggregated per step 2, **or** the executed Poisson
  tournament simulator:

  ```bash
  python3 scripts/prediction-pool/poisson_sim.py <teams-xg.json> --runs 20000
  ```

  It plays the bracket from per-team expected goals and prints empirical
  advancement / title probabilities. **Run it — never report simulated
  numbers you did not actually compute.**

- **Award / player markets** (top scorer, most assists, "which team supplies
  the top scorer", golden boot, most cards): use the matching **special
  market** — e.g. aggregate per-player "top goalscorer" odds **by team** to
  answer "which team has the top scorer". Where no clean market exists, derive
  from a stated model (e.g. squad strength × games-expected) and **label it
  as a model estimate**, not a market number.

- **Binary / over-under specials** (will there be a red card, over/under total
  goals/cards): take the de-vigged consensus probability for the line and pick
  the EV-max side under the question's point weight.

Optimize every answer on the same expected-points basis as the scores. Re-run
as late as each question's deadline allows: re-check confirmed lineups,
injuries, suspensions, and odds movement, then adjust. The per-question
deadline is the only hard constraint.

## Output format

1. **Approval table** — one row per match:

   ```
   Match | Tip | Prob / EV | Risk (low/med/high) | 1-line reason | Books used
   ```

   `Books used` names the consensus base (e.g. "consensus of 7 books, sharp-weighted").

2. **Bonus & special answers** — one row per open question from the step-1
   checklist, **every entry answered** (none left blank):

   ```
   Question | Answer | Prob / EV | Risk | 1-line reason | Source (market / model)
   ```

3. **Group standings and the full bracket** where the event has them.
4. **Self-check note** — (a) confirm the tips reconcile with
   [`reference/ev-fixtures.md`](reference/ev-fixtures.md) (known pool rules +
   market odds → a known-good EV tip); (b) confirm the bonus table has the
   **same number of rows as the step-1 checklist** — a shorter table means a
   question was dropped. If your method disagrees with a fixture, your method
   is wrong — find the error (usually a forgotten partial-points term,
   un-de-vigged odds, or following one book instead of the consensus), don't
   ship the tip.

Handed back to [`/prediction-pool`](../../commands/prediction-pool.md) for the approval
gate — the skill never enters or submits anything.

## Gotcha

- **Answering only the scores.** A pool's bonus / award questions carry real
  points; leaving them blank because they are "not a scoreline" silently
  forfeits them. The step-1 checklist exists so every question is answered.
- **Following one portal.** A single book can be stale or shaded; build the
  base from a sharp-weighted consensus across several and treat an outlier as
  a flag to investigate, not a number to copy.
- **Tipping the modal result, not the EV-maximal one.** The single most
  likely scoreline rarely maximizes partial points — run `score_ev.py` across
  the result grid, don't eyeball the favourite.
- **Hand-picking a high scoreline.** 3:2 / 4:1 / 1:4 are never EV-max under
  partial-points rules — moderate favourites peak at 1:0 / 2:0 / 2:1. A high
  tip in the output means the grid was skipped; run `score_ev.py`.
- **Under-tipping draws.** A correct draw banks the goal-difference tier on
  every draw scoreline, so in a close match a 1:1 can beat a 1:0. Let the grid
  decide; the eye tips too few draws.
- **"Rough Kelly" variance for a large pool.** Don't guess how much to deviate
  — run `pool_winsim.py`; it returns the exact flips that raise P(finish 1st)
  most per unit of EV given up.
- **Forgetting to de-vig.** Raw bookmaker odds sum to >100%; treating them
  as probabilities inflates the favourite. Remove the margin **per book**
  before aggregating.
- **Contrarian under fixed points.** Deviating "to stand out" only helps
  under quote/rarity rules or a win-a-large-pool goal — otherwise it burns EV.
- **Claimed-but-unrun simulation.** Numbers like "I ran 10,000 tournaments"
  without executing `poisson_sim.py` are hallucinated — run the code or use
  outright odds.

## Do NOT

- Leave any open pool question (bonus / award / special) unanswered.
- Build the base from a single bookmaker, or skip de-vigging before aggregating.
- Tip the most likely result instead of the EV-maximal one.
- Hand-pick a scoreline instead of running `score_ev.py` — and never emit a
  3:2 / 4:1 / 1:4 tip, which is never EV-max under partial points.
- Go contrarian under standard fixed-point scoring with a "place well" goal.
- Guess large-pool variance ("rough Kelly") instead of running `pool_winsim.py`.
- Report Monte-Carlo numbers without running `poisson_sim.py` / `pool_winsim.py`.
- Treat raw odds as probabilities without removing the vig.
- Give betting or financial advice — this optimizes a game; the human submits.

## See also

- [`/prediction-pool`](../../commands/prediction-pool.md) — the orchestrator (event,
  persistence, Playwright entry, gates).
- [`reference/odds-and-bonus.md`](reference/odds-and-bonus.md) — the major-book
  list + sharpness-weighted consensus recipe, and the bonus / award / special
  question taxonomy with a per-type method.
- [`reference/ev-fixtures.md`](reference/ev-fixtures.md) — known-good
  rules+odds → EV examples.
- [`scripts/prediction-pool/score_ev.py`](../../../../scripts/prediction-pool/score_ev.py) —
  the executed exact-score EV optimiser (step 4a; λ + rule → EV-max scoreline).
- [`scripts/prediction-pool/pool_winsim.py`](../../../../scripts/prediction-pool/pool_winsim.py) —
  the executed field model + P(finish 1st) simulator and flip-finder (step 4b).
- [`scripts/prediction-pool/poisson_sim.py`](../../../../scripts/prediction-pool/poisson_sim.py) —
  the executed tournament simulator (step 5).

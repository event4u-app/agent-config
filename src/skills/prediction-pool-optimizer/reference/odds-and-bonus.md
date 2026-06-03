# Odds aggregation + bonus-question taxonomy

Lookup material for `prediction-pool-optimizer`. Two parts:

- **A — Multi-book consensus**: which books to read, how to weight them, how
  to fold them into one calibration probability.
- **B — Bonus / award / special questions**: a type → method table so every
  open question in the pool reaches an answer.

Nothing here is betting advice; it is how to read a public market as a
probability prior for a fun pool.

---

## A. Multi-book consensus — read several, weight by sharpness

### Why not one book

A single bookmaker's line can be stale, regionally shaded, or carry a fat
margin. A consensus across several books is a far better probability
estimate, and cross-book agreement tells you how confident the market is.
**Never mirror one portal.**

### Which books (5–10, publicly viewable)

Availability varies by region and over time — this list is **illustrative,
refresh it at run time** and use whatever is publicly viewable from the
current locale. The fastest way to see many at once is an **odds-comparison
aggregator**:

- **Aggregators (many books on one page):** Oddschecker, Oddsportal,
  Betexplorer, OddsAlert.
- **Sharp / low-margin reference books (weight higher):** Pinnacle,
  Betfair Exchange (an exchange = the closest thing to a true market price).
- **Large recreational books (weight lower):** bet365, Bwin, William Hill,
  Unibet, Betano, Tipico, Interwetten, bet-at-home, 888sport, Winamax.

Aim for **5–10** spanning both groups. If only recreational books are
viewable, say so in the run note — the consensus is then softer.

### The recipe

1. **Per market, per book**: collect the decimal odds (1X2, exact-score,
   each outright, each special/award market a bonus question needs).
2. **De-vig each book independently.** For a 1X2 market with decimal odds
   `o_H, o_D, o_A`, the raw implied probs are `1/o`; they sum to `>1` (the
   overround). Normalise: `p_i = (1/o_i) / Σ(1/o)`. Do this **per book** —
   never aggregate raw odds.
3. **Sharpness-weight and combine.** Give sharp books more weight than
   recreational ones, then take a **weighted mean** — or a **trimmed median**
   when books disagree a lot (robust to one outlier). A simple, defensible
   weighting:

   - Pinnacle / Betfair Exchange → weight 3
   - large recreational books → weight 1
   - aggregator "average" column → weight 1 (it already blends many)

   `p_consensus = Σ(wᵢ · pᵢ) / Σwᵢ`, computed per outcome, then re-normalise
   the outcome set to sum to 1.
4. **Outlier handling.** If one book is far off the others, that is a **flag,
   not a truth**: check for a reason (priced-in injury, stale line) before
   moving the consensus. Cross-book agreement = signal; one disagreeing book
   = investigate.
5. **Healthy weighting overall.** The consensus is a **prior**. Blend it with
   the per-sport model (Poisson / Gaussian) and only override with *current*
   info the market has not yet absorbed (confirmed lineup, late injury,
   suspension, manager change). The pool answer is EV under the rules on top
   of this blended probability — the market informs, it does not dictate.

### Worked mini-example (1X2)

Two books, home/draw/away decimal odds:

- Book S (sharp, w=3): 1.80 / 3.60 / 4.50 → raw 0.556/0.278/0.222 (sum 1.056)
  → de-vig 0.526/0.263/0.210
- Book R (recreational, w=1): 1.75 / 3.50 / 4.20 → raw 0.571/0.286/0.238
  (sum 1.095) → de-vig 0.522/0.261/0.217

Weighted mean (3:1), per outcome, then renormalise:
≈ **Home 0.525 / Draw 0.262 / Away 0.212**. That is the calibration base for
the per-match EV grid — not either book's raw number.

---

## B. Bonus / award / special questions — type → method

Every entry on the step-1 checklist gets an answer. Match the question to a
row; use a real market where one exists, a **labelled** model estimate where
none does. Optimize each on expected points under its point weight.

| Question type | Example | Method |
|---|---|---|
| **Outright winner** | "Who wins the tournament?" | Outright "to win" market, consensus per A; or `poisson_sim.py` `title_pct`. EV-max under the question's points. |
| **Group / stage** | "Who wins group X?", "Who advances?" | "To win group" / "to qualify" markets; or `advance_pct` from the simulator. |
| **Finalists / matchup** | "Who reaches the final?" | "To reach final" market per team; simulator pairing is approximate — prefer the market. |
| **Top scorer (player)** | "Tournament top scorer?" | "Top goalscorer" outright market, consensus per A; pick the EV-max player (favourite unless rarity scoring rewards a longer shot). |
| **Team of the top scorer** | "Which team supplies the top scorer?" | Aggregate per-player top-scorer probabilities **by team** (sum each squad's players); pick the team with the highest summed probability. |
| **Most assists / cards / etc.** | "Most yellow cards?" | The matching special market if offered; else a labelled model estimate (e.g. discipline/aggression proxy). |
| **Binary special** | "Will there be a red card in match X?" | De-vig the yes/no line to a probability; pick the EV-max side under the points. No market → labelled base-rate estimate. |
| **Over / under total** | "Over/under total goals / cards?" | De-vig the totals line at the offered threshold; pick the side with higher EV. |
| **Exact stat** | "How many goals in the final?" | Market totals distribution if available; else the per-match Poisson on consensus xG. State the model. |

### Rules for bonus answers

- **Answer all of them.** The output's bonus table must have the same number
  of rows as the step-1 checklist. A missing row is a dropped question.
- **Market first, labelled model second.** Prefer a real special market;
  when none exists, derive from a stated model and mark `Source: model`.
- **Rarity rules apply here too.** Under quote/rarity scoring, a
  plausible-but-rarer answer can out-score the favourite when
  `payout × probability` is higher — same EV logic as the scores.
- **No hallucinated numbers.** Outright/award probabilities come from real
  markets or the executed simulator — never a claimed-but-unrun simulation.

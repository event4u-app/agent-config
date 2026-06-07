# EV fixtures — known-good rules + odds → tip

Sanity-check fixtures for `prediction-pool-optimizer` Step "Self-check". Each
fixture states a scoring rule, the (de-vigged) market probabilities, and
the expected-points-maximizing tip. If your method disagrees with a
fixture, your method is wrong — find the error before shipping a tip.

These are illustrative, not exhaustive. Add fixtures for any pool rule
shape you encounter so future runs catch the same class of drift.

---

## Fixture 1 — standard fixed points, goal "place well"

**Rule:** exact result = 4, goal-difference = 3, tendency = 2, else 0.
No quote rule. No strategy limit. Goal: place well.

**Match (football):** Poisson on market xG ≈ 1.7 : 0.8.

**Script-verified** (`score_ev.py --lh 1.7 --la 0.8 --exact 4 --diff 3 --tendency 2`):

```
EV-max tip : 1:0  (EV 1.574)
  1:0  1.574  <- EV-max
  2:1  1.530
  2:0  1.477
```

**Reasoning:** top of the EV surface is **flat** — 1:0, 2:1, 2:0 all bank the
tendency (2) plus goal-difference (3) on many neighbours, within hundredths of
each other. Grid puts **1:0 narrowly first**; eyeballing the modal *result*
(2:1) lands a near-tie, not the optimum. Run the grid — don't assert the
favourite's "obvious" score.

**Known-good tip:** **1:0 home** (2:1 essentially tied; with the real de-vigged
λ either can lead — the grid decides). (Risk: low.) **Not** contrarian — under
fixed points only your own tip scores, so deviating costs EV.

---

## Fixture 2 — quote / rarity scoring

**Rule:** points = base × rarity multiplier (rarer correct tips score
more); tendency still banks a small base.

**Match (football):** same probabilities as Fixture 1.

**Reasoning:** the rarity multiplier can make a plausible-but-uncommon
exact result (e.g. 3:1, 2:2) outscore the modal 2:1 when
`payout(result) × P(result)` is higher. Compute EV per candidate including
the multiplier; take the max.

**Known-good tip:** the result with the highest `multiplier × probability`,
**not** the highest probability — typically a step rarer than 2:1
(e.g. 3:1 or 2:2 depending on the multiplier curve). (Risk: medium.)

---

## Fixture 3 — large pool, goal "win it"

**Rule:** standard fixed points. Pool N = 400. You are outside the top 20%.

**Match (football):** a near-coin-flip favourite, Home 52% / Draw 26% /
Away 22%.

**Reasoning:** N ≥ 100 and you behind → pure EV converges with the field, can't
create the gap; target is **P(finish 1st)**, not E(points). Don't guess the
variance: run `pool_winsim.py` with the pool's `N` and your `my_lead`. Shows
P(win) collapsing under EV-max-everywhere, returns the **specific flips**
(higher-variance scorelines on high-consensus matches) that raise P(win) most
per unit EV given up.

**Known-good tip:** EV-max on the safe matches; the **simulator's suggested
flips** on the 2–4 matches it names, to manufacture upside. (Risk: high —
intentional.) Verify the sim shows a P(win) gain — flips not moving it (small
N) → don't add variance you don't need.

---

## Fixture 4 — basketball, no draws

**Rule:** correct winner = 3, correct margin bucket = +2.

**Match (basketball):** market spread Home −6.5, moneyline Home 78%.
Margin modelled Gaussian, mean ≈ 6.5, sd ≈ 11.

**Reasoning:** no draw term exists; optimize winner first (Home banks 3 at
78%), then the margin bucket from the Gaussian (most mass straddles the
spread). Tip the winner plus the modal margin bucket.

**Known-good tip:** **Home win, margin ~5–9.** (Risk: low on winner.)

---

## Fixture 5 — multi-book consensus (de-vig per book, sharp-weighted)

**Rule:** any — checks the **odds base**, not the EV map.

**Market (football, 1X2):** two books.
- Book S (sharp, weight 3): 1.80 / 3.60 / 4.50 → de-vig 0.526 / 0.263 / 0.210.
- Book R (recreational, weight 1): 1.75 / 3.50 / 4.20 → de-vig 0.522 / 0.261 / 0.217.

**Reasoning:** de-vig **each book** first (raw `1/o` sums to >1; normalise),
then sharp-weighted mean per outcome and renormalise. Aggregating raw odds, or
using one book, is wrong.

**Known-good base:** **Home 0.525 / Draw 0.262 / Away 0.212.** A run that fed
the EV grid one book's raw odds has the wrong base — fix it before the tip.

---

## Fixture 6 — "team of the top scorer" (aggregate player market by team)

**Rule:** bonus question = 6 points: "which team supplies the tournament top
scorer?"

**Market (top-goalscorer outright, de-vigged player probabilities):**
- Team A: A1 14%, A2 5% → team A total **19%**.
- Team B: B1 16% → team B total **16%**.
- Team C: C1 9%, C2 4% → team C total **13%**.

**Reasoning:** the most-likely *player* (B1, 16%) is on team B, but the
question asks the **team** — sum each squad's players. Team A 19% beats team B
16%. Answer the asked question, not the adjacent one.

**Known-good answer:** **Team A.** (Source: market, aggregated by team. Risk:
medium.) **Not** team B — the modal-player trap.

---

## Fixture 7 — high-scoreline trap (the "EV-optimized" model that wasn't)

**Rule:** kicktipp 2 / 3 / 5 — tendency = 2, goal-difference = 3, exact = 5.

**Matches (script-verified, `score_ev.py … --tendency 2 --diff 3 --exact 5`):**

| Match (λ) | EV-max | a high tip's EV | verdict |
|---|---|---|---|
| Senegal–Iraq (2.0:0.7) | **1:0** (1.881) | 4:1 ≈ 1.55 | high tip leaks ~0.33 |
| Qatar–Switzerland (0.6:2.1) | **0:1** (1.981) | 1:4 ≈ 1.65 | tipping the underdog's goals = costliest move on the board |
| Spain–CapeVerde (2.3:0.6) | **2:0** (2.033) | 3:1 ≈ 1.88 | only at λ ≳ 2.3 does 2:0 edge past 1:0; never higher |

**Reasoning:** under partial points the value sits in the tendency and
goal-difference tiers, not the exact high score. **1:0 is the optimum
astonishingly often** (even for clear favourites at λ ≈ 2.0); 2:0 takes over
only near λ ≈ 2.3–2.4; above that, never. **3:2 / 4:1 / 4:2 / 1:4 are never
EV-max.** Adding goals — especially the underdog's — only shrinks the hit
probability without protecting the diff/tendency points.

**Known-good behaviour:** any 3:2 / 4:x / x:4 tip in the run → the grid wasn't
run; `score_ev.py` is the gate. (Risk: low; correctness fixture, not strategy.)

---

## Fixture 8 — draws are under-tipped

**Rule:** kicktipp 2 / 3 / 5 (as Fixture 7).

**Matches (script-verified, `score_ev.py … --tendency 2 --diff 3 --exact 5`):**

```
λ 1.0:1.0  ->  EV-max 0:0 (1.196), 1:1 tied (1.196)   # a draw IS the optimum
λ 0.9:0.9  ->  EV-max 0:0 (1.317), 1:1 second
λ 1.2:1.2  ->  EV-max 1:0 (1.150), draw third (1.091)  # 1-goal win edges it
```

**Reasoning:** people tip too few draws. A correct draw banks the
goal-difference tier (3) on *every* draw scoreline, so in a **low-scoring even
match (λ ≲ 1.0/side) the draw — usually 0:0 — is the EV-max**, tied with 1:1.
As λ rises past ~1.1 a one-goal win edges ahead, but the draw stays in the top
tips. Grid surfaces this; intuition suppresses it.

**Known-good behaviour:** a tip set with **near-zero draws across many
low-scoring even matches** is a red flag — re-run `score_ev.py`, let the grid
decide, don't default every close game to 1:0.

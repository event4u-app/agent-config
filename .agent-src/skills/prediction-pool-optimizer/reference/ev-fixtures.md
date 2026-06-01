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

**Match (football):** de-vigged market — Home 62% / Draw 24% / Away 14%.
Most plausible exact results (Poisson on market xG ≈ 1.7 : 0.8):
2:1 ≈ 9%, 1:0 ≈ 9%, 2:0 ≈ 8%, 1:1 ≈ 8%, 3:1 ≈ 6%.

**Reasoning:** the single most likely *result* (2:1) and 1:0 both bank the
tendency (2) on a home win plus goal-difference (3) on many neighbours.
Expected points of "2:1" beats "tip the favourite to win 3:0" (lower hit
rate on diff/exact) and beats any draw/away tip (tendency rarely banks).

**Known-good tip:** **2:1 home.** (Risk: low.) **Not** contrarian — under
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

**Reasoning:** with N ≥ 100 and you behind, pure EV converges with the
field and cannot create the gap you need. Add field-relative variance on a
*subset*: take a plausible underdog/draw where the consensus is heavy on
the favourite, sized by a rough Kelly fraction. On safe matches, still
tip EV-max.

**Known-good tip:** EV-max on the safe matches; **calculated underdog**
(e.g. 1:1 or away) on 2–4 high-consensus matches to manufacture upside.
(Risk: high — intentional.)

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

# EV fixtures — known-good rules + odds → tip

Sanity-check fixtures for `tippspiel-optimizer` Step "Self-check". Each
states a scoring rule, the (de-vigged) market probabilities, and the
expected-points-maximizing tip. If your method disagrees with a fixture,
your method is wrong — find the error before shipping a tip.

Illustrative, not exhaustive. Add fixtures for any pool rule shape you
encounter so future runs catch the same class of drift.

---

## Fixture 1 — standard fixed points, goal "place well"

**Rule:** exact result = 4, goal-difference = 3, tendency = 2, else 0. No
quote rule. No strategy limit. Goal: place well.

**Match (football):** de-vigged market — Home 62% / Draw 24% / Away 14%.
Most plausible exact results (Poisson on market xG ≈ 1.7 : 0.8):
2:1 ≈ 9%, 1:0 ≈ 9%, 2:0 ≈ 8%, 1:1 ≈ 8%, 3:1 ≈ 6%.

**Reasoning:** the most likely *result* (2:1) and 1:0 both bank the tendency
(2) on a home win plus goal-difference (3) on many neighbours. Expected
points of "2:1" beat "favourite to win 3:0" (lower hit rate on diff/exact)
and beat any draw/away tip (tendency rarely banks).

**Known-good tip:** **2:1 home.** (Risk: low.) **Not** contrarian — under
fixed points only your own tip scores, so deviating costs EV.

---

## Fixture 2 — quote / rarity scoring

**Rule:** points = base × rarity multiplier (rarer correct tips score more);
tendency still banks a small base.

**Match (football):** same probabilities as Fixture 1.

**Reasoning:** the rarity multiplier can make a plausible-but-uncommon exact
result (e.g. 3:1, 2:2) outscore the modal 2:1 when
`payout(result) × P(result)` is higher. Compute EV per candidate including
the multiplier; take the max.

**Known-good tip:** the result with the highest `multiplier × probability`,
**not** the highest probability — typically a step rarer than 2:1 (e.g. 3:1
or 2:2 depending on the multiplier curve). (Risk: medium.)

---

## Fixture 3 — large pool, goal "win it"

**Rule:** standard fixed points. Pool N = 400. You're outside the top 20%.

**Match (football):** a near-coin-flip favourite, Home 52% / Draw 26% /
Away 22%.

**Reasoning:** with N ≥ 100 and you behind, pure EV converges with the field
and can't create the gap you need. Add field-relative variance on a
*subset*: take a plausible underdog/draw where the consensus is heavy on the
favourite, sized by a rough Kelly fraction. On safe matches, still tip
EV-max.

**Known-good tip:** EV-max on the safe matches; **calculated underdog** (e.g.
1:1 or away) on 2–4 high-consensus matches to manufacture upside. (Risk:
high — intentional.)

---

## Fixture 4 — basketball, no draws

**Rule:** correct winner = 3, correct margin bucket = +2.

**Match (basketball):** market spread Home −6.5, moneyline Home 78%. Margin
modelled Gaussian, mean ≈ 6.5, sd ≈ 11.

**Reasoning:** no draw term exists; optimize winner first (Home banks 3 at
78%), then the margin bucket from the Gaussian (most mass straddles the
spread). Tip the winner plus the modal margin bucket.

**Known-good tip:** **Home win, margin ~5–9.** (Risk: low on winner.)

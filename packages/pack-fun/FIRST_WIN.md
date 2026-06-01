# First Win — Fun

**Time to first value:** ≈ 6 minutes from install to an expected-points-
optimized tip table for your prediction pool.

## What you'll get

For an upcoming event (football WM, basketball WM, …), a table of tips that
maximize the **expected points under your pool's actual scoring rules** —
not just "who wins" — derived from market odds, with a one-line reason and
the odds used per pick. Optionally entered into the pool's web UI via
Playwright (you log in; the agent never submits unless you say so).

## The one workflow

```text
1. /tippspiel "Football WM 2026"
2. → agent reads the pool rules first, then runs `tippspiel-optimizer`
     (rules → market odds → expected value → participant field → tip)
3. → optional AI-council pass for a sharper second opinion (default off)
4. → approval table; you say whether & where to enter
5. → agent opens the pool headful, you log in, agent fills the tips
6. → you press submit; agent saves the analysis for next time
```

## Expected output shape

```markdown
| Match | Tip | Prob / EV | Risk | Reason | Odds used |
|---|---|---|---|---|---|
| GER–SCO | 2:1 | 9% / EV-max | low | favourite, modest scoreline | 1.55 / 4.2 / 6.0 |
...
+ group standings · full bracket · bonus-question answers
```

## What this does **not** do

- Does **not** submit your tips — it fills them; you press submit (unless
  you pass `--submit`).
- Does **not** handle your login — the browser opens headful and you log in.
- Does **not** give betting or financial advice — it optimizes a game.
- Does **not** invent simulation numbers — tournament odds come from the
  market or from the executed Poisson helper.

## Next step

Re-run `/tippspiel <event> --continue` close to the deadline — the agent
rebuilds on the saved analysis with fresh lineups and odds.

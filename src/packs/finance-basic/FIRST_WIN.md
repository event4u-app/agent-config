# First Win — Finance Basic

**Time to first value:** ≈ 8 minutes from install to a runway answer with a
trust banner.

## What you'll get

A narrative answer to *"How long is our runway and what changes that?"* with
honest confidence bands, sensitivity flagged, and the human-accountant review
banner attached by default.

## The one workflow

```text
1. /work "What is our cash runway given <burn>, <cash on hand>, <growth>?"
2. → agent runs `runway-cognition` (burn shape, fundraise triggers)
3. → agent runs `scenario-modeling` (base / upside / downside)
4. → output written to agents/runtime/state/<timestamp>-runway-answer.md
```

## Expected output shape

```markdown
## Runway summary

- Base case: 14 months (assumes burn flat, growth 8% MoM).
- Downside: 9 months (burn +20%, growth flat).
- Upside: 19 months (burn -10%, growth 12% MoM).

## What moves it

| Lever              | Months gained |
| ------------------ | ------------- |
| Hiring freeze      | +2.5          |
| Trim contractors   | +1.0          |
| 10 % price lift    | +1.5          |

> Flagged for human-accountant review by default.
> Numbers are agent-modeled, not audited.
> Final call belongs to a qualified human reviewer.
```

That trust banner is non-negotiable — see
[`finance-safety-floor`](../../dist/agent-src/rules/finance-safety-floor.md).

## Screenshot

`docs/wizard/screenshots/finance-basic-first-win.png` _(captured in Phase 5
of `road-to-role-first-onboarding.md`)_.

## What this does **not** do

- Does **not** replace your accountant — output is review fuel, not filings.
- Does **not** touch your books — the agent reads numbers you paste in.
- Does **not** issue invest / raise / cut calls — only surfaces trade-offs.

## Next step

When the runway answer is locked, run `forecasting` to build the bottom-up vs
top-down reconciliation that pairs with it.

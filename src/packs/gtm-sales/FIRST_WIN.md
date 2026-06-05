# First Win — GTM Sales

**Time to first value:** ≈ 7 minutes from install to a MEDDIC scorecard
for one deal.

## What you'll get

A deal-qualification scorecard against the six MEDDIC slots, with an
inversion test (*"why would we walk away?"*) and a disqualification
recommendation when slots are thin.

## The one workflow

```text
1. /work "Qualify deal: <prospect>, <stage>, <pain>, <ask>"
2. → agent runs `deal-qualification-meddic`
3. → output written to agents/runtime/state/<timestamp>-meddic-scorecard.md
```

## Expected output shape

```markdown
## MEDDIC scorecard — <Prospect>

| Slot                       | Evidence                          | Score |
| -------------------------- | --------------------------------- | ----- |
| **M**etrics                | "Cuts 30% of refund desk time"    | 4/5   |
| **E**conomic buyer         | CFO named, not yet engaged        | 2/5   |
| **D**ecision criteria      | Documented, security-led          | 4/5   |
| **D**ecision process       | Board signoff required, Q3        | 3/5   |
| **I**dentify pain          | Top-3 cited initiative for FY     | 5/5   |
| **C**hampion               | VP Ops, weekly cadence, internal  | 4/5   |

## Inversion: why walk away?

Economic-buyer slot is the only thin one. If the CFO does not show up to
discovery call #2, the deal is not real for this quarter.

## Recommendation

- Hold: do not close-plan past stage 3 until economic buyer is engaged.
- Next move: champion to broker CFO intro by <date>.
```

## Screenshot

`docs/wizard/screenshots/gtm-sales-first-win.png` _(captured in Phase 5
of `road-to-role-first-onboarding.md`)_.

## What this does **not** do

- Does **not** auto-update your CRM — the scorecard stays on your disk.
- Does **not** write the outreach email — pair with `messaging-architecture`
  if you want copy.
- Does **not** forecast pipeline — pair with `pipeline-strategy` for that.

## Next step

Run `pipeline-strategy` to roll the per-deal scorecards into a forecast
that names exactly where the funnel leaks.

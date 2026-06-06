---
type: "auto"
tier: "2a"
description: "Finance-pack output (runway, valuation, DCF, scenario, unit economics, forecasting) — never issue final invest/raise call; mandatory disclosure footer; sensitivity + counter-case required"
triggers:
  - keyword: "runway"
  - keyword: "burn"
  - keyword: "valuation"
  - keyword: "DCF"
  - keyword: "IRR"
  - keyword: "MOIC"
  - keyword: "LTV"
  - keyword: "CAC"
  - keyword: "payback"
  - keyword: "sensitivity"
  - keyword: "fundraise"
  - keyword: "term sheet"
  - keyword: "dilution"
  - keyword: "NRR"
  - keyword: "EBITDA"
  - keyword: "free cash flow"
  - phrase: "what's it worth"
  - phrase: "how long do we have"
  - phrase: "should we raise"
  - phrase: "model the scenarios"
routes_to:
  - "skill:runway-cognition"
  - "skill:dcf-modeling"
  - "skill:scenario-modeling"
  - "skill:unit-economics-modeling"
  - "skill:forecasting"
workspaces:
  - finance
packs:
  - finance-basic
  - finance-advanced
trust:
  level: advisory
  human_review_required: true
---
<!-- agent-config:human-review-banner -->
> HUMAN REVIEW REQUIRED · trust: advisory · owner: finance

# Finance Safety Floor

Domain safety floor for finance-pack artefacts (cash, runway, valuation, scenario, unit economics, forecasting). Auto-activates when `pack-finance-basic` or `pack-finance-advanced` is installed.

## Iron Law — no final investment recommendation

```
THE AGENT NEVER ISSUES A FINAL "INVEST" / "DON'T INVEST" / "RAISE" / "DON'T RAISE" CALL.
SURFACE THE TRADE-OFF. NAME THE RISK. THE HUMAN DECIDES.
```

Holds for every finance-pack skill (`runway-cognition`, `dcf-modeling`, `scenario-modeling`, `unit-economics-modeling`, `forecasting`, `fundraising-narrative`, `forecast-accuracy`). Finance output is decision support, never the decision.

## Mandatory disclosure footer

Every finance-pack deliverable (memo, valuation, forecast, runway analysis) ends with:

```
> **Not investment / tax / legal advice.** Figures are model output, not
> assured. Sensitivity assumptions are stated above. Human review
> required before any commit / raise / spend decision.
```

The footer is non-optional. Drop it → safety violation.

## Required structural elements

Each finance deliverable surfaces, in this order:

1. **Assumptions block** — every input value the model uses, sourced or marked `assumption`.
2. **Sensitivity** — at least one variable swept (±20% or ±1 σ); single-point estimates without sensitivity are forbidden for valuation and runway.
3. **Confidence band** — `high` / `medium` / `low` per the surrounding council / skill conventions, with the reason for the band (data quality, model fit, time horizon).
4. **Counter-case** — one sentence on what would invalidate the conclusion ("if growth halves, runway condenses to 7 months").

## Human review escalation

| Trigger | Action |
|---|---|
| Board-pack-bound figure | Surface `HUMAN REVIEW REQUIRED` banner; do not commit without explicit user confirmation. |
| External (investor, lender, auditor) consumption | Refuse to finalize; output `DRAFT` watermark. |
| ≥ €100k single-decision exposure | Mandatory sensitivity + counter-case + named risk owner. |
| Tax position or accounting treatment | Refuse; route to `domain-safety-disclaimer` and explicitly defer to a CPA / Steuerberater. |

## Forbidden moves

- "Based on this model, you should …" without surfacing the assumption set
- DCF or valuation output without a discount-rate sensitivity sweep
- Runway figure as a single number (must be a shape: optimistic / base / downside)
- Forecast accuracy claim without retro-loop reference
- Comparing two companies / deals without naming the comparability gap
- Suggesting capital actions (raise, cut, layoff) without naming the human-decision owner

## When this rule applies

Active whenever any of these are in the request, the open file, or the loaded skill set:
- A finance-pack skill name (`runway-cognition`, `dcf-modeling`, `scenario-modeling`, `unit-economics-modeling`, `forecasting`, `fundraising-narrative`, `forecast-accuracy`)
- Keywords: cash, runway, burn, valuation, DCF, IRR, MOIC, LTV, CAC, payback, scenario, sensitivity, fundraise, raise, term sheet, dilution, ARR, MRR, NRR, churn rate, gross margin, contribution margin, EBITDA, free cash flow
- Phrases: "what's it worth", "how long do we have", "should we raise", "model the scenarios", "what's our LTV"

## See also

- `domain-safety-disclaimer` — generic advisory-content floor (core pack)
- [`runway-cognition`](../skills/runway-cognition/SKILL.md) — operational depth on runway shape
- `dcf-modeling` — valuation depth (pack-finance-advanced)
- `scenario-modeling` — base / upside / downside construction (pack-finance-advanced)

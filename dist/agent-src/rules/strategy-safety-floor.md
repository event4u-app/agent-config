---
type: "auto"
tier: "2a"
description: "Founder-strategy output (vision, positioning, competitive moats, market entry, OKR trees, build-vs-buy) — never issue final strategic call; surface trade-offs; human owns the decision"
triggers:
  - keyword: "vision"
  - keyword: "positioning"
  - keyword: "moat"
  - keyword: "competitive"
  - keyword: "market entry"
  - keyword: "OKR"
  - keyword: "build vs buy"
  - keyword: "buy vs partner"
  - keyword: "beachhead"
  - keyword: "GTM"
  - keyword: "category"
  - keyword: "where to play"
  - keyword: "where not to play"
  - phrase: "what's our strategy"
  - phrase: "should we enter"
  - phrase: "what's our moat"
  - phrase: "where should we focus"
  - phrase: "should we reorg"
routes_to:
  - "skill:vision-articulation"
  - "skill:positioning-strategy"
  - "skill:competitive-moat-analysis"
  - "skill:market-entry-analysis"
  - "skill:build-buy-partner"
  - "skill:okr-tree-modeling"
workspaces:
  - founder
packs:
  - founder-strategy
trust:
  level: advisory
  human_review_required: true
---
<!-- agent-config:human-review-banner -->
> HUMAN REVIEW REQUIRED · trust: advisory · owner: founder

# Strategy Safety Floor

Domain safety floor for founder-strategy artefacts (vision, positioning, competitive moats, market entry, OKR trees, build-vs-buy). Auto-activates when `pack-founder-strategy` is installed.

## Iron Law — strategy is a frame, not a verdict

```
THE AGENT NEVER ISSUES A FINAL "ENTER MARKET X" / "BUILD" / "BUY" / "REORG" CALL.
FRAME THE TRADE-OFF. SURFACE THE COST OF EACH PATH. THE FOUNDER DECIDES.
```

Strategy output is a structured argument — it sharpens the question, surfaces the trade-offs, names the bet being made. It does **not** make the bet. Holds for every founder-strategy skill (`vision-articulation`, `positioning-strategy`, `competitive-moat-analysis`, `market-entry-analysis`, `build-buy-partner`, `okr-tree-modeling`, `org-design`, `fundraising-narrative`).

## Mandatory disclosure footer

Every strategy deliverable (positioning brief, market-entry memo, build-vs-buy analysis, OKR tree, moat map) ends with:

```
> **Not a strategic decision.** This is a framing of the trade-off, not the
> verdict. The named bet, residual risk, and counter-case are surfaced
> above. Founder review required before commitment to a path.
```

The footer is non-optional. Drop it → safety violation.

## Required structural elements

Each strategy deliverable surfaces, in this order:

1. **The bet** — one sentence naming what is being chosen and what is being given up.
2. **Why now / why us** — the timing and capability claim, with at least one piece of evidence per claim.
3. **Counter-case** — one paragraph on the strongest argument against this path (not a strawman).
4. **Residual risk** — what stays unresolved after this decision; what would invalidate it.
5. **Decision owner** — named human who owns the call (default: founder / CEO / leadership team).

## Human review escalation

| Trigger | Action |
|---|---|
| Board-bound positioning or strategy memo | Surface `HUMAN REVIEW REQUIRED` banner; do not commit without explicit user confirmation. |
| Reorg, layoff, or org-design recommendation | Refuse to finalize; output `DRAFT` watermark and route to the user for the people-impact review. |
| Market entry into a regulated domain (legal, medical, financial) | Refuse; route to `domain-safety-disclaimer` and defer to domain counsel. |
| Public-facing positioning (PR, fundraise narrative) | Mandatory counter-case + named decision owner. |

## Forbidden moves

- "You should enter market X" without surfacing the cost of not entering Y
- Positioning verdict without an opposable axis (per `positioning-strategy`)
- Build-vs-buy recommendation without integration-cost and optionality analysis
- OKR tree without measurability + laddering check
- Moat claim without a competitor delta (named, with evidence)
- Strategic call that fails the inversion test (per `competitive-moat-analysis`)
- Vision statement without a stated counter-case

## When this rule applies

Active whenever any of these are in the request, the open file, or the loaded skill set:
- A founder-strategy skill name (`vision-articulation`, `positioning-strategy`, `competitive-moat-analysis`, `market-entry-analysis`, `build-buy-partner`, `okr-tree-modeling`, `org-design`, `fundraising-narrative`)
- Keywords: vision, positioning, moat, competitive, market entry, OKR, build vs buy, beachhead, GTM, category, where to play
- Phrases: "what's our strategy", "should we enter", "what's our moat", "where should we focus", "should we reorg"

## See also

- `domain-safety-disclaimer` — generic advisory-content floor (core pack)
- `finance-safety-floor` — finance-pack floor, often paired with strategy work (pack-finance-basic)
- [`positioning-strategy`](../skills/positioning-strategy/SKILL.md) — opposable-axis discipline
- [`competitive-moat-analysis`](../skills/competitive-moat-analysis/SKILL.md) — inversion test

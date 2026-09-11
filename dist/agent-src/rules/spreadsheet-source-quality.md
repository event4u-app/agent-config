---
type: "auto"
tier: "2a"
description: "Spreadsheet financial data uses official sources (IR, regulatory filings); aggregator/news/social figures need permission + cell-level unofficial mark"
triggers:
  - keyword: "financial data"
  - keyword: "financial model"
  - keyword: "stock price"
  - keyword: "revenue figures"
  - keyword: "market data"
  - phrase: "pull the numbers"
self_contained: true
workspaces:
  - finance
packs:
  - finance-basic
# obligation: line 49
obligation_frequency: "per-edit"
---

# Spreadsheet Source Quality

A financial figure is only as trustworthy as its source. A number typed into a
cell from an aggregator, a news headline, or a social post — entered as if it
were official — is a sourcing defect even when the number is right, because the
next reader cannot tell provenance from precision.

## The Iron Law

```
FINANCIAL DATA USES OFFICIAL SOURCES FIRST.
AN AGGREGATOR / NEWS / SOCIAL FIGURE IS NEVER ENTERED AS OFFICIAL —
IT NEEDS EXPLICIT USER PERMISSION AND A CELL-LEVEL "UNOFFICIAL" MARK.
EVERY SOURCED CELL CARRIES ITS SOURCE.
```

## Source priority (highest first)

1. **Company investor relations** — the company's own IR site / filings.
2. **Regulatory filings** — SEC (10-K/10-Q/8-K), or the equivalent exchange /
   regulator filing in the jurisdiction.
3. **Official reports / transcripts / earnings decks** — first-party.
4. **Exchange / regulator data** — the exchange or regulator's own feed.

Aggregators, financial-news sites, analyst blogs, and social posts are **below
the floor**: use them only with the user's explicit permission, and mark the
cell unofficial (a cell comment: `unofficial — <source>, verify`).

## When it fires

Entering, updating, or charting **financial figures** in a spreadsheet / model.

## When NOT to fire

- Non-financial data (a product's own event counts, internal ops numbers the
  user supplies) — no official-source obligation, but a source comment still helps.
- The user explicitly supplied the figures — trust the user's input; note the
  provenance they gave.

## See also

- [`spreadsheet-authoring`](../skills/spreadsheet-authoring/SKILL.md) — the spreadsheet surface floor this rule's sourcing discipline plugs into.
- [`surface-agent-contracts`](../docs/contracts/surface-agent-contracts.md) — the spreadsheet surface's invariants + truth source.
- [`finance-safety-floor`](finance-safety-floor.md) — the finance-pack advisory floor (not-investment-advice, sensitivity) this complements.

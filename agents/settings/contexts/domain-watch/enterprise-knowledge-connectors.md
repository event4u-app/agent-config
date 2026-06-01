# Domain watch — Enterprise knowledge connectors

> Watch-only note per `domain-adoption-policy`. Opened 2026-06-01 by
> `road-to-linter-debt-and-meta-subtraction` (Deferred section). **Not** a
> commitment to build — a record of the missing signals so the next harvest
> re-evaluates without relitigating.

## The deferred ask

External 5.5.0 reviews asked for enterprise knowledge connectors: Jira,
Confluence, CRM, Drive, SharePoint, and generic enterprise retrieval.

## Why deferred (not rejected)

A two-model AI council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-05-31)
showed the original "0 external users → reject" rationale is internally
contradictory: if true package-wide it disqualifies every feature equally.
The correct frame is `domain-adoption-policy`, whose three gates are **not**
met today:

- **Gate 1 — demand signal:** not citeable. The reviews are a single source;
  no ≥2 consumer projects, no named user+timeline, no reproduced incident.
- **Gate 2 — named maintenance owner:** none. Connectors track volatile
  third-party APIs (Jira/Confluence/Graph) — unowned, they rot in 1–2 cycles.
- **Gate 3 — CI-tooling decision:** none. No integration tests for these
  external services exist or are budgeted.

## Re-evaluation trigger

Re-open when **both** hold:

1. Single-user local knowledge ingestion (`road-to-employee-product-and-external-proof`
   Phase 2, shipped) has **proven value** in real use, AND
2. A demand signal becomes citeable — ≥2 consumer projects in the domain, or
   a named user ask with a target project + timeline.

Until then: do **not** schedule connector phases. A cheap demand-survey
(council divergence point — gpt-4o favoured it) is the lowest-cost next probe
if interest resurfaces.

## See also

- `road-to-linter-debt-and-meta-subtraction` § Deferred — origin of this note.
- `road-to-employee-product-and-external-proof` Phase 2 — the value-proof prerequisite.

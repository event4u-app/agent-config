# Domain watch — Knowledge integrations & heavyweight tracks

> Watch-only note per `domain-adoption-policy`. Opened 2026-06-14 by
> `road-to-6.0.0-final-readiness` Phase 6. **Not** a commitment to build — a
> single record of the deferred heavyweight tracks so the next harvest
> re-evaluates without relitigating. Governance follows demand, not the
> reverse (N=1 external fork today).

Per the parent roadmap's council: do **not** open per-connector
`domain-adoption-policy` entries or follow-up roadmaps until a track's
threshold is met. One note, three tracks, explicit thresholds.

## Track 1 — Knowledge connectors

Candidate read-only retrieval connectors:

| Connector | Status |
|---|---|
| Jira | awaiting demand signal |
| Confluence | awaiting demand signal |
| GitHub retrieval | awaiting demand signal |
| CRM | awaiting demand signal |
| Support KB | awaiting demand signal |
| Shared docs (Drive / SharePoint) | awaiting demand signal |

**Demand threshold (re-open trigger):** ≥ 3 user requests via GitHub
issues / discussions for a given connector (or a named user with a target
project + timeline). Until then, no connector phases are scheduled.

> The enterprise subset (Jira / Confluence / CRM / Drive / SharePoint) already
> carries a council rationale in
> [`enterprise-knowledge-connectors.md`](enterprise-knowledge-connectors.md)
> (`domain-adoption-policy` three-gate analysis, 2026-05-31). This note is the
> single 6.0.0 watch surface; see that note for the gate detail — do not
> relitigate it here.

## Track 2 — Cross-repo retrieval (linked-project knowledge graph)

Treat the linked-project graph (sibling repos opted into scope via
`linked_projects`) as a knowledge graph for cross-repo retrieval.

- **Status:** awaiting demand signal.
- **Demand threshold (re-open trigger):** ≥ 3 user requests for cross-repo
  knowledge retrieval, **or** ≥ 2 consumer projects running multi-repo
  workspaces where single-repo retrieval is demonstrably insufficient.
- **Why deferred:** graph construction + freshness + cross-repo permission
  scoping is heavyweight; the linked-projects scope today is impact-flagging,
  not retrieval. No pull yet.

## Track 3 — Workspace analytics (product strategy)

Aggregate workspace outcome analytics: task completion, abandonment, retries,
follow-ups, success-rate trends.

- **Status:** awaiting demand signal.
- **Demand threshold (re-open trigger):** ≥ 3 user requests for workspace
  outcome analytics, **or** a named internal owner committing to act on the
  metrics (analytics without an owner who acts is dead weight).
- **Boundary note:** the workspace already records *drive-health* telemetry
  locally (`workspace_analytics.py`) — that is in-bounds (see
  [`workspace-boundary.md`](../../../../docs/contracts/workspace-boundary.md)).
  This track is **analytics product strategy**, which the workspace does
  **NOT** own; building it is a separate, demand-gated product decision.

## What this note deliberately does NOT do

- No per-connector `domain-adoption-policy` entry.
- No follow-up roadmap for any track.
- No half-built scaffolding. Each track stays a one-line watch row until its
  threshold is citeable.

## See also

- [`enterprise-knowledge-connectors.md`](enterprise-knowledge-connectors.md) — prior council gate analysis for the enterprise connector subset.
- [`docs/contracts/workspace-boundary.md`](../../../../docs/contracts/workspace-boundary.md) — why workspace analytics *product strategy* is not workspace-owned.

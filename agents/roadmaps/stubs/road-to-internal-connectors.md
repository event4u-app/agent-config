# Road to Internal Connectors — STUB

> **Status** · stub. Not started. Created 2026-05-24 to satisfy
> Phase 9 Step 4 of
> [`road-to-employee-product-and-external-proof.md`](../road-to-employee-product-and-external-proof.md).
> See [`stubs/README.md`](README.md) for promotion criteria.

## Surface this stub tracks

OAuth-based connectors that pull data directly into the workspace
from external services: Google Workspace (Drive, Calendar, Gmail),
Microsoft 365 (OneDrive, SharePoint, Outlook), Slack, Notion, Jira,
Linear, GitHub Enterprise. Each connector requires per-provider
OAuth flow, scope review, token refresh, and the associated audit
log.

## Why this stays cancelled today

Each OAuth connector is a **permanent footprint**: token storage,
refresh flow, scope creep over time, breakage when the provider
deprecates an API version. Shipping any one connector without a
named org customer agreeing to scope review is a long-term cost
without a corresponding revenue path.

The [`small-team-recipe`](../../../docs/deploy/small-team-recipe.md)
sidesteps this entirely by treating shared mounts (NAS, SharePoint
mounted via DAV, Dropbox desktop sync) as filesystem paths. The
workspace's knowledge ingestion (Phase 2) reads from a file path,
not an API.

## Prerequisites for promotion

1. **Org customer per connector** — each connector requires its own
   recruited customer who agrees in writing to a scope review of
   the requested OAuth permissions and the data the connector will
   read.
2. **SSO must land first** — promote [`road-to-team-sso.md`](road-to-team-sso.md);
   per-connector OAuth without a team identity surface is
   nonsensical.
3. **Funded security audit per connector** — each connector's scope
   list and token-storage model is audited independently.
4. **Connector-shape ADR** — server-shipped (token broker) vs
   browser-shipped (user's browser holds the token) is decided
   before any connector lands.

## What is explicitly out of scope of this stub

- Filesystem-based knowledge ingestion. Already shipped via Phase 2
  of the main roadmap. NAS / SharePoint-via-DAV / Dropbox-desktop
  remain the supported team-knowledge path.
- Host-agent integration (Claude Code, etc.). That is
  [`host-agent-protocol`](../../../docs/contracts/host-agent-protocol.md),
  not a connector.

## Cross-references

- SSO prerequisite: [`road-to-team-sso.md`](road-to-team-sso.md).
- Knowledge ingestion (the no-OAuth path): [`docs/contracts/local-knowledge-ingestion.md`](../../../docs/contracts/local-knowledge-ingestion.md).
- Posture: [`docs/deploy/team-deployment-posture.md`](../../../docs/deploy/team-deployment-posture.md).
- Archived precursor: `agents/roadmaps/archive/road-to-internal-ai-os-deployment.md` (Phase 5).

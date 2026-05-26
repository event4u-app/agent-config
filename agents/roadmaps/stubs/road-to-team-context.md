# Road to Team Context — STUB

> **Status** · stub. Not started. Created 2026-05-24 to satisfy
> Phase 9 Step 4 of
> [`road-to-employee-product-and-external-proof.md`](../road-to-employee-product-and-external-proof.md).
> See [`stubs/README.md`](README.md) for promotion criteria.

## Surface this stub tracks

Team-shared workspace context server: shared session log across team
members, shared documents store with multi-user authoring, shared
knowledge index served from a central host instead of per-laptop
ingestion. The "Notion / Slack for AI workflows" surface.

## Why this stays cancelled today

The [`small-team-recipe`](../../../docs/deploy/small-team-recipe.md)
delivers the **input-sharing** half (prompts, role experiences,
glossaries, knowledge sources) using git + a shared file mount.
That covers 3–10 person teams.

Adding **output sharing** (shared documents, shared sessions) is a
much larger surface: it requires a server, an identity model, an
authorisation model, a conflict-resolution strategy for concurrent
edits, and an audit log. None of these are reachable without
crossing the Hard-Floor item on auth-adjacent shipping.

## Prerequisites for promotion

1. **Small-team recipe hits its ceiling** — at least one recruited
   team reports that git-shared overrides + per-laptop knowledge no
   longer scales for them, with concrete failure modes documented.
2. **SSO must land first** — promote [`road-to-team-sso.md`](road-to-team-sso.md);
   a shared context server without identity is not shippable.
3. **Funded security audit** — covers the server's tenant
   isolation, edit-conflict surface, and document-leakage threat
   model.
4. **Decision on shared-state shape** — server-shipped (HTTP) vs
   filesystem-shipped (the team manually commits documents to a git
   repo) decided in a separate ADR.

## What is explicitly out of scope of this stub

- Input sharing (prompts, roles, glossaries, knowledge) is already
  shipped via the small-team recipe. This stub does not touch that.
- The per-user single-machine workspace (Phases 4–8 of the main
  roadmap) is unaffected.

## Cross-references

- SSO prerequisite: [`road-to-team-sso.md`](road-to-team-sso.md).
- Recipe: [`docs/deploy/small-team-recipe.md`](../../../docs/deploy/small-team-recipe.md).
- Posture: [`docs/deploy/team-deployment-posture.md`](../../../docs/deploy/team-deployment-posture.md).
- Archived precursor: `agents/roadmaps/archive/road-to-internal-ai-os-deployment.md` (Phase 4).

## 2026-05 feedback citation

Feedback round 2026-05 (delivered in chat 2026-05-25 as the 9.3/10 review) re-affirmed this gap as a P0 item. The ask lands on the same three-criterion release gate: **recruited team customer + funded audit + maintainer ADR**. Until all three are met, the cancellation stands; this stub is the audit-trail entry so future review rounds do not re-derive the rationale.

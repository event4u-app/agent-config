---
complexity: lightweight
---

# Roadmap Stubs — successor placeholders

> **Status** · stubs only. Created by Phase 9 of
> [`road-to-employee-product-and-external-proof.md`](../archive/road-to-employee-product-and-external-proof.md)
> so cross-references from the deployment-posture document and the
> archived `road-to-internal-ai-os-deployment.md` resolve.

Each file in this directory is an **empty-named placeholder**. None
of them is active work. Each enumerates the prerequisites a future
maintainer (or external contributor with funding) must satisfy
before the stub can be promoted to an active roadmap.

The stubs live under `stubs/` (not `agents/roadmaps/*.md` directly)
so they do not register with `task lint-roadmap-complexity` and do
not appear on `agents/roadmaps-progress.md`. Promotion to active
status moves the file up one directory and adds the complexity
frontmatter expected by the linter.

## Current stubs

| Stub | Triggers org-mode surface | Gates |
|---|---|---|
| [`road-to-team-sso.md`](road-to-team-sso.md) | SSO / OIDC sign-on | Recruited customer + funded security audit |
| [`road-to-central-policy.md`](road-to-central-policy.md) | Central policy enforcement | SSO must land first |
| [`road-to-team-context.md`](road-to-team-context.md) | Team-shared overrides server | Small-team-recipe (git overrides) hits scale limits |
| [`road-to-internal-connectors.md`](road-to-internal-connectors.md) | OAuth connectors (Google, Slack, M365) | Org customer agrees to per-connector scope review |
| [`road-to-worktree-lifecycle.md`](road-to-worktree-lifecycle.md) | Governed `/worktree:*` command cluster | ≥3 real demand signals + overlap check vs existing skills |
| [`road-to-council-visibility.md`](road-to-council-visibility.md) | `--council` in-flow verdicts + report format | Orchestration prove-or-drop resolved + ≥2 usage asks |

## Drain-run transfers

A second, separate group with a **different origin and different gates**. These
were not created by Phase 9 of the employee-product roadmap; they are work
transferred out of an active roadmap during a drain run because it needs a live
host session, a human observation, or a capability nobody is building. The
transferring roadmap records outcome state `transferred` so its archival never
reads as "outcome achieved".

| Stub | Transferred from | Outcome state | Re-entry gates |
|---|---|---|---|
| [`road-to-host-aware-skill-projection.md`](road-to-host-aware-skill-projection.md) | `road-to-release-review-p0.md` Phase 1 + AC1, 2026-08-20 | `transferred` | P1-P3 in the stub: a same-`projection_mode` observation pair, a non-throwing scoped path in `condense.ts`, and a published projected-away-skill finding — each with a probe, all three measured failing |
| [`road-to-council-blind-ratings.md`](road-to-council-blind-ratings.md) | `road-to-council-blind-review.md` Phase 2 + Phase 3 (Ü2/Ü3 half), 2026-08-20 | `transferred` | P1-P2 in the stub: a named maintainer blind rater fills R1 and R2 in the prepared packet, timestamped before arm disclosure, each with an adopt-or-null verdict — both measured failing (10 of 10 slots unfilled). No agent and no council pass may substitute |

**The shared promotion criteria below do NOT apply to this group.** They are
org-mode gates — recruited customer, funded security audit, ADR lifting a
Hard-Floor item — and a drain-run transfer of internal work crosses no Hard
Floor and introduces no org surface. Each stub in this group carries its own
gates and says so.

## Promotion criteria (shared)

Applies to the six org-mode stubs in **Current stubs** above, not to the
drain-run transfers. Any of those stubs may move from `stubs/` to
`agents/roadmaps/` only when **all three** of these are true:

1. A real first customer has been recruited and is named in
   `agents/recruit-sessions/<role>/`. No speculative promotion.
2. A funded, human-reviewed security audit covers the surface the
   stub introduces.
3. A current maintainer signs off on lifting the Hard-Floor item
   the stub crosses, in a written ADR.

Until then, the answer to "team X when?" is the cancelled-with-reason
matrix in [`docs/deploy/team-deployment-posture.md`](../../../docs/deploy/team-deployment-posture.md).

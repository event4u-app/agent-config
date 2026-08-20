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

A second, structurally different class of stub also lives here. The autonomous
drain run of 2026-08-20 resolved every open blocker in this estate; where the
AI council returned disposition **B — transferred**, the work moved into a stub
rather than being recorded as decided-and-done. The council's categorical rule:
a repository-administration setting is externally visible and irreversible, so
it may only be transferred.

| Stub | Transfers | Producer gate |
|---|---|---|
| [`road-to-main-protection-ruleset-changes.md`](road-to-main-protection-ruleset-changes.md) | `required-check-set-change` + `merge-queue-enablement`, out of `road-to-inbox-harvest-2026-08-b-ci-economy.md` Phase 4 | repo-admin write on ruleset `17749383` |

**The shared promotion criteria below do NOT govern a drain-run transfer.** A
recruited first customer and a funded security audit gate the org-mode surface
stubs, which introduce new product capability for an external tenant. A
drain-run transfer introduces no capability — it is already-decided work whose
only missing input is a human authority the tree cannot supply. Requiring a
customer and an audit before a maintainer may edit their own repository
settings would be a gate on nothing, and would make the stub unclosable.

Each drain-run transfer instead carries the council's three-point integrity
check: the original `Resolved when` criterion verbatim, the complete list of
dependent steps moved, and a named re-entry producer with a detection probe
measured at transfer time.

## Promotion criteria (shared)

Any stub may move from `stubs/` to `agents/roadmaps/` only when **all
three** of these are true:

1. A real first customer has been recruited and is named in
   `agents/recruit-sessions/<role>/`. No speculative promotion.
2. A funded, human-reviewed security audit covers the surface the
   stub introduces.
3. A current maintainer signs off on lifting the Hard-Floor item
   the stub crosses, in a written ADR.

Until then, the answer to "team X when?" is the cancelled-with-reason
matrix in [`docs/deploy/team-deployment-posture.md`](../../../docs/deploy/team-deployment-posture.md).

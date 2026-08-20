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

A **drain-run transfer** is a different kind of stub, and it is registered
separately because the shared criteria below would misgovern it.

The stubs in the table above are **demand-gated**: the work is buildable today
and the open question is whether it *should* be built. A drain-run transfer is
**capability-gated**: the scope decision is already made, the work is wanted, and
the only thing missing is an environment the run did not have. Applying a
recruited customer or a funded security audit to that is a category error — there
is no customer to recruit for a tool surface that simply is not connected, and no
audit clears a missing capability.

```
THE SHARED PROMOTION CRITERIA BELOW — RECRUITED CUSTOMER, FUNDED SECURITY
AUDIT, ADR SIGN-OFF — DO **NOT** GOVERN A DRAIN-RUN TRANSFER.
A TRANSFER IS PROMOTED BY ITS OWN NAMED PROBE RETURNING TRUE. NOTHING ELSE.
```

Each transfer carries, per the drain-run stub-integrity check: the parent
criterion **verbatim**, the complete list of what moved, a **named** producer and
probe with the reading measured on the day of transfer, and any reasoning that
would otherwise die with the parent. The parent records `transferred` as its
outcome state so that "archived" can never read as "achieved".

| Stub | Transferred from | Gate (its own probe) |
|---|---|---|
| [`road-to-multi-host-screenshot-census.md`](road-to-multi-host-screenshot-census.md) | [`road-to-source-first-frontend`](../road-to-source-first-frontend.md) — Phase 1 Step 2, the screenshot dimension of Phase 6 Step 1, and the W5 URL / live-page handover class | A **page-reaching** capture primitive on a second supported host. Measured 2026-08-20: this host has `screencapture` only, which photographs the display. Display-only capture on a second host changes nothing. |

Framework of record for drain-run dispositions:
`agents/evidence/council/drain-blocker-dispositions-a.md` <!-- ref-ignore -->
(on `origin/drain/council-records`, PR #1463; not yet on `main`, hence the
ignore marker).

## Promotion criteria (shared)

Governs the **demand-gated** stubs in `## Current stubs` only — never a
drain-run transfer (above). Any such stub may move from `stubs/` to
`agents/roadmaps/` only when **all three** of these are true:

1. A real first customer has been recruited and is named in
   `agents/recruit-sessions/<role>/`. No speculative promotion.
2. A funded, human-reviewed security audit covers the surface the
   stub introduces.
3. A current maintainer signs off on lifting the Hard-Floor item
   the stub crosses, in a written ADR.

Until then, the answer to "team X when?" is the cancelled-with-reason
matrix in [`docs/deploy/team-deployment-posture.md`](../../../docs/deploy/team-deployment-posture.md).

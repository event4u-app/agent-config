---
complexity: lightweight
---

# Roadmap Stubs — successor placeholders

> **Status** · stubs only. Created by Phase 9 of
> [`road-to-employee-product-and-external-proof.md`](../archive/road-to-employee-product-and-external-proof.md)
> so cross-references from the deployment-posture document and the
> archived `road-to-internal-ai-os-deployment.md` resolve.

This directory holds two classes of file, and **none of them is
active work**. The **org-mode stubs** in § Current stubs are
*empty-named placeholders*: each enumerates the prerequisites a
future maintainer (or external contributor with funding) must
satisfy before the stub can be promoted to an active roadmap. The
**drain-run transfers** in § Drain-run transfers are the opposite
shape — already-specified work moved out of an active roadmap
because it needs an external act — and they are gated by their own
per-item probes, not by the shared criteria below.

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

A second, structurally different class of stub. These are **not** speculative
future surfaces — they are work that was already planned and specified in an
active roadmap, then transferred out when an autonomous drain run reached it and
found it needed something no repository automation can supply: a repo secret, a
repo-admin write, a legal signature, or another human. The parent roadmap closes
against an explicit outcome state (`transferred`), so a completed roadmap can
never be read as an achieved goal.

Each entry carries the framework's three-point stub-integrity check — the
original criterion **verbatim**, the complete list of dependent steps moved, and
a **named producer with a detection probe** (never "when some subsystem exists",
which names nobody) — plus the probe's measured baseline on the transfer date, so
a later reader can tell real movement from noise.

| Stub | Transferred from | Items | Re-entry probes (baseline at transfer) |
|---|---|---|---|
| [`road-to-bus-factor-external-actions.md`](road-to-bus-factor-external-actions.md) | [`road-to-maintainer-bus-factor.md`](../road-to-maintainer-bus-factor.md) (2026-08-20, disposition B) | 4 — proof-page claim · branch protection · runbook cold dry-run · second-reviewer invitation | `ANTHROPIC_API_KEY` present + a non-skipped `live-advisory` run (absent; 0 live runs) · ruleset 17749383 requires code-owner review, ≥1 approval, >1 check (`false` / `0` / `1`) · a dated cold-dry-run record (none) · distinct trailing-90-day reviewers > 1 (1) |

**The shared promotion criteria below do NOT govern a drain-run transfer.** They
were written for the org-mode stubs and require a recruited customer, a funded
security audit, and an ADR lifting a Hard-Floor item. A drain-run transfer
introduces no new product surface and no new attack surface — it is existing,
already-agreed work waiting on one external act — so demanding a funded audit
before, say, adding a repo secret or asking a second person to review would be a
category error that parks the work permanently. **A drain-run transfer is gated
only by its own per-item probe.** Promote per item, not per file, and delete the
stub when its last item is gone.

## Promotion criteria (shared)

Applies to the **org-mode stubs** in § Current stubs only — not to
drain-run transfers, which name their own per-item probes. Such a stub
may move from `stubs/` to `agents/roadmaps/` only when **all three** of
these are true:

1. A real first customer has been recruited and is named in
   `agents/recruit-sessions/<role>/`. No speculative promotion.
2. A funded, human-reviewed security audit covers the surface the
   stub introduces.
3. A current maintainer signs off on lifting the Hard-Floor item
   the stub crosses, in a written ADR.

Until then, the answer to "team X when?" is the cancelled-with-reason
matrix in [`docs/deploy/team-deployment-posture.md`](../../../docs/deploy/team-deployment-posture.md).

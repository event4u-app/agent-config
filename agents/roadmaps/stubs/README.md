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

A second, structurally different class of stub, with a different origin and
different gates. These are **not** speculative future surfaces and they were not
created by Phase 9 of the employee-product roadmap — they are work that was
already planned and specified in an active roadmap, then transferred out when an
autonomous drain run reached it and found it needed something no repository
automation can supply: a live host session, a repo secret, a repo-admin write, a
legal signature, another human, or a capability nobody is building. The parent
roadmap closes against an explicit outcome state (`transferred`), so a completed
roadmap can never be read as an achieved goal.

Each entry carries the framework's three-point stub-integrity check — the
original criterion **verbatim**, the complete list of dependent steps moved, and
a **named producer with a detection probe** (never "when some subsystem exists",
which names nobody) — plus the probe's measured baseline on the transfer date, so
a later reader can tell real movement from noise.

| Stub | Transferred from | Outcome state | Re-entry gates (baseline at transfer) |
|---|---|---|---|
| [`road-to-host-aware-skill-projection.md`](road-to-host-aware-skill-projection.md) | `road-to-release-review-p0.md` Phase 1 + AC1, 2026-08-20 | `transferred` | P1-P3 in the stub: a same-`projection_mode` observation pair, a non-throwing scoped path in `condense.ts`, and a published projected-away-skill finding — each with a probe, all three measured failing |
| [`road-to-bus-factor-external-actions.md`](road-to-bus-factor-external-actions.md) | [`road-to-maintainer-bus-factor.md`](../road-to-maintainer-bus-factor.md) Phase 1-4, 2026-08-20 | `transferred` | 4 items: `ANTHROPIC_API_KEY` present **and** a non-skipped `live-advisory` run (absent; 0 live runs) · ruleset 17749383 requires code-owner review, ≥ 1 approval, > 1 check (`false` / `0` / `1`) · a dated cold-dry-run record (none) · distinct trailing-90-day reviewers > 1 (1) |
| [`road-to-scale-history-primary-rating.md`](road-to-scale-history-primary-rating.md) | [`road-to-scale-history-bench-run.md`](../road-to-scale-history-bench-run.md) Phase 1, 2026-08-20 | `transferred` | 3 items: 96 non-errored cells in `artifacts/manifest.json` (root absent — no live sweep) · a **named** rater in the stub's `Rater:` line (`(unassigned)`) · every rubric score timestamped before its `score.ts` output (0 rated rows, 0 outputs — vacuous). P1/P3 are bench-machine checks, not tree checks: the artifact root is gitignored |

**The shared promotion criteria below do NOT govern a drain-run transfer.** They
were written for the org-mode stubs and require a recruited customer, a funded
security audit, and an ADR lifting a Hard-Floor item. A drain-run transfer
introduces no new product surface — it is existing, already-agreed work waiting
on one external act — so demanding a funded audit before adding a repo secret or
asking a second person to review would be a category error that parks the work
permanently. **A drain-run transfer is gated only by its own per-item probe.**
Promote per item, not per file, and delete the stub when its last item is gone.

One qualification, because the shorter version of that sentence is false: a
transfer crossing no *new* surface is not the same as a transfer crossing no Hard
Floor. Some of these pending acts — a repo-admin ruleset write, a branch
protection change — **are** Hard-Floor actions in their own right. Being exempt
from the org-mode promotion gates does not exempt the act itself: when a human
performs it, it needs its own this-turn approval under
`non-destructive-by-default`, exactly as it would have inside the parent roadmap.

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

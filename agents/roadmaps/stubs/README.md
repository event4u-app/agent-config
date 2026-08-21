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

The distinction that decides which gates apply: the stubs in **§ Current stubs**
are **demand-gated** — the work is buildable today and the open question is
whether it *should* be built. A drain-run transfer is **capability-gated** — the
scope decision is already made, the work is wanted, and the only thing missing is
an environment the run did not have.

Each entry carries the framework's three-point stub-integrity check — the
original criterion **verbatim**, the complete list of dependent steps moved, and
a **named producer with a detection probe** (never "when some subsystem exists",
which names nobody) — plus the probe's measured baseline on the transfer date, so
a later reader can tell real movement from noise, and any reasoning that would
otherwise die with the parent.

| Stub | Transferred from | Outcome state | Re-entry gate (its own probe, baseline at transfer) |
|---|---|---|---|
| [`road-to-host-aware-skill-projection.md`](road-to-host-aware-skill-projection.md) | `road-to-release-review-p0.md` Phase 1 + AC1, 2026-08-20 | `transferred` | P1-P3 in the stub: a same-`projection_mode` observation pair, a non-throwing scoped path in `condense.ts`, and a published projected-away-skill finding — each with a probe, all three measured failing |
| [`road-to-bus-factor-external-actions.md`](road-to-bus-factor-external-actions.md) | [`road-to-maintainer-bus-factor.md`](../road-to-maintainer-bus-factor.md) Phase 1-4, 2026-08-20 | `transferred` | 4 items: `ANTHROPIC_API_KEY` present **and** a non-skipped `live-advisory` run (absent; 0 live runs) · ruleset 17749383 requires code-owner review, ≥ 1 approval, > 1 check (`false` / `0` / `1`) · a dated cold-dry-run record (none) · distinct trailing-90-day reviewers > 1 (1) |
| [`road-to-main-protection-ruleset-changes.md`](road-to-main-protection-ruleset-changes.md) | `road-to-inbox-harvest-2026-08-b-ci-economy.md` Phase 4, blockers `required-check-set-change` + `merge-queue-enablement`, 2026-08-20 | `transferred` | One gate, in the stub: a repo-admin write on ruleset `17749383` by the named producer. Two probes, both measured at transfer time: required checks **1**, `merge_queue` entries **0**, `merge_group` files **0** |
| [`road-to-multi-host-screenshot-census.md`](road-to-multi-host-screenshot-census.md) | [`road-to-source-first-frontend`](../road-to-source-first-frontend.md) — Phase 1 Step 2, the screenshot dimension of Phase 6 Step 1, and the W5 URL / live-page handover class | `transferred` | A **page-reaching** capture primitive on a second supported host. Measured 2026-08-20: this host has `screencapture` only, which photographs the display. Display-only capture on a second host changes nothing. |
| [`road-to-gate-preauth-authorization.md`](road-to-gate-preauth-authorization.md) | [`road-to-gate-autonomy.md`](../road-to-gate-autonomy.md) step 2.3, 2026-08-20 | `transferred` | 1 item, both probe halves required: an authorisation artefact `lint_settings_classes` reports as class **C** and naming a blocker id (none of today's 107 C keys is one) · the abort intact, `grep -c 'Refusing to run under automation' src/scripts/skill_trigger_eval.ts` still `1` (`1`) |
| [`road-to-org-telemetry-sink.md`](road-to-org-telemetry-sink.md) | [`road-to-org-telemetry.md`](../road-to-org-telemetry.md) Phase 2 (`sink-choice`), 2026-08-20 | `transferred` | 1 item: a private, package-CI-inaccessible repository identifier resolves **and** appears in org-pack settings (measured FAIL on every clause — no identifier exists in the tree, `read_remote_settings` reports `missing: endpoint, org_id, salt`). Producer: the org repository administrator. **The pending act is itself Hard-Floor** — repository creation and pointing an endpoint at it; monitoring owner + rollback recorded in the stub |
| [`road-to-org-telemetry-enablement.md`](road-to-org-telemetry-enablement.md) | [`road-to-org-telemetry.md`](../road-to-org-telemetry.md) Phase 3 (`dpo-signoff`), 2026-08-20 | `transferred` | 1 item: a written internal data-protection outcome covering the Class-A field list **and** the disclosure line is linked from ADR-233 (measured FAIL — ADR-233 exists and is indexed, `grep -c "sign-off"` returns 0). Producer: the named internal data-protection reviewer. Its four measurement items are gated by the sink stub as well; both must clear |
| [`road-to-solution-minimalism-full-tier-run.md`](road-to-solution-minimalism-full-tier-run.md) | [`road-to-solution-minimalism.md`](../road-to-solution-minimalism.md) Phase 3 + the full-tier AC, 2026-08-20 | `transferred` | 3 items, all gated on one paid sweep: ≥ 30 corpus tasks declaring `repo` + `sha` (**1**) · a `Gate verdict:` in `docs/benchmark.md` from a pinned report with a non-empty `sha` (**none**; 0 full-tier runs ever) · that verdict carrying all four pre-registered endpoints (all four implemented, 0 reports rendered). Blocked by an absent credential and by a Hard Floor that a 2026-08-14 pre-authorisation does not clear |
| [`road-to-subagent-payload-capture.md`](road-to-subagent-payload-capture.md) | [`road-to-subagent-lifecycle-integrity.md`](../road-to-subagent-lifecycle-integrity.md) Phase 0 Steps 2+4 raw-payload halves (Phase 4 Step 1 blocked by, not moved), 2026-08-20 | `transferred` | P1-P4 in the stub: a captured `SubagentStop` payload, a captured in-subagent `PreToolUse` payload, their field lists recorded, and the `AGENT_HOOK_CAPTURE_DIR` setting absent again afterwards (P1/P2 directory does not exist · P3 absent · P4 correctly no match today). Producer: the host owner, one time-boxed fresh session, under the 7 containment requirements in the stub — the capture writes payloads verbatim and "remove it afterwards" is not a kill switch |
| [`road-to-estate-triage-remaining-batches.md`](road-to-estate-triage-remaining-batches.md) | [`road-to-estate-drawdown.md`](../archive/road-to-estate-drawdown.md) steps 2.1 + 2.2 + AC-2, 2026-08-21 | `transferred` | 1 probe: files in the active tree and `later/` with no `- file:` / `moved_to:` row in `agents/decisions/estate-triage-dispositions.yml` reaches **0** (measured **71** at transfer — 24 active, 47 `later/`). Producer: the repository maintainer, **independently of the abandoned Phase-4 pass** (a binding condition of the council's confirmation). AC-2's ceiling clause is separately unsatisfiable — T1's `target` is read by nothing — so the probe can reach 0 with that clause still open. Batches carry a snapshot commit and skip PR-held files with a recorded reason |
| [`road-to-draft-status-ratchet-boundary.md`](road-to-draft-status-ratchet-boundary.md) | [`road-to-estate-drawdown.md`](../archive/road-to-estate-drawdown.md) target T2 (anti-regrowth), 2026-08-21 | `transferred` | 2 clauses, either branch resolves: the raw active-file count and the gate's `active_roadmaps` **agree** (measured **27 vs 24** at transfer — three `status: draft` files opt themselves out at `update_roadmap_progress.ts:91,284,747,815`), **or** `estate-count-budget.json` records a written decision naming `draft` (0 matches). Producer: the repository maintainer, who owns the estate metric. Not fixed in the parent because changing a shipped gate's counting semantics plus its committed baseline may fall under Rule 3; the observe-only rollout, baseline migration and rollback criteria are inside the transferred scope |

```
THE SHARED PROMOTION CRITERIA IN THE NEXT SECTION — RECRUITED CUSTOMER, FUNDED
SECURITY AUDIT, ADR SIGN-OFF — DO **NOT** GOVERN A DRAIN-RUN TRANSFER.
A TRANSFER IS PROMOTED BY ITS OWN NAMED PROBE RETURNING TRUE. NOTHING ELSE.
```
Applying a recruited customer or a funded security audit to a capability-gated
transfer is a category error: there is no customer to recruit for a tool surface
that simply is not connected, and no audit clears a missing capability. Promote
**per item**, not per file, and delete a stub when its last item is gone.

Two qualifications, because the short version of that paragraph is false in two
different directions.

**A transfer crossing no *new* surface is not a transfer crossing no Hard Floor.**
Some pending acts here — a repo-admin ruleset write, a branch-protection change —
**are** Hard-Floor actions in their own right, and the third row is exactly that
case: a repository-administration setting is a `non-destructive-by-default`
trigger, which is precisely why the council could only transfer it. Being exempt
from the org-mode promotion gates does not exempt the act. When a human performs
it, it needs its own this-turn approval naming the exact object, exactly as it
would have inside the parent roadmap.

**A gate is not always a measurement.** For that same row the gate is the
*authority* itself, exercised by a named human — not a number anyone can read.
Requiring a recruited customer and a funded audit before a maintainer may edit
their own repository settings would gate on nothing and make the stub unclosable.

Framework of record for drain-run dispositions:
[`drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md)
and its batch-B sibling.

## Promotion criteria (shared)

Governs the **demand-gated** stubs in § Current stubs only — never a drain-run
transfer, which names its own probe above. Any such stub may move from `stubs/`
to `agents/roadmaps/` only when **all three** of these are true:

1. A real first customer has been recruited and is named in
   `agents/recruit-sessions/<role>/`. No speculative promotion.
2. A funded, human-reviewed security audit covers the surface the
   stub introduces.
3. A current maintainer signs off on lifting the Hard-Floor item
   the stub crosses, in a written ADR.

Until then, the answer to "team X when?" is the cancelled-with-reason
matrix in [`docs/deploy/team-deployment-posture.md`](../../../docs/deploy/team-deployment-posture.md).

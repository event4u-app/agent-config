---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-a-trunk-whose-own-gates-are-green
entry_condition:
  what: the owner resolves blocker(s) legal-user-type-is-a-product-call
  when: whenever the owner takes the next step
  who: owner
review_by: 2026-12-31
estate_growth_exempt: >-
  Owner-chosen archive of road-to-a-trunk-whose-own-gates-are-green: its deferred steps wait on owner
  blocker(s) legal-user-type-is-a-product-call and are parked here instead of left active. The parent
  is archived in the same change, so the active count drops by one.
---
# Road to a trunk whose own gates are green — carried

> **Source:** carried by the archival sweep on 2026-10-02 from
> [`road-to-a-trunk-whose-own-gates-are-green`](../archive/road-to-a-trunk-whose-own-gates-are-green.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.

> **Arrivals:** 2 counted — latest `inbox-2026-10-as` (2026-10-25): six gates
> still red when run singly at `01bb841cbd`, and no workflow runs `task ci`.
> Steps 2.2–2.4 below do not wait on the legal blocker; any session with a
> free slot can run them. Earlier: `inbox-2026-10-m` (2026-10-12): a 16.4.0
> rescore reads `task ci` as red at a second consecutive cut, naming
> `audit_user_type_axis` among the causes. Earlier rounds were not counted for
> this file.

## Goal

Every step road-to-a-trunk-whose-own-gates-are-green deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Phase 1 — Deferred steps carried from road-to-a-trunk-whose-own-gates-are-green

- [ ] <!-- blocked-by: legal-user-type-is-a-product-call | asked: no — non-interactive inbox run; the question is carried in the round disposition Owner decisions block --> **2.1 Apply the owner's choice.** Either author `user-types/legal.yml`
      (tagline, recommended packs, install-path hint) or remove `legal` from the
      five legal-review-prep skills' `recommended_for_user_types`, then lower or
      delete the baseline entry in the same change.
      verify: `./scripts-run src/scripts/audit_user_type_axis` -> 0

- [ ] **2.2 Clear the red gates by class.** At `01bb841cbd` these exit 1 when
      run singly: `check_gate_completeness`, `check_rule_invariants` (the
      kernel literal — owner, see `stubs/road-to-kernel-clause-1-restore`),
      `check_trigger_evals`, `lint_rule_enforcement_declaration`,
      `lint_eval_freshness`, `lint_provenance_vocabulary`. Fix the five an agent
      may fix; the kernel literal stays with its stub.
      verify: each gate run singly with `./scripts-run src/scripts/<gate>`, five green.
- [ ] **2.3 A scheduled `task ci` on main.** No workflow runs it today
      (`.github/workflows/consistency.yml` says so). A weekly run that writes
      exactly one classified entry when red.
      verify: the workflow file exists and its dry run lists the gates it runs.
- [ ] **2.4 Root instructions match the PR workflow.** `CLAUDE.md` says "green
      before PR" for a pipeline that is red on main and runs in no workflow.
      verify: CLAUDE.md names the pipeline CI actually runs, checked against `.github/workflows/`.

## Blockers

### blocker: legal-user-type-is-a-product-call
- **Status:** open
- **Owner:** owner
- **Blocks:** 2.1
- **What to do:** pick exactly one — (a) author `user-types/legal.yml` so the
  five legal-review-prep skills' recommendation resolves, or (b) drop `legal`
  from those five skills' `recommended_for_user_types`.
- **Resolved when:** `./scripts-run src/scripts/audit_user_type_axis` exits 0.
- **Recommendation:** (b) — the legal pack is consent-gated and attorney-review
  only, so a user type that recommends it to a whole persona invites the
  reading the pack's own floor forbids.
- **If you do nothing:** the audit stays red on `main` and its 56-day limit
  keeps every reading of the trunk red.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-02 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-a-trunk-whose-own-gates-are-green |

## Acceptance Criteria

- [ ] AC-2 — <!-- blocked-by: legal-user-type-is-a-product-call | asked: no — non-interactive inbox run; the question is carried in the round disposition Owner decisions block --> `audit_user_type_axis` exits 0.

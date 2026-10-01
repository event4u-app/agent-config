---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Three local gates are red on the merged 16.2.0 head and no active roadmap owns two of them: 42 new cross-pack links over a ratchet that only turns one way, and a 60-day-old baseline the audit itself calls a product call. Merging this into road-to-trigger-eval-freshness-has-no-writer was rejected because that draft owns only the third gate, and archiving or parking any active roadmap would not make a red gate green."
relates:
  - slug: road-to-trigger-eval-freshness-has-no-writer
    relation: disjoint
    note: That draft owns the 39 stale trigger corpora that redden check_trigger_evals. This roadmap owns the other two red gates and does not touch trigger freshness.
---
# Road to a trunk whose own gates are green

> **Source:** `agents/tmp.old/inbox-2026-10-a/` — a supplied scorecard rescore
> of the 16.2.0 release whose gate-reachability row names three gates red on the
> trunk and one security lint that runs only locally. Verified against `main` at
> `9bc8cd4f2` on 2026-10-01; disposition at
> `agents/evidence/analysis/inbox-2026-10-a-disposition.md`.

## Goal

The two red gates this roadmap owns pass on `main`, and the workflow-security
lint runs where a pull request can fail on it. Done means:
`lint_pack_boundaries` is at or under its baseline, `audit_user_type_axis` has no
orphan value or an owner-recorded reason to keep it, and `lint_workflow_security`
runs in a workflow.

## Context

Reproduced on 2026-10-01, all three read-only except where noted:

- `./scripts-run src/scripts/lint_pack_boundaries` → "379 violation(s) against a
  baseline of 337 — 42 new", exit 1.
- `./scripts-run src/scripts/audit_user_type_axis` → "baseline of 1 has not moved
  in 60 days (limit 56)", exit 1. The single orphan is `legal`, recorded at
  `src/config/gate-violation-baselines.json:10-13` as a product call. (The run
  rewrites `agents/reports/user-type-axis-audit.md`; that write was restored.)
- `./scripts-run src/scripts/check_trigger_evals` → 39 corpora older than 90 days,
  exit 1 — owned by `road-to-trigger-eval-freshness-has-no-writer`.
- `lint_workflow_security` is named in no file under `.github/workflows/`.

## Phase 1 — The 42 new cross-pack links

- [ ] **1.1 List the 42 against the baseline.** Diff the current violation set
      against the set at the commit that landed the 337 baseline, and write each
      new link with its source pack, target pack and introducing commit to
      `agents/evidence/analysis/pack-boundary-delta-<date>.md`.
      verify: `grep -c '^| ' agents/evidence/analysis/pack-boundary-delta-*.md` -> /^[1-9]/
- [ ] **1.2 Fix each link at its source.** Per link: add the edge to the source
      pack's `requires` when the target is genuinely needed, retarget the link,
      or move the artefact — the three fixes the baseline note names. Raising the
      baseline is not one of them.
      verify: `./scripts-run src/scripts/lint_pack_boundaries` -> 0

## Phase 2 — The orphan user-type value

- [~] <!-- blocked-by: legal-user-type-is-a-product-call | asked: no — non-interactive inbox run; the question is carried in the round disposition Owner decisions block --> **2.1 Apply the owner's choice.** Either author `user-types/legal.yml`
      (tagline, recommended packs, install-path hint) or remove `legal` from the
      five legal-review-prep skills' `recommended_for_user_types`, then lower or
      delete the baseline entry in the same change.
      verify: `./scripts-run src/scripts/audit_user_type_axis` -> 0

## Phase 3 — The security lint runs where a PR sees it

- [ ] **3.1 Wire `lint_workflow_security` into the consistency workflow.**
      Confirm from its source that it writes nothing, run it once locally to
      read its current verdict, fix any finding it raises in the same change,
      and add it as a step with a gate-coverage row.
      verify: `grep -c 'lint_workflow_security' .github/workflows/consistency.yml` -> /^[1-9]/

## Gap table

| Source item | Verdict | Where |
|---|---|---|
| `lint_pack_boundaries` +42 new | KEEP | Phase 1 |
| `audit_user_type_axis` 60 d over 56 | owner decision | Phase 2 |
| `check_trigger_evals` 39 stale | already tracked | relates |
| `lint_workflow_security` local only | KEEP | Phase 3 |
| No workflow runs the full local pipeline | CUT — CI runs named jobs by design; each red gate is fixed or wired on its own | disposition |

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
<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A `requires` edge is added to make the lint pass | product | Adding an edge makes the source pack install the target for every consumer; done to silence a link, it widens what consumers receive. | 1.2 records the chosen fix per link, and an added edge needs the target to be used by the source's content, not only linked. | Phase 1 — The 42 new cross-pack links |
| 2 | The security lint reds the workflow on arrival | implementation | A lint never run in CI may hold findings that block every pull request the day it is wired. | 3.1 reads its verdict locally first and fixes findings in the same change. | Phase 3 — The security lint runs where a PR sees it |

## Acceptance Criteria

- [ ] AC-1 — `lint_pack_boundaries` exits 0 on `main` without a baseline raise.
- [~] AC-2 — <!-- blocked-by: legal-user-type-is-a-product-call | asked: no — non-interactive inbox run; the question is carried in the round disposition Owner decisions block --> `audit_user_type_axis` exits 0.
- [ ] AC-3 — `lint_workflow_security` runs in a pull-request workflow.

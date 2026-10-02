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

---
complexity: lightweight
status: parked
owner: maintainer
review_by: 2027-01-31
estate_offset_exempt: "Parked under later/, excluded from the dashboard and /roadmap:process-*; adds no active roadmap. Owner search: grep -rlE 'Rejected when|instruction-only.*block' over agents/roadmaps (whole tree) — no owner."
relates:
  - slug: road-to-checks-that-name-their-catch
    relation: extends
    note: "Its decision E8 parked this phase here: several instruction-only rules are kernel rules, and kernel edits ship in their own PR with a soak."
---

# Road to rules that say when they reject

> **Source:** `agents/tmp.old/inbox-2026-11-h/` (Phase 7 of the source plan).

## Goal

A rule declared `enforced_by: instruction-only` carries a short **Rejected
when** block — observable conditions a reviewer can cite as `<rule>#R<n>` —
so a review finding against it names a condition instead of paraphrasing prose.

## Un-park condition

A review lens or reviewer is observed paraphrasing an instruction-only rule
where a citable condition would have settled the finding, **and** a kernel-rule
PR slot with its soak window is free.

## Steps (when un-parked)

- [ ] **1** The instruction-only rules gain a Rejected-when block (kernel rules in their own PR).
- [ ] **2** A lint: `instruction-only` ⇒ the block is present.
- [ ] **3** Review lenses cite `<rule>#R<n>`.
      verify: the lint refuses an instruction-only rule without the block.

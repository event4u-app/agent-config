---
reason: the change is to the ratification mechanism itself (anchor, record writer, gate) and carries no passing record; the owner merged PR #2691 under the standing pull-request bypass
subject: 7271d899141ff8f91f8105eb3eee417d20ca4a749c415bfb38d7161a8e085da9
time: 2026-10-25T21:36:47+01:00
commit: c314ca3a03803665797d6a32c2084a1cea1b72eb
ruleset_version_before: 54668684
ruleset_version_after: 54668684
restore_by: 2026-11-01T21:36:47+01:00
restored_at: superseded-by-owner-ruling agents/evidence/owner-directives/2026-10-25-standing-pull-request-bypass.md
council_review: agents/evidence/council/bypass-2691-review-20261109.md
---
<!-- evidence-type: bypass-record -->

# Bypass — PR #2691, the four council-review fixes

Under the standing actor kept by `2026-10-25-standing-pull-request-bypass.md`
(ruleset `54668684`, unchanged). The required check "Sync + Generate Tools
Consistency" was red on `check_kernel_edit_ratified` alone.

- **Who acted:** the repository owner, with `gh pr merge 2691 --merge --admin`.
- **Subject:** `ratification_subject --files <diff of c314ca3a03^1..c314ca3a03> --rev c314ca3a03 --base-ref c314ca3a03^1`.
- **What the merge changed:** the four findings of the earlier after-the-fact
  reviews: `check_kernel_edit_ratified` passes `root` to
  `consequenceRuleSlugsOfCheckout` and reports a `refused` / `non-convergent`
  header verdict as its own trigger; `ratification_record_writer` reads the
  prompt's `subject:` strictly; `platform_anchor` / `check_platform_anchor`
  accept a ruling only with a committed `standing-bypass: ruleset_version` marker,
  which the same merge added to `2026-10-25-standing-pull-request-bypass.md`.
- **Council review:** `bypass-2691-review-20261109.md`, one round on 2026-11-09,
  a day past the due date 2026-11-08T21:36:47+01:00. Both seats REQUEST_CHANGES on
  the record, none on the payload; two test gaps it names stay open there.

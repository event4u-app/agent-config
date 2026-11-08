---
reason: PR #2919 (road-to-a-session-start-under-the-host-limit) was red on the required check's step "Kernel / governance-hook edits carry a ratification artifact" alone — a recorded non-convergence after 31 two-provider council rounds; the owner decided owner ratification in session on 2026-11-08 and merged over the step
subject: 64cb0bc514617a524b479bf91bb7c60e143638ac9d167ace598c046dc34d9a64
time: 2026-11-08T16:41:50+01:00
commit: f175e4586b38bb04e7aece44fc57d1ef95601cce
ruleset_version_before: 56735008
ruleset_version_after: 56735008
restore_by: 2026-11-15T16:41:50+01:00
restored_at: superseded-by-owner-ruling agents/evidence/owner-directives/2026-10-25-standing-pull-request-bypass.md
council_review: agents/evidence/council/bypass-2919-review-20261108.md
---
<!-- evidence-type: bypass-record -->

# Bypass — PR #2919, startup contracts

Under the standing actor kept by `2026-10-25-standing-pull-request-bypass.md`
(ruleset `17749383`, version `56735008`). On head `22dbf4b22e` 65 of 66 checks
passed or were skipped (53 passed, 12 skipped); the one red, "Sync + Generate Tools Consistency", failed
only at the step "Kernel / governance-hook edits carry a ratification artifact".

- **Why it was red:** the change edits the 28 high-consequence rules' startup
  contracts, five rule files, a hook-manifest comment and a hook-bundle ceiling,
  all on the ratification gate's list. 31 two-provider council rounds did not
  converge: anthropic ratified or confirmed from round 18 on, openai refused or
  withheld a stance every round. The record is
  `agents/evidence/ratifications/session-start-contracts.md` (verdict
  `confirmed-non-expanding`, one provider).
- **Who decided:** the repository owner, in session on 2026-11-08, choosing
  owner ratification (`2026-11-08-session-start-contracts-owner-ratification.md`).
- **Who executed:** the owner, with `gh pr merge 2919 --merge --admin`.
- **Subject:** `64cb0bc5…`, the gated digest at the merged head; the owner
  directive names it and the council-reviewed `2d446883…`. Between the two, the
  only gated file that changed is `src/config/hook-bundle-budget.json`, in five
  places: `main`'s `quota_notice_hook.ts` raise and ceiling 22,800 → 41,000
  (#2921), `main`'s two `reference_duty.ts` raises and its new 22,000 ceiling
  (#2926), and a `what_would_have_caught_it` field added to this branch's own
  `layer_promotion_hook` raise entry (a CI fix; the entry's ceiling did not move).
  Ungated files changed in the same range too: `check_startup_contracts.ts` and
  `check_session_start_budget.ts` gained `--self-test`, `skill_linter.ts` stops
  treating a startup-contract file as a rule (`check_startup_contracts` gates
  those files), `check_pack_size.ts` re-pins the installer, and two tests.
- **What the bypass did not do:** it did not ratify the change through the
  council. openai's last open points stay recorded as dissent in the owner
  directive.
- **`council_review`:** `bypass-2919-review-20261108.md` — one round, both
  seats; the corrections above come from it.

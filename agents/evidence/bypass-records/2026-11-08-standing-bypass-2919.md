---
reason: PR #2919 (road-to-a-session-start-under-the-host-limit) was red on the required check's step "Kernel / governance-hook edits carry a ratification artifact" alone — a recorded non-convergence after 31 two-provider council rounds; the owner decided owner ratification in session on 2026-11-08 and merged over the step
subject: 64cb0bc514617a524b479bf91bb7c60e143638ac9d167ace598c046dc34d9a64
time: 2026-11-08T16:41:50+01:00
commit: f175e4586b38bb04e7aece44fc57d1ef95601cce
ruleset_version_before: 56735008
ruleset_version_after: 56735008
restore_by: 2026-11-15T16:41:50+01:00
restored_at: superseded-by-owner-ruling agents/evidence/owner-directives/2026-10-25-standing-pull-request-bypass.md
council_review: pending
---
<!-- evidence-type: bypass-record -->

# Bypass — PR #2919, startup contracts

Under the standing actor kept by `2026-10-25-standing-pull-request-bypass.md`
(ruleset `17749383`, version `56735008`). On head `22dbf4b22e` 63 of 64 checks
passed or were skipped; the one red, "Sync + Generate Tools Consistency", failed
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
- **Subject:** `64cb0bc5…`, the gated digest at the merged head. It differs from
  the council-reviewed `2d446883…` only by `main`'s own `raise_log` entries merged
  into `src/config/hook-bundle-budget.json`; the owner directive names both.
- **What the bypass did not do:** it did not ratify the change through the
  council. openai's last open points stay recorded as dissent in the owner
  directive.
- **`council_review`:** `pending` — the after-the-fact council review of this
  bypass has not run yet.

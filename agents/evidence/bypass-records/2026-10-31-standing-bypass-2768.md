---
reason: PR #2768 (round inbox-2026-10-cb) was red on the required check "Standing payload delta + budget gate" alone, which refused the still-unverified grant oq-42-image-floor-routes-to — the same refusal, at the same measured total of 135,867 tokens, as the unrelated PR #2766; the owner chose the standing pull-request bypass in session on 2026-10-31
subject: 9139e67d09090cfce79a5232607ca58a951901d79081a16d78732f07196b8769
time: 2026-10-31T11:31:07+01:00
commit: d7d3789486f51ade954aee90717f65266277b01c
ruleset_version_before: 54936982
ruleset_version_after: 54936982
restore_by: 2026-11-07T11:31:07+01:00
restored_at: superseded-by-owner-ruling agents/evidence/owner-directives/2026-10-25-standing-pull-request-bypass.md
council_review: pending
---
<!-- evidence-type: bypass-record -->

# Bypass — PR #2768, round inbox-2026-10-cb

Under the standing actor kept by `2026-10-25-standing-pull-request-bypass.md`
(ruleset `54936982`). On head `d50e1510a1` every check passed or was skipped
except "Standing payload delta + budget gate", which refused grant
`oq-42-image-floor-routes-to` for want of an independent approving review — the
consequence the #2754 and #2755 records already name for every later pull
request whose payload step runs.

- **Who decided:** the repository owner, in session on 2026-10-31, choosing
  "merge with `--admin --match-head-commit d50e1510a1` and a bypass record".
- **Who executed:** the agent, with
  `gh pr merge 2768 --squash --admin --match-head-commit d50e1510a12a0c268c81334e25c58c8810a25b74`.
- **Subject:** nothing in this change is gated — `ratification_subject --files`
  over the merged files returns "no record is owed". `subject` is therefore
  `git diff --binary d7d3789486^1 d7d3789486 | shasum -a 256`, the digest of
  the whole merged diff.
- **Not caused by this diff:** the PR did not touch
  `src/config/preamble-payload-exceptions.json` or any rule the preamble counts;
  PR #2766 on another branch fails with the identical measured total.
- **What the bypass did not do:** it did not verify the grant. Its
  `approval_event` still reads "NONE VERIFIED"; the owner's choice is not that
  review. The chain ends as the #2755 record states: `repaid_at` at the
  watermark, or `expires_at` 2027-01-27.
- **`council_review`:** `pending` — no council review of this bypass has run yet.

## What the merge changed

`git diff --name-status d7d3789486^1 d7d3789486` — 28 files, none gated.
Dispatch doctrine (a judge is never a fork; size-floor wording), drain-queue
holds and emergency halt, an optional `fix:` line on ratchet findings, bench-arm
headers, the archived round roadmap, and arrival lines and hand-off steps on
eight parked owners. The two ratification-gated edits the round first made
(`evaluator-independence`, `dispatch_hook.ts`) were withdrawn before the merge.

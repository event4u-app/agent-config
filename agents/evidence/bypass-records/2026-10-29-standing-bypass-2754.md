---
reason: the per-spawn preamble grant oq-42-image-floor-routes-to (owner answer OQ-42) is honoured only with an approving review by someone other than the author, which no one but the author gave on that pull request; the required check "Standing payload delta + budget gate" was red on that alone, and the owner merged PR #2754 under the standing pull-request bypass
subject: e2ddae32ca4e2354dd06eeab28b62fed083f51b96d252f8dd87ccd42ad85a43b
time: 2026-10-29T10:12:20+01:00
commit: 4257d0ebd33bb158d576032fbe2e8e3590a7ec5e
ruleset_version_before: 54936982
ruleset_version_after: 54936982
restore_by: 2026-11-05T10:12:20+01:00
restored_at: superseded-by-owner-ruling agents/evidence/owner-directives/2026-10-25-standing-pull-request-bypass.md
council_review: pending
---
<!-- evidence-type: bypass-record -->

# Bypass — PR #2754, the image rights floor and its preamble grant

Under the standing actor kept by `2026-10-25-standing-pull-request-bypass.md`
(ruleset `54936982`, bypass actor unchanged from `54668684`; see its addendum
of 2026-10-29). Every other required check was green; the one red check was
"Standing payload delta + budget gate", which refused grant
`oq-42-image-floor-routes-to` for want of an independent approving review. The
measurement itself was within the granted ceiling (135,867 = 135,824 + 43).

- **Who acted:** the repository owner, with `gh pr merge 2754 --squash --admin --match-head-commit <head>`.
- **Subject:** `ratification_subject --files src/rules/image-likeness-and-rights.md dist/agent-src/rules/image-likeness-and-rights.md --rev 4257d0eb --base-ref 4257d0eb^1` — the same digest the council ratified in round 3 (`agents/evidence/ratifications/image-floor-routes-to-20261029.md`), so the bypass let through exactly the reviewed change.
- **Consequence that stays open:** the grant remains unverified in the gate, so a later pull request whose payload step runs is refused until an independent approving review exists or the grant is repaid (`later/road-to-records-that-match-their-code` 1.7).
- **What the bypass did not do:** it did not satisfy the grant's approval
  requirement. The owner's merge overrode the red check; it is not the
  independent approving review the ledger asks for, and nothing records it as
  one. The grant's `approval_event` was corrected on 2026-10-29 to read
  "NONE VERIFIED" and to cite this record, after the after-the-fact council
  review pointed out that the original wording described an approval that did
  not happen.
- **What later pull requests see:** the gate keeps refusing the unverified
  grant, so every later pull request whose payload step runs is red on it —
  by design, not drift. It ends when an independent approving review is
  verified on a pull request carrying the grant, or when the payload returns to
  the watermark 135,824 and `repaid_at` is recorded (1.7), before 2027-01-27.

## Everything the merge changed

`git diff --name-status 4257d0eb^1 4257d0eb` — 18 files. `check_kernel_edit_ratified --rev 4257d0eb --base-ref 4257d0eb^1` names exactly two gated surfaces, both inside the ratified `subject`.

| Status | File | What it is |
|---|---|---|
| `M` | `agents/evidence/analysis/standing-payload-by-host-2026-09.md` | generated host census |
| `A` | `agents/evidence/council/image-floor-routes-to-ratification-r3-20261029.question.md` | evidence or planning record, no runtime effect |
| `A` | `agents/evidence/council/oq-42-grant-test-change-review-20261029.question.md` | evidence or planning record, no runtime effect |
| `A` | `agents/evidence/council/oq-42-grant-test-change-review-20261029.responses.md` | evidence or planning record, no runtime effect |
| `A` | `agents/evidence/owner-directives/2026-10-29-oq-42-image-floor-grant.md` | evidence or planning record, no runtime effect |
| `A` | `agents/evidence/ratifications/image-floor-routes-to-20261029.md` | evidence or planning record, no runtime effect |
| `M` | `agents/owner-questions.md` | evidence or planning record, no runtime effect |
| `M` | `agents/roadmaps/later/road-to-records-that-match-their-code.md` | evidence or planning record, no runtime effect |
| `M` | `dist/agent-src/rules/image-likeness-and-rights.md` | gated — byte-copied projection, inside the subject |
| `M` | `dist/router.json` | generated from the rule frontmatter |
| `M` | `docs/contracts/rule-router.md` | generated host cost table |
| `M` | `src/config/preamble-payload-exceptions.json` | the grant the red check refused |
| `M` | `src/packs/ai-image/pack.yaml` | generated token passport (rule size) |
| `M` | `src/rules/image-likeness-and-rights.md` | gated — the ratified subject |
| `M` | `tests/install/rule_packs_auto.test.ts` | test — reviewed (rule tests in the ratification; grant-ledger tests in agents/evidence/council/oq-42-grant-test-change-review-20261029.*) |
| `M` | `tests/install/safety_floor_follows_skill.test.ts` | test — reviewed (rule tests in the ratification; grant-ledger tests in agents/evidence/council/oq-42-grant-test-change-review-20261029.*) |
| `M` | `tests/scripts/check_preamble_payload_budget.test.ts` | test — reviewed (rule tests in the ratification; grant-ledger tests in agents/evidence/council/oq-42-grant-test-change-review-20261029.*) |
| `M` | `tests/scripts/measured_payload_ceiling.test.ts` | test — reviewed (rule tests in the ratification; grant-ledger tests in agents/evidence/council/oq-42-grant-test-change-review-20261029.*) |

## `approved_at`

`approved_at: 2026-10-29` is the date the owner ordered the grant (OQ-42). It
is not the date of an approving review; none exists. The gate does not read
`approved_at` as approval: it honours a grant only for ids passed as verified
(`--approved`, `verifiedApprovals`), which the workflow sets only after finding
an approving review by a non-author.


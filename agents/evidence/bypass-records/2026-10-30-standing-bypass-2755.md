---
reason: PR #2755 carries the bypass record for #2754 and touches the preamble grant ledger, so its payload step ran and refused the still-unverified grant oq-42-image-floor-routes-to; the required check "Standing payload delta + budget gate" was red on that alone, and the owner merged PR #2755 under the standing pull-request bypass
subject: 94a43e2212fe53ecc2c63bceac3a4a474ce2a021e050439d7d0be5b1c9222653
time: 2026-10-30T18:03:50+01:00
commit: 36af1af0866ce9ce50f4119d1edcf2a210869cda
ruleset_version_before: 54936982
ruleset_version_after: 54936982
restore_by: 2026-11-06T18:03:50+01:00
restored_at: superseded-by-owner-ruling agents/evidence/owner-directives/2026-10-25-standing-pull-request-bypass.md
council_review: agents/evidence/council/bypass-2755-review-20261030.md
---
<!-- evidence-type: bypass-record -->

# Bypass — PR #2755, the bypass record for #2754

Under the standing actor kept by `2026-10-25-standing-pull-request-bypass.md`
(ruleset `54936982`, unchanged since its addendum of 2026-10-29). Of the checks
on head `fab191e1`, 34 passed, 2 were skipped and 1 failed; the failed one was "Standing payload delta + budget
gate", which refused grant `oq-42-image-floor-routes-to` for want of an
independent approving review — the consequence the #2754 record already named
("every later pull request whose payload step runs is red on it").

- **Who acted:** the repository owner, with `gh pr merge 2755 --squash --admin --match-head-commit fab191e1ff08baa58e3352489423eb376e822ead`.
- **Subject:** nothing in this change is gated — `ratification_subject` over the
  seven changed files returns the empty digest and "no record is owed". To bind
  the review to exactly what went in, `subject` is instead
  `git diff --binary 36af1af086^1 36af1af086 | shasum -a 256`, the digest of the
  whole merged diff.
- **What the bypass did not do:** it did not verify the grant. No approving
  review exists on #2754 or #2755; the grant's `approval_event` still reads
  "NONE VERIFIED". The owner's merge is not that review.
- **The chain this continues, and how it actually ends:** the step "Verify
  exception approvals" in `.github/workflows/standing-payload-delta.yml` runs
  only on pull requests in the payload scope, and honours every live grant for
  that run alone when *that* pull request has an `APPROVED` review by someone
  other than its author. Nothing persists: an approval on one pull request does
  not verify the grant for the next, and an approval added to #2754 or #2755
  now changes nothing, since no further run happens on them. So each in-scope
  pull request is either approved by a second account, or red and merged by
  bypass with a record like this one. The chain ends only when the grant stops
  being live — `repaid_at` recorded with the payload back at the watermark
  135,824 (`later/road-to-records-that-match-their-code` 1.7), or `expires_at`
  2027-01-27 passing.
- **Correction to the #2754 record:** its last bullet says the chain ends
  "when an independent approving review is verified on a pull request carrying
  the grant". Per the workflow above, such a review clears only that one pull
  request; it does not end the chain.
- **`restored_at`:** reads `superseded-by-owner-ruling`, which
  `evaluateBypassRecords` (`src/scripts/_lib/platform_anchor.ts`) accepts only
  when the named directive carries `<!-- standing-bypass: ruleset_version=54936982 -->`.
  It does (addendum of 2026-10-29). Nothing was restored, because the standing
  actor is meant to stay.

## Everything the merge changed

`git diff --name-status 36af1af086^1 36af1af086` — 7 files, none gated.

| Status | File | What it is |
|---|---|---|
| `A` | `agents/evidence/bypass-records/2026-10-29-standing-bypass-2754.md` | evidence record, no runtime effect |
| `A` | `agents/evidence/council/bypass-2754-review-20261029.md` | evidence record, no runtime effect |
| `A` | `agents/evidence/council/bypass-2754-review-20261029.question.md` | evidence record, no runtime effect |
| `A` | `agents/evidence/council/bypass-2754-review-r2-20261029.question.md` | evidence record, no runtime effect |
| `A` | `agents/evidence/council/bypass-2754-review-r3-20261029.question.md` | evidence record, no runtime effect |
| `M` | `agents/evidence/owner-directives/2026-10-25-standing-pull-request-bypass.md` | addendum naming ruleset `54936982`, with the standing-bypass marker |
| `M` | `src/config/preamble-payload-exceptions.json` | grant `approval_event` text only — `granted_tokens`, `watermark`, `expires_at` unchanged |

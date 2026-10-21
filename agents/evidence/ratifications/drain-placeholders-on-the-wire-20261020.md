---
proposed_by: claude-opus-5.5/drain-placeholders-on-the-wire-20261020
implemented_by: claude-opus-5.5/drain-placeholders-20261021
reviewed_by: ai-council/anthropic+openai-2026-10-21
providers: [anthropic, openai]
verdict: refused
seats:
  anthropic: refused
  openai: refused
subject: 3e6808e3c081dc7c0a617e9073640ae83f1d7a5d2a5ba5cd9ce9d45bd6fbde8f
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the rewrite axis and tool-result replacement (not cleared)

Covers roadmap `road-to-placeholders-on-the-wire` 6.1 and Phase 3, built on
`drain/placeholders-on-the-wire-20261020` and carried on
`drain/placeholders-20261021`. **This record does not clear the change**:
`check_kernel_edit_ratified` refuses a push without a passing verdict.

| Round | Date | Reviewed | anthropic | openai |
|---|---|---|---|---|
| 5 | 2026-10-20 | the axis plus output replacement, prompt gate and input restore | refused (dealbreaker yes) | refused (dealbreaker yes) |
| 6 | 2026-10-20 | the axis and output replacement alone, round-5 findings fixed | no answer — `cli_quota_exhausted` | no answer — `cli_quota_exhausted` |
| 7 | 2026-10-21 | round 6's subject after a merge with `origin/main` (subject above) | refused (med, dealbreaker yes) | refused (high, dealbreaker yes) |

Round 7's prompt is `agents/evidence/council/placeholders-wire-review-r7-20261021.question.md`,
committed verbatim. Both seats named the same dealbreakers:

1. The rewrite log recorded `emitted` before the emission decision was final; a
   block could then suppress the replacement with no correcting line and no
   revocation, so the record could disagree with what reached the host.
2. The running host's version came from any file the envelope's
   `transcript_path` named, matched by a regex anywhere in its tail.
3. Revocations were a read-modify-write JSON file that failed open: an
   unreadable or corrupt file read as "nothing revoked", and a write failure was
   silent.
4. Unbounded recursive checks ran before the deadline was measured; no rollback
   criteria were stated.

The seats also judged the engine-chunk ceiling raise (28,000 → 44,000) and the
added `transcript_path` in the real-dispatch fixtures as changes to a judging
standard under the quoted rule, while calling both disclosed. The next round
reviews the change with these findings addressed.

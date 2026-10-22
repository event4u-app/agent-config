---
proposed_by: 17.0.0 self-review findings (local self-review run of 2026-10-21) and the owner's hold on the 17.0.0 cut
implemented_by: claude sessions of 2026-10-22, slice branches fix/r17-w4-upgrade-egress, fix/r17-w4-gates, fix/r17-w4-analysis and fix/r17-w4-records, merged on fix/release-17-review-fixes-w4
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), rounds of 2026-10-22
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
subject: 2f2033cbef31fc754fea6960365e491437e05096132b5e461f6807b0eec5b3a9
---

<!-- evidence-type: ratification -->

# 17.0.0 self-review fixes, wave 4 — the gated subset

The branch merges four slices fixing further 17.0.0 self-review findings on top
of wave 2. `check_kernel_edit_ratified`, run against `origin/main`, classifies
six of its changed files as gated, and this record answers for exactly those
six, in their cumulative state: `hooks/block_credential_reads.ts` (a glob or
brace list that can expand to a credential name is refused, a Grep `glob` is
read as a path), `_lib/egress_rules.ts` (a quoted credential is replaced whole
and judged run by run across whitespace and inner quotes),
`hooks/egress_stage.ts` and `hooks/dispatch_hook.ts` (egress `strict` refuses
a credential-carrying prompt and discloses a credential in a tool result
without replacing another guard's message), `check_platform_anchor.ts` (an
open bypass closes only on a structured multi-seat review, and its clock
cannot be rewound) and `_lib/ratification_subject.ts` (unchanged since wave 2:
`refExists` refuses an empty or `-`-led ref).

It replaces the wave-2 record for this branch: that record's `subject` covers
different content, and the cumulative diff reviewed here includes the parts
wave 2 reviewed.

## What was reviewed

The prompt of the final round is committed verbatim as
`agents/evidence/council/release-17-review-fixes-w4-20261022.question.md`. It
carried the cumulative diff of the six gated files against `origin/main`, the
diff of the two modules they call (`_lib/credential_files.ts`,
`_lib/as_of.ts`), the changed test assertions, the local test evidence, the
finding ids each change closes (`39ef3dba582a`, `a925125389fd`,
`533e105fccc9`, `848868872ae6`, `882f1cbd89de`), the two follow-up fixes from
earlier rounds, and a list of what was left out for the input ceiling. It asked
whether the change expands agent authority or opens a guard, redaction or gate
bypass, offering the four verdicts without stating an expected one. `subject`
is the digest of the six gated files, computed by `ratification_subject`
against `origin/main`. Default prompt mode, one round per run.

## Rounds — what happened before the final one

1. **Incomplete prompt.** The first run showed five of the six gated files
   (`_lib/ratification_subject.ts` was missed); both seats answered
   `confirmed-non-expanding`, but the record could not answer for content the
   prompt did not show. Re-asked with all six.
2. **One refusal.** anthropic `confirmed-non-expanding`; openai `refused`,
   naming a redaction bypass in the quoted generic-assignment change: a
   secret-shaped run glued to a long low-entropy tail by the other quote
   character was one low-entropy word, while the old row stopped at the inner
   quote. Fixed in `5560144507` (runs split on quotes too; two test cases seen
   red without the fix), not argued.
3. **Both `confirmed-non-expanding`.** openai named a weaker defect: the strict
   disclosure's `withSystemMessage` replaced an existing `systemMessage`,
   which could hide another guard's message. Fixed in `0ce47de0a0` with a
   unit test, which changed the gated content, so the review ran again.
4. **Final round, both `confirmed-non-expanding`** — the seats below.

## Seats (final round)

**anthropic — `confirmed-non-expanding`.** Walked all seven commits: each
detects more (quoted values, globs, inner quotes), enforces a refusal that was
silent (`strict`), hardens bypass closure and its clock, or keeps information
(the disclosure message); the refactor moves code without changing calls. It
named no input that passes now and did not before, and singled out the
quote-splitting logic as the place to scrutinise, finding that it can only
detect more for quoted values and leaves bare values on the old rule.

**openai — `confirmed-non-expanding`.** No shown input now passes a guard,
redaction or the ratification gate that previously failed; the changes are
monotonic restrictions, and the quoted review-credential validator change
increases detection rather than creating a bypass.

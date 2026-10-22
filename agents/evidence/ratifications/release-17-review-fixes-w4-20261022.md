---
proposed_by: 17.0.0 self-review findings (local self-review run of 2026-10-21) and the owner's hold on the 17.0.0 cut
implemented_by: claude sessions of 2026-10-22, slice branches fix/r17-w4-upgrade-egress, fix/r17-w4-gates, fix/r17-w4-analysis and fix/r17-w4-records, merged on fix/release-17-review-fixes-w4
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round of 2026-10-22
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
subject: c5c55b37f3d526b3bd2b12621ed9a79bd02663d7fd9a052207b9d29bd6de8ff2
---

<!-- evidence-type: ratification -->

# 17.0.0 self-review fixes, wave 4 — the gated subset

The branch merges four slices fixing further 17.0.0 self-review findings on top
of wave 2. `check_kernel_edit_ratified`, run against `origin/main`, classifies
five of its changed files as gated, and this record answers for exactly those
five, in their cumulative state: `hooks/block_credential_reads.ts` (a glob or
brace list that can expand to a credential name is refused, a Grep `glob` is
read as a path), `_lib/egress_rules.ts` (a quoted multi-word credential is
replaced whole), `hooks/egress_stage.ts` and `hooks/dispatch_hook.ts` (egress
`strict` refuses a credential-carrying prompt and discloses a credential in a
tool result; the handling sits in the egress stage), and
`check_platform_anchor.ts` (an open bypass closes only on a structured
multi-seat review, and its clock cannot be rewound).

It replaces the wave-2 record for this branch: that record's `subject` covers
different content, and the cumulative diff reviewed here includes the parts
wave 2 reviewed.

## What was reviewed

The prompt is committed verbatim as
`agents/evidence/council/release-17-review-fixes-w4-20261022.question.md`. It
carried the cumulative diff of the five gated files against `origin/main`, the
diff of the two modules they call (`_lib/credential_files.ts`,
`_lib/as_of.ts`), the changed test assertions with one line of context, the
local test evidence, the finding ids each change closes (`39ef3dba582a`,
`a925125389fd`, `533e105fccc9`, `848868872ae6`, `882f1cbd89de`), and a list of
what was left out for the input ceiling. It asked whether the change expands
agent authority or opens a guard, redaction or gate bypass, offering the four
verdicts without stating an expected one. `subject` is the digest of the five
gated files, computed by `ratification_subject` against `origin/main`. One
round (`--rounds 1`), default prompt mode; both seats answered.

## Seats

**anthropic — `confirmed-non-expanding`.** Each of the five changes
strengthens a guard or gate: the quoted-value fix redacts more and the test
shows no previously covered span was lost; globs that passed the read guard
are now refused; `strict` now refuses or discloses where it was silent; the
refactor moves code without changing the calls; a bypass record is harder to
close and its clock cannot be rewound. It named no input that passes now and
did not before.

**openai — `confirmed-non-expanding`.** The cumulative change only
strengthens refusal, detection, disclosure and ratification validation, and no
shown input now passes a guard, a redaction surface or a gate that previously
failed.

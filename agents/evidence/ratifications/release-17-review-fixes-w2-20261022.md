---
proposed_by: 17.0.0 self-review findings (local self-review run of 2026-10-21) and the owner's hold on the 17.0.0 cut
implemented_by: claude sessions of 2026-10-21 and 2026-10-22, branch fix/release-17-review-fixes-w2
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round of 2026-10-22
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
subject: c768d722d1d82b614f680a9988ddc91beef59f6c09ad078e39686aa1b8876b7d
---

<!-- evidence-type: ratification -->

# 17.0.0 self-review fixes, wave 2 — the gated subset

The branch fixes about 160 self-review findings. `check_kernel_edit_ratified`
classifies six of its changed files as gated, and this record answers for
exactly those six: `hooks/block_credential_reads.ts` (docblock only),
`hooks/dispatch_hook.ts` and `hooks/egress_stage.ts` (a blocking concern keeps
its name when egress withholds its reason), `_lib/egress_rules.ts` (a quoted
review-assignment value is read as a literal, so it is masked in the council
bundle), `_lib/ratification_subject.ts` (`refExists` refuses an empty or
`-`-led ref) and `check_platform_anchor.ts` (a `-`-led `--base-ref` is refused
before any git call).

## What was reviewed

The prompt is committed verbatim as
`agents/evidence/council/release-17-review-fixes-w2-20261022.question.md`. It
carried the full diff of the six gated files and the tests added with them,
the local test and entry-point evidence, and asked whether the change expands
agent authority or opens a guard, redaction or gate bypass, offering the four
verdicts without stating an expected one. `subject` is the digest of the six
gated files, computed by `ratification_subject` against `origin/main`. One
round (`--rounds 1`); both seats answered.

## Seats

**anthropic — `confirmed-non-expanding`.** Each of the five commits either adds
attribution or hardens a check: the refusal still happens with its concern
named; quoted credentials that escaped redaction are now masked; the
credential-read change is documentation; option-shaped refs are refused before
git sees them. It identified no input that passes now and did not before.

**openai — `confirmed-non-expanding`.** No input newly passes a guard, the
redaction or a gate. It named the validator signature change as the strongest
concern and found that the added group argument only makes one rule stricter
and weakens no existing validator.

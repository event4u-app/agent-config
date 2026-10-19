---
proposed_by: claude-opus-5/drain-self-modification-council-20261019
implemented_by: claude-opus-5/drain-self-modification-council-20261019
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default-2026-10-19
providers: [anthropic, openai]
verdict: refused
seats:
  anthropic: refused
  openai: refused
subject: b9b56b681efb6c042b0a3635c7c09b35959d5ea9ffc9e938a6952c0b2336fd00
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review — steps 4.1 and 4.2, refused 2/2

A **non-passing** record. It is written and committed because the escalation the
owner answers needs it in front of him, and because the next lane should not
spend this round again. The change it reviewed is **not** in this branch: it was
reverted to `origin/main` and verified as an empty net diff per file, not by a
revert command's exit code.

## What was reviewed

Branch `drain/self-modification-council-20261019` at `bc1fe2f38`, subject
`b9b56b68…` over two gated files — `src/scripts/check_kernel_edit_ratified.ts`
and `src/scripts/_lib/ratification_subject.ts`.

- **4.1** — add the review's deciding modules
  (`modification_review_questions.ts`, `modification_review.ts`) to the gated
  surface. The gate does not import them, so the import-closure criterion of
  2026-10-15 never reached them, while condition 4 of
  `ratification-artifact.md` has reserved "the modules that … ask the questions
  and derive the verdict" to the owner since it was written.
- **4.2** — gate the 28 members of `rule-consequence-class.json`, plus that list
  and the `rule.schema.json` criterion that selects it.

## The review

One round, both seats, design mode through the CLI, quorum 2 of 2, nothing
billed. Prompt committed verbatim at
`agents/evidence/council/self-modification-4-1-4-2-20261019.question.md`; each
seat's full text beside it as `.anthropic.md` and `.openai.md`. The prompt
carried the whole executable diff (`src/`, `tests/`, `docs/contracts/`) at one
line of context and named what it left out.

| Seat | Stance | Confidence |
|---|---|---|
| anthropic / claude-sonnet-4-5 | `refused` | 92 |
| openai / codex-default | `refused` | 97 |

## The two dealbreakers, both on 4.2 and both correct

**1. The class list fails OPEN.** `consequenceRuleSlugs()` converted every read,
parse and shape failure into an empty set, so an unreadable list silently
removed protection from 28 rules while the gate kept exiting 0. The change's own
justification — "this list only WIDENS, so failing closed would red every kernel
PR over a file whose absence costs only the widening" — is the sentence both
seats rejected, and they are right: if the list is missing it does not cost only
the widening, it costs the entire protection the step claims to add. A test
named `falls back to an empty set on a missing or unparseable list` codified the
behaviour, which is how an argument became an assertion nobody re-examined.

**2. Membership is not resolved at the revision the subject binds to.**
`consequenceRuleSlugs()` read the working tree; the digest is taken from Git
objects at an explicit revision (D13). openai's refinement names the asymmetry
exactly, and it is the sharper half of the finding:

> Dropping an existing member while editing its rule is caught because the base
> list still contains it; adding a member while editing that newly consequential
> rule is not equivalently covered because the base list does not yet contain
> it. That sequencing asymmetry directly contradicts the "both limbs or neither"
> invariant stated in `_lib/ratification_subject.ts`.

So an add-member-and-edit-that-rule diff requires a record while that rule's
bytes may be outside the digest the record carries.

## The objection to 4.1, which is why 4.1 was not simply narrowed and re-run

Neither dealbreaker names 4.1, and the first instinct was to stage 4.1 alone —
the move that ended the 2026-10-12 round. Both seats independently block that
path for a different reason: the reviewer boundary 4.1 draws is **asserted, not
evidenced**.

> The comments declare that the question and verdict modules alone hold deciding
> authority, but no dependency or behavioral evidence demonstrates that the
> deliberately ungated prompt, quorum, tally, transport, or chairman modules
> cannot change what is asked, counted, or accepted. (openai)

> Prompt text can inject bias; tally logic can change consensus rules; quorum can
> change eligible voters. (anthropic)

The step's answer to this is the pricing-pressure argument — gating all of
`src/scripts/ai_council/` would make every routine prompt edit carry a record and
build the pressure that eventually weakens a gate. That argument is about COST
and does not answer the AUTHORITY question the seats asked. The polarity tests
prove those paths stay editable; they do not prove those paths lack governing
authority. Re-running 4.1 alone without that evidence would have spent a round
discovering the same thing.

## Other findings, recorded rather than folded in

- **Schema coupling.** `rule.schema.json` is shared by every rule, so gating it
  prices every unrelated schema edit as a governance event. Both seats suggest
  extracting the `consequence_class` criterion into a dedicated governed file.
- **Process-global cache.** `consequenceSlugCache` is never invalidated; no test
  covers stale membership.
- **No member validation.** A listed slug with no rule file, a non-string key and
  a `__proto__` key are all accepted; object keys steer classification while
  values are ignored.
- **No audit trail on the fail-open path**, so the protection disappears
  silently.

## What is in this branch

The evidence and the roadmap record only. Both steps stay open, with the
findings above written at the step as the conditions the next attempt starts
from. Nothing here asks for ADR-281's reservation to be relaxed: a change to the
reviewer stays owner-reserved, and a favourable verdict would have been advisory
in any case.

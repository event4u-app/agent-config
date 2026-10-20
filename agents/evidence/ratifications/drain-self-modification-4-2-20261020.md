---
proposed_by: claude-opus-5.5/drain-self-mod-council-20261020
implemented_by: claude-opus-5.5/drain-self-mod-council-20261020
reviewed_by: ai-council
providers: [openai]
verdict: refused
seats:
  anthropic: no-final-verdict
  openai: refused
subject: 3f44d05d2ec329cb45333ff4b73f35736b0c3ece05065a653ceb598dbb0d8ae8
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review — step 4.2, five rounds, not passed

A **non-passing** record. It is written and committed because the escalation
the owner answers needs it in front of him, and because the next lane should
start from where these five rounds ended rather than spend them again. The
change it reviewed is **not** in this branch: it was reverted to `origin/main`
file by file and verified as an empty net diff per file. The code stays
reachable at `5ecf60b10` in this branch's history.

The header is round 5's, printed by `ratification_header`: openai `refused`,
anthropic timed out and left no text.

## What was reviewed

Step 4.2 of `road-to-self-modification-that-a-council-must-pass` alone — the 28
members of `src/config/rule-consequence-class.json` gated like kernel rules,
the list and (from round 5) the `rule.schema.json` criterion on the watch list,
rebuilt against the two dealbreakers that refused the 2026-10-19 attempt 2/2.
Step 4.1 was not in it. Gated files: `src/scripts/check_kernel_edit_ratified.ts`
and `src/scripts/_lib/ratification_subject.ts`; `classify_merge_risk.ts` and
14 test files beside them.

## The rounds

All design mode, `--rounds 1`, through the CLI seats
(anthropic/claude-sonnet-4-5, openai/codex-default), nothing billed. Each
prompt and each seat text is committed verbatim under `agents/evidence/council/`
as `self-modification-4-2{,-r2,-r3,-r4,-r5}-20261020.*`.

| Round | anthropic | openai | openai's dealbreaker | Answered in the next version by |
|---|---|---|---|---|
| 1 | ratified (85) | refused (94) | merge-time owner routing read the checkout's list, not the base/head union | both merge triggers read one union |
| 2 | ratified (85) | refused (91) | under-validated list as a repository-wide dependency; production routing unproven; no recovery path | closed clause set; `classifyTarget` tested over real commits; inventory test |
| 3 | ratified (70) | refused (94) | recovery only via an external bypass; shared fixture silently altered | class read only where it decides (`classDecidesAny`), so a broken base is repaired through the gate (recovery-drill test); each suite seeds its list explicitly |
| 4 | ratified (85) | refused (91) | the schema that defines the criterion left ungoverned | `rule.schema.json` joins the watch list |
| 5 | timeout | refused (91) | membership checked list-to-file only, never criterion-to-list | not answered — see below |

**Both 2026-10-19 dealbreakers held as fixed in every round.** Fail-closed
reading and the base/head union were not disputed after round 1.

## Why this lane stopped at five

Every openai refusal named a different defect, each was real enough to fix, and
each fix was accepted in the next round while a new one was raised. A sixth
round on an unchanged diff with a reworded prompt would be verdict shopping;
a sixth round on a changed diff had no new defect left to change for, because
round 5's dealbreaker is already enforced elsewhere: `tests/scripts/rule_consequence_class.test.ts`
checks that "the frontmatter and the class config agree, in both directions",
in CI. The bundle did not carry that suite, so the seat could not see it. That
is a fact for the next attempt's prompt, not a reason to re-ask this one.

And a passing record would not have landed it: under ADR-281 § Amendment a
favourable council verdict on the gated surface is advisory until the owner
binds an authorisation to the same digest.

## What the next attempt starts from

The design at `5ecf60b10`, which answers every dealbreaker of every round but
the last:

- `consequenceRuleSlugsIn` fails closed on an absent or unparseable list, a
  non-object `members`, a non-slug key (so `__proto__`), a clause outside the
  schema's three, or a member with no rule file in the same tree.
- Membership is the union of the lists at the base and head commits, read from
  Git objects in the function that already reads the dispatcher closure there.
- The class is read only for a diff holding a non-kernel rule path; for any
  other diff an empty class is exact, and a broken base is repaired through the
  gate with a record.
- `classify_merge_risk` passes the same union to both governance triggers, so a
  class member routes to the owner at merge (7 of 457 trunk commits in the 30
  days to 2026-10-20 would have).

Owed before the next review: put the frontmatter-to-list equality into the
bundle (or into the gate, if the next round asks for it there), and keep the
prompt under 45 KB — round 5's 48 KB prompt timed one seat out.

Nothing here asks for ADR-281's reservation to be relaxed.

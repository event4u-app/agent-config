<!-- evidence-type: analysis -->

# Revision 3 closes 7.1 narrowly, once it says what a classification is

AI council, 2026-10-24, the ninth round that day. anthropic/claude-sonnet-4-5 +
openai/codex-default, 2/2 present, 2 rounds with peer review, design mode, CLI
transport, `$0.00`, no chairman synthesis. The prompt is committed verbatim
beside this file as `gate-classification-ledger-r3-20261024.question.md`.

## Verdict: record it as the verdict, with one condition, and keep 7.2 blocked

- openai: *"close step 7.1 against its literal exit criterion, but do not treat
  revision 3 as authorization to change enforcement."* Q2: **yes**,
  medium-high confidence. No owner-reserved input is needed.
- anthropic: *"Conditional closure only. Record revision 3 as the
  classification verdict, but block 7.2 enforcement changes."* Its Q1 sets one
  condition before acceptance: *"is this ledger descriptive or prescriptive?
  Then force consistency with that choice."*

Both resolve the previous round's single blocker. Row 16's *store absent* now
carries a permitted class, and both accept the five refinements as present.
Both agree row 10 has eight aspects and the total of 37 is correct.

## The condition, and how revision 4 meets it

Both seats ask for the same definition, in different words. Revision 4 of
`agents/evidence/analysis/gate-classification-ledger-20261024.md` adds openai's
proposed wording almost verbatim:

> A classification attaches to one currently implemented assertion under one
> explicitly named invocation mode. Proposed behavior is non-binding migration
> metadata and is excluded from closure totals.

It adds that the classification is semantic and independent of today's exit
status. That is anthropic's *prescriptive* option. It also adds three records:

- a separate record of current enforcement, from the invocation inventory;
- an explicit divergence marker for the one place class and exit behaviour
  disagree: row 16, which exits 1;
- the citation of the Phase 7 start inventory openai asked for (the
  2026-10-10 round's record).

The two target-scope rows are excluded from the totals, which leaves 35
classified aspects. Each invariant carries an assurance qualifier, as openai
proposed: *repository-consistency*, *environment-dependent* or *fixed-policy*.
The Unresolved table no longer claims the scope fix "weakens no rule". openai
showed that claim was false: moving from disk to tracked paths stops detecting
untracked entries.

Whether revision 4 meets the condition was put to both seats in a tenth,
narrow round rather than asserted here.

## What 7.2 may and may not rely on (Q3, convergent)

openai: a 7.2 reader *"may rely on the ledger as the semantic classification of
the currently named assertions and invocation modes. They may not infer gate
membership, current non-blocking behavior, independent assurance, authority to
relax baselines, or implementation of the target scopes in rows 9 and 12."*
anthropic says the same, and names the rows that are not safe to act on
without prerequisites.

Both seats require this sequence before **any** 7.2 enforcement change. It is
blocking, not parallel cleanup:

1. define the classified unit (revision 4);
2. inventory callers and modes (done: `gate-invocation-inventory-20261024.md`);
3. decide the canonical review object for rows 9 and 12: the index, the
   checked-out commit, or the merge result;
4. reconcile row 16's semantics with its exit 1;
5. establish a rollback owner, mechanism, triggers, observation window and
   bypass expiry;
6. only then decide and implement any demotion.

## Hardest pushbacks

- anthropic: one table mixes current behaviour with desired contract and does
  not declare which it is.
- openai: the same point, plus *invariant* conflates three assurance levels.

Revision 4 addresses both.

<!-- evidence-type: analysis -->

# A split that found the question under the question

**Date:** 2026-10-10 · **Members:** `anthropic/claude-sonnet-4-5`, `openai/codex-default`
**Mode:** design, 2 rounds, peer review, blind chairman · **Cost:** $0.00 (subscription transport)
**Quorum:** 2/2 concluded · **Verdict: SPLIT 1/1 — escalates**

Executes step 2.1 of `road-to-authority-routing-mechanism`: does the
six-predicate dangerous-action test live in a new
`docs/contracts/dangerous-action-predicates.md` **(a)**, or as a section of
`docs/contracts/ratification-artifact.md` **(b)**?

| Seat | Pick | Core reason | Confidence |
|---|---|---|---|
| `anthropic/claude-sonnet-4-5` | **(b)**, conditional | the predicates are *definitional for authorization*, so weakening one IS weakening the gate; one consumer, so (a)'s modularity never materialises | 0.78 |
| `openai/codex-default` | **(a)**, atomic | one independently addressable canonical definition under the same protected-change policy as the kernel | 0.88 |

A split is an **escalation condition**, not a verdict. The pick does not land here.

## What both seats agreed, which is the part worth keeping

**Whichever file holds the predicates must join the gate's watch list in the
same change.** anthropic, arguing for (b), still answered the watch-list half
for (a): *"yes, add it to the watch list atomically"*, and priced it — the
watch-list modification itself needs ratification, needs a regression test
proving same-branch weakening is caught, and every future editorial change then
costs a full ratification round.

Both also reject duplication: references point at the canonical file, and a
second document restating the predicates is the drift failure, not the
separate file itself.

## The finding the step did not ask for

openai's hardest pushback, unrefuted:

> I would reject any claim that "being on the watch list" is itself a security
> boundary until a test proves the candidate cannot change both the protected
> policy and the code deciding whether that change requires ratification.

And, against anthropic's reading directly:

> The supplied evidence establishes only that the file is watched, not that the
> watcher is evaluated from a revision the candidate cannot alter. If a branch
> can weaken the gate and edit `ratification-artifact.md` together,
> co-location provides no independent protection.

This is correct against the tree as it stands, and the contract says so in its
own words: the gate runs its **code** from the base revision, but the workflow
**step** that decides whether it runs at all lives in the candidate branch —
*"THE GATE ADDS A REFUSAL. IT DOES NOT ADD AN ANCHOR."*

So neither (a) nor (b) is safe to execute yet, and the two seats' conditions
reduce to the same prerequisite: anthropic's *"only if the forge-side blocker
can be resolved"*, and openai's *"block all dependent routing work until
candidate-controlled self-bypass is disproven"*. Both name the blocker
`external-bootstrap-boundary-for-phases-2-3`.

## openai's sequence, recorded because it orders work this roadmap already plans

1. Establish that a trusted base-branch or forge-side gate evaluates candidate changes.
2. Obtain any ratification required to modify the watch list.
3. Add the predicate contract and watch-list entry **atomically**.
4. Run a negative regression test attempting to weaken the new file without a record.
5. Only then allow downstream routing code to depend on the predicates.

*"Step 3 must block step 5"*, and the missing kill switch is **fail closed**: if
the trusted gate cannot load the canonical predicate file, cannot establish the
comparison base, or detects disagreement between candidate and trusted gate
configuration, authority routing stops and requires user review. Rollback
restores both artifacts together — *"there should be no 'temporarily unwatched'
state."*

## What this does NOT decide

The location. That escalates with the split intact, and it is not re-run: a
second round against the same evidence would be verdict shopping, and the
evidence that would move either seat is named — for anthropic, proof the
blocker is permanent, or a second consumer needing versioned independence; for
openai, proof that only an embedded definition can be validated atomically by
trusted forge-side tooling. Neither exists today.

## Prompt provenance

Committed beside this record as
`dangerous-action-predicates-home-20261010.question.md`. It stated what would
make each option **wrong**, supplied the four verified facts including the
measured gate refusal, and forbade by name the two easy moves — picking (a)
because (b) is blocked, and proposing a third location as a compromise. Both
seats answered the wrongness conditions; openai explicitly addressed the
landability trap and declined it as a reason.

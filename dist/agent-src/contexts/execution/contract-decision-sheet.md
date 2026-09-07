# Contract Decision Sheet

Loaded by [`roadmap-execution-contract`](roadmap-execution-contract.md)'s
derivation, so every consumer of the contract inherits it without binding to a
command. One place asks the user: the contract screen. The plan-confidence
interview, artifact understand-questions, and in-run clarifications feed *this*
surface instead of opening rounds of their own.

## The Iron Law

```
ONE SHEET PER CONTRACT DISPLAY. EVERY QUESTION THE PRE-SCAN FOUND IS ON IT,
EACH WITH A DEFAULT, PLUS AN ACCEPT-ALL-DEFAULTS PATH.
A QUESTION THAT COULD HAVE BEEN ON THE SHEET AND IS ASKED MID-RUN INSTEAD
IS A DEFECT, NOT A CLARIFICATION.
THE LOCKED CLASSES NEVER ENTER THE SHEET — THEY ESCALATE WHEN THEY FIRE.
```

## What goes on the sheet

Pre-scan class 4 (open questions / ambiguity) produces the rows. A row is
sheet-eligible when **all** hold:

- it is answerable **before** the run starts — its answer does not depend on
  something the run itself produces;
- its decision class is `trivial`, `low_impact`, or `medium_impact`
  ([`ai-council-config`](../../../docs/contracts/ai-council-config.md)
  § decision_resolution);
- a **conservative default** exists and can be stated in one line.

Anything else is not a sheet row. In particular:

| Not on the sheet | Why | Where it goes instead |
|---|---|---|
| `high_impact` / `user_required` | Locked to the user by an Iron Law no config lifts | Escalates during the run, at the moment it fires |
| A question whose answer depends on run output | Cannot be answered at contract time; a guessed default would be a fabrication | The in-run escalation path |
| A question with no conservative default | An option set with no safe side is a real decision, not a preference | Its own escalation |

## Shape

```
Decision sheet — <N> question(s), all answerable now

1. <question>
   default: <option> — <one clause on why this is the conservative side>
   alt:     <option> · <option>
2. <question>
   default: <option> — <why>
   alt:     <option>

A. Accept all defaults
B. Change one — reply with that row's NUMBER instead of a letter; it is put
   on its own, then the sheet returns with the rest unchanged
C. Ask me these one at a time instead
```

**Why `B` takes a number and not a list.** It used to read
`Change some (name them: "1=x, 2=y")`, and that is a **structured reply** —
exactly what [`user-interaction`](../../rules/user-interaction.md)'s Pre-Send
Self-Check names as a violation ("User would need a structured reply (`1a, 2b`)
instead of a single number"). One block whose answer needs a structured reply is
not one decision point; it is N questions wearing a table, which is the reading
this whole page exists to defeat.

So the answer domain is `A`, `C`, or a single row number — **one token,
whichever it is**. Overriding two rows is two turns, and that is the correct
cost: each override is a decision the default did not carry.

The contradiction was resolved on **the sheet's** side deliberately, and the
asymmetry is durable rather than incidental: `user-interaction` is one of the
locked nine ([`kernel-membership § 4`](../../../docs/contracts/kernel-membership.md)),
so amending its clause is an owner-reserved edit that `block-kernel-rule-writes`
refuses at tool-call time, while the answer SHAPE is this page's own. When a
page and a kernel rule contradict each other, the page is both the cheaper half
to change and the only half an autonomous run may touch at all.

The sheet is rendered **inside** the contract screen, above its Accept line —
never as a second block and never as a second turn. Accepting the contract with
`A` is one decision point answered by one keystroke, which is what makes it one
question under [`ask-when-uncertain`](../../rules/ask-when-uncertain.md)'s
Iron Law rather than N questions wearing a table.

`C` exists because the batch is a convenience the user may decline. It is not a
fallback the agent may choose: only the user picks `C`.

## Recording — every answer is auditable after the fact

Each answered row is written to the run's decision-memo directory with the
question, the chosen option, and whether it came from `A` (default accepted) or
an explicit override. Risk 1 of the originating roadmap is that a batched sheet
invites accepting a decision that deserved thought; the mitigation is not to
make the sheet harder to accept, it is to make every accepted default
reviewable afterwards. A default accepted without being read is recoverable
when it is on the record and invisible when it is not.

## Why one sheet is not "fewer safeguards"

The count of *decisions the user makes* is unchanged. What changes is the number
of times the run stops to collect them: N stops become one. The locked classes
still stop the run individually, when they fire, because their whole point is
that they are seen at the moment they matter rather than pre-answered in a batch.

Measured motivation: [`roadmap-process-loop § 3a`](roadmap-process-loop.md)
records that 27 of 37 active roadmaps carried no `execution.mode` and therefore
derived no contract at all — so before this surface existed, the questions this
sheet batches were not asked once, they were asked one at a time, mid-run,
by whichever mechanism happened to hit them first.

## See also

- [`roadmap-execution-contract`](roadmap-execution-contract.md) — the screen this renders inside; its single Accept is the authorization.
- [`roadmap-process-loop § 3`](roadmap-process-loop.md) — the pre-scan that produces the rows, and the § 3a ladder that decides whether a contract is derived at all.
- [`ai-council-config`](../../../docs/contracts/ai-council-config.md) § decision_resolution — the class table and the locked-class Iron Law.
- [`ask-when-uncertain`](../../rules/ask-when-uncertain.md) — one question per turn; one sheet answered by one keystroke is one question.
- [`user-interaction`](../../rules/user-interaction.md) — the numbered-options shape and the single recommendation line.

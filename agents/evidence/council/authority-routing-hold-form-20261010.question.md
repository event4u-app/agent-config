<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-10, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# Step 1.1 — what mechanical form must the "hold" take?

You are deciding one question for `road-to-authority-routing-mechanism` step 1.1.
Answer it on the evidence below. Do not summarise the evidence back.

## The record item being satisfied

`agents/evidence/council/authority-routing-20261007.md`, Required sequencing,
item 1, verbatim:

> 1. Hold authority-expanding constitutional merges, or require an external
>    bootstrap approval.

That record was `ratified` 2/2 on 2026-10-07. Its dealbreaker, recorded as
given by `openai/codex-default`, and the circularity `anthropic` reached
independently:

> the ratification record remains inside the same write boundary as the
> governed change

> **the enforcement code must not be ratifiable through the same process it
> enforces.** Either it sits in a protected subset needing higher approval, or
> it is externally verified, or it is honestly labelled policy rather than
> mechanism.

## What Phases 2 and 3 will actually change

- **2.3** splits the single `verdict` field of the ratification record into
  three (technical review outcome · authority classification · authorisation
  to proceed).
- **2.4** extends the `refused` vocabulary.
- **3.2** adds an approver registry. **3.3** builds the verifier that checks a
  record's bound attestation.

## The existing ladder, as the contract states it TODAY

`docs/contracts/ratification-artifact.md` § When the user decides — the
conditions, once. The user decides when, among others:

> 4. the change is to the **reviewer itself** — the modules that compute the
>    record's `subject`, write the record, ask the questions and derive the
>    verdict, **and this contract**.

And § This gate is not independently enforceable:

> THE GATE ADDS A REFUSAL. IT DOES NOT ADD AN ANCHOR.
> IT RUNS BECAUSE A WORKFLOW STEP IN THE CANDIDATE BRANCH INVOKES IT.

The gate `check_kernel_edit_ratified` runs from a workflow step in the
candidate branch. `check_platform_anchor` runs pre-push, not in CI, because
the rulesets endpoint needs a token scope a workflow `GITHUB_TOKEN` cannot
carry.

## The options

- **(a)** A doc-only hold: a sentence in `docs/contracts/ratification-artifact.md`
  declaring that every gated-surface commit made by Phases 2–3 lands through
  the existing, unchanged ladder — no new bypass, no new exemption.
- **(b)** A stronger, separate hold: e.g. a temporary CI check scoped to the
  files Phases 2–3 will touch, shipping with its own test.
- **(c)** Something else you name, including a split answer across Phase 2 and
  Phase 3.

## What makes each option WRONG — decide against these, not against taste

- **(a) is wrong if** a declaration that changes land "through the existing
  ladder" adds nothing the contract does not already say, in which case item 1
  is recorded as satisfied by a sentence that holds nothing.
- **(a) is also wrong if** the existing ladder's condition 4 routes Phase 2–3
  to the owner anyway, because then the sentence misdescribes a user-decides
  case as a ladder case and WEAKENS what is already required.
- **(b) is wrong if** a CI check in the candidate branch is the same write
  boundary the dealbreaker names, in which case it is ceremony that reads as
  mechanism — the precise error the record's § 2 table was built to expose.
- **Any option is wrong if** it leaves Phase 3's verifier ratifiable through
  the process Phase 3's verifier enforces.

## Two moves that are forbidden here, by name

- Do **not** reach for "the owner decides" merely because this is governance.
  Item 1 offers two shapes and the step asks which; routing the whole question
  up is an answer only if you state which of the two it is and why neither
  mechanical form can be chosen without the owner.
- Do **not** reach for (b) because it sounds stronger. The record's own § 2
  table rejects controls that guarantee less than they appear to. If (b) is
  chosen, name what it guarantees that (a) does not, in that table's columns.

## What to return

1. Your pick — `(a)`, `(b)`, or `(c)` with its shape named.
2. Whether the existing ladder's condition 4 already routes Phases 2–3 to the
   owner. Yes or no, with the reasoning. This is the fact the pick turns on and
   it is NOT yet established — if you cannot establish it from the text above,
   say so, and say what that does to your pick.
3. One sentence naming what your pick guarantees and one naming what it does
   not.
4. Confidence, and any dissent you would want recorded.

<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-10, committed verbatim so the
     verdict beside it can be checked against what was asked. -->

# Step 6.1 — how a review instance stays bound to the actual merge candidate

One question for `road-to-authority-routing-mechanism` step 6.1, executing
defect 4 of the authority-routing record: *"review hashing without
serialisation still reviews a head that is no longer the merge candidate."*

Answer on the mechanism as it stands. Do not summarise it back.

## What exists today, read from the code rather than recalled

`dispatch_r2_reviewer.ts` OWNS the review-scope hash — *"the single definition
of what a completion review is bound to"* — and `check_completion_review.ts`
imports it rather than restating it, so the dispatcher and the validator cannot
diverge.

The scope is a **three-dot** diff: `git diff <flags> base...HEAD -- :/
<excludes>`, config-pinned. The review binds to that hash, **never to a commit
sha**, and the completion-review marker records `scope`, `diff`, `reviewer`,
optionally `author` and `prompt_hash`.

Three consequences follow from the three dots, and they are the shape of the
problem:

1. The hash is computed against the **merge base**, so `main` advancing on
   files the branch does not touch leaves the scope hash **unchanged**. That is
   correct and is not the defect.
2. If `main` changes a file the branch **also** touches, the content that would
   actually land differs from what was reviewed — and a three-dot diff from the
   original merge base does not show it. The review passes; the merge candidate
   is not what was reviewed.
3. Nothing serialises. Two in-flight branches can each hold a green review
   against the same base and land in either order.

Concretely in flight right now: `road-to-self-modification-that-a-council-must-pass`
touches `docs/contracts/ratification-artifact.md` and
`src/scripts/_lib/*`; this roadmap's own Phase 2–3 will touch
`check_kernel_edit_ratified.ts` and the same reader. Adjacent, sometimes
identical, files.

## What a same-day re-review has to be able to express

Phase 2.4 extends the `refused` vocabulary to distinguish a *correctable
objection* from *non-convergence* from a *request for user authority*. Phase 2.5
defines a review-instance identity: a stable id across attempts that RETAINS
prior objections and shows their dispositions. 6.3 then wires
`check_completion_review` to express a same-day re-review using that identity —
*"never by widening what counts as 'the same review' without the identity
check"*.

Neither 2.4 nor 2.5 has shipped. **Both are blocked behind an owner-reserved
forge control**, so this question is about the MECHANISM a later change would
implement, not about code that can land now.

## The question

How does a review instance stay bound to the actual merge candidate across a
same-day re-review, given concurrent in-flight branches?

## What makes an answer WRONG — decide against these

- **Re-hashing on every base move is wrong** if it invalidates reviews that are
  still valid. Case 1 above is exactly that: `main` advancing elsewhere changes
  nothing a reviewer looked at, and forcing a re-review there trains people to
  re-stamp without reading, which destroys the signal the gate exists to carry.
- **Binding to a commit sha is wrong** for the reason the contract already
  gives: the review would be invalidated by a rebase or a squash that changes no
  content.
- **A merge queue is wrong as a bare answer.** Name what it costs here: this
  repository merges roughly eighteen first-parent changes a day, and the owner
  is the only consistently active maintainer. A mechanism that assumes a staffed
  queue is a mechanism that will be bypassed.
- **Any answer is wrong** that lets the agent decide, at merge time, that its own
  review is still current. The party gaining the merge is not the party
  attesting that the review still binds.

## Two moves that are forbidden here, by name

- Do **not** reach for "the owner decides at merge time". That converts a
  mechanical question into a standing interrupt for the one person this
  roadmap's parent record is trying to take work off.
- Do **not** propose re-reviewing on every push. The step asks for
  SERIALISATION, not for more reviews; an answer whose cost is linear in pushes
  has not engaged with the problem.

## What to return

1. **The mechanism**, concretely enough that a later change could implement it
   without re-deciding anything.
2. **What exactly re-binds**, and what legitimately does not — i.e. the
   predicate that separates case 1 from case 2 above.
3. **How two in-flight branches are ordered**, and what happens to the loser's
   review.
4. **What your mechanism cannot prove**, stated plainly.
5. Confidence, and any dissent you would want recorded.

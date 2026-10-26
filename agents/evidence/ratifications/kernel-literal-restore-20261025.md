---
proposed_by: ai-council/oq-13-2026-10-25
implemented_by: owner/matze4u
reviewed_by: ai-council
subject: 16f08f46503a0304a5adb5577e0bf962e9f39781c09793d15af769a5d94ae4b3
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Restores the protected never-act-while-asking literal on line 41 of non-destructive-by-default, keeps the same-turn sentence, shortens the example clauses and Shape per to Shape: so the rule fits its always-rule allowlist and the per-spawn payload ratchet; re-anchors the kernel prefix. Owner answer to OQ-13, option 1. Round 1 ratified 2/2 before the CI trim; this is round 2.

Verdict `ratified`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/kernel-literal-restore-ratification-r2-20261025.question.md`, committed at `0628f5c06fd456e53f4f89bdfe61dc54020ad2b7` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `ratified`

```text
Reviewing the round 2 diff.

## Agreement with prior reviewers

**With Reviewer A:** Full agreement. No defect, all guarantees preserved, authority narrowed, no blockers. The "WAIT for the answer" strengthening is particularly important - it closes any possible interpretation that a brief pause suffices rather than awaiting user input.

**With Reviewer B:** Agree on ratified verdict and the substantive strengthening. Reviewer B's observation about "Shape per" → "Shape:" being marginally less imperative is stylistically valid, and the "Use:" alternative is clever (equally short, more directive). However, I disagree this rises to a material concern: the reference to `user-interaction` remains normative, the imperative force comes from the Iron Law framing, and reopening for one word would cost another kernel-rule round when the current wording is functionally equivalent. The prefix hash verification point is correct - the change from `5a877e36...` to `8ba51df2...` should be from the reviewed edit only, which the context states was produced by `--update-baseline` after the owner's change.

## New points

**1. The definite articles strengthen the clause.** Round 1 reviewers noted "WAIT for the answer" but didn't explicitly flag that "Ask and action" became "**The** ask and **the** action." This moves from indefinite (any ask/action in general) to definite (the specific ask and action in context), which is a tightening.

**2. Character ceiling headroom: 1 char.** The rule now sits at 9,656/9,657 - technically compliant but at practical capacity. Any future kernel edit to this file will need to cut characters to stay under. Not a blocker, but this rule is now at its size limit.

**3. Invariant exact match restored.** The new line 41 matches `tests/golden/invariants.json` word-for-word. The point of this change was to fix a failing invariant check, and it does exactly that.

## Answers to the three questions

1. **Defect?** No. The new line 41 preserves every guarantee and strengthens two: "WAIT for the answer" is more explicit than bare "WAIT," and "The ask and the action" is more specific than "Ask and action." The approval-names-exact-object requirement is unchanged. The three examples retain all identifiers, just with cleaner colon syntax.

2. **Authority?** Narrowed. "WAIT for the answer" removes any wiggle room - the agent must await user input, not just pause.

3. **Must change before merge?** Nothing. The 24h soak is procedural (kernel-rule-edits contract), not a change requirement. The diff passes all gates: invariants 19/19, payload 135,863/135,864, prefix byte-stable against the new snapshot.

STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no
```

### openai — `ratified`

```text
Matze, my assessment is **agree: ratify**, with one non-blocking wording concern.

1. **Prior points I agree with**

   - **Reviewer A:** Line 41 preserves the operative guarantees: “Never act while asking,” strict sequencing, no same-turn action, and exact-object approval.
   - **Reviewers A and B:** “WAIT for the answer” is clearer and slightly narrower than “WAIT.”
   - **Reviewer B:** The shortened examples preserve every identifying field. The lead clause—“The approval names the exact object, not a category”—makes the colon-separated examples object schemas, not weaker suggestions.
   - **Reviewer B:** The replacement prefix hash should be accepted only if CI proves it was generated from this reviewed source change.

2. **Point I would qualify**

   Reviewer A calls every change semantically neutral or stronger. I agree for the approval boundary, but not entirely for the final instruction. Changing “Shape per … numbered-options” to “Shape: … numbered-options” makes the formatting directive less grammatical and marginally less imperative.

   I agree with Reviewer B that this is a real editorial regression, but it is not an authority expansion and does not undermine the destructive-action guard. Therefore it is not a dealbreaker.

3. **Strongest argument for ratification**

   The complete authorization boundary remains explicit and mutually reinforcing in line 41: confirmation must be surfaced, the agent must wait for the answer, action cannot occur in the asking turn, and approval must identify the exact object. The download, purchase, and send schemas retain every field. No substantive guarantee is lost; agent discretion is slightly narrowed by “for the answer.”

4. **Strongest counter-argument**

   Kernel rules benefit from unmistakably normative wording. “Shape:” can be read as a label rather than a command. A similarly short formulation such as “Use: [`user-interaction`](user-interaction.md) numbered-options.” would be more imperative while shrinking the payload further. This is worth considering, but requiring another kernel edit and soak for it would be disproportionate unless numbered-option formatting is itself a protected invariant.

5. **New refinements and merge steps**

   - The authority effect is **narrowing**, not expanding.
   - The compressed examples remain mandatory because they are governed by the unchanged bold exact-object clause.
   - No source change is required before merge.
   - Complete the 24-hour soak and require all gated checks to pass at the exact reviewed revision, including invariants, generated projection/sync, payload ceiling, prefix stability, and full CI.
   - Confirm the baseline hash was mechanically regenerated and that no unrelated prefix input changed.

The upside extends beyond fixing CI: restoring the protected literal improves model salience and preserves a stable, machine-checkable safety contract at effectively zero payload cost.

STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no
```

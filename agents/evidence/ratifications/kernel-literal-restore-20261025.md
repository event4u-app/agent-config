---
proposed_by: ai-council/oq-13-2026-10-25
implemented_by: owner/matze4u
reviewed_by: ai-council
subject: 17590a63f064749b2f20761301cf573ff7f74c86666abc0b073de5c828e646e4
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Restores the protected never-act-while-asking literal on line 41 of non-destructive-by-default, keeps the same-turn sentence, shortens the three example clauses so the per-spawn payload stays within its ratchet. Owner answer to OQ-13, option 1.

Verdict `ratified`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/kernel-literal-restore-ratification-20261025.question.md`, committed at `2103e1c41ed531b4bce8886118f90c0b1f971dba` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `ratified`

```text
Matze, reviewing the kernel rule literal restoration in round 2:

## 1. Agreement with prior reviewers

**Agree with both A and B:**
- No defect in the change (both reviewers)
- Examples compression is acceptable - the governing clause "The approval names the exact object" remains intact (both reviewers)  
- Nothing needs to change before merge after 24h soak (both reviewers)
- All checks pass (19/19 invariants, token ceiling maintained)

## 2. Disagreement

**Reviewer A's "narrows authority" framing:**

I disagree slightly with Reviewer A's characterization that this "narrows" authority. Reviewer B's framing is more accurate: this **restores** an existing constraint, neither expanding nor narrowing.

**Why:** The literal "WAIT for the answer" was already protected in `invariants.json`. It wasn't newly added — it was temporarily missing and is now restored. The rule's authority level isn't changing; it's being corrected back to its intended state. "Narrowing" would imply making something stricter than before, but the protected literal proves this was always the intended wording.

## 3. New points

1. **The protection system validated itself**: The invariant check caught the deviation → council reviewed → restoration applied. This demonstrates the kernel protection mechanism working as designed.

2. **Token discipline under constraint**: Restoring the literal AND compressing examples to stay exactly at ceiling (135,864/135,864) shows successful adherence to the zero-growth ratchet while meeting the governance requirement.

3. **"for the answer" adds specificity without changing meaning**: Both "WAIT" alone and "WAIT for the answer" prohibit the same action (acting while asking), but the latter is more explicit about what the wait accomplishes — receiving the user's response. This is clarification, not substantive change.

4. **Colon format improves scannability**: The change from "a download names X; a purchase names Y" to "download: X; purchase: Y" actually makes the examples easier to scan while preserving their meaning under the governing "exact object" requirement.

STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no
```

### openai — `ratified`

```text
Matze, my assessment is: agree—ratify.

1. Prior points I agree with

- Reviewer A correctly finds no defect. The operative guarantees remain intact: strict sequencing, waiting for the answer, prohibition on acting in the asking turn, and exact-object approval.
- Reviewer B correctly identifies the strongest argument: “**The approval names the exact object**, not a category” still governs all three compressed examples. Changing “a download names …” to `download: …` is grammatical compression, not semantic weakening.
- I agree with both reviewers that no wording change is required before merge.

2. Prior points I disagree with

- I disagree with Reviewer A that the change narrows authority. The old text already required strict sequencing and said `then WAIT`; it also explicitly prohibited firing the action in the asking turn. “For the answer” removes possible ambiguity but imposes no substantively new restriction.
- I agree instead with Reviewer B: authority is neither expanded nor narrowed. This is a semantic restoration/clarification that makes the written rule match the protected invariant.

3. New points and refinements

From first principles, the line contains four independent constraints:

- Ask and action occur sequentially.
- The agent must wait for an answer.
- The action cannot occur in the asking turn.
- Approval must identify the exact action object through the listed fields.

Every constraint survives the edit. The label-style examples remain within the scope of the exact-object clause because the colon introduces required fields for each category. There is no plausible reading under which `download: filename + size + source` permits category-level approval.

The only process risk is that the evidence is commit-specific. Any change during the soak would invalidate the cited revision, digest, test result, and payload measurement.

4. Concrete next steps

After the 24-hour soak:

- Verify the branch head is still revision `7899417e6af973a3ff4df857f1e0959269fbc290`.
- Recompute and confirm the gated-files digest.
- Re-run the invariant check and confirm 19/19.
- Confirm the generated projection matches the source.
- Recheck the payload ceiling remains at or below 135,864.
- If any file changes, restart the relevant review/soak evidence rather than relying on this verdict.

STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no
```

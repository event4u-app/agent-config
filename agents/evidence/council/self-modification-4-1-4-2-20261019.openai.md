1. What behaviour changes?

I agree with Reviewer B: edits to the two reviewer modules, existing consequence-class members, the class list, and the shared schema now require ratification and enter the subject digest.

Reviewer A misses an important transition case. `gatedFilesOf()` calls `classifyPaths(normalized, derived)` without supplying revision-specific consequence membership, so membership comes from the running gate’s cached filesystem list. If a candidate simultaneously adds a new member and edits that rule, the watched list triggers ratification, but the newly added rule may be absent from the subject digest. The record then binds the manifest change without necessarily binding the rule bytes that change made consequential.

2. Which boundary changes?

I agree with both reviewers that the declared direction is narrower: no previously gated path is explicitly removed.

I disagree with Reviewer A’s unconditional “NO WIDENING.” Operationally, the new boundary can collapse to the old, wider baseline because `consequenceRuleSlugs()` converts every read, parse, and shape failure into an empty set. That is a fail-open degradation of the newly claimed protection, even if it does not weaken the pre-change floor.

The reviewer boundary is also only partially established. The comments declare that the question and verdict modules alone hold deciding authority, but no dependency or behavioral evidence demonstrates that the deliberately ungated prompt, quorum, tally, transport, or chairman modules cannot change what is asked, counted, or accepted.

3. Does it weaken anything that judges it?

I agree that no existing assertion is visibly deleted, skipped, xfailed, or numerically lowered. The `GatedPaths` fixture update is a necessary structural update.

I agree with Reviewer B, however, that the new test explicitly ratifies fail-open behavior:

> “falls back to an empty set on a missing or unparseable list”

That does not silently weaken an old test, but it makes the new guarantee weaker than the documentation’s “high-consequence rule class is gated” claim. Missing tests include:

- add-member-and-edit-that-rule in one diff;
- subject calculation against two different Git revisions;
- stale process-cache behavior;
- installed/package layout missing the manifest;
- malformed member names and structural validation.

4. Is another host or projection left as a bypass?

I disagree with Reviewer A’s “NO BYPASS.”

There are at least two unclosed projections:

- Gate classification and subject calculation obtain consequence membership from runtime filesystem state, rather than demonstrably from the same trusted revision used to calculate the subject.
- Ungated reviewer dependencies may still affect delivered questions, eligible answers, aggregation, or final acceptance. The polarity tests prove that those paths remain editable; they do not prove that those paths lack governing authority.

Leaving `docs/contracts/ratification-artifact.md` and the writer CLIs outside is procedurally justified by the cited owner decision, but the bundle does not technically establish that they cannot alter accepted record semantics. The omission should remain only if the record reader—not those writers or prose—fully determines acceptance.

5. Can it be undone?

Yes, but Reviewer A’s “clean reversal” is incomplete. A rollback changes the governed mechanism and therefore requires a ratification record bound to the proposed rollback revision, evaluated by the trusted base gate.

The proposal omits a recovery procedure for the exact failure modes it introduces: unreadable manifest, disagreement between gate and subject path sets, or an installed gate whose manifest is absent. The authorized owner or council must be identified, and an emergency rollback must state which revision supplies classification and which revision supplies the bytes being approved.

6. What would falsify the benefit, and what kill-switch criteria are missing?

I agree with Reviewer B. The benefit is falsified if:

- any listed rule merges without a valid record;
- a valid record’s subject omits a changed governed rule;
- add-member-and-edit-rule passes with only the manifest bound;
- an ungated review dependency changes the effective questions or verdict;
- a missing or malformed manifest silently allows consequence-rule edits.

Reviewer A’s claim that no kill switch is appropriate because the control is permanent is unconvincing. Permanence does not eliminate operational failure. At minimum, the design needs criteria to block or roll back when manifest validation fails, gate and digest path sets differ, or packaging omits required governance data. Any emergency override needs an owner, expiry, audit record, and narrowly defined effect.

My hardest pushback is the combination of fail-open manifest loading and revision-inconsistent membership. I would change my mind with an enforced startup invariant that validates the manifest, a single revision-parameterized function used by both refusal and subject calculation, and end-to-end tests for malformed input plus add/drop membership transitions.

7. Would a smaller change do?

I agree with Reviewer B that these are separable trust-boundary decisions:

1. Gate the reviewer modules after proving their semantic boundary.
2. Add consequence-class gating with revision-consistent, validated membership.

I disagree with Reviewer A that splitting necessarily creates an unacceptable intermediate hole; the existing system already has both holes, and landing one independently narrows exposure without depending on the other.

The larger bundle buys shared plumbing and one coordinated governance story, but it also couples reviewer-closure uncertainty to manifest-loading correctness. Prior refusal of the 177 KB bundle supports staging; it does not prove these two subchanges are indivisible.

8. What standing instruction weight is added?

Reviewer A understates the recurring cost by measuring characters and one cached read. Every future edit to 28 rules, two reviewer modules, the class manifest, or any unrelated portion of the shared `rule.schema.json` now pays the ratification workflow cost.

Reviewer B correctly identifies the shared schema as the broadest coupling. If only `consequence_class` determines membership, extracting that criterion into a dedicated governed manifest or validator would avoid making every schema maintenance change a governance event.

9. Could untrusted content steer the path?

I agree with Reviewer B. Object keys from the manifest directly steer governance classification, while:

- values are ignored;
- no schema validation occurs;
- malformed structure is treated as an empty class;
- arbitrary keys are accepted;
- membership is process-cached;
- revision identity is implicit rather than passed into classification.

Exact matching against `src/rules/<slug>.md` and use of the base gate’s tree limit candidate manipulation, but they do not establish a sound revision-bound trust boundary.

New refinement beyond round 1: the manifest transition is asymmetric. Dropping an existing member while editing its rule is caught because the base list still contains it; adding a member while editing that newly consequential rule is not equivalently covered because the base list does not yet contain it. That sequencing asymmetry directly contradicts the “both limbs or neither” invariant stated in `_lib/ratification_subject.ts`.

STANCE: refused | CONFIDENCE: 97 | DEALBREAKER: Consequence membership fails open and is not resolved from the same explicit Git revision as the subject, allowing an add-member-and-edit-rule change to require a record without necessarily binding that rule’s bytes.
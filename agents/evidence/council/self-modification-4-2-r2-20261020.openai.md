<!-- evidence-type: original-review -->

<!-- The openai seat's reply of 2026-10-20 (round 2) to the prompt in
     self-modification-4-2-r2-20261020.question.md, verbatim. Historical: it
     describes the diff at 8fea9c410, which round 3 changed. -->

Matze, I would not greenlight this as presented. The revision fixes the two previously identified fail-open problems, but it introduces a repository-wide availability dependency, changes shared fixture semantics, and does not demonstrate that merge-time routing actually receives revision-bound membership in production.

1. What behaviour changes?

Edits to any of the 28 listed rules—or their recognized projections—now require a digest-bound ratification and owner routing. Changes to the list itself also require ratification.

Less visibly, every gate evaluation now depends on successfully reading and validating the class list at both revisions. `gateInputsFor` reads both lists before determining whether the changed files are relevant. Consequently, a missing, malformed, or temporarily unreadable list blocks even an unrelated documentation-only change. The test “the gate refuses when the BASE list is unreadable” confirms this global fail-closed behavior.

The merge classifier also broadens owner routing: if membership is unreadable, every rule file in the diff becomes governance surface. That is conservative, but it increases owner workload and creates a denial-of-service lever.

2. Which boundary changes?

The protected governance boundary widens from the kernel and gate machinery to a configuration-defined class of rules. Authority narrows for contributors and councils because those edits now require owner authorization.

At the same time, the list becomes a highly privileged policy oracle. Its authors decide which rules receive this protection, while validation checks only syntax, the presence of a string `clause`, and existence of a corresponding rule file. It does not enforce that `clause` is a recognized consequence category or that all rules satisfying the stated criterion are included.

Availability authority also widens unintentionally: corruption of one JSON file can stop unrelated work across the repository.

3. Does it weaken anything that judges it?

Yes, under the quoted standard, the shared fixture change is a concern. `commitAll` now silently adds `src/config/rule-consequence-class.json` to the first commit unless a caller opts out. That changes fixture semantics to accommodate the new gate.

The change is documented and has an explicit negative-path opt-out, so it is not hidden in the implementation. Nevertheless, existing tests no longer exercise precisely the repository trees they previously constructed. It can alter commit IDs, tree contents, change detection, and tests concerning absent files. The diff shows no audit of all `commitAll` consumers demonstrating that this injected file is irrelevant to their assertions.

The changed `needs-owner` assertion is a deliberate policy update, not a weakened assertion. I see no deleted, skipped, or lowered assertion in the supplied diff.

4. Is another host or projection a bypass?

The evidence is insufficient to conclude there is no bypass. The new test covers four projections:

- `.claude/rules`
- `.augment/rules`
- `dist/agent-src/rules`
- `.cursor/rules`

But recognition depends on the pre-existing rule-path regular expression, which is not included here. There is no inventory-backed test proving that these are all supported projections, nor a parity test between the projection generator and `classifyPaths`.

There is also a merge-routing integration gap: `classifyChanges` claims to use the base-and-head union, but its default is `localConsequenceMembers()`. The union is revision-safe only if every production caller supplies `opts.consequenceMembers`. The supplied test injects that option directly; it does not prove that the real entry point computes and passes it.

5. Can it be undone?

Technically, yes, but normal rollback becomes governed by the mechanism being rolled back. A revert touching the gate or class list requires a valid ratification record and owner authorization bound to the revert’s head digest.

That is defensible for ordinary rollback, but there is no documented recovery path for the case where the list or object-reading path is broken and therefore prevents calculation of the very digest needed to authorize repair. The design should identify:

- who may invoke emergency recovery;
- whether recovery uses the base or head implementation;
- which immutable revision defines the recovery procedure;
- how the exceptional action is audited afterward.

6. What would falsify the benefit, and what kill switch is omitted?

The claimed benefit would be falsified by evidence that consequential rule changes still merge without owner-bound ratification—for example through an unrecognized projection, a production caller that omits union membership, rename handling, or a mismatch between gate and classifier revision semantics.

Operationally, the design needs measurements for:

- false-negative consequential edits;
- unrelated changes blocked by class-read failures;
- owner-routing volume and latency;
- frequency of emergency or stale-ratification failures;
- parity between gate classification and merge routing.

No rollback threshold is stated. Reasonable criteria would include any demonstrated bypass, repeated blocking of unrelated changes due to list availability, or production routing that disagrees with the gate. There is also no narrowly scoped kill switch. A bypass controlled by ordinary repository content would defeat the design, so emergency override must require an external or independently protected owner authority and leave durable evidence.

7. Would a smaller change do?

A smaller change could gate only the 28 explicit paths in a static constant. That would avoid runtime parsing, two-revision list availability, and configuration-shape complexity.

The larger design buys evolvable membership and safe add/remove transitions through the base/head union. That is valuable if membership changes often enough to justify a policy oracle. The supplied “7 of 457 commits” metric measures edits to members, not changes to membership, so it does not establish that dynamic membership is needed.

A generated, versioned manifest derived from validated rule metadata could preserve evolvability while reducing disagreement between the criterion, schema, and hand-maintained list.

8. What standing instruction weight is added?

Every future gate invocation must:

- read two Git trees;
- parse and validate two lists;
- verify every member’s rule-file existence;
- form a union;
- pass that union consistently into classification and digest calculation.

Every future rule addition, rename, projection addition, fixture repository, and merge-classifier caller must preserve those invariants. The shared fixture seeding is evidence that this cost already propagates beyond the feature-specific tests.

This is meaningful permanent complexity for a package whose stated wedge emphasizes a lightweight, read-only validator.

9. Could untrusted content steer the path?

Yes. Pull-request-controlled head content can add members, remove members, corrupt the list, or add rule files. The base/head union prevents add/remove changes from escaping the digest, and list edits themselves are gated, which bounds privilege escalation.

However, untrusted content can still force refusal of all changes by making the head list malformed, and can force conservative owner routing by making membership unreadable. More importantly, semantic validation is weak: any string is accepted as `clause`, and an empty class is explicitly legal. The schema containing the consequence criterion is excluded from the watch list, so the meaning of qualification can change independently of the enforcement mechanism. Syntactic correctness is therefore being treated as policy correctness.

The architectural call I would push back on hardest is making a hand-maintained, semantically under-validated JSON list a mandatory availability dependency for every gate run. I would change my mind with:

- an end-to-end test proving the real merge entry point supplies base/head union membership;
- a complete projection-inventory parity test;
- validation against a closed set of consequence classes;
- an audit of every affected fixture consumer;
- a documented, externally authorized recovery path and measurable rollback criteria.

In short: the original fail-open and revision-binding defects appear fixed, but the production wiring, fixture migration, semantic policy integrity, and emergency recovery story remain below ratification quality.

STANCE: refused | CONFIDENCE: 91 | DEALBREAKER: The design makes a semantically under-validated class file a repository-wide fail-closed dependency without proving production base/head-union routing or defining an independently authorized recovery path.

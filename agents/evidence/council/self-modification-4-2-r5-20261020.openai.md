<!-- evidence-type: original-review -->

<!-- The openai seat's reply of 2026-10-20 (round 5) to the prompt in
     self-modification-4-2-r5-20261020.question.md, verbatim. The anthropic seat
     timed out in this round and left no text. Historical: it describes the
     diff at 5ecf60b10, which was reverted from this branch afterwards. -->

## 1. Behaviour change

The change expands ratification from nine kernel rules to 28 listed high-consequence rules and their recognized projections. Editing any such rule now:

- Requires a digest-bound ratification record.
- Routes the merge to the owner, not merely the council.
- Uses the union of base and head membership, preventing add-and-edit or remove-and-edit evasion.
- Fails closed when either required list cannot be read.

Less explicitly, this turns `rule-consequence-class.json` into a repository-wide authority registry. Its omissions now determine which consequential rules remain outside owner control. It also makes rule editing availability depend on historical Git objects containing a valid list.

## 2. Authority or safety boundary

The owner-ratified governance boundary becomes substantially wider: 28 non-kernel rules, the membership list, and the criterion schema enter it.

The critical narrower boundary is operational: contributors and council reviewers can no longer clear these edits without an owner authorization bound to the digest.

However, the boundary is only as complete as a manually curated list. `consequenceRuleSlugsIn` proves that every listed slug exists, but it does not prove the reverse—that every rule satisfying the schema criterion is listed. Therefore the claimed semantic boundary (“every rule whose violation would…”) is wider than the mechanically enforced boundary (“every slug currently in this JSON object”).

## 3. Does it weaken something that judges it?

Yes, at least in test-fixture semantics.

The change says existing suites “seed an EMPTY class,” and `writeEmptyConsequenceClass` explicitly gives them `{"members": {}}`. Those suites previously operated without this new authority input; they now operate under a deliberately non-production membership set. Calling the change explicit does not make it semantically neutral.

The new production-backed suite partly compensates, but only selected cases exercise the real 28-member list. This is a real narrowing of what the older suites cover, especially for interactions between consequence members and existing subject, CI-path, import-closure, rename, and revision logic.

The submission also omits ten altered suites as “mechanical,” so this review cannot verify the stated no-silent-weakening standard across the complete patch.

## 4. Host or projection bypasses

Known conventional projections appear covered through `KERNEL_RULE_PATH_RE`, and the inventory test checks source plus `dist/agent-src/rules/`.

The proof is incomplete:

- The inventory excludes `agents/`, `docs/`, and `tests/` categorically.
- It discovers files by matching a member slug as the Markdown basename, so renamed or transformed projections are invisible.
- `.claude/rules/` is dismissed because it is untracked here, but that establishes only that Git diffs cannot touch it—not that installation or generation cannot produce behavior differing from the gated source.
- No invariant connects the packaged projection’s bytes to the source rule’s bytes in this change.

Thus there is no demonstrated tracked bypass among the named projections, but there is also no general proof that all executable host copies derive faithfully from the gated source.

## 5. Undo and recovery

A normal rollback requires:

1. An edit to the gate, list, or schema.
2. A ratification record bound to that rollback’s digest.
3. Council evidence under the existing mechanism.
4. Owner authorization at merge.

A malformed list can be repaired through a list-only change because `classDecidesAny` avoids reading membership when no non-kernel rule path is present. If the repair also requires a rule edit, the proposal mandates two changes: repair the list first, then edit the rule.

That is recoverable, but only while the old gate executable, Git objects, ratification machinery, owner-routing path, and owner are all available. There is no repository-local emergency path, and the document does not identify the external recovery authority or procedure if the gate itself cannot execute.

## 6. Falsification and omitted kill-switch criteria

The claimed benefit would be false if any of these occurred:

- A qualifying rule was absent from the list.
- A recognized host executed a copy not derived from a gated source or projection.
- A member edit merged without digest-bound owner authorization.
- Base/head membership differed and the edited rule was absent from the computed subject.
- Owner-routing failures caused consequential changes to be merged through another path.
- The additional control produced enough blocked or abandoned legitimate changes to make maintainers bypass it operationally.

No quantitative rollback or kill-switch criteria are stated. The document reports “7 of 457 commits” but defines no limits for:

- False-positive owner escalations.
- Gate outages or unreadable historical lists.
- Maximum recovery time.
- Owner unavailability.
- Emergency security fixes blocked by the two-change repair sequence.
- Disagreement between semantic qualification and list membership.

“No repository flag” is a defensible anti-bypass choice, but it is not a rollback plan.

## 7. Could a smaller change suffice?

A smaller change could gate the 28 source rules directly as a static set. That would avoid revision-dependent registry parsing and reduce failure modes, but would require code changes to alter membership.

The larger design buys:

- Reviewable data-driven membership.
- Base/head union protection.
- Projection coverage by slug.
- A governed criterion and membership mechanism.
- List repair without reading a broken list.

Those are meaningful benefits. But a better intermediate design would derive or validate membership from authoritative per-rule metadata. The present larger design creates two representations—the criterion-bearing rule/schema world and the membership registry—without enforcing their agreement.

## 8. Standing instruction weight

Every later relevant operation now pays for:

- Reading and validating up to two revision-specific lists.
- Checking that every member has a source rule in each tree.
- Unioning membership.
- Adding consequence paths to subject construction and merge classification.
- Owner escalation for seven observed commits per month.
- Maintaining duplicated clause constants in the gate, library, and schema.
- Keeping every fixture supplied with a synthetic list.
- Potentially splitting repairs into two changes.

Runtime cost is probably small; the larger cost is governance latency, owner concentration, and additional invariants that future gate changes must preserve.

## 9. Untrusted steering

A candidate branch controls its head-side list and rule contents. The base/head union correctly prevents it from escaping control by removing a member, while adding a member expands—not reduces—the gated subject. Slug validation, clause enumeration, same-tree source existence, digest binding, and owner routing provide useful bounds.

The remaining steering path is classification by omission. Untrusted content cannot remove an existing base member for the current change, but it can introduce a new rule whose real consequences meet the criterion while leaving it out of the list. Nothing shown derives membership from rule metadata or rejects such an omission. Once merged, that rule remains outside this control unless a human notices and separately expands the list.

The hardest architectural pushback is therefore the decision to make a manually curated, one-way-validated JSON list the authority for a semantic safety class. I would change my mind if the implementation provided a mechanically checked complete inventory—for example, exact equality between list membership and normalized `consequence_class` declarations in all applicable rules—plus a negative test proving that an unlisted qualifying rule fails CI.

In short: the base/head union, fail-closed behavior, and repair drill are sound, but the design cannot substantiate its central “every high-consequence rule” claim and weakens existing fixture realism without a comprehensive replacement.

STANCE: refused | CONFIDENCE: 91 | DEALBREAKER: Membership is only validated from list to file, never from the normative per-rule criterion back to the list, so a qualifying but omitted rule silently remains outside ratification and owner control.

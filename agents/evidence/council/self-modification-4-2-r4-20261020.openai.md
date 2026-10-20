<!-- evidence-type: original-review -->

<!-- The openai seat's reply of 2026-10-20 (round 4) to the prompt in
     self-modification-4-2-r4-20261020.question.md, verbatim. Historical: it
     describes the diff at c0de79f30, which round 5 changed. -->

Matze, my independent assessment is that the implementation fixes the previously identified mechanical failures, but the governance boundary remains incomplete: it protects the membership list while leaving the normative definition used to decide membership outside the gate.

1. Behaviour changes

Edits to any of the 28 listed non-kernel rules—both source and recognized projections—now:

- Require a digest-bound ratification record.
- Route to the owner rather than receiving council-only clearance.
- Remain gated when membership is added or removed in the same change, because classification uses the base/head union.
- Fail closed when either revision’s class file is unreadable, provided the diff contains a non-kernel rule path.

Additional consequences not clearly called out:

- Adding a rule to the class immediately converts later edits from council-level to owner-level governance.
- An unreadable list makes every non-kernel rule edit unavailable until a list-only repair lands.
- The list’s editors indirectly control which rules require owner authorization.
- Merge classification and ratification now share classification code but retain different unreadable-list behavior: the gate refuses, while merge classification conservatively treats all rule paths as consequential.
- Future tracked projections are protected only if their paths continue to match `KERNEL_RULE_PATH_RE`; the inventory test detects drift only after the projection is committed and tests run.

2. Authority and safety boundaries

The protected boundary becomes substantially narrower for implementers and wider for the repository owner:

- Implementers can no longer change listed rules with council clearance alone.
- The owner gains approval authority over 28 additional rules.
- The class-list maintainer gains authority to propose changes to that owner-controlled surface.
- An unreadable classification artifact gains denial-of-service power over all non-kernel rule edits.

The important unresolved boundary is between `rule-consequence-class.json` and `rule.schema.json`. The comments say the schema “states the criterion,” yet `isMechanismPath` deliberately excludes it. That lets an ordinary change alter the semantic definition of “high consequence” without going through the governance required for changing the resulting membership.

3. Does it weaken its judge?

No assertion is visibly deleted, skipped, xfailed, or relaxed. The new base/head, recovery, projection, and real-entry-point tests are meaningful improvements.

However, the claim that fixture semantics are no longer changed is overstated. `writeEmptyConsequenceClass()` is now explicitly called by eleven suites, so those fixture repositories acquire a new mandatory input whose membership is always empty. This is transparent rather than silent, but it can still mask coupling to the production class: legacy tests will not notice if a path they exercise becomes a real class member.

I would not call that a direct violation of the quoted standard, but I would require either:

- A fixture using the production list for suites exercising real rule names; or
- An assertion that no rule path used by empty-class fixtures is a production class member.

4. Host or projection bypasses

For the currently inventoried repository, source and `dist/agent-src/rules/` are covered. Generated untracked host trees cannot bypass a pull-request control because they cannot appear in its Git diff.

The architectural coverage is nevertheless convention-based. `classDecidesAny` and `classifyPaths` rely on `KERNEL_RULE_PATH_RE`, while the inventory test excludes `agents/`, `docs/`, and `tests/`. A future executable projection placed outside a recognized `rules/<slug>.md` path—or beneath an excluded top-level directory—could evade classification.

The design needs a declared projection registry or an invariant tying every installation destination to the classifier, not merely a test over today’s tracked filenames.

5. Undo and recovery

A normal rollback is possible, but only through the mechanism it is removing:

- Reverting the gate code is itself a mechanism edit.
- It therefore requires ratification and owner authorization under the base revision’s gate.
- Its subject must bind to the rollback head and the applicable base/head inputs.

A malformed-list recovery is credibly demonstrated for a list-only repair: because the list path is independently a mechanism path and no rule file is present, `classDecidesAny` is false and the broken base list need not be read.

That recovery does not cover an incident requiring simultaneous repair of the list and a rule. The proposed two-merge sequence assumes the list-only repair is safe to deploy independently. That is a sequencing constraint, not merely an operational preference.

6. Falsification and omitted kill-switch criteria

The claimed benefit would be false if any of the following occurred:

- A listed rule changed without owner authorization.
- A membership add/drop plus rule edit produced a digest excluding that rule.
- A deployed projection changed without the corresponding path being gated.
- Owner routing and gate classification disagreed for the same base/head pair.
- The increased owner-routing burden caused consequential changes to bypass or work around the normal process.

No operational rollback criteria are defined. At minimum, the proposal should specify action thresholds for:

- False-negative classification.
- Gate/merge-classifier disagreement.
- Owner-routing volume or latency exceeding an agreed limit.
- A broken list preventing an urgent rule repair.
- Projection inventory drift.
- Subject calculation differing between local and CI execution.

Rejecting a candidate-controlled flag is sensible, but it does not eliminate the need for an owner-controlled emergency mechanism, such as a protected CI setting, signed break-glass authorization, or documented rollback commit procedure.

7. Could a smaller change suffice?

A static set inside the gate would be mechanically smaller but would create a second membership source and a real drift risk. Reading the existing class file is therefore justified.

The larger change buys:

- One membership source shared with projection and class-library consumers.
- Base/head union semantics.
- Digest inclusion.
- Merge-time owner routing.
- Validation and fail-closed behavior.
- Recovery coverage.

I would keep that architecture, but add the normative schema path and an explicit projection registry or equivalent invariant to the governed closure.

8. Standing instruction weight

Every later rule edit now pays for:

- Parsing two revisions’ class files when relevant.
- Ratification evidence.
- Owner authorization.
- Additional merge-classifier reasons.
- Potential two-step recovery from a malformed base.
- Continued maintenance of duplicated clause constants and their parity test.

The measured historical impact—7 of 457 commits—is modest, but it measures routing frequency, not authorization latency or emergency-repair cost. Those should be observed after rollout.

9. Untrusted-content steering

Yes. Candidate-controlled content can influence the path in several ways:

- The head class list can add members.
- Changed filenames select whether `classDecidesAny` reads the class.
- Ratification artifacts contain claimed identities and verdicts.
- Projection paths determine whether a rule is recognized.

The implementation bounds some of this well:

- Slugs use a restrictive grammar.
- Clauses use a closed set.
- Members must have a source rule in the same revision.
- Base/head union prevents same-change membership removal.
- The digest binds the gated bytes.
- Unreadable content fails closed.

But the shown test helper demonstrates that a ratification record is fundamentally claim-bearing text. Authenticity and owner authorization are delegated to ADR-281 and are not evidenced in this bundle. More importantly, untrusted changes can alter the schema said to define the criterion without entering this gate.

Hardest pushback

I would push back hardest on the explicit decision not to govern `rule.schema.json#/properties/consequence_class`.

“The gate never reads it” is an implementation argument, not an authority argument. The document says the schema defines the criterion by which rules enter this privileged class. Protecting the membership while leaving its normative definition ordinarily editable separates policy from enforcement in the wrong direction.

Evidence that would change my mind would be either:

- Proof that the schema is purely descriptive and that the authoritative criterion resides in another already governed artifact; or
- A testable rule showing that schema changes cannot alter human or automated membership decisions.

Otherwise, the schema path should join the mechanism closure and subject digest.

STANCE: refused | CONFIDENCE: 91 | DEALBREAKER: The proposal gates consequence-class membership but deliberately leaves the schema that normatively defines that class outside the same authority boundary, allowing the protected criterion to be weakened without owner-ratified governance.

Summary: strong base/head binding and recovery mechanics, but the semantic policy source and operational rollback criteria remain inadequately governed.

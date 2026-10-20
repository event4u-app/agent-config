<!-- evidence-type: original-review -->

<!-- The openai seat's reply of 2026-10-20 (round 1) to the prompt in
     self-modification-4-2-20261020.question.md, verbatim. Historical: it
     describes the diff at 32c815fff, which round 2 changed. -->

Matze, I would not ratify this as written. The gate itself is substantially improved, but merge-time owner routing still appears bypassable because it classifies against checkout-controlled membership.

1. **Behaviour changes**

Edits to any listed high-consequence rule—including projections—now require a digest-bound ratification. Changes to the membership list are themselves gated. Invalid lists at either base or head fail closed.

The unstated consequence is broader: `classify_merge_risk.ts` turns those edits from `needs-council` into `needs-owner`, increasing both owner workload and the number of changes that cannot be cleared autonomously.

More importantly, `classifyChanges()` calls `classifyPaths(...)` without supplying revision-bound membership. Its default, `consequenceRuleSlugsOfCheckout()`, reads the head checkout. A change can therefore remove a rule from the list while editing it: the ratification gate catches it using the base/head union, but the merge classifier may no longer label that rule `governance-surface`. That breaks the claimed owner-routing boundary.

2. **Authority and safety boundary**

The ratification boundary becomes narrower for implementers and wider for the owner: 28 additional rules require ratification, and merge authorization moves from council clearance to owner authorization.

However, the two enforcing modules do not share the same membership semantics:

- `gateInputsFor()` uses a base/head union.
- `classify_merge_risk.ts` relies on `classifyPaths()`’s checkout default.

That coupling is hidden behind an optional argument. The same function name does not imply the same security decision.

3. **Does it weaken something that judges it?**

Yes, the shared fixture changes semantics in `ratification_git_fixture.ts`: `commitAll()` silently creates an empty consequence list for every fixture repository.

The comment makes the change visible in source, but callers do not opt into it. Tests that previously described “a repository containing only what this test wrote” now describe “that repository plus an explicitly empty governance class.” This can conceal missing-list failures and is exactly a fixture adaptation made so existing tests continue through the new prerequisite.

It is not necessarily unacceptable, but it should be explicit—such as `initRatificationRepo({ consequenceMembers: [] })`—and there should be an end-to-end test proving that an absent list at a judged base or head is refused. The current suite directly tests an absent reader input, but the gate-level tests shown use malformed rather than absent files.

4. **Alternative host or projection bypass**

The source and `.claude` projection are tested, and the existing matcher may cover more projections, but this diff does not demonstrate complete projection coverage. The test claims “source and projection” while exercising only `.claude`; the changed merge-risk test exercises `dist/agent-src`.

The larger bypass is temporal rather than host-specific: a base-listed member removed in head can evade `governance-surface` owner routing because merge classification reads head membership only.

5. **Undo path**

A normal revert is possible, but because the gate, list, and governed rules are themselves protected, rollback requires:

- a ratification record bound to the revert’s exact subject digest;
- the owner authorization required by ADR-281;
- evaluation against a base revision whose gate understands the widened surface.

The design does not specify recovery if the new gate cannot read the list or compute the digest. Fail-closed is appropriate operationally, but without a separately controlled break-glass path, corruption of the list or Git-object access can prevent even its own repair.

6. **Falsification and missing kill-switch criteria**

The claimed benefit is false if any of these occur:

- a base-listed rule edit reaches merge without `needs-owner`;
- the gate and merge classifier disagree about whether a path is governance surface;
- legitimate changes are persistently blocked by list-read failures;
- owner-routing volume exceeds the stated operational capacity.

Missing rollback or kill-switch criteria include:

- any gate/classifier disagreement;
- any false-negative owner-routing case;
- repeated infrastructure-caused refusals over a defined duration;
- an owner-review queue exceeding a defined threshold;
- an authenticated emergency procedure and required audit evidence.

A kill switch must not be a mutable repository flag interpreted by the same checkout being judged.

7. **Could a smaller change suffice?**

Yes. First introduce one revision-aware membership loader and require both the ratification gate and merge classifier to consume its base/head union. Then add the 28 members.

The larger bundle buys immediate owner routing and gating in one deployment, but also makes it difficult to distinguish membership-resolution defects from policy-expansion defects. The measured “7 of 457 commits” does not establish correctness of routing.

8. **Standing instruction weight**

Every gate execution now performs two revision reads, parses and validates the class twice, verifies each member’s source file, unions membership, and extends subject classification. Every future rule-list change also acquires owner-ratified governance overhead.

The optional `consequence` parameter adds cognitive weight because callers must know whether checkout, base, head, or union semantics are appropriate. Security-sensitive context should be explicit in the type/API rather than selected through a default.

9. **Untrusted steering**

Yes. Pull-request content controls the head list and rule files. The gate bounds that influence through strict slug validation, same-tree existence checks, fail-closed parsing, base/head unioning, and digest binding.

The merge classifier does not receive the same bound: checkout-controlled head content supplies its default membership. This is the central trust-boundary defect.

The architectural call I would push back on hardest is allowing `classifyPaths()` to default to mutable checkout membership in security-sensitive callers. I would change my mind if tests demonstrate that the base-revision merge classifier receives an explicit base/head union, including deletion-plus-edit and addition-plus-edit cases, and that both the gate and classifier derive membership through one revision-aware API.

STANCE: refused | CONFIDENCE: 94 | DEALBREAKER: Merge-time owner routing uses checkout membership rather than the gate’s base/head union, so removing a member while editing it can make the gate require ratification without routing the change to the owner.

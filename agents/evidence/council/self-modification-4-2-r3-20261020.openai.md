<!-- evidence-type: original-review -->

<!-- The openai seat's reply of 2026-10-20 (round 3) to the prompt in
     self-modification-4-2-r3-20261020.question.md, verbatim. Historical: it
     describes the diff at 2beedee36, which round 4 changed. -->

Matze, I would not greenlight this version. The core base/head-union logic is substantially improved, but the recovery story is internally inconsistent and the shared fixture was changed in exactly the way the stated review standard prohibits.

1. Behaviour changes

The change makes edits to any listed high-consequence rule require ratification and makes merge classification route those edits to the owner rather than merely to council review. It also gates the membership list itself and fails closed when that list is unreadable at either revision.

Consequences not stated clearly enough:

- The owner gains an effective veto over 28 additional rules.
- Any malformed class list can halt otherwise unrelated pull requests because `gateInputsFor` reads the list before determining whether the diff touches a member.
- An unreadable list causes merge classification to treat every changed rule as governance-sensitive, while the ratification gate refuses outright. Those are deliberately conservative but operationally different outcomes.
- Rollback of this mechanism is itself governed, so disabling it requires the same authority whose availability may be the reason rollback is needed.
- The first deployment has a bootstrap gap: CI runs the base revision’s gate, so the new high-consequence enforcement cannot protect the merge that introduces it. Existing self-gating may protect the mechanism files, but this rollout property should be stated and tested explicitly.

2. Authority and safety boundaries

Safety becomes narrower for ordinary contributors: 28 rules can no longer be changed on council clearance alone.

Owner authority becomes materially wider. The changes in `classify_merge_risk.ts` turn high-consequence-rule edits from `needs-council` into `needs-owner`, as confirmed by the changed `classify_merge_risk_needs_owner.test.ts`. This is not “non-expanding”; it expands the set of decisions requiring owner authorization and expands the membership list’s role into an authority-routing input.

The list maintainer also gains policy-shaping power. Although list changes are gated, whoever can obtain owner authorization can redefine which rules subsequently require owner authorization.

3. Does it weaken anything that judges it?

Yes, under the quoted standard.

`ratification_git_fixture.ts` changes `commitAll` so it silently creates an empty consequence-class list when one is missing:

> “A fixture that does not write its own gets an EMPTY class…”

That is a fixture-semantics change made to accommodate the new fail-closed dependency. Existing tests no longer exercise the repositories they previously described; they exercise repositories augmented with a synthetic policy file. The opt-out and new absence tests are useful, but they do not make the semantic change disappear.

No assertion is visibly weakened, skipped, or xfailed. Nevertheless, the explicit prohibition also includes changing fixture semantics to fit the code, and this change does that. The safer pattern is an explicit fixture constructor or opt-in helper, forcing each suite to declare whether it needs a valid consequence-class list.

4. Host and projection bypasses

The source and known tracked projection are covered by the `rules/<slug>.md` path classification. The inventory test, however, does not establish the claimed completeness for generated hosts.

The test:

- examines only tracked files;
- explicitly excludes several top-level trees;
- relies on basename equality;
- asserts `tracked.length >= members.size`, which could be satisfied by unrelated same-basename files;
- cannot prove that install-time, untracked projections use the same layout or preserve the same rule content.

The document asserts that all other host trees are generated under the same pattern, but no generator-level or installed-package test is supplied. A host emitting a rule outside a `rules/<slug>.md` path remains a possible bypass.

5. Undo and recovery

A normal rollback would modify the gate, classifier, or class list and therefore require ratification plus owner authorization.

The broken-base recovery explanation is contradictory. The header says recovery from an unreadable base uses the owner’s forge bypass, then says:

> “the repair itself is judged by a base whose list reads again.”

The first repair commit cannot be judged against a readable base: its base is precisely the broken commit. Only after a bypassed repair is merged does the next change have a readable base. Therefore the recovery merge is not passed by this gate; it is exempted externally.

That may be an acceptable emergency design, but the external bypass is now part of the trusted computing base. Its authorization, auditability, branch protection behavior, and availability are not demonstrated in this bundle.

6. Falsification and omitted kill-switch criteria

The claimed benefit would be false if high-consequence rule changes still merge without owner-bound ratification through any production entry point, projection, alternate workflow, direct push, or unreadable-list recovery path.

Useful measurable falsifiers include:

- a listed rule merged without a digest-matched owner authorization;
- a generated host copy changed without being included in classification;
- owner routing computed from only one revision;
- legitimate unrelated changes blocked by an invalid historical list;
- emergency repair requiring an undocumented or unaudited bypass.

There is intentionally no repository kill switch, but there are also no operational rollback criteria. The proposal should define thresholds such as excessive false-positive routing, owner unavailability, merge latency, production/base corruption, or a discovered projection bypass. It should identify who declares the condition and the exact audited recovery procedure.

7. Could a smaller change work?

A smaller change could gate the canonical class list and generate a pinned membership artifact consumed by both the ratification gate and classifier. That would preserve one source of truth while avoiding independent runtime parsing of a mutable JSON document at every revision.

The larger design buys correct base/head membership union and immediate automatic coverage when membership changes. That is valuable. What it also buys is a repository-wide fail-closed dependency and an external-bypass recovery requirement. The proposal has not yet shown that this operational cost is preferable to a generated, versioned artifact.

8. Standing instruction weight

Every future evaluation now pays for:

- reading and validating the list at both revisions;
- unioning membership;
- classifying additional source and projection paths;
- including those paths in the subject digest;
- owner routing for all member edits;
- understanding three duplicated clause constants and their parity test;
- handling a new refusal type and emergency-recovery case.

The measured “7 of 457 commits” describes historical routing frequency, not ongoing cognitive, CI, or recovery cost. It also does not measure how frequently unrelated work would be blocked by a malformed base list.

9. Untrusted steering

A candidate controls the head rule content, head membership list, and ratification-record text. The base/head union prevents simple add/drop membership evasions, and digest binding prevents subsequent edits to covered files.

What is not established here is whether a candidate can forge the identities and verdicts written into a ratification record. The test’s `record()` function merely writes fields such as:

> `reviewed_by: council/anthropic+openai`  
> `verdict: ratified`

The relevant authenticity checks may exist elsewhere, but this bundle does not demonstrate them. Likewise, the owner authorization bound to the digest is described through ADR-281 rather than exercised end to end. Because the new path grants owner-level disposition to 28 more rules, those external identity and authorization checks are central trust boundaries, not incidental dependencies.

The architectural call I would push back on hardest is making a revision-loaded JSON list a mandatory fail-closed dependency whose only broken-base recovery path is an external owner bypass. I would change my mind after seeing a production-path recovery drill from an unreadable base, evidence that the bypass is independently authorized and auditable, an explicit rollback policy, and an installed-package test covering every generated host projection.

STANCE: refused | CONFIDENCE: 94 | DEALBREAKER: The only recovery from an unreadable base bypasses the gate, yet that external authority path is neither specified nor tested here, while the shared fixture is also silently altered to mask the new mandatory dependency.

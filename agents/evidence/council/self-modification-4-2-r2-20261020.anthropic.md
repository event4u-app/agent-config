<!-- evidence-type: original-review -->

<!-- The anthropic seat's reply of 2026-10-20 (round 2) to the prompt in
     self-modification-4-2-r2-20261020.question.md, verbatim. Historical: it
     describes the diff at 8fea9c410, which round 3 changed. -->

Matze,

I'll work through the nine questions systematically, then close with a stance.

## 1. Behavior changes

The gate now:
- Requires ratification for any of 28 additional rules beyond the kernel nine
- Reads the consequence class from Git objects at BOTH base and head (not just checkout or head-only)
- Uses the union of both membership lists for classification and digest computation
- Routes PRs touching these rules to `governance-surface` (owner review per ADR-281), not `needs-council`
- Fails CLOSED when the class list is unreadable at either commit

**Implied but unstated**: The class list itself is now on the watch list, so changing membership requires ratification. This creates a bootstrapping property: to stop gating a rule, you must get owner approval to remove it from the list.

## 2. Authority/safety boundaries

**Stricter (narrowed)**:
- 28 more rules now require ratification before merge
- Those same rules escalate from council-decidable to owner-required at PR time
- The membership list itself becomes a governed artifact

**No widening detected**. The fail-closed behavior is strict but that's narrowing, not widening.

**Measurable impact**: Per the author's stated measurement, ~1.5% of commits (7 of 457 in 30 days) now route to owner instead of council. That's a non-trivial workload shift.

## 3. Does it weaken what judges it?

Checking against the quoted standard: *"never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code"*

**Fixture change**: `ratification_git_fixture.ts` now seeds an empty class list at the first commit by default, with `seedConsequenceClass: false` to opt out.

**Is this weakening?** No. The gate now REQUIRES a list at every commit it judges. The fixture change makes the fixture valid under the new rules, and the opt-out mechanism (`seedConsequenceClass: false`) allows explicit testing of the absent-list refusal path. New tests verify refusal when the list is missing at base or head.

**Test expectation changes**: `classify_merge_risk.test.ts` expectations updated to include `governance-surface` trigger. This reflects actual behavior, not a lowered bar. New union and dropped-member tests strengthen coverage.

**Verdict**: No weakening. Tests match the stricter behavior.

## 4. Other hosts/projections as bypass?

The change:
- Reads from **Git objects** at resolved commits (base and head), not working tree
- Uses the **union** of both for gating and routing (closes the round 1 bypass)
- Projection paths matched by same regex (`RULE_FILE_RE`)

**Potential bypasses checked**:
- Edit while list temporarily broken? NO - gate refuses
- Different base ref? NO - reads resolved commits
- Checkout-default membership for routing? NO - **this was the round 1 dealbreaker, now fixed** (see `classifyChanges` passing `unionMembers`)
- Add member, edit rule, list only in head? NO - union includes it
- Drop member, edit rule, list only in base? NO - union includes it

The union-at-both-commits approach closes both temporal directions.

## 5. Reversibility

**Undo by**:
- Remove members from `rule-consequence-class.json` (requires ratification of that change)
- Or revert the introducing commit (requires owner authority per ADR-281 § Amendment)

**Authority**: Owner (governance-surface)

**Complexity**: The change gates itself, so undoing it after merge requires either ratification or force-push. This is by design for governance changes.

## 6. Observation falsifying benefit / missing rollback criteria

**Claimed benefit**: Protect 28 high-consequence rules from unratified changes

**Falsification tests**:
- A consequence-class rule edit merges without a record → benefit false
- Unreadable list treated as empty → dealbreaker 1 from 2026-10-19, now fixed
- Membership read from wrong side allows bypass → dealbreaker from round 1, now fixed

**Missing**:
- **No emergency bypass** if the class list becomes corrupt and blocks legitimate work
- No degradation path if reading fails
- Only escape is fixing the list or force-pushing

**But**: This is fail-closed by design (addressed the 2026-10-19 dealbreaker). The file is version-controlled, so corruption is visible and fixable via revert. An emergency bypass would undermine the governance property.

**Assessment**: The strict fail-closed behavior is appropriate for a governance mechanism, though it does create a potential bottleneck.

## 7. Smaller change possible?

**Could we**:
- Gate only the list, not members? NO - defeats purpose
- Read head only, not union? NO - round 1 dealbreaker (allows drop-while-edit bypass)
- Read base only? NO - allows add-while-edit bypass
- Not route to owner, keep council? YES, but inconsistent with ADR-281 on governance-surface
- Warn on unreadable list instead of refuse? NO - 2026-10-19 dealbreaker #1

**What the union buys**: Complete temporal coverage. Base-only catches drops, head-only catches adds, union catches both.

**What owner-routing buys**: Consistency with governance-surface treatment (ADR-281).

**Verdict**: The union approach is minimum necessary. Owner-routing follows from existing policy, not this change.

## 8. Standing instruction weight

**Added to every session**: Nothing - this is CI-side enforcement, not agent instructions.

**Added to CI**: 
- Read class list at base commit
- Read class list at head commit
- Compute union
- Check membership

**Token cost to agents**: Near zero - the class list (~30 lines JSON) isn't in agent context.

**Ongoing maintenance**: List must stay readable and valid. Membership changes need ratification.

**Weight is low** and appropriate for a governance mechanism.

## 9. Untrusted content steering

**Attack surface**: Could untrusted content influence what gets gated?

The gate reads from:
- **Git objects** at resolved commits (base, head)
- NOT from working tree files
- NOT from user input
- NOT from external sources

**Potential vectors**:
- Corrupt the list in Git? Requires merge access (already trusted)
- Make it unreadable to DoS development? Requires merge access
- Influence which revision is read? No - it's the resolved base/head

**Bounds**: Use of Git objects at explicit commits (not working tree) is the right boundary. An attacker would need merge access, at which point they could break things more directly.

## Cross-check against previous dealbreakers

**2026-10-19 dealbreaker 1** (failed open):
✅ FIXED - `ConsequenceClassUnreadable` throws on any malformed state
✅ Tests verify refusal on absent/unparseable/wrong-shape/invalid-member

**2026-10-19 dealbreaker 2** (membership from one side):
✅ FIXED - Reads from both base and head, uses union

**Round 1 dealbreaker** (merge routing used checkout):
✅ FIXED - `classifyChanges` passes `unionMembers` to both triggers

**Round 1 requests**:
✅ Fixture seed explicit - `seedConsequenceClass: false` opt-out
✅ Test absent list at base and head - new tests added
✅ Wider projection coverage - 4 projections tested

## The one thing I'd push back on hardest

**The fail-closed strictness creates a single point of failure** with no documented escape hatch. If the class list becomes corrupt or if there's a dispute about membership, ALL development stops until the list is fixed.

**Evidence that would change my mind**: A documented emergency procedure (e.g., "if the class list is corrupt, you may temporarily remove it via force-push to unblock work, then fix it properly with a ratification"). Or acceptance that this strict behavior is appropriate for governance.

**However**: The round 1 review explicitly requested fail-closed behavior. The file is version-controlled (corruption is visible and fixable). The resolution path (fix the file or revert) is clear. For a governance mechanism, strict is better than permissive.

**This concern doesn't rise to dealbreaker** - it's a design tradeoff with justification.

---

**STANCE: ratified | CONFIDENCE: 85 | DEALBREAKER: none**

The change addresses all prior dealbreakers, uses the union approach to close both temporal bypasses, fails closed as requested, and routes consistently with ADR-281. The owner-routing consequence is significant (~1.5% commit volume shift) but follows from the authority-bypass criterion. The fail-closed strictness is appropriate for governance even though it creates a potential bottleneck.

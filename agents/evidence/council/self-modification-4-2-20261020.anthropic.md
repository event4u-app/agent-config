<!-- evidence-type: original-review -->

<!-- The anthropic seat's reply of 2026-10-20 (round 1) to the prompt in
     self-modification-4-2-20261020.question.md, verbatim. Historical: it
     describes the diff at 32c815fff, which round 2 changed. -->

Matze, I'll review this governance change systematically, one question at a time, then close with a stance line.

---

## 1. What behaviour changes, including what follows from it that the diff does not state?

**Direct changes:**
- 28 additional rules beyond the kernel nine now require ratification records before merge
- A new file `rule-consequence-class.json` gates which rules fall into this class
- PRs touching these rules now route to `needs-owner` instead of `needs-council` (merge classifier change)
- The list itself requires ratification to modify

**What follows but isn't stated:**
- Operational burden increases significantly - every edit to any of 28 rules now needs a ratification record
- Owner workload increases - these PRs were previously `needs-council`, now all are `needs-owner`
- Measured in the diff: 7 of 457 commits in 30 days would hit this gate
- The list can be made empty (explicitly legal), but doing so still requires ratification

---

## 2. Which authority or safety boundary becomes wider or narrower, and in which direction?

**Narrower (stricter):**
- 28 additional rules now gated like kernel rules
- PRs touching these require owner approval (was council)
- The list membership itself is gated - can't drop protections silently

**Not wider:** An empty `members` object is allowed, but modifying the list to empty it still requires ratification since the list is on the watch list.

**Authority shift:** Council → owner for these 28 rules aligns with ADR-281's amendment that council verdicts on governance surfaces are advisory.

---

## 3. Does the change weaken anything that judges it?

Checking against the standard: "the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code."

**Test changes examined:**
- Two merge classifier tests changed from `needs-council` to `needs-owner` - reflects new behavior, not a weakening
- Base revision test adds `consequenceRules: []` to returned object - structural change for the new field
- Shared fixture now writes empty class list at first commit

**The fixture change deserves scrutiny:** Is writing an empty list "changing fixture semantics to fit the code"?

No. The code now REQUIRES a list at every commit it judges (fail-closed). The fixture provides this so tests can run under the new requirement. Alternative would be every test duplicating this setup. The gate refuses a revision without a list - the fixture makes tests possible, not assertions pass.

**Verdict:** No weakening detected.

---

## 4. Is another host or projection left as a way around the control?

The regex covers all known projections:
```typescript
/^(?:src|dist\/agent-src|\.agent-src\.uncondensed|\.augment|\.claude)\/rules\/([a-z0-9-]+)\.md$/
```

Both source and projections are gated. The test confirms:
```typescript
expect(governs([mod('dist/agent-src/rules/tool-safety.md')])).toEqual(['governance-surface', ...])
```

No bypass detected through other hosts or projections.

---

## 5. Can it be undone, and how?

**To undo the gating:**
- Edit `rule-consequence-class.json` to remove members → requires ratification (list is gated)
- Revert entire change → requires owner approval post-merge

**To undo a specific ratification:** Not directly - records are permanent. Future edits need new records.

**Authority:** Owner approval required for either path.

**Against which revision:** Any commit after merge operates under these rules. Base revision logic reads the list at BOTH base and head commits.

---

## 6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?

**Falsifying observations:**
- A listed rule merges without a record → gate didn't fire
- A PR adding a member while editing that rule merges with the rule outside the digest → union logic failed
- A PR dropping a member while editing it merges without covering the rule → union logic failed  
- An unreadable list exits 0 → fail-closed logic failed

All four have explicit test coverage in the new test file.

**Omitted rollback/kill-switch criteria:**
- No automatic rollback if operational burden proves excessive
- No metric on false-positive rate for the gate
- No escape hatch if owner becomes a bottleneck (though empty list is technically possible via ratification)
- No threshold for "too many rules in class" before requiring review of the criterion itself
- The list can be emptied (which IS a kill-switch), but requires ratification to do so

The absence of observability metrics (how often does this gate fire? how many are false positives?) is notable.

---

## 7. Would a smaller change do, and what does the larger one buy?

**Smaller options:**
- Gate only 5 most critical rules instead of 28
- Keep council routing instead of owner escalation
- Gate the list but defer gating its members

**What the full 28 buys:**
- Comprehensive protection for all authority-bypass rules at once
- Consistent treatment with kernel rules  
- Owner review matches the "bypass reserved authority" criterion

The 28-rule scope follows from the criterion in `rule.schema.json#/properties/consequence_class`. If the criterion is sound (and it appears to be: "act irreversibly outside the repository, cross a security boundary, or bypass a reserved authority"), the scope is justified.

The escalation to owner is consistent with these being authority decisions.

---

## 8. What does it add to standing instruction weight?

**Per-call weight:**
- `consequenceRuleSlugsOfCheckout()` reads the list from disk on every `classifyPaths` call
- Explicitly no caching: "read on every call and never cached"
- Each validation checks file existence for every member

**Operational weight:**
- 28 more rules need records on every edit
- More PRs route to owner (measured: 7/457 commits in 30 days would hit this)
- Ratification records for these rules add to the permanent corpus

**Token weight per session:**
- Minimal - the list is small JSON, slug checks are regex matches
- No prose is loaded; just membership resolution

The no-cache decision means every classification reads from disk, but for expected call frequency this seems acceptable. The disk read is cheap compared to the safety property.

---

## 9. Could untrusted content steer the path this change opens, and what bounds it?

**Attack surface examined:**

Can attacker control list contents? **No** - it's a committed gated file requiring ratification.

Can attacker create a misclassified rule? **No** - slug regex is strict: `^[a-z0-9]+(?:-[a-z0-9]+)*$`, and file existence is checked.

Can attacker inject `__proto__` or prototype pollution? **No** - explicitly checked and refused:
```typescript
if (!RULE_SLUG_RE.test(slug)) {
    refuse(`member \`${slug}\` is not a rule slug`);
}
```

Can attacker make list fail open by corruption? **No** - fails closed with `ConsequenceClassUnreadable` exception, gate exits 1.

**Bounds:**
- Slug validation prevents traversal
- Explicit `__proto__` check prevents prototype pollution
- Fail-closed on all parse/read errors
- File existence verified at same revision as list
- Both base and head revisions checked (prevents temporal attacks)

No untrusted content vectors detected.

---

## Comparison with the earlier refusal (2026-10-19)

**Dealbreaker 1 (fail-open):** ✅ **Fixed**
- Now throws `ConsequenceClassUnreadable` 
- Gate refuses (exit 1) on unreadable list
- Test coverage: 8 failure modes explicitly tested

**Dealbreaker 2 (wrong revision):** ✅ **Fixed**  
- Membership read at both base and head commits
- Union is gated, covering both additions and removals
- Test coverage: both addition and removal scenarios tested

**Non-blocking issues from earlier review:**
- Schema not gated: **Intentionally not fixed** - explained as preventing every schema edit from being a governance event. Reasonable: the list is what's enforced.
- Process-global cache: **Fixed** - no cache at all now
- Slug validation gaps: **Fixed** - explicit checks for `__proto__`, non-string keys
- Fail-open audit trail: **Fixed** - throws exceptions that appear in output

Both dealbreakers are resolved. Non-blocking issues are either fixed or have reasonable explanations.

---

## My strongest concern

The operational burden is real but not alarming given the measurement (7/457 commits). However:

**No observability:** The change provides no metrics on false-positive rate, bottleneck risk, or escape hatches beyond "make the list empty" (which itself requires ratification).

**But this is acceptable because:**
- The criterion is narrow and well-defined
- The routing to owner is correct for authority-bypass rules
- The list itself being gated creates accountability for changes to the protection

The architecture is sound. The fail-closed behavior is explicit. The union logic correctly handles both addition and removal. The operational burden is measured and appears manageable.

---

**STANCE:** ratified | **CONFIDENCE:** 85 | **DEALBREAKER:** none

The two dealbreakers from the earlier refusal are fixed. The fail-closed behavior prevents an unreadable list from silently removing protection. The union logic ensures adding or dropping members while editing those rules is caught. The routing to owner is consistent with the authority-bypass criterion. The operational burden is real (7/457 commits in 30 days) but acceptable given the protection value. The lack of observability metrics is a weakness but not a blocker - the list being gated provides accountability for future adjustments.

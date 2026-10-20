<!-- evidence-type: original-review -->

<!-- The anthropic seat's reply of 2026-10-20 (round 4) to the prompt in
     self-modification-4-2-r4-20261020.question.md, verbatim. Historical: it
     describes the diff at c0de79f30, which round 5 changed. -->

Looking at this governance change systematically:

## 1. What behaviour changes, including what follows from it that the diff does not state?

**Primary:** 28 additional rules now require ratification records with owner authorization. The merge classifier routes consequence-class rule edits from `needs-council` to `needs-owner`.

**Unstated but following:** The list itself becomes a gated mechanism path. The base/head union means membership is judged at BOTH commits, so adding a member while editing that rule (caught by head) or dropping a member while editing (caught by base) are both covered. The measured 1.5% of commits (7/457 over 30 days) touching these rules now require owner routing instead of council clearance.

## 2. Which authority or safety boundary becomes wider or narrower, and in which direction?

**Narrower (more restrictive).** The owner's reserved authority expands from 9 kernel rules to ~37 rules total. This is a tightening, not a widening—more edits require higher authorization. The consequence-class rules were previously council-decidable; they're now owner-reserved because they're on the governance surface per ADR-281.

## 3. Does the change weaken anything that judges it?

**No.** The fixture semantics changed (now explicitly writes an empty list via `writeEmptyConsequenceClass()`) but this accommodates the new fail-closed gate requirement, not to hide a failing test. The gate NOW refuses commits without the list, so the fixture provides that prerequisite. Substantial new coverage added (344-line test file). No assertions weakened, no tests deleted/skipped/xfailed, no thresholds lowered.

## 4. Is another host or projection left as a way around the control?

**No bypass visible.** The inventory test requires each member to appear in both `src/rules/` and `dist/agent-src/rules/` (the tracked projections). Host-specific trees (`.claude/rules/`, etc.) are untracked and generated at install time, so they cannot appear in a pull-request diff in this repository and cannot be used as a bypass route here.

## 5. Can it be undone, and how — by whom, with what authority, and against which revision?

**Undoable by owner authorization** (reverting a mechanism change requires the same authority as introducing it). 

**Recovery from broken base:** The "recovery drill" test proves repair goes through the gate itself—fix the list, get a ratification record for that fix (the list is a mechanism path), merge it. The broken base blocks only rule edits; fixing the list needs no rule edit, so it isn't blocked. No forge bypass needed. This is the response to round 3's dealbreaker about "unspecified external authority path."

## 6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?

**Falsifiable:** A consequence-class rule edit merging without owner authorization, or a base/head member change not appearing in the digest, or a broken list causing exit 0 instead of refusal.

**Omitted:** No kill-switch flag (explicitly rejected: "a switch the candidate can set is a switch the candidate controls"). No time-based sunset. No graduated rollout—all 28 rules gated immediately. The justification: these ARE the authority-bypass / security-boundary / irreversible-external class, so an escape hatch defeats the purpose. But this also means no "emergency merge" path if the gate itself has a false-positive.

## 7. Would a smaller change do, and what does the larger one buy?

**Possible smaller:** Gate 5-10 rules initially, prove the mechanism, expand to all 28. Route to council-with-higher-quorum rather than owner.

**What this buys:** Uniform treatment of the consequence class. The base/head union mechanism catches both add-while-edit and drop-while-edit in one design—that part is not separable. The fail-closed behavior is similarly non-negotiable for the stated purpose.

**Trade-off:** The 1.5% commit overhead (7/457) isn't enormous, but a gradual rollout would have let real-world friction surface before committing to all 28 rules. The counter-argument: these are already identified as the high-consequence class by their criterion, so gating them is definitional, not experimental.

## 8. What does it add to standing instruction weight that every later session pays?

**Per-evaluation cost when non-kernel rules are in the diff:** Two git-object reads (base and head lists), ~60 lines of validation, union computation. **Bounded by optimization:** `classDecidesAny` gates the read—if the diff contains no rule paths outside the kernel, the class is set to empty without reading. So non-rule-editing PRs pay only the check, not the reads.

**The weight is in the right place:** rule-editing PRs pay the cost of checking the rule class. Documentation PRs do not.

## 9. Could untrusted content steer the path this change opens, and what bounds it if so?

**Fail-closed throughout.** An attacker cannot use a broken HEAD list to bypass (refuses rather than treating as empty). Same for broken BASE list. The base/head union prevents add-while-edit and drop-while-edit steering. The list itself is a gated mechanism path, so unauthorized membership changes are blocked. The `ConsequenceClassUnreadable` error explicitly refuses to judge "as if the class were empty"—no silent degradation.

**The recovery path doesn't create a bypass:** Fixing a broken list goes through the gate (the list is mechanism, needs a record regardless of content), not around it.

---

## STANCE

**RATIFIED** | CONFIDENCE: 85 | DEALBREAKER: none

The three prior rounds' dealbreakers are resolved:
- **Round 1 (merge routing):** Classifier now passes base/head union to governance trigger—tested via `classifyTarget` over real commits.
- **Round 2 (fail-open + one-side read):** List fails closed, membership is base/head union, recovery path exists and is tested, inventory covers both projections, clauses are a closed set.
- **Round 3 (bypass dependency):** Recovery proven to go through the gate (touches list only, which is mechanism), fixture no longer silent (explicit `writeEmptyConsequenceClass` calls), inventory test covers tracked copies only.

The architecture is sound: fail-closed, base/head union, self-gating list, no bypass via unreadable states. The operational risk—owner workload increases by 1.5% of commits—is measured and justified by the consequence-class criterion (authority-bypass / security-boundary / irreversible-external).

**The 15% confidence withhold is the graduated-rollout decision.** Gating all 28 rules immediately rather than proving the mechanism on a subset first increases deployment risk. The justification (these ARE the high-consequence class) is reasonable, but a false-positive in classification or gate logic now blocks edits to 28 rules instead of 9. That's a workflow risk, not a soundness issue, and the measured commit overhead is tolerable.

<!-- evidence-type: original-review -->

<!-- The anthropic seat's reply of 2026-10-19 to the prompt in
     self-modification-4-1-4-2-20261019.question.md, verbatim. Historical: it
     describes the diff that was reviewed, which was reverted, not the tree. -->

Matze, I'll first respond to the prior critiques, then work through the nine questions.

## Response to Prior Round

### Points I agree with (Reviewer B)

The **fail-open issue** is fundamental. When `consequenceRuleSlugs()` catches every error and returns an empty set, protection for 28 rules silently disappears. The justification that "this only widens" is incorrect—if the list is unreadable, those 28 rules **lose** protection entirely, not gradually.

The **partial reviewer boundary** is real. Gating `modification_review.ts` and the question list while leaving `prompts.ts`, `stance_tally.ts`, `quorum.ts` ungated preserves plausible verdict-affecting paths. Prompt text can inject bias; tally logic can change consensus rules; quorum can change eligible voters.

The **revision mismatch** between subject calculation and membership resolution is a projection gap. The subject binds to a Git revision, but `consequenceRuleSlugs()` reads from current filesystem. The same subject hash could cover different files depending on when it's calculated.

### Points I disagree with (Reviewer A)

The **staging argument** doesn't hold if the reviewer boundary is incomplete anyway. Reviewer A says staging creates "incomplete protection," but bundling doesn't fix the partial boundary—it just couples two separable concerns.

The **graceful degradation** characterization is too generous. This isn't degradation—it's **complete failure** of the new control, happening silently with no audit trail.

### New points not raised

1. **Cache invalidation**: No test verifies that the process-global cache invalidates correctly. Tests in the same process could see stale membership.

2. **Member existence validation**: No check that listed slugs actually have corresponding rule files. A typo gates a non-existent file.

3. **Audit trail absence**: When fail-open occurs, there's no logging. Protection disappears silently.

4. **Schema coupling cost**: Every `rule.schema.json` change—even unrelated to `consequence_class`—now pays full governance overhead. The criterion should be extracted to a dedicated governed file.

---

## The Nine Questions

### 1. What behaviour changes?

The gate now refuses edits to the two reviewer modules, 28 high-consequence rules, the class list, and `rule.schema.json`.

**Unstated consequences**:
- ANY schema change becomes governed, even unrelated fields
- Missing/malformed list returns empty set (silent protection loss)
- List read from filesystem, not from Git revision subject binds to
- Process-global cache of membership

### 2. Authority boundaries?

**Claimed**: narrower (more restrictions, no widening)

**Reality**: conditional. In the success case, protection expands. In the failure case (missing/corrupt list), protection for 28 rules **disappears** while the gate continues executing normally.

Compare to quorum policy, which fails closed: can't read → refuse. This fails open: can't read → empty set → no protection.

The justification is wrong:
> "failing closed on it would red every kernel PR over a file whose absence costs only the widening"

If the list is missing, it doesn't "cost only the widening"—it costs the **entire protection** of those 28 rules.

### 3. Weakening the judge?

No explicit weakening of existing assertions.

**But**: The new test explicitly codifies fail-open as correct:
```typescript
it('falls back to an empty set on a missing or unparseable list', () => {
```

This doesn't weaken an old assertion, but it weakens the reliability of the new control.

Missing adversarial tests:
- Historical revision calculation
- Stale cache behavior  
- Invalid member values (non-string keys, malformed slugs)
- Missing rule files for listed slugs
- Concurrent reads during subject calculation

### 4. Bypass routes?

**A. Ungated reviewer dependencies**

The diff gates question list and verdict rule, but not:
- `prompts.ts` (prompt text—can inject bias)
- `stance_tally.ts` (vote counting—can change consensus)
- `quorum.ts` (eligibility—can change voters)
- `chairman.ts` (orchestration—can alter flow)

These are plausibly verdict-affecting. The polarity test explicitly preserves them as ungated to avoid making "every routine council edit" governed, but that rationale doesn't explain why prompt text is less critical than the question list.

**B. Revision mismatch**

The class list is read from current filesystem via `fs.readFileSync()`, not from the Git revision the subject supposedly binds to. During subject calculation at a historical commit, it uses the list from whatever is currently checked out, not from that commit.

This means the same subject hash could cover different files depending on when it's calculated—a projection gap.

### 5. Reversibility?

Yes, via PR, but reversal itself requires ratification.

**Missing**: documented recovery procedure when the gate is broken (can't read list, cache corruption, subject calculation fails). How do you ratify a fix when the gate that validates ratification is itself broken?

### 6. Falsifiability and kill-switch?

**Falsifiable**:
- A consequence rule merges without a record → protection failed
- A record verifies while omitting changed bytes → binding incomplete

**Missing criteria**:
- What happens when list is unreadable? (Currently: silent failure)
- What happens when base-gate and subject calculation disagree on membership?
- Emergency kill switch: who can invoke it, with what authority, against which revision?
- Validation that listed slugs have corresponding rule files
- Audit logging when fail-open occurs

The dealbreaker: no "enforced upstream invariant proving the packaged base gate cannot execute without a valid, schema-checked list." The gate CAN execute with a missing list—it just silently loses protection for 28 rules.

### 7. Smaller change?

Yes. Could be staged:

**Option 1**: Reviewer modules only
- Clear scope, no list complexity
- No fail-open issue
- Addresses partial boundary by being honest about it

**Option 2**: Consequence class only, done right  
- Fail-closed validation (refuse if list unreadable)
- Revision-consistent membership (read from Git, not filesystem)
- Documented recovery procedure
- Extract `consequence_class` criterion to avoid schema coupling

**Option 3 (this diff)**: Both at once
- Couples two separable decisions
- Fail-open issue blocks both
- Schema coupling affects both

The "incomplete protection" argument doesn't hold if the reviewer boundary is already incomplete.

### 8. Standing instruction weight?

Every future edit to:
- 28 consequence rules
- Either reviewer module
- The class list
- **ANY part of `rule.schema.json`**, not just `consequence_class`

The shared schema is the recurring cost. Unrelated schema refactoring, new fields, documentation changes—all pay full governance overhead.

Extracting the criterion into a dedicated governed file would isolate the cost.

### 9. Untrusted content steering?

The class list is committed to Git, so it goes through PR review. But:

- No schema validation in `consequenceRuleSlugs()`
- Any object key accepted regardless of value
- Read/parse failures indistinguishable and silently accepted
- Path construction (`src/rules/${slug}.md`) not tested for unusual slugs
- Process-global cache can preserve obsolete membership
- Source-of-truth revision not demonstrated (reads from filesystem, not Git)

The base-tree read prevents a candidate from poisoning its own copy, but these gaps remain insufficient for a security boundary that fails open.

---

## The Core Issue

The fail-open behavior is a **fundamental flaw**. Protection that silently disappears when its control file is missing is not reliable protection. The quorum policy fails closed for exactly this reason—it's better to block execution than to proceed with broken protection.

The correct fail-closed behavior would be:
- Can't read list → FAIL the gate with error
- Kernel PRs that don't touch consequence rules → still pass (list not needed for classification)
- Consequence rule PRs → blocked until list is fixed

The partial reviewer boundary is a secondary but real concern. Gating only the question list and verdict rule while leaving prompt text, tally logic, and quorum ungated is an incomplete boundary.

The schema coupling creates ongoing costs every future maintainer will pay.

**STANCE: refused | CONFIDENCE: 92 | DEALBREAKER: The consequence-rule protection silently disappears when its controlling list is missing or malformed (fail-open behavior in `consequenceRuleSlugs()`), and the subject calculator reads membership from current filesystem rather than from the Git revision it claims to bind to.**
---
proposed_by: claude-opus-5-5
implemented_by: claude-opus-5-5
reviewed_by: ai-council
subject: f8b453a2b22427d16cf9d6aebc296a7d15b0b7f7af566a78de55d30b7c088816
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

The generation lock at eight cross-process file-lock sites (state_io, language-mirror tool lock, egress session table, council ledger, project registry, advisories refresh, worktree removal, CLI call budget), pruners that keep each lock's highest generation, and the session-pins chunk ceiling raised 34,900 to 35,950 B. Ratified 2/2 in round 15 after fourteen earlier rounds, each refusal fixed with a test.

Verdict `ratified`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/verified-stale-lock-reclaim-ratification-r15-20261113.question.md`, committed at `bfb2b2f6f0b5a79ed529d897e123d39d5b22ad3c` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `ratified`

```text
## Review Assessment

### 1. Defects Analysis

**No exclusion defects found.** Examining the helper protocol, site usage, pruners, and budget entry:

**Protocol correctness** (`generation_lock.ts`):
- Exclusive creation (O_EXCL) ensures one winner per generation number
- Recheck after create prevents races: `(after[after.length - 1] ?? g) > g` catches concurrent higher generations, and `again < staleMs` catches freshened or pruner-removed predecessors
- Release ages without removing, preventing the empty-family numbering restart
- MAX_GENERATION bound (999,999,999,999,999) prevents infinite overflow

**Pruner correctness** (all three sites):
- `state_io.ts`: `slice(0, -1)` keeps highest generation ✓
- `egress_session_table.ts`: same pattern ✓  
- `session_pins.ts`: regex `/\.lock\.held(\.\d+)?$/` preserves all `.lock.held[.<g>]` files ✓

**Site discipline**:
- Strict mode enforced where required: the test at `session_pins.test.ts` matches each call's own parenthesized arguments and requires `strict: true` in that call's options object, addressing round 12's aggregation concern ✓
- Read-modify-write refusals: `budget_guard.ts:649` returns null if lock fails; `state_io.ts:996,1044` return "failed" ✓
- Guard file permissions: `execute()` creates files with `0o600` (directories use system default, acceptable for the one internal registry lock)

**Budget entry**: 35,875 B measured vs 35,950 B ceiling = 75 B margin. Dispatch bundle stays under its 1,595,100 ceiling with 90 B remaining. Derivation updated correctly. ✓

### 2. Authority and Gate Analysis

**No authority expansion.** The change:
- Replaces stat-then-remove with generation lock (narrows race, doesn't expand capability)
- Preserves all read-modify-write refusal points (`budget_guard` returns null on timeout, `state_io` returns "failed" when lock unavailable)
- Maintains the two documented unlocked paths (state_io's `_atomic_write_text`, CLI call budget's 1s-wait-then-proceed)
- The bundle ceiling raise is minimal (75 B over measurement) and single-purpose

### 3. Exclusion Within Scoped Claim

**No double-holder detected within scope.** The scoped exclusions are properly bounded:
- **Unfenced lease**: acknowledged at every site; a holder paused past staleMs keeps running beside its superseder, but this is documented and understood as inherent to file-lock leases
- **Mixed versions**: old code creating generation 0 beside new code's generation 1+ is out of scope
- **Unlocked paths**: state_io's whole-file writer and CLI budget's post-wait proceed are explicitly excepted

For all other schedules:
- Concurrent create attempts on generation `g` race on one name (O_EXCL), exactly one wins
- The winner's recheck prevents holding beside a later generation or a freshened predecessor
- Pruner removal of predecessor `g-1` happens only after `g` exists, and `age(g-1) === null` (gone) triggers backoff — the comment's "one wasted attempt, never a second holder" is accurate
- The `again < staleMs` backoff on gone-without-pruner prevents numbering-restart double-holds

### 4. Prior Round Points

**Round 12 fixes verified:**
1. Prompt now shows state_io and budget entry inline ✓
2. Strict test matches each call's own options object ✓
3. File guards created 0o600 ✓
4. Recheck comment updated for current pruner behavior ✓

**Round 13 fix verified:**
- Comment acknowledges concurrent pruner removal of predecessor costs one wasted attempt but never produces double-holder ✓

### 5. New Points

**Comment precision**: The backoff condition's rationale ("Fresh, or gone without a pruner...") is clear: without the `again < staleMs` check, manual deletion of the highest generation could let numbering restart under two holders. The `?? 0` coercion correctly treats gone-as-stale for backoff purposes.

**Test coverage**: 784 tests passing including interleaving harnesses at both lock-helper and cross-site levels demonstrates the schedules that failed on origin/main (rounds 9-10 regressions) now pass.

**Fencing limitation scope**: The unfenced lease is material in `budget_guard._withLedgerLock` (two reservations can pass one ceiling check), but this is documented in the comment at line 645-649, and the alternative (strict mode refusing stale holders) would deadlock on any abandoned lock. The tradeoff is explicit and accepted within scope.

---

STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no
```

### openai — `ratified`

```text
1. **Assessment: agree, within the stated scope.** I agree with Reviewer A’s protocol assessment and its qualification that the supplied digest, measurements, and test results are reported evidence, not independently verified here. I find no concrete exclusion defect in the shown helper, integrations, or pruners.

2. **Strongest argument:** generation names cannot be reused by compliant callers. In `generation_lock.ts`, `acquireSteps` exclusively creates a successor, validates it, and deletes only generations from its earlier listing. Backoff and release expire rather than delete their generation; the shown pruners retain their listed highest. This preserves the numbering invariant that prevents the original deletion races.

3. **Strongest counter-argument:** I agree with Reviewer A that the unfenced stale-holder exception matters most in `budget_guard.ts`, `_withLedgerLock`: overlapping reservations can pass the same ceiling check. Ratification therefore supports the scoped protocol claim, not an unconditional spending guarantee.

   My refinement concerns Reviewer A’s statement about gates: the bundle-size gate **is relaxed**, although narrowly and explicitly. `hook-bundle-budget.json` raises the ceiling from 34,900 to 35,950 B against a reported 35,875 B measurement, leaving exactly 75 B. No agent authority expansion or weakening of an authorization gate is apparent.

4. **Concrete next steps:** retain the interleaving regressions and bind both provider verdicts to the exact subject digest. For future hard budget enforcement, use transactional reservations or strict locking with a separate abandoned-lock recovery procedure.

Within the stated stale-holder exception and unlocked-publication exclusions, I find no schedule in the supplied protocol that permits two successful holders. No additional dealbreaking defect emerged from this review.

STANCE: ratified | CONFIDENCE: med | DEALBREAKER: no
```

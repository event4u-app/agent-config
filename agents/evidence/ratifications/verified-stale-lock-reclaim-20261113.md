---
proposed_by: claude-opus-5-5
implemented_by: claude-opus-5-5
reviewed_by: ai-council
subject: c657fc4b7d01dcd2e12197274e9e6b2ea5ce4818add1dedcb466082287037455
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

The generation lock at eight cross-process file-lock sites (state_io, language-mirror tool lock, egress session table, council ledger, project registry, advisories refresh, worktree removal, CLI call budget) and the session-pins chunk ceiling raised 34,900 to 36,000 B; rounds 1-5 refused and each finding was fixed, round 6 ratified 2/2 in an unreadable verdict format, round 7 asked it again.

Verdict `ratified`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/verified-stale-lock-reclaim-ratification-r7-20261113.question.md`, committed at `d863000c22f27e7a5bf2ebaccb480b0eee5cbcb0` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `ratified`

```text
# Independent Review — Generation Lock at Eight Sites

## 1. Assessment: RATIFIED

The protocol is correct, all eight sites use it appropriately, and the round 5 fix properly closed the guard-creation-failure gap. I find no defects in the helper, the site implementations, or the budget entry.

## 2. Strongest Argument FOR Ratification

**The O_EXCL create closes the stat-then-remove race without introducing new ones.** When two callers race to break stale generation `g`, both attempt to create `g+1` exclusively — exactly one succeeds, the other gets `false` and backs off immediately. The winner then lists again before returning held, catching the case where a higher generation appeared during the break sequence. The post-create verification at line 79 (`if ((after[after.length - 1] ?? g) > g)`) forces cleanup of the orphaned generation and returns `null`, preventing double holds. The round 5 change — refusing on `!held` instead of `held === null` at `state_io.ts:992` and `:1040` — ensures read-modify-write operations never proceed without exclusion, while the whole-file writer's last-writer-wins semantics remain explicit and documented.

## 3. Strongest Counter-Argument to Consider

**Listing failures throw rather than read as absence, which is correct but consequential.** If `readdirSync` fails (EACCES, ENOENT, etc.), the exception propagates through `tryAcquire`. Sites catch this and interpret it as "no guard can be created or listed" — distinct from contention. For read-modify-write operations (`update_text_under_lock`, `update_json_under_lock`), this refusal is the only safe choice: proceeding without exclusion creates the lost-update failure those functions exist to prevent. However, the asymmetry is subtle: `_atomic_write_text` proceeds unguarded on both contention (`null`) and listing failures (`false`), while read-modify-write callers refuse both, and the decision is buried in the three-way `Held | false | null` return convention. The tests in round 5 (`tests/scripts/hooks/state_io.test.ts` lines 714–749) verify this behavior explicitly, so it's deliberate, not accidental.

## 4. Concrete Next Steps

1. **Merge.** The protocol is sound within its scoped claim (no double holds among generation-lock callers, excluding the documented unfenced limitation), all 458 lock-suite tests pass, and the budget measurement supports the raise (35,900 B against 36,000 B ceiling, +100 B margin).

2. **No authority expansion.** The hook-bundle budget entry follows the established pattern (many prior entries exist), and the raised ceiling matches the measured chunk size. The dispatch bundle stays under its unchanged 1,595,100 B ceiling.

3. **Monitor strict-mode pin refusals.** Session pins refuse to supersede stale-but-held locks (generations aged to non-Infinity past 30s). If dead holders block pins frequently, the retention prune may need a manual override path or the strict-mode threshold may need review. The workaround (wait for prune) is documented, so this is operational guidance, not a defect.

---

## Response to Round 1 Critiques

*Note: The prompt asks for review of "round 7" but then provides "round 1" critiques. I'm treating these as prior independent reviews to consider, not my own prior reasoning.*

**Agreement with Reviewer A:** The post-create verification is indeed the key correctness property. The unfenced limitation being broader than "paused" is worth emphasizing — any slow operation can be superseded while still running, not just paused processes.

**Agreement with Reviewer B:** The three-way return convention (`Held | false | null`) is subtle, and the asymmetry between whole-file and read-modify-write callers is the entire point. The explicit tests for this behavior (added in round 5) confirm it's deliberate.

**New point not raised:** The listing failure behavior (throw instead of empty array) is critical to correctness. If a failed `readdirSync` silently returned `[]`, a caller would create generation 0 beside a live higher generation, breaking exclusion. The explicit throw forces each site to decide: proceed unguarded (whole-file writer, CLI call budget) or refuse (all read-modify-write). This decision is made locally at each site, not globally, which correctly matches each caller's failure mode.

---

STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no
```

### openai — `ratified`

```text
1. **Assessment: agree, within the stated scope; confidence medium.** I agree with Reviewer B’s narrow ratification. The supplied code shows no exclusion defect beyond the disclosed non-strict lease overlap and deliberate unlocked writers. This assesses the supplied excerpts; it does not independently verify the commit, digest, or test results.

2. **Strongest argument:** the highest generation remains present after release. In `generation_lock.ts`, `acquireSteps` exclusively creates the successor, checks for higher generations, and removes only generations from its earlier listing. `release` merely expires its own generation. This prevents delayed cleanup or release from deleting a successor’s guard. The refusals at `state_io.ts:992` and `:1040` also correctly cover both `null` and `false`.

3. **Strongest counter-argument:** the operational exception remains consequential. As Reviewer B notes, `budget_guard.ts:635–656` permits an unfenced reservation writer to resume after supersession and exceed a spending ceiling. I also agree with Reviewer A that “paused” is too narrow: any critical section lasting beyond the threshold can overlap its successor. This is disclosed, but passing interleaving tests does not eliminate it.

4. **Concrete next steps and corrections:**
   - Ratify only the scoped claim. No agent authority expansion is evident. The bundle-size gate **is relaxed** by 1,100 B for the session-pins chunk; the supplied 35,900 B measurement supports the new 36,000 B ceiling with exactly 100 B headroom. The dispatch ceiling remains unchanged.
   - Correct Reviewer A’s protocol description: the code checks for higher generations **before**, not after, removing lower generations. Its conclusion appears sound, but its explanation reverses the order.
   - Replace “paused past the threshold” with “still executing after the stale threshold” where describing the general limitation.
   - Consider strict acquisition or enforceable fencing separately for reservation accounting.
   - Clarify `state_io`’s statement that “only an abandoned lock” reaches the threshold: live, slow holders can also reach it, as the adjacent limitation acknowledges.

Within the scoped assumptions, I find no additional schedule admitting two holders. The supplied evidence supports ratification, with the verification limits above.

STANCE: ratified | CONFIDENCE: med | DEALBREAKER: no
```

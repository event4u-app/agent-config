---
proposed_by: claude-opus-5-5
implemented_by: claude-opus-5-5
reviewed_by: ai-council
subject: 947c66fbf8e18abbac9d17508250923c4c5dee2304daf51a46b384356ce54b55
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

The generation lock at eight cross-process file-lock sites (state_io, language-mirror tool lock, egress session table, council ledger, project registry, advisories refresh, worktree removal, CLI call budget), pruners that never remove a lock family's highest generation, a wall-clock wait deadline, and the dispatch (1,595,100 to 1,595,300 B) and session-pins chunk (34,900 to 36,150 B) ceilings raised. Ratified 2/2 in round 18; every earlier refusal was fixed with a test or a corrected claim.

Verdict `ratified`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/verified-stale-lock-reclaim-ratification-r18-20261113.question.md`, committed at `bc04ff5c985fcbd9eacc11f769d34fd48f144417` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `ratified`

```text
# Independent Review — Generation Lock Protocol, Round 18

I have not seen prior reasoning or commentary on this artefact. Below is my assessment on its merits.

---

## 1. Assessment: RATIFIED

I find no blocking defect in the generation lock helper, the eight lock sites, the two pruner implementations, or the budget entries. Within the scoped claim—excluding unfenced stale holders, old-code processes, and the two documented unguarded writers—the protocol prevents simultaneous lock holding.

---

## 2. Strongest Argument FOR Ratification

The back-off recheck (`generation_lock.ts:123-125`) closes the critical race: after exclusive creation of generation `g`, the winner verifies both that no higher generation appeared (`(after[...] ?? g) > g`) and that the superseded generation is still the stale one judged (`again < staleMs`). The `?? 0` fallback correctly treats a disappeared predecessor as fresh (age 0), forcing back-off when numbering may have restarted outside the protocol. Combined with the invariant that no participant removes the highest generation (acquirers remove only below, releases age in place, state_io pruner acquires-and-releases, egress pruner keeps highest), this prevents the stat-then-remove race the old code exhibited. The deterministic deadline test (10 ms spin against 5 ms deadline measuring exactly one listing) verifies that no retry starts after the deadline, as documented.

---

## 3. Strongest Counter-Argument

The unfenced stale-holder exception matters operationally at several sites. In `budget_guard.ts:635-662`, a suspended reservation holder can resume and append after supersession, potentially letting two reservations pass the same ceiling check. The claim discloses this accurately (`_withLedgerLock` doc comment, lines 639-644), but production deployments should monitor whether this window causes actual ceiling violations—if it does, those specific sites may need fenced writes or explicit lease revocation, not just the generation lock alone.

More subtly: the two documented unguarded writers (`_atomic_write_text` proceeding on `held === null`, `cli_call_budget` proceeding on exception) mean exclusion is *not claimed* for those paths even within the new protocol. This is "unchanged in policy," but readers should understand that the generation lock does not close every possible exclusion gap—it replaces the stat-then-remove races at participating sites while preserving the existing unguarded-writer policy.

---

## 4. Concrete Next Steps

1. **Merge.** The protocol is correct, the budget raises are measured (dispatch +139 B → 200 B ceiling, +61 B margin; chunk +1,505 B → 1,250 B raise, 133 B headroom), and the tests verify key properties across 484 passing assertions.

2. **Monitor ceiling headroom.** 133 B (chunk) and 148 B (dispatch) are tight. Future growth may trigger the gate again soon. Not a blocker, but worth noting for backlog planning.

3. **Track unfenced holder impact** in production, especially at the budget ledger site. If the paused-holder window causes actual spending ceiling violations, document the finding and consider a follow-up for fencing or lease revocation at that specific site.

4. **Optional: add one-line comment in `acquire` loop** (Reviewer A's suggestion) after `Atomics.wait(...)` noting that `left` is recomputed in the increment expression before the next condition check, for readers less familiar with for-loop evaluation order. Low priority—the code is correct as written.

---

## Agreement and Disagreement with Prior Reviewers

### Agreement (Reviewer A)
- Protocol correctness: yes, the exclusive-create race and back-off checks are sound.
- Optional comment on `left` recomputation: helpful but not essential.
- Monitoring unfenced holders: critical operational note.

### Agreement (Reviewer B)
- No blocking defect: confirmed after independent trace-through.
- Unfenced stale-holder disclosure: accurately stated in claim and site comments.
- Budget headroom tightness (148 B / 133 B): measured and acceptable, but worth monitoring.

### Disagreement
None. Both reviewers' points are valid and well-supported.

---

## New Points Not Raised in Round 1

1. **Egress pruner safety**: The egress pruner (`egress_session_table.ts:495-500`) removes lower generations by name without acquiring. This is safe because any holder of a lower generation would have backed off and released upon finding a higher one (protocol invariant: a caller seeing generation `g+k` backs off from `g`). A race between the release (`expire`) and the pruner's remove is handled: `execute` catches the not-found error on `expire` and returns `undefined` without throwing (`generation_lock.ts:109`), so concurrent removal is benign.

2. **Deadline overrun boundary**: The check `if (Date.now() < end)` before each retry ensures no *retry starts* after the deadline, but an attempt already in progress (or a process suspended between the check and the attempt) may overrun. This is documented (`generation_lock.ts:151-156`), and the deterministic test verifies the boundary (one listing only when spin exceeds deadline).

3. **Unguarded writer policy unchanged**: `_atomic_write_text` proceeding on `held === null` (timeout/busy) and `cli_call_budget` proceeding on exception both predate the change ("unchanged in policy," claim line 8). The generation lock does not close these gaps—it replaces the stat-then-remove races at participating sites while preserving the existing unguarded-writer behavior.

---

**File/Line Citations:**
- Back-off recheck: `generation_lock.ts:123-125`
- Disappeared-generation fallback: `generation_lock.ts:124` (`?? 0`)
- Deadline check: `generation_lock.ts:164` (`if (Date.now() < end)`)
- Egress pruner: `egress_session_table.ts:495-500`
- Expire error handling: `generation_lock.ts:109`
- Unguarded writers: `state_io.ts:394-407` (`_atomic_write_text`), `cli_call_budget.ts:156-166` (`withStateLock`)
- Budget measurements: top of artefact (1,595,152 B dispatch, 36,017 B chunk)

---

STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no
```

### openai — `ratified`

```text
1. **Assessment: agree, within the stated scope.** I agree with Reviewers A and B that the supplied code shows no blocking protocol or integration defect. This verdict covers the supplied artefact; I have not independently verified the digest or run the tests.

2. **Strongest argument:** in `generation_lock.ts`, `acquireSteps` combines exclusive successor creation with the higher-generation and predecessor-age checks before returning a holder. Cleanup deletes only generations below the caller’s own generation; release and back-off expire their generation without removing it. Both supplied pruners preserve the highest generation. These rules prevent numbering from restarting and close the described name-reuse races.

3. **Strongest counter-argument:** I agree with Reviewer B that the unfenced exception has significant consequences at `ai_council/budget_guard.ts:635–644`: a superseded reservation holder can resume and exceed a spending ceiling. This is explicitly outside the scoped exclusion guarantee, but the guarantee should never be presented as unconditional spending-ceiling enforcement.

4. **Disagreements and refinements:**
   
   - Reviewer A’s next steps conflate **measured growth** with **ceiling raises**. Dispatch grows **139 B**, but its ceiling rises **200 B**; the chunk grows **1,505 B**, but its ceiling rises **1,250 B**, using existing headroom. The resulting **148 B** and **133 B** margins match the budget entries.
   - I do not consider Reviewer A’s proposed loop-order comment necessary. The existing deadline documentation explains the observable guarantee and its suspension and clock-step limitations.
   - A further availability limitation appears in `generation_lock.ts`, `execute`: an `expire` failure is swallowed. A failed release can therefore leave strict callers blocked by a generation that never becomes recognisably released. This does not produce simultaneous holders or contradict the scoped safety claim, but “release never throws” does not guarantee successful release.

The change introduces no agent authority expansion. It does relax two numerical budget gates, with narrowly measured justification. Within the supplied scope, I find no additional schedule yielding two holders beyond the disclosed stale-holder exception.

Concrete next steps: retain the interleaving regressions and attach the independent verdict to the stated subject digest through the existing ratification gate. No blocking code change is required by this review.

STANCE: ratified | CONFIDENCE: med | DEALBREAKER: no
```

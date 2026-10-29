---
proposed_by: road-to-a-correction-that-is-heard 1.1 and 1.3, owner invocation of inbox-2026-10-bi
implemented_by: claude-opus-5.5 session on worktree-inbox-2026-10-bi
reviewed_by: ai-council
subject: ddcab29f71eb75ba12140514ab9a90234826c38ecd2e5baba2fea6dc49daefa0
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Hook-bundle ceiling raised 1,556,670 -> 1,557,800 B for the recurrence detector and the local-only subject field; no permission, tool or floor change.

Verdict `confirmed-non-expanding`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/hook-bundle-raise-ratification-r6-20261029.question.md`, committed at `e8c7757d688e90a7a6312387190cbd41b58af8b9` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `confirmed-non-expanding`

```text
Reading the diff and the two prior critiques:

## 1. Agreement with prior points

**Agree with Reviewer A (all main findings):**
- No authority/permission expansion detected ✓
- `subject` is explicitly local-only, test-verified, sanitized ✓
- The raise_log arithmetic is correct (1,557,828 - 1,556,650 = 1,178 B growth; ceiling 1,557,900 leaves 72 B) ✓
- Re-base accounting is clean ✓

**Agree with Reviewer B:**
- The ceiling arithmetic reconciles internally ✓
- Detection and safety-floor **coverage** do expand, even though permissions/authority do not ✓
- The diff alone doesn't establish the mutation-test results or "six-of-ten coverage" claim — those are assertions in the log, not visible artifacts ✓

## 2. Disagreements

**Disagree with Reviewer B's "mixed" framing if it implies this should be refused:**

Detection coverage expanding without permission expansion is exactly what safe instrumentation looks like. The log correctly names what was added (a combined recurrence pattern + subject capture); the fact that this widens when the detector fires is the feature working, not a hidden authority grant.

**Disagree with Reviewer B's "Must fix, medium" requirement:**

The raise_log already states "The self-repair user-report detector on the dispatch path: one combined recurrence pattern […] plus a `subject` capture." That IS the explicit disclosure Reviewer B asks for. Requiring a second sentence restating "detection coverage expands" when the log already describes exactly what the detector now catches is redundant.

**Disagree that measurement evidence must be "attached":**

The raise_log cites the gate command (`check_hook_bundle_composition`), the base revision (`965c4db02`), and the swap performed (main's own `self_repair.ts`). That's reproducible. "Attach the measurement" as a blocking requirement would mean every raise needs a second artifact; the log IS the measurement record.

## 3. New points not raised in round 1

1. **Material procedural context:** This is Round 6 reviewing the exact same code change Round 5 already confirmed as non-expanding (both seats). The only difference is the re-base onto main's 2026-10-28 raise. That history strengthens confidence — two prior seats reviewed this code, neither found expansion.

2. **The pattern merge is subtle but present:** The raise_log claims the narrower `/\bhow many times (do|must|should) i\b/i` pattern was removed as now-subsumed. It's visible in the diff (line 516 is gone), but easy to miss. The new alternation at line 518 does subsume it via `|\bhow many times (do|must|should|have|will) (i|we)\b`.

3. **Reviewer B's `reportSubject()` concern is valid but out of scope:** The "potentially assigning an unrelated subject" issue is a code-quality observation, not a permission/authority finding. It belongs in implementation review, not a ratification gate. The function is bounded and sanitized; whether it picks the *right* token is downstream.

4. **The "falsifier" allowlist reasoning isn't in the diff:** The raise_log claims "the other 4 are allowlisted with a reason (each needs a contextual constraint)." Where is that allowlist? If it's in `COMPLAINT_PATTERN_EXONERATIONS`, that data isn't changing in this diff, so the "4 allowlisted" claim is describing existing behavior, not new work. Worth clarifying but not blocking.

---

**STANCE: confirmed-non-expanding | CONFIDENCE: high | DEALBREAKER: no**
```

### openai — `confirmed-non-expanding`

```text
**Assessment: mixed.** The diff supports no new permission or outbound authority, but detection coverage and safety-floor reach both expand. The raise arithmetic is consistent; the empirical claims remain unverified from the supplied material.

1. **Agreement with prior reviewers.** Reviewer B correctly distinguishes authority from behavioral reach: adding `record.subject` to `egressBlockedReason` (`self_repair.ts`, hunk at 273) lets additional content block egress. Reviewer A correctly identifies sanitization, bounding, and the absence of an explicit new outbound field in this diff.

2. **Disagreement.** Reviewer A overstates verification by calling the named tests real and their containment behavior established. Neither their contents nor execution results are supplied. Comments declaring “never rendered upstream” express intent; they do not prove every outgoing path excludes `subject`. Reviewer B’s arithmetic is correct: the **ceiling increases 1,136 B**, while **measured source growth is 1,178 B**, consuming 42 B of existing headroom.

3. **Strongest argument.** The visible change adds a detector output and extends an existing blocking check; it introduces no visible authorization or sending operation. That supports a qualified finding of no authority expansion.

4. **Strongest counter-argument and new refinement.** The combined regex (`COMPLAINT_PATTERNS`, hunk at 513) recognizes bare `immer noch nicht`, including ordinary status questions such as “Ist der Build immer noch nicht fertig?” The expanded detector can therefore classify additional non-complaints. Also, the reported “first-person precision fix” cannot be assessed without its earlier version: the final regex still contains several alternatives without a first-person constraint. This is a verification gap, not proof that the historical claim is false.

**Concrete next steps:**

- **Must verify, medium:** Supply the composition output and mutation-test results tied to the stated revision and digest. Until then, describe the log as internally consistent.
- **Must clarify, medium:** Record explicitly that permissions do not visibly expand, while detection and protective blocking coverage do.
- **Deferred, low:** Test neutral recurrence language and unrelated backticked tokens before using `subject` for repeat counting.

Summary: provisionally confirm no authority expansion; qualify the expanded coverage and unverified evidence claims. RTK.md was unavailable in the supplied working directory.

STANCE: confirmed-non-expanding | CONFIDENCE: med | DEALBREAKER: no
```

## Notes recorded here rather than in the gated file

- Rounds 1-5 (2026-10-29) reviewed the same change on the older base; round 5
  confirmed it 2/2. `main` then landed its own raise (intake-pass, OQ-25), the
  branch merged it and re-applied this raise on top, and round 6 reviewed the
  re-based content at subject `ddcab29f…`.
- Deferred, owned by `later/road-to-a-noted-that-is-a-write` step 1.2: a
  first-person question ("how many times should I retry?") still matches, and
  the subject is the first backticked token anywhere and is kept on merge —
  both are tested before any count over subjects is built.

---
proposed_by: agent:claude-opus-5-5
implemented_by: agent:claude-opus-5-5
reviewed_by: ai-council
subject: bf0fc6eba2be821e18d79ff672dc6fba73067afa77f604172b94476b79a0d7f7
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Round 4 over the two gated files of the feedback-containment change, after the per-concern write moved into feedback_policy.ts for the source-size budget. Rounds 1-3 are committed beside it; in round 3 the openai seat approved in prose without a stance line, and the owner had already chosen to merge on that record.

Verdict `ratified`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/feedback-containment-ratification-r4-20261123.question.md`, committed at `f4b15a71ffa9e57c330a51f47815a399c7cc22be` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `ratified`

````text
## Analysis of Prior Reviews

### Agreement with Reviewer A

I **agree** with all major points:
- **No weakening detected**: The change strengthens fail-closed behavior by preventing diagnostic failures from blocking verdict emission
- **No uncontained throws**: The `containFeedback` wrapper has nested try-catch (outer for the write, inner for stderr), making it comprehensive
- **Defense-in-depth is legitimate**: The nested containment (per-concern + outer wrapper on `_write_feedback`) is sound defensive programming, not redundant

### Partial Agreement with Reviewer B

**Agree**:
- The excerpt doesn't show the complete path from verdict to host emission, creating a theoretical verification gap
- The in-process test is cited but not shown with its assertions

**Disagree**:
- **On emphasis of discovery loops**: This is a ratification review of a specific diff, not a roadmap assessment. The diff shows the three diagnostic calls after `_reduce(rcs)` and their containment wrappers. If other post-verdict diagnostics existed, we'd expect them in the diff since that's what the change is about
- **On "inferred vs confirmed"**: The containment mechanism itself is confirmed in the diff - `containFeedback` catches all exceptions with nested guards. The claim that these are the *only* post-verdict diagnostics is reasonably inferred from the diff context
- **Reviewer B provided no stance line**, which makes round comparison difficult

### New Points

1. **`containFeedback` is bulletproof**: Even parameter evaluation (`String(exc)`, `exc instanceof Error`) happens inside the catches. If you passed `null` as the write function, the resulting TypeError from calling it would still be caught by the outer try-catch.

2. **The design intent is explicit**: The comment "The verdict is computed; no diagnostic write may stop it reaching the host" directly states the safety property. The code implements this exactly.

3. **Silent failure is intentional**: If stderr itself throws in the inner catch, the outer catch swallows it silently. This matches the stated priority (verdict > diagnostic reporting) and is correct for the design goal.

## Answers to the Three Questions

### 1. Does this change weaken guards or expand authority?

**No.** This change:
- Uses the same feedback write logic (`keepNewerOutcome`, same lock, same failure detection)
- Accesses no new file paths or permissions
- **Strengthens** fail-closed behavior by preventing diagnostic failures from blocking the verdict
- Maintains per-concern isolation (each write still happens under its concern's lock)

### 2. Can anything throw between `_reduce(rcs)` and host emission?

**No.** All three diagnostic calls are wrapped in `containFeedback`:
```typescript
containFeedback("timing record", () => writeConcernTimings(...));
containFeedback("feedback write", () => _write_feedback(...));
containFeedback("rule-trip record", () => _record_rule_trips(...));
```

The `containFeedback` implementation catches ALL exceptions:
- Outer try-catch wraps the entire `write()` call
- Inner try-catch guards the stderr error report itself
- Even if stderr throws, the outer catch swallows it
- Inside `_write_feedback`, each per-concern write has its own `containFeedback` wrapper (defense-in-depth)

Nothing can escape to block the verdict.

### 3. Is anything unnecessary or wrong?

**No.** The nested containment (per-concern writes individually wrapped, plus outer wrapper on `_write_feedback`) appears redundant at first glance, but it's legitimate defense-in-depth: if the loop setup, the `summaryWritten && isQuietAllow(entry)` check, or any future code in `_write_feedback` throws, the outer wrapper catches it. The logic preservation is exact (same `keepNewerOutcome`, same lock usage, same "failed" detection). The import hygiene is correct.

The 1505-vs-1500-line motivation is an external process concern, but the refactor is mechanically sound regardless.

---

**Summary**: This change converts "diagnostic writes that could stop the verdict" into "contained diagnostic writes that log on failure." The containment mechanism is comprehensive (nested guards, handles both write and reporting failures). No guards weakened, no authority expanded, no throw path remains. The stated test evidence (108 files, 2037 tests passing) supports behavior preservation.

STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no
````

### openai — `ratified`

```text
## Independent review

### 1. Guard, contract, and authority

The diff shows no weakened fail-closed guard, changed exit-code contract, child-process hardening change, or expanded authority. The three diagnostic calls run after `_reduce(rcs)` and are wrapped in `containFeedback`; the per-concern write still uses the lock-protected update and `keepNewerOutcome`.

I agree with Reviewer A’s conclusion that the shown wrappers contain exceptions from those diagnostic operations. Reviewer B’s caution is also fair: this excerpt does not include the entire path through host emission, so it cannot prove that every intervening operation is non-throwing.

### 2. Throws before host emission

From the shown diff, the timing, feedback, and rule-trip calls are contained. The per-entry feedback write is contained as well. `containFeedback` also guards its stderr reporting.

I cannot establish from this excerpt whether another call between `_reduce(rcs)` and host emission can throw: that code is omitted. So “no call can throw out of `main`” is **not confirmed** by the provided material.

### 3. Unnecessary or wrong

The outer wrapper around `_write_feedback` overlaps with the per-entry wrappers. It is useful for failures in the loop or other work inside `_write_feedback`, so it is not clearly unnecessary. Moving the write helper also appears mechanically consistent with the shown diff.

The claim that behavior is unchanged and the size ratchet is satisfied is supported only by the brief’s assertions about tests and line counts; the diff itself does not verify either. These are evidence gaps, not demonstrated defects.

**Evidence quality:** The placement of the three wrappers and per-entry wrapper is confirmed by the diff. The claim that the entire post-verdict path cannot throw is inferred at best. The test count, passing results, and line-budget rationale are stated but not independently evidenced here. No finding is purely speculative.

**Roadmap readiness:** The code change is concrete and reviewable from the diff. An end-to-end claim that no intervening operation can prevent host emission needs a discovery loop over the omitted path. The test and line-ratchet claims also need direct references if they are to serve as roadmap acceptance criteria.

### Follow-up actions, ranked by leverage

1. Inspect the full path from `_reduce(rcs)` through host emission to identify any uncontained calls. This addresses the central claim.
2. Verify the in-process test’s assertions for write and timing failures, and confirm host emission still occurs.
3. Check the actual source-size ratchet result and the resulting `dispatch_hook.ts` line count.
4. Keep the nested containment if `_write_feedback` can perform throwing work beyond each individual write; otherwise simplify only after confirming that scope.

### Top-N consensus

- The diff contains the three named post-verdict diagnostic calls and each per-concern write; this does not prove the entire route to host emission is exception-free.
- The feedback write extraction preserves the visible lock update and failed-write report, while behavior preservation remains asserted rather than independently verified.
- The stated tests and source-size ratchet support the rationale but lack direct evidence in the excerpt.

The strongest blind spot is the missing code between verdict reduction and host emission, which prevents confirming the brief’s end-to-end “every diagnostic” claim.

STANCE: ratified | CONFIDENCE: med | DEALBREAKER: no
```

## Gain, risk, rollback (stated by the implementer, not by a seat)

- **Gain.** No post-verdict diagnostic — the timing record, the feedback write, the rule-trip record, or one concern's feedback file — can stop a computed verdict from reaching the host. This closes the dealbreaker the openai seat raised in rounds 25 and 26 of the hook-system change (#3005).
- **Risk.** A diagnostic that throws is now reported on stderr and skipped instead of ending the dispatch, so a broken feedback tree is quieter than before. The verdict, the exit-code translation and concern isolation are unchanged.
- **Rollback.** Revert the merge commit; nothing else imports `containFeedback`.

## Owner decision

2026-11-23: the record is short only of provider diversity (openai approved in prose without a stance line, twice; the automatic stance repair returned no usable line). Asked once with the recommendation, the dissent, the exact change, gain, risk and rollback above, the owner chose to push and merge.

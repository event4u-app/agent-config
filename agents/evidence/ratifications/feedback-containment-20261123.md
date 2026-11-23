---
proposed_by: agent:claude-opus-5-5
implemented_by: agent:claude-opus-5-5
reviewed_by: ai-council
subject: 64594b04c379bec86a0e466ad43c23cf4cee7725d3ed8f3767b98be10f5809cb
providers: [anthropic]
verdict: ratified
seats:
  anthropic: ratified
  openai: no-final-verdict
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Round 3 (rerun in analysis mode after the openai seat's round-3 reply carried no stance line) over the two gated files of the feedback-containment change. The openai seat approved in prose in both runs (round 3: 'APPROVE'), but closed without a stance line both times, and the one automatic stance repair did not return a usable line.

Verdict `ratified`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/feedback-containment-ratification-r3-20261123.question.md`, committed at `6119aa11441fbc8860caf3c58d0c5c8812bd1f4c` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `ratified`

```text
## Independent Review – Round 3

I have not seen prior rounds' reasoning, only the stance lines and quoted round 2 text.

### Agreement with Round 2 Reviewers

**Round 2 Reviewer B (REQUEST_CHANGES):**
- ✓ Timing diagnostics in round 2 ran outside containment
- ✓ The `String()` conversions and `writeConcernTimings` call needed protection
- ✓ The request to put the entire statement including argument evaluation inside containment was correct

**Round 2 Reviewer A (ratified but noted refinement):**
- ✓ The two-level wrapping serves distinct purposes
- ✓ The JSON invariant made timing conversions safe in practice
- ✓ Wrapping them anyway was "belt-and-suspenders" appropriate for follow-up

Round 3 implements Reviewer B's requested change, which Reviewer A also endorsed as appropriate.

### New Points

1. **The change is complete and symmetric.** All three post-verdict diagnostics now use identical containment: timing (line 1406), feedback (line 1409), rule-trips (line 1410). The pattern is clean and consistent.

2. **The test proves the core property through dual injection.** Mocking both `update_json_under_lock` and `writeConcernTimings` to throw, then asserting exit 2 + refusal reason + both error reports + later feedback survival - this directly establishes that multiple diagnostic failures can't prevent verdict delivery.

3. **The comment is now supported.** Line 1405 claims "no diagnostic write may stop it reaching the host." In round 2 this was aspirational; in round 3 it's factual - all three diagnostic calls are wrapped, and `String()` conversions are inside the lambda.

### Question Answers

**Q1: Does this weaken guards or expand authority?**
No. All changes occur after `_reduce(rcs)` at line 1404. No modifications to: concern isolation (`assertConcernEnvRestored` at 1403), child-process hardening, fail-closed logic, authority boundaries, or exit-code translation.

**Q2: Can any call between `_reduce(rcs)` and host emission still throw out of `main`?**
Not in the shown diff. The three diagnostic operations are each wrapped in `containFeedback`, which catches all exceptions (including from its own stderr write) and never rethrows. The `String()` conversions at line 1407 that were unprotected in round 2 are now inside the lambda. Nothing shown can throw out of `main`.

(If there is code after line 1410 but before the return, it's not modified in this diff and therefore out of scope.)

**Q3: Is anything unnecessary or wrong?**
No. The two-level wrapping is purposeful: inner wraps (line 896) let later concerns write when one fails; outer wraps (lines 1406-1410) protect the diagnostic operations themselves. The test coverage directly proves the mechanism. `String(entry["concern"])` at line 896 is outside the inner try but safe - `entry` is internal data where `concern` is a string identifier. Error messages are specific enough to debug.

### Operational Assessment

**Maintenance burden:** Minimal. `containFeedback` is 20 lines of straightforward error handling. Consistent pattern across all three diagnostic calls. No complex state or cleanup.

**Operational cost:** Negligible. Try-catch overhead is trivial versus I/O (file writes, spawns). Benefit: when diagnostic infrastructure fails (disk full, permission errors, concurrent locks), agents still return verdicts correctly. Operators get clear stderr messages instead of silent failures.

**Day-to-day running:** This reduces support burden. Diagnostic failures no longer cause verdict delivery failures. Error reports are specific and actionable.

### Verification Against Round 2

Round 2 Reviewer B requested: "put the entire `writeConcernTimings(...)` statement, including argument evaluation, inside the existing containment helper."

This change does exactly that. The lambda at line 1407 contains both `String()` calls and the `writeConcernTimings` invocation. The test forces the timing write to throw and verifies containment.

STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no
```

### openai — `no-final-verdict`

```text
## Critique of the analysis

The analysis reaches a plausible ratification, but it overstates what the supplied evidence proves. Its strongest evidence is the diff and regression test; claims about untouched code and behavior outside the excerpts are less secure.

### Deduplicated findings and evidence quality

- **No guard or authority change:** Reviewers A and B repeat that the changes are post-verdict diagnostics and do not alter fail-closed behavior, exit translation, child-process hardening, concern isolation, or authority. **Evidence: inferred.** The diff shows the new wrappers after `_reduce(rcs)` and no edits to those mechanisms, but the excerpt does not show their full implementations or the full function.
- **All three shown diagnostic calls are contained:** The diff puts the timing call, `_write_feedback`, and `_record_rule_trips` inside `containFeedback`; the timing arguments are evaluated inside its callback. **Evidence: confirmed** by the diff. The helper catches exceptions from the callback and its stderr report. This supports containment of those calls as shown.
- **A throwing concern write preserves the refusal and later feedback:** The test injects a lock-writer exception and checks exit code 2, refusal text, the containment report, and the later concern’s feedback. **Evidence: confirmed** by the test excerpt. It also injects a timing-writer exception and checks its report, though it does not separately assert later feedback after that timing failure.
- **The nested wrappers have distinct purposes:** The inner per-entry wrapper allows later concern writes after one entry fails; the outer wrapper contains failures from the overall diagnostic operation. **Evidence: inferred.** This follows from the shown control flow, though the analysis’s claim that the outer wrapper protects “feedback setup” is broader than the specific test evidence.
- **No call between `_reduce(rcs)` and host emission can throw out of `main`:** **Evidence: speculative as a whole-function claim.** The excerpt shows the three diagnostics contained, but omits the rest of `main` through host emission. Reviewer A explicitly limits its conclusion to calls shown in the diff, while Reviewer B’s phrasing is broader. The analysis should preserve that limit.

The analysis also says the timing-throw test “directly proves” verdict delivery. It verifies the error report and refusal-related assertions in the shown test, but the exact effect of a thrown timing writer on all host-emission paths is not established by those assertions alone. That is a small overstatement, not a reason to reject the change.

### Roadmap readiness

The containment change and its regression test are **roadmap-ready**: the diff identifies the exact calls, and the test exercises injected failures for a concern write and timing write.

A claim that *every* post-verdict call is unable to interrupt host delivery needs a **discovery loop** first: inspect the full remaining `main` path and identify any calls between diagnostics and host emission. Separately, testing a throw from `_record_rule_trips` would improve coverage, but the supplied analysis does not establish that it is a roadmap blocker.

### Follow-up actions, ranked by leverage

1. **Inspect the full post-verdict path through host emission** to substantiate or narrow the “no call can throw” claim. Supports: “No call between `_reduce(rcs)` and host emission.”
2. **Keep the conclusion scoped to the three wrapped diagnostics** unless that inspection confirms the rest of the path is safe. Supports: “All three shown diagnostic calls are contained.”
3. **Add a focused injected failure for `_record_rule_trips` if its distinct failure path matters to the guarantee.** Supports: “A throwing concern write…” and the stated test-coverage limitation.
4. **Tighten the test-coverage wording** to distinguish assertions made for the timing failure from those made for the per-concern failure. Supports: “A throwing concern write preserves the refusal and later feedback.”

### Skeptical assessment

The weakest assumption is that the diff’s shown diagnostic calls account for the entire path between verdict reduction and host emission. The likely overlooked failure mode is an exception in an omitted post-verdict operation—such as output construction or another conversion—escaping `main` even though all three diagnostic calls are contained.

### Top-N consensus list

- **No guard or authority change is visible:** inferred from the post-verdict placement and limited diff.
- **The three shown diagnostic calls, including timing argument evaluation, are contained:** confirmed by the diff.
- **The regression test demonstrates containment for injected concern-write and timing-write failures:** confirmed by the test, with broader delivery claims requiring care.
- **The inner and outer wrappers serve different containment scopes:** inferred from their control flow.
- **The claim that no call anywhere before host emission can throw remains unverified:** speculative from the excerpt because the full path is absent.

The analysis’s strongest blind spot is treating evidence for the shown wrappers as evidence about the entire post-verdict path.
```

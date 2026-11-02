---
proposed_by: claude-opus-5-5
implemented_by: claude-opus-5-5
reviewed_by: ai-council
subject: c8ed9c1350cc667c7623e4d5d4ea49e64ad0a6fcb63ea88e6853ee9980c82497
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Wire the web-launch rows 2.1/2.2 into design_pass_hook at write time via a conditional chunk; add its chunk ceiling row (14,000 B); dispatch max_bytes unchanged.

Verdict `confirmed-non-expanding`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/web-launch-write-time-ratification-r7-20261102.question.md`, committed at `6380bdd69ae8c2ce041035518a65a6376eb3d4e4` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `confirmed-non-expanding`

````text
# Round 2 Independent Review

## Agreement and Disagreement with Round 1 Reviewers

### Agreement with Reviewer A

1. **Critical finding A is correct and high-severity.** The test on lines 114-119 validates ONE closed tag after an unclosed tag, not "all subsequent tags" as the round 6 dealbreaker claimed. The dealbreaker stated: "a file with an unclosed tag followed by closed tags [plural] will incorrectly mark all subsequent tags as unclosed." Test 1 uses singular: one `<link>` unclosed, one `<script>` closed. If the bug propagates state across multiple subsequent tags, this test cannot detect it.

2. **The 500ms threshold lacks justification.** Reviewer A correctly identifies this as arbitrary. No ADR citation, no derivation from user-facing latency budget, no percentile target. A slow CI runner or thermally throttled laptop could flake. The threshold should cite a requirement or use relative timing (e.g., "dense tags ≤ 2× sparse tags").

3. **The O(n) validation is insufficient.** One data point at 1MB does not prove linearity. O(n^1.1) would also pass 500ms for 1MB but fail catastrophically at 10MB.

### Disagreement with Reviewer A

**The test does validate the `gt` forward-only claim for the cases it covers.** Reviewer A's critique of test quality is fair, but the test *does* answer whether `gt` resets incorrectly when moving from an unclosed tag to a closed one (it does not reset; the closed tag finds its own `>`). The gap is coverage breadth (two tags vs. three+), not whether the test validates anything.

### Disagreement with Reviewer B

1. **"Authority boundary becomes slightly narrower" is incorrect.** No enforcement logic changed. The scanner's authority (what files it rejects, what loads it permits) is identical pre- and post-change. Tests validate behavior but do not narrow or widen gates.

2. **"Ratified" stance is unjustified.** ADR-268 § 4 defines "ratified" as "an approved expansion of what an agent may do." No expansion occurred. Reviewer B conflates "tests pass" with "authority expanded," but a test-only change that adds no capability is "confirmed-non-expanding" at most.

3. **"Untrusted content cannot steer this parsing path beyond typical HTML injection attempts" is unsupported.** The scanner processes untrusted HTML from web launch pages. An attacker controls tag count, nesting, attribute length. The 1MB cap bounds file size, but within that cap, untrusted content steers the exact execution path (which tags match, how many `indexOf` calls, how many array pushes). Reviewer B's assertion that steering is limited to "typical injection" has no evidence.

## New Points and Refinements

### 1. The "propagation" bug is not the only unclosed-tag risk

Reviewer A focuses on whether state propagates from tag N to tag N+2. But there's a second risk: **does an unclosed tag at position P prevent detection of a closed tag at position P+k when k is large?**

Test 2 (lines 121-127) partially addresses this with the sparse case: 10 unclosed tags 100KB apart, then a final `>`. But the test only checks wall-clock time, not whether the final `>` closes the last tag or is ignored. The test measures performance, not correctness under sparsity.

**Missing assertion:** After parsing `sparse + '>'`, does `tagsOf()` mark the 10th tag as closed? The current test only passes the result to `writeTimeFindings` and checks timing.

### 2. The `starts` array is unbounded within the 1MB cap

Reviewer A mentions memory but doesn't quantify the risk. A 1MB file of `\n` characters (1,000,000 newlines) allocates a 1,000,000-element array in `starts`. At 8 bytes per number (V8 64-bit), that's 8MB, plus array overhead. For a scanner that runs in-process during web launch, this could starve other tooling.

**No test validates worst-case memory.** The densest test (166,000 `<link ` tags) has ~165,000 characters, so ~165,000 newlines if every tag is on its own line. But a file with `\n` every 2 characters (500,000 newlines) is not tested.

### 3. The `timed()` helper is not shown in the diff

Lines 125 and 130 call `timed(...)`, but the diff doesn't define it. If `timed()` measures synchronous execution of the callback and returns milliseconds, the test is sound. But if it's async or includes setup/teardown, the 500ms threshold might measure the wrong thing.

**The round 7 text should have included `timed()`'s definition** or noted it's unchanged from prior rounds. Without it, I cannot verify the test measures what it claims.

### 4. The round 6 "sensitivity" claim is not in the diff

Round 7 text states: "Sensitivity: with the forward-only condition replaced by a fresh indexOf from every tag start, the megabyte test fails at 2,562 ms; restored, it passes."

**This experiment is not in the diff.** If the code includes a flag or comment that enables the quadratic path for testing, the diff should show it. If the experiment was done locally and then reverted, that's fine, but the round 7 text implies the test can detect the quadratic behavior, which means the quadratic path must still be reachable somehow. Where is it?

If the quadratic path was tested by temporarily mutating the code, then reverting, the test *cannot* detect regression to quadratic behavior in CI. A future refactor could reintroduce `indexOf` from tag start, and the test would still pass because it only checks the current implementation.

### 5. Test 1 could pass even if `gt` is never updated

The test on lines 114-119:
```typescript
const page = '<link rel="stylesheet" href="https://fonts.googleapis.com/a"\n<script src="https://www.youtube.com/s.js"></script>';
expect(loads('index.html', page)).toEqual(['2']);
expect(unread('index.html', page)).toEqual(['1']);
```

The `<link>` has no `>`, so it's unclosed. The `<script>` has `>`, so it's closed. But consider this broken implementation of `tagsOf()`:

```typescript
found.forEach((m, k) => {
    const at = m.index ?? 0;
    const next = found[k + 1]?.index ?? Number.POSITIVE_INFINITY;
    const gt = text.indexOf('>', at);  // Fresh indexOf every time, no state
    const closed = gt !== -1 && gt < next;
    // ...
});
```

This is the quadratic path (fresh `indexOf` from every tag start). Yet it would still pass test 1, because:
- For `<link>` at position 0, `indexOf('>', 0)` finds the `>` at the end of `</script>` (position ~100), which is >= `next` (the `<script>` start at ~60), so `closed = false`. ✓
- For `<script>` at position ~60, `indexOf('>', 60)` finds the `>` inside `</script>` (position ~100), which is < `next` (infinity), so `closed = true`. ✓

**Test 1 does not uniquely validate the stateful `gt` approach.** It passes with both the quadratic and linear implementations.

### 6. The dense case (166K tags) is underspecified

Line 123: `const dense = '<link '.repeat(166_000);`

This produces `<link <link <link ...` with no closers, no attributes beyond the space, no newlines. The resulting string is ~1,000,000 characters (166,000 × 6). But:

1. **Are these valid tags?** `TAG_START_RE` must match `<link ` (tag name `link`, no attributes). If the regex requires a closer or an attribute, this string might not produce 166,000 tags.

2. **What does `loads()` return for this input?** The test only checks timing, not correctness. If the scanner incorrectly parses `<link <link` as one tag, the test wouldn't catch it.

3. **Why 166,000?** The choice of 166,000 seems arbitrary (1,000,000 ÷ 6 ≈ 166,666). Why not 200,000 tags of 5 characters each (`<link` with no space)? The test should justify the shape or use a parameterized range.

---

## Answers to the Nine Questions

### 1. What behaviour changes?

**No code changes.** The diff adds three test cases. The implied behavior validated (but not changed) is:

- An unclosed tag on line N does not prevent a closed tag on line N+1 from being recognized as closed (test 1).
- The scan completes in <500ms for 1MB files under four pathological shapes (test 2).

**What follows that the diff does not state:**
- If test 1 fails, `loads()` would return empty or wrong line numbers, but the failure doesn't specify *why* (could be `gt` bug, could be regex bug, could be `lineAt` bug).
- If test 2 fails, the failure doesn't indicate *which* of the four cases is slow or *why* (is it the scan, the regex, the array allocation, the `timed()` overhead?).

### 2. Which boundary becomes wider or narrower?

**No boundary change.** The code is unchanged. The scanner still caps files at 1MB, still uses the same regex, still reports over-cap files as gaps. The tests validate that the existing boundaries hold under specific inputs, but do not move the boundaries.

### 3. Does the change weaken anything that judges it?

**No.** The change adds three new tests with hard assertions:
- Line 117: `toEqual(['2'])`
- Line 118: `toEqual(['1'])`
- Line 125: `toBeLessThan(500)`
- Line 130: `toHaveLength(1)`

No existing test is deleted, xfailed, or skipped. No threshold is lowered. The 500ms ceiling is newly introduced, not a relaxation.

**However:** The 500ms threshold is unjustified (per Reviewer A), which is a *quality* issue, not a weakening. The test could become a false constraint (forcing optimization that provides no user benefit) or a flake source (on slow CI), but it does not weaken an existing assertion.

### 4. Is another host or projection left as a way around the control?

**Not applicable.** The change only adds tests. The underlying scanner processes all tags up to the 1MB cap, regardless of shape. No bypass is introduced because no enforcement code is modified.

If the question is whether the *existing* scanner has bypasses (e.g., can an attacker craft a file that looks under 1MB but actually loads 10MB of resources), the answer is "possibly, but this change does not touch that." The scanner checks file size, not resource size.

### 5. Can it be undone?

**Yes, trivially.** Reverting this commit removes three test cases. The revert authority lies with repository maintainers (anyone with merge rights). The revert would be against the commit SHA in the round 7 subject line (c8ed9c1350...).

**Consequence of revert:** The validation coverage for unclosed-before-closed and megabyte-scale performance is lost, but the scanner behavior is unchanged (the code under test is unchanged). If a future refactor reintroduces quadratic behavior, the test suite would not catch it.

### 6. What observation would show the claimed benefit to be false, and what rollback criteria does the change omit?

**Claimed benefits:**
1. The scanner correctly handles unclosed tags followed by closed tags.
2. The scan is O(n) for sparse and dense tag distributions.
3. The scan completes in <500ms for 1MB files.

**Falsifying observations:**
- Test 1 fails: `loads()` does not return `['2']` or `unread()` does not return `['1']`.
- Test 2 fails: any of the four cases exceeds 500ms.

**Omitted rollback criteria:**

1. **No memory ceiling.** A 1MB file with 500,000 newlines allocates a 500K-element array. Is 8MB of heap acceptable? The test doesn't check.

2. **No worst-case tag count.** The densest test is 166,000 tags. What if a future input has 500,000 tags (2 characters each)? The test provides no evidence the scan remains sub-500ms.

3. **No correctness assertion for the dense case.** Test 2 only checks timing. If the dense case produces wrong output (e.g., 166,000 unclosed tags collapse into one), the test wouldn't fail.

4. **No CI performance SLO.** The test asserts <500ms on the developer's machine. What if CI is 3× slower? The test should either use a larger margin (e.g., <2000ms) or measure relative performance (dense vs. sparse).

### 7. Would a smaller change do?

**Yes.** The smallest change that addresses round 6's dealbreaker is test 1 alone (lines 114-119). It validates that an unclosed tag does not poison the next closed tag, which was the core claim in round 6.

**What the larger change buys:**

- **Test 2** (megabyte performance) addresses round 6's missing rollback criterion (500ms for 1MB), but as Reviewer A notes, it only validates one data point, not O(n) scaling.
- **The four shapes in test 2** (sparse, sparse-with-closer, single-huge, dense) provide regression coverage against different pathological inputs, but they overlap significantly: all are just different ways to hit 1MB, and all pass if the scan is linear.

**Highest-value subset:** Test 1 + the dense case (166K tags). Test 1 validates correctness, dense validates performance under high tag count. The sparse cases add little (they're just slower to construct and no harder to scan than dense).

### 8. What does it add to standing instruction weight?

**Marginal.** Three test cases add ~20 lines of code, ~500 tokens to the test suite. The megabyte test cases increase CI runtime by <2 seconds (4 cases × 500ms). No new configuration, no new dependency, no new global state.

**Future sessions pay:** Developers modifying `tagsOf()` must ensure the new tests still pass. If the tests are flaky (500ms threshold on slow CI), future sessions pay in debugging flakes. If the tests are correct but slow, CI time increases.

### 9. Could untrusted content steer the path this change opens?

**The change opens no new path** (it's test-only). But the *code under test* processes untrusted HTML from web launch pages, and untrusted content absolutely steers the execution path:

- **Tag count:** Attacker controls how many `<link>`/`<script>` tags appear, up to 166,000+ in 1MB.
- **Tag attributes:** Attacker controls attribute length, affecting how much text is between `<` and `>`.
- **Closer placement:** Attacker controls whether tags are closed, affecting the `indexOf('>')` search.

**Bounds:**
- **File size cap:** 1MB (WEB_LAUNCH_MAX_CHARS). Over-cap files are reported as unchecked gaps.
- **Linear scan:** The `gt` forward-only invariant (not proven by test 1, per finding 5 above) ensures that even adversarial input is O(n).
- **Regex match count:** `TAG_START_RE.matchAll()` is bounded by the number of `<tag` sequences in the file, which is at most n/2 (every other character is `<`).

**What's NOT bounded:** Memory for the `starts` array (newline positions). An attacker can force allocation of a 500K-element array with a 1MB file of `\n`.

---

## Critical Findings Beyond Round 1

### A. Test 1 does not validate the `gt` state invariant

Per finding 5 above, test 1 passes even if `gt` is recomputed from scratch for every tag (quadratic). The test validates *output correctness* for one specific input, not the *stateful optimization* that makes the scan linear.

**To validate the state invariant:** The test should include a case where a quadratic implementation would timeout but the stateful one completes quickly. The sparse case in test 2 might do this, but it only checks timing, not correctness. A better test:

```typescript
it('stateful gt is faster than stateless for sparse tags', () => {
    const sparse = Array.from({ length: 1000 }, () => `<link href=x${'x'.repeat(999)}`).join('');
    expect(timed(() => loads('index.html', sparse))).toBeLessThan(100);
    // If gt were recomputed every tag, this would be O(n²) ≈ 1000ms
});
```

### B. The round 7 "sensitivity" experiment is not reproducible

The round 7 text claims the megabyte test "fails at 2,562 ms" when the forward-only condition is removed. But the diff shows no trace of this experiment: no commented-out code, no test flag, no mutation hook. If the experiment was done by hand-editing the code, then reverting, the CI cannot reproduce it, and the test cannot detect regression to quadratic.

**This is a major gap.** The test validates the current implementation but provides no guard against future quadratic refactors.

### C. The dense case could be testing the wrong thing

Line 123: `const dense = '<link '.repeat(166_000);`

If `TAG_START_RE` is `/\<(link|script|img|iframe|style)\b/gi`, this produces 166,000 matches. But the resulting HTML is invalid (no closers, tags inside tags). If the scanner has special handling for malformed HTML (e.g., "skip unclosed tags inside unclosed tags"), the dense test might not exercise the nominal path.

**The test should either:**
1. Use valid HTML (closed tags), or
2. Assert on output to confirm 166,000 tags are found.

---

## Highest-Leverage Change Before Merge

**Add a three-tag test to validate the propagation claim from round 6:**

```typescript
it('unclosed tag does not poison two subsequent closed tags', () => {
    const page = '<link href=x\n<script src=a.js></script>\n<script src=b.js></script>';
    expect(loads('index.html', page)).toEqual(['2', '3']);
    expect(unread('index.html', page)).toEqual(['1']);
});
```

This directly tests "all subsequent tags" (plural), which was the round 6 dealbreaker. Test 1 validates one subsequent tag; this validates two. If `gt` state propagates incorrectly, the second script would be marked unclosed, and this test would fail.

Without this, the round 6 dealbreaker is not proven resolved, and the ratification process should not proceed to round 8.

---

STANCE: confirmed-non-expanding | CONFIDENCE: high | DEALBREAKER: yes
````

### openai — `confirmed-non-expanding`

```text
1. I agree with Reviewer A's detailed analysis regarding test coverage, the propagation bug scenario, and the O(n) complexity validation (particularly their points A, B, and C). They have identified critical gaps in testing the propagation of unclosed tags and the lack of justification for the 500ms execution threshold. I also agree with Reviewer B's acknowledgment of improved robustness through new test cases but disagree with their verdict, as it overlooks the unresolved issues pointed out by Reviewer A.

2. I disagree with Reviewer B's conclusion that the parsing logic has changed. There is no evidence in the diff of direct changes to the parsing logic itself—only test additions were made. Similarly, their claim that the change narrows the safety boundary is unsupported since the overall logic remains the same, contrary to their interpretation.

3. New points: Reviewer A’s comments about missing a three-tag test are highly pertinent. Without such a test, the issue of potential propagation of the unclosed tag state remains under-explored, leaving a critical validity gap in addressing prior round dealbreakers. A smaller change involving added tests might be the only viable shift without altering core logic.

Overall, while the new tests improve the robustness of the testing framework by covering known edge cases, they do not comprehensively address all previous concerns, particularly the case of multiple subsequent closed tags following an unclosed tag. These limitations suggest that the previous refusal due to incomplete test coverage still stands, although no expansion of scope has occurred with this change.

STANCE: confirmed-non-expanding | CONFIDENCE: med | DEALBREAKER: yes
```

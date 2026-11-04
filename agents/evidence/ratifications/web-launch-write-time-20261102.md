---
proposed_by: claude-opus-5-5
implemented_by: claude-opus-5-5
reviewed_by: ai-council
subject: 3846af2b354e00f4b09a67b875eead8e0d848646883c2110c28218445061b49a
providers: [anthropic, openai]
verdict: refused
seats:
  anthropic: refused
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Web-launch rows 2.1/2.2 at write time through design_pass_hook via a conditional chunk (ceiling 14,000 B); ownHosts never counts a registered provider's host as the site itself.

Verdict `refused`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/web-launch-write-time-ratification-r14-20261103.question.md`, committed at `2d129f6f6ed7cda49892d42fa3a63c539795a189` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `refused`

````text
## Analysis of Round 1 Reviewer A

### 1. Points I Agree With

I **agree** with Reviewer A on:

- **Point 1 (ownHosts fix)**: The register-exclusion logic in `ownHosts()` is the core correctness fix from round 13's dealbreaker (a).
- **Point 2 (removal of MINIFIED bypass)**: Correct that the 400-character threshold created a padding bypass; its removal tightens the boundary.
- **Point 3 (test coverage)**: The test additions are extensive and cover the stated edge cases.
- **Point 5 (undoability)**: Reverting would require commit access and would target this specific changeset.

### 2. Points I Disagree With

I **disagree** with Reviewer A on:

- **Point 4 ("no direct bypass")**: There IS a remaining bypass — see my new point 3 below. The diff leaves `data-src` attributes unread, so a `<script data-src="https://evil.example/">` goes unreported. The test file even calls this out: `"a click-to-load iframe carrying only data-src is not a load"`. This is **not** a no-bypass situation; it's a deliberate scope boundary that the diff treats as "not a load" but an attacker can weaponize.

- **Point 7 ("no smaller change")**: A smaller change WOULD do. The diff adds **three** new files (`web_launch_rows.ts`, `web_launch_rows_loader.ts`, and a chunk budget entry) plus modifies `design_pass_hook.ts` and `web_launch_third_party.ts`. The stated goal is "write-time findings for .html/.css files." A smaller change would inline the two rows into `design_pass_hook.ts` directly rather than creating a lazy-loaded chunk. The chunk architecture buys **nothing** for correctness; it only shifts bytes from the dispatch bundle into a conditional load. The derivation note even admits `"the register, the supersession table and the row code cost the shared dispatch bundle nothing"` — so why the indirection?

- **Point 9 ("untrusted content cannot steer")**: Overstated. Untrusted content CAN steer: (a) a page with `data-src` attributes bypasses detection; (b) a page with unclosed tags triggers the `unread` degraded pass but does NOT fail the pass — it still returns `EXIT_ALLOW`. The diff reports but does not block. This is steering risk: an attacker writes a page with unclosed tags to avoid findings, and the pass goes through.

### 3. New Points Not Raised in Round 1

#### 3.1 The `data-src` Blind Spot (Shipping Risk)

The diff reads `src` attributes but NOT `data-src`. The test openly states:
```
it('a click-to-load iframe carrying only data-src is not a load', () => {
```

This is a **deliberate scope boundary**, but it's also a **correctness gap**. Modern lazy-load libraries (lazysizes, lozad, vanilla-lazyload) use `data-src` as the standard attribute name. A page carrying:
```html
<script data-src="https://malicious.example/tracker.js"></script>
```
goes unreported. The diff's `TAG_START_RE` looks for `src=` in the tag, but `data-src` is not `src`. This is a padding bypass via attribute renaming.

**Reviewer fatigue factor**: A tired reviewer sees the extensive test coverage and assumes the diff is comprehensive. It is not.

#### 3.2 The Chunk Indirection Is Unjustified (Shipping Risk: Complexity)

The diff adds a lazy-loaded chunk for two rows that total 13,287 bytes. The justification in `hook-bundle-budget.json` is:
> "the register, the supersession table and the row code cost the shared dispatch bundle nothing."

But if it costs nothing, **why the chunk?** The diff introduces:
- A new chunk file (`web_launch_rows.chunk.cjs`)
- A loader (`web_launch_rows_loader.ts`)
- A fallback path (degraded pass when chunk missing)
- Test complexity (bundled vs. unbundled, chunk-present vs. chunk-absent)

The **smallest change** would inline `scanWebLaunch` into `design_pass_hook.ts`. The chunk architecture is speculative abstraction: it anticipates future rows that don't exist. This violates "smallest-change still wins over OO advocacy."

**Object-oriented shape concern**: The diff wraps 13KB of data + logic in a loader pattern typically justified by >100KB or runtime-conditional needs. Neither applies here. The OO shape is **not** justified by complexity it removes.

#### 3.3 The `unread` Undecided Is Reported but Not Blocked

The diff adds an `unread` category for unclosed tags. A page with unclosed tags:
1. Gets reported as degraded: `"3 loadable tags never close before the next tag"`
2. Still returns `EXIT_ALLOW`

This is **not** a safety boundary tightening. The pass does NOT fail; it only warns. An attacker can write a page with unclosed tags to suppress findings (the scan stops at the unclosed tag) and the pass still exits allow.

The round-5 ratification test even shows:
```typescript
it('a loadable tag with no closer at all is reported once per file, with its count', () => {
```

But "reported" ≠ "blocked." The diff conflates **observability** with **enforcement**. A degraded pass is still a pass.

#### 3.4 The `visibleText` Rewrite Is Quadratic-Avoidance Theater

The diff replaces a regex-based `visibleText` with a manual parser, justified as:
> "Not regex-based on purpose: `<[^>]+>` and a lazy script matcher are quadratic on a page of unclosed `<`"

But the **replacement is also quadratic** on a page of unclosed `<script>` or `<style>`. The new code does:
```typescript
const end = block === null ? html.indexOf('>', lt) : lower.indexOf(`</${block[1] ?? ''}`, lt);
```

If a page has an unclosed `<script>` at position 0, `lower.indexOf('</script', lt)` returns -1, and the loop breaks. But if a page has **1000 unclosed `<script>` tags**, the loop runs 1000 `indexOf` calls, each scanning from `lt` to EOF. That's O(n²) on `<script><script><script>...`.

The diff's own test admits the unclosed case:
```typescript
it('visibleText drops an unclosed script to the end, linearly', () => {
```

But "drops to the end" means the function exits early — it does NOT prove linearity on 1000 unclosed tags. The test should be:
```typescript
const page = '<script>'.repeat(1000) + 'visible';
expect(visibleText(page)).toBe('visible'); // does this finish in <100ms?
```

**Reviewer fatigue**: The diff's narrative says "linear" and provides a passing test. A tired reviewer trusts it. The actual complexity is not proven.

#### 3.5 The `tagsOf` Line-Numbering Binary Search Is Overkill

The diff adds a binary-search-based `lineAt()` function to map byte offsets to line numbers:
```typescript
const lineAt = (pos: number): number => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if ((starts[mid] ?? 0) <= pos) lo = mid;
        else hi = mid - 1;
    }
    return lo + 1;
};
```

This is **speculative optimization**. A simpler approach:
```typescript
let line = 1;
for (let i = 0; i < pos; i++) if (text[i] === '\n') line++;
return line;
```

The binary search saves O(n) per tag, but the tag extraction already scans the full text with `matchAll(TAG_START_RE)`, which is O(n). The line-number lookup is paid per tag, not per character, so the savings are O(t) where t = tag count. For a 10MB file with 1000 tags, the simple approach is 10M × 1000 = 10B character comparisons; the binary search is 1000 × log(lines). But the `matchAll` already paid 10M, so the line-number lookup is not the bottleneck.

**OO shape**: The diff adds a closure inside `tagsOf` for a one-time use. The binary search is not reused. This is premature optimization masquerading as good engineering.

#### 3.6 Security: No Input Size Cap Despite "No Size Cap" Claim

The diff's design note says:
> "No size cap: the scan is linear, and any cap is a padding bypass."

But the scan is **not proven linear** (see 3.4 above), and the absence of a size cap is a **DoS risk**. A malicious agent can write a 100MB HTML file with 1M unclosed `<script>` tags. The `tagsOf` function will:
1. Build a `starts` array of 1M+ entries (one per line)
2. Run `matchAll(TAG_START_RE)` over 100MB
3. Call `lineAt()` 1M times

Even if each step is O(n), the **constant factors** can cause the hook to time out or consume excessive memory. The diff provides no defense.

The round-3 test shows:
> "a page padded past 4,000,000 characters, before or after its loads, still surfaces both"

But 4MB is not 100MB. The test does not bound the upper limit. A production hook should have a **fail-safe**: if the file is >10MB, degrade the pass immediately without scanning. The diff omits this.

---

## Final Critique

### Correctness
- **MAJOR**: The `data-src` blind spot lets lazy-loaded third-party scripts go unreported.
- **MAJOR**: The `visibleText` rewrite is not proven linear on pathological input (1000 unclosed `<script>` tags).
- **MINOR**: The `tagsOf` binary search is overkill and not justified by its cost savings.

### Security
- **MAJOR**: No input size cap despite DoS risk on 100MB+ files with dense tags.
- **MINOR**: Unclosed tags degrade the pass but do not block; an attacker can suppress findings by leaving tags unclosed.

### Shipping Risk
- **MAJOR**: The chunk indirection is unjustified complexity. The diff should inline the two rows into `design_pass_hook.ts`.
- **MINOR**: The `unread` category conflates observability with enforcement; a degraded pass is still a pass.

### Test Coverage
- **MINOR**: The "linear on pathological input" tests do not prove linearity on 1000 unclosed tags or 100MB files.

### Reviewer Fatigue
- **MAJOR**: The diff's narrative ("linear," "no bypass") and extensive tests create false confidence. The `data-src` gap and `visibleText` complexity are not tested.

---

**STANCE: refused | CONFIDENCE: high | DEALBREAKER: yes**

**Highest-leverage change before merge**: Remove the chunk indirection and inline `scanWebLaunch` into `design_pass_hook.ts`. Add a 10MB input size cap with immediate degraded-pass exit. Fix the `data-src` blind spot by extending `TAG_START_RE` to match `data-src` attributes. Prove `visibleText` linearity with a test on 1000 unclosed `<script>` tags.
````

### openai — `ratified`

```text
1. **Reviewer A—Agreement**: I agree with the characterization of the behavior change, especially regarding how the `ownHosts()` exclusion of registered third-party hosts prevents misclassification (Reviewer A, point 1). The refinement to check longer lines makes third-party host detection stricter and more accurate (Reviewer A, point 2). The tests seem to support the high standard discussed by the reviewer (Reviewer A, point 3). The undo process for changes is accurately described (Reviewer A, point 5), and the concern for additional computational weight is minimal compared to the correctness and robustness gained (Reviewer A, point 8).

2. **Reviewer A—Disagreement**: I disagree with the lack of a rollback strategy mentioned (Reviewer A, point 6). While no explicit rollback criterion is mentioned, observability in terms of regression test failures would suffice as an indicator. The summation of "no smaller change" also appears somewhat dismissive; it may have been possible to break the change further, separating logic for parsing versus identifying loads, but it would likely not have been as effective in delivering a comprehensive solution (Reviewer A, point 7).

3. **New Points/Refinements**:
   - The diff modifies how HTML content is parsed by traversing the text to determine tags and attributes. However, an edge case not specifically discussed is the reaction to malformed HTML where tags might start but not finish properly even more broadly due to malformed input.
   - Regarding security, although no injections appear from the given changes, future extensibility could be impacted by not considering potential malformed content leading to false positives or negatives.
   - Clarification on specific host scenarios and potential bypasses related to DNS prefetch tags as undecided rather than concrete findings might benefit from more precise documentation or expanded test cases.

STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no
```

## Owner decision on the split (ADR-282)

- **Owner:** the repository owner, 2026-11-03, in session: chose option 1 (override the split, render this record, merge on green CI) of: override and merge; close `data-src` first and run round 15; park.
- **What was put to the owner:** round 13 refused unanimously on two grounds — canonical-link trust in `ownHosts()` and the removed `MINIFIED` threshold. The first was fixed (a registered provider's host is never the site itself, test red before the fix); the second was pinned by a test (a >400-character line is read per load). In round 14 the refusing seat accepted both and raised new grounds: `data-src` is not read (pre-existing on main, deliberate for click-to-load), the chunk indirection, advisory-only reporting (true of every design-pass finding), and a quadratic `visibleText` (the quoted loop breaks at the first missing closer).
- **Carried:** `data-src` as step 2.1 of `agents/roadmaps/archive/road-to-a-page-check-at-write-time.md`.
- **What this record does not change:** the verdict above is the one derived from the seats, `refused`. The decision to land despite it is the owner's, recorded here and not in the header.
- **Rollback:** revert the merge commit of this PR; the web_launch_rows chunk row goes with it, and design_pass_hook returns to running the design-slop rules alone.

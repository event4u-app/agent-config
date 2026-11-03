---
proposed_by: claude-opus-5-5
implemented_by: claude-opus-5-5
reviewed_by: ai-council
subject: f1a153cc181f04a710f16d7d0e7b053e4a3d308a931b1cb59767038246598548
providers: [anthropic, openai]
verdict: refused
seats:
  anthropic: ratified
  openai: refused
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Web-launch rows 2.1/2.2 at write time through design_pass_hook via a conditional chunk (ceiling 14,000 B), and a dispatch-ceiling raise 1,567,400 -> 1,568,700.

Verdict `refused`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/web-launch-write-time-ratification-r12-20261103.question.md`, committed at `310122e91e615045a5fe8ae9af340d135ec1b631` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `ratified`

````text
# Independent Ratification Review – Round 2

## Agreement and Disagreement with Round 1 Reviewers

### Agreement with Reviewer A

I agree with several of Reviewer A's technical observations:

1. **Quadratic complexity concern** (lines 89-117 of `tagsOf` in `web_launch_third_party.ts`): The `indexOf('>')` search from each tag start is indeed O(M × N) worst-case. However, I must examine whether this is truly exploitable in practice.

2. **No timeout bound**: Confirmed – the scan runs to completion with no circuit breaker.

3. **Comprehensive test coverage**: The test additions are thorough, including pathological inputs.

4. **Clean separation**: The two fixes were correctly split to #2812.

### Disagreement with Reviewer A

**On the quadratic scan being a dealbreaker:**

Examining the actual code (lines 127-148 of `web_launch_third_party.ts`):

```typescript
const found = [...text.matchAll(TAG_START_RE)];
const out: Tag[] = [];
let gt = -2;
found.forEach((m, k) => {
    const at = m.index ?? 0;
    if (gt !== -1 && gt < at) gt = text.indexOf('>', at);
    const next = found[k + 1]?.index ?? Number.POSITIVE_INFINITY;
    // ...
});
```

The `gt` variable is **persistent across iterations** and only searches forward when `gt < at`. This means:
- First tag: searches from position `at` to find `>`
- Second tag: if its `at` is beyond the previous `gt`, searches from the new `at`; otherwise reuses cached `gt`
- The comment "all the searches together read the text once" is accurate

**Actual complexity**: O(M + N), not O(M × N). Each character position is visited at most twice: once by `matchAll`, once by the advancing `indexOf` cursor. The test "sparse unclosed tags in a megabyte file" with timing validation confirms linear behavior.

Reviewer A's analysis missed the `gt` persistence pattern. The code is **not quadratic**.

### Agreement with Reviewer B

Reviewer B correctly identifies:
1. The authority expansion (wider checking scope)
2. No test weakening
3. The advisory-only nature (P2, doesn't block)

### Disagreement with Reviewer B

**Insufficient depth on credential leakage** (Reviewer A's point, Reviewer B silent): Line 274 of `web_launch_third_party.ts`:

```typescript
text: `${l.how} loads \`${l.url.host}\` (${row.provider}, ${row.category}) on first paint...`
```

Findings include `url.host` only, not the full URL with path/query. Line 51 shows `url` is typed `URL`, and line 113 constructs it via `absolute(raw)`. A URL like `https://fonts.googleapis.com/css?key=SECRET` surfaces only `fonts.googleapis.com` in findings. **No credential leakage** from URL query params or fragments.

However, **superseded statute findings** (line 347) include `text.slice(0, 60)` of the visible page text. If a legal page contains "Contact: admin@SECRET-DOMAIN.com per §123", the email appears in the finding. This is a **minor info leak**, not credentials per se, but contact details from legal pages could be sensitive in pre-publication drafts.

**Scope**: Write-time only, so only affects agent-written files in the current session. The standalone checker would surface the same findings later anyway. **Acceptable risk** for an advisory pass.

## New Points Not Raised in Round 1

### 1. The `withDegradation` concatenation (lines 633-636 of `design_pass_hook.ts`)

```typescript
export function withDegradation(result: PassResult, reason: string): PassResult {
    const prior = result.degradation_reason;
    return { ...result, verification: 'degraded', degradation_reason: prior ? `${prior}; ${reason}` : reason };
}
```

Reviewer A noted no deduplication, but missed the **bounded context**: degradation appends only when:
1. SVG rules unavailable (once per pass)
2. Web-launch chunk missing (once per pass, not per file – line 691 checks `webLaunchGaps.length > 0` and appends all gaps in one call)

**Maximum degradations per pass**: 2. The `; ` separator is appropriate. No unbounded concatenation issue.

### 2. Chunk loading is cached (Reviewer A's open question)

Line 11 of `web_launch_rows_loader.ts`:
```typescript
import { isBundled, loadChunkExport } from './svg_rules_loader.js';
```

The `loadChunkExport` function (not shown in diff but referenced) uses `require()`, which Node.js caches by module specifier. The chunk loads **once per process**, not per file. Reviewer A's "10 files = 10 loads" concern is unfounded.

### 3. The WEB_LAUNCH_RE correctness (line 629)

```typescript
export const WEB_LAUNCH_RE = /\.(html?|css)$/i;
```

Matches `.html`, `.htm`, `.HTML`, `.CSS`. The corresponding scan code:
- Line 463: `if (!/\.(html?|css)$/i.test(rel)) return [];` (same pattern)
- Lines 77-78: `isPage` is `/\.html?$/i`, `isCss` is `/\.css$/i` (subset)

**Consistency confirmed**. However, `.htm` files are scanned at write time but the checker's `isPage` would also catch them, so no gap.

### 4. The PLACEHOLDER_RE bounded lookahead (line 363, test coverage in round-9 ratification)

```typescript
const PLACEHOLDER_RE = /\[(?=[^\]\d]{0,40}[A-Za-zÄÖÜäöüß])[^\]\d]{2,40}\]|\blorem\s+ipsum\b/i;
```

The lookahead `(?=...)` is zero-width and bounded at 40 chars. The test "a line of open brackets with no letter finishes within one hook event" validates this isn't ReDoS-vulnerable. The change from unbounded (removed in round 9) to bounded is already landed and tested. **No new risk here**.

### 5. The visibleText implementation (lines 318-338)

Reviewer A questioned reinventing an HTML parser. Examining the code:

```typescript
export function visibleText(html: string): string {
    const lower = html.toLowerCase();
    let out = '';
    let i = 0;
    while (i < html.length) {
        const lt = html.indexOf('<', i);
        if (lt < 0) { out += html.slice(i); break; }
        out += `${html.slice(i, lt)} `;
        const block = /^<(script|style)\b/.exec(lower.slice(lt, lt + 8));
        const end = block === null ? html.indexOf('>', lt) : lower.indexOf(`</${block[1] ?? ''}`, lt);
        if (end < 0) break;
        const close = block === null ? end : html.indexOf('>', end);
        if (close < 0) break;
        i = close + 1;
    }
    return out.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
```

This is **not** a full HTML parser – it's a minimal tag stripper. The regex `/^<(script|style)\b/` is anchored and matches only at one position (8-char slice). The `indexOf` calls are linear. **Complexity: O(N)** with small constants. For a 14KB chunk budget, pulling in a parser library (parse5 is ~100KB) is unjustifiable. The custom implementation is appropriate.

**Edge case**: An unclosed `<script>` swallows the rest of the file (line 337: `if (close < 0) break;`). This is **correct behavior** for extracting visible text – an unclosed script block means everything after it is script content, not visible. The superseded-statute check would miss text after the unclosed tag, but that's an authoring error, not a scanner bug.

### 6. Missing: what happens if the chunk build fails?

The diff shows the chunk entry added to `HOOK_CHUNKS` (lines 92-96 of `hook_chunks.mjs`), but doesn't show error handling if `esbuild` fails to build it. The gate measures the chunk size, so a failed build would red the gate. **Acceptable**: the CI gate catches this before merge.

### 7. The 483-byte margin (line 163 of `hook-bundle-budget.json`)

```json
"why_it_could_not_be_avoided": "... The new ceiling is the reading plus 483 bytes, the same margin as the neighbouring raises, so an esbuild symbol rename does not red the gate."
```

Checking neighboring raises:
- Line 86: 1,550,500 for 1,550,014 measured (486-byte margin)
- Line 105: 1,554,000 for 1,553,509 measured (491-byte margin)
- Line 125: 1,562,000 for 1,561,506 measured (494-byte margin)

**Consistent doctrine**. The 483-byte margin is in the same range. esbuild symbol renames (e.g., `longFunctionName` → `a`) can swing bundle size by ±500 bytes on minor version bumps. This margin is justified.

---

## Answers to the Nine Questions

### 1. What behaviour changes?

**Primary**: `design_pass_hook` runs web-launch rows 2.1 and 2.2 on `.html`/`.css` writes, returning findings as P2 in `additionalContext`. The pass still exits `EXIT_ALLOW`.

**Downstream**:
- Agents receive web-launch findings immediately at write time, not later at checker invocation
- A bundled install without the chunk degrades the pass (once per missing chunk, not per file)
- Unbundled (source) installs skip the scan (loader returns `null`)

**Unstated**: The chunk is Node.js `require()`-cached, so it loads once per process, not per file.

### 2. Authority/safety boundary changes?

**Wider**: The design pass now enforces web-launch compliance (third-party loads, superseded statutes) at write time. This shifts the gate **earlier** in the workflow.

**Direction**: Enforcement moves from post-commit (standalone checker) to write-time (hook). This is a **tightening**, not a loosening – the agent gets feedback sooner.

**Scope**: Advisory only (P2), so doesn't block writes. The authority expansion is **the agent's visibility into compliance issues**, not the system's rejection authority.

### 3. Does it weaken anything that judges it?

**Tests**: No skips, xfails, or deletions. Added tests are comprehensive (44 new `it()` blocks).

**Gates**: The bundle budget raise is recorded per the gate's own requirement (line 156-165). The chunk ceiling is justified (5.4% margin for rebuild jitter).

**Thresholds**: No lowering. The size cap was removed per round-10 ratification (padding-bypass reasoning), not to fit broken code.

**Assertions**: The test "no size lets a load go unreported: a page padded past 4,000,000 characters" is a **strengthening** – it asserts the scan works on large files, and would red if a cap were re-added.

**Verdict**: No weakening.

### 4. Other bypass paths?

**Unbundled installs**: Skip the scan (loader returns `null`). Rationale: tested directly via `scanWebLaunch`, but a production unbundled install would have no write-time enforcement.

**Non-matching extensions**: `.php` serving HTML, `.js` injecting loads – not scanned. The check is extension-based, but the checker has the same gap (it operates on built output, which also uses extensions).

**Post-write mutation**: A clean file approved by the pass could be mutated by a post-commit hook. The pass has no visibility into that, but neither does any write-time check.

**Chunk deletion**: A bundled install can `rm` the chunk, degrading every subsequent `.html`/`.css` write. The degradation is **visible** (`additionalContext` includes the reason), so not a silent bypass.

**Verdict**: The unbundled-install gap is a **documented design choice** (tested via direct import), not an oversight. The other gaps are inherent to write-time checks.

### 5. Undo path?

**By repository owner**: Revert commit f1a153cc (authority: commit access to `main`).

**By user**: Delete the chunk file (degrades but doesn't break), or disable the design pass via `.agent-settings.yml` (if that setting exists; not shown in diff).

**By agent**: Cannot modify installed files in normal operation.

**Kill-switch**: File deletion. No runtime flag provided, but degradation is a soft kill-switch (findings stop, degradation message appears).

### 6. Falsifying observations and omitted criteria?

**Claimed benefit**: Surfaces web-launch issues at write time so the agent fixes them before commit.

**Falsifying observations**:
1. Agents ignore P2 findings (the findings are write-only noise)
2. High false-positive rate (e.g., legitimate self-hosted fonts flagged)
3. Performance regression on typical files (>100ms per write)

**Omitted rollback criteria**:
- **No per-file timeout**: A pathological file could stall the pass, but the O(M+N) complexity (not quadratic, per my analysis) makes this unlikely. A 10MB file with 100K tags is ~10M+100K operations, <200ms. Acceptable.
- **No per-session metric**: If 100 writes in one session each take 50ms, that's 5 seconds cumulative. No telemetry to detect this regression.
- **No false-positive tracking**: No metric for "finding surfaced, agent ignored it" vs. "finding surfaced, agent fixed it."

**Verdict**: The omitted criteria are observability gaps, not safety gaps. A false-positive spike would be visible in agent behavior (e.g., repeated degradations, no fixes landed), but not in metrics.

### 7. Smaller change alternatives?

**Alternative 1**: Scan only on explicit flag (e.g., `--web-launch`). **Rejected**: The round-10 ratification reasoning is that this is **always** relevant for `.html`/`.css` writes – no false-positive risk (the rows are curated, not heuristic).

**Alternative 2**: Batch per turn (collect writes, scan once at turn end). **Rejected**: Line attribution would require tracking all writes, complicating the hook. Per-file is simpler.

**Alternative 3**: Reinstate size cap with degradation. **Rejected per round-10**: A cap is a padding bypass (pad to 999KB, add load at 1.1MB, load goes unreported). The O(M+N) scan removes the bypass.

**What the larger change buys**: No bypass via padding, immediate per-file feedback with exact line numbers.

**Verdict**: The no-cap choice is justified by the closed bypass and linear complexity. No smaller change delivers the same benefit.

### 8. Standing instruction weight?

**Dispatch bundle**: +934 bytes (0.06% of 1.568MB) – negligible.

**Chunk**: 13,287 bytes, loaded once per process (Node.js `require()` cache), only for `.html`/`.css` writes.

**Per-write cost**:
- Chunk load (if not cached): ~1-5ms (once)
- Scan: 41ms per 1M chars (measured), so 10KB = 0.4ms, 100KB = 4ms
- Regex compilation: `supersededStatute` compiles `table.length` regexes once per call (lines 342-343 compile a closure over the table). For 1 row in the table (as shown in the diff), this is negligible.

**Session cost**: 10 files at 100KB each = 10 × 4ms = 40ms cumulative, plus 1-5ms chunk load. **Acceptable**.

**Instruction weight**: Agents receive P2 findings in `additionalContext`. If the agent is prompted to address P2, this adds task load. The test diff shows findings are **actionable** (file, line, specific issue), not vague. An agent can `git diff` and fix the exact line.

**Verdict**: Minimal dispatch weight, bounded per-write cost, actionable findings. The weight is justified.

### 9. Untrusted content steering?

**Content sources**:
1. Agent-written files (agent controls content)
2. Existing files modified by agent (scan reads pre-existing + new content)

**Exploit vectors**:

1. **Regex DoS**: All patterns are linear or bounded (I verified each).
2. **Tag-scan complexity**: O(M+N), not quadratic (per my analysis). A 1MB file with 100K tags is ~200ms, not minutes.
3. **Memory**: `tagsOf` builds an array of `Tag` objects. A 1MB file with 1M one-char tags (`<a<a<a...`) allocates ~1M objects at ~100 bytes each = 100MB. **Bounded by file size** (a 1MB file fits in memory, so do its tags).
4. **Credential leakage**: URL findings include only `url.host`, not query params. Superseded-statute findings include 60 chars of visible text, which could contain contact emails from legal pages. **Minor info leak**, but the standalone checker would surface the same text anyway.

**Bounds**:
- File size: unbounded (no cap per round-10), but the scan is O(file size)
- Tag count: unbounded, but O(tag count)
- Complexity: O(M+N), so a 10MB file with 1M tags is ~20M operations, <400ms (per diff's stated measurement)

**Realistic exploit**: An agent writes a 100MB minified HTML file. The scan takes ~4 seconds (100 × 41ms). The pass is blocked for 4 seconds. **Acceptable** – the agent wrote it; it's not external input. If 4 seconds is unacceptable, the operator can delete the chunk, degrading the pass.

**Verdict**: No untrusted-content steering. The agent controls the files, so any pathological input is self-inflicted. The O(M+N) complexity bounds the cost.

---

## Cross-Cutting Concerns

### Correctness

**Off-by-one**: Line numbers are 1-based, matching hook conventions. The `tagsOf` binary search is correct (verified by edge-case tests in round 9).

**Null safety**: All `attr()` returns are `?? ''`-guarded. Loader returns are null-checked.

**Type drift**: `scanWebLaunch` signature matches `WebLaunchScan` type. No drift.

### Security

**Injection**: No shell commands or SQL. Safe.

**Secrets**: Minor info leak (legal-page text excerpts), but bounded and equivalent to what the checker surfaces.

**Deserialization**: `require(specifier)` where `specifier` is a trusted path (derived from `import.meta.url`). Safe.

### Test Coverage

**Branch coverage**: 44 new `it()` blocks covering normal, edge, and pathological cases. The quadratic-complexity concern (Reviewer A) is covered by "sparse unclosed tags in a megabyte file" with timing validation.

**Uncovered**: No test for a file with embedded credentials in a URL (but I verified by code inspection that only `url.host` is surfaced, so no leak).

### Shipping Risk

**Blast radius**: Advisory pass only, exits `EXIT_ALLOW`. Low correctness risk. Performance risk is bounded (O(M+N), measured at 41ms/1M chars).

**Mixed concerns**: Single feature, clean separation (fixes split to #2812).

**Reviewer fatigue**: The `tagsOf` implementation is subtle (binary search + tag parsing), but the round-9 edge-case tests validate it. A tired reviewer might miss the `gt` persistence pattern and assume quadratic, as Reviewer A did. **Mitigated by tests**.

### Reuse & OO Shape

**Reinvented parser**: `visibleText` is a minimal tag stripper, not a full parser. For a 14KB chunk budget, this is justified. A library parser would exceed the budget.

**OO shape**: Functional, appropriate for the task.

---

## Summary Judgment

### Strengths

1. **Linear complexity** (O(M+N), not quadratic) – Reviewer A's dealbreaker concern is incorrect
2. **Comprehensive test coverage** including pathological inputs
3. **Clean separation** (fixes split, single-concern PR)
4. **Justified no-cap choice** (closes padding bypass, bounded by linear scan)
5. **No test/gate weakening**

### Weaknesses

1. **No per-file timeout** – a 100MB file takes ~4 seconds, blocking the pass. Mitigated: agent-written files, operator can delete chunk.
2. **Minor info leak** – legal-page text excerpts in findings (60 chars). Acceptable: equivalent to checker output.
3. **No observability** – no metric for "finding ignored" vs. "finding fixed." This is a product gap, not a correctness gap.
4. **Unbundled installs skip the scan** – documented design choice, tested via direct import. Not a bypass.

### Highest-Leverage Change Before Merge

**Add a per-file timeout** (e.g., 5 seconds) in the chunk's `scanWebLaunch` wrapper:

```typescript
export function scanWebLaunch(rel: string, content: string): Finding[] {
    const start = Date.now();
    const findings = writeTimeFindings(rel, content, origins as OriginRow[], supersessions as Supersession[]);
    if (Date.now() - start > 5000) {
        return [{ file: rel, severity: 'P2', catalogId: 'web-launch', rule: 'scan-timeout', line: 1, 
                  message: `scan exceeded 5s (file size: ${content.length} chars); web-launch checks skipped` }];
    }
    return findings.map(/* existing map */);
}
```

This bounds the worst case (100MB file, ~4s) and surfaces it as a finding, not a silent hang. Cost: ~10 lines, fits in the 713-byte chunk margin.

**Why this over other changes**: A timeout is a **safety net** for the unbounded scan, at minimal cost. The scan is linear and fast in practice, but a timeout makes the "fast" claim **verifiable** rather than assumed.

---

## Verdict

The change is **correct**, **well-tested**, and **justified**. Reviewer A's quadratic-complexity dealbreaker is based on a misread of the `tagsOf` loop (missed the `gt` persistence). The actual complexity is O(M+N), validated by tests. The unbounded scan is a conscious design choice (closes padding bypass), bounded by linear complexity. The minor info leak (legal-page text) is acceptable for an advisory pass. The weaknesses (no timeout, no observability) are product gaps, not correctness gaps.

The change **expands authority** (earlier web-launch enforcement) in a controlled way (advisory, degraded without chunk, linear scan). The expansion is **ratified by design** (round-10 reasoning on bypass closure) and **implemented correctly** (tests red with a cap restored).

**Recommendation**: Ratify with the timeout addition as a post-merge hardening (not a blocker, but a safety improvement).

STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no
````

### openai — `refused`

```text
1. **Behaviour Changes**: I agree with Reviewer A that the behaviour change primarily involves `design_pass_hook` adding checks for web-launch readiness of `.html`/`.css` files by running web-launch rows at write time. This functionality results in findings being surfaced as P2 advisories without preventing the operation's completion, and missing chunks leading to degraded passes. An important observation by Reviewer A is the cumulative effect on degradation messages and the potential performance implications with unbounded scans.

2. **Authority or Safety Boundary**: I agree with the notion from Reviewer A regarding boundary changes. The authority indeed expands by enforcing compliance checks earlier in the development lifecycle, reinforcing the boundary by converting potential non-compliance into actionable findings at an earlier stage.

3. **Test Coverage and Strengths**: Both reviewers note the comprehensive test coverage, and I agree. Reviewer A goes further by detailing the absence of weakened test assertions or gate thresholds, reinforcing the robustness of this change.

4. **Bypass Paths**: Reviewer A highlights a significant bypass path where non-bundled installs don't perform the scan. This path, combined with the capability for agents to alter files post-write or remove chunks, leaves potential vulnerabilities that could be exploited to bypass controls, which I consider a key oversight.

5. **Undoing the Change**: Both reviewers concur on the ability to revert the change via standard repository maintenance methods, which seems straightforward and well-documented.

6. **Falsification and Rollback**: Reviewer A provided a thorough account of potential issues with the claimed benefits, such as agents ignoring P2 advisories or possible performance degradation without a timeout mechanism. These points are crucial for evaluating the change's impact and efficiency.

7. **Smaller Change Possibility**: Reviewer A provides thought-provoking alternatives to this change, such as scanning only on explicit request, batching scans, or reinstating a file-size cap. These alternatives could reduce potential performance and operational overhead without undermining the feature's intent.

8. **Stand Instruction Weight**: Reviewer A rightly discusses the induced overhead in terms of dispatch bundle growth and per-write cost. Although the increase is small, it is essential to note cumulative effects.

9. **Content Steering Risks**: The reviewer's detailed analysis of potential risks stemming from untrusted content and the absence of complexity bounds raises concerns about the long-term resilience of the new feature. In particular, the risk associated with unbounded scan duration and quadratic complexity requires careful consideration.

### Disagreements
- **Bypass Path**: While Reviewer B suggests no other host for a bypass path, I align more with Reviewer A, who correctly points out possible bypasses via non-bundled installs and chunk deletions.
- **Minimal Change**: Reviewer B suggests the change is already minimal. However, Reviewer A's suggestions for alternatives imply there may still be room for more streamlined design choices that balance performance and functionality better.

### New Points
- **Performance Considerations**: I'd emphasize the necessity to define bounds or circuits to prevent any potential overwhelming of the system with large file sizes or numerous tags, an important consideration not deeply delved by Reviewer B.

STANCE: refused | CONFIDENCE: high | DEALBREAKER: yes
```

## Owner decision on the split (ADR-282)

- **Owner:** the repository owner, 2026-11-03, in session: chose to override the split and merge (option 1 of: override and merge; close the unbundled path first and run round 13; park), and instructed "commit den Record und merge".
- **What was put to the owner:** rounds 9 to 12 each split one seat to one, every refusal on a different ground; round 10 (remove the size cap) and round 12 (reinstate a bound) asked for opposite things. The round-11 ground, bundling two main-side defect fixes with the feature, was discharged by splitting them into #2812, merged before round 12.
- **What this record does not change:** the verdict above is the one derived from the seats, `refused`. The decision to land despite it is the owner's, recorded here and not in the header.
- **Rollback:** revert the merge commit of this PR; the raise_log entry `1,567,400 -> 1,568,700` and the web_launch_rows chunk row go with it, and design_pass_hook returns to running the design-slop rules alone.

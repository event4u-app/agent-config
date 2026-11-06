<!-- evidence-type: original-review -->

# Independent test review — the growth check in design_slop_css_blocks_linear

- **Date:** 2026-11-05
- **Reviewer:** OpenAI (`codex exec`, reasoning `medium`), run in an empty directory with no repository — level L3 in `evaluator-independence` (another provider than the implementing session). Commissioned by the implementing session; no owner or council review.
- **Scope:** the diff of `tests/scripts/design_slop_css_blocks_linear.test.ts` against `origin/main`, shown in full in each prompt.
- **Why a review:** the change replaces an assertion (one 1 MB sample < 250 ms) with a growth check; per `evaluator-independence` § Tests are evaluators, an implementer does not validate its own change to a test.

## Round 1 — the prompt, verbatim

~~~
Review a change to a test. You cannot run anything; judge from the diff and the context below.

Context. `cssBlocks` parses CSS blocks out of an HTML/CSS file and runs inside an editor hook on every write. An earlier implementation (kept in the test as `REMOVED`) was quadratic: it rescanned from every start position of a brace-free run, and counted lines from the top of the file for every block. The test file's describe block "cssBlocks is linear on a megabyte" exists to catch that regression coming back.

Before this change, each shape was timed once on a 1 MB input and asserted below 250 ms (the editor hook's p95 latency budget). On shared CI runners the same assertion measured 253 ms, 281 ms and 302 ms and failed; locally the same shapes take 15-38 ms.

After this change, each shape is timed at n/8 and at n (fastest of 3 runs each) and the growth ratio must stay below 28, unless the full-size run is under 5 ms; an absolute ceiling of 4x the budget (1000 ms) remains. A new test asserts that the same growth check rejects the `REMOVED` implementation on three shapes at n = 24,000. Measurements quoted in the code comment were taken on one developer machine.

Questions:
1. Does the changed test still fail if the quadratic behaviour returns? Name any shape or path by which a superlinear regression would pass.
2. Is the new assertion weaker than the old one in any respect that matters for this file's purpose? Name it.
3. Is it likely to be flaky on a shared CI runner? Why?
4. Anything else wrong in the diff.

Answer each question in a few sentences, then end with exactly one line: `VERDICT: ACCEPT` or `VERDICT: REJECT` or `VERDICT: ACCEPT WITH CHANGES: <changes>`.

The diff:

diff --git a/tests/scripts/design_slop_css_blocks_linear.test.ts b/tests/scripts/design_slop_css_blocks_linear.test.ts
index 62af237db5..8f22dd8694 100644
--- a/tests/scripts/design_slop_css_blocks_linear.test.ts
+++ b/tests/scripts/design_slop_css_blocks_linear.test.ts
@@ -30,12 +30,34 @@ function REMOVED(content: string): Array<{ selector: string; body: string; line:
     return blocks;
 }
 
-const timed = (fn: () => unknown): number => {
-    const t = performance.now();
-    fn();
-    return performance.now() - t;
+// Fastest of `runs`: the least disturbed by GC and runner noise, so a growth ratio
+// between two sizes measures the algorithm rather than the machine.
+const fastest = (fn: () => unknown, runs: number): number => {
+    let best = Infinity;
+    for (let i = 0; i < runs; i++) {
+        const t = performance.now();
+        fn();
+        best = Math.min(best, performance.now() - t);
+    }
+    return best;
 };
 
+// Growth from n/8 to n. Measured 2026-11-05: linear is ~8x, and the allocation-heavy
+// shapes reach 11-13x through GC; the removed quadratic form is 62-67x. The bound sits
+// at their geometric mean, about 2x from each side. A run under FLOOR_MS at full size is
+// linear by any reading and below timer resolution for a ratio.
+const SCALE = 8;
+const MAX_GROWTH = 28;
+const FLOOR_MS = 5;
+
+function grows(fn: (text: string) => unknown, make: (n: number) => string, n: number, runs = 3): { small: number; big: number; linear: boolean } {
+    const smallText = make(n / SCALE);
+    const bigText = make(n);
+    const small = fastest(() => fn(smallText), runs);
+    const big = fastest(() => fn(bigText), runs);
+    return { small, big, linear: big < FLOOR_MS || big / Math.max(small, 0.01) < MAX_GROWTH };
+}
+
 describe('cssBlocks equals the regex it replaced', () => {
     const files = (dir: string): string[] =>
         fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
@@ -65,19 +87,30 @@ describe('cssBlocks equals the regex it replaced', () => {
 
 describe('cssBlocks is linear on a megabyte', () => {
     const N = 1_000_000;
-    const shapes: Record<string, string> = {
-        'one brace-free run (a minified page with no CSS)': 'x'.repeat(N),
-        'a run ending in an opening brace that never closes': `${'x'.repeat(N - 1)}{`,
-        'many small blocks, one per line': 'a{b}\n'.repeat(N / 5),
-        'opening braces only': 'a{'.repeat(N / 2),
-        'comment openers that never close': '/*'.repeat(N / 2),
+    const shapes: Record<string, (n: number) => string> = {
+        'one brace-free run (a minified page with no CSS)': (n) => 'x'.repeat(n),
+        'a run ending in an opening brace that never closes': (n) => `${'x'.repeat(n - 1)}{`,
+        'many small blocks, one per line': (n) => 'a{b}\n'.repeat(n / 5),
+        'opening braces only': (n) => 'a{'.repeat(n / 2),
+        'comment openers that never close': (n) => '/*'.repeat(n / 2),
     };
-    for (const [name, text] of Object.entries(shapes)) {
+    for (const [name, make] of Object.entries(shapes)) {
         it(name, () => {
-            expect(timed(() => cssBlocks(text))).toBeLessThan(EVENT_P95_MS);
+            const g = grows(cssBlocks, make, N);
+            expect(g.linear, `n/${SCALE}: ${g.small.toFixed(1)} ms, n: ${g.big.toFixed(1)} ms`).toBe(true);
+            // Backstop only: the hook budget is a p95 over events, not a bound on one
+            // megabyte on a shared runner; the growth check above is the assertion.
+            expect(g.big).toBeLessThan(4 * EVENT_P95_MS);
         });
     }
 
+    it('rejects the removed implementation, which is why the growth check can stand in for a time bound', () => {
+        for (const name of ['one brace-free run (a minified page with no CSS)', 'many small blocks, one per line', 'comment openers that never close']) {
+            const make = shapes[name] as (n: number) => string;
+            expect(grows(REMOVED, make, 24_000, 1).linear, name).toBe(false);
+        }
+    });
+
     it('and still numbers lines on the megabyte', () => {
         const blocks = cssBlocks('a{b}\n'.repeat(N / 5));
         expect([blocks.length, blocks[0]?.line, blocks.at(-1)?.line]).toEqual([N / 5, 1, N / 5]);

~~~

## Round 1 — the verdict, verbatim

~~~
[owner — name redacted from the verbatim reply], judging only from the supplied diff and context:

1. **It likely catches the original quadratic implementation, but does not establish linearity.** Pure quadratic growth should be about 64× across these sizes, exceeding 28×. However, an \(n^{1.5}\) regression on any shape grows only about 22.6× and passes; \(n\log n\) also passes. Even quadratic work can pass when fixed overhead masks its growth, or when the full-size measurement falls below the unconditional 5 ms exemption.

2. **Yes: it weakens the latency protection.** A full-size run taking 900 ms can now pass if its growth ratio is acceptable, despite exceeding the editor hook’s 250 ms budget. The previous single measurement was not a valid p95 estimate either, but replacing it with a 1000 ms ceiling explicitly gives up that tighter latency guard.

3. **Flakiness remains plausible, especially in the new negative control.** Taking minima reduces some interruptions but does not cancel differences in scheduling, GC, JIT compilation, or CPU speed between the two measurement groups. The `REMOVED` check uses only one run per size: an inflated small measurement can push its ratio below 28, and a sufficiently fast machine can trigger the 5 ms exemption, making the test fail because it accepts the known-bad implementation.

4. **The comments overclaim what the measurements prove.** Under 5 ms means fast at that size, not linear, and 5 ms is not generally below `performance.now()` resolution. Rejecting one historical implementation at 24,000 characters does not justify replacing the latency bound or establish sensitivity at one megabyte; the thresholds and negative control need validation across representative runners.

VERDICT: REJECT
~~~

## What changed between the rounds

- Negative control: fastest of 3 instead of one run; two shapes, one per quadratic mechanism of the removed form.
- The hook budget is held again, on the 100,000-character page the file header names, instead of on a megabyte.
- Comments: the growth check is stated to catch the quadratic shape, not every superlinear one (an n^1.5 regression passes); the floor is no longer called timer resolution.

## Round 2 — the prompt, verbatim (a revision, judged on its own)

~~~
Review a change to a test. You cannot run anything; judge from the diff and the context below.

Context. `cssBlocks` parses CSS blocks out of an HTML/CSS file and runs inside an editor hook on every write. An earlier implementation (kept in the test as `REMOVED`) was quadratic: it rescanned from every start position of a brace-free run, and counted lines from the top of the file for every block. The test file's describe block "cssBlocks is linear on a megabyte" exists to catch that regression coming back.

Before this change, each shape was timed once on a 1 MB input and asserted below 250 ms (the editor hook's p95 latency budget). On shared CI runners the same assertion measured 253 ms, 281 ms and 302 ms and failed; locally the same shapes take 15-38 ms.

After this change, each shape is timed at n/8 and at n (fastest of 3 runs each) and the growth ratio must stay below 28, unless the full-size run is under 5 ms; an absolute ceiling of 4x the budget (1000 ms) remains on the megabyte. A new test holds a 100,000-character minified page (the case named in the file header, which took 39 s with the removed form) under the 250 ms budget, fastest of 3. Another new test asserts that the same growth check rejects the `REMOVED` implementation on two shapes at n = 24,000, fastest of 3. Measurements quoted in the code comment were taken on one developer machine; shared CI runners measured about 8x slower on the megabyte.

This is a revision. An earlier version of the diff was reviewed; this one is shown in full, and is to be judged on its own.

Questions:
1. Does the changed test still fail if the quadratic behaviour returns? Name any shape or path by which a superlinear regression would pass.
2. Is the new assertion weaker than the old one in any respect that matters for this file's purpose? Name it.
3. Is it likely to be flaky on a shared CI runner? Why?
4. Anything else wrong in the diff.

Answer each question in a few sentences, then end with exactly one line: `VERDICT: ACCEPT` or `VERDICT: REJECT` or `VERDICT: ACCEPT WITH CHANGES: <changes>`.

The diff:

diff --git a/tests/scripts/design_slop_css_blocks_linear.test.ts b/tests/scripts/design_slop_css_blocks_linear.test.ts
index 62af237db5..c574db099f 100644
--- a/tests/scripts/design_slop_css_blocks_linear.test.ts
+++ b/tests/scripts/design_slop_css_blocks_linear.test.ts
@@ -30,12 +30,37 @@ function REMOVED(content: string): Array<{ selector: string; body: string; line:
     return blocks;
 }
 
-const timed = (fn: () => unknown): number => {
-    const t = performance.now();
-    fn();
-    return performance.now() - t;
+// Fastest of `runs`: the sample least disturbed by GC and scheduling, which is what a
+// ratio between two sizes needs.
+const fastest = (fn: () => unknown, runs: number): number => {
+    let best = Infinity;
+    for (let i = 0; i < runs; i++) {
+        const t = performance.now();
+        fn();
+        best = Math.min(best, performance.now() - t);
+    }
+    return best;
 };
 
+// Growth from n/8 to n, measured 2026-11-05 on one developer machine: the current
+// implementation grows ~8x (11-13x on the allocation-heavy shapes, through GC); the
+// removed form grows 62-67x. The bound sits near their geometric mean. It is built to
+// catch the quadratic shape this file exists for, not every superlinear one: an n^1.5
+// regression grows ~23x and would pass. A full-size run under FLOOR_MS is not timed as
+// a ratio — at that size and speed no growth is worth reporting, and the small run
+// would be too short to divide by.
+const SCALE = 8;
+const MAX_GROWTH = 28;
+const FLOOR_MS = 5;
+
+function grows(fn: (text: string) => unknown, make: (n: number) => string, n: number, runs = 3): { small: number; big: number; linear: boolean } {
+    const smallText = make(n / SCALE);
+    const bigText = make(n);
+    const small = fastest(() => fn(smallText), runs);
+    const big = fastest(() => fn(bigText), runs);
+    return { small, big, linear: big < FLOOR_MS || big / Math.max(small, 0.01) < MAX_GROWTH };
+}
+
 describe('cssBlocks equals the regex it replaced', () => {
     const files = (dir: string): string[] =>
         fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
@@ -65,19 +90,37 @@ describe('cssBlocks equals the regex it replaced', () => {
 
 describe('cssBlocks is linear on a megabyte', () => {
     const N = 1_000_000;
-    const shapes: Record<string, string> = {
-        'one brace-free run (a minified page with no CSS)': 'x'.repeat(N),
-        'a run ending in an opening brace that never closes': `${'x'.repeat(N - 1)}{`,
-        'many small blocks, one per line': 'a{b}\n'.repeat(N / 5),
-        'opening braces only': 'a{'.repeat(N / 2),
-        'comment openers that never close': '/*'.repeat(N / 2),
+    const shapes: Record<string, (n: number) => string> = {
+        'one brace-free run (a minified page with no CSS)': (n) => 'x'.repeat(n),
+        'a run ending in an opening brace that never closes': (n) => `${'x'.repeat(n - 1)}{`,
+        'many small blocks, one per line': (n) => 'a{b}\n'.repeat(n / 5),
+        'opening braces only': (n) => 'a{'.repeat(n / 2),
+        'comment openers that never close': (n) => '/*'.repeat(n / 2),
     };
-    for (const [name, text] of Object.entries(shapes)) {
+    for (const [name, make] of Object.entries(shapes)) {
         it(name, () => {
-            expect(timed(() => cssBlocks(text))).toBeLessThan(EVENT_P95_MS);
+            const g = grows(cssBlocks, make, N);
+            expect(g.linear, `n/${SCALE}: ${g.small.toFixed(1)} ms, n: ${g.big.toFixed(1)} ms`).toBe(true);
+            // A backstop against a slowdown that keeps its growth rate; the latency budget
+            // itself is held on a realistic page in the next test.
+            expect(g.big).toBeLessThan(4 * EVENT_P95_MS);
         });
     }
 
+    it('keeps the 100,000-character minified page this file was written for inside the hook budget', () => {
+        const page = `<style>${'a{b:c}'.repeat(5_000)}</style>${'x'.repeat(70_000)}`;
+        expect(fastest(() => cssBlocks(page), 3)).toBeLessThan(EVENT_P95_MS);
+    });
+
+    // The removed form was quadratic twice over — the rescan of a brace-free run and the
+    // per-block line count — and one shape exercises each.
+    it('rejects the removed implementation, so the growth check can stand in for a time bound on a megabyte', () => {
+        for (const name of ['one brace-free run (a minified page with no CSS)', 'many small blocks, one per line']) {
+            const make = shapes[name] as (n: number) => string;
+            expect(grows(REMOVED, make, 24_000).linear, name).toBe(false);
+        }
+    }, 60_000);
+
     it('and still numbers lines on the megabyte', () => {
         const blocks = cssBlocks('a{b}\n'.repeat(N / 5));
         expect([blocks.length, blocks[0]?.line, blocks.at(-1)?.line]).toEqual([N / 5, 1, N / 5]);

~~~

## Round 2 — the verdict, verbatim

~~~
1. It should reject the original quadratic behaviour when that cost dominates: an 8× input increase produces roughly 64× runtime, exceeding 28. But an n^1.5 regression passes at roughly 23×, and even a quadratic component can pass when linear work or fixed overhead sufficiently dilutes its measured growth. Any full-size run below 5 ms also bypasses the growth check; the negative controls validate only two shapes at one size.

2. Yes: megabyte inputs can now take almost 1000 ms instead of 250 ms, and fastest-of-three can pass despite slower individual runs exceeding the limit. That weakens editor-hook latency coverage. Meeting the budget on a 100,015-character page does not establish the megabyte budget, and fastest-of-three does not measure p95.

3. Ordinary uniform CI slowdown should largely cancel in the ratio, making this less flaky than the original threshold. Scheduling, GC and JIT effects can still affect the two sizes differently; taking separate minima reduces interference without eliminating it. The quadratic negative control also introduces a timeout risk: three runs of each expensive shape under a shared 60-second timeout need validation on the slower runners.

4. The claimed 100,000-character page actually contains 100,015 characters, including the style tags. More materially, the negative control must exceed the 5 ms floor to succeed, so sufficiently fast execution can fail the test despite correctly distinguishing the implementations by growth. Its calibration needs to cover both that floor and slow-runner execution time.

VERDICT: ACCEPT WITH CHANGES: establish a reliable runtime and timing-floor margin for the quadratic negative controls, explicitly acknowledge the lost megabyte latency-budget coverage, and correct the page-length claim.
~~~

## Applied after round 2

All three requested changes: the negative control's margins to the 5 ms floor and to its 60 s timeout are measured and stated in the test; the loss of megabyte latency coverage is stated where the backstop sits; the page is exactly 100,000 characters and the test asserts it.

**Not changed, and why:** an n^1.5 regression still passes (~23x against a bound of 28). A bound low enough to catch it would sit inside the 11-13x the current implementation already shows on allocation-heavy shapes; the test is scoped to the quadratic regression it was written for, and says so.

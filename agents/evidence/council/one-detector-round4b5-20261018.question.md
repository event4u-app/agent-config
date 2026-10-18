<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch drain/road-to-one-detector-and-the-senders-we-own-20261018b,
     round 4b, fifth pass, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261018b, round 4b fifth pass — one ceiling per chunk

A ratification decision under ADR-268 § 4 on the budget policy for the conditional hook chunks.
Reviewed commit `8578ed8d2`. The fourth pass closed the build-error and orchestration findings on
both seats and asked for one thing: `chunkCoverageFindings` promised exactly one ceiling per chunk
but compared sets, so a chunk defined twice or a chunk with two ceilings went unreported.

It now reports both: a chunk defined more than once in `hook_chunks.mjs`, and a chunk with more
than one ceiling in the budget, each as a finding, beside the existing missing-ceiling and
stale-ceiling findings. A test covers each duplicate and the clean case. (`readChunkBudgets`
already refused a doubled ceiling when it parses the file; the function now enforces its own
contract as well.)

For each defect report file:line, the failure scenario and a severity. Say whether the fourth-pass
finding is closed. State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage
change.

```diff
diff --git a/src/scripts/check_hook_bundle_composition.ts b/src/scripts/check_hook_bundle_composition.ts
index 56c376018..fbd521d40 100644
--- a/src/scripts/check_hook_bundle_composition.ts
+++ b/src/scripts/check_hook_bundle_composition.ts
@@ -212,6 +212,9 @@ export function buildChunkBytes(root: string, entry: string): number {
  */
 export function chunkCoverageFindings(defined: readonly string[], budgets: readonly ChunkBudget[]): string[] {
     const out: string[] = [];
+    const twice = (xs: readonly string[]): string[] => [...new Set(xs.filter((x, i) => xs.indexOf(x) !== i))];
+    for (const d of twice(defined)) out.push(`chunk ${d} is defined more than once in hook_chunks.mjs`);
+    for (const d of twice(budgets.map((b) => b.entry))) out.push(`chunk ${d} has more than one ceiling in ${BUDGET_REL}`);
     const budgeted = new Set(budgets.map((b) => b.entry));
     for (const d of defined) if (!budgeted.has(d)) out.push(`chunk ${d} is built by hook_chunks.mjs but has no ceiling in ${BUDGET_REL}`);
     for (const b of budgets) if (!defined.includes(b.entry)) out.push(`ceiling for ${b.entry} names no chunk hook_chunks.mjs builds`);
diff --git a/tests/scripts/hook_bundle_raise_log.test.ts b/tests/scripts/hook_bundle_raise_log.test.ts
index dc26bef90..e2633707b 100644
--- a/tests/scripts/hook_bundle_raise_log.test.ts
+++ b/tests/scripts/hook_bundle_raise_log.test.ts
@@ -157,6 +157,14 @@ describe('chunk builds — one definition, used by the build and by the gate', (
         expect(findings.some((f) => f.includes('c.ts') && f.includes('names no chunk'))).toBe(true);
     });
 
+    it('a chunk defined twice, and a chunk with two ceilings, are findings', () => {
+        const dupDefined = chunkCoverageFindings(['a.ts', 'a.ts'], [{ entry: 'a.ts', maxBytes: 1 }]);
+        expect(dupDefined.some((f) => f.includes('defined more than once'))).toBe(true);
+        const dupBudget = chunkCoverageFindings(['a.ts'], [{ entry: 'a.ts', maxBytes: 1 }, { entry: 'a.ts', maxBytes: 2 }]);
+        expect(dupBudget.some((f) => f.includes('more than one ceiling'))).toBe(true);
+        expect(chunkCoverageFindings(['a.ts'], [{ entry: 'a.ts', maxBytes: 1 }])).toEqual([]);
+    });
+
     it('the build script writes every defined chunk and a matching digest sidecar', () => {
         const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunk-main-'));
         try {
```

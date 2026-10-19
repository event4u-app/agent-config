<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch drain/road-to-one-detector-and-the-senders-we-own-20261018b,
     round 4b, fourth pass, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261018b, round 4b fourth pass — chunk coverage both ways

A ratification decision under ADR-268 § 4 on a module boundary and its budget policy. Reviewed commit
`0342e241e`. The third pass closed the second-pass finding (one build definition used by both the
build and the gate) on both seats, and asked for:

1. **Coverage in both directions** (openai, Medium, blocking): a chunk added to `hook_chunks.mjs`
   could ship with no ceiling. The gate now computes `chunkCoverageFindings(defined, budgets)`:
   a defined chunk without a ceiling, and a ceiling naming no defined chunk, are each a finding,
   and a chunk with no ceiling is not measured as if it had one. The SVG chunk therefore gains its
   own ceiling — 64,000 B over a 60,718 B reading, about 5 % headroom, no growth queued — so the
   budget and the definition are the same set today. The regression test asserts set equality on
   the shipped files and that each direction of drift is a finding.
2. **`buildChunk` error handling** (anthropic): it now refuses a result whose `errors` list is
   not empty, on top of `buildSync` throwing.
3. **The build script's own orchestration was untested** (both): `main()` takes `--out-dir DIR`,
   and a test runs it into a temp directory and checks every defined output exists and its digest
   sidecar verifies.

For each defect report file:line, the failure scenario and a severity. Say whether each
third-pass finding is closed. State your stance (APPROVE or REQUEST_CHANGES) and the single
highest-leverage change.

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index b8895ae98..f3f1bb383 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -20,6 +20,12 @@
         }
     ],
     "chunks": [
+        {
+            "entry": "src/scripts/_lib/svg_rules.ts",
+            "max_bytes": 64000,
+            "registered_at": "2026-10-18",
+            "derivation": "Measured 60,718 bytes on 2026-10-18, the SVG rule set the council moved out of the dispatch bundle on 2026-10-11. Registered when the composition gate began requiring a ceiling for every defined chunk (council round 4b, 2026-10-18), so a chunk added to hook_chunks.mjs cannot ship unmeasured. The ceiling is that reading plus about 5 %, rounded, with no growth queued for it."
+        },
         {
             "entry": "src/scripts/_lib/egress_engine.ts",
             "max_bytes": 28000,
diff --git a/src/scripts/check_hook_bundle_composition.ts b/src/scripts/check_hook_bundle_composition.ts
index 9df088089..56c376018 100644
--- a/src/scripts/check_hook_bundle_composition.ts
+++ b/src/scripts/check_hook_bundle_composition.ts
@@ -205,6 +205,19 @@ export function buildChunkBytes(root: string, entry: string): number {
     }
 }
 
+/**
+ * Every defined chunk carries exactly one ceiling and every ceiling names a
+ * defined chunk — so a chunk added to `hook_chunks.mjs` cannot ship unmeasured,
+ * and a ceiling cannot outlive the chunk it bounded.
+ */
+export function chunkCoverageFindings(defined: readonly string[], budgets: readonly ChunkBudget[]): string[] {
+    const out: string[] = [];
+    const budgeted = new Set(budgets.map((b) => b.entry));
+    for (const d of defined) if (!budgeted.has(d)) out.push(`chunk ${d} is built by hook_chunks.mjs but has no ceiling in ${BUDGET_REL}`);
+    for (const b of budgets) if (!defined.includes(b.entry)) out.push(`ceiling for ${b.entry} names no chunk hook_chunks.mjs builds`);
+    return out;
+}
+
 /** Over-ceiling findings for measured chunks. */
 export function chunkFindings(measured: ReadonlyMap<string, number>, budgets: readonly ChunkBudget[]): string[] {
     const out: string[] = [];
@@ -530,7 +543,10 @@ export function main(argv: readonly string[] = process.argv.slice(2), root: stri
     if (fixture === undefined) {
         try {
             const budgets = readChunkBudgets(root);
-            for (const b of budgets) chunkSizes.set(b.entry, buildChunkBytes(root, b.entry));
+            findings.push(...chunkCoverageFindings(HOOK_CHUNKS.map((c) => c.entry), budgets));
+            for (const b of budgets) {
+                if (HOOK_CHUNKS.some((c) => c.entry === b.entry)) chunkSizes.set(b.entry, buildChunkBytes(root, b.entry));
+            }
             findings.push(...chunkFindings(chunkSizes, budgets));
         } catch (e) {
             process.stderr.write(`check_hook_bundle_composition: ${String(e instanceof Error ? e.message : e)}\n`);
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index eadda992a..c4d9d0b10 100644
--- a/src/scripts/hook_chunks.mjs
+++ b/src/scripts/hook_chunks.mjs
@@ -32,14 +32,22 @@ export const CHUNK_OPTIONS = Object.freeze({ bundle: true, platform: 'node', for
 
 /** Build one chunk from `root` to `outfile` (absolute). Throws when esbuild reports an error. */
 export function buildChunk(root, entry, outfile) {
-    buildSync({ ...CHUNK_OPTIONS, absWorkingDir: root, entryPoints: [entry], outfile, logLevel: 'error' });
+    const result = buildSync({ ...CHUNK_OPTIONS, absWorkingDir: root, entryPoints: [entry], outfile, logLevel: 'error' });
+    if (result.errors.length > 0) throw new Error(`esbuild reported ${String(result.errors.length)} error(s) building ${entry}`);
 }
 
-function main() {
+/**
+ * Build every chunk and write its digest sidecar. `--out-dir DIR` writes the
+ * outputs under DIR instead of the repository, for a test that must not touch
+ * the live `dist/`.
+ */
+export function main(args = argv.slice(2)) {
     const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
+    const at = args.indexOf('--out-dir');
+    const outRoot = at >= 0 && args[at + 1] !== undefined ? path.resolve(args[at + 1]) : root;
     const digest = path.join(root, 'src', 'scripts', 'write_bundle_digest.mjs');
     for (const chunk of HOOK_CHUNKS) {
-        const out = path.join(root, chunk.outfile);
+        const out = path.join(outRoot, chunk.outfile);
         buildChunk(root, chunk.entry, out);
         const r = spawnSync(process.execPath, [digest, out], { stdio: 'inherit' });
         if (r.status !== 0) return r.status ?? 1;
diff --git a/tests/scripts/hook_bundle_raise_log.test.ts b/tests/scripts/hook_bundle_raise_log.test.ts
index 91f58228b..dc26bef90 100644
--- a/tests/scripts/hook_bundle_raise_log.test.ts
+++ b/tests/scripts/hook_bundle_raise_log.test.ts
@@ -15,12 +15,14 @@ import { describe, expect, it } from 'vitest';
 
 import {
     buildChunkBytes,
+    chunkCoverageFindings,
     chunkFindings,
     chunkRaiseFindings,
     raiseEntryProblems,
     raiseFindings,
 } from '../../src/scripts/check_hook_bundle_composition.js';
-import { buildChunk, HOOK_CHUNKS } from '../../src/scripts/hook_chunks.mjs';
+import { buildChunk, HOOK_CHUNKS, main as hookChunksMain } from '../../src/scripts/hook_chunks.mjs';
+import { verifyBundle } from '../../src/scripts/hooks/bundle_integrity.js';
 
 const OLD_ENTRY = { date: '2026-10-01', from: 1500000, to: 1550000 };
 
@@ -127,11 +129,12 @@ describe('chunk ceilings', () => {
 describe('chunk builds — one definition, used by the build and by the gate', () => {
     const ENTRY = 'src/scripts/_lib/egress_engine.ts';
 
-    it('every budgeted chunk is a defined chunk, and package.json builds through the definition', () => {
+    it('the budgeted chunks and the defined chunks are the same set, and package.json builds through the definition', () => {
         const budget = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/config/hook-bundle-budget.json'), 'utf-8')) as {
-            chunks: Array<{ entry: string }>;
+            chunks: Array<{ entry: string; max_bytes: number }>;
         };
-        for (const c of budget.chunks) expect(HOOK_CHUNKS.some((h) => h.entry === c.entry), c.entry).toBe(true);
+        const budgets = budget.chunks.map((c) => ({ entry: c.entry, maxBytes: c.max_bytes }));
+        expect(chunkCoverageFindings(HOOK_CHUNKS.map((h) => h.entry), budgets)).toEqual([]);
         const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')) as { scripts: Record<string, string> };
         expect(pkg.scripts['build:hook-chunks']).toBe('node src/scripts/hook_chunks.mjs');
     });
@@ -147,6 +150,27 @@ describe('chunk builds — one definition, used by the build and by the gate', (
         }
     }, 60_000);
 
+    it('a defined chunk without a ceiling, and a ceiling without a chunk, are both findings', () => {
+        const findings = chunkCoverageFindings(['a.ts', 'b.ts'], [{ entry: 'a.ts', maxBytes: 1 }, { entry: 'c.ts', maxBytes: 1 }]);
+        expect(findings).toHaveLength(2);
+        expect(findings.some((f) => f.includes('b.ts') && f.includes('no ceiling'))).toBe(true);
+        expect(findings.some((f) => f.includes('c.ts') && f.includes('names no chunk'))).toBe(true);
+    });
+
+    it('the build script writes every defined chunk and a matching digest sidecar', () => {
+        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunk-main-'));
+        try {
+            expect(hookChunksMain(['--out-dir', dir])).toBe(0);
+            for (const c of HOOK_CHUNKS) {
+                const out = path.join(dir, c.outfile);
+                expect(fs.existsSync(out), c.outfile).toBe(true);
+                expect(verifyBundle(out).state, c.outfile).toBe('ok');
+            }
+        } finally {
+            fs.rmSync(dir, { recursive: true, force: true });
+        }
+    }, 60_000);
+
     it('refuses to measure an entry no chunk is defined for', () => {
         expect(() => buildChunkBytes(process.cwd(), 'src/scripts/_lib/no_such_chunk.ts')).toThrow(/defines no chunk/);
     });
```

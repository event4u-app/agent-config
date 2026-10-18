<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch drain/road-to-one-detector-and-the-senders-we-own-20261018b,
     round 4b, second pass, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261018b, round 4b second pass — the chunk budget gate

A ratification decision under ADR-268 § 4 on a module boundary and its policy; the trade-off is
how the budget gate reproduces the build it measures. Reviewed commit `8fd42876a`. The gated
content is unchanged since the first pass of 4b (the files below are not on the gated list); the
first pass asked for these changes, and both seats agreed the capsule and the budget's structure
are sound.

What the first pass found and what changed:

1. **The gate rebuilt the chunk through `sh -c` over a parsed `package.json` script** (both seats,
   Medium): platform-bound, and a script that grew shell semantics would be measured under
   different conditions. Now `chunkBuildArgv(scripts, entry)` accepts the chunk build only as a
   plain argv: the script may hold nothing but `esbuild` builds and `node` digest steps; the
   entry must appear in exactly one `esbuild` segment; that segment may carry no quote, variable,
   redirect, pipe, backslash or `cd`; and it must name exactly one `--outfile`. The gate then runs
   `node_modules/.bin/esbuild` (`esbuild.cmd` on Windows) directly with that argv and the outfile
   swapped for a throwaway path — no shell. The script stays the one definition of the build; a
   script the gate cannot reproduce is a refusal, never a measurement under other conditions.
   The dispatch bundle's own measurement is unchanged by this delta.
2. **A doubled chunk entry in the budget** (openai, Low): `readChunkBudgets` refuses it.
3. **No coverage of the build path** (both): tests now cover a plain segment read into its
   flags; refusal of a `cd` step, a quoted flag, a redirect, a doubled build, a missing
   `--outfile` and an entry no segment builds; and the shipped `package.json` passing.

Measured with the change: dispatch bundle 1,537,874 B of 1,550,000; chunk 18,478 B of 28,000.

For each defect report file:line, the failure scenario and a severity. Say whether each
first-pass finding is closed. State your stance (APPROVE or REQUEST_CHANGES) and the single
highest-leverage change.

```diff
diff --git a/src/scripts/check_hook_bundle_composition.ts b/src/scripts/check_hook_bundle_composition.ts
index 19fb0e0c2..f5cd34b9b 100644
--- a/src/scripts/check_hook_bundle_composition.ts
+++ b/src/scripts/check_hook_bundle_composition.ts
@@ -167,7 +167,7 @@ export function readChunkBudgets(root: string): ChunkBudget[] {
     const list = raw['chunks'];
     if (list === undefined) return [];
     if (!Array.isArray(list)) throw new Error(`${BUDGET_REL}: chunks must be a list`);
-    return list.map((c, i) => {
+    const budgets = list.map((c, i) => {
         const entry = isRecord(c) ? c['entry'] : undefined;
         const max = isRecord(c) ? c['max_bytes'] : undefined;
         if (typeof entry !== 'string' || typeof max !== 'number' || !Number.isInteger(max) || max <= 0) {
@@ -175,31 +175,61 @@ export function readChunkBudgets(root: string): ChunkBudget[] {
         }
         return { entry, maxBytes: max };
     });
+    const seen = new Set<string>();
+    for (const b of budgets) {
+        if (seen.has(b.entry)) throw new Error(`${BUDGET_REL}: chunks lists ${b.entry} twice`);
+        seen.add(b.entry);
+    }
+    return budgets;
+}
+
+/**
+ * The argv of the esbuild invocation `build:hook-chunks` uses for `entry`.
+ *
+ * The script is the one definition of how a chunk is built; this reads it
+ * rather than restating its flags. A segment is accepted only as a plain
+ * `esbuild` call — words with no quote, variable, redirect, pipe or `cd` — so
+ * the gate runs it as an argv with no shell, on every platform, and a segment
+ * that grew shell semantics is a loud refusal rather than a build measured under
+ * different conditions.
+ */
+export function chunkBuildArgv(scripts: Readonly<Record<string, string>>, entry: string): string[] {
+    const segments = (scripts['build:hook-chunks'] ?? '').split('&&').map((x) => x.trim());
+    // Only builds and digest writes: a `cd` or any other step could change the
+    // conditions the chunk is built under without touching its own segment.
+    const foreign = segments.find((x) => !x.startsWith('esbuild ') && !x.startsWith('node '));
+    if (foreign !== undefined) {
+        throw new Error(`\`build:hook-chunks\` carries a step other than an esbuild build or a node digest (\`${foreign}\`)`);
+    }
+    const matches = segments.filter((x) => x.startsWith('esbuild ') && x.split(/\s+/).includes(entry));
+    if (matches.length !== 1) {
+        throw new Error(`\`build:hook-chunks\` must build ${entry} in exactly one esbuild segment, found ${String(matches.length)}`);
+    }
+    const segment = matches[0] as string;
+    if (/["'`$|;<>()\\]|\bcd\b/.test(segment)) {
+        throw new Error(`the esbuild segment for ${entry} is not a plain argv — refusing to measure a build it cannot reproduce`);
+    }
+    const words = segment.split(/\s+/).slice(1);
+    if (words.filter((w) => w.startsWith('--outfile=')).length !== 1) {
+        throw new Error(`the esbuild segment for ${entry} must name exactly one --outfile`);
+    }
+    return words;
 }
 
 /**
- * Build the chunk for `entry` with the exact esbuild segment `build:hook-chunks`
- * uses for it, to a throwaway path, and return its size. Throws when the script
- * carries no segment for the entry — a ceiling on a chunk nothing builds bounds
- * nothing.
+ * Build the chunk for `entry` with that argv, to a throwaway path, and return its
+ * size. Throws when the script carries no plain segment for the entry — a
+ * ceiling on a chunk nothing builds bounds nothing.
  */
 export function buildChunkBytes(root: string, entry: string): number {
     const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')) as { scripts?: Record<string, string> };
-    const script = pkg.scripts?.['build:hook-chunks'] ?? '';
-    const segment = script
-        .split('&&')
-        .map((x) => x.trim())
-        .find((x) => x.startsWith('esbuild ') && x.split(/\s+/).includes(entry));
-    if (segment === undefined) throw new Error(`\`build:hook-chunks\` builds no chunk from ${entry}`);
+    const argv = chunkBuildArgv(pkg.scripts ?? {}, entry);
     const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-chunk-composition-'));
     const out = path.join(dir, 'chunk.cjs');
     try {
-        const cmd = segment.replace(/--outfile=\S+/, `--outfile=${out}`);
-        const built = spawnSync('sh', ['-c', cmd], {
-            cwd: root,
-            encoding: 'utf-8',
-            env: { ...process.env, PATH: `${path.join(root, 'node_modules', '.bin')}:${process.env['PATH'] ?? ''}` },
-        });
+        const args = argv.map((w) => (w.startsWith('--outfile=') ? `--outfile=${out}` : w));
+        const bin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'esbuild.cmd' : 'esbuild');
+        const built = spawnSync(bin, args, { cwd: root, encoding: 'utf-8' });
         if (built.status !== 0 || !fs.existsSync(out)) {
             throw new Error(`esbuild failed for chunk ${entry} (exit ${String(built.status)})\n${built.stderr ?? ''}`);
         }
diff --git a/tests/scripts/hook_bundle_raise_log.test.ts b/tests/scripts/hook_bundle_raise_log.test.ts
index cdd237cf9..e7ef389fd 100644
--- a/tests/scripts/hook_bundle_raise_log.test.ts
+++ b/tests/scripts/hook_bundle_raise_log.test.ts
@@ -7,9 +7,13 @@
 // fresh raise, a new entry naming a different `to` does not either, and a bare
 // `{ to }` entry with no reason — what the ratification review refused the
 // first version on — does not count as a recorded reason.
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
 import { describe, expect, it } from 'vitest';
 
 import {
+    chunkBuildArgv,
     chunkFindings,
     chunkRaiseFindings,
     raiseEntryProblems,
@@ -117,3 +121,33 @@ describe('chunk ceilings', () => {
         expect(chunkRaiseFindings(budget(1550000, []), chunked(28000, []))).toEqual([]);
     });
 });
+
+describe('chunkBuildArgv — the one definition of a chunk build, read as an argv', () => {
+    const ENTRY = 'src/scripts/_lib/egress_engine.ts';
+    const plain = `esbuild ${ENTRY} --bundle --platform=node --format=cjs --target=node20 --outfile=dist/hooks/e.cjs`;
+
+    it('reads a plain esbuild segment into its flags', () => {
+        const argv = chunkBuildArgv({ 'build:hook-chunks': `${plain} && node digest.mjs dist/hooks/e.cjs` }, ENTRY);
+        expect(argv[0]).toBe(ENTRY);
+        expect(argv).toContain('--format=cjs');
+    });
+
+    it('refuses a segment with shell semantics, a missing or doubled entry, and a missing outfile', () => {
+        const bad = [
+            `cd sub && ${plain}`,
+            plain.replace('--target=node20', '--target="node20"'),
+            `${plain} > log.txt`,
+            `${plain} && ${plain}`,
+            plain.replace(/ --outfile=\S+/, ''),
+            'esbuild other.ts --outfile=x.cjs',
+        ];
+        for (const script of bad) {
+            expect(() => chunkBuildArgv({ 'build:hook-chunks': script }, ENTRY), script).toThrow();
+        }
+    });
+
+    it('the shipped package.json builds the engine chunk in one plain segment', () => {
+        const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')) as { scripts: Record<string, string> };
+        expect(chunkBuildArgv(pkg.scripts, ENTRY)[0]).toBe(ENTRY);
+    });
+});
```

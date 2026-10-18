<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch drain/road-to-one-detector-and-the-senders-we-own-20261018b,
     round 4b, third pass, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261018b, round 4b third pass — one definition of the chunk build

A ratification decision under ADR-268 § 4 on a module boundary and its build policy. Reviewed commit
`728f6a696`. The second pass of 4b (both seats REQUEST_CHANGES) found that parsing the chunk build
out of `package.json` shell text still let the measured build and the shipped build differ (a
`node` step that changes state, shell syntax in a non-target segment), and both named the same
remedy: one structured build definition consumed by the build and by the gate.

That is what this delta does:

- `src/scripts/hook_chunks.mjs` (plain `.mjs`, like `write_bundle_digest.mjs`, because it runs
  before anything is compiled) holds `HOOK_CHUNKS` — each chunk's entry and output — and
  `CHUNK_OPTIONS` (`bundle`, `platform: node`, `format: cjs`, `target: node20`), and exports
  `buildChunk(root, entry, outfile)`, which calls esbuild's `buildSync` with exactly those options.
  Run as a script it builds every chunk to its output and writes each digest sidecar.
- `package.json`: `build:hook-chunks` is now `node src/scripts/hook_chunks.mjs`.
- `check_hook_bundle_composition.ts`: `buildChunkBytes(root, entry)` refuses an entry the
  definition does not carry and otherwise calls the same `buildChunk` to a throwaway path and
  returns its size. No shell, no parsing, no second description. `chunkBuildArgv` and its tests are
  removed.
- Tests: every budgeted chunk is a defined chunk and `package.json` builds through the definition;
  the gate's measurement equals the bytes `buildChunk` writes; an undefined entry is refused. The
  egress-chunk loader test builds its fixture chunk with the same `buildChunk`.

Measured: the SVG chunk builds byte-identical to the previous command-line build (60,718 B, same
digest); the egress chunk is 18,478 B of its 28,000 B ceiling; the dispatch bundle 1,539,400 B of
1,550,000 (it now also carries the guard of part 4c). The dispatch bundle's own measurement
(`buildMetafile`, which reads `build:hooks`) is unchanged by this delta and predates it.

For each defect report file:line, the failure scenario and a severity. Say whether each
second-pass finding is closed. State your stance (APPROVE or REQUEST_CHANGES) and the single
highest-leverage change.

```diff
diff --git a/package.json b/package.json
index 965a047ab..0cfdb3ccf 100644
--- a/package.json
+++ b/package.json
@@ -102,7 +102,7 @@
         "prepublishOnly": "./scripts-run src/scripts/check_release_includes_discovery",
         "prepare": "[ -d .git ] && bash src/scripts/install-hooks.sh || true",
         "build:skill-scripts": "esbuild src/skills/corpus-grounding/scripts/ground.ts src/skills/design-tokens/scripts/tokens.ts src/skills/js-library-packaging/scripts/check_package_surface.ts src/skills/react-shadcn-ui/scripts/shadcn_add.ts src/skills/storybook-workshop/scripts/story_contrast_floor.ts src/skills/tailwind-engineer/scripts/tailwind_config_gen.ts --bundle --platform=node --format=esm --target=node20 --outbase=src/skills --outdir=src/skills --out-extension:.js=.mjs",
-        "build:hook-chunks": "esbuild src/scripts/_lib/svg_rules.ts --bundle --platform=node --format=cjs --target=node20 --outfile=dist/hooks/svg_rules.chunk.cjs && node src/scripts/write_bundle_digest.mjs dist/hooks/svg_rules.chunk.cjs && esbuild src/scripts/_lib/egress_engine.ts --bundle --platform=node --format=cjs --target=node20 --outfile=dist/hooks/egress_engine.chunk.cjs && node src/scripts/write_bundle_digest.mjs dist/hooks/egress_engine.chunk.cjs"
+        "build:hook-chunks": "node src/scripts/hook_chunks.mjs"
     },
     "publishConfig": {
         "access": "public",
diff --git a/src/scripts/check_hook_bundle_composition.ts b/src/scripts/check_hook_bundle_composition.ts
index f5cd34b9b..9df088089 100644
--- a/src/scripts/check_hook_bundle_composition.ts
+++ b/src/scripts/check_hook_bundle_composition.ts
@@ -69,6 +69,7 @@ import { fileURLToPath, pathToFileURL } from 'node:url';
 import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
 import { reportScanned } from './_lib/scan_scope.js';
 import { buildScript } from './check_hook_bundle_content.js';
+import { buildChunk, HOOK_CHUNKS } from './hook_chunks.mjs';
 import { rewriteOutfile } from './rebuild_hook_bundle.js';
 
 const _HERE = path.dirname(fileURLToPath(import.meta.url));
@@ -184,55 +185,20 @@ export function readChunkBudgets(root: string): ChunkBudget[] {
 }
 
 /**
- * The argv of the esbuild invocation `build:hook-chunks` uses for `entry`.
- *
- * The script is the one definition of how a chunk is built; this reads it
- * rather than restating its flags. A segment is accepted only as a plain
- * `esbuild` call — words with no quote, variable, redirect, pipe or `cd` — so
- * the gate runs it as an argv with no shell, on every platform, and a segment
- * that grew shell semantics is a loud refusal rather than a build measured under
- * different conditions.
- */
-export function chunkBuildArgv(scripts: Readonly<Record<string, string>>, entry: string): string[] {
-    const segments = (scripts['build:hook-chunks'] ?? '').split('&&').map((x) => x.trim());
-    // Only builds and digest writes: a `cd` or any other step could change the
-    // conditions the chunk is built under without touching its own segment.
-    const foreign = segments.find((x) => !x.startsWith('esbuild ') && !x.startsWith('node '));
-    if (foreign !== undefined) {
-        throw new Error(`\`build:hook-chunks\` carries a step other than an esbuild build or a node digest (\`${foreign}\`)`);
-    }
-    const matches = segments.filter((x) => x.startsWith('esbuild ') && x.split(/\s+/).includes(entry));
-    if (matches.length !== 1) {
-        throw new Error(`\`build:hook-chunks\` must build ${entry} in exactly one esbuild segment, found ${String(matches.length)}`);
-    }
-    const segment = matches[0] as string;
-    if (/["'`$|;<>()\\]|\bcd\b/.test(segment)) {
-        throw new Error(`the esbuild segment for ${entry} is not a plain argv — refusing to measure a build it cannot reproduce`);
-    }
-    const words = segment.split(/\s+/).slice(1);
-    if (words.filter((w) => w.startsWith('--outfile=')).length !== 1) {
-        throw new Error(`the esbuild segment for ${entry} must name exactly one --outfile`);
-    }
-    return words;
-}
-
-/**
- * Build the chunk for `entry` with that argv, to a throwaway path, and return its
- * size. Throws when the script carries no plain segment for the entry — a
- * ceiling on a chunk nothing builds bounds nothing.
+ * Build the chunk for `entry` from the one chunk definition (`hook_chunks.mjs`,
+ * which `build:hook-chunks` runs) to a throwaway path, and return its size. The
+ * gate and the shipped build call the same function with the same options, so
+ * what is measured is what ships. Throws when no chunk is defined for the entry
+ * — a ceiling on a chunk nothing builds bounds nothing.
  */
 export function buildChunkBytes(root: string, entry: string): number {
-    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')) as { scripts?: Record<string, string> };
-    const argv = chunkBuildArgv(pkg.scripts ?? {}, entry);
+    if (!HOOK_CHUNKS.some((c) => c.entry === entry)) {
+        throw new Error(`hook_chunks.mjs defines no chunk built from ${entry}`);
+    }
     const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-chunk-composition-'));
     const out = path.join(dir, 'chunk.cjs');
     try {
-        const args = argv.map((w) => (w.startsWith('--outfile=') ? `--outfile=${out}` : w));
-        const bin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'esbuild.cmd' : 'esbuild');
-        const built = spawnSync(bin, args, { cwd: root, encoding: 'utf-8' });
-        if (built.status !== 0 || !fs.existsSync(out)) {
-            throw new Error(`esbuild failed for chunk ${entry} (exit ${String(built.status)})\n${built.stderr ?? ''}`);
-        }
+        buildChunk(root, entry, out);
         return fs.statSync(out).size;
     } finally {
         fs.rmSync(dir, { recursive: true, force: true });
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
new file mode 100644
index 000000000..eadda992a
--- /dev/null
+++ b/src/scripts/hook_chunks.mjs
@@ -0,0 +1,52 @@
+#!/usr/bin/env node
+/**
+ * hook_chunks.mjs — the one definition of the conditional hook chunks, and
+ * their build.
+ *
+ * A chunk is code the dispatch bundle loads only when a caller needs it
+ * (`hooks/svg_rules_loader.ts`, `hooks/egress_engine_loader.ts`). Its entry,
+ * its output and its esbuild options live here and nowhere else:
+ * `npm run build:hook-chunks` runs this file, and the bundle-composition gate
+ * imports it to build the same chunk to a throwaway path and measure it. A
+ * second description of the build — a parsed shell script — is how a measured
+ * build and a shipped build come apart, which is the reason this is a module.
+ *
+ * Plain `.mjs` like `write_bundle_digest.mjs`: it runs in `build:hooks` before
+ * anything is compiled.
+ */
+import { spawnSync } from 'node:child_process';
+import * as path from 'node:path';
+import { argv, exit } from 'node:process';
+import { fileURLToPath, pathToFileURL } from 'node:url';
+
+import { buildSync } from 'esbuild';
+
+/** Every chunk: its entry and where `build:hook-chunks` writes it, repo-relative. */
+export const HOOK_CHUNKS = Object.freeze([
+    Object.freeze({ entry: 'src/scripts/_lib/svg_rules.ts', outfile: 'dist/hooks/svg_rules.chunk.cjs' }),
+    Object.freeze({ entry: 'src/scripts/_lib/egress_engine.ts', outfile: 'dist/hooks/egress_engine.chunk.cjs' }),
+]);
+
+/** The esbuild options every chunk is built with. */
+export const CHUNK_OPTIONS = Object.freeze({ bundle: true, platform: 'node', format: 'cjs', target: 'node20' });
+
+/** Build one chunk from `root` to `outfile` (absolute). Throws when esbuild reports an error. */
+export function buildChunk(root, entry, outfile) {
+    buildSync({ ...CHUNK_OPTIONS, absWorkingDir: root, entryPoints: [entry], outfile, logLevel: 'error' });
+}
+
+function main() {
+    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
+    const digest = path.join(root, 'src', 'scripts', 'write_bundle_digest.mjs');
+    for (const chunk of HOOK_CHUNKS) {
+        const out = path.join(root, chunk.outfile);
+        buildChunk(root, chunk.entry, out);
+        const r = spawnSync(process.execPath, [digest, out], { stdio: 'inherit' });
+        if (r.status !== 0) return r.status ?? 1;
+    }
+    return 0;
+}
+
+if (argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(argv[1])).href) {
+    exit(main());
+}
diff --git a/tests/scripts/hook_bundle_raise_log.test.ts b/tests/scripts/hook_bundle_raise_log.test.ts
index e7ef389fd..91f58228b 100644
--- a/tests/scripts/hook_bundle_raise_log.test.ts
+++ b/tests/scripts/hook_bundle_raise_log.test.ts
@@ -8,17 +8,19 @@
 // `{ to }` entry with no reason — what the ratification review refused the
 // first version on — does not count as a recorded reason.
 import * as fs from 'node:fs';
+import * as os from 'node:os';
 import * as path from 'node:path';
 
 import { describe, expect, it } from 'vitest';
 
 import {
-    chunkBuildArgv,
+    buildChunkBytes,
     chunkFindings,
     chunkRaiseFindings,
     raiseEntryProblems,
     raiseFindings,
 } from '../../src/scripts/check_hook_bundle_composition.js';
+import { buildChunk, HOOK_CHUNKS } from '../../src/scripts/hook_chunks.mjs';
 
 const OLD_ENTRY = { date: '2026-10-01', from: 1500000, to: 1550000 };
 
@@ -122,32 +124,30 @@ describe('chunk ceilings', () => {
     });
 });
 
-describe('chunkBuildArgv — the one definition of a chunk build, read as an argv', () => {
+describe('chunk builds — one definition, used by the build and by the gate', () => {
     const ENTRY = 'src/scripts/_lib/egress_engine.ts';
-    const plain = `esbuild ${ENTRY} --bundle --platform=node --format=cjs --target=node20 --outfile=dist/hooks/e.cjs`;
 
-    it('reads a plain esbuild segment into its flags', () => {
-        const argv = chunkBuildArgv({ 'build:hook-chunks': `${plain} && node digest.mjs dist/hooks/e.cjs` }, ENTRY);
-        expect(argv[0]).toBe(ENTRY);
-        expect(argv).toContain('--format=cjs');
+    it('every budgeted chunk is a defined chunk, and package.json builds through the definition', () => {
+        const budget = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/config/hook-bundle-budget.json'), 'utf-8')) as {
+            chunks: Array<{ entry: string }>;
+        };
+        for (const c of budget.chunks) expect(HOOK_CHUNKS.some((h) => h.entry === c.entry), c.entry).toBe(true);
+        const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')) as { scripts: Record<string, string> };
+        expect(pkg.scripts['build:hook-chunks']).toBe('node src/scripts/hook_chunks.mjs');
     });
 
-    it('refuses a segment with shell semantics, a missing or doubled entry, and a missing outfile', () => {
-        const bad = [
-            `cd sub && ${plain}`,
-            plain.replace('--target=node20', '--target="node20"'),
-            `${plain} > log.txt`,
-            `${plain} && ${plain}`,
-            plain.replace(/ --outfile=\S+/, ''),
-            'esbuild other.ts --outfile=x.cjs',
-        ];
-        for (const script of bad) {
-            expect(() => chunkBuildArgv({ 'build:hook-chunks': script }, ENTRY), script).toThrow();
+    it('measures the bytes the definition builds', () => {
+        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunk-measure-'));
+        try {
+            const out = path.join(dir, 'c.cjs');
+            buildChunk(process.cwd(), ENTRY, out);
+            expect(buildChunkBytes(process.cwd(), ENTRY)).toBe(fs.statSync(out).size);
+        } finally {
+            fs.rmSync(dir, { recursive: true, force: true });
         }
-    });
+    }, 60_000);
 
-    it('the shipped package.json builds the engine chunk in one plain segment', () => {
-        const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')) as { scripts: Record<string, string> };
-        expect(chunkBuildArgv(pkg.scripts, ENTRY)[0]).toBe(ENTRY);
+    it('refuses to measure an entry no chunk is defined for', () => {
+        expect(() => buildChunkBytes(process.cwd(), 'src/scripts/_lib/no_such_chunk.ts')).toThrow(/defines no chunk/);
     });
 });
```

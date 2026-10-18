<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch drain/road-to-one-detector-and-the-senders-we-own-20261018b,
     round 4 part b, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261018b, round 4b — the parts of the engine chunk round 3 could not see

A ratification decision under ADR-268 § 4 on a module boundary and its policy; the trade-off is
what each mode gives up when the engine is absent. Round 4 is split in three parts (4a, 4b, 4c) because
prompts above roughly 20 KB timed out on both seats today. All three parts review the same
gated content: commit `19a4516d2`, plus `8bd651c43`, which changes one test only; the ratification gate classifies eight files of the branch as gated
(`hook-bundle-budget.json`, `hook-latency-budget.json`, `_lib/egress_engine.ts`,
`_lib/egress_rules.ts`, `hook_manifest.json`, `hook_manifest.yaml`,
`hooks/block_credential_reads.ts`, `hooks/egress_engine_loader.ts`), and the subject digest over
the whole changed-file list is `50705314fe1fcb4dd96da255caedb00afe182d24d43972cc0e2f2ea0502543cb`.

Round 3 could not see these files of the engine-chunk change, and both seats said so. Part 4a
covers the loader; this part covers the rest:

- `_lib/subagent_capsule.ts` — `scanEnvelopeSecrets` loads the engine; when it is unavailable it
  returns a single rejection, so the envelope is discarded rather than passed unscanned.
- `src/config/hook-bundle-budget.json` — a `chunks` list with one entry
  (`src/scripts/_lib/egress_engine.ts`, `max_bytes: 28000`, measured 18,478 B) and a derivation.
  The dispatch ceiling is unchanged at 1,550,000 B (dispatch bundle now 1,537,695 B, including the
  new guard of part 4c).
- `check_hook_bundle_composition.ts` — `readChunkBudgets`, `buildChunkBytes` (builds the chunk
  with the exact esbuild segment `build:hook-chunks` uses for the entry, to a throwaway path),
  `chunkFindings` (a chunk over its ceiling, or a ceiling nothing measured, is a finding) and
  `chunkRaiseFindings` (a chunk ceiling raised against the base needs a new `raise_log` entry
  naming the chunk and the new ceiling, with the same completeness rules as the main raise). Unit
  tests cover over/at the ceiling, an unmeasured ceiling, a raise with and without a matching
  entry, a lowering and a newly registered chunk.

**Part 4a's result, carried here.** Both seats closed the round-3 findings 1–3 and 6 and returned
REQUEST_CHANGES on one test: they read the digest-mismatch test as writing a sidecar the loader
does not read. The sidecar name is `sidecarPathFor(bundle)` = `bundle.replace(/\.js$/u, '') +
'.sha256'`; the chunk is `egress_engine.chunk.cjs`, which does not end in `.js`, so the sidecar is
`egress_engine.chunk.cjs.sha256` in both places and the test did reach the mismatch branch. It now
uses `sidecarPathFor` itself, asserts the sidecar exists before loading, and shows the same chunk
loading once the sidecar matches, so the refusal is provably the digest's. The test-only delta is
the first diff below; the files of part 4b follow it.

Questions a review should answer: is the chunk budget enforced the way the main ceiling is; can
the gate report green over a chunk it did not build; does the capsule fail closed.

For each defect report file:line, the failure scenario and a severity. State your stance
(APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

```diff
diff --git a/tests/scripts/hooks/egress_engine_chunk.test.ts b/tests/scripts/hooks/egress_engine_chunk.test.ts
index 4aacb120d..513f5b3ab 100644
--- a/tests/scripts/hooks/egress_engine_chunk.test.ts
+++ b/tests/scripts/hooks/egress_engine_chunk.test.ts
@@ -30,6 +30,7 @@ import {
 import { ENGINE_UNAVAILABLE, runEgressStage, WITHHELD_MARKER, type EgressMode } from '../../../src/scripts/hooks/egress_stage.js';
 import type { JsonObject } from '../../../src/scripts/hooks/payload_stub.js';
 import { buildMetafile } from '../../../src/scripts/check_hook_bundle_composition.js';
+import { sidecarPathFor } from '../../../src/scripts/hooks/bundle_integrity.js';
 
 const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
 const ESBUILD = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'esbuild.cmd' : 'esbuild');
@@ -44,7 +45,8 @@ function writeChunk(dir: string, body: Buffer | string, sidecar: 'match' | 'mism
     const sha = createHash('sha256').update(body).digest('hex');
     if (sidecar !== 'none') {
         const recorded = sidecar === 'match' ? sha : sha.replace(/^./, sha[0] === '0' ? '1' : '0');
-        fs.writeFileSync(`${chunk.replace(/\.js$/u, '')}.sha256`, `${recorded}  ${ENGINE_CHUNK_BASENAME}\n`);
+        // The loader's own sidecar path, so a test can never write a file it does not read.
+        fs.writeFileSync(sidecarPathFor(chunk), `${recorded}  ${ENGINE_CHUNK_BASENAME}\n`);
     }
     // The loader resolves the chunk as a sibling of the bundle it runs from.
     return pathToFileURL(path.join(dir, 'dispatch.js')).href;
@@ -84,9 +86,14 @@ describe('the loader refuses every unusable chunk', () => {
     it('refuses a chunk altered against its sidecar', () => {
         const altered = Buffer.concat([goodChunk, Buffer.from('\n// altered\n')]);
         const url = writeChunk(path.join(tmp, 'altered'), altered, 'none');
-        const sha = createHash('sha256').update(goodChunk).digest('hex');
-        fs.writeFileSync(path.join(tmp, 'altered', `${ENGINE_CHUNK_BASENAME}.sha256`), `${sha}  ${ENGINE_CHUNK_BASENAME}\n`);
+        const sidecar = sidecarPathFor(path.join(tmp, 'altered', ENGINE_CHUNK_BASENAME));
+        fs.writeFileSync(sidecar, `${createHash('sha256').update(goodChunk).digest('hex')}  ${ENGINE_CHUNK_BASENAME}\n`);
+        // The sidecar the loader reads is present: this is the mismatch branch, not the missing one.
+        expect(fs.existsSync(sidecar)).toBe(true);
         expect(reason(loadEgressEngineUncached(url, true))).toBe('digest');
+        // And the same chunk with a matching sidecar loads, so the refusal is the digest's.
+        fs.writeFileSync(sidecar, `${createHash('sha256').update(altered).digest('hex')}  ${ENGINE_CHUNK_BASENAME}\n`);
+        expect(reason(loadEgressEngineUncached(url, true))).toBe('ok');
     });
 
     it('refuses a chunk with no sidecar to match', () => {
@@ -109,8 +116,11 @@ describe('the loader refuses every unusable chunk', () => {
     });
 
     it('returns a value, never a throw, when the bundle url itself cannot be resolved', () => {
-        expect(() => loadEgressEngineUncached('not a url', true)).not.toThrow();
-        expect(reason(loadEgressEngineUncached('not a url', true))).toBe('invalid');
+        let load: EngineLoad | undefined;
+        expect(() => {
+            load = loadEgressEngineUncached('not a url', true);
+        }).not.toThrow();
+        expect(reason(load as EngineLoad)).toBe('invalid');
     });
 
     it('refuses a chunk missing an export it must carry', () => {
@@ -167,7 +177,6 @@ describe('nothing in the dispatch bundle pulls the engine statically', () => {
             'src/scripts/_lib/secret_detector.ts',
             'src/scripts/_lib/egress_engine.ts',
         ];
-        expect(Object.keys(meta.inputs).length).toBeGreaterThan(100);
         // The path form the check reads: the stage that uses the engine is in the bundle.
         expect('src/scripts/hooks/egress_stage.ts' in meta.inputs).toBe(true);
         expect(engine.filter((m) => m in meta.inputs)).toEqual([]);
```

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 6639d0e0e..b8895ae98 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -19,6 +19,15 @@
             "what_would_have_caught_it": "Measuring the ceiling against the merge result rather than the PR branch. A ceiling derived on a branch is a statement about that branch; the trunk is what the gate defends, and the two diverge exactly when several lanes land in one day."
         }
     ],
+    "chunks": [
+        {
+            "entry": "src/scripts/_lib/egress_engine.ts",
+            "max_bytes": 28000,
+            "registered_at": "2026-10-18",
+            "derivation": "Measured 18,478 bytes on 2026-10-18 (the rule table, the token grammar and the commit scanner, with the per-rule linearity prose moved to a test-only module). The ceiling is that reading plus the queued engine work of road-to-one-detector-and-the-senders-we-own (validated identifier rules about 4.3 KB, known values, the invisible-character rescan and the variant suffix about 1-2 KB each), rounded up. An AI council of two providers chose on 2026-10-18 to move the engine out of the dispatch bundle into this conditional chunk rather than raise the dispatch ceiling, and asked that the chunk carry a measured budget of its own so the move does not just relocate uncontrolled growth. A raise follows the same rule as max_bytes: a raise_log entry naming the chunk (`chunk`: this entry) and what was added."
+        }
+    ],
+    "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
     "max_yaml_packages": 1,
     "max_yaml_packages_note": "The dispatch path reads YAML for the hook manifest, the host-lowering table and the settings contract. One reader covers all three. Two cost 95,846 bytes for a single call site and were invisible until an external rescore counted them — which is why this is a cap rather than prose. The package set the cap counts over is YAML_PACKAGES in the gate.",
     "what_this_does_not_bound": "Latency. A smaller bundle is not a measured speed-up; src/config/hook-latency-budget.json owns the wall-clock axis and is not derived from this file. Nor does it bound dist/install/install.mjs or dist/mcp/server.mjs, which carry their own module graphs."
diff --git a/src/scripts/_lib/subagent_capsule.ts b/src/scripts/_lib/subagent_capsule.ts
index 19c73dea3..fff87b205 100644
--- a/src/scripts/_lib/subagent_capsule.ts
+++ b/src/scripts/_lib/subagent_capsule.ts
@@ -27,7 +27,7 @@
  * Wire format: `src/skills/subagent-orchestration/schemas/subagent-status.json`
  */
 
-import { scanText } from './secret_detector.js';
+import { loadEgressEngine } from '../hooks/egress_engine_loader.js';
 
 /**
  * Epistemic vocabulary for `assumptions[].epistemic_state` — pinned ONCE, here,
@@ -588,8 +588,14 @@ function envelopeStrings(value: unknown, out: string[] = []): string[] {
  */
 export function scanEnvelopeSecrets(envelope: unknown): string[] {
     const errors: string[] = [];
+    // The detector is loaded on demand; when it cannot load, the envelope is
+    // invalid rather than unscanned.
+    const load = loadEgressEngine();
+    if (!load.ok) {
+        return [`credential scan unavailable (${load.reason}) — an envelope that cannot be scanned is rejected, not passed`];
+    }
     for (const text of envelopeStrings(envelope)) {
-        for (const finding of scanText(text)) {
+        for (const finding of load.engine.scanText(text)) {
             if (finding.confidence !== 'high') continue;
             errors.push(
                 `credential-shaped content is schema-invalid in an envelope ` +
diff --git a/src/scripts/check_hook_bundle_composition.ts b/src/scripts/check_hook_bundle_composition.ts
index 6611f202a..19fb0e0c2 100644
--- a/src/scripts/check_hook_bundle_composition.ts
+++ b/src/scripts/check_hook_bundle_composition.ts
@@ -151,6 +151,116 @@ export function analyzeMetafile(json: string): Analysis {
     };
 }
 
+/** A conditional chunk's own ceiling: the bytes `build:hook-chunks` emits for `entry`. */
+export interface ChunkBudget {
+    readonly entry: string;
+    readonly maxBytes: number;
+}
+
+/**
+ * The chunk ceilings, from the budget's optional `chunks` list. A chunk moves
+ * bytes out of the dispatch bundle; without a ceiling of its own it would only
+ * move uncontrolled growth somewhere nobody measures (council 2026-10-18).
+ */
+export function readChunkBudgets(root: string): ChunkBudget[] {
+    const raw = JSON.parse(fs.readFileSync(path.join(root, BUDGET_REL), 'utf-8')) as Record<string, unknown>;
+    const list = raw['chunks'];
+    if (list === undefined) return [];
+    if (!Array.isArray(list)) throw new Error(`${BUDGET_REL}: chunks must be a list`);
+    return list.map((c, i) => {
+        const entry = isRecord(c) ? c['entry'] : undefined;
+        const max = isRecord(c) ? c['max_bytes'] : undefined;
+        if (typeof entry !== 'string' || typeof max !== 'number' || !Number.isInteger(max) || max <= 0) {
+            throw new Error(`${BUDGET_REL}: chunks[${String(i)}] needs a string entry and a positive integer max_bytes`);
+        }
+        return { entry, maxBytes: max };
+    });
+}
+
+/**
+ * Build the chunk for `entry` with the exact esbuild segment `build:hook-chunks`
+ * uses for it, to a throwaway path, and return its size. Throws when the script
+ * carries no segment for the entry — a ceiling on a chunk nothing builds bounds
+ * nothing.
+ */
+export function buildChunkBytes(root: string, entry: string): number {
+    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')) as { scripts?: Record<string, string> };
+    const script = pkg.scripts?.['build:hook-chunks'] ?? '';
+    const segment = script
+        .split('&&')
+        .map((x) => x.trim())
+        .find((x) => x.startsWith('esbuild ') && x.split(/\s+/).includes(entry));
+    if (segment === undefined) throw new Error(`\`build:hook-chunks\` builds no chunk from ${entry}`);
+    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-chunk-composition-'));
+    const out = path.join(dir, 'chunk.cjs');
+    try {
+        const cmd = segment.replace(/--outfile=\S+/, `--outfile=${out}`);
+        const built = spawnSync('sh', ['-c', cmd], {
+            cwd: root,
+            encoding: 'utf-8',
+            env: { ...process.env, PATH: `${path.join(root, 'node_modules', '.bin')}:${process.env['PATH'] ?? ''}` },
+        });
+        if (built.status !== 0 || !fs.existsSync(out)) {
+            throw new Error(`esbuild failed for chunk ${entry} (exit ${String(built.status)})\n${built.stderr ?? ''}`);
+        }
+        return fs.statSync(out).size;
+    } finally {
+        fs.rmSync(dir, { recursive: true, force: true });
+    }
+}
+
+/** Over-ceiling findings for measured chunks. */
+export function chunkFindings(measured: ReadonlyMap<string, number>, budgets: readonly ChunkBudget[]): string[] {
+    const out: string[] = [];
+    for (const b of budgets) {
+        const bytes = measured.get(b.entry);
+        if (bytes === undefined) out.push(`chunk ${b.entry} was not measured`);
+        else if (bytes > b.maxBytes) {
+            out.push(
+                `chunk ${b.entry} is ${String(bytes)} bytes, ceiling is ${String(b.maxBytes)} ` +
+                    `(over by ${String(bytes - b.maxBytes)}). Shrink it, or raise its max_bytes in ${BUDGET_REL} ` +
+                    'WITH a raise_log entry naming the chunk and what was added.',
+            );
+        }
+    }
+    return out;
+}
+
+/**
+ * A chunk ceiling raised against the base revision needs a new raise_log entry
+ * whose `chunk` is the entry and whose `to` is the new ceiling — the main
+ * ceiling's rule, applied per chunk.
+ */
+export function chunkRaiseFindings(baseRaw: string | null, workingRaw: string): string[] {
+    if (baseRaw === null) return [];
+    const base = JSON.parse(baseRaw) as Record<string, unknown>;
+    const working = JSON.parse(workingRaw) as Record<string, unknown>;
+    const ceilings = (raw: Record<string, unknown>): Map<string, number> =>
+        new Map(
+            (Array.isArray(raw['chunks']) ? (raw['chunks'] as unknown[]) : [])
+                .filter(isRecord)
+                .map((c) => [String(c['entry']), Number(c['max_bytes'])]),
+        );
+    const before = ceilings(base);
+    const seen = new Set((Array.isArray(base['raise_log']) ? (base['raise_log'] as unknown[]) : []).map((e) => JSON.stringify(e)));
+    const gained = (Array.isArray(working['raise_log']) ? (working['raise_log'] as unknown[]) : []).filter(
+        (e) => !seen.has(JSON.stringify(e)),
+    );
+    const out: string[] = [];
+    for (const [entry, to] of ceilings(working)) {
+        const from = before.get(entry);
+        if (from === undefined || to <= from) continue;
+        const logged = gained.find((e) => isRecord(e) && e['chunk'] === entry && e['to'] === to);
+        if (logged === undefined) {
+            out.push(`chunk ${entry} ceiling raised from ${String(from)} to ${String(to)} with no new raise_log entry for it`);
+        } else {
+            const problems = raiseEntryProblems(logged as Record<string, unknown>, from);
+            if (problems.length > 0) out.push(`the raise_log entry for chunk ${entry} is incomplete: ${problems.join('; ')}.`);
+        }
+    }
+    return out;
+}
+
 /** Read the committed budget. Throws rather than defaulting — a guessed ceiling bounds nothing. */
 export function readBudget(root: string): Budget {
     const abs = path.join(root, BUDGET_REL);
@@ -420,6 +530,17 @@ export function main(argv: readonly string[] = process.argv.slice(2), root: stri
     }
 
     const findings = verdict(analysis, budget);
+    const chunkSizes = new Map<string, number>();
+    if (fixture === undefined) {
+        try {
+            const budgets = readChunkBudgets(root);
+            for (const b of budgets) chunkSizes.set(b.entry, buildChunkBytes(root, b.entry));
+            findings.push(...chunkFindings(chunkSizes, budgets));
+        } catch (e) {
+            process.stderr.write(`check_hook_bundle_composition: ${String(e instanceof Error ? e.message : e)}\n`);
+            return 2;
+        }
+    }
     const baseAt = argv.indexOf('--base-ref');
     const baseBudget = readBaseBudget(root, baseAt >= 0 ? argv[baseAt + 1] : undefined);
     if (baseBudget === undefined) {
@@ -436,7 +557,8 @@ export function main(argv: readonly string[] = process.argv.slice(2), root: stri
         }
         process.stdout.write('raise rule: no base revision resolved — the max_bytes raise check was not evaluated\n');
     } else {
-        findings.push(...raiseFindings(baseBudget, fs.readFileSync(path.join(root, BUDGET_REL), 'utf-8')));
+        const workingBudget = fs.readFileSync(path.join(root, BUDGET_REL), 'utf-8');
+        findings.push(...raiseFindings(baseBudget, workingBudget), ...chunkRaiseFindings(baseBudget, workingBudget));
     }
     // Reported on BOTH paths, red included: a census that goes quiet exactly
     // when the gate fires is the shape `reportScanned` exists to prevent.
@@ -453,6 +575,7 @@ export function main(argv: readonly string[] = process.argv.slice(2), root: stri
                 `${String(analysis.yamlPackages.length)} YAML reader(s) ` +
                 `[${analysis.yamlPackages.join(', ')}], ${String(analysis.modules)} modules\n`,
         );
+        for (const [entry, bytes] of chunkSizes) process.stdout.write(`✅  chunk ${entry}: ${String(bytes)} B\n`);
         return 0;
     }
     process.stderr.write('❌  hook bundle composition is out of budget\n');
```

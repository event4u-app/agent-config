<!-- evidence-type: analysis -->

# Ratification review — the `self-repair` hook concern as a lazy chunk (self-contained, round 8)

Output contract: end your answer with exactly one line `STANCE: <verdict> | CONFIDENCE: <high|medium|low> | DEALBREAKER: <yes|no>`, verdict one of `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`. Only that line is read.

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file, `src/config/hook-bundle-budget.json`, is on the ratification gate's list as a hook-plumbing source, so the change needs a provider-diverse verdict under ADR-268 § 4. This prompt is self-contained: everything needed is below.

subject: 5a7474292f0a2bdbc97e677ee0fdbd58e43013a2c27d8333a70765697a92038f

## Background

Every concern in `concern_registry.ts` is inlined into `dist/hooks/dispatch.js`, which every hook event parses; `hook-bundle-budget.json` caps that bundle (`max_bytes`, shrink-only) and each conditional chunk. A concern listed in `LAZY_CONCERNS` is built into its own chunk by `hook_chunks.mjs` and `require`d only when run; when the chunk is missing or fails its digest, the dispatcher spawns the concern's script. At the base the bundle measured 1,581,986 B against 1,582,000 B.

`self-repair` is bound on `user_prompt_submit` and `stop`, `fail_closed: false`, `severity: advisory`, and writes only under `agents/runtime/self-repair/`. Two defects in it pre-date this change (at `origin/main`: `src/scripts/self_repair_hook.ts:194,200` read `prompt`/`transcript_path` from the envelope's top level although the dispatcher nests them under `payload`; `:237-239` emit the queue line as `context`, which `dispatch_hook.ts:1374` forwards on `session_start` only, while `src/rules/self-repair-loop.md:38` documents it as injected at prompt time). The diff fixes both: it reads `payload` first, and emits `additional_context` under the advisory warn code 2, the shape `session-register` and `intake-pass` already use on that slot. Binding, failure policy and write target are unchanged; the concern still cannot return the block code.

## Measurements (`check_hook_bundle_composition`, fresh build)

Dispatch bundle 1,557,293 B (ceiling 1,582,000 B, unchanged). Chunk `self_repair_hook.ts` 58,346 B (ceiling 64,000 B, the gate fails the build above it). 

## Tests (`tests/hooks/self_repair_lazy_paths.test.ts`, all pass against a fresh `npm run build:hooks`)

1. The concern is in `LAZY_CONCERNS` and not in `CONCERN_REGISTRY`.
2. In-process loader path and spawned script write identical records.
3. The nested-`payload` prompt is read.
4. The built dispatcher with the digested chunk writes one record and delivers `<self-repair-queue>` (red before the delivery fix).
5. The built dispatcher in a package layout without the chunk falls back to spawning: exactly one record with `occurrences: 1`, exactly one `<self-repair-queue>`.

Generic coverage elsewhere: the loader returns `null` for a missing, malformed, incompatible, throwing or undigested chunk (`tests/hooks/lazy_concern_fallback.test.ts`); registry parity and lazy-resolution tests pass.

## The complete diff of the move, the delivery fix and the test

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index de35900651..1d2a0ba2da 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -255,6 +255,12 @@
             "max_bytes": 14000,
             "registered_at": "2026-11-02",
             "derivation": "Measured 13,287 bytes on 2026-11-02: rows 2.1 and 2.2, already in the hook Finding shape, of check_web_launch_readiness (third-party load on first paint, superseded statute on a legal page), the 12-row provider register and the one-row supersession table. Loaded by design_pass_hook only for an .html/.css write. The ceiling is the next thousand above that reading; the 713-byte (5.4 %) margin is what that rounding leaves, not a growth estimate. A register row serialises to 150-223 bytes (mean 181), so the margin admits about three more rows before the chunk must be re-measured and this row re-derived."
+        },
+        {
+            "entry": "src/scripts/self_repair_hook.ts",
+            "max_bytes": 64000,
+            "registered_at": "2026-11-04",
+            "derivation": "Measured 58,114 bytes on 2026-11-04 for road-to-a-noted-that-is-a-write. The chunk holds the self-repair concern, its four detectors including persistence-claim, the record store with the target and subject indexes, the read-only host-memory reader and the Class-A telemetry shadow; `yaml` is external, resolved from the installed package as for the chat_history, update_notice and star_ask chunks. The ceiling is that reading plus about 10 %, rounded, the same margin as the quota_notice and intake_pass rows; no further growth is queued. WHY IT WAS MOVED: the dispatch bundle sat 14 bytes under its 1,582,000 ceiling at origin/main b53718de2 (measured 1,581,986 B by this gate with APFS-cloned node_modules), and the roadmap's detector work had to land somewhere. The concern built alone was 51,156 bytes before the work; moving it out, as the 2026-10-18 council chose for this situation, took the dispatch bundle to 1,557,293 B (-24,693 B, the rest being modules other concerns still import) instead of raising the dispatch ceiling. Bound on `user_prompt_submit` and `stop`; the bundle carries only its LAZY_CONCERNS row. A missing or mis-digested chunk falls back to spawning the same script, which is slower; the generic fallback tests cover the routing, not a concern-specific equivalence of the records, and on either path a failure of the concern does not reject the hook event (`fail_closed: false`)."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index 30a67229c1..43680dfa55 100644
--- a/src/scripts/hook_chunks.mjs
+++ b/src/scripts/hook_chunks.mjs
@@ -93,6 +93,14 @@ export const HOOK_CHUNKS = Object.freeze([
         entry: 'src/scripts/hooks/web_launch_rows.ts',
         outfile: 'dist/hooks/web_launch_rows.chunk.cjs',
     }),
+    // `self-repair` on `user_prompt_submit` and `stop`; the detectors, the
+    // record store and the Class-A shadow stay off every other dispatch's
+    // parse. `yaml` external: the telemetry shadow reads the settings layers.
+    Object.freeze({
+        entry: 'src/scripts/self_repair_hook.ts',
+        outfile: 'dist/hooks/self_repair.chunk.cjs',
+        external: Object.freeze(['yaml']),
+    }),
 ]);
 
 /**
diff --git a/src/scripts/hooks/concern_registry.ts b/src/scripts/hooks/concern_registry.ts
index c9a06f7fa2..cec48c5575 100644
--- a/src/scripts/hooks/concern_registry.ts
+++ b/src/scripts/hooks/concern_registry.ts
@@ -44,7 +44,6 @@ import { main as pushSettleMain } from './push_settle_hook.js';
 import { main as sessionCanaryMain } from '../session_canary_hook.js';
 import { main as councilAvailabilityMain } from '../council_availability_hook.js';
 import { main as telemetryDisclosureMain } from '../telemetry_disclosure_hook.js';
-import { main as selfRepairMain } from '../self_repair_hook.js';
 import { main as sessionRegisterMain } from '../session_register_hook.js';
 import { main as languageMirrorMain } from '../language_mirror_hook.js';
 import { main as gitAuthorizationMain } from '../git_authorization_hook.js';
@@ -114,7 +113,6 @@ export const CONCERN_REGISTRY: Readonly<Record<string, ConcernMain>> = {
     'src/scripts/session_canary_hook.ts': sessionCanaryMain as ConcernMain,
     'src/scripts/council_availability_hook.ts': councilAvailabilityMain as ConcernMain,
     'src/scripts/telemetry_disclosure_hook.ts': telemetryDisclosureMain as ConcernMain,
-    'src/scripts/self_repair_hook.ts': selfRepairMain as ConcernMain,
     'src/scripts/session_register_hook.ts': sessionRegisterMain as ConcernMain,
     'src/scripts/language_mirror_hook.ts': languageMirrorMain as ConcernMain,
     'src/scripts/git_authorization_hook.ts': gitAuthorizationMain as ConcernMain,
diff --git a/src/scripts/hooks/lazy_concern.ts b/src/scripts/hooks/lazy_concern.ts
index 3d87ff7d0c..6389440949 100644
--- a/src/scripts/hooks/lazy_concern.ts
+++ b/src/scripts/hooks/lazy_concern.ts
@@ -74,6 +74,7 @@ export const LAZY_CONCERNS: Readonly<Record<string, { readonly chunk: string; re
     'src/scripts/quota_notice_hook.ts': lazy('quota_notice.chunk.cjs', '../quota_notice_hook'),
     'src/scripts/hooks/layer_promotion_hook.ts': lazy('layer_promotion.chunk.cjs', 'layer_promotion_hook'),
     'src/scripts/hooks/intake_pass_hook.ts': lazy('intake_pass.chunk.cjs', 'intake_pass_hook'),
+    'src/scripts/self_repair_hook.ts': lazy('self_repair.chunk.cjs', '../self_repair_hook'),
 });
 
 declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
diff --git a/src/scripts/self_repair_hook.ts b/src/scripts/self_repair_hook.ts
index eb86f0c0e3..f480587047 100644
--- a/src/scripts/self_repair_hook.ts
+++ b/src/scripts/self_repair_hook.ts
@@ -14,7 +14,8 @@
  *     prompt reaches the same agent one turn later at a fraction of the tokens.
  *   - every other slot — clean no-op.
  *
- * ADVISORY BY CONSTRUCTION (`fail_closed: false`, always exit 0). Blocking a
+ * ADVISORY BY CONSTRUCTION (`fail_closed: false`; exit 0, or the advisory warn
+ * code 2 when it carries the queue line — never the block code). Blocking a
  * turn-end on a heuristic is the failure mode the enforcement-projection and
  * recursive-verification nulls both warn about; this hook records, it does not
  * gate. The one outward step (push + PR, or an issue) stays behind the
@@ -36,11 +37,13 @@ import {
     runDetectors,
     type TurnSnapshot,
 } from './_lib/self_repair.js';
-import { openRecords, upsertFinding } from './_lib/self_repair_store.js';
+import { readHostMemory } from './_lib/host_memory_reader.js';
+import { openRecords, upsertFinding, writeSubjectIndex } from './_lib/self_repair_store.js';
 import { readHookStdin } from './hooks/hook_stdin.js';
 import { emitDefectShadow } from './hooks/telemetry_self_repair.js';
 
 const EXIT_ALLOW = 0;
+const EXIT_WARN = 2;
 
 type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
 type JsonObject = { [k: string]: JsonValue };
@@ -97,7 +100,10 @@ export function readTurn(transcriptPath: string, pinned: 'de' | 'en' | null): Tu
         }
         const content = msg['content'];
         if (obj['type'] === 'user' && typeof content === 'string') {
+            // A new prompt opens a new turn: a write in an earlier turn does not
+            // discharge a claim made in this one.
             prompt = content;
+            toolCommands.length = 0;
         }
         if (obj['type'] !== 'assistant') {
             continue;
@@ -120,7 +126,9 @@ export function readTurn(transcriptPath: string, pinned: 'de' | 'en' | null): Tu
             if (blk['type'] === 'tool_use') {
                 const input = blk['input'];
                 const name = str(blk['name']);
-                const cmd = isObject(input) ? str(input['command']) : '';
+                const cmd = isObject(input)
+                    ? str(input['command']) || str(input['file_path']) || str(input['notebook_path'])
+                    : '';
                 toolCommands.push(`${name} ${cmd}`.trim());
             }
         }
@@ -189,15 +197,26 @@ export function main(): number {
     const root = workspaceRoot(env);
     const now = new Date().toISOString();
     const findings: DefectFinding[] = [];
+    // The dispatcher nests the host's own payload under `payload`; a direct
+    // caller passes the fields at the top level. Reading only the top level
+    // meant no prompt and no transcript ever reached a detector in production.
+    const payload = isObject(env['payload']) ? env['payload'] : env;
+    const field = (...keys: string[]): string => {
+        for (const k of keys) {
+            const v = str(payload[k]) || str(env[k]);
+            if (v !== '') return v;
+        }
+        return '';
+    };
 
     if (slot === 'user_prompt_submit') {
-        const prompt = str(env['prompt'] ?? env['user_prompt'] ?? env['text']);
+        const prompt = field('prompt', 'user_prompt', 'text');
         const f = detectUserReport(prompt);
         if (f !== null) {
             findings.push(f);
         }
     } else {
-        const tp = str(env['transcript_path'] ?? env['transcriptPath']);
+        const tp = field('transcript_path', 'transcriptPath');
         findings.push(...runDetectors(readTurn(tp, pinnedLanguage(env))));
     }
 
@@ -218,6 +237,15 @@ export function main(): number {
             // an unwritable store must never cost the user their turn
         }
     }
+    if (findings.length > 0) {
+        try {
+            // Kept current on every arrival, so a subject's third differently
+            // worded correction is readable as its third arrival right away.
+            writeSubjectIndex(root, readHostMemory());
+        } catch {
+            // derived and regenerable; a failed write loses nothing
+        }
+    }
 
     // Injection happens at prompt time only — see the header note on `stop`.
     if (slot !== 'user_prompt_submit') {
@@ -232,18 +260,21 @@ export function main(): number {
     if (open.length === 0) {
         return EXIT_ALLOW;
     }
+    // `additional_context` under the advisory warn code is the shape the
+    // dispatcher forwards on `user_prompt_submit`; a `context` key is forwarded
+    // on `session_start` only, so the queue line used to reach no model.
     process.stdout.write(
         `${JSON.stringify({
-            decision: 'allow',
+            decision: 'warn',
             reason: `self-repair: ${open.length} open record(s)`,
-            context: buildQueueLine(
+            additional_context: buildQueueLine(
                 open.length,
                 open[0]!.defect_class,
                 open[0]!.occurrences,
             ),
         })}\n`,
     );
-    return EXIT_ALLOW;
+    return EXIT_WARN;
 }
 
 declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
diff --git a/tests/hooks/self_repair_lazy_paths.test.ts b/tests/hooks/self_repair_lazy_paths.test.ts
new file mode 100644
index 0000000000..82c11baf6d
--- /dev/null
+++ b/tests/hooks/self_repair_lazy_paths.test.ts
@@ -0,0 +1,141 @@
+// The self-repair concern ships as a lazy chunk. Both ways the dispatcher can
+// reach it — the loader (in-process) and the spawn fallback taken when the
+// chunk is missing or mis-digested — must leave the same record behind.
+import { spawnSync } from 'node:child_process';
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+
+import { listRecords } from '../../src/scripts/_lib/self_repair_store.js';
+import { CONCERN_REGISTRY, resolveConcernMain } from '../../src/scripts/hooks/concern_registry.js';
+import { clearHookStdinOverride, setHookStdinOverride } from '../../src/scripts/hooks/hook_stdin.js';
+import { LAZY_CONCERNS } from '../../src/scripts/hooks/lazy_concern.js';
+
+const SCRIPT = 'src/scripts/self_repair_hook.ts';
+const PROMPT = 'Du hast schon wieder `tabs` ignoriert';
+
+let tmp: string;
+let prevConfig: string | undefined;
+beforeEach(() => {
+    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sr-lazy-')));
+    fs.mkdirSync(path.join(tmp, 'claude'));
+    prevConfig = process.env['CLAUDE_CONFIG_DIR'];
+    process.env['CLAUDE_CONFIG_DIR'] = path.join(tmp, 'claude');
+});
+afterEach(() => {
+    if (prevConfig === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
+    else process.env['CLAUDE_CONFIG_DIR'] = prevConfig;
+    clearHookStdinOverride();
+    vi.restoreAllMocks();
+    fs.rmSync(tmp, { recursive: true, force: true });
+});
+
+function payload(root: string): string {
+    return JSON.stringify({ event: 'user_prompt_submit', prompt: PROMPT, workspace_root: root });
+}
+
+function stripTimes(root: string): unknown[] {
+    return listRecords(root).map(({ first_seen: _f, last_seen: _l, ...rest }) => rest);
+}
+
+describe('self-repair through both dispatch paths', () => {
+    it('is lazy, not inlined', () => {
+        expect(LAZY_CONCERNS[SCRIPT]).toBeDefined();
+        expect(CONCERN_REGISTRY[SCRIPT]).toBeUndefined();
+    });
+
+    it('the loader path and the spawn fallback write the same record', () => {
+        const viaLoader = path.join(tmp, 'loader');
+        const viaSpawn = path.join(tmp, 'spawn');
+
+        const main = resolveConcernMain(SCRIPT);
+        expect(typeof main).toBe('function');
+        vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
+        setHookStdinOverride(payload(viaLoader));
+        expect(main!([])).toBe(2);
+        clearHookStdinOverride();
+        vi.restoreAllMocks();
+
+        const res = spawnSync(process.execPath, ['--import', 'tsx', path.resolve(SCRIPT)], {
+            input: payload(viaSpawn),
+            encoding: 'utf-8',
+            env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(tmp, 'claude') },
+        });
+        expect(res.status).toBe(2);
+        expect(res.stdout).toContain('<self-repair-queue>');
+
+        const loaderRecords = stripTimes(viaLoader);
+        expect(loaderRecords).toHaveLength(1);
+        expect(loaderRecords).toEqual(stripTimes(viaSpawn));
+        expect(fs.existsSync(path.join(viaSpawn, 'agents', 'runtime', 'self-repair', '_subject-index.json'))).toBe(true);
+    });
+
+    it('reads the prompt the dispatcher nests under `payload`', () => {
+        const root = path.join(tmp, 'nested');
+        vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
+        setHookStdinOverride(
+            JSON.stringify({ event: 'user_prompt_submit', workspace_root: root, payload: { prompt: PROMPT } }),
+        );
+        expect(resolveConcernMain(SCRIPT)!([])).toBe(2);
+        expect(listRecords(root)).toHaveLength(1);
+    });
+
+    it('the built dispatcher writes the record and delivers the queue line to the host', (t) => {
+        const dispatch = path.resolve('dist', 'hooks', 'dispatch.js');
+        // skip-reason: dist/ is untracked, so a clean checkout has no bundle to run.
+        if (!fs.existsSync(dispatch) || !fs.existsSync(path.resolve('dist', 'hooks', 'self_repair.chunk.cjs'))) {
+            t.skip('dist/hooks is not built');
+            return;
+        }
+        const project = path.join(tmp, 'project');
+        fs.mkdirSync(project);
+        const res = spawnSync(
+            process.execPath,
+            [dispatch, '--platform', 'claude', '--event', 'user_prompt_submit', '--native-event', 'UserPromptSubmit', '--project-dir', project, '--min-version', '1'],
+            {
+                input: JSON.stringify({ prompt: PROMPT, hook_event_name: 'UserPromptSubmit', session_id: 't', cwd: project }),
+                encoding: 'utf-8',
+            },
+        );
+        expect(res.status).toBe(0);
+        expect(listRecords(project)).toHaveLength(1);
+        expect(res.stdout).toContain('<self-repair-queue>');
+    });
+
+    it('with the chunk missing, the built dispatcher falls back to the spawn path exactly once', (t) => {
+        const built = path.resolve('dist', 'hooks');
+        // skip-reason: dist/ is untracked, so a clean checkout has no bundle to run.
+        if (!fs.existsSync(path.join(built, 'dispatch.js'))) {
+            t.skip('dist/hooks is not built');
+            return;
+        }
+        // A package layout identical to the built one except for the chunk:
+        // the loader returns null and the dispatcher must spawn the script.
+        const pkg = path.join(tmp, 'pkg');
+        fs.mkdirSync(path.join(pkg, 'dist', 'hooks'), { recursive: true });
+        for (const name of fs.readdirSync(built)) {
+            if (name.startsWith('self_repair.chunk')) continue;
+            fs.cpSync(path.join(built, name), path.join(pkg, 'dist', 'hooks', name), { recursive: true });
+        }
+        fs.symlinkSync(path.resolve('src'), path.join(pkg, 'src'));
+        fs.symlinkSync(path.resolve('node_modules'), path.join(pkg, 'node_modules'));
+        fs.copyFileSync(path.resolve('package.json'), path.join(pkg, 'package.json'));
+        const project = path.join(tmp, 'project-fallback');
+        fs.mkdirSync(project);
+        const res = spawnSync(
+            process.execPath,
+            [path.join(pkg, 'dist', 'hooks', 'dispatch.js'), '--platform', 'claude', '--event', 'user_prompt_submit', '--native-event', 'UserPromptSubmit', '--project-dir', project, '--min-version', '1'],
+            {
+                input: JSON.stringify({ prompt: PROMPT, hook_event_name: 'UserPromptSubmit', session_id: 't', cwd: project }),
+                encoding: 'utf-8',
+            },
+        );
+        expect(res.status).toBe(0);
+        const records = listRecords(project);
+        expect(records).toHaveLength(1);
+        expect(records[0]!.occurrences).toBe(1);
+        expect(res.stdout.split('<self-repair-queue>').length - 1).toBe(1);
+    });
+});
```

## The question

Is this change authority-expanding, and should it land? Findings briefly, then the STANCE line.

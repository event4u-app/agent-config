<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch drain/road-to-one-detector-and-the-senders-we-own-20261018b,
     round 4 part a, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261018b, round 4a — the round-3 findings on the egress engine loader

Ratification review under ADR-268 § 4. Round 4 is split in three parts (4a, 4b, 4c) because
prompts above roughly 20 KB timed out on both seats today. All three parts review the same
commit `19a4516d2`; the ratification gate classifies eight files of the branch as gated
(`hook-bundle-budget.json`, `hook-latency-budget.json`, `_lib/egress_engine.ts`,
`_lib/egress_rules.ts`, `hook_manifest.json`, `hook_manifest.yaml`,
`hooks/block_credential_reads.ts`, `hooks/egress_engine_loader.ts`), and the subject digest over
the whole changed-file list is `50705314fe1fcb4dd96da255caedb00afe182d24d43972cc0e2f2ea0502543cb`.

Round 3 reviewed the loader and the egress stage (the engine moved out of the dispatch bundle into
a conditional chunk, per the council's bundle-budget decision earlier today). Both seats returned
REQUEST_CHANGES. Their findings and what changed:

1. **A present chunk whose own dependency fails to resolve was reported `missing`** (both seats).
   Now `missing` means only that the chunk file is absent; any throw from loading an existing
   chunk is `invalid`. New test: a chunk that requires a nonexistent module is `invalid`.
2. **Specifier resolution and the digest check ran outside the loader's conversion boundary**
   (openai). Every step now runs inside one `try`; the function returns a value on every path.
   New test: an unresolvable bundle url returns `invalid` and does not throw.
3. **The stage recognised an unavailable engine by message prefix** (openai). It now throws and
   catches a dedicated `EngineUnavailableError`.
4. **Exported `countEnvelope` / `buildPlaceholderEnvelope` default their engine through a call
   that throws** (anthropic). Kept as a default — the stage passes the engine explicitly — and
   now documented on both functions; the one caller outside the stage, the replay preview, catches
   it and reports `engine-unavailable`.
5. **Unshown claims** (both seats). The tests now cover: the capsule rejecting an envelope with
   the engine unavailable, the replay preview reporting `engine-unavailable` instead of zero
   findings, and a metafile check that the built dispatch bundle contains none of
   `egress_rules.ts`, `egress_token.ts`, `secret_detector.ts`, `egress_engine.ts` (with a check
   that the stage itself is in the bundle, so the path form is right). The budget file, the
   composition gate's chunk check and the capsule are part 4b.
6. **From-source path without `tsx`** (openai): documented as failing closed (`invalid`); the
   source path is development-only.

Shown below: the delta of the loader and the stage since round 3, then the chunk test file in full.
Say whether each round-3 finding is closed.

For each defect report file:line, the failure scenario and a severity. State your stance
(APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

```diff
diff --git a/src/scripts/hooks/egress_engine_loader.ts b/src/scripts/hooks/egress_engine_loader.ts
index 5339d45d9..f7fa84591 100644
--- a/src/scripts/hooks/egress_engine_loader.ts
+++ b/src/scripts/hooks/egress_engine_loader.ts
@@ -61,7 +61,9 @@ export function engineSpecifier(selfUrl: string, bundled: boolean): string {
  * From source the engine is TypeScript whose imports name `.js` siblings, which
  * a plain `require` cannot resolve outside a `tsx` process (a test runner, for
  * one). `tsx`'s own require resolves them; the specifier is computed so esbuild
- * never pulls `tsx` into the bundle, where this branch is not taken.
+ * never pulls `tsx` into the bundle, where this branch is not taken. Without
+ * `tsx` the plain require fails on such a module, which is `invalid`: the
+ * source path is a development path, and it fails closed like every other.
  */
 function sourceRequire(req: NodeJS.Require): (id: string, from: string) => unknown {
     try {
@@ -73,28 +75,37 @@ function sourceRequire(req: NodeJS.Require): (id: string, from: string) => unkno
     return (id: string) => req(id);
 }
 
-/** The uncached load; `bundled` is a test seam, the hook path never passes it. */
+/**
+ * The uncached load; `bundled` is a test seam, the hook path never passes it.
+ *
+ * Every step — resolving the specifier, the existence check, the digest, the
+ * load, the export check — runs inside one conversion boundary, so the function
+ * returns a value on every path. `missing` means the chunk file itself is
+ * absent; once it exists, anything its load throws (a dependency it cannot
+ * resolve included) is `invalid`.
+ */
 export function loadEgressEngineUncached(selfUrl: string = import.meta.url, bundled: boolean = isBundled()): EngineLoad {
-    const specifier = engineSpecifier(selfUrl, bundled);
-    if (bundled) {
+    try {
+        const specifier = engineSpecifier(selfUrl, bundled);
         if (!fs.existsSync(specifier)) return { ok: false, reason: 'missing' };
         // No sidecar, a malformed one or a mismatch: the chunk is not the one built.
-        if (verifyBundle(specifier).state !== 'ok') return { ok: false, reason: 'digest' };
-    }
-    let mod: Record<string, unknown>;
-    try {
-        const req = createRequire(selfUrl);
-        mod = (bundled ? req(specifier) : sourceRequire(req)(specifier, fileURLToPath(selfUrl))) as Record<string, unknown>;
-    } catch (exc) {
-        const code = (exc as NodeJS.ErrnoException).code;
-        return { ok: false, reason: code === 'MODULE_NOT_FOUND' ? 'missing' : 'invalid' };
-    }
-    if (mod['ENGINE_SCHEMA'] !== EXPECTED_ENGINE_SCHEMA) return { ok: false, reason: 'schema' };
-    for (const name of ['detect', 'replaceValues', 'scanText', 'TokenScope', 'EgressRefusedError']) {
-        if (typeof mod[name] !== 'function') return { ok: false, reason: 'invalid' };
+        if (bundled && verifyBundle(specifier).state !== 'ok') return { ok: false, reason: 'digest' };
+        let mod: Record<string, unknown>;
+        try {
+            const req = createRequire(selfUrl);
+            mod = (bundled ? req(specifier) : sourceRequire(req)(specifier, fileURLToPath(selfUrl))) as Record<string, unknown>;
+        } catch {
+            return { ok: false, reason: 'invalid' };
+        }
+        if (mod['ENGINE_SCHEMA'] !== EXPECTED_ENGINE_SCHEMA) return { ok: false, reason: 'schema' };
+        for (const name of ['detect', 'replaceValues', 'scanText', 'TokenScope', 'EgressRefusedError']) {
+            if (typeof mod[name] !== 'function') return { ok: false, reason: 'invalid' };
+        }
+        if (!Array.isArray(mod['EGRESS_RULES'])) return { ok: false, reason: 'invalid' };
+        return { ok: true, engine: mod as unknown as EgressEngine };
+    } catch {
+        return { ok: false, reason: 'invalid' };
     }
-    if (!Array.isArray(mod['EGRESS_RULES'])) return { ok: false, reason: 'invalid' };
-    return { ok: true, engine: mod as unknown as EgressEngine };
 }
 
 const cache = new Map<string, EngineLoad>();
diff --git a/src/scripts/hooks/egress_stage.ts b/src/scripts/hooks/egress_stage.ts
index 69b73dc8b..b2999e9e4 100644
--- a/src/scripts/hooks/egress_stage.ts
+++ b/src/scripts/hooks/egress_stage.ts
@@ -41,6 +41,7 @@ export const EGRESS_STAGE_KILL_SWITCH = "AGENT_CONFIG_NO_EGRESS_STAGE";
  */
 export const EXECUTION_VIEW_GRANTS: ReadonlyMap<string, string> = new Map([
   ["block-config-weakening", "src/scripts/hooks/block_config_weakening.ts"],
+  ["block-credential-reads", "src/scripts/hooks/block_credential_reads.ts"],
   ["block-kernel-rule-writes", "src/scripts/hooks/block_kernel_rule_writes.ts"],
   ["block-no-verify", "src/scripts/hooks/block_no_verify.ts"],
   ["block-plumbing-writes", "src/scripts/hooks/block_plumbing_writes.ts"],
@@ -190,18 +191,33 @@ function collectStrings(v: JsonValue, out: string[]): void {
 /** The rule id a refusal records when the engine cannot load. */
 export const ENGINE_UNAVAILABLE = "engine-unavailable";
 
+/** Raised when the engine cannot load; the stage turns it into an `engine-unavailable` refusal. */
+export class EngineUnavailableError extends Error {
+  readonly reason: string;
+
+  constructor(reason: string) {
+    super(`${ENGINE_UNAVAILABLE}: ${reason}`);
+    this.reason = reason;
+    this.name = "EngineUnavailableError";
+  }
+}
+
 /**
- * The engine, or a throw the stage's own failure path turns into a withheld
- * view (`protect`, `strict`) or a recorded miss (`observe`). Never reached when
- * the mode is `off`, so the shipped default loads nothing.
+ * The engine, or an `EngineUnavailableError` the stage's own failure path turns
+ * into a withheld view (`protect`, `strict`) or a recorded miss (`observe`).
+ * Never reached when the mode is `off`, so the shipped default loads nothing.
  */
 export function requireEngine(load: () => ReturnType<typeof loadEgressEngine> = loadEgressEngine): EgressEngine {
   const r = load();
-  if (!r.ok) throw new Error(`${ENGINE_UNAVAILABLE}: ${r.reason}`);
+  if (!r.ok) throw new EngineUnavailableError(r.reason);
   return r.engine;
 }
 
-/** Detection and the extent proof only — nothing is replaced and nothing is kept. */
+/**
+ * Detection and the extent proof only — nothing is replaced and nothing is kept.
+ * Throws `EngineUnavailableError` when no engine is passed and none loads; a
+ * caller outside the stage handles it (the replay preview reports it).
+ */
 export function countEnvelope(
   envelope: JsonObject,
   engine: EgressEngine = requireEngine(),
@@ -252,7 +268,8 @@ function replaceDeep(v: JsonValue, scope: TokenScope, engine: EgressEngine): Jso
  * The placeholder view: every listed value in the prompt, the tool input and
  * the tool result replaced by its token, under one scope that lives as long as
  * this dispatch. A key whose value cannot be replaced safely is withheld whole,
- * never partly replaced. The received envelope is not modified.
+ * never partly replaced. The received envelope is not modified. Throws
+ * `EngineUnavailableError` when no engine is passed and none loads.
  */
 export function buildPlaceholderEnvelope(
   envelope: JsonObject,
@@ -357,7 +374,7 @@ export function runEgressStage(
     const placeholder = mode === "observe" ? undefined : buildPlaceholderEnvelope(envelope, engine);
     result = { mode, placeholder, ...counted };
   } catch (exc) {
-    const rule = exc instanceof Error && exc.message.startsWith(ENGINE_UNAVAILABLE) ? ENGINE_UNAVAILABLE : "stage-error";
+    const rule = exc instanceof EngineUnavailableError ? ENGINE_UNAVAILABLE : "stage-error";
     const scanned = FIELDS.filter((f) => presentKeys(payload, f).length > 0);
     const refused = scanned.map((field) => ({ field, rule }));
     if (mode === "observe") {
```

```ts
/**
 * The egress engine as a conditional chunk (road-to-one-detector-and-the-
 * senders-we-own 2.2b; council 2026-10-18, options C and B).
 *
 * Two halves, each from one of the council's conditions:
 *
 * 1. **The loader refuses every unusable chunk** — missing, altered against its
 *    sidecar, without a sidecar, of another schema, or syntactically invalid —
 *    and loads a good one. Each case builds a real chunk with esbuild into a
 *    temporary directory, so the bundled branch is exercised without the
 *    repository's own `dist/`.
 * 2. **No mode dispatches unscanned content in a protective mode.** With the
 *    engine unavailable, `off` never loads it, `observe` records the miss and
 *    changes no view, and `protect` and `strict` withhold every body.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    ENGINE_CHUNK_BASENAME,
    loadEgressEngineUncached,
    type EngineLoad,
} from '../../../src/scripts/hooks/egress_engine_loader.js';
import { ENGINE_UNAVAILABLE, runEgressStage, WITHHELD_MARKER, type EgressMode } from '../../../src/scripts/hooks/egress_stage.js';
import type { JsonObject } from '../../../src/scripts/hooks/payload_stub.js';
import { buildMetafile } from '../../../src/scripts/check_hook_bundle_composition.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const ESBUILD = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'esbuild.cmd' : 'esbuild');

let tmp: string;
let goodChunk: Buffer;

function writeChunk(dir: string, body: Buffer | string, sidecar: 'match' | 'mismatch' | 'none'): string {
    fs.mkdirSync(dir, { recursive: true });
    const chunk = path.join(dir, ENGINE_CHUNK_BASENAME);
    fs.writeFileSync(chunk, body);
    const sha = createHash('sha256').update(body).digest('hex');
    if (sidecar !== 'none') {
        const recorded = sidecar === 'match' ? sha : sha.replace(/^./, sha[0] === '0' ? '1' : '0');
        fs.writeFileSync(`${chunk.replace(/\.js$/u, '')}.sha256`, `${recorded}  ${ENGINE_CHUNK_BASENAME}\n`);
    }
    // The loader resolves the chunk as a sibling of the bundle it runs from.
    return pathToFileURL(path.join(dir, 'dispatch.js')).href;
}

beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-chunk-'));
    const out = path.join(tmp, 'built.cjs');
    const r = spawnSync(
        ESBUILD,
        [path.join(REPO_ROOT, 'src/scripts/_lib/egress_engine.ts'), '--bundle', '--platform=node', '--format=cjs', '--target=node20', `--outfile=${out}`],
        { encoding: 'utf-8' },
    );
    expect(r.status, r.stderr).toBe(0);
    goodChunk = fs.readFileSync(out);
});

afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

const reason = (l: EngineLoad): string => (l.ok ? 'ok' : l.reason);

describe('the loader refuses every unusable chunk', () => {
    it('loads a good chunk with a matching sidecar', () => {
        const load = loadEgressEngineUncached(writeChunk(path.join(tmp, 'good'), goodChunk, 'match'), true);
        expect(reason(load)).toBe('ok');
        if (load.ok) expect(load.engine.detect(`x ghp_${'a1'.repeat(18)} y`).length).toBe(1);
    });

    it('refuses a missing chunk', () => {
        const dir = path.join(tmp, 'missing');
        fs.mkdirSync(dir, { recursive: true });
        expect(reason(loadEgressEngineUncached(pathToFileURL(path.join(dir, 'dispatch.js')).href, true))).toBe('missing');
    });

    it('refuses a chunk altered against its sidecar', () => {
        const altered = Buffer.concat([goodChunk, Buffer.from('\n// altered\n')]);
        const url = writeChunk(path.join(tmp, 'altered'), altered, 'none');
        const sha = createHash('sha256').update(goodChunk).digest('hex');
        fs.writeFileSync(path.join(tmp, 'altered', `${ENGINE_CHUNK_BASENAME}.sha256`), `${sha}  ${ENGINE_CHUNK_BASENAME}\n`);
        expect(reason(loadEgressEngineUncached(url, true))).toBe('digest');
    });

    it('refuses a chunk with no sidecar to match', () => {
        expect(reason(loadEgressEngineUncached(writeChunk(path.join(tmp, 'nosidecar'), goodChunk, 'none'), true))).toBe('digest');
    });

    it('refuses a correctly digested chunk of another schema', () => {
        const stale = Buffer.from(goodChunk.toString('utf-8').replace(/ENGINE_SCHEMA = 1\b/, 'ENGINE_SCHEMA = 0'));
        expect(stale.equals(goodChunk)).toBe(false);
        expect(reason(loadEgressEngineUncached(writeChunk(path.join(tmp, 'stale'), stale, 'match'), true))).toBe('schema');
    });

    it('refuses a chunk that does not parse', () => {
        expect(reason(loadEgressEngineUncached(writeChunk(path.join(tmp, 'invalid'), 'module.exports = {', 'match'), true))).toBe('invalid');
    });

    it('refuses a present chunk whose own dependency cannot be resolved as invalid, not missing', () => {
        const body = "require('./no-such-dependency.cjs'); module.exports = {};";
        expect(reason(loadEgressEngineUncached(writeChunk(path.join(tmp, 'transitive'), body, 'match'), true))).toBe('invalid');
    });

    it('returns a value, never a throw, when the bundle url itself cannot be resolved', () => {
        expect(() => loadEgressEngineUncached('not a url', true)).not.toThrow();
        expect(reason(loadEgressEngineUncached('not a url', true))).toBe('invalid');
    });

    it('refuses a chunk missing an export it must carry', () => {
        const body = 'module.exports = { ENGINE_SCHEMA: 1, EGRESS_RULES: [] };';
        expect(reason(loadEgressEngineUncached(writeChunk(path.join(tmp, 'partial'), body, 'match'), true))).toBe('invalid');
    });
});

describe('an unavailable engine never lets a protective mode pass content unscanned', () => {
    const PLANTED = ['ghp', 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7'.slice(0, 36)].join('_');
    const env = (): JsonObject => ({
        schema_version: 1,
        platform: 'claude',
        event: 'pre_tool_use',
        workspace_root: tmp,
        payload: { tool_name: 'Bash', tool_input: { command: `echo ${PLANTED}` } },
        settings: {},
    });
    const unavailable = (): EngineLoad => ({ ok: false, reason: 'missing' });

    it('off never loads the engine', () => {
        let called = 0;
        const r = runEgressStage(env(), () => 'off', () => {
            called += 1;
            return unavailable();
        });
        expect(called).toBe(0);
        expect(r.placeholder).toBeUndefined();
    });

    it('observe records the miss and changes no view', () => {
        const r = runEgressStage(env(), () => 'observe', unavailable);
        expect(r.placeholder).toBeUndefined();
        expect(r.refused).toEqual([{ field: 'input', rule: ENGINE_UNAVAILABLE }]);
    });

    for (const mode of ['protect', 'strict'] as EgressMode[]) {
        it(`${mode} withholds every body`, () => {
            const r = runEgressStage(env(), () => mode, unavailable);
            const view = JSON.stringify(r.placeholder);
            expect(view.includes(PLANTED)).toBe(false);
            expect(view.includes(WITHHELD_MARKER)).toBe(true);
            expect(r.refused).toEqual([{ field: 'input', rule: ENGINE_UNAVAILABLE }]);
        });
    }
});

describe('nothing in the dispatch bundle pulls the engine statically', () => {
    it('the built bundle carries none of the engine modules', () => {
        const meta = JSON.parse(buildMetafile(REPO_ROOT)) as { inputs: Record<string, unknown> };
        const engine = [
            'src/scripts/_lib/egress_rules.ts',
            'src/scripts/_lib/egress_token.ts',
            'src/scripts/_lib/secret_detector.ts',
            'src/scripts/_lib/egress_engine.ts',
        ];
        expect(Object.keys(meta.inputs).length).toBeGreaterThan(100);
        // The path form the check reads: the stage that uses the engine is in the bundle.
        expect('src/scripts/hooks/egress_stage.ts' in meta.inputs).toBe(true);
        expect(engine.filter((m) => m in meta.inputs)).toEqual([]);
    }, 120_000);
});
```

<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch drain/road-to-one-detector-and-the-senders-we-own-20261018b,
     round 3 (fourth attempt), committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261018b, round 3 — the egress engine as a conditional chunk

Three earlier attempts at this round (47 KB, 33 KB and 22 KB prompts) timed out on both seats
with no answer; this one carries only the loader and the stage.

Ratification review under ADR-268 § 4 of the second half of this branch. The first half
(every credential consumer reads the one rule table) was approved 2/2 in round 2. Since then
the branch implements the decision the council took earlier today on the bundle budget
(prompt `agents/evidence/council/one-detector-bundle-budget-20261018.question.md`, options C
and B, both seats): move the egress engine out of `dist/hooks/dispatch.js` into a conditional
chunk, and move the per-rule linearity prose out of the shipped table.

The ratification gate now classifies four files as gated: `src/config/hook-bundle-budget.json`,
`src/scripts/_lib/egress_engine.ts`, `src/scripts/_lib/egress_rules.ts`,
`src/scripts/hooks/egress_engine_loader.ts`. The subject digest over the branch's whole
changed-file list at the reviewed commit `e52238cf7` is
`efa3b1b6843671a742db4bcdc552b21c563d0e6e3d5d3ccf857d48ead225724a`.

What changed, against each condition the council set:

1. **Chunk.** `_lib/egress_engine.ts` exports `ENGINE_SCHEMA = 1`, the rule table, `detect`, the
   token grammar (`replaceValues`, `TokenScope`, `EgressRefusedError`) and the commit scanner's
   `scanText`. `build:hook-chunks` emits it as `dist/hooks/egress_engine.chunk.cjs` plus a digest
   sidecar. `hooks/egress_engine_loader.ts` loads it synchronously through `createRequire` with
   a computed specifier (so esbuild does not inline it). From source it uses `tsx`'s own require,
   also through a computed specifier.
2. **Refusals (missing, altered, stale, incompatible, invalid).** The loader returns
   `{ok:false, reason}` for: no chunk (`missing`); a digest mismatch, no sidecar or a malformed one
   (`digest`); `ENGINE_SCHEMA` not equal to the loader's `EXPECTED_ENGINE_SCHEMA` (`schema`); a
   throw on load or a missing required export (`invalid`). It never throws. The verdict is cached
   per process, failures included.
3. **Per-mode policy.** `egress_stage.ts` calls the loader only after the mode resolves to
   something other than `off`. An unavailable engine raises inside the stage's existing failure
   path with rule id `engine-unavailable`: `observe` changes no view and records an
   `engine-unavailable` refusal per scanned field; `protect` and `strict` withhold every body
   from the placeholder view (the same withholding the stage already used for any internal
   error). `off` never loads the engine. The subagent capsule (`scanEnvelopeSecrets`) returns a
   rejection when the engine is unavailable, so an unscannable envelope is discarded rather than
   passed. The replay preview reports `engine-unavailable` rather than zero findings.
4. **One detector, no second static list.** `ai_council/config.ts`, the other bundled importer,
   reads `_lib/egress_prefixes.ts`. That is a generated projection of the table's prefix list:
   `egress_prefixes.test.ts` fails on any difference and prints the body to paste, and
   `check_credential_spelling` refuses when the projection and the table differ. The capsule
   reads `scanText` from the chunk; there is no second detector.
5. **Chunk budget.** `hook-bundle-budget.json` gains `chunks: [{entry, max_bytes: 28000}]` with
   a derivation. `check_hook_bundle_composition` builds each chunk with the exact esbuild segment
   `build:hook-chunks` uses for its entry and compares the size. A chunk raise against the base
   needs a new `raise_log` entry naming the chunk (`chunkRaiseFindings`). The main ceiling is
   unchanged at 1,550,000 B.
6. **B.** The `linearity` field leaves `EgressRule` (the egress_rules diff is only that: the field
   and its 18 values, plus a comment pointing at the new module). The arguments live verbatim in
   `_lib/egress_rules_linearity.ts`, which only tests import. `egress_rules.test.ts` requires an
   entry for every row and no entry without a row.

Also in this delta: `src/cli/python/workspace_secrets.ts` moved to
`src/scripts/_lib/workspace_secrets.ts` with a re-export left behind, because CI's prepack check
found the shipped `cross_repo_retrieve.ts` importing from `src/cli`, which is not shipped. And the
source-size baseline drops 17,424 → 17,419, as that gate asked.

Measured: dispatch bundle 1,546,845 → 1,530,696 B; chunk 18,478 B. Probed end to end on the
built bundle: in `observe` it counted a planted token through the chunk, and with the chunk moved
away it recorded `engine-unavailable`. `tests/scripts/hooks/egress_engine_chunk.test.ts` builds a
real chunk with esbuild into a temp dir and checks each refusal reason and each mode with the
engine unavailable. 162 test files / 3,721 tests over the hooks, `_lib` and bundle-gate suites
pass; `tsc --noEmit`, eslint and `prepack-check` are clean.

Review the delta below. For size it carries the loader and the stage only. Not shown, and
described above: the engine module (point 1 — re-exports only, plus `ENGINE_SCHEMA = 1`); the
capsule's three-line early return of a rejection when the load fails; `config.ts`'s one changed
import (point 4); the budget file and the composition gate's chunk check (point 5);
`egress_rules.ts` (point 6); `replay_hook.ts`; the generated `egress_prefixes.ts`; the spelling
gate's projection check; `package.json`'s one added `build:hook-chunks` segment; the tests. For each defect report file:line, the failure scenario and a severity. Questions a
review should answer include: can a protective mode still dispatch unscanned content after any
load, integrity or compatibility failure; is the from-source path sound; does anything bundled
still pull the engine statically; is the chunk budget enforced the way the main ceiling is. State
your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

```diff
diff --git a/src/scripts/hooks/egress_engine_loader.ts b/src/scripts/hooks/egress_engine_loader.ts
new file mode 100644
index 000000000..5339d45d9
--- /dev/null
+++ b/src/scripts/hooks/egress_engine_loader.ts
@@ -0,0 +1,114 @@
+/**
+ * Loads the egress engine (`_lib/egress_engine.ts`) on demand.
+ *
+ * WHY A CHUNK. The engine is about 19 KB of `dist/hooks/dispatch.js`, the one
+ * bundle every hook event loads, while the egress stage's shipped mode is `off`
+ * and never touches it. With 3 KB of headroom under the bundle ceiling and
+ * 12–15 KB of engine growth queued, an AI council of two providers chose on
+ * 2026-10-18 to emit the engine as `egress_engine.chunk.cjs` beside the bundle
+ * rather than raise the ceiling — the shape `svg_rules_loader.ts` set.
+ *
+ * WHY THIS ONE IS STRICTER THAN THE SVG LOADER. A missing SVG rule set costs a
+ * lint finding; a missing egress engine would let content through unscanned.
+ * So a chunk is refused when its digest does not match its sidecar, when there
+ * is no sidecar to match, and when its `ENGINE_SCHEMA` is not the one this
+ * loader was built against — a correctly digested chunk of another release is
+ * a load failure, never stale rules. Every failure is a value, never a throw,
+ * and each caller decides what an unavailable engine means for it: the stage
+ * withholds bodies in `protect` and `strict` and records the miss in
+ * `observe`; the subagent capsule rejects the envelope.
+ *
+ * WHY `require` AND THE COMPUTED SPECIFIER — see `svg_rules_loader.ts`: a
+ * concern is synchronous, and a literal specifier would be inlined by esbuild,
+ * which is the cost this exists to avoid.
+ */
+import * as fs from 'node:fs';
+import { createRequire } from 'node:module';
+import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+import type * as Engine from '../_lib/egress_engine.js';
+import { verifyBundle } from './bundle_integrity.js';
+
+/** The engine's exports. Type-only, so no engine byte reaches the bundle. */
+export type EgressEngine = typeof Engine;
+
+/** The schema this loader accepts. Must equal `ENGINE_SCHEMA` in the engine. */
+export const EXPECTED_ENGINE_SCHEMA = 1;
+
+export const ENGINE_CHUNK_BASENAME = 'egress_engine.chunk.cjs';
+
+export type EngineLoad =
+    | { readonly ok: true; readonly engine: EgressEngine }
+    | { readonly ok: false; readonly reason: 'missing' | 'digest' | 'schema' | 'invalid' };
+
+declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
+
+function isBundled(): boolean {
+    return typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
+}
+
+/** Where the engine loads from: the sibling chunk when bundled, the source module otherwise. */
+export function engineSpecifier(selfUrl: string, bundled: boolean): string {
+    const selfPath = fileURLToPath(selfUrl);
+    const dir = path.dirname(selfPath);
+    if (bundled) return path.join(dir, ENGINE_CHUNK_BASENAME);
+    const ext = selfPath.endsWith('.ts') ? '.ts' : '.js';
+    return path.join(dir, '..', '_lib', `egress_engine${ext}`);
+}
+
+/**
+ * From source the engine is TypeScript whose imports name `.js` siblings, which
+ * a plain `require` cannot resolve outside a `tsx` process (a test runner, for
+ * one). `tsx`'s own require resolves them; the specifier is computed so esbuild
+ * never pulls `tsx` into the bundle, where this branch is not taken.
+ */
+function sourceRequire(req: NodeJS.Require): (id: string, from: string) => unknown {
+    try {
+        const api = req(['tsx', 'cjs', 'api'].join('/')) as { require?: (id: string, from: string) => unknown };
+        if (typeof api.require === 'function') return api.require;
+    } catch {
+        // tsx absent: a plain require is the only reader left.
+    }
+    return (id: string) => req(id);
+}
+
+/** The uncached load; `bundled` is a test seam, the hook path never passes it. */
+export function loadEgressEngineUncached(selfUrl: string = import.meta.url, bundled: boolean = isBundled()): EngineLoad {
+    const specifier = engineSpecifier(selfUrl, bundled);
+    if (bundled) {
+        if (!fs.existsSync(specifier)) return { ok: false, reason: 'missing' };
+        // No sidecar, a malformed one or a mismatch: the chunk is not the one built.
+        if (verifyBundle(specifier).state !== 'ok') return { ok: false, reason: 'digest' };
+    }
+    let mod: Record<string, unknown>;
+    try {
+        const req = createRequire(selfUrl);
+        mod = (bundled ? req(specifier) : sourceRequire(req)(specifier, fileURLToPath(selfUrl))) as Record<string, unknown>;
+    } catch (exc) {
+        const code = (exc as NodeJS.ErrnoException).code;
+        return { ok: false, reason: code === 'MODULE_NOT_FOUND' ? 'missing' : 'invalid' };
+    }
+    if (mod['ENGINE_SCHEMA'] !== EXPECTED_ENGINE_SCHEMA) return { ok: false, reason: 'schema' };
+    for (const name of ['detect', 'replaceValues', 'scanText', 'TokenScope', 'EgressRefusedError']) {
+        if (typeof mod[name] !== 'function') return { ok: false, reason: 'invalid' };
+    }
+    if (!Array.isArray(mod['EGRESS_RULES'])) return { ok: false, reason: 'invalid' };
+    return { ok: true, engine: mod as unknown as EgressEngine };
+}
+
+const cache = new Map<string, EngineLoad>();
+
+/** The engine or why it is unavailable; cached per process, failures included. */
+export function loadEgressEngine(selfUrl: string = import.meta.url): EngineLoad {
+    const hit = cache.get(selfUrl);
+    if (hit !== undefined) return hit;
+    const load = loadEgressEngineUncached(selfUrl);
+    cache.set(selfUrl, load);
+    return load;
+}
+
+/** Test seam: forget every cached load. Never called by the hook path. */
+export function _resetEgressEngineCache(): void {
+    cache.clear();
+}
diff --git a/src/scripts/hooks/egress_stage.ts b/src/scripts/hooks/egress_stage.ts
index 269a1f452..69b73dc8b 100644
--- a/src/scripts/hooks/egress_stage.ts
+++ b/src/scripts/hooks/egress_stage.ts
@@ -17,9 +17,10 @@ import * as path from "node:path";
 import { parse as parseYaml } from "yaml";
 
 import { _resolve_cascade_paths, load_agent_settings } from "../_lib/agent_settings.js";
-import { detect, EGRESS_RULES, type EgressClass } from "../_lib/egress_rules.js";
-import { EgressRefusedError, replaceValues, TokenScope } from "../_lib/egress_token.js";
+import type { EgressClass, EgressRule } from "../_lib/egress_rules.js";
+import type { TokenScope } from "../_lib/egress_token.js";
 import { isEnvKillSwitchActive } from "../_lib/env_kill_switch.js";
+import { type EgressEngine, loadEgressEngine } from "./egress_engine_loader.js";
 import { BODY_KEYS, type JsonObject, type JsonValue } from "./payload_stub.js";
 import { is_replay_mode } from "./state_io.js";
 
@@ -186,10 +187,26 @@ function collectStrings(v: JsonValue, out: string[]): void {
   else if (isObject(v)) for (const x of Object.values(v)) collectStrings(x, out);
 }
 
-const RULE_BY_ID = new Map(EGRESS_RULES.map((r) => [r.rule, r]));
+/** The rule id a refusal records when the engine cannot load. */
+export const ENGINE_UNAVAILABLE = "engine-unavailable";
+
+/**
+ * The engine, or a throw the stage's own failure path turns into a withheld
+ * view (`protect`, `strict`) or a recorded miss (`observe`). Never reached when
+ * the mode is `off`, so the shipped default loads nothing.
+ */
+export function requireEngine(load: () => ReturnType<typeof loadEgressEngine> = loadEgressEngine): EgressEngine {
+  const r = load();
+  if (!r.ok) throw new Error(`${ENGINE_UNAVAILABLE}: ${r.reason}`);
+  return r.engine;
+}
 
 /** Detection and the extent proof only — nothing is replaced and nothing is kept. */
-export function countEnvelope(envelope: JsonObject): Pick<EgressStageResult, "scanned" | "counts" | "refused"> {
+export function countEnvelope(
+  envelope: JsonObject,
+  engine: EgressEngine = requireEngine(),
+): Pick<EgressStageResult, "scanned" | "counts" | "refused"> {
+  const ruleById = new Map<string, EgressRule>(engine.EGRESS_RULES.map((r) => [r.rule, r]));
   const payload = payloadOf(envelope);
   const scanned: EgressField[] = [];
   const counts = new Map<string, EgressCount>();
@@ -202,8 +219,8 @@ export function countEnvelope(envelope: JsonObject): Pick<EgressStageResult, "sc
     const texts: string[] = [];
     for (const k of keys) collectStrings(payload[k] as JsonValue, texts);
     for (const text of texts) {
-      for (const span of detect(text)) {
-        const policy = RULE_BY_ID.get(span.rule)?.replacement;
+      for (const span of engine.detect(text)) {
+        const policy = ruleById.get(span.rule)?.replacement;
         if (policy !== undefined && policy !== "detection") {
           const end = policy.through(text, span);
           if (end === null || end < span.end) {
@@ -220,12 +237,12 @@ export function countEnvelope(envelope: JsonObject): Pick<EgressStageResult, "sc
   return { scanned, counts: [...counts.values()], refused };
 }
 
-function replaceDeep(v: JsonValue, scope: TokenScope): JsonValue {
-  if (typeof v === "string") return replaceValues(v, scope);
-  if (Array.isArray(v)) return v.map((x) => replaceDeep(x, scope));
+function replaceDeep(v: JsonValue, scope: TokenScope, engine: EgressEngine): JsonValue {
+  if (typeof v === "string") return engine.replaceValues(v, scope);
+  if (Array.isArray(v)) return v.map((x) => replaceDeep(x, scope, engine));
   if (isObject(v)) {
     const out: JsonObject = {};
-    for (const [k, x] of Object.entries(v)) out[k] = replaceDeep(x, scope);
+    for (const [k, x] of Object.entries(v)) out[k] = replaceDeep(x, scope, engine);
     return out;
   }
   return v;
@@ -237,17 +254,21 @@ function replaceDeep(v: JsonValue, scope: TokenScope): JsonValue {
  * this dispatch. A key whose value cannot be replaced safely is withheld whole,
  * never partly replaced. The received envelope is not modified.
  */
-export function buildPlaceholderEnvelope(envelope: JsonObject, scope: TokenScope = new TokenScope()): JsonObject {
+export function buildPlaceholderEnvelope(
+  envelope: JsonObject,
+  engine: EgressEngine = requireEngine(),
+  scope: TokenScope = new engine.TokenScope(),
+): JsonObject {
   const payload = payloadOf(envelope);
   if (payload === null) return envelope;
   const next: JsonObject = { ...payload };
   for (const field of FIELDS) {
     for (const k of presentKeys(payload, field)) {
       try {
-        next[k] = replaceDeep(payload[k] as JsonValue, scope);
+        next[k] = replaceDeep(payload[k] as JsonValue, scope, engine);
       } catch (exc) {
         // Anything but a refusal is a defect, and withholds every body upstream.
-        if (!(exc instanceof EgressRefusedError)) throw exc;
+        if (!(exc instanceof engine.EgressRefusedError)) throw exc;
         next[k] = { [WITHHELD_MARKER]: true, rule: exc.rule };
       }
     }
@@ -316,6 +337,7 @@ export function recordObservation(workspaceRoot: string, line: EgressObservation
 export function runEgressStage(
   envelope: JsonObject,
   readMode: (workspaceRoot: string) => EgressMode = readEgressMode,
+  loadEngine: () => ReturnType<typeof loadEgressEngine> = loadEgressEngine,
 ): EgressStageResult {
   const none: EgressStageResult = { mode: "off", placeholder: undefined, scanned: [], counts: [], refused: [] };
   const payload = payloadOf(envelope);
@@ -330,18 +352,20 @@ export function runEgressStage(
   if (mode === "off") return none;
   let result: EgressStageResult;
   try {
-    const counted = countEnvelope(envelope);
-    const placeholder = mode === "observe" ? undefined : buildPlaceholderEnvelope(envelope);
+    const engine = requireEngine(loadEngine);
+    const counted = countEnvelope(envelope, engine);
+    const placeholder = mode === "observe" ? undefined : buildPlaceholderEnvelope(envelope, engine);
     result = { mode, placeholder, ...counted };
-  } catch {
+  } catch (exc) {
+    const rule = exc instanceof Error && exc.message.startsWith(ENGINE_UNAVAILABLE) ? ENGINE_UNAVAILABLE : "stage-error";
     const scanned = FIELDS.filter((f) => presentKeys(payload, f).length > 0);
-    const refused = scanned.map((field) => ({ field, rule: "stage-error" }));
+    const refused = scanned.map((field) => ({ field, rule }));
     if (mode === "observe") {
       result = { ...none, mode, scanned, refused };
     } else {
       const withheld: JsonObject = { ...payload };
       for (const f of scanned) {
-        for (const k of presentKeys(payload, f)) withheld[k] = { [WITHHELD_MARKER]: true, rule: "stage-error" };
+        for (const k of presentKeys(payload, f)) withheld[k] = { [WITHHELD_MARKER]: true, rule };
       }
       result = { ...none, mode, scanned, refused, placeholder: { ...envelope, payload: withheld } };
     }
```

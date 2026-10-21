<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-20 for branch drain/road-to-one-detector-senders-20261020,
     committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-senders-20261020, part A1 (engine, dispatcher) — the council channel and injected context pass the egress engine

Roadmap `road-to-one-detector-and-the-senders-we-own`, steps 3.3 and 3.5, plus the
table rows step 3.3 reads.

What the delta does:

- **Rule table.** `REVIEW_CREDENTIAL_ROWS`: a value after a credential keyword that is
  not a code expression or a type word, on one line, and the value of a line that
  opens with an `Authorization` header. Kept out of `EGRESS_RULES`, so the commit
  scanner and the refusing consumers keep their verdicts. The keyword vocabulary and
  `assignmentPattern` builder (part B) sit in the same file.
- **Council bundle (3.3).** `council_egress.ts` holds one token scope per council run.
  The bundler, which masked every line holding a credential, now replaces each
  detected value with a placeholder of the token grammar, span by span; an unproven
  key block is replaced through the nearest END marker, as the line masks did. The
  values replaced in the run are kept in memory only, for the final check.
  Credentials are replaced whatever `egress.placeholders.mode` says; identifiers (no
  identifier row exists yet) only in `protect` or `strict`, because whether they are
  replaced by default is an owner decision the change does not take.
- **Final check (3.3).** Immediately before a request is written — in `callMember`,
  in `curlJsonPost` before curl is spawned, and in a CLI seat before it spawns — the
  body is rescanned for every value replaced in the run and every high-confidence
  finding (a credential row other than the keyword-entropy one, or a validated
  identifier when identifiers are in scope). A hit refuses the send with a reason
  that names no value. This also applies to callers of the client classes outside a
  council round (team review, the low-impact fast path, `ask_transport`).
- **Shadow dispatch** redacts through a scope of its own and drops any query that
  needed a placeholder.
- **Injected context (3.5).** The dispatcher passes every concern reply it hands back
  to the session — the `context` block at session start and every
  `reason` + `additional_context` — through `egressInjection`: in `protect`/`strict`
  each listed value becomes its token under one scope per dispatch; text whose secret
  has no provable extent, or that no engine can read, is withheld whole; `off` and
  `observe` change nothing. The mode is read once per dispatch, only when a reply
  carries text.
- **Engine chunk.** The per-text work (`tallyText`, `injectText`, `replaceJson`)
  moved into `_lib/egress_text.ts`, reached only through the conditional engine
  chunk; `ENGINE_SCHEMA` and the loader's expected schema go to 2 and the loader
  requires the three new exports. That move is what pays for 3.5: the dispatch bundle
  reads 1,549,728 B of its unchanged 1,550,000 B ceiling, the chunk 22,969 B of 28,000 B.

Tests (not all quoted): `tests/scripts/ai_council/council_egress.test.ts` (quoted
below); `tests/scripts/hooks/egress_injection.test.ts` — `egressInjection` in each
mode, one token per value per dispatch, the mode read once, withholding on an
unproven key block, an unavailable engine and an unreadable mode, and through the
real dispatcher a stored entry injected at session start and a recalled one on a
prompt arriving as their token in `protect`, unchanged under `mode: off`. The
`tests/scripts/ai_council/`, `tests/scripts/hooks/`, `tests/hooks/` and
`src/scripts/_lib/egress_*` suites pass; `tsc --noEmit` is clean.

## Scope of this review

The branch `drain/road-to-one-detector-senders-20261020` at `ae7e01c2f` (`git diff origin/main...ae7e01c2f`) is reviewed in two
prompts and then four, because one passes the council's input ceiling and two
(about 49 KB each) timed out at both seats twice: A1 the engine and dispatcher, A2
the council channel, B1 the consumers that read the rule table and the spelling
gate, B2 the mutation gate and the sender census. Each part states the whole
change; review the part's diff in that context. Each prompt carries its source diff in full
at one line of context. Left out of both, and available on the branch: the roadmap,
the contract and threat-model prose, the census table regenerated into the contract,
fourteen media adapters and nine sender modules whose only change is one
`egress-content:` marker comment line, the Taskfile and workflow wiring of the new
gate, and test files not quoted below (named with what they assert).

The ratification gate classifies three files of this diff as hook-plumbing source:
`src/scripts/_lib/egress_rules.ts`, `src/scripts/_lib/egress_text.ts` and
`src/scripts/hooks/dispatch_hook.ts`. The rest is reviewed because it is the same
change.

Review the delta for defects in security, architecture and behaviour. For each
finding give file:line, the scenario in which it goes wrong, and a severity. Then
classify the authority question as a trade-off you weigh: does this change widen
what any refusing surface refuses, what leaves for a provider, or what an agent may
do — `authority-expanding` or `non-expanding` — and why. State your stance (APPROVE
or REQUEST_CHANGES) and the single highest-leverage change.

## Source diff, part A1

```diff
diff --git a/src/scripts/_lib/egress_engine.ts b/src/scripts/_lib/egress_engine.ts
index f63255728..42667df8a 100644
--- a/src/scripts/_lib/egress_engine.ts
+++ b/src/scripts/_lib/egress_engine.ts
@@ -16,3 +16,3 @@
  */
-export const ENGINE_SCHEMA = 1;
+export const ENGINE_SCHEMA = 2;
 
@@ -20,2 +20,3 @@ export { detect, EGRESS_RULES } from './egress_rules.js';
 export { EgressRefusedError, replaceValues, TokenScope } from './egress_token.js';
+export { injectText, replaceJson, tallyText } from './egress_text.js';
 export { scanText } from './secret_detector.js';
diff --git a/src/scripts/_lib/egress_rules.ts b/src/scripts/_lib/egress_rules.ts
index 78eaa1bca..ac7e8494e 100644
--- a/src/scripts/_lib/egress_rules.ts
+++ b/src/scripts/_lib/egress_rules.ts
@@ -94,2 +94,67 @@ export function looksLikeSecretValue(value: string): boolean {
 
+/**
+ * The keyword names a credential assignment is spelled with (`password =`,
+ * `api_key:`). They carry no vendor literal, so each consumer reads the ones it
+ * always read, in its own order, and keeps its own threshold for the value.
+ */
+export const ASSIGNMENT_KEYWORDS = {
+    password: 'password',
+    passwd: 'passwd',
+    pwd: 'pwd',
+    secret: 'secret',
+    apiKey: 'api[_-]?key',
+    apikey: 'apikey',
+    accessToken: 'access[_-]?token',
+    authToken: 'auth[_-]?token',
+    clientSecret: 'client[_-]?secret',
+    privateKey: 'private[_-]?key',
+    token: 'token',
+    bearer: 'bearer',
+} as const;
+
+export type AssignmentKeyword = keyof typeof ASSIGNMENT_KEYWORDS;
+
+export interface AssignmentShape {
+    readonly keywords: readonly AssignmentKeyword[];
+    /** Spelled around the keyword group, e.g. `\b` or a Unicode non-word lookaround. */
+    readonly before?: string;
+    readonly after?: string;
+    /** The keyword group captures instead of `(?:…)`. */
+    readonly capture?: boolean;
+    /** What follows `\s*[:=]\s*`; absent, the shape ends at the operator. */
+    readonly value?: string;
+    /** The whitespace around the operator; `\s*` when absent, `[ \t]*` to stay on one line. */
+    readonly gap?: string;
+}
+
+/** Source of a keyword-assignment shape: keyword group, operator, then the consumer's value. */
+export function assignmentSource(shape: AssignmentShape): string {
+    const alt = shape.keywords.map((k) => ASSIGNMENT_KEYWORDS[k]).join('|');
+    const group = shape.capture === true ? `(${alt})` : `(?:${alt})`;
+    const gap = shape.gap ?? '\\s*';
+    const head = `${shape.before ?? ''}${group}${shape.after ?? ''}${gap}[:=]`;
+    return shape.value === undefined ? head : `${head}${gap}${shape.value}`;
+}
+
+export function assignmentPattern(shape: AssignmentShape, flags: string): RegExp {
+    return new RegExp(assignmentSource(shape), flags);
+}
+
+/** An HTTP `Authorization` header name; everything after its colon is the credential. */
+export const AUTHORIZATION_HEADER = 'authorization';
+
+/**
+ * Raw-key prefix families spelled as a class, for a surface that keeps the
+ * prefix and drops the value: group 1 is the prefix stem. Wider than the rows on
+ * purpose (`pk-`, `rk-`); a test checks each family still covers the table
+ * prefixes it claims.
+ */
+export const CLASS_SPELLED_PREFIXES = {
+    dashKeys: { family: '(sk|pk|rk)-', covers: ['sk-'] },
+    tokens: {
+        family: '(gh[pousr]|github_pat|xox[baprs])[-_]',
+        covers: ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', 'github_pat_', 'xoxb-', 'xoxp-', 'xoxa-', 'xoxr-', 'xoxs-'],
+    },
+} as const satisfies Readonly<Record<string, { readonly family: string; readonly covers: readonly string[] }>>;
+
 // The nearest key marker after the header decides: an END carrying the same
@@ -279,4 +344,9 @@ export const EGRESS_RULES: readonly EgressRule[] = [
         replacement: 'detection',
-        pattern:
-            /(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"]?([^'"\s]{8,})['"]?/dgi,
+        pattern: assignmentPattern(
+            {
+                keywords: ['password', 'passwd', 'pwd', 'secret', 'apiKey', 'accessToken', 'authToken'],
+                value: `['"]?([^'"\\s]{8,})['"]?`,
+            },
+            'dgi',
+        ),
         valueGroup: 1,
@@ -286,2 +356,44 @@ export const EGRESS_RULES: readonly EgressRule[] = [
 
+// A value that is a type word, a literal, a language keyword or a credential
+// keyword itself (`password: 'password'`) is code, not a secret, whatever its key.
+const TYPE_WORD =
+    /^(?:string|number|boolean|bigint|unknown|any|never|void|undefined|null|true|false|none|nil|new|typeof|keyof|await|async|function|const|let|var|return|this|self|class|import|require|readonly|export|default|yield|password|passwd|pwd|secret|token|bearer|api[_-]?key|apikey)$/i;
+
+/**
+ * Credential shapes at a reviewer's threshold, for a surface that REPLACES a
+ * value it would otherwise have masked with its whole line (the council
+ * bundle, step 3.3). Not in EGRESS_RULES: a refusing surface or the commit
+ * scanner would refuse ordinary code on them. Any value after a credential
+ * keyword that is not a code expression or a type word, on the same line, and
+ * every byte after the colon of a line that opens with an `Authorization`
+ * header.
+ */
+export const REVIEW_CREDENTIAL_ROWS: readonly EgressRule[] = [
+    {
+        rule: 'review-assignment',
+        type: 'SECRET',
+        class: 'credential',
+        replacement: 'detection',
+        pattern: assignmentPattern(
+            {
+                keywords: ['apiKey', 'secret', 'token', 'password'],
+                capture: true,
+                gap: '[ \\t]*',
+                value: `['"]?([^'"\\s]+)['"]?`,
+            },
+            'dgi',
+        ),
+        valueGroup: 2,
+        validator: (v) => !CODE_EXPR.test(v) && !TYPE_WORD.test(v),
+    },
+    {
+        rule: 'review-authorization-header',
+        type: 'TOKEN',
+        class: 'credential',
+        replacement: 'detection',
+        pattern: new RegExp(`^[ \\t]*${AUTHORIZATION_HEADER}:[ \\t]*(\\S[^\\n]*)`, 'dgim'),
+        valueGroup: 1,
+    },
+];
+
 /** Every raw-key prefix the table declares, longest first. */
diff --git a/src/scripts/_lib/egress_text.ts b/src/scripts/_lib/egress_text.ts
new file mode 100644
index 000000000..4165e9f2e
--- /dev/null
+++ b/src/scripts/_lib/egress_text.ts
@@ -0,0 +1,63 @@
+// Per-text readings of the egress engine that the dispatcher needs and never
+// pays for in its own bundle: they reach it only through the engine chunk
+// (`egress_engine.ts`, D9), so the stage keeps the field walk and the chunk
+// keeps everything that reads a rule.
+
+import { detect, EGRESS_RULES, type EgressClass } from './egress_rules.js';
+import { EgressRefusedError, replaceValues, type TokenScope } from './egress_token.js';
+
+const RULE_BY_ID = new Map(EGRESS_RULES.map((r) => [r.rule, r]));
+
+export interface TextTally {
+    /** One entry per value a replacement would remove; never the value. */
+    readonly found: ReadonlyArray<{ readonly class: EgressClass; readonly type: string }>;
+    /** The rule of every detected secret whose extent cannot be proven. */
+    readonly refused: readonly string[];
+}
+
+/** Detection and the extent proof only: nothing is replaced and nothing is kept. */
+export function tallyText(text: string): TextTally {
+    const found: Array<{ class: EgressClass; type: string }> = [];
+    const refused: string[] = [];
+    for (const span of detect(text)) {
+        const policy = RULE_BY_ID.get(span.rule)?.replacement;
+        if (policy !== undefined && policy !== 'detection') {
+            const end = policy.through(text, span);
+            if (end === null || end < span.end) {
+                refused.push(span.rule);
+                continue;
+            }
+        }
+        found.push({ class: span.class, type: span.type });
+    }
+    return { found, refused };
+}
+
+type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
+
+/** Every string leaf replaced under one scope; keys and shape unchanged. Throws EgressRefusedError. */
+export function replaceJson<T extends Json>(v: T, scope: TokenScope): T;
+export function replaceJson(v: Json, scope: TokenScope): Json {
+    if (typeof v === 'string') return replaceValues(v, scope);
+    if (Array.isArray(v)) return v.map((x) => replaceJson(x, scope));
+    if (v !== null && typeof v === 'object') {
+        const out: { [key: string]: Json } = {};
+        for (const [k, x] of Object.entries(v)) out[k] = replaceJson(x, scope);
+        return out;
+    }
+    return v;
+}
+
+/**
+ * Text this package injects into a session, with every listed value replaced
+ * under `scope` (step 3.5). A secret whose extent cannot be proven, or any
+ * other failure, withholds the whole text; this never throws, because its
+ * caller is the dispatcher.
+ */
+export function injectText(text: string, scope: TokenScope): string {
+    try {
+        return replaceValues(text, scope);
+    } catch (exc) {
+        return `[egress: injected text withheld (${exc instanceof EgressRefusedError ? exc.rule : 'stage-error'})]`;
+    }
+}
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index 5faf7f0e9..2b52535ac 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -58,3 +58,3 @@ export { _concern_permission_verdict, _payload_tool_input, _payload_tool_name, _
 import { _concern_body_classes, planPayloadShapes } from "./payload_stub.js";
-import { egressViewFor, runEgressStage } from "./egress_stage.js";
+import { egressInjection, egressViewFor, runEgressStage } from "./egress_stage.js";
 import { resolveSessionRole, type SessionRole } from "../_lib/session_role.js";
@@ -1282,2 +1282,4 @@ export function main(argv?: string[]): number {
   const egress = runEgressStage(envelope);
+  // What the concerns inject back into the session passes the engine too (3.5).
+  const injected = egressInjection(String(envelope["workspace_root"] || process.cwd()));
   // Payload opt-in (step 2.1). One planner owns the whole decision — which
@@ -1366,3 +1368,3 @@ export function main(argv?: string[]): number {
     if (message) {
-      concern_messages.push({ rc, text: message, def: concern });
+      concern_messages.push({ rc, text: injected(message), def: concern });
     }
@@ -1374,3 +1376,3 @@ export function main(argv?: string[]): number {
     ) {
-      context_blocks.push((reply["context"] as string).trim());
+      context_blocks.push(injected((reply["context"] as string).trim()));
     }
diff --git a/src/scripts/hooks/egress_engine_loader.ts b/src/scripts/hooks/egress_engine_loader.ts
index f7fa84591..8b0daac2e 100644
--- a/src/scripts/hooks/egress_engine_loader.ts
+++ b/src/scripts/hooks/egress_engine_loader.ts
@@ -36,3 +36,3 @@ export type EgressEngine = typeof Engine;
 /** The schema this loader accepts. Must equal `ENGINE_SCHEMA` in the engine. */
-export const EXPECTED_ENGINE_SCHEMA = 1;
+export const EXPECTED_ENGINE_SCHEMA = 2;
 
@@ -100,3 +100,3 @@ export function loadEgressEngineUncached(selfUrl: string = import.meta.url, bund
         if (mod['ENGINE_SCHEMA'] !== EXPECTED_ENGINE_SCHEMA) return { ok: false, reason: 'schema' };
-        for (const name of ['detect', 'replaceValues', 'scanText', 'TokenScope', 'EgressRefusedError']) {
+        for (const name of ['detect', 'replaceValues', 'scanText', 'TokenScope', 'EgressRefusedError', 'tallyText', 'injectText', 'replaceJson']) {
             if (typeof mod[name] !== 'function') return { ok: false, reason: 'invalid' };
diff --git a/src/scripts/hooks/egress_stage.ts b/src/scripts/hooks/egress_stage.ts
index b2999e9e4..d56d7dfed 100644
--- a/src/scripts/hooks/egress_stage.ts
+++ b/src/scripts/hooks/egress_stage.ts
@@ -19,3 +19,3 @@ import { parse as parseYaml } from "yaml";
 import { _resolve_cascade_paths, load_agent_settings } from "../_lib/agent_settings.js";
-import type { EgressClass, EgressRule } from "../_lib/egress_rules.js";
+import type { EgressClass } from "../_lib/egress_rules.js";
 import type { TokenScope } from "../_lib/egress_token.js";
@@ -224,3 +224,2 @@ export function countEnvelope(
 ): Pick<EgressStageResult, "scanned" | "counts" | "refused"> {
-  const ruleById = new Map<string, EgressRule>(engine.EGRESS_RULES.map((r) => [r.rule, r]));
   const payload = payloadOf(envelope);
@@ -237,14 +236,7 @@ export function countEnvelope(
     for (const text of texts) {
-      for (const span of engine.detect(text)) {
-        const policy = ruleById.get(span.rule)?.replacement;
-        if (policy !== undefined && policy !== "detection") {
-          const end = policy.through(text, span);
-          if (end === null || end < span.end) {
-            refused.push({ field, rule: span.rule });
-            continue;
-          }
-        }
-        const key = `${field}\u0000${span.class}\u0000${span.type}`;
-        const prev = counts.get(key);
-        counts.set(key, { field, class: span.class, type: span.type, count: (prev?.count ?? 0) + 1 });
+      const tally = engine.tallyText(text);
+      for (const rule of tally.refused) refused.push({ field, rule });
+      for (const f of tally.found) {
+        const key = `${field}\u0000${f.class}\u0000${f.type}`;
+        counts.set(key, { field, class: f.class, type: f.type, count: (counts.get(key)?.count ?? 0) + 1 });
       }
@@ -255,13 +247,2 @@ export function countEnvelope(
 
-function replaceDeep(v: JsonValue, scope: TokenScope, engine: EgressEngine): JsonValue {
-  if (typeof v === "string") return engine.replaceValues(v, scope);
-  if (Array.isArray(v)) return v.map((x) => replaceDeep(x, scope, engine));
-  if (isObject(v)) {
-    const out: JsonObject = {};
-    for (const [k, x] of Object.entries(v)) out[k] = replaceDeep(x, scope, engine);
-    return out;
-  }
-  return v;
-}
-
 /**
@@ -284,3 +265,3 @@ export function buildPlaceholderEnvelope(
       try {
-        next[k] = replaceDeep(payload[k] as JsonValue, scope, engine);
+        next[k] = engine.replaceJson(payload[k] as JsonValue, scope);
       } catch (exc) {
@@ -393,2 +374,38 @@ export function runEgressStage(
 
+/**
+ * Text this package injects into a session — hot context and a handoff at
+ * session start, memory recall and every other concern's reply — passes the
+ * engine too (road-to-one-detector-and-the-senders-we-own 3.5). In `protect`
+ * and `strict` each listed value becomes its token under one scope per
+ * dispatch; text whose secret has no provable extent, or that no engine can
+ * read, is withheld whole. `off` and `observe` change nothing. Returns a
+ * function so the mode is read once per dispatch, and only when there is text.
+ */
+export function egressInjection(
+  workspaceRoot: string,
+  readMode: (workspaceRoot: string) => EgressMode = readEgressMode,
+  loadEngine: () => ReturnType<typeof loadEgressEngine> = loadEgressEngine,
+): (text: string) => string {
+  let inject: ((text: string) => string) | undefined;
+  return (text) => (inject ??= injector(workspaceRoot, readMode, loadEngine))(text);
+}
+
+function injector(
+  workspaceRoot: string,
+  readMode: (workspaceRoot: string) => EgressMode,
+  loadEngine: () => ReturnType<typeof loadEgressEngine>,
+): (text: string) => string {
+  let mode: EgressMode;
+  try {
+    mode = readMode(workspaceRoot);
+  } catch {
+    mode = "protect";
+  }
+  if (mode !== "protect" && mode !== "strict") return (t) => t;
+  const load = loadEngine();
+  if (!load.ok) return () => `[egress: injected text withheld (${ENGINE_UNAVAILABLE})]`;
+  const scope = new load.engine.TokenScope();
+  return (t) => load.engine.injectText(t, scope);
+}
+
 export type PublishedState = "asserted" | "replaced" | "gated" | "uncovered";
```

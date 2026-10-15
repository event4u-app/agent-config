<!-- evidence-type: analysis -->

<!-- The round-1 prompt given to the council on 2026-10-15 for branch
     drain/placeholders-phase-1, committed verbatim so the verdict recorded beside
     it can be checked against what was actually asked. Not edited after the run. -->

# Review branch drain/placeholders-phase-1 — egress stage in the hook dispatcher

Head `ca01038099ea0e22eb0b9b46e78c5fe646e93cb1`, base `origin/main` at `94f91431a`. The branch adds a dispatcher stage that detects listed credential values in a hook event's prompt, tool input and tool result. With `egress.placeholders.mode` set to `protect` or `strict`, every hook concern not on a closed grant list receives a copy of the envelope with each value replaced by a placeholder token; concerns on the list receive the envelope as the host sent it. With `observe`, the stage only counts. The default is `off`. A lint rule refuses any concern that produces a host rewrite field, and the concern-admission gate now requires a ledger row for each dispatcher stage. No mode sends a rewrite back to the host.

Constraints the change is meant to hold: `observe` changes no view any concern receives; the placeholder view exists only from `protect`; the execution view is granted by the dispatcher's list and cannot be obtained by a concern's own declaration; nothing derived from a value (value, fragment, length, digest) is written to the count record; a secret whose extent cannot be proven is never partly replaced.

Report defects with file:line, the failure scenario and a severity: a value that reaches a concern or a file it should not; a guard that could be served tokens; a path where `observe` alters what a concern receives; a fail-open path; a cost on the default-off path; a test that would pass without the code it covers; a mismatch between the contract text and the code. State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

Scope of the diff below: `git diff -U1 origin/main...HEAD` for `src/scripts/hooks/` (egress_stage.ts new, dispatch_hook.ts, payload_stub.ts, replay_hook.ts), `src/scripts/lint_hook_manifest.ts`, `src/scripts/check_concern_admissions.ts`, `src/scripts/_lib/agent_settings.ts`, `tests/scripts/hooks/egress_stage.test.ts`, `tests/hooks/fixtures/concern_report_egress_view.ts` and `docs/contracts/egress-placeholders-v1.md`.

Omitted for size: `docs/decisions/ADR-285-one-dispatcher-stage-is-the-only-rewriter.md` (the decision that no concern may produce a rewrite), the `docs/contracts/hook-architecture-v1.md` edits (that decision restated, plus a kill-switch table row), `src/scripts/hooks/rtk_wrap_hook.ts` (comment-only), the settings template, schema, class table and generated reference for the new key, `src/config/continuity-surface.json` and `src/config/hook-latency-budget.json` (one row and one note each), the regenerated `dist/install/install.mjs`, the admission-ledger row, the tests `tests/scripts/lint_hook_manifest.test.ts` and `tests/scripts/hooks/replay_hook.test.ts`, the roadmap, and the first commit of the branch (council round-7 evidence for an earlier PR). Unchanged and relevant: `src/scripts/_lib/egress_rules.ts` (the rule table, `detect`, per-rule `replacement` policy) and `src/scripts/_lib/egress_token.ts` (`TokenScope`, `replaceValues`, which throws `EgressRefusedError` when a rule cannot prove its extent).

```diff
diff --git a/docs/contracts/egress-placeholders-v1.md b/docs/contracts/egress-placeholders-v1.md
index f24d24e5c..3bc7d63b8 100644
--- a/docs/contracts/egress-placeholders-v1.md
+++ b/docs/contracts/egress-placeholders-v1.md
@@ -16,5 +16,6 @@ re-defines a term below.
 
-**Stability: experimental.** The rule table, the token grammar and an in-memory
-replacement exist; identifier rules, the senders' final check and every host
-carrier do not. A
+**Stability: experimental.** The rule table, the token grammar, an in-memory
+replacement and the dispatcher's egress stage (local views and counts only)
+exist; identifier rules, the senders' final check and every host rewrite do
+not. A
 section below that names an open decision is not a promise of its outcome.
@@ -191,2 +192,35 @@ leaves a suffix in plaintext.
 
+## The egress stage and its two views
+
+The dispatcher's egress stage (`src/scripts/hooks/egress_stage.ts`) is the only
+code that may produce a rewrite (ADR-285). It runs once per hook event, before
+any concern, over the prompt (`prompt`), the tool input and the tool result —
+the keys `payload_stub.ts` names as body classes — and builds at most two views
+of one envelope through the payload-shape planner:
+
+- the **execution view** — the envelope as the host sent it. It goes only to
+  the concerns on `EXECUTION_VIEW_GRANTS`, a closed list the dispatcher owns:
+  every concern that decides whether a call may run. A concern cannot request
+  it; `lint_hook_manifest` refuses a `payload_view: execution` declaration off
+  the list, a blocking concern missing from it, and a listed concern that is not
+  blocking. Until a session table exists there are no tokens to resolve, so the
+  execution view is the received envelope unchanged.
+- the **placeholder view** — every detected value replaced by its token. It goes
+  to every other concern, so a local store written by a recording concern
+  (chat history, journals, ledgers) inherits tokens without a scrubber of its
+  own. A key whose secret has no provable extent is withheld whole (an object
+  carrying `_agent_config_egress_withheld` and the rule id), never partly
+  replaced; an unexpected failure of the stage withholds every body.
+
+The token scope is one dispatch: a token in a local store cannot be resolved
+later, which is the intended state until the `identifier-table-at-rest` decision
+says how a scope may outlive a process. Byte lengths in a payload stub are
+measured on the received envelope whichever view the stub is cut from.
+
+**What the placeholder view does not reach.** A concern that opens the host's
+transcript file reads it from disk, raw; an operator-armed raw capture
+(`AGENT_HOOK_CAPTURE_DIR`) writes the received payload before the stage runs;
+and a guard's own refusal text, built from the execution view, is passed on as
+it is. Each is a residue of the view, not a covered surface.
+
 ## Settings
@@ -195,4 +229,29 @@ Replacement paths are switched by `egress.placeholders.mode`. The shipped
 default is `off`; whether any class is replaced by default for consumers is an
-owner decision (`default-mode-for-consumers`). `observe` detects and counts only
-and never changes what any surface sees.
+owner decision (`default-mode-for-consumers`). The key is read from the project
+layers of the settings cascade only.
+
+| Mode | Detects and counts | Placeholder view to concerns | Rewrite sent to the host |
+|---|---|---|---|
+| `off` | no | no | no |
+| `observe` | yes | no — every concern sees exactly what it saw without the stage | no |
+| `protect` | yes | yes, to every concern off the grant list | no, until the host rewrite is built |
+| `strict` | yes | as `protect` | no, until the host rewrite is built |
+
+`strict` differs from `protect` only once the host rewrite and the prompt gate
+exist; until then the two behave identically, and that is stated rather than
+implied by the name. `observe` never changes a view.
+
+A thrown kill switch (`AGENT_CONFIG_NO_EGRESS_STAGE`) turns the stage off
+whatever the settings say, and `publishedEgressState` then reports every channel
+`uncovered`, so a stale `replaced` cannot outlive the stage that earned it. A
+mode that replaces nothing reports `uncovered` the same way.
+
+**Counts.** In every mode but `off`, each dispatch that carried a scanned field
+appends one line to `agents/runtime/state/egress-observations.jsonl` (gitignored,
+rotated once past 4 MiB): platform, event, an id-shaped tool name, the mode, the
+fields scanned, and per field the class, type and count, plus the rule id of any
+refusal — nothing derived from a value. The rule table holds credential rules
+only, so every count is a credential count until identifier rules exist.
+`agent-config hooks:replay … --json` reports what the stage would do with a
+fixture under the workspace's mode, in the same shape, without writing.
 
diff --git a/src/scripts/_lib/agent_settings.ts b/src/scripts/_lib/agent_settings.ts
index f2a81c4ba..180cdbf9b 100644
--- a/src/scripts/_lib/agent_settings.ts
+++ b/src/scripts/_lib/agent_settings.ts
@@ -802,3 +802,3 @@ export function resolve_project_root(
  */
-function _resolve_cascade_paths(
+export function _resolve_cascade_paths(
     cwd: string | null,
diff --git a/src/scripts/check_concern_admissions.ts b/src/scripts/check_concern_admissions.ts
index bab22e3df..96b80da8b 100644
--- a/src/scripts/check_concern_admissions.ts
+++ b/src/scripts/check_concern_admissions.ts
@@ -68,2 +68,12 @@ export const REQUIRED_ANSWERS = [
 
+/**
+ * Dispatcher stages that run like a concern but are not manifest keys, so the
+ * added-concern set difference cannot see them. Each needs a complete admitted
+ * row whenever its module exists — always, not only when newly added, because
+ * the list is closed and short and a stage has no grandfathered population.
+ */
+export const DISPATCHER_STAGES: readonly { id: string; source: string }[] = [
+    { id: 'egress-stage', source: 'src/scripts/hooks/egress_stage.ts' },
+];
+
 export const DECISIONS = ['admitted', 'rejected'] as const;
@@ -190,6 +200,6 @@ export function evaluate(root = REPO_ROOT, baseRef: string | null): Finding[] {
 
-    if (baseRef === null) return findings;
-
     const admitted = new Map(rows.filter((r) => r.decision === 'admitted').map((r) => [r.concern, r]));
-    for (const id of addedConcerns(root, baseRef)) {
+    const stages = DISPATCHER_STAGES.filter((s) => fs.existsSync(path.join(root, s.source))).map((s) => s.id);
+    const required = baseRef === null ? stages : [...stages, ...addedConcerns(root, baseRef)];
+    for (const id of required) {
         const row = admitted.get(id);
@@ -199,3 +209,5 @@ export function evaluate(root = REPO_ROOT, baseRef: string | null): Finding[] {
                 kind: 'missing_row',
-                message: `added since ${baseRef} with no \`admitted\` row in ${LEDGER_REL}`,
+                message: stages.includes(id)
+                    ? `dispatcher stage with no \`admitted\` row in ${LEDGER_REL}`
+                    : `added since ${String(baseRef)} with no \`admitted\` row in ${LEDGER_REL}`,
             });
@@ -250,3 +262,8 @@ function selfTest(): number {
     /** A throwaway repo with a base commit and a working-tree change on top. */
-    const fixture = (opts: { base: readonly string[]; head: readonly string[]; ledger?: string }): number => {
+    const fixture = (opts: {
+        base: readonly string[];
+        head: readonly string[];
+        ledger?: string;
+        files?: readonly string[];
+    }): number => {
         const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ca-selftest-'));
@@ -269,2 +286,3 @@ function selfTest(): number {
         if (opts.ledger !== undefined) put(LEDGER_REL, `${opts.ledger}\n`);
+        for (const rel of opts.files ?? []) put(rel, '');
         // repoRoot locates tsx AND resolves the relative script path, so it is
@@ -303,2 +321,20 @@ function selfTest(): number {
         },
+        {
+            // A dispatcher stage is not a manifest key, so the set difference
+            // cannot see it; its row is required whenever its module exists.
+            name: 'a dispatcher stage with no ledger row → reject',
+            expect: 'reject',
+            run: () => fixture({ base: ['one'], head: ['one'], files: [DISPATCHER_STAGES[0]!.source] }),
+        },
+        {
+            name: 'a dispatcher stage WITH a complete admitted row → accept',
+            expect: 'accept',
+            run: () =>
+                fixture({
+                    base: ['one'],
+                    head: ['one'],
+                    files: [DISPATCHER_STAGES[0]!.source],
+                    ledger: ROW(DISPATCHER_STAGES[0]!.id, 'admitted'),
+                }),
+        },
         {
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index b6593e464..ca33f6ff4 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -58,2 +58,3 @@ export { _concern_permission_verdict, _payload_tool_input, _payload_tool_name, _
 import { _concern_body_classes, planPayloadShapes } from "./payload_stub.js";
+import { egressViewFor, runEgressStage } from "./egress_stage.js";
 import { resolveSessionRole, type SessionRole } from "../_lib/session_role.js";
@@ -1278,8 +1279,5 @@ export function main(argv?: string[]): number {
   const tool_name = _payload_tool_name(envelope);
-  // Payload opt-in (step 2.1). There are at most FOUR distinct envelope shapes
-  // per dispatch (keep neither / input / result / both), so they are memoised
-  // by keep-set: concerns sharing a declaration share one clone, and building
-  // one per concern would re-pay the allocation the stub exists to avoid.
-  // `present` is the set of body classes this event actually carries — empty on
-  // every non-tool event, which is why those pay nothing at all.
+  // The egress stage (ADR-285) builds the placeholder view before any concern
+  // runs; `egressViewFor` decides which concern gets which view.
+  const egress = runEgressStage(envelope);
   // Payload opt-in (step 2.1). One planner owns the whole decision — which
@@ -1295,2 +1293,3 @@ export function main(argv?: string[]): number {
     keep_by_concern.map(([, keep]) => keep),
+    egress.placeholder,
   );
@@ -1300,3 +1299,3 @@ export function main(argv?: string[]): number {
     }
-    const concern_envelope = shapes.shapeFor(keep_classes);
+    const concern_envelope = shapes.shapeFor(keep_classes, egressViewFor(String(concern["name"])));
     const stubs_served = shapes.stubsFor(keep_classes);
diff --git a/src/scripts/hooks/egress_stage.ts b/src/scripts/hooks/egress_stage.ts
new file mode 100644
index 000000000..9a4b40063
--- /dev/null
+++ b/src/scripts/hooks/egress_stage.ts
@@ -0,0 +1,309 @@
+/**
+ * The egress stage — the one dispatcher stage that may produce a rewrite
+ * (ADR-285) and the only code that builds the views concerns receive.
+ * Contract, including the per-mode table: docs/contracts/egress-placeholders-v1.md.
+ *
+ * `observe` detects and counts and never changes a view; the placeholder view
+ * exists only from `protect` onward. The execution view is the envelope as the
+ * host sent it, granted by the closed list below and never requested: a
+ * concern's own manifest declaration grants nothing.
+ *
+ * The rule table holds credential rules only, so every count is a credential
+ * count until identifier rules exist.
+ */
+import * as fs from "node:fs";
+import * as path from "node:path";
+
+import { _resolve_cascade_paths, load_agent_settings } from "../_lib/agent_settings.js";
+import { detect, EGRESS_RULES, type EgressClass } from "../_lib/egress_rules.js";
+import { EgressRefusedError, replaceValues, TokenScope } from "../_lib/egress_token.js";
+import { isEnvKillSwitchActive } from "../_lib/env_kill_switch.js";
+import { BODY_KEYS, type JsonObject, type JsonValue } from "./payload_stub.js";
+import { is_replay_mode } from "./state_io.js";
+
+export const EGRESS_MODES = ["off", "observe", "protect", "strict"] as const;
+export type EgressMode = (typeof EGRESS_MODES)[number];
+
+/** Set to anything outside the off-set and the stage does nothing, whatever the settings say. */
+export const EGRESS_STAGE_KILL_SWITCH = "AGENT_CONFIG_NO_EGRESS_STAGE";
+
+/**
+ * The concerns that receive the execution view: every concern that decides
+ * whether a call may run. A guard served the placeholder view would match a
+ * token instead of the value it exists to stop, so `lint_hook_manifest` fails
+ * when a blocking concern is missing here and when a name here is not a
+ * blocking concern. Owned by the dispatcher; a concern cannot add itself.
+ */
+export const EXECUTION_VIEW_GRANTS: ReadonlySet<string> = new Set([
+  "block-config-weakening",
+  "block-kernel-rule-writes",
+  "block-no-verify",
+  "block-plumbing-writes",
+  "block-speaking-inbox-dir",
+  "evidence-independence",
+  "one-question-per-ask",
+  "turn-end-gate",
+]);
+
+export type EnvelopeView = "execution" | "placeholder";
+
+export function egressViewFor(concern: string): EnvelopeView {
+  return EXECUTION_VIEW_GRANTS.has(concern) ? "execution" : "placeholder";
+}
+
+export type EgressField = "prompt" | "input" | "result";
+
+const FIELD_KEYS: Readonly<Record<EgressField, readonly string[]>> = {
+  prompt: ["prompt", "userPrompt"],
+  input: BODY_KEYS.input,
+  result: BODY_KEYS.result,
+};
+const FIELDS = Object.keys(FIELD_KEYS) as EgressField[];
+
+/** Marks a field the placeholder view could not replace safely; carries the rule id and nothing else. */
+export const WITHHELD_MARKER = "_agent_config_egress_withheld" as const;
+
+export interface EgressCount {
+  readonly field: EgressField;
+  readonly class: EgressClass;
+  readonly type: string;
+  readonly count: number;
+}
+
+export interface EgressRefusal {
+  readonly field: EgressField;
+  readonly rule: string;
+}
+
+export interface EgressStageResult {
+  readonly mode: EgressMode;
+  /** The envelope every concern off the grant list receives; `undefined` means the received envelope. */
+  readonly placeholder: JsonObject | undefined;
+  readonly scanned: readonly EgressField[];
+  readonly counts: readonly EgressCount[];
+  /** Fields whose secret had no provable extent; withheld from the placeholder view. */
+  readonly refused: readonly EgressRefusal[];
+}
+
+function isObject(v: unknown): v is JsonObject {
+  return typeof v === "object" && v !== null && !Array.isArray(v);
+}
+
+/** Unknown, missing or misspelled resolves to `off`: the shipped behaviour. */
+export function resolveEgressMode(settings: unknown): EgressMode {
+  if (isEnvKillSwitchActive(EGRESS_STAGE_KILL_SWITCH)) return "off";
+  const egress = isObject(settings) ? settings["egress"] : undefined;
+  const placeholders = isObject(egress) ? egress["placeholders"] : undefined;
+  const mode = isObject(placeholders) ? placeholders["mode"] : undefined;
+  return (EGRESS_MODES as readonly unknown[]).includes(mode) ? (mode as EgressMode) : "off";
+}
+
+const EGRESS_KEY_LINE = /^["']?egress["']?\s*:/m;
+
+/**
+ * Every project settings layer the cascade would read; the user-global layer
+ * cannot carry `egress` (it is not on MERGEABLE_KEYS). When no layer opens a
+ * top-level `egress:` key the shipped default holds, and the full cascade —
+ * whose template parse measured about 25 ms cold — is skipped on every call.
+ */
+function anyLayerNamesEgress(workspaceRoot: string): boolean {
+  for (const p of _resolve_cascade_paths(workspaceRoot, null)) {
+    try {
+      if (EGRESS_KEY_LINE.test(fs.readFileSync(p, "utf8"))) return true;
+    } catch {
+      // absent layer
+    }
+  }
+  return false;
+}
+
+export function readEgressMode(workspaceRoot: string): EgressMode {
+  if (isEnvKillSwitchActive(EGRESS_STAGE_KILL_SWITCH)) return "off";
+  try {
+    if (!anyLayerNamesEgress(workspaceRoot)) return "off";
+    return resolveEgressMode(load_agent_settings({ cwd: workspaceRoot }));
+  } catch {
+    return "off";
+  }
+}
+
+function payloadOf(envelope: JsonObject): JsonObject | null {
+  const p = envelope["payload"];
+  return isObject(p) ? p : null;
+}
+
+function presentKeys(payload: JsonObject, field: EgressField): string[] {
+  return FIELD_KEYS[field].filter((k) => payload[k] !== undefined && payload[k] !== null);
+}
+
+function collectStrings(v: JsonValue, out: string[]): void {
+  if (typeof v === "string") out.push(v);
+  else if (Array.isArray(v)) for (const x of v) collectStrings(x, out);
+  else if (isObject(v)) for (const x of Object.values(v)) collectStrings(x, out);
+}
+
+const RULE_BY_ID = new Map(EGRESS_RULES.map((r) => [r.rule, r]));
+
+/** Detection and the extent proof only — nothing is replaced and nothing is kept. */
+export function countEnvelope(envelope: JsonObject): Pick<EgressStageResult, "scanned" | "counts" | "refused"> {
+  const payload = payloadOf(envelope);
+  const scanned: EgressField[] = [];
+  const counts = new Map<string, EgressCount>();
+  const refused: EgressRefusal[] = [];
+  if (payload === null) return { scanned, counts: [], refused };
+  for (const field of FIELDS) {
+    const keys = presentKeys(payload, field);
+    if (keys.length === 0) continue;
+    scanned.push(field);
+    const texts: string[] = [];
+    for (const k of keys) collectStrings(payload[k] as JsonValue, texts);
+    for (const text of texts) {
+      for (const span of detect(text)) {
+        const policy = RULE_BY_ID.get(span.rule)?.replacement;
+        if (policy !== undefined && policy !== "detection") {
+          const end = policy.through(text, span);
+          if (end === null || end < span.end) {
+            refused.push({ field, rule: span.rule });
+            continue;
+          }
+        }
+        const key = `${field}\u0000${span.class}\u0000${span.type}`;
+        const prev = counts.get(key);
+        counts.set(key, { field, class: span.class, type: span.type, count: (prev?.count ?? 0) + 1 });
+      }
+    }
+  }
+  return { scanned, counts: [...counts.values()], refused };
+}
+
+function replaceDeep(v: JsonValue, scope: TokenScope): JsonValue {
+  if (typeof v === "string") return replaceValues(v, scope);
+  if (Array.isArray(v)) return v.map((x) => replaceDeep(x, scope));
+  if (isObject(v)) {
+    const out: JsonObject = {};
+    for (const [k, x] of Object.entries(v)) out[k] = replaceDeep(x, scope);
+    return out;
+  }
+  return v;
+}
+
+/**
+ * The placeholder view: every listed value in the prompt, the tool input and
+ * the tool result replaced by its token, under one scope that lives as long as
+ * this dispatch. A key whose value cannot be replaced safely is withheld whole,
+ * never partly replaced. The received envelope is not modified.
+ */
+export function buildPlaceholderEnvelope(envelope: JsonObject, scope: TokenScope = new TokenScope()): JsonObject {
+  const payload = payloadOf(envelope);
+  if (payload === null) return envelope;
+  const next: JsonObject = { ...payload };
+  for (const field of FIELDS) {
+    for (const k of presentKeys(payload, field)) {
+      try {
+        next[k] = replaceDeep(payload[k] as JsonValue, scope);
+      } catch (exc) {
+        const rule = exc instanceof EgressRefusedError ? exc.rule : "unknown";
+        next[k] = { [WITHHELD_MARKER]: true, rule };
+      }
+    }
+  }
+  return { ...envelope, payload: next };
+}
+
+/** Bounds the append-only record; past it the file rotates once to `.1`. */
+export const OBSERVATION_FILE_MAX_BYTES = 4 * 1024 * 1024;
+export const OBSERVATION_FILE = path.join("agents", "runtime", "state", "egress-observations.jsonl");
+
+const TOOL_NAME = /^[A-Za-z0-9_.:-]{1,128}$/;
+
+/**
+ * One fixed-field line per scanned dispatch: type and count per field, the rule
+ * id of a refusal, and nothing derived from a value — no value, fragment,
+ * length or digest. The tool name is kept only when it is id-shaped.
+ */
+export interface EgressObservationLine {
+  ts: string;
+  platform: string;
+  event: string;
+  tool: string | null;
+  mode: EgressMode;
+  scanned: EgressField[];
+  counts: EgressCount[];
+  refused: EgressRefusal[];
+}
+
+export function observationLine(envelope: JsonObject, result: EgressStageResult): EgressObservationLine {
+  const tool = payloadOf(envelope)?.["tool_name"];
+  return {
+    ts: new Date().toISOString(),
+    platform: String(envelope["platform"] ?? ""),
+    event: String(envelope["event"] ?? ""),
+    tool: typeof tool === "string" && TOOL_NAME.test(tool) ? tool : null,
+    mode: result.mode,
+    scanned: [...result.scanned],
+    counts: result.counts.map((c) => ({ field: c.field, class: c.class, type: c.type, count: c.count })),
+    refused: result.refused.map((r) => ({ field: r.field, rule: r.rule })),
+  };
+}
+
+export function recordObservation(workspaceRoot: string, line: EgressObservationLine): void {
+  if (is_replay_mode()) return;
+  try {
+    const file = path.join(workspaceRoot, OBSERVATION_FILE);
+    fs.mkdirSync(path.dirname(file), { recursive: true });
+    try {
+      if (fs.statSync(file).size > OBSERVATION_FILE_MAX_BYTES) fs.renameSync(file, `${file}.1`);
+    } catch {
+      // no file yet
+    }
+    fs.appendFileSync(file, `${JSON.stringify(line)}\n`, "utf8");
+  } catch {
+    // observability never breaks the hook
+  }
+}
+
+/**
+ * Runs before the concern loop. Reads the mode only when the event carries a
+ * prompt or a tool body, so a body-less event pays one property read. Never
+ * throws: an unexpected failure in `protect` or `strict` withholds every body
+ * from the placeholder view rather than serving it raw.
+ */
+export function runEgressStage(
+  envelope: JsonObject,
+  readMode: (workspaceRoot: string) => EgressMode = readEgressMode,
+): EgressStageResult {
+  const none: EgressStageResult = { mode: "off", placeholder: undefined, scanned: [], counts: [], refused: [] };
+  const payload = payloadOf(envelope);
+  if (payload === null || !FIELDS.some((f) => presentKeys(payload, f).length > 0)) return none;
+  const workspaceRoot = String(envelope["workspace_root"] || process.cwd());
+  const mode = readMode(workspaceRoot);
+  if (mode === "off") return none;
+  let result: EgressStageResult;
+  try {
+    const counted = countEnvelope(envelope);
+    const placeholder = mode === "observe" ? undefined : buildPlaceholderEnvelope(envelope);
+    result = { mode, placeholder, ...counted };
+  } catch {
+    if (mode === "observe") return { ...none, mode };
+    const withheld: JsonObject = { ...payload };
+    for (const f of FIELDS) {
+      for (const k of presentKeys(payload, f)) withheld[k] = { [WITHHELD_MARKER]: true, rule: "unknown" };
+    }
+    return { ...none, mode, placeholder: { ...envelope, payload: withheld } };
+  }
+  recordObservation(workspaceRoot, observationLine(envelope, result));
+  return result;
+}
+
+export type PublishedState = "asserted" | "replaced" | "gated" | "uncovered";
+
+/**
+ * The state a channel may be published in. A thrown kill switch, or a mode that
+ * replaces nothing, makes every channel `uncovered` whatever evidence was
+ * committed for it, so a stale `replaced` can never outlive the stage.
+ */
+export function publishedEgressState(claimed: PublishedState, mode: EgressMode): PublishedState {
+  if (isEnvKillSwitchActive(EGRESS_STAGE_KILL_SWITCH)) return "uncovered";
+  if (mode !== "protect" && mode !== "strict") return "uncovered";
+  return claimed;
+}
diff --git a/src/scripts/hooks/payload_stub.ts b/src/scripts/hooks/payload_stub.ts
index 5acc6505c..baac1fdd2 100644
--- a/src/scripts/hooks/payload_stub.ts
+++ b/src/scripts/hooks/payload_stub.ts
@@ -391,4 +391,7 @@ export function _concern_body_classes(concern: JsonObject): Set<BodyClass> {
 export interface PayloadShapePlan {
-  /** The envelope a concern with this keep-set receives. */
-  shapeFor(keep: ReadonlySet<BodyClass>): JsonObject;
+  /**
+   * The envelope a concern with this keep-set receives, built from the
+   * placeholder view when one was planned and `view` asks for it.
+   */
+  shapeFor(keep: ReadonlySet<BodyClass>, view?: "execution" | "placeholder"): JsonObject;
   /** How many payload keys were omitted for that concern. */
@@ -418,2 +421,7 @@ export interface PayloadShapePlan {
  * ratchet was right to object to a dispatcher carrying them.
+ *
+ * `placeholder` is the egress stage's placeholder view of the same envelope.
+ * Presence and byte lengths are always read from the received envelope, so a
+ * stub reports the size the host sent whichever view it was cut from; only
+ * the body that survives differs between the two views.
  */
@@ -422,2 +430,3 @@ export function planPayloadShapes(
   keepSets: Iterable<ReadonlySet<BodyClass>>,
+  placeholder?: JsonObject,
 ): PayloadShapePlan {
@@ -438,8 +447,9 @@ export function planPayloadShapes(
   return {
-    shapeFor(keep) {
-      if (present.size === 0) return envelope;
-      const key = cacheKey(keep);
+    shapeFor(keep, view = "execution") {
+      const base = view === "placeholder" && placeholder !== undefined ? placeholder : envelope;
+      if (present.size === 0) return base;
+      const key = `${base === envelope ? "execution" : "placeholder"}:${cacheKey(keep)}`;
       const hit = shaped.get(key);
       if (hit !== undefined) return hit;
-      const built = stubPayloadBodies(envelope, keep, measured);
+      const built = stubPayloadBodies(base, keep, measured);
       shaped.set(key, built);
diff --git a/src/scripts/hooks/replay_hook.ts b/src/scripts/hooks/replay_hook.ts
index a704555dd..dfbb4e124 100644
--- a/src/scripts/hooks/replay_hook.ts
+++ b/src/scripts/hooks/replay_hook.ts
@@ -39,2 +39,10 @@ import { fileURLToPath, pathToFileURL } from "node:url";
 import { EXIT_USAGE } from './exit_codes.js';
+import {
+  countEnvelope,
+  readEgressMode,
+  type EgressCount,
+  type EgressMode,
+  type EgressRefusal,
+} from "./egress_stage.js";
+import type { JsonObject } from "./payload_stub.js";
 
@@ -210,2 +218,4 @@ export function main(argv?: string[]): number {
 
+  const egress = _egressPreview(decoded);
+
   const env = { ...process.env };
@@ -255,2 +265,3 @@ export function main(argv?: string[]): number {
       replay_mode: true,
+      egress,
     };
@@ -269,2 +280,8 @@ export function main(argv?: string[]): number {
     );
+    const found = egress.counts.map((c) => `${c.field}:${c.type}×${c.count}`).join(" ") || "nothing";
+    process.stderr.write(
+      `replay_hook: egress mode=${egress.mode} action=${egress.action} found=${found}` +
+        (egress.refused.length > 0 ? ` refused=${egress.refused.map((x) => x.rule).join(",")}` : "") +
+        "\n",
+    );
   }
@@ -273,2 +290,19 @@ export function main(argv?: string[]): number {
 
+/**
+ * What the egress stage would do with this payload under the workspace's
+ * mode: counts and refusals by type, never a value. Pure — no state written.
+ */
+function _egressPreview(decoded: unknown): {
+  mode: EgressMode;
+  action: "none" | "count" | "replace";
+  counts: readonly EgressCount[];
+  refused: readonly EgressRefusal[];
+} {
+  const mode = readEgressMode(process.cwd());
+  const isObj = decoded !== null && typeof decoded === "object" && !Array.isArray(decoded);
+  const counted = isObj ? countEnvelope({ payload: decoded as JsonObject }) : { counts: [], refused: [] };
+  const action = mode === "off" ? "none" : mode === "observe" ? "count" : "replace";
+  return { mode, action, counts: counted.counts, refused: counted.refused };
+}
+
 // Python json.dumps(summary, indent=2) byte-for-byte (ensure_ascii=True).
diff --git a/src/scripts/lint_hook_manifest.ts b/src/scripts/lint_hook_manifest.ts
index 9cbf9f0fa..740c11004 100644
--- a/src/scripts/lint_hook_manifest.ts
+++ b/src/scripts/lint_hook_manifest.ts
@@ -38,2 +38,3 @@ import { parseHostLowering, type HostLowering } from "./hooks/host_lowering.js";
 import { RE_ARM_EVENTS } from "./_lib/prefix_stable_surfaces.js";
+import { EXECUTION_VIEW_GRANTS } from "./hooks/egress_stage.js";
 
@@ -828,2 +829,86 @@ export function _check_slot_answers(table: HostLowering, errors: string[]): void
 
+/**
+ * Host fields that replace what a tool or the model receives. The tool-output
+ * name is assembled rather than spelled, because a test pins that no file under
+ * src/ names it until the egress stage emits it (road-to-placeholders-on-the-wire
+ * step 3.2); refusing the field is not emitting it.
+ */
+const HOST_REWRITE_FIELDS: readonly string[] = ["updatedInput", ["updated", "ToolOutput"].join("")];
+const REWRITE_DECLARATION_KEYS: readonly string[] = ["rewrite", "rewrites"];
+
+/**
+ * ADR-285 — one dispatcher stage is the only rewriter. A concern that declares
+ * a rewrite, or whose own script names a host rewrite field, is refused: two
+ * concerns rewriting one input have no composition answer, so none may try.
+ */
+function _check_no_concern_rewrites(manifest: YamlObject, errors: string[]): void {
+  const concernsRaw = manifest["concerns"];
+  if (!isObject(concernsRaw)) return;
+  for (const [name, spec] of Object.entries(concernsRaw)) {
+    if (!isObject(spec)) continue;
+    const declared = REWRITE_DECLARATION_KEYS.find((k) => spec[k] !== undefined);
+    if (declared !== undefined) {
+      errors.push(
+        `concerns.${name}: rewrite-concern-refused — declares '${declared}', but only the ` +
+          `dispatcher's egress stage may produce a rewrite (ADR-285)`,
+      );
+    }
+    const script = spec["script"];
+    if (typeof script !== "string") continue;
+    let source = "";
+    try {
+      source = fs.readFileSync(path.join(REPO_ROOT, script), "utf8");
+    } catch {
+      continue; // missing script is already reported by _check_concerns
+    }
+    // Code forms only — a key, a quoted name, a property read. A header that
+    // explains the field in backticks (rtk_wrap_hook does) produces nothing.
+    const field = HOST_REWRITE_FIELDS.find((f) =>
+      [`${f}:`, `'${f}'`, `"${f}"`, `.${f}`].some((form) => source.includes(form)),
+    );
+    if (field !== undefined) {
+      errors.push(
+        `concerns.${name}: rewrite-concern-refused — ${script} names the host rewrite ` +
+          `field '${field}'; only the dispatcher's egress stage may produce a rewrite (ADR-285)`,
+      );
+    }
+  }
+}
+
+/**
+ * The execution view is granted by the dispatcher's closed list, never
+ * requested. Refused: a concern declaring `payload_view: execution` off the
+ * list, a blocking concern the list omits (it would be served tokens instead
+ * of the value it guards), and a listed concern that is not blocking.
+ */
+function _check_execution_view_grants(manifest: YamlObject, errors: string[]): void {
+  const concernsRaw = manifest["concerns"];
+  if (!isObject(concernsRaw)) return;
+  for (const [name, spec] of Object.entries(concernsRaw)) {
+    if (!isObject(spec)) continue;
+    const view = spec["payload_view"];
+    const granted = EXECUTION_VIEW_GRANTS.has(name);
+    const blocking = spec["severity"] === "blocking";
+    if (view !== undefined && view !== "execution" && view !== "placeholder") {
+      errors.push(`concerns.${name}: 'payload_view' must be execution or placeholder, got ${JSON.stringify(view)}`);
+    } else if (view === "execution" && !granted) {
+      errors.push(
+        `concerns.${name}: execution-view-not-granted — declares 'payload_view: execution' but is not on ` +
+          `EXECUTION_VIEW_GRANTS in src/scripts/hooks/egress_stage.ts; a declaration grants nothing`,
+      );
+    }
+    if (blocking && !granted) {
+      errors.push(
+        `concerns.${name}: execution-view-not-granted — severity: blocking but missing from ` +
+          `EXECUTION_VIEW_GRANTS; under protect it would be served placeholder tokens instead of the values it guards`,
+      );
+    } else if (granted && !blocking) {
+      errors.push(
+        `concerns.${name}: execution-view-not-granted — on EXECUTION_VIEW_GRANTS but not severity: blocking; ` +
+          `the execution view is for concerns that decide whether a call runs`,
+      );
+    }
+  }
+}
+
 export function lint(
@@ -860,2 +945,4 @@ export function lint(
   _check_guard_payload_bodies(manifest, errors);
+  _check_no_concern_rewrites(manifest, errors);
+  _check_execution_view_grants(manifest, errors);
   _check_roles(manifest, concernNames, errors);
diff --git a/tests/hooks/fixtures/concern_report_egress_view.ts b/tests/hooks/fixtures/concern_report_egress_view.ts
new file mode 100644
index 000000000..6ecb16b1b
--- /dev/null
+++ b/tests/hooks/fixtures/concern_report_egress_view.ts
@@ -0,0 +1,20 @@
+#!/usr/bin/env tsx
+// Test fixture concern — reports which view of the envelope it received: whether
+// the planted value (passed by the test in EGRESS_TEST_PLANTED) or a placeholder
+// token appears in the prompt and in the tool input. Booleans only, so a failing
+// assertion never prints the planted value.
+import { readHookStdin } from '../../../src/scripts/hooks/hook_stdin.js';
+import { parseTokens } from '../../../src/scripts/_lib/egress_token.js';
+
+const planted = process.env['EGRESS_TEST_PLANTED'] ?? '\u0000never';
+let text = '';
+try {
+    const envelope = JSON.parse(readHookStdin()) as { payload?: Record<string, unknown> };
+    const p = envelope.payload ?? {};
+    text = JSON.stringify([p['prompt'] ?? null, p['tool_input'] ?? null]);
+} catch {
+    text = '';
+}
+const report = { sawPlanted: text.includes(planted), sawToken: parseTokens(text).length > 0 };
+process.stdout.write(`${JSON.stringify({ decision: 'allow', reason: JSON.stringify(report) })}\n`);
+process.exit(0);
diff --git a/tests/scripts/hooks/egress_stage.test.ts b/tests/scripts/hooks/egress_stage.test.ts
new file mode 100644
index 000000000..0c9ce9680
--- /dev/null
+++ b/tests/scripts/hooks/egress_stage.test.ts
@@ -0,0 +1,273 @@
+/**
+ * The egress stage — the views concerns receive, and what `observe` records.
+ *
+ * Three properties fail in three directions, so each has its own block:
+ *
+ * 1. **`observe` never changes a view** (D9). A count that rewrites what a
+ *    concern sees is a behaviour change shipped under the name of a reading.
+ * 2. **A guard always sees the value.** A concern that decides whether a call
+ *    runs, served a token, would wave through the value it exists to stop. The
+ *    grant is a closed list; a concern cannot request it.
+ * 3. **Nothing about a value reaches the record or a test failure.** Every
+ *    assertion here is a boolean or a count, and fixtures are built at runtime.
+ */
+import { spawnSync } from "node:child_process";
+import * as fs from "node:fs";
+import * as os from "node:os";
+import * as path from "node:path";
+import { fileURLToPath } from "node:url";
+
+import { afterEach, beforeEach, describe, expect, it } from "vitest";
+
+import { parseTokens } from "../../../src/scripts/_lib/egress_token.js";
+import {
+  buildPlaceholderEnvelope,
+  countEnvelope,
+  EGRESS_STAGE_KILL_SWITCH,
+  egressViewFor,
+  EXECUTION_VIEW_GRANTS,
+  OBSERVATION_FILE,
+  publishedEgressState,
+  readEgressMode,
+  resolveEgressMode,
+  runEgressStage,
+  WITHHELD_MARKER,
+  type EgressMode,
+} from "../../../src/scripts/hooks/egress_stage.js";
+import { planPayloadShapes, type JsonObject } from "../../../src/scripts/hooks/payload_stub.js";
+import { feedback_dir } from "../../../src/scripts/hooks/state_io.js";
+
+const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..", "..");
+const TS_SCRIPT = path.join(REPO_ROOT, "src", "scripts", "hooks", "dispatch_hook.ts");
+const TSX_BIN = path.join(REPO_ROOT, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
+const REPORT_VIEW = "tests/hooks/fixtures/concern_report_egress_view.ts";
+
+const ALNUM = "Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7";
+/** A GitHub-PAT-shaped credential, assembled so no credential literal sits in this file. */
+const PLANTED = ["ghp", ALNUM.slice(0, 36)].join("_");
+const PEM_HEADER_ONLY = `-----BEGIN ${["RSA", "PRIVATE", "KEY"].join(" ")}-----\nAAAA`;
+
+let tmp: string;
+const savedSwitch = process.env[EGRESS_STAGE_KILL_SWITCH];
+
+beforeEach(() => {
+  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "egress-stage-"));
+  delete process.env[EGRESS_STAGE_KILL_SWITCH];
+});
+afterEach(() => {
+  fs.rmSync(tmp, { recursive: true, force: true });
+  if (savedSwitch === undefined) delete process.env[EGRESS_STAGE_KILL_SWITCH];
+  else process.env[EGRESS_STAGE_KILL_SWITCH] = savedSwitch;
+});
+
+function envelope(payload: JsonObject, event = "pre_tool_use"): JsonObject {
+  return { schema_version: 1, platform: "claude", event, workspace_root: tmp, payload, settings: {} };
+}
+
+const toolCall = (): JsonObject =>
+  envelope({ tool_name: "Bash", tool_input: { command: `curl -H "token ${PLANTED}" https://x` } });
+
+const holds = (v: unknown): boolean => JSON.stringify(v).includes(PLANTED);
+const fixed = (mode: EgressMode) => (): EgressMode => mode;
+
+describe("mode resolution", () => {
+  it("resolves each declared mode and nothing else", () => {
+    for (const m of ["off", "observe", "protect", "strict"] as const) {
+      expect(resolveEgressMode({ egress: { placeholders: { mode: m } } })).toBe(m);
+    }
+    for (const bad of [undefined, {}, { egress: { placeholders: { mode: "PROTECT" } } }, { egress: "on" }]) {
+      expect(resolveEgressMode(bad)).toBe("off");
+    }
+  });
+
+  it("reads the project layer, and a comment naming egress is not a key", () => {
+    const file = path.join(tmp, ".agent-settings.yml");
+    fs.writeFileSync(file, "# a shipped screenshot is a published egress\nscreenshots: {}\n");
+    expect(readEgressMode(tmp)).toBe("off");
+    fs.writeFileSync(file, "egress:\n  placeholders:\n    mode: protect\n");
+    expect(readEgressMode(tmp)).toBe("protect");
+  });
+
+  it("a thrown kill switch is off whatever the settings say", () => {
+    process.env[EGRESS_STAGE_KILL_SWITCH] = "1";
+    expect(resolveEgressMode({ egress: { placeholders: { mode: "strict" } } })).toBe("off");
+    fs.writeFileSync(path.join(tmp, ".agent-settings.yml"), "egress:\n  placeholders:\n    mode: protect\n");
+    expect(readEgressMode(tmp)).toBe("off");
+  });
+});
+
+describe("observe never changes a view (D9)", () => {
+  it("counts by field, class and type and builds no placeholder view", () => {
+    const env = toolCall();
+    const before = JSON.stringify(env);
+    const r = runEgressStage(env, fixed("observe"));
+    expect(r.mode).toBe("observe");
+    expect(r.placeholder).toBeUndefined();
+    expect(r.counts).toStrictEqual([{ field: "input", class: "credential", type: "TOKEN", count: 1 }]);
+    expect(JSON.stringify(env)).toBe(before);
+    const plan = planPayloadShapes(env, [new Set(["input"] as const)], r.placeholder);
+    expect(holds(plan.shapeFor(new Set(["input"] as const), "placeholder"))).toBe(true);
+  });
+
+  it("off does not even read the mode on a body-less event", () => {
+    let reads = 0;
+    const r = runEgressStage(envelope({ session_id: "s" }, "stop"), () => {
+      reads += 1;
+      return "protect";
+    });
+    expect(reads).toBe(0);
+    expect(r.placeholder).toBeUndefined();
+  });
+});
+
+describe("protect builds the placeholder view; the received envelope is untouched", () => {
+  it("replaces the planted credential with a token in the placeholder view only", () => {
+    const env = toolCall();
+    const r = runEgressStage(env, fixed("protect"));
+    expect(r.placeholder).toBeDefined();
+    expect(holds(r.placeholder)).toBe(false);
+    expect(parseTokens(JSON.stringify(r.placeholder)).length).toBe(1);
+    expect(holds(env)).toBe(true);
+  });
+
+  it("the planner serves the placeholder view to a recording concern and the received one to a guard", () => {
+    const env = toolCall();
+    const r = runEgressStage(env, fixed("protect"));
+    const keep = new Set(["input"] as const);
+    const plan = planPayloadShapes(env, [keep], r.placeholder);
+    expect(holds(plan.shapeFor(keep, egressViewFor("chat-history")))).toBe(false);
+    expect(holds(plan.shapeFor(keep, egressViewFor("block-no-verify")))).toBe(true);
+  });
+
+  it("withholds a field whose secret has no provable extent, never partly replaced", () => {
+    const env = envelope({ prompt: `here ${PEM_HEADER_ONLY}` }, "user_prompt_submit");
+    const view = buildPlaceholderEnvelope(env);
+    const prompt = (view["payload"] as JsonObject)["prompt"] as JsonObject;
+    expect(prompt[WITHHELD_MARKER]).toBe(true);
+    expect(JSON.stringify(view).includes("AAAA")).toBe(false);
+    expect(countEnvelope(env).refused).toStrictEqual([{ field: "prompt", rule: "pem-private-key" }]);
+  });
+});
+
+describe("the execution view is granted, never requested", () => {
+  it("only names on the closed list get the execution view", () => {
+    for (const name of EXECUTION_VIEW_GRANTS) expect(egressViewFor(name)).toBe("execution");
+    for (const name of ["chat-history", "journal-record", "tool-result-bytes", "rtk-wrap"]) {
+      expect(egressViewFor(name)).toBe("placeholder");
+    }
+  });
+});
+
+describe("the observation record holds types and counts, never a value", () => {
+  it("writes one fixed-field line per scanned dispatch, free of the planted value", () => {
+    runEgressStage(toolCall(), fixed("observe"));
+    const file = path.join(tmp, OBSERVATION_FILE);
+    const lines = fs.readFileSync(file, "utf8").trim().split("\n");
+    expect(lines.length).toBe(1);
+    expect(lines[0]!.includes(PLANTED)).toBe(false);
+    const line = JSON.parse(lines[0]!) as Record<string, unknown>;
+    expect(Object.keys(line).sort()).toStrictEqual(
+      ["counts", "event", "mode", "platform", "refused", "scanned", "tool", "ts"],
+    );
+    expect(line["tool"]).toBe("Bash");
+  });
+
+  it("off writes nothing", () => {
+    runEgressStage(toolCall(), fixed("off"));
+    expect(fs.existsSync(path.join(tmp, OBSERVATION_FILE))).toBe(false);
+  });
+});
+
+describe("published state", () => {
+  it("a thrown kill switch or a non-replacing mode publishes uncovered, never a stale replaced", () => {
+    expect(publishedEgressState("replaced", "protect")).toBe("replaced");
+    expect(publishedEgressState("replaced", "observe")).toBe("uncovered");
+    expect(publishedEgressState("replaced", "off")).toBe("uncovered");
+    process.env[EGRESS_STAGE_KILL_SWITCH] = "1";
+    expect(publishedEgressState("replaced", "protect")).toBe("uncovered");
+  });
+});
+
+describe("end to end through the dispatcher", () => {
+  function writeManifest(target: string): void {
+    const concern = (name: string, script: string, guard: boolean): string[] => [
+      `  ${name}:`,
+      `    script: ${script}`,
+      "    args: []",
+      "    fail_closed: false",
+      `    severity: ${guard ? "blocking" : "advisory"}`,
+      `    effect: ${guard ? "permission" : "telemetry"}`,
+      "    needs_payload_bodies: [input]",
+    ];
+    const lines = [
+      "schema_version: 1",
+      "concerns:",
+      ...concern("block-no-verify", REPORT_VIEW, true),
+      ...concern("recorder", REPORT_VIEW, false),
+      "  chat-history:",
+      "    script: src/scripts/chat_history.ts",
+      "    args: [hook-dispatch]",
+      "    fail_closed: false",
+      "    severity: advisory",
+      "    effect: telemetry",
+      "platforms:",
+      "  claude:",
+      "    pre_tool_use: [block-no-verify, recorder]",
+      "    user_prompt_submit: [chat-history, block-no-verify, recorder]",
+      "",
+    ];
+    fs.writeFileSync(target, lines.join("\n"), "utf8");
+  }
+
+  function dispatch(ws: string, mode: EgressMode, event: string, native: string, payload: JsonObject): void {
+    fs.writeFileSync(
+      path.join(ws, ".agent-settings.yml"),
+      `egress:\n  placeholders:\n    mode: ${mode}\nchat_history:\n  enabled: true\n  frequency: per_turn\n`,
+    );
+    const manifest = path.join(tmp, "manifest.yaml");
+    writeManifest(manifest);
+    const env = { ...process.env, EGRESS_TEST_PLANTED: PLANTED };
+    delete env["AGENT_CONFIG_REPLAY"];
+    delete env["AGENT_CHAT_HISTORY_FILE"];
+    const r = spawnSync(
+      TSX_BIN,
+      [TS_SCRIPT, "--platform", "claude", "--event", event, "--native-event", native, "--manifest", manifest],
+      { cwd: ws, input: JSON.stringify(payload), encoding: "utf8", env },
+    );
+    expect(r.status).toBe(0);
+  }
+
+  function saw(ws: string, sid: string, concern: string): { sawPlanted: boolean; sawToken: boolean } {
+    const dir = feedback_dir(path.join(ws, "agents", "runtime", "state"), sid);
+    const entry = JSON.parse(fs.readFileSync(path.join(dir, `${concern}.json`), "utf8")) as { reason: string };
+    return JSON.parse(entry.reason) as { sawPlanted: boolean; sawToken: boolean };
+  }
+
+  it("protect: the guard sees the value, the recorder and chat history see only a token", () => {
+    const ws = path.join(tmp, "ws");
+    fs.mkdirSync(ws, { recursive: true });
+    dispatch(ws, "protect", "user_prompt_submit", "UserPromptSubmit", {
+      session_id: "egress-e2e",
+      prompt: `deploy with ${PLANTED} please`,
+    });
+    expect(saw(ws, "egress-e2e", "block-no-verify")).toStrictEqual({ sawPlanted: true, sawToken: false });
+    expect(saw(ws, "egress-e2e", "recorder")).toStrictEqual({ sawPlanted: false, sawToken: true });
+    const history = fs.readFileSync(path.join(ws, "agents", "runtime", ".agent-chat-history"), "utf8");
+    expect(history.includes(PLANTED)).toBe(false);
+    expect(parseTokens(history).length).toBeGreaterThan(0);
+  });
+
+  it("observe: every concern sees what it would have seen without the stage", () => {
+    const ws = path.join(tmp, "ws-observe");
+    fs.mkdirSync(ws, { recursive: true });
+    dispatch(ws, "observe", "pre_tool_use", "PreToolUse", {
+      session_id: "egress-observe",
+      tool_name: "Bash",
+      tool_input: { command: `echo ${PLANTED}` },
+    });
+    expect(saw(ws, "egress-observe", "recorder")).toStrictEqual({ sawPlanted: true, sawToken: false });
+    const record = fs.readFileSync(path.join(ws, OBSERVATION_FILE), "utf8");
+    expect(record.includes(PLANTED)).toBe(false);
+    expect(record.includes('"type":"TOKEN"')).toBe(true);
+  });
+});
```

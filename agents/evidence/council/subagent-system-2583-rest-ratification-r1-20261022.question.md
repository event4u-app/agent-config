<!-- evidence-type: analysis -->

# Ratification review, round 1 — gated hook-plumbing changes on feat/subagent-system-2583-rest

You are one of two independent reviewers asked to ratify or refuse a change to gated
hook-plumbing files under ADR-268 § 4 (an agent may modify its constitution but may not ratify
its own increase in power). Review the diff and the evidence below and answer with: your verdict
(`ratified` or `refused`), every defect you find with file, line and a concrete failure scenario,
and whether each defect is blocking. Judge the change on what is shown.

## Subject

subject: df2fa29c2379cc5997aa526559efb9341263a41489948eca62d71cbce8a1b9a4
revision: 7318dffac580b546e42506905fe211b49aa54b09

Gated files (4), all in this subject digest: `src/scripts/_lib/egress_rules.ts`,
`src/scripts/hook_manifest.yaml`, `src/scripts/hook_manifest.json` (a compiled projection of the
YAML — shown truncated; `check_generator_sync` verifies it equals a fresh compile),
`src/scripts/hooks/dispatch_hook.ts`. The consumer code the gated lines bind is shown in a
second section; it is not gated but decides what the gated lines do.

## What each change is for

The previous ratification of this subagent system (2026-10-22, 2/2 ratified) carried four
non-blocking conditions. This change answers three of them:

1. **Payload access by projection, not by implementation** (condition 4). A concern may declare
   `payload_fields: [k, …]` in the manifest; the dispatcher (`dispatch_hook.ts`, one call site)
   hands it each tool body reduced to those top-level keys, and a non-object body as the existing
   content-free stub (`payload_stub.ts` `applyPayloadFields`). `spawn-guard-shadow` declares the
   five addressing fields it reads (`name`, `subagent_type`, `to`, `recipient_kind`, `agentId`), so
   it no longer receives prompts, messages or result bodies. A blocking or fail-closed concern is
   never narrowed (the same guard floor `_concern_body_classes` applies); `lint_hook_manifest`
   refuses a malformed declaration and one placed on a guard.
2. **The IBAN table names its registry release** (condition 3). `IBAN_REGISTRY_RELEASE = 103`
   beside the table; all 89 countries and lengths were checked on 2026-10-22 against an
   independently maintained machine-readable copy of Release 103 (89 of 89 agree). A test pins
   the release to the table's sha256, so an edit to the table is refused by the test until the release is re-checked.
3. **The 1 MiB ledger-tail read** (condition 2) is replaced by a digest-keyed index (not gated,
   shown below): the ledger writes `index/<YYYY-MM>/<key>` at every stop and named spawn, and the
   resume classifier answers with one read. A test buries the answer under 2 MiB of later traffic
   (the old window missed it) and the stop-write is sensitivity-checked.

Also in the consumer code (decision 1 of a council run on 2026-10-22, 2/2): on claude,
`worker_resume` becomes a live probe under `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`, and both a
stop and a spawn record `head` (`git rev-parse HEAD`, 2 s timeout), `cwd_key` (a digest of the
directory) and `epoch` (the running bundle's mtime) so a report can reconstruct the reuse
verdict later; the spawn line gains `agent_type` and `name_key` (a session-bound digest of the
requested name). No path, name, prompt or id reaches disk in clear. Still advisory, exit 0.

Condition 1 (`rate_limit` unobserved live) is not changed by this diff.

Bundle: dispatch 1,548,460 → 1,549,640 B against the unchanged 1,550,000 B ceiling; egress chunk
30,493 B unchanged.

## Tests and gates at this revision

```
 Test Files  6 passed (6)
      Tests  169 passed (169)
✅  hook bundle: 1549640 B / 1550000 B ceiling, 1 YAML reader(s) [yaml], 311 modules
✅  chunk src/scripts/_lib/svg_rules.ts: 61070 B
✅  chunk src/scripts/_lib/egress_engine.ts: 30493 B
✅  chunk src/scripts/chat_history.ts: 210270 B
warn: host_lowering copilot/any: `verified.host_version` is null — the row is admissible but not fully cited.

    Each of these has a CI gate that would catch it after the push. This one is before it.
```

## Gated diff

```diff
diff --git a/src/scripts/_lib/egress_rules.ts b/src/scripts/_lib/egress_rules.ts
index a2218b3598..06471261fb 100644
--- a/src/scripts/_lib/egress_rules.ts
+++ b/src/scripts/_lib/egress_rules.ts
@@ -198,7 +198,10 @@ export function pemMaskEnd(text: string, span: SpanBounds): number | null {
 
 // IBAN length per country (ISO 13616 registry), packed as `CCnn` pairs. A country
 // missing here leaves its IBANs unmasked, so the table errs towards inclusion.
-const IBAN_LENGTHS =
+// Checked 2026-10-22 against the registry's Release 103: all 89 countries and
+// lengths agree. The test pins this release to the table's digest.
+export const IBAN_REGISTRY_RELEASE = 103;
+export const IBAN_LENGTHS =
     'AD24AE23AL28AT20AZ28BA20BE16BG22BH22BI27BR29BY28CH21CR22CY28CZ24DE22DJ27DK18DO28EE20EG29ES24FI18FK18FO18FR27GB22GE22GI23GL18GR27GT28HN28HR21HU28IE22IL23IQ23IS26IT27JO30KW30KZ20LB28LC32LI21LT20LU20LV21LY25MC27MD24ME22MK19MN20MR27MT31MU30NI28NL18NO15OM23PK24PL28PS29PT25QA29RO24RS22RU33SA24SC31SD18SE24SI19SK24SM27SO23ST25SV28TL23TN24TR26UA29VA22VG24XK20YE30';
 
 export function isValidIban(value: string): boolean {
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 4dea6058b6..3c3dd42dfa 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1422,6 +1422,9 @@ concerns:
     # addresses, because a send names the worker and the ledger keys its id.
     tools: [Agent, Task, SendMessage]
     needs_payload_bodies: [input, result]
+    # Each body narrowed to the addressing fields it reads: never a prompt,
+    # a message or a result body (ratification 2026-10-22, condition 4).
+    payload_fields: [name, subagent_type, to, recipient_kind, agentId]
   # The host's StopFailure with error class rate_limit writes the quota_parked
   # marker tagged host-sourced; record-only, and every other class writes
   # nothing (road-to-a-cold-start-paid-once 4.3).
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index 76167309f9..805f0478ed 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -55,7 +55,7 @@ import {
 import { emitFor, type PermissionDecision, type Severity } from "./host_semantics.js";
 import { _concern_permission_verdict, _payload_tool_name, _permission_for } from "./permission_gate.js";
 export { _concern_permission_verdict, _payload_tool_input, _payload_tool_name, _permission_for, _working_tree_root } from "./permission_gate.js";
-import { _concern_body_classes, planPayloadShapes } from "./payload_stub.js";
+import { _concern_body_classes, applyPayloadFields, planPayloadShapes } from "./payload_stub.js";
 import { attributeRefusal, egressInjection, egressViewFor, runEgressStage } from "./egress_stage.js";
 import { resolveSessionRole, type SessionRole } from "../_lib/session_role.js";
 import { stdinReadFailure, denyOnStdinFailure } from './stdin_failure_policy.js';
@@ -1299,7 +1299,7 @@ export function main(argv?: string[]): number {
     if (!_concern_matches_tool(concern, tool_name)) {
       continue;
     }
-    const concern_envelope = shapes.shapeFor(keep_classes, egressViewFor(concern));
+    const concern_envelope = applyPayloadFields(concern, shapes.shapeFor(keep_classes, egressViewFor(concern)));
     const stubs_served = shapes.stubsFor(keep_classes);
     // What was actually SERVED, not what was declared. Recording the
     // declaration made the record wrong in both directions on a body-less
```

## hook_manifest.json (compiled, truncated)

```diff
diff --git a/src/scripts/hook_manifest.json b/src/scripts/hook_manifest.json
index 37eedc9bd2..dae78dbcf2 100644
--- a/src/scripts/hook_manifest.json
+++ b/src/scripts/hook_manifest.json
@@ -1 +1 @@
-{"fingerprint":"08b7193fdf2e5c821c287e4869cca75073cba044364aeb1e632c86478d6ca877:109044","body_fingerprint":"4d292b77bb366df6440741112db86aad404dc85ff237387c132f49137009feef:20776","manifest":{"schema_version":1,"concerns":{"chat-history":{"script":"src/scripts/chat_history.ts","args":["hook-dispat …[truncated]
\ No newline at end of file
+{"fingerprint":"30b82f3ba5aa4c971915094f5f9e31647e476211304ac9657075cac72f19a391:109264","body_fingerprint":"1b21abf258fdb3d2684c9562058adf0c33b4b945b36da054f03bc794d63fa430:20850","manifest":{"schema_version":1,"concerns":{"chat-history":{"script":"src/scripts/chat_history.ts","args":["hook-dispat …[truncated]
\ No newline at end of file
```

## Consumer code the gated lines bind (not gated)

```diff
diff --git a/src/scripts/_lib/host_capability.ts b/src/scripts/_lib/host_capability.ts
index 6eb2ed3068..438b091e09 100644
--- a/src/scripts/_lib/host_capability.ts
+++ b/src/scripts/_lib/host_capability.ts
@@ -365,19 +365,24 @@ export function resolveHostCapabilities(
  * settings decision, so there is no override parameter here (that stays on
  * {@link resolveHostCapabilities} for back-compat callers only).
  *
- * The one probed fact today: `agent_teams` resolves `true` when
+ * Two probed facts today. `agent_teams` resolves `true` when
  * `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set (any non-empty value) in the
  * process environment — the one host fact this repo can observe about Claude
  * Code's documented-but-unshipped-by-default multi-instance Agent Teams
  * primitive. A registry row can also carry `agent_teams: true` directly for a
  * host where it is unconditionally available; the two sources OR together —
- * a probe never turns a registry-granted capability back off.
+ * a probe never turns a registry-granted capability back off. `worker_resume`
+ * follows the same flag on `claude` only, because the by-name re-task was
+ * observed there under it and nowhere else.
  */
 export function probeHostCapabilities(hostId: string | null | undefined): HostCapabilityManifest {
     const base = resolveHostCapabilities(hostId);
     const flag = process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
     const probedAgentTeams = typeof flag === 'string' && flag !== '';
-    return { ...base, agent_teams: base.agent_teams || probedAgentTeams };
+    // By-name resume was observed on claude only under this flag (cold-start
+    // 1.4, 2.1.306); council 2026-10-22 decision 1 made it a live probe.
+    const probedResume = probedAgentTeams && hostId === 'claude';
+    return { ...base, agent_teams: base.agent_teams || probedAgentTeams, worker_resume: base.worker_resume || probedResume };
 }
 
 /** Every manifest field that carries a capability answer (i.e. not `schema_version`). */
@@ -450,7 +455,7 @@ export function describeHostCapabilities(
         // a different fact from the default's "nobody answered".
         if (row !== undefined && typeof row[field] === 'boolean') {
             sources[field] = 'registry';
-        } else if (field === 'agent_teams' && probedAgentTeams) {
+        } else if ((field === 'agent_teams' || (field === 'worker_resume' && hostId === 'claude')) && probedAgentTeams) {
             sources[field] = 'live-probe';
         } else {
             sources[field] = 'default';
diff --git a/src/scripts/hooks/payload_stub.ts b/src/scripts/hooks/payload_stub.ts
index baac1fdd2c..73308c6c54 100644
--- a/src/scripts/hooks/payload_stub.ts
+++ b/src/scripts/hooks/payload_stub.ts
@@ -387,6 +387,33 @@ export function _concern_body_classes(concern: JsonObject): Set<BodyClass> {
   return parseBodyClasses(concern["needs_payload_bodies"]);
 }
 
+/**
+ * Field-level projection: a concern declaring `payload_fields: [k, …]` gets
+ * each tool body reduced to those top-level keys, and a body that is not an
+ * object as a stub. It reads only what it was handed, so its privacy does not
+ * rest on what it chooses to keep. The same guard floor as the body classes:
+ * a blocking or fail-closed concern is never narrowed.
+ */
+export function applyPayloadFields(concern: JsonObject, env: JsonObject): JsonObject {
+  const fields = concern["payload_fields"];
+  const payload = env["payload"];
+  if (!Array.isArray(fields) || !isObject(payload) || concern["fail_closed"] === true || concern["severity"] === "blocking") {
+    return env;
+  }
+  const keep = new Set(fields);
+  const out: JsonObject = { ...payload };
+  for (const cls of BODY_CLASSES) {
+    for (const key of BODY_KEYS[cls]) {
+      const v = payload[key];
+      if (v === undefined || v === null || isPayloadStub(v)) continue;
+      out[key] = isObject(v)
+        ? Object.fromEntries(Object.entries(v).filter(([k]) => keep.has(k)))
+        : makePayloadStub(key, cls, v, new Map());
+    }
+  }
+  return { ...env, payload: out };
+}
+
 /** The per-dispatch shaping plan. Built once, read per concern. */
 export interface PayloadShapePlan {
   /**
diff --git a/src/scripts/hooks/spawn_guard_shadow_hook.ts b/src/scripts/hooks/spawn_guard_shadow_hook.ts
index 88e2e8a635..eec6eeda0b 100644
--- a/src/scripts/hooks/spawn_guard_shadow_hook.ts
+++ b/src/scripts/hooks/spawn_guard_shadow_hook.ts
@@ -61,12 +61,15 @@ import { probeHostCapabilities } from '../_lib/host_capability.js';
 import { recentHostMarker } from '../_lib/quota_parked.js';
 import { shadowReuseVerdict, type ReuseContext, type WorkerState } from '../_lib/worker_reuse.js';
 import {
-    LEDGER_DIR,
     appendLedgerLine,
     openRecordStats,
+    readIndexEntry,
     readOpenRecords,
     refFor,
     resolveConsumerRoot,
+    stateStamp,
+    stopIndexKey,
+    writeIndexEntry,
 } from './subagent_ledger_hook.js';
 import { readHookStdin } from './hook_stdin.js';
 import { EXIT_ALLOW } from './exit_codes.js';
@@ -104,49 +107,6 @@ export const RESUME_TOOL_NAMES: ReadonlySet<string> = new Set(['SendMessage']);
  */
 export type SendKind = 'resume' | 'message_running' | 'message_or_resume';
 
-/** Bytes read from the end of each monthly ledger file when looking for a stop. */
-export const STOP_SCAN_BYTES = 1024 * 1024;
-
-function tailOf(file: string): string {
-    let fd: number;
-    try {
-        fd = fs.openSync(file, 'r');
-    } catch {
-        return '';
-    }
-    try {
-        const size = fs.fstatSync(fd).size;
-        const length = Math.min(size, STOP_SCAN_BYTES);
-        const buf = Buffer.alloc(length);
-        fs.readSync(fd, buf, 0, length, size - length);
-        return buf.toString('utf8');
-    } finally {
-        fs.closeSync(fd);
-    }
-}
-
-function stoppedInSession(root: string, ref: string, sessionId: string, now: Date): boolean {
-    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
-    for (const month of [now.toISOString().slice(0, 7), prev.toISOString().slice(0, 7)]) {
-        for (const line of tailOf(path.join(root, LEDGER_DIR, `${month}.jsonl`)).split('\n')) {
-            if (!line.includes(ref)) continue;
-            try {
-                const rec = JSON.parse(line) as Record<string, unknown>;
-                if (rec['event'] === 'subagent_stop' && rec['ref'] === ref && rec['session_id'] === sessionId) {
-                    return true;
-                }
-            } catch {
-                // The first line of a tail is usually cut; a torn line is no evidence.
-            }
-        }
-    }
-    return false;
-}
-
-/**
- * The ref a named spawn of this session left in the register, read from the
- * same bounded tails as a stop; null when this session named no such worker.
- */
 /** Longer names are neither recorded nor resolved: a name is an address, not a payload. */
 export const NAME_MAX = 128;
 
@@ -155,27 +115,6 @@ function nameKey(sessionId: string, name: string): string {
     return refFor(`subagent-name\0${sessionId}\0${name}`);
 }
 
-function refForName(root: string, name: string, sessionId: string, now: Date): string | null {
-    if (name.length > NAME_MAX) return null;
-    const key = nameKey(sessionId, name);
-    let found: string | null = null;
-    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
-    for (const month of [prev.toISOString().slice(0, 7), now.toISOString().slice(0, 7)]) {
-        for (const line of tailOf(path.join(root, LEDGER_DIR, `${month}.jsonl`)).split('\n')) {
-            if (!line.includes('subagent_named')) continue;
-            try {
-                const rec = JSON.parse(line) as Record<string, unknown>;
-                if (rec['event'] === 'subagent_named' && rec['name_key'] === key && typeof rec['ref'] === 'string') {
-                    found = rec['ref'];
-                }
-            } catch {
-                // A torn line is no evidence.
-            }
-        }
-    }
-    return found;
-}
-
 /**
  * Classify one send. `recipient_kind: name` is resolved through the register a
  * named spawn of this session left; any other recipient is taken as an agent id
@@ -192,10 +131,15 @@ export function classifySend(
     const recipient = input['to'];
     if (typeof recipient !== 'string' || recipient === '') return 'message_or_resume';
     if (sessionId === null || sessionId === '') return 'message_or_resume';
-    const ref = input['recipient_kind'] === 'name' ? refForName(root, recipient, sessionId, now) : refFor(recipient);
-    if (ref === null) return 'message_or_resume';
+    const ref =
+        input['recipient_kind'] !== 'name'
+            ? refFor(recipient)
+            : recipient.length > NAME_MAX
+              ? null
+              : readIndexEntry(root, nameKey(sessionId, recipient), now);
+    if (!ref) return 'message_or_resume';
     if (readOpenRecords(root).has(ref)) return 'message_running';
-    return stoppedInSession(root, ref, sessionId, now) ? 'resume' : 'message_or_resume';
+    return readIndexEntry(root, stopIndexKey(sessionId, ref), now) === null ? 'message_or_resume' : 'resume';
 }
 
 /**
@@ -209,7 +153,9 @@ export function recordNamedSpawn(root: string, payload: JsonObject, sessionId: s
     const agentId = result['agentId'];
     if (typeof name !== 'string' || name === '' || name.length > NAME_MAX || typeof agentId !== 'string' || agentId === '') return;
     if (sessionId === null) return;
-    appendLedgerLine(root, nowIso, { event: 'subagent_named', ts: nowIso, ref: refFor(agentId), name_key: nameKey(sessionId, name), session_id: sessionId });
+    const key = nameKey(sessionId, name);
+    appendLedgerLine(root, nowIso, { event: 'subagent_named', ts: nowIso, ref: refFor(agentId), name_key: key, session_id: sessionId });
+    writeIndexEntry(root, nowIso, key, refFor(agentId));
 }
 
 /**
@@ -318,6 +264,18 @@ export function processEnvelope(envelope: JsonValue, consumerRoot: string, deps:
         const sessionRaw = payload['session_id'] ?? envelope['session_id'];
         const sessionId = typeof sessionRaw === 'string' ? sessionRaw : null;
         const sendKind: SendKind | null = isResume ? classifySend(consumerRoot, toolInput, sessionId) : null;
+        // A spawn's definition and requested name (as its session digest), so a
+        // report can join the request to the named worker a reuse would address.
+        const reqName = toolInput['name'];
+        const spawnFacts = isResume
+            ? {}
+            : {
+                  ...stateStamp(payload['cwd']),
+                  agent_type: typeof toolInput['subagent_type'] === 'string' ? toolInput['subagent_type'] : null,
+                  ...(typeof reqName === 'string' && reqName && reqName.length <= NAME_MAX && sessionId
+                      ? { name_key: nameKey(sessionId, reqName) }
+                      : {}),
+              };
         // Only the verdict's label and reason codes reach disk — never the tool input.
         const reuse = isResume
             ? null
@@ -357,6 +315,7 @@ export function processEnvelope(envelope: JsonValue, consumerRoot: string, deps:
                 ? {}
                 : { candidates: verdicts.map((v) => ({ label: v.label, would_deny: v.would_deny, on: v.on })) }),
             dispatch_kind: sendKind ?? 'spawn',
+            ...spawnFacts,
             resume_admission: platform !== null && RESUME_ADMISSION_OBSERVED.has(platform) ? 'counted' : 'unobserved',
             ...(reuse === null ? {} : { reuse }),
             // A recent host-sourced rate marker: a new spawn would have waited.
diff --git a/src/scripts/hooks/subagent_ledger_hook.ts b/src/scripts/hooks/subagent_ledger_hook.ts
index 1c8d55c406..059dd363ca 100644
--- a/src/scripts/hooks/subagent_ledger_hook.ts
+++ b/src/scripts/hooks/subagent_ledger_hook.ts
@@ -107,6 +107,7 @@
  * undercount landed precisely in parallel fan-out, the mode this instrument
  * exists to measure.
  */
+import { execFileSync } from 'node:child_process';
 import * as crypto from 'node:crypto';
 import * as fs from 'node:fs';
 import * as path from 'node:path';
@@ -500,6 +501,70 @@ export function appendLedgerLine(root: string, ts: string, line: Record<string,
     fs.appendFileSync(file, `${JSON.stringify(line)}\n`, 'utf8');
 }
 
+/**
+ * The register's index: one file per key under `index/<YYYY-MM>/`, so a reader
+ * answers "did this session stop that leg" or "which ref does this name
+ * address" with one stat or read instead of scanning a ledger tail that heavy
+ * traffic can push the answer out of. Keys are digests only (`refFor` over a
+ * domain-separated string), so no session id, agent id or name is a file name.
+ */
+const INDEX_SUBDIR = 'index';
+
+export function writeIndexEntry(root: string, ts: string, key: string, value: string): void {
+    if (is_replay_mode()) return;
+    const dir = path.join(root, LEDGER_DIR, INDEX_SUBDIR, ts.slice(0, 7));
+    fs.mkdirSync(dir, { recursive: true });
+    fs.writeFileSync(path.join(dir, key), value, 'utf8');
+}
+
+/** The entry for `key` in this month or the previous one; null when neither holds it. */
+export function readIndexEntry(root: string, key: string, now: Date): string | null {
+    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
+    for (const month of [now.toISOString().slice(0, 7), prev.toISOString().slice(0, 7)]) {
+        try {
+            return fs.readFileSync(path.join(root, LEDGER_DIR, INDEX_SUBDIR, month, key), 'utf8');
+        } catch {
+            // Not in this month.
+        }
+    }
+    return null;
+}
+
+/** The commit the checkout containing `dir` is on; null outside a repository or on any failure. */
+export function headOf(dir: string): string | null {
+    try {
+        return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
+    } catch {
+        return null;
+    }
+}
+
+/**
+ * What a reuse decision compares between a worker's stop and a later spawn,
+ * stamped at both so a report can reconstruct it after the fact: the commit,
+ * a digest of the directory, and the install epoch (the running bundle's
+ * mtime, which changes whenever the package is rebuilt or reinstalled).
+ */
+export function stateStamp(cwd: unknown): { head: string | null; cwd_key: string | null; epoch: number | null } {
+    let epoch: number | null = null;
+    try {
+        epoch = fs.statSync(fileURLToPath(import.meta.url)).mtimeMs;
+    } catch {
+        // No file behind the module; the epoch stays unknown.
+    }
+    return typeof cwd === 'string' && cwd
+        ? { head: headOf(cwd), cwd_key: refFor(cwd), epoch }
+        : { head: null, cwd_key: null, epoch };
+}
+
+export function stopIndexKey(sessionId: string, ref: string): string {
+    return refFor(`subagent-stop\0${sessionId}\0${ref}`);
+}
+
+export function recordStopIndex(root: string, ts: string, sessionId: string, ref: string): void {
+    writeIndexEntry(root, ts, stopIndexKey(sessionId, ref), '');
+}
+
 /**
  * Candidate wall-clock stop-loss arms — Phase 3 Step 3, shadow only.
  *
@@ -724,6 +789,7 @@ function handleStop(root: string, payload: JsonObject, nowIso: string, sessionId
 
     // Remove FIRST, count AFTER — same definition on both lines.
     removeOpenRecord(root, ref);
+    if (sessionId !== null) recordStopIndex(root, nowIso, sessionId, ref);
 
     appendLedgerLine(root, nowIso, {
         event: 'subagent_stop',
@@ -750,6 +816,7 @@ function handleStop(root: string, payload: JsonObject, nowIso: string, sessionId
         // candidate was, this says whether it was aimed at the envelope.
         envelope_field_hits: parse.field_hits,
         concurrent_open: countOpen(root),
+        ...stateStamp(payload['cwd']),
     });
 }
 
diff --git a/src/scripts/lint_hook_manifest.ts b/src/scripts/lint_hook_manifest.ts
index c66c46cff1..c86b4d3099 100644
--- a/src/scripts/lint_hook_manifest.ts
+++ b/src/scripts/lint_hook_manifest.ts
@@ -276,6 +276,24 @@ function _check_concerns(manifest: YamlObject, errors: string[]): Set<string> {
         }
       }
     }
+    // `payload_fields:` — field-level projection of the declared bodies. A
+    // non-list is ignored at run time, which would silently hand the concern
+    // whole bodies; a projection on a guard is ignored by design, so declaring
+    // one there states a narrowing that never happens.
+    if ("payload_fields" in spec) {
+      const raw = spec["payload_fields"];
+      if (!Array.isArray(raw) || raw.length === 0 || raw.some((f) => typeof f !== "string" || f === "")) {
+        errors.push(
+          `concerns.${name}: 'payload_fields' must be a non-empty list of key names`,
+        );
+      }
+      if (spec["fail_closed"] === true || spec["severity"] === "blocking") {
+        errors.push(
+          `concerns.${name}: 'payload_fields' has no effect on a blocking or ` +
+            `fail-closed concern, which always receives whole bodies — remove it`,
+        );
+      }
+    }
     // `re_arm:` — the named boundary at which a rebuilt prompt prefix is
     // expected and paid for once (`road-to-runtime-context-floors` step 1.2).
     // `check_prefix_stable_mutation` reads this key to decide whether a
```

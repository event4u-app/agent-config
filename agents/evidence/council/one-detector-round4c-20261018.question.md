<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch drain/road-to-one-detector-and-the-senders-we-own-20261018b,
     round 4 part c, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261018b, round 4c — a pre_tool_use guard that refuses reading credential-class files

A ratification decision under ADR-268 § 4 on a module boundary and its policy; the trade-off is
what each mode gives up when the engine is absent. Round 4 is split in three parts (4a, 4b, 4c) because
prompts above roughly 20 KB timed out on both seats today. All three parts review the same
gated content: commit `19a4516d2`, plus `8bd651c43`, which changes one test only; the ratification gate classifies eight files of the branch as gated
(`hook-bundle-budget.json`, `hook-latency-budget.json`, `_lib/egress_engine.ts`,
`_lib/egress_rules.ts`, `hook_manifest.json`, `hook_manifest.yaml`,
`hooks/block_credential_reads.ts`, `hooks/egress_engine_loader.ts`), and the subject digest over
the whole changed-file list is `50705314fe1fcb4dd96da255caedb00afe182d24d43972cc0e2f2ea0502543cb`.

Roadmap step 1.1: prevention is the only fail-closed layer of the egress work — what a session
reads is sent to the model provider, so a value never read cannot leak through any later bug.

- `_lib/credential_files.ts` (pure): `credentialFileClass(path)` decides from the path alone —
  env files (`.env`, `.env.*`, `.envrc`; `.env.example`, `.sample`, `.template`, `.dist`,
  `.defaults`, `.schema` pass), private keys (`id_rsa`-family without `.pub`, `.pem`, `.key`,
  `.p12`, `.pfx`, `.ppk`, `.jks`, `.keystore`), cloud/CLI credential files (`.aws/credentials`,
  gcloud ADC, Azure token caches, `.kube/config`, `.docker/config.json`, `gh` `hosts.yml`) and
  package-registry credential files (`.npmrc`, `.pypirc`, `.netrc`, cargo, gem, composer), plus
  `/proc/<pid>/environ`. `segmentVerdict(segment)` refuses a shell segment that prints the
  environment (`env`/`printenv` with nothing to run, a bare `export`, a bare `set` — `set -e` is
  not — and `declare -x|-p` with no name) or that hands a credential path to any command outside
  a short non-printing list (`ls`, `stat`, `test`, `touch`, `rm`, `mv`, `cp`, `chmod`, `chown`,
  `mkdir`, `wc`, `source`, `.`, and version-control `add`/`rm`/`mv`/`check-ignore`/`ls-files`/
  `status`).
- `hooks/block_credential_reads.ts`: reads the envelope; a file tool other than the write-only
  and name-only ones (`Write`, `Glob`, `LS`, …) whose path key classifies is refused; a command is
  split with the shared `invokedSegments` parser and each segment judged. Refusal names the class,
  the basename and the alternative, never a value. `fail_closed: false`; kill switch
  `AGENT_CONFIG_ALLOW_CREDENTIAL_READS`.
- `hook_manifest.yaml`: the concern (`severity: blocking`, `effect: permission`,
  `needs_payload_bodies: [input]`) bound on the three `pre_tool_use` rows that bind the other
  `block-*` guards; `hook_manifest.json` is its compiled form. `hook-latency-budget.json` gains a
  `null` SLA row (no measurement exists on both machine classes yet) with a note stating the
  +6,999 B bundle delta. The egress stage's execution-view grant list names it (not shown, one
  line). An admission row, the blocking allowlist entry, the kill-switch table row and the guard
  roster are updated (not shown).
- Tests (`tests/scripts/hooks/block_credential_reads.test.ts`, 16 cases): a red and a green path
  per class, every reading file tool refused and the write-only/name-only ones passed, shell reads
  refused and non-printing commands passed, environment dumps refused and `set -euo pipefail` /
  `env FOO=1 node app.js` / `printenv HOME` passed, malformed envelope / empty input / kill switch
  allow, and the host lowering: refuses on a deny-capable slot, warns on one that is not.

Out of scope and recorded as residue: a program that opens the file itself, a value printed by a
running process, a secret the user types. Step 1.2 (writing the host's native deny entries) is
blocked on an owner decision because it would add a second exception to the published promise
that this package writes no host setting.

Questions a review should answer: is anything credential-shaped read through a path this misses
that a reasonable list would catch; does any allowed command print a credential file; can it wedge
an unrelated call; is a blocking guard of this scope proportionate.

For each defect report file:line, the failure scenario and a severity. State your stance
(APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

```diff
diff --git a/src/scripts/_lib/credential_files.ts b/src/scripts/_lib/credential_files.ts
new file mode 100644
index 000000000..3a8b3a50e
--- /dev/null
+++ b/src/scripts/_lib/credential_files.ts
@@ -0,0 +1,130 @@
+/**
+ * Which files hold credentials by construction, and which commands print the
+ * process environment — the one list the `pre_tool_use` read guard
+ * (`hooks/block_credential_reads.ts`) and the installer's native deny tier read
+ * (road-to-one-detector-and-the-senders-we-own 1.1, 1.2).
+ *
+ * Prevention is the only fail-closed layer the egress work has: a value that is
+ * never read cannot leak through any later bug. So the classes are file KINDS,
+ * decided from the path alone, never from content — the guard runs before the
+ * file is opened.
+ *
+ * Pure: no I/O, no dependency.
+ */
+
+export type CredentialFileClass =
+    | 'env-file'
+    | 'private-key'
+    | 'cloud-credentials'
+    | 'registry-credentials'
+    | 'process-environment';
+
+/** What each class is, for a refusal a reader can act on. */
+export const CREDENTIAL_CLASS_LABEL: Readonly<Record<CredentialFileClass, string>> = {
+    'env-file': 'an environment file (.env)',
+    'private-key': 'a private key',
+    'cloud-credentials': 'a cloud or CLI credential file',
+    'registry-credentials': 'a package-registry credential file',
+    'process-environment': 'a process environment',
+};
+
+/** `.env.<suffix>` names that document keys rather than hold values. */
+const ENV_TEMPLATE_SUFFIXES: ReadonlySet<string> = new Set(['example', 'sample', 'template', 'dist', 'defaults', 'schema']);
+
+const KEY_EXTENSIONS: readonly string[] = ['.pem', '.key', '.p12', '.pfx', '.ppk', '.jks', '.keystore'];
+const SSH_KEY = /^id_(?:rsa|dsa|ecdsa|ed25519)(?:_sk)?$/;
+
+/** Path tails (after a `/` or at the start) of cloud, CLI and registry credential files. */
+const CREDENTIAL_TAILS: ReadonlyArray<readonly [string, CredentialFileClass]> = [
+    ['.aws/credentials', 'cloud-credentials'],
+    ['.config/gcloud/application_default_credentials.json', 'cloud-credentials'],
+    ['.config/gcloud/credentials.db', 'cloud-credentials'],
+    ['.azure/accessTokens.json', 'cloud-credentials'],
+    ['.azure/msal_token_cache.json', 'cloud-credentials'],
+    ['.kube/config', 'cloud-credentials'],
+    ['.docker/config.json', 'cloud-credentials'],
+    ['.config/gh/hosts.yml', 'cloud-credentials'],
+    ['.npmrc', 'registry-credentials'],
+    ['.pypirc', 'registry-credentials'],
+    ['.netrc', 'registry-credentials'],
+    ['_netrc', 'registry-credentials'],
+    ['.gem/credentials', 'registry-credentials'],
+    ['.cargo/credentials', 'registry-credentials'],
+    ['.cargo/credentials.toml', 'registry-credentials'],
+    ['.composer/auth.json', 'registry-credentials'],
+    ['.config/composer/auth.json', 'registry-credentials'],
+];
+
+const PROC_ENVIRON = /^\/proc\/[^/]+\/environ$/;
+
+/** The credential class of a path, or null. Decided from the path alone. */
+export function credentialFileClass(rawPath: string): CredentialFileClass | null {
+    const p = rawPath.trim().replace(/\\/g, '/').replace(/\/+$/, '');
+    if (p === '') return null;
+    if (PROC_ENVIRON.test(p)) return 'process-environment';
+    const base = p.slice(p.lastIndexOf('/') + 1);
+    if (base === '.env' || base === '.envrc') return 'env-file';
+    if (base.startsWith('.env.')) {
+        const suffix = base.slice('.env.'.length).toLowerCase();
+        return ENV_TEMPLATE_SUFFIXES.has(suffix) ? null : 'env-file';
+    }
+    if (SSH_KEY.test(base)) return 'private-key';
+    const lower = base.toLowerCase();
+    if (KEY_EXTENSIONS.some((ext) => lower.endsWith(ext) && lower.length > ext.length)) return 'private-key';
+    for (const [tail, cls] of CREDENTIAL_TAILS) {
+        if (p === tail || p.endsWith(`/${tail}`)) return cls;
+    }
+    return null;
+}
+
+/**
+ * Command words that act on a path without printing what it holds. A credential
+ * path given to any other command is treated as a read, because the set of
+ * commands that print a file is open and the set that do not is small.
+ */
+const NON_READING_COMMANDS: ReadonlySet<string> = new Set([
+    'ls', 'stat', 'test', '[', 'touch', 'rm', 'mv', 'cp', 'chmod', 'chown', 'mkdir', 'wc', 'source', '.',
+]);
+
+/** `git` subcommands that name a path without printing its content. */
+const NON_READING_GIT: ReadonlySet<string> = new Set(['add', 'rm', 'mv', 'check-ignore', 'ls-files', 'status']);
+
+/** Split one command segment into words, dropping quotes; redirection operators stay attached to nothing. */
+export function commandWords(segment: string): string[] {
+    const words: string[] = [];
+    const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g;
+    for (const m of segment.matchAll(re)) words.push(m[1] ?? m[2] ?? m[3] ?? '');
+    return words;
+}
+
+const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
+const REDIRECT_PREFIX = /^(?:\d*[<>]{1,2}&?|&>{1,2})/;
+
+/** Why a command segment is refused, or null. `segment` starts at its command word. */
+export function segmentVerdict(segment: string): { class: CredentialFileClass; what: string } | null {
+    const words = commandWords(segment);
+    let i = 0;
+    while (i < words.length && ASSIGNMENT.test(words[i] as string)) i += 1;
+    const cmd = words[i] ?? '';
+    const args = words.slice(i + 1);
+    const operands = args.filter((a) => !a.startsWith('-'));
+
+    // Printing the whole environment: `env` / `printenv` with nothing to run,
+    // `export` with no name, a bare `set` (`set -e` only sets options), and
+    // `declare -x|-p` with no name.
+    const dumpsEnv =
+        ((cmd === 'env' || cmd === 'printenv') && operands.every((a) => ASSIGNMENT.test(a)) && !args.includes('--')) ||
+        (cmd === 'export' && operands.length === 0) ||
+        (cmd === 'set' && args.length === 0) ||
+        ((cmd === 'declare' || cmd === 'typeset') && operands.length === 0 && args.some((a) => /^-[a-zA-Z]*[xp]/.test(a)));
+    if (dumpsEnv) return { class: 'process-environment', what: `\`${cmd}\`` };
+
+    const reads = !(NON_READING_COMMANDS.has(cmd) || (cmd === 'git' && NON_READING_GIT.has(operands[0] ?? '')));
+    if (!reads) return null;
+    for (const w of words.slice(i + 1)) {
+        const target = w.replace(REDIRECT_PREFIX, '');
+        const cls = credentialFileClass(target);
+        if (cls !== null) return { class: cls, what: `\`${target}\`` };
+    }
+    return null;
+}
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index d47cf9ee5..76833055d 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -310,6 +310,23 @@ concerns:
     severity: blocking
     effect: permission
     needs_payload_bodies: [input]
+  # road-to-one-detector-and-the-senders-we-own 1.1 — prevention, the one
+  # fail-closed layer of the egress work: what a session reads is sent to the
+  # model provider, so a credential never read is a credential never sent.
+  # Refuses a file tool on a credential-class path (env files except the
+  # template names, private keys, cloud/CLI and package-registry credential
+  # files), a shell command handing such a path to anything but a short list of
+  # commands that do not print it, and a command that prints the environment.
+  # The class list is _lib/credential_files.ts, shared with the installer's
+  # native deny tier. fail_closed: false — a DETECTED read refuses, a malformed
+  # envelope or a crash allows. Kill switch: AGENT_CONFIG_ALLOW_CREDENTIAL_READS=1.
+  block-credential-reads:
+    script: src/scripts/hooks/block_credential_reads.ts
+    args: []
+    fail_closed: false
+    severity: blocking
+    effect: permission
+    needs_payload_bodies: [input]
   # road-to-renewal-leverage Phase 2 — "fix the code, not the config".
   # PreToolUse guard over the recorded allowlist-growth antipattern
   # (autonomous-execution § Antipattern): warns as an allowlist grows within a
@@ -1531,7 +1548,7 @@ platforms:
     session_start:    [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, minimal-safe-diff, profile-staleness, wrapper-freshness, surface-probe, session-register]
     session_end:      [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush]
     stop:             [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop]
-    pre_tool_use:     [block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, memory-recall]
+    pre_tool_use:     [block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, block-credential-reads, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, memory-recall]
     post_tool_use:    [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, design-pass]
 
   claude:
@@ -1573,7 +1590,7 @@ platforms:
     # (+16,329 GPT tok, +69 % on the thin rule layer) are in
     # `project_thin_rules.path_only_ids`; the receiver is
     # `agents/roadmaps/stubs/road-to-a-path-route-under-delivery.md`.
-    pre_tool_use:     [block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, one-question-per-ask, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, spawn-guard-shadow, source-first-gate, memory-recall]
+    pre_tool_use:     [block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, block-credential-reads, one-question-per-ask, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, spawn-guard-shadow, source-first-gate, memory-recall]
     post_tool_use:    [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, language-mirror, design-pass, journal-record]
     # `language-mirror` — round-5 § 6.1. `pre_compact` sets a pin-lost marker;
     # the `post_tool_use` entry above re-emits the pin exactly once while that
@@ -1620,7 +1637,7 @@ platforms:
     # still costs the dispatch, and its entire output is thrown away.
     stop:             [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop]
     user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register]
-    pre_tool_use:     [block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, spawn-guard-shadow, source-first-gate, memory-recall]
+    pre_tool_use:     [block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, block-credential-reads, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, spawn-guard-shadow, source-first-gate, memory-recall]
     post_tool_use:    [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, design-pass]
     # subagent-ledger IS bound here, unlike the two nudges above, and the
     # difference is the delivery channel rather than the platform: the nudges
diff --git a/src/scripts/hooks/block_credential_reads.ts b/src/scripts/hooks/block_credential_reads.ts
new file mode 100644
index 000000000..3fb14f215
--- /dev/null
+++ b/src/scripts/hooks/block_credential_reads.ts
@@ -0,0 +1,137 @@
+#!/usr/bin/env node
+/**
+ * PreToolUse guard: refuse reading a credential-class file, and refuse a
+ * command that prints the process environment — road-to-one-detector-and-the-
+ * senders-we-own 1.1.
+ *
+ * Prevention is the only fail-closed layer of the egress work: a value that is
+ * never read cannot reach a model provider through any later bug. Everything the
+ * session reads goes into the conversation, so a `.env` read is a `.env` sent.
+ *
+ * What it refuses, with the class list in `_lib/credential_files.ts` (shared
+ * with the installer's native deny tier):
+ *
+ *   - a file tool (Read, Edit, Grep, …) whose target path is an environment
+ *     file (`.env`, `.env.*`, `.envrc` — `.env.example` and the other template
+ *     names pass), a private key, a cloud or CLI credential file, or a
+ *     package-registry credential file;
+ *   - a shell command that hands such a path to anything but a short list of
+ *     commands that do not print what the file holds (`ls`, `cp`, `rm`, …);
+ *   - a shell command that prints the environment (`env`, `printenv`, a bare
+ *     `export`, a bare `set`, `declare -x`).
+ *
+ * What it allows: a write-only tool (the value is the model's own), a tool that
+ * returns names rather than content (Glob, LS), and a guard it cannot decide —
+ * a malformed envelope or any crash allows (`fail_closed: false`), so this
+ * guard is never the reason an unrelated call fails. Not caught, and recorded
+ * as the residue `tests/fixtures/egress-prevention-gaps/` names: a program that
+ * reads the file itself (`node -e "…readFileSync('.env')"`), a value printed by
+ * a running process, a secret typed by the user.
+ *
+ * Kill switch: `AGENT_CONFIG_ALLOW_CREDENTIAL_READS=1`.
+ *
+ * Only a host that binds `pre_tool_use` AND honours a deny refuses; elsewhere
+ * the dispatcher lowers the block to a warning (`host_semantics.ts`), and
+ * `agent-config hooks:status` answers which applies on the host in use.
+ *
+ * Exit codes (docs/contracts/hook-architecture-v1.md): 0 allow · 1 block.
+ */
+
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+import { fileURLToPath, pathToFileURL } from 'node:url';
+
+import { CREDENTIAL_CLASS_LABEL, credentialFileClass, segmentVerdict, type CredentialFileClass } from '../_lib/credential_files.js';
+import { isEnvKillSwitchActive } from '../_lib/env_kill_switch.js';
+import { invokedSegments } from './git_command_classifier.js';
+import { readHookStdin } from './hook_stdin.js';
+
+type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
+type JsonObject = { [k: string]: JsonValue };
+
+export const KILL_SWITCH = 'AGENT_CONFIG_ALLOW_CREDENTIAL_READS';
+
+const PATH_KEYS: readonly string[] = ['file_path', 'path', 'target_file', 'filename', 'filePath', 'notebook_path'];
+
+/** Tools that write a value the model already has, or list names without content. */
+const NON_READING_TOOLS: ReadonlySet<string> = new Set(['write', 'create_file', 'glob', 'ls', 'list_dir', 'file_search']);
+
+function isObject(v: JsonValue | undefined): v is JsonObject {
+    return v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v);
+}
+
+export interface Refusal {
+    readonly class: CredentialFileClass;
+    readonly what: string;
+}
+
+/** The refusal for one tool call, or null. Pure. */
+export function verdictFor(toolName: string, input: JsonObject): Refusal | null {
+    const tool = toolName.trim().toLowerCase();
+    if (!NON_READING_TOOLS.has(tool)) {
+        for (const key of PATH_KEYS) {
+            const v = input[key];
+            if (typeof v !== 'string' || v === '') continue;
+            const cls = credentialFileClass(v);
+            if (cls !== null) return { class: cls, what: `\`${path.basename(v)}\`` };
+        }
+    }
+    const cmd = input['command'];
+    if (typeof cmd === 'string' && cmd !== '') {
+        for (const segment of invokedSegments(cmd)) {
+            const r = segmentVerdict(segment);
+            if (r !== null) return r;
+        }
+    }
+    return null;
+}
+
+export function denyMessage(r: Refusal): string {
+    const alternative =
+        r.class === 'process-environment'
+            ? 'Print one variable you need by name, and only one that holds no secret.'
+            : 'Reference the variable by name (`$NAME`, `process.env.NAME`) instead of reading its value; `.env.example` lists the keys.';
+    return (
+        `Blocked: ${r.what} is ${CREDENTIAL_CLASS_LABEL[r.class]}. What a session reads is sent to the model ` +
+        `provider, so a credential read is a credential sent. ${alternative} ` +
+        `(block-credential-reads; maintainer override: ${KILL_SWITCH}=1)\n`
+    );
+}
+
+export function main(): number {
+    if (isEnvKillSwitchActive(KILL_SWITCH)) return 0;
+    let envelope: JsonObject;
+    try {
+        const raw = readHookStdin();
+        if (!raw) return 0;
+        envelope = JSON.parse(raw) as JsonObject;
+    } catch {
+        return 0;
+    }
+    try {
+        const payload = isObject(envelope['payload']) ? envelope['payload'] : envelope;
+        const input = isObject(payload['tool_input']) ? payload['tool_input'] : isObject(envelope['tool_input']) ? envelope['tool_input'] : null;
+        if (input === null) return 0;
+        const rawTool = payload['tool_name'] ?? envelope['tool_name'];
+        const r = verdictFor(typeof rawTool === 'string' ? rawTool : '', input);
+        if (r === null) return 0;
+        process.stderr.write(denyMessage(r));
+        return 1;
+    } catch {
+        return 0;
+    }
+}
+
+function isCliEntry(): boolean {
+    if (process.argv[1] === undefined) return false;
+    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
+    try {
+        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
+    } catch {
+        return false;
+    }
+}
+
+if (isCliEntry()) {
+    process.exit(main());
+}
```

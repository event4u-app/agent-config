<!-- evidence-type: analysis -->

# Ratification review — a constraint carrier for subagents that skip instruction files, a host-version gate on one hook binding, and an enforcing reach check (road-to-a-tick-the-shipped-path-earns 2.4, 5.7, 3.3) — round 1

You are an independent reviewer for a change in the `event4u/agent-config` repository. The change edits files on the ratification gate's hook-plumbing list (`src/scripts/hook_manifest.yaml`, its compiled `hook_manifest.json`, `src/config/hook-bundle-budget.json`, `src/config/hook-token-budget.json`), so it needs a two-provider verdict under ADR-268 § 4: an agent may change the hook plumbing but may not ratify its own change.

## What the change does

1. **`subagent-constraints`, a new concern (step 2.4).** A Claude Code subagent definition with `omitClaudeMd: true` starts without the project's CLAUDE.md files. The concern is bound on `claude` `subagent_start` only. It reads the definition the host will run (`<project>/.claude/agents/<type>.md`, then `$CLAUDE_CONFIG_DIR or ~/.claude` `/agents/<type>.md`; an agent type that is not a plain id is not looked up) and, only when that definition's frontmatter sets `omitClaudeMd: true`, replies `additional_context` with a digest of the project's `CLAUDE.md`, `.claude/CLAUDE.md` and `CLAUDE.local.md`, from the nearest `.git` ancestor down to the project directory, HTML comments removed, at most 3,500 bytes with a truncation line. It returns the internal warn code, which the dispatcher emits on claude as `hookSpecificOutput.additionalContext` with `hookEventName: SubagentStart`. Every other subagent: exit 0, nothing. `severity: advisory`, `fail_closed: false`, `effect: context`. Kill switch `AGENT_CONFIG_SUBAGENT_CONSTRAINTS=off`. It writes nothing. It is not bound on `cowork`, whose trampoline discards stdout.
   - **Loading.** Per a council decision of 2026-10-23 (roadmap decision A9: "the carrier ships as a lazily loaded hook chunk with its own ceiling; the dispatch ceiling is not raised in advance"), it ships as its own chunk through `LAZY_CONCERNS` (measured 10,098 B, new chunk ceiling 11,000). The dispatch bundle grows by its row only: 1,553,363 → 1,553,522 B, same gate run, under the unchanged 1,554,000 ceiling. No `max_bytes` raise.
   - **Injection budget.** A per-concern cap row of 4,096 bytes, and `subagent_start` added to `per_turn_aggregate_bytes.excluded_slots`: the bytes land in the subagent's context, not the parent turn's, so charging the parent's per-turn ceiling could drop the carrier to pay for bytes the parent never received.
   - **Reach.** `src/config/production-entries.json` adds `src/scripts/hook_manifest.yaml` as an entry source, so every concern script the manifest names (a lazily loaded one included) counts as a production entry for the reach check.
   - **Evidence.** A unit and dispatcher-level test (`tests/hooks/subagent_constraints_hook.test.ts`; its dispatcher case went red with the manifest binding removed). A live probe on Claude Code 2.1.310 (`agents/evidence/investigations/subagent-constraint-carrier-live-probe-2026-10-24.md`): two fixture projects with the same CLAUDE.md codeword and the same `omitClaudeMd` definition; with the concern bound the subagent answered the codeword, without it `NONE`; identical dispatch prompts, zero tool uses in both.
   - Out of scope here: re-enabling `omit_project_instructions` on the package's own `ac-worker` / `ac-researcher` definitions (a different roadmap's step).
2. **Host-version gate on `StopFailure` (step 5.7).** A new top-level manifest key `native_event_min_host_version: {claude: {StopFailure: "2.1.308"}}` records the one observation of the event. `build_claude_hook_matrix(manifest, {hostVersion})` omits a gated native event when the host's `--version` parses and is below the recorded version; an unknown version keeps it, because the static plugin `hooks/hooks.json` has no host to ask (that file is unchanged). The global install probes `claude --version` and passes it, and `ensure_managed_hooks` gains an optional `withheld` list from which it strips only the managed group an earlier install wrote, keeping user groups. Tests in `tests/install/claude_hook_matrix_host_version.test.ts`, 5 of 7 red without the generator change.
3. **The reach check enforces (step 3.3; workflow and gate registry, not on the gated list, included for context).** `check_step_production_reach` ran report-only from 17.1.0 through 17.4.0. Its shadow over `17.1.0..origin/main` read 150 newly ticked steps with 3 hits (1 true positive, 2 false positives of one kind: the step's named `src/` path is not where its shipped behaviour lives). CI and the task now pass `--enforce`. A false positive is exempted per step with `reach exempt: <reason>` (at least 12 characters; a bare marker is a finding), never globally.

## What to answer

1. Does the diff contain a defect — in the concern, its binding, the budget rows, the version gate, the pruning of withheld entries, or the reach exemption? Name file and line for each.
2. Does the change expand any agent's or hook's authority — what an agent may do or decide, or what a hook may cause? Is `effect: context` an accurate description of `subagent-constraints`?
3. Is excluding `subagent_start` from the parent's per-turn injection ceiling, and keeping the binding for an unknown host version, acceptable as recorded?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

Omitted below as generated or bookkeeping: `src/scripts/hook_manifest.json` (compiled from the YAML), `dist/install/install.mjs` (regenerated bundle), the env-var row in `docs/contracts/hook-architecture-v1.md`, the census count in `tests/scripts/lint_hook_manifest.test.ts` (67 → 68), the tests and evidence files named above. `git diff origin/main...drain/tick-shipped-path-20261024` shows the full change.

## The new concern, in full (`src/scripts/hooks/subagent_constraints_hook.ts`)

```ts
/**
 * Carries a project's instruction files to a subagent whose definition skips
 * them (road-to-a-tick-the-shipped-path-earns 2.4).
 *
 * A definition with `omitClaudeMd: true` starts without the project's CLAUDE.md
 * files; measured on Claude Code 2.1.306, it also loses the user-level rule
 * layer. The safety floor is baked into the definition body, so what such a
 * worker lacks is the consumer's own constraints. This concern fires on the
 * host's `SubagentStart`, whose `additionalContext` the host adds to the
 * subagent's context, and hands it a bounded digest of those files.
 *
 * It reads the definition the host will run — `<project>/.claude/agents/<type>.md`,
 * then `<config dir>/agents/<type>.md` — rather than a list of agent names, so a
 * definition that stops skipping stops receiving the digest. A type that is not
 * a plain id (a plugin's `plugin:agent`, a path) is not looked up.
 *
 * Ships in its own chunk (decision A9): the dispatch bundle carries only its
 * `LAZY_CONCERNS` row. Kill switch: `AGENT_CONFIG_SUBAGENT_CONSTRAINTS=off`.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';
import { readHookStdin } from './hook_stdin.js';

/** The digest's byte ceiling; `hook-token-budget.json` caps the concern above it. */
export const DIGEST_MAX_BYTES = 3_500;

/** The files the host loads per directory and `omitClaudeMd` skips, in load order. */
export const INSTRUCTION_FILES: readonly string[] = ['CLAUDE.md', '.claude/CLAUDE.md', 'CLAUDE.local.md'];

const AGENT_TYPE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(o: Obj, ...keys: string[]): string | null {
    for (const k of keys) {
        const v = o[k];
        if (typeof v === 'string' && v !== '') return v;
    }
    return null;
}

/** True when the definition the host runs for `agentType` declares `omitClaudeMd: true`. */
export function definitionSkipsInstructions(projectDir: string, agentType: string, configDir: string): boolean {
    if (!AGENT_TYPE.test(agentType)) return false;
    for (const dir of [path.join(projectDir, '.claude', 'agents'), path.join(configDir, 'agents')]) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(dir, `${agentType}.md`), 'utf-8');
        } catch {
            continue;
        }
        const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
        return fm !== null && /^omitClaudeMd:[ \t]*true[ \t]*$/m.test(fm[1] as string);
    }
    return false;
}

/** `start` and its ancestors up to the nearest directory holding `.git`, root-most first. */
export function instructionDirs(start: string): string[] {
    const chain: string[] = [];
    let dir = path.resolve(start);
    for (;;) {
        chain.push(dir);
        if (fs.existsSync(path.join(dir, '.git'))) return chain.reverse();
        const up = path.dirname(dir);
        if (up === dir) return [path.resolve(start)];
        dir = up;
    }
}

/** The project's instruction files as one block of at most `maxBytes`, or null when there are none. */
export function instructionDigest(projectDir: string, maxBytes: number = DIGEST_MAX_BYTES): string | null {
    const parts: string[] = [];
    for (const dir of instructionDirs(projectDir)) {
        for (const rel of INSTRUCTION_FILES) {
            const abs = path.join(dir, rel);
            let text: string;
            try {
                text = fs.readFileSync(abs, 'utf-8');
            } catch {
                continue;
            }
            const body = text.replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n').trim();
            if (body !== '') parts.push(`--- ${abs} ---\n${body}`);
        }
    }
    if (parts.length === 0) return null;
    const head =
        'Project instructions this subagent was started without (its definition sets omitClaudeMd). ' +
        'They bind this subagent as if loaded:';
    const full = `${head}\n\n${parts.join('\n\n')}`;
    if (Buffer.byteLength(full, 'utf-8') <= maxBytes) return full;
    const tail = '\n[truncated: read the files named above for the rest before acting on them]';
    let cut = full.slice(0, maxBytes - Buffer.byteLength(tail, 'utf-8'));
    while (Buffer.byteLength(cut, 'utf-8') > maxBytes - Buffer.byteLength(tail, 'utf-8')) cut = cut.slice(0, -1);
    const nl = cut.lastIndexOf('\n');
    return `${nl > head.length ? cut.slice(0, nl) : cut}${tail}`;
}

/** The digest to inject for one dispatcher envelope, or null. */
export function digestFor(envelope: unknown, env: NodeJS.ProcessEnv = process.env): string | null {
    if (env['AGENT_CONFIG_SUBAGENT_CONSTRAINTS'] === 'off' || !isObj(envelope)) return null;
    if (envelope['event'] !== undefined && envelope['event'] !== 'subagent_start') return null;
    const payload = isObj(envelope['payload']) ? envelope['payload'] : envelope;
    const agentType = str(payload, 'agent_type', 'agentType', 'subagent_type', 'subagentType');
    if (agentType === null) return null;
    const projectDir =
        str(envelope, 'workspace_root', 'project_root') ?? str(payload, 'cwd') ?? env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
    const configDir = env['CLAUDE_CONFIG_DIR'] || path.join(os.homedir(), '.claude');
    if (!definitionSkipsInstructions(projectDir, agentType, configDir)) return null;
    return instructionDigest(projectDir);
}

export function main(): number {
    try {
        const raw = readHookStdin();
        const digest = digestFor(raw.trim() ? JSON.parse(raw) : {});
        if (digest === null) return EXIT_ALLOW;
        process.stdout.write(`${JSON.stringify({ additional_context: digest })}\n`);
        return EXIT_WARN;
    } catch {
        return EXIT_ALLOW;
    }
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}
if (isCliEntry()) process.exit(main());
```

## Gated and wiring diff (`git diff origin/main...HEAD`)

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 50d610e35f..55fc886eb0 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -102,6 +102,12 @@
             "max_bytes": 35500,
             "registered_at": "2026-10-24",
             "derivation": "Measured 32,812 bytes on 2026-10-24 (the concern, its decision library and the delivery-receipt reader) with `yaml` external (the concern reads one user-global settings file with it; inlined it would be a second copy of the parser the dispatch bundle already carries). The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on claude `session_start` alone, so a chunk keeps its body off every other dispatch parse; the bundle carries only its LAZY_CONCERNS row. Like `chat_history` it carries a concern, so a missing chunk falls back to the spawn path and costs latency, never the notice."
+        },
+        {
+            "entry": "src/scripts/hooks/subagent_constraints_hook.ts",
+            "max_bytes": 11000,
+            "registered_at": "2026-10-24",
+            "derivation": "Measured 10,098 bytes on 2026-10-24 (the concern and the hook stdin reader; node built-ins only). The ceiling is that reading plus about 9 %, rounded, with no growth queued. road-to-a-tick-the-shipped-path-earns 2.4 under decision A9 (council, 2026-10-23): the constraint carrier ships as a lazy chunk with its own ceiling, and the dispatch ceiling is not raised. Its LAZY_CONCERNS row measured +159 bytes in the dispatch bundle (1,553,363 to 1,553,522 B, same gate run on the base and with the row), under the existing 1,554,000 ceiling, so no loader stub raise was needed. Bound on claude `subagent_start` alone; a missing chunk falls back to the spawn path and costs latency, never the digest."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
diff --git a/src/config/hook-token-budget.json b/src/config/hook-token-budget.json
index 6f4103b105..80df5a5518 100644
--- a/src/config/hook-token-budget.json
+++ b/src/config/hook-token-budget.json
@@ -27,6 +27,8 @@
   "reread-guard": 1024,
   "reread-guard_reason": "one advisory line naming the earlier read / ranged alternative (roadmap 6.1)",
   "memory-recall": 768,
+  "subagent-constraints": 4096,
+  "subagent-constraints_reason": "road-to-a-tick-the-shipped-path-earns 2.4: the constraint carrier for a subagent whose definition sets omitClaudeMd. One fire per such subagent start, into the SUBAGENT's context, never the parent turn's: a digest of the project's CLAUDE.md files capped at DIGEST_MAX_BYTES (3,500) in hooks/subagent_constraints_hook.ts, plus the JSON envelope. Silent for every subagent whose definition loads the instruction files.",
   "memory-recall_reason": "ONE memory pointer per fire: the slug, one authored why-now clause, the absolute path, and the memory's OWN frontmatter description, truncated so the emission is provably under this number (`CAP_BYTES` in hooks/memory_recall_hook.ts is the same constant, enforced at emission by buildEmission rather than left to the bench to notice). Registered BELOW the 1024 default deliberately, for the reason `skill-route` gives for its 512: this row is the ceiling that keeps the concern a POINTER. A memory file in this store runs 1.5-6 kB, so a later change that starts injecting bodies fails the build instead of quietly multiplying the hottest slot in the manifest by ten. Measured emission over the four seeded rules on the real store: 356-768 B, one of the four hitting the cap and truncating its description (`hook-latency-gate-has-runner-variance`, whose own description is 517 B).",
   "session-eol": 1024,
   "session-eol_reason": "one recycle-advisory line, once per session past the committed threshold (road-to-token-economy-recycling 3.2); recording itself emits nothing",
@@ -69,9 +71,10 @@
    "session_start",
    "session_end",
    "pre_compact",
-   "agent_error"
+   "agent_error",
+   "subagent_start"
   ],
-  "excluded_slots_rationale": "session_start is excluded BY THE STEP: it is the one-shot restore slot that legitimately carries hot-context, handoff-context and the canary contract, and capping it against a per-turn number would evict exactly the payloads it exists to deliver. The other three are not per-turn events at all.",
+  "excluded_slots_rationale": "session_start is excluded BY THE STEP: it is the one-shot restore slot that legitimately carries hot-context, handoff-context and the canary contract, and capping it against a per-turn number would evict exactly the payloads it exists to deliver. session_end, pre_compact and agent_error are not per-turn events at all. subagent_start (added 2026-10-24, road-to-a-tick-the-shipped-path-earns 2.4) injects into the SUBAGENT's context, not the parent turn's, so charging it to the parent's turn would drop a constraint carrier to pay for bytes the parent never received.",
   "ceiling_bytes": 59392,
   "ceiling_derivation": "NOT a fresh number, and deliberately so: it is the arithmetic consequence of the per_slot_sum_caps_bytes rows already registered above — 16384 + (2048 + 2048) x 10 + 2048. A tighter per-turn ceiling would contradict per-slot rows that are already the committed decision, and a looser one would let the composition exceed what every part was capped at. Tightening it is a decision about those rows, taken there, in a PR.",
   "gate_on_ceiling": false,
diff --git a/src/config/production-entries.json b/src/config/production-entries.json
index f8c69189e8..236b9975f1 100644
--- a/src/config/production-entries.json
+++ b/src/config/production-entries.json
@@ -1,5 +1,5 @@
 {
-  "$comment": "Production entries for check_step_production_reach (road-to-a-tick-the-shipped-path-earns 3.1). `entries` are modules a host or a consumer runs directly. `entry_sources` are files that name runnable scripts by path (`src/scripts/<name>`, with or without `.ts`); every script they name is an entry too. Projected subagent definitions are markdown read by the host, not imported, so they are not entries here: a step about one names its generator with `production entry: <path>`.",
+  "$comment": "Production entries for check_step_production_reach (road-to-a-tick-the-shipped-path-earns 3.1). `entries` are modules a host or a consumer runs directly. `entry_sources` are files that name runnable scripts by path (`src/scripts/<name>`, with or without `.ts`); every script they name is an entry too; the hook manifest is one, because the dispatcher runs every concern it names, a lazily loaded chunk included. Projected subagent definitions are markdown read by the host, not imported, so they are not entries here: a step about one names its generator with `production entry: <path>`.",
   "entries": [
     "src/scripts/hooks/dispatch_hook.ts",
     "src/cli/agent-config.ts",
@@ -7,6 +7,7 @@
   ],
   "entry_sources": [
     "src/scripts/_dispatch.bash",
+    "src/scripts/hook_manifest.yaml",
     "Taskfile.yml",
     "taskfiles/*.yml",
     "hooks/hooks.json",
diff --git a/src/scripts/_lib/claude_settings_hooks.ts b/src/scripts/_lib/claude_settings_hooks.ts
index 871d7b6370..d8ef171783 100644
--- a/src/scripts/_lib/claude_settings_hooks.ts
+++ b/src/scripts/_lib/claude_settings_hooks.ts
@@ -30,6 +30,7 @@
  * (condense.ts) uses for the plugin's hooks/hooks.json.
  */
 
+import { spawnSync } from 'node:child_process';
 import * as fs from 'node:fs';
 import * as path from 'node:path';
 
@@ -89,9 +90,51 @@ export type ClaudeHookMatrix = Record<string, string>;
  * generate_plugin_hooks() uses, so settings-registered hooks and the plugin's
  * hooks.json can never drift from each other.
  */
-export function build_claude_hook_matrix(manifest_path: string): ClaudeHookMatrix {
+/** `2.1.308 (Claude Code)` → `[2, 1, 308]`; null for anything without a leading x.y.z. */
+export function parse_host_version(raw: string | null | undefined): number[] | null {
+    const m = /^\s*(\d+)\.(\d+)\.(\d+)/.exec(raw ?? '');
+    return m === null ? null : [Number(m[1]), Number(m[2]), Number(m[3])];
+}
+
+/** The installed host's `claude --version` line, or null when it cannot be read. */
+export function claude_host_version(): string | null {
+    const res = spawnSync('claude', ['--version'], { encoding: 'utf-8', timeout: 5_000, stdio: ['ignore', 'pipe', 'ignore'] });
+    return res.status === 0 && typeof res.stdout === 'string' && res.stdout.trim() !== '' ? res.stdout.trim() : null;
+}
+
+function _below(have: number[], need: number[]): boolean {
+    for (let i = 0; i < 3; i++) {
+        if ((have[i] ?? 0) !== (need[i] ?? 0)) return (have[i] ?? 0) < (need[i] ?? 0);
+    }
+    return false;
+}
+
+/** Claude native event → the oldest host version recorded as accepting it. */
+export function min_host_versions(manifest_path: string): Record<string, string> {
+    return _gates((_yaml_parse(fs.readFileSync(manifest_path, 'utf8')) ?? {}) as Record<string, unknown>);
+}
+
+function _gates(manifest: Record<string, unknown>): Record<string, string> {
+    const all = (manifest['native_event_min_host_version'] ?? {}) as Record<string, unknown>;
+    const out: Record<string, string> = {};
+    for (const [k, v] of Object.entries((all['claude'] ?? {}) as Record<string, unknown>)) out[k] = String(v);
+    return out;
+}
+
+/**
+ * `hostVersion` is the installed host's `--version` line. A gated event is left
+ * out only when that version is KNOWN to be older than the recorded one; an
+ * unknown version keeps it, because the static plugin `hooks.json` has no host
+ * to ask and the dispatcher treats an unfired event as nothing.
+ */
+export function build_claude_hook_matrix(
+    manifest_path: string,
+    opts: { hostVersion?: string | null } = {},
+): ClaudeHookMatrix {
     const raw = fs.readFileSync(manifest_path, 'utf8');
     const manifest = (_yaml_parse(raw) ?? {}) as Record<string, unknown>;
+    const have = parse_host_version(opts.hostVersion);
+    const gates = _gates(manifest);
     const hook_spec = (manifest['schema_version'] as unknown) ?? 1;
     const platforms = (manifest['platforms'] ?? {}) as Record<string, unknown>;
     const claude_events = ((platforms['claude'] ?? {}) as Record<string, unknown>) || {};
@@ -108,6 +151,8 @@ export function build_claude_hook_matrix(manifest_path: string): ClaudeHookMatri
     const matrix: ClaudeHookMatrix = {};
     for (const [native, ac_raw] of Object.entries(aliases)) {
         const ac_event = String(ac_raw);
+        const need = parse_host_version(gates[native]);
+        if (have !== null && need !== null && _below(have, need)) continue;
         const concerns = claude_events[ac_event];
         if (!concerns || (Array.isArray(concerns) && concerns.length === 0)) continue;
         // Only package-owned dispatchers are trusted (17.0.0 finding
@@ -298,6 +343,7 @@ export interface EnsureResult {
 export function ensure_managed_hooks(
     settings_path: string,
     matrix: ClaudeHookMatrix,
+    withheld: readonly string[] = [],
 ): EnsureResult {
     return _with_lock(settings_path, () => {
         const settings = _read_settings(settings_path);
@@ -317,6 +363,16 @@ export function ensure_managed_hooks(
             hooks[native] = next;
         }
 
+        // A gated event withheld from this host loses an entry an earlier install wrote.
+        for (const native of withheld) {
+            if (native in matrix || !Array.isArray(hooks[native])) continue;
+            const user_groups = (hooks[native] as unknown[]).filter((g) => !_is_managed_group(g));
+            if (user_groups.length === (hooks[native] as unknown[]).length) continue;
+            touched.push(native);
+            if (user_groups.length > 0) hooks[native] = user_groups;
+            else delete hooks[native];
+        }
+
         settings['hooks'] = hooks;
         const after = JSON.stringify(settings);
         if (after === before) {
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index 424d6460eb..e6e63fb19a 100644
--- a/src/scripts/hook_chunks.mjs
+++ b/src/scripts/hook_chunks.mjs
@@ -49,6 +49,12 @@ export const HOOK_CHUNKS = Object.freeze([
         entry: 'src/scripts/hooks/code_graph_refresh_hook.ts',
         outfile: 'dist/hooks/code_graph_refresh.chunk.cjs',
     }),
+    // Bound on `subagent_start` alone; the digest reads instruction files with
+    // node built-ins only.
+    Object.freeze({
+        entry: 'src/scripts/hooks/subagent_constraints_hook.ts',
+        outfile: 'dist/hooks/subagent_constraints.chunk.cjs',
+    }),
     // `yaml` external for the reason given at `chat_history`: the concern
     // reads one user-global settings file with it.
     Object.freeze({
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index e6bf8063f0..a1c716ac24 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1397,6 +1397,20 @@ concerns:
     fail_closed: false
     severity: advisory
     effect: execution
+  # road-to-a-tick-the-shipped-path-earns 2.4 — the constraint carrier for a
+  # subagent whose definition sets `omitClaudeMd`. On SubagentStart it reads the
+  # definition the host runs (project, then user `.claude/agents/<type>.md`)
+  # and, when that definition skips the instruction files, returns a bounded
+  # digest of the project's CLAUDE.md files as `additional_context`, which the
+  # host adds to the subagent's context. Silent for every other subagent.
+  # Claude only: cowork's trampoline discards stdout. Loaded from its own chunk
+  # (decision A9). Kill switch: `AGENT_CONFIG_SUBAGENT_CONSTRAINTS=off`.
+  subagent-constraints:
+    script: src/scripts/hooks/subagent_constraints_hook.ts
+    args: []
+    fail_closed: false
+    severity: advisory
+    effect: context
   subagent-ledger:
     script: src/scripts/hooks/subagent_ledger_hook.ts
     args: []
@@ -1670,7 +1684,7 @@ platforms:
     # road-to-subagent-lifecycle-integrity Phase 1 Step 1. `claude` is the only
     # platform where both native events were measured present on the installed
     # binary (2.1.229 — see the evidence page cited on the alias rows below).
-    subagent_start:   [subagent-ledger, journal-record]
+    subagent_start:   [subagent-ledger, journal-record, subagent-constraints]
     subagent_stop:    [subagent-ledger, journal-record]
     agent_error:      [host-rate-marker]
     # Observe-only; the host runs this event asynchronously, once per loaded file.
@@ -1897,3 +1911,14 @@ native_event_aliases:
     AfterAgent:    stop
     BeforeTool:    pre_tool_use
     AfterTool:     post_tool_use
+
+# The oldest host version recorded as ACCEPTING a native event, per platform.
+# `build_claude_hook_matrix` leaves the event out for a host whose `--version`
+# is known to be older; an unknown version keeps it (the static plugin
+# hooks.json has no host to ask). An event absent here is ungated. The version
+# is the earliest observation in this tree, not the host's first release with
+# the event: lowering it needs a recorded observation on that older version.
+native_event_min_host_version:
+  claude:
+    # StopFailure observed on 2.1.308 (`server_error`); see the alias above.
+    StopFailure: "2.1.308"
diff --git a/src/scripts/hooks/lazy_concern.ts b/src/scripts/hooks/lazy_concern.ts
index 5285b0a09c..055b531c7d 100644
--- a/src/scripts/hooks/lazy_concern.ts
+++ b/src/scripts/hooks/lazy_concern.ts
@@ -76,6 +76,10 @@ export const LAZY_CONCERNS: Readonly<Record<string, { readonly chunk: string; re
             chunk: 'code_graph_refresh.chunk.cjs',
             source: 'code_graph_refresh_hook',
         }),
+        'src/scripts/hooks/subagent_constraints_hook.ts': Object.freeze({
+            chunk: 'subagent_constraints.chunk.cjs',
+            source: 'subagent_constraints_hook',
+        }),
         'src/scripts/update_notice_hook.ts': Object.freeze({
             chunk: 'update_notice.chunk.cjs',
             source: path.join('..', 'update_notice_hook'),
diff --git a/src/scripts/install.ts b/src/scripts/install.ts
index d945055e6d..3716f088d0 100644
--- a/src/scripts/install.ts
+++ b/src/scripts/install.ts
@@ -3058,10 +3058,11 @@ function _deploy_global_content(
         if (tool_id === 'claude-code') {
             try {
                 const manifest = path.join(package_root, 'src', 'scripts', 'hook_manifest.yaml');
-                const matrix = claude_settings_hooks.build_claude_hook_matrix(manifest);
+                const matrix = claude_settings_hooks.build_claude_hook_matrix(manifest, { hostVersion: claude_settings_hooks.claude_host_version() });
                 const res = claude_settings_hooks.ensure_managed_hooks(
                     path.join(anchor, 'settings.json'),
                     matrix,
+                    Object.keys(claude_settings_hooks.min_host_versions(manifest)),
                 );
                 if (!state.QUIET) {
                     if (res.changed) {
```

## Reach check diff

```diff
diff --git a/.github/workflows/rule-backstops.yml b/.github/workflows/rule-backstops.yml
index 015473465d..dfef566b52 100644
--- a/.github/workflows/rule-backstops.yml
+++ b/.github/workflows/rule-backstops.yml
@@ -181,10 +181,11 @@ jobs:
         run: ./scripts-run src/scripts/check_step_receipts --base origin/main
 
       # A tick whose tested code no production entry reaches is a step closed on a
-      # path that never ships. Diff-scoped like the receipts; report-only for one
-      # release, then enforcing.
+      # path that never ships. Diff-scoped like the receipts; enforcing since
+      # road-to-a-tick-the-shipped-path-earns 3.3, after report mode shipped in
+      # 17.1.0 through 17.4.0. A false positive is exempted in its own step block.
       - name: step production reach (a ticked step's tested symbols ship)
-        run: ./scripts-run src/scripts/check_step_production_reach --base origin/main
+        run: ./scripts-run src/scripts/check_step_production_reach --base origin/main --enforce
 
       # A `[~]` carried to a follow-up is validated once, when the parent is
       # archived, by a sweep that then never sees the pair again — so the
diff --git a/src/config/gate-coverage.yml b/src/config/gate-coverage.yml
index e6e3fe71eb..b362911538 100644
--- a/src/config/gate-coverage.yml
+++ b/src/config/gate-coverage.yml
@@ -2820,7 +2820,7 @@ gates:
       `--self-test` (6 cases, 3 rejecting), which builds these shapes.
 
   - id: check_step_production_reach
-    argv: ["--base", "origin/main"]
+    argv: ["--base", "origin/main", "--enforce"]
     min_scanned: 0
     corpus: >
       the roadmap steps a change newly ticks, read from the same base-ref diff as
@@ -2832,8 +2832,12 @@ gates:
       step must RED; a wired symbol, a declared `production entry:` and a
       reworded older tick must stay GREEN. Sensitivity observed: counting an
       export as reached on its declaration alone turns three unit cases red.
-      Report-only for one release (road-to-a-tick-the-shipped-path-earns 3.3);
-      a replay of #2585 lists 15 ticks, the three D2 cases among them.
+      A replay of #2585 lists 15 ticks, the three D2 cases among them.
+      Enforcing since road-to-a-tick-the-shipped-path-earns 3.3: report mode
+      shipped in 17.1.0 through 17.4.0, and its shadow over 17.1.0..17.4.0 read
+      150 ticks with 3 hits (agents/evidence/analysis/
+      reach-shadow-17.1.0-17.4.0-2026-10-24.md). A false positive is exempted
+      per step with `reach exempt: <reason>`, never globally.
     status: enforced
     ci_invocation: .github/workflows/rule-backstops.yml
     no_canary_reason: >-
diff --git a/src/scripts/check_step_production_reach.ts b/src/scripts/check_step_production_reach.ts
index 3b5aceb3b2..d610a2b777 100644
--- a/src/scripts/check_step_production_reach.ts
+++ b/src/scripts/check_step_production_reach.ts
@@ -12,8 +12,10 @@
  *
  * A step whose code is built but not wired stays `[ ]` with `built, not wired`; a
  * ticked step carrying that phrase is refused outright. `production entry: <path>`
- * in the block adds an entry for that step. Report mode exits 0 (3.3: one release
- * of shadow first); `--enforce` exits 1 on a finding.
+ * in the block adds an entry for that step. A false positive is exempted per
+ * step, never globally: `reach exempt: <reason>` in the block, the reason at
+ * least {@link MIN_EXEMPT_REASON} characters. Enforcing since 3.3, after report
+ * mode shipped in 17.1.0 through 17.4.0; without `--enforce` it only reports.
  *
  * Usage:
  *   ./scripts-run src/scripts/check_step_production_reach [--base <ref>] [--head <ref>] [--enforce] [--json]
@@ -120,12 +122,25 @@ export interface Finding {
     readonly reason: string;
 }
 
+export const MIN_EXEMPT_REASON = 12;
+
+/** The reason after `reach exempt:` outside backticks, `''` when bare, undefined when absent. */
+export function reachExemption(block: string): string | undefined {
+    const m = /reach exempt:[ \t]*([^\n]*)/i.exec(block.replace(/`[^`]*`/g, ''));
+    return m === null ? undefined : (m[1] as string).trim();
+}
+
 /** The unreached public symbols this block's tests take from its subjects. */
 export function checkStep(tree: ReachTree, reach: Reach, file: string, step: string, block: string): Finding | null {
     // Quoted, the phrase is talk about the rule; bare, it is the step's own status.
     if (/built, not wired/i.test(block.replace(/`[^`]*`/g, ''))) {
         return { file, step, reason: 'ticked while it says `built, not wired` — such a step stays `[ ]`' };
     }
+    const exempt = reachExemption(block);
+    if (exempt !== undefined) {
+        if (exempt.length >= MIN_EXEMPT_REASON) return null;
+        return { file, step, reason: `\`reach exempt:\` needs a reason of at least ${MIN_EXEMPT_REASON} characters` };
+    }
     const { subjects, tests, entries } = namedPaths(tree, block);
     const r = entries.length ? productionReach(tree, entries) : reach;
     const reached = (key: string, mod: string): boolean =>
@@ -178,7 +193,8 @@ export function run(
             continue;
         }
         const f = checkStep(tree, reach, file, step, block);
-        if (f === null) ledger.complete(target);
+        if (f === null && reachExemption(block) !== undefined) ledger.skip(target, 'declared_exemption');
+        else if (f === null) ledger.complete(target);
         else {
             ledger.fail(target, f.reason);
             findings.push(f);
@@ -208,6 +224,11 @@ function selfTest(): number {
     }
     const declared = '- [x] **1.4 x** `src/lib.ts`, production entry: `src/cli.ts`\n  verify: `tests/lib.test.ts`';
     if (checkStep(tree, reach, 'r.md', '1.4', declared) !== null) failures.push('a declared production entry was not honoured');
+    const exempt = '- [x] **1.5 x** `src/lib.ts`, reach exempt: a maintainer bench, never shipped\n  verify: `tests/lib.test.ts`';
+    if (checkStep(tree, reach, 'r.md', '1.5', exempt) !== null) failures.push('a reasoned per-step exemption was not honoured');
+    if (checkStep(tree, reach, 'r.md', '1.6', '- [x] **1.6 x** `src/lib.ts`, reach exempt: fp\n  verify: `tests/lib.test.ts`') === null) {
+        failures.push('an exemption without a reason did not red');
+    }
     if (checkStep(tree, reach, 'r.md', '1.3', '- [x] **1.3 x** built, not wired') === null) {
         failures.push('a ticked built-not-wired step did not red');
     }
@@ -247,7 +268,7 @@ export function main(argv: readonly string[]): number {
     const enforce = argv.includes('--enforce');
     if (!argv.includes('--json')) {
         for (const f of result.findings) process.stdout.write(`${enforce ? '❌' : '⚠️ '}  ${f.file}: step ${f.step} — ${f.reason}\n`);
-        if (result.findings.length && !enforce) process.stdout.write('   Report only (shadow, step 3.3): nothing is refused yet.\n');
+        if (result.findings.length && !enforce) process.stdout.write('   Report only: run with --enforce to refuse.\n');
     }
     return enforce && result.findings.length ? 1 : 0;
 }
diff --git a/taskfiles/ci-fast.yml b/taskfiles/ci-fast.yml
index aedb0b222e..c7a44d40e7 100644
--- a/taskfiles/ci-fast.yml
+++ b/taskfiles/ci-fast.yml
@@ -903,8 +903,8 @@ tasks:
 
   check-step-production-reach:
     silent: true
-    desc: "Report a roadmap step this diff ticks whose tested symbols no production entry reaches, or that is ticked while it says `built, not wired`. Report-only for one release (road-to-a-tick-the-shipped-path-earns 3.3), enforcing after. Diff-scoped against origin/main"
-    cmd: ./scripts-run src/scripts/check_step_production_reach --base origin/main
+    desc: "Report a roadmap step this diff ticks whose tested symbols no production entry reaches, or that is ticked while it says `built, not wired`. Enforcing since road-to-a-tick-the-shipped-path-earns 3.3; a false positive carries `reach exempt: <reason>` in its own step. Diff-scoped against origin/main"
+    cmd: ./scripts-run src/scripts/check_step_production_reach --base origin/main --enforce
 
   lint-deferral-integrity:
     silent: true
```

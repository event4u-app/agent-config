<!-- evidence-type: analysis -->

# Ratification review — hook-bundle ceiling raise (branch analysis/inbox-2026-11-l)

subject: 5e48a5ca5a7829f54a48c9486dc53a3b52db9d06bf639f16448652180d333545

The line above is the `ratification_subject` digest of the gated content at
revision `4e23005ef4` — `src/config/hook-bundle-budget.json`, the only gated
file in the branch.

The change:

- ceiling 1,562,000 -> 1,567,400 B (`raise_log` entry `from` 1,562,000);
- measured with `check_hook_bundle_composition` on the branch: 1,566,892 B;
  base 1,561,506 B per the previous raise entry;
- growth sources inside the bundle, read from the esbuild metafile:
  `install/agentSwitchProfile.ts` 2,033 B (newly in the closure),
  `_lib/provider_home.ts` 903 B (new), plus the `session_profile` function in
  `_lib/session_register.ts` and the `build_record` change in
  `session_register_hook.ts`.

Questions: (1) does the change expand any authority, permission or
safety-floor reach? (2) is the raise_log entry accurate against the diff?
Answer with findings, then end your reply with exactly one line in this form:

`STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`

## Diff of the gated file and the growth sources against origin/main

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 624c6d74f8..d4a864631a 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1562000,
+    "max_bytes": 1567400,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
@@ -145,6 +145,15 @@
             "what_was_added": "The `code-graph-refresh` row on the `stop` slot of seven platforms in the compiled manifest, and the opt-out marker path in the shared graph-home resolver. Measured 1,561,506 bytes, 1,106 over the 1,560,400 ceiling.",
             "why_it_could_not_be_avoided": "A binding is a manifest row the dispatch bundle carries; the concern body itself stays in its own chunk. The resolver field is the single place a layout path is chosen (check_graph_writers), so the opt-out cannot live elsewhere.",
             "what_would_have_caught_it": "Nothing earlier: the growth is the feature."
+        },
+        {
+            "date": "2026-11-02",
+            "from": 1562000,
+            "to": 1567400,
+            "by": "agent, analysis/inbox-2026-11-l (road-to-the-profile-the-session-runs-in 1.1, 2.1)",
+            "what_was_added": "Profile awareness on the session-register path, which runs on session_start: `session_profile` in `_lib/session_register.ts` (reads only the environment) plus `install/agentSwitchProfile.ts` (2,033 B), newly pulled into the bundle so the profile is parsed by the one existing matching rule rather than a second copy; and `_lib/provider_home.ts` (903 B), the single resolver for `CLAUDE_CONFIG_DIR` / `CODEX_HOME` that `claude_plugin.claude_config_dir` now delegates to. Measured 1,566,892 bytes by the gate, 4,892 over the 1,562,000 ceiling; the base sat at 1,561,506.",
+            "why_it_could_not_be_avoided": "Room was looked for first: `sessions_cli.ts` (16,380 B) rides in through `env_session_id` and `other_worktree_branches_detailed`, but extracting those is an unrelated refactor of two hooks and a CLI; the schema-flag code added to it is tree-shaken because the bundled entry never reaches `cmd_list`. Inlining a reduced agent-switch path match would save about 1.5 KB at the cost of a second matching rule that drifts from the first. The profile must be recorded when the session registers, in the hook, because a later reader runs in another process with another environment.",
+            "what_would_have_caught_it": "Nothing earlier: the growth is the feature. Sized to the measurement plus about 500 bytes of rebuild jitter."
         }
     ],
     "chunks": [
diff --git a/src/scripts/_lib/claude_plugin.ts b/src/scripts/_lib/claude_plugin.ts
index ca14e6b75f..73593375b9 100644
--- a/src/scripts/_lib/claude_plugin.ts
+++ b/src/scripts/_lib/claude_plugin.ts
@@ -13,10 +13,11 @@
  */
 
 import * as fs from 'node:fs';
-import * as os from 'node:os';
 import * as path from 'node:path';
 import process from 'node:process';
 
+import { claudeHome } from './provider_home.js';
+
 export const CLAUDE_PLUGIN_ID = 'agent-config';
 export const CLAUDE_MARKETPLACE_NAME = 'event4u-agent-config';
 export const CLAUDE_MARKETPLACE_REPO = 'event4u-app/agent-config';
@@ -45,8 +46,7 @@ export const CODEX_PLUGIN_INSTALL_HINT: readonly string[] = [
 
 /** Claude Code config dir — `CLAUDE_CONFIG_DIR` env override, else `~/.claude`. */
 export function claude_config_dir(): string {
-    const env = (process.env['CLAUDE_CONFIG_DIR'] ?? '').trim();
-    return env !== '' ? env : path.join(os.homedir(), '.claude');
+    return claudeHome();
 }
 
 /**
diff --git a/src/scripts/_lib/provider_home.ts b/src/scripts/_lib/provider_home.ts
new file mode 100644
index 0000000000..491ceeb05c
--- /dev/null
+++ b/src/scripts/_lib/provider_home.ts
@@ -0,0 +1,103 @@
+/**
+ * The one place that decides where a provider CLI keeps its state for the
+ * session AC runs in (`road-to-the-profile-the-session-runs-in` Phase 1).
+ *
+ * An account profile is nothing more than a different directory behind
+ * `CLAUDE_CONFIG_DIR` / `CODEX_HOME` — whether the account tool set it or the
+ * user did. Every reader of the active session's login, transcripts or sessions
+ * resolves through here, so a profile is honoured everywhere or nowhere.
+ * `check_provider_home_joins` keeps new hardcoded `~/.claude` joins out of the
+ * runtime tree.
+ *
+ * Install targets are deliberately NOT routed here: AC's user scope is written
+ * to the default directories, which are the share source a profile links to.
+ */
+import { createHash } from 'node:crypto';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+export type EnvMap = Readonly<Record<string, string | undefined>>;
+
+export type HomeSource = 'env' | 'default';
+
+export interface ProviderHome {
+    readonly path: string;
+    readonly source: HomeSource;
+}
+
+function envOf(env?: EnvMap | null): EnvMap {
+    return env ?? process.env;
+}
+
+/** `HOME` from the map when injected, else the OS home. */
+export function userHome(env?: EnvMap | null): string {
+    const injected = (envOf(env)['HOME'] ?? '').trim();
+    return injected !== '' ? injected : os.homedir();
+}
+
+function expandTilde(p: string, home: string): string {
+    if (p === '~') return home;
+    if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(home, p.slice(2));
+    return p;
+}
+
+function resolveHome(env: EnvMap | null | undefined, varName: string | null, dirName: string): ProviderHome {
+    const map = envOf(env);
+    const home = userHome(map);
+    const override = varName === null ? '' : (map[varName] ?? '').trim();
+    if (override !== '') return { path: expandTilde(override, home), source: 'env' };
+    return { path: path.join(home, dirName), source: 'default' };
+}
+
+/** Claude Code config dir — `CLAUDE_CONFIG_DIR`, else `~/.claude`. */
+export function claudeHomeInfo(env?: EnvMap | null): ProviderHome {
+    return resolveHome(env, 'CLAUDE_CONFIG_DIR', '.claude');
+}
+
+/** Codex CLI home — `CODEX_HOME`, else `~/.codex`. */
+export function codexHomeInfo(env?: EnvMap | null): ProviderHome {
+    return resolveHome(env, 'CODEX_HOME', '.codex');
+}
+
+/**
+ * Gemini CLI home — always `~/.gemini` for now. `GEMINI_CLI_HOME` is not
+ * evaluated: whether it replaces the home or the `.gemini` directory is an
+ * open spike, and guessing a path formula would report the wrong login.
+ */
+export function geminiHomeInfo(env?: EnvMap | null): ProviderHome {
+    return resolveHome(env, null, '.gemini');
+}
+
+export function claudeHome(env?: EnvMap | null): string {
+    return claudeHomeInfo(env).path;
+}
+
+export function codexHome(env?: EnvMap | null): string {
+    return codexHomeInfo(env).path;
+}
+
+export function geminiHome(env?: EnvMap | null): string {
+    return geminiHomeInfo(env).path;
+}
+
+/** The raw `GEMINI_CLI_HOME` value when set, so doctor can say it is not evaluated. */
+export function geminiCliHomeOverride(env?: EnvMap | null): string | null {
+    const raw = (envOf(env)['GEMINI_CLI_HOME'] ?? '').trim();
+    return raw === '' ? null : raw;
+}
+
+/** Keychain service name Claude Code uses with no config-dir override. */
+export const CLAUDE_KEYCHAIN_SERVICE = 'Claude Code-credentials';
+
+/**
+ * Keychain service Claude Code writes its subscription credential under for
+ * this environment. With `CLAUDE_CONFIG_DIR` set, Claude Code suffixes the
+ * service with the first 8 hex of sha256 over the NFC-normalised RAW variable
+ * — raw, not resolved, because that is the string the CLI hashes.
+ */
+export function claudeKeychainService(env?: EnvMap | null): string {
+    const raw = envOf(env)['CLAUDE_CONFIG_DIR'] ?? '';
+    if (raw.trim() === '') return CLAUDE_KEYCHAIN_SERVICE;
+    const digest = createHash('sha256').update(raw.normalize('NFC'), 'utf8').digest('hex');
+    return `${CLAUDE_KEYCHAIN_SERVICE}-${digest.slice(0, 8)}`;
+}
diff --git a/src/scripts/_lib/session_register.ts b/src/scripts/_lib/session_register.ts
index dbb8056dd3..1d6c0f3295 100644
--- a/src/scripts/_lib/session_register.ts
+++ b/src/scripts/_lib/session_register.ts
@@ -73,6 +73,7 @@
 import fs from 'node:fs';
 import path from 'node:path';
 
+import { detectAgentSwitchProfile } from '../../install/agentSwitchProfile.js';
 import { write_atomic } from './fs_atomic.js';
 import { git_common_dir } from './git_common_dir.js';
 import { type EnvMap, event4u_root } from './user_global_paths.js';
@@ -250,6 +251,54 @@ export interface SessionRecord {
      * unaffected and a diff of two records still shows only what changed.
      */
     owned_paths?: string[];
+    /**
+     * The account profile this session runs under, or absent when none is
+     * detectable.
+     *
+     * Derived from the environment at registration time and nothing else — no
+     * file read, no token, no secret — so an account tool can tell two sessions
+     * under two profiles apart without AC ever touching a profile tree.
+     *
+     * Additive on the same terms as `owned_paths`: a session with no detectable
+     * profile writes the record it wrote before this field existed, byte for byte.
+     */
+    profile?: SessionProfile;
+}
+
+/** Where a session's profile came from, and which one it is. */
+export interface SessionProfile {
+    provider: string;
+    name: string;
+    via: 'agent-switch' | 'env';
+}
+
+/**
+ * The profile implied by `env`, or `null`.
+ *
+ * Order: an agent-switch profile tree wins (`via: 'agent-switch'`); a session
+ * whose env points INTO an agent-switch tree that does not parse to
+ * `<provider>/<name>` gets no profile at all, rather than a basename guessed
+ * from a path the account tool owns. Otherwise a manually set
+ * `CLAUDE_CONFIG_DIR` (then `CODEX_HOME`) names the profile by its directory
+ * basename (`via: 'env'`).
+ */
+export function session_profile(env: NodeJS.ProcessEnv = process.env): SessionProfile | null {
+    const as = detectAgentSwitchProfile(env);
+    if (as.active) {
+        return as.provider !== null && as.profile !== null
+            ? { provider: as.provider, name: as.profile, via: 'agent-switch' }
+            : null;
+    }
+    for (const [provider, key] of [
+        ['claude', 'CLAUDE_CONFIG_DIR'],
+        ['codex', 'CODEX_HOME'],
+    ] as const) {
+        const raw = env[key];
+        if (typeof raw !== 'string' || raw.trim() === '') continue;
+        const name = path.basename(path.resolve(raw.trim()));
+        if (name !== '') return { provider, name, via: 'env' };
+    }
+    return null;
 }
 
 /**
diff --git a/src/scripts/session_register_hook.ts b/src/scripts/session_register_hook.ts
index c9f936a5ef..c68b4f4c11 100644
--- a/src/scripts/session_register_hook.ts
+++ b/src/scripts/session_register_hook.ts
@@ -64,6 +64,7 @@ import {
     global_register_dir,
     register_dir,
     safe_stem,
+    session_profile,
     stop_means_session_end,
     ttl_is_measured,
     ttl_seconds_for,
@@ -559,6 +560,7 @@ export function build_record(
     platform: string,
     started_at: string,
     now: Date = new Date(),
+    env: NodeJS.ProcessEnv = process.env,
 ): SessionRecord {
     const claim = resolve_claim(workspace_root, session_id);
     const rec: SessionRecord = {
@@ -589,6 +591,10 @@ export function build_record(
     if (claim?.paths !== undefined && claim.paths.length > 0) {
         rec.owned_paths = [...claim.paths].sort();
     }
+    // Env-only, and absent leaves the record byte-identical, on the same terms
+    // as the two fields above.
+    const profile = session_profile(env);
+    if (profile !== null) rec.profile = profile;
     return rec;
 }
 
```

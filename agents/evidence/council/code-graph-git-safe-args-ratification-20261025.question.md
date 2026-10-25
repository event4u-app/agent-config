<!-- evidence-type: analysis -->

# Ratification review — git probes that ignore the target checkout's exec config, and the hook-bundle ceiling raise it needs

You are an independent reviewer for a change in the `event4u/agent-config` repository. The change edits `src/config/hook-bundle-budget.json`, a file on the ratification gate's hook-plumbing list, so it needs a two-provider verdict under ADR-268 § 4: an agent may change the hook plumbing but may not ratify its own change.

Subject digest of the gated file at the reviewed commit: `47bdba7785cf448d1677985256c237e69544fef2d3b37ff4b92bf26f6b4c0027` (revision `379f0c03afa1223a3413e75ba607c9c5262fdbf0`, branch `analysis/inbox-2026-10-as`).

## What the change does

1. `src/scripts/_lib/spawn_env.ts` exports `GIT_SAFE_ARGS = ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null']`.
2. All 11 `execFileSync('git', ['-C', root, …])` calls under `src/scripts/code_graph/` (detect.ts ×3, cli.ts ×2, map.ts ×4, estate_manifests.ts ×1, map_answers.ts ×1) now start with `...GIT_SAFE_ARGS`. They already ran under `hardenedSpawnEnv()`, which strips env-borne git config (GIT_CONFIG_*, GIT_*_COMMAND) but not the checkout's own `.git/config`; `git status` and `git diff` against the worktree run a repo-local `core.fsmonitor` command.
3. `tests/scripts/code_graph_git_safe_args.test.ts`: builds a temporary repo whose `.git/config` sets `core.fsmonitor` to a script that writes a marker; (a) plain `git status` creates the marker (the fixture is live); (b) `diffFiles(root, 'HEAD')` from map.ts returns the changed file and does not create it — red before the change, green after; (c) every `execFileSync('git'` line under code_graph/ carries `...GIT_SAFE_ARGS`.
4. `hook-bundle-budget.json`: `max_bytes` 1,554,977 → 1,555,117 with a `raise_log` entry. The code-graph probes run inside bundled concerns, so the bytes land in the dispatch bundle: measured 1,555,110 B with the change, 1,554,970 B on origin/main at `01bb841cbd`, +140 B against 7 B of headroom; the new ceiling is that reading plus the 7 B main had.

Known residual, stated in the code comment: a clean/smudge filter driver set by the checkout is still honoured, because its name is the checkout's choice and cannot be disabled generically. The probes run against the session's own checkout today, whose git already honours that config, so the change is defence-in-depth for auditing a foreign tree.

## What to answer

1. Does the diff contain a defect — in the args, a call site, the test or the budget entry? Name file and line for each.
2. Does the change expand any agent's or hook's authority — what an agent may do or decide, or what a hook may cause?
3. Is the `max_bytes` raise, as recorded, an acceptable resolution, or should room be made instead (name how)?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

Omitted below: the other commits on the branch (skill text, threat corpus rows, roadmaps), which touch no gated file. `git diff origin/main...analysis/inbox-2026-10-as -- src/scripts/_lib/spawn_env.ts src/scripts/code_graph src/config/hook-bundle-budget.json tests/scripts/code_graph_git_safe_args.test.ts` shows the full reviewed part.

## The diff

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 476a279a7d..a16947c737 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -6,3 +6,3 @@
     "review_by": "2027-10-01",
-    "max_bytes": 1554977,
+    "max_bytes": 1555117,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
@@ -93,2 +93,10 @@
             "why_it_could_not_be_avoided": "Five ratification rounds removed every cheaper design: a block-only reader that parsed less than the whole layer, and a per-layer skip that judged on one read and resolved on another, were both refused, and the read-once-per-path reduction the last refusal asked for is part of these bytes. Inlining the function into its only caller was measured and saves 67 B, still 55 B over, at the cost of a deeper body. The change removes about 16 ms cold and 6.6 ms warm from every hook event on an installed project."
+        },
+        {
+            "date": "2026-10-25",
+            "from": 1554977,
+            "to": 1555117,
+            "by": "agent, analysis/inbox-2026-10-as (road-to-security-answer-that-names-what-it-checked 1.1)",
+            "what_was_added": "GIT_SAFE_ARGS (`-c core.fsmonitor=false -c core.hooksPath=/dev/null`) in _lib/spawn_env.ts and its spread into all 11 `execFileSync('git', …)` calls under src/scripts/code_graph/. hardenedSpawnEnv() strips env-borne git config but not the target checkout's own .git/config, so `git status` (detect.ts) and `git diff` against the worktree (map.ts diffFiles) ran a repo-local core.fsmonitor command; tests/scripts/code_graph_git_safe_args.test.ts reproduces it red without the flag. Measured with the change: 1,555,110 B; origin/main at 01bb841cbd: 1,554,970 B, so the change adds 140 B against 7 B of headroom. The new ceiling is that reading plus exactly the 7 B main had.",
+            "why_it_could_not_be_avoided": "The probes run inside bundled concerns (code-graph context at PreToolUse and stop), so the fix has to live in the dispatch bundle. Patching only the two calls that reach fsmonitor today saves about 45 B and leaves nine bare calls a later edit could turn into the same defect; the test pins all eleven instead. An env-based GIT_CONFIG_COUNT injection inside hardenedSpawnEnv costs about the same bytes and changes the environment of every non-git child too."
         }
diff --git a/src/scripts/_lib/spawn_env.ts b/src/scripts/_lib/spawn_env.ts
index a46f406f2d..3a7ad9fe97 100644
--- a/src/scripts/_lib/spawn_env.ts
+++ b/src/scripts/_lib/spawn_env.ts
@@ -112,2 +112,12 @@ function isDeniedByFamily(name: string): boolean {
  */
+/**
+ * Leading git arguments for a read-only probe of a checkout this process did not
+ * create. `hardenedSpawnEnv()` strips env-borne config; these disable the exec
+ * keys the checkout's own `.git/config` can set — `core.fsmonitor` runs on
+ * `git status` and on a `git diff` against the worktree. A clean/smudge filter
+ * driver is still honoured: its name is the checkout's choice, so it cannot be
+ * named here.
+ */
+export const GIT_SAFE_ARGS: readonly string[] = ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null'];
+
 export function hardenedSpawnEnv(
diff --git a/src/scripts/code_graph/cli.ts b/src/scripts/code_graph/cli.ts
index 46fc7a60da..896a119cee 100644
--- a/src/scripts/code_graph/cli.ts
+++ b/src/scripts/code_graph/cli.ts
@@ -92,3 +92,3 @@ import { fileURLToPath } from 'node:url';
 import { resolve_project_root } from '../_lib/agent_settings.js';
-import { hardenedSpawnEnv } from '../_lib/spawn_env.js';
+import { GIT_SAFE_ARGS, hardenedSpawnEnv } from '../_lib/spawn_env.js';
 import { buildFromRepo, discoverFiles, isTestFile, sidecarPath } from './build.js';
@@ -388,3 +388,3 @@ export function changedFiles(root: string, ref: string): string[] | null {
     try {
-        return execFileSync('git', ['-C', root, 'diff', '--name-only', `${ref}..HEAD`], {
+        return execFileSync('git', [...GIT_SAFE_ARGS, '-C', root, 'diff', '--name-only', `${ref}..HEAD`], {
             env: hardenedSpawnEnv(),
@@ -751,3 +751,3 @@ function git(root: string, ...args: string[]): string | null {
     try {
-        return execFileSync('git', ['-C', root, ...args], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], env: hardenedSpawnEnv() }).trim();
+        return execFileSync('git', [...GIT_SAFE_ARGS, '-C', root, ...args], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], env: hardenedSpawnEnv() }).trim();
     } catch {
diff --git a/src/scripts/code_graph/detect.ts b/src/scripts/code_graph/detect.ts
index 1880889be0..be636c1ddb 100644
--- a/src/scripts/code_graph/detect.ts
+++ b/src/scripts/code_graph/detect.ts
@@ -20,3 +20,3 @@ import * as path from 'node:path';
 import { load_agent_settings } from '../_lib/agent_settings.js';
-import { hardenedSpawnEnv } from '../_lib/spawn_env.js';
+import { GIT_SAFE_ARGS, hardenedSpawnEnv } from '../_lib/spawn_env.js';
 import { projectHome } from './graph_home.js';
@@ -78,3 +78,3 @@ function gitLastCommitEpoch(root: string): number | null {
     try {
-        const out = execFileSync('git', ['-C', root, 'log', '-1', '--format=%ct'], {
+        const out = execFileSync('git', [...GIT_SAFE_ARGS, '-C', root, 'log', '-1', '--format=%ct'], {
             env: hardenedSpawnEnv(),
@@ -92,3 +92,3 @@ function commitsBehind(root: string, sha: string): number | null {
     try {
-        const out = execFileSync('git', ['-C', root, 'rev-list', '--count', `${sha}..HEAD`], {
+        const out = execFileSync('git', [...GIT_SAFE_ARGS, '-C', root, 'rev-list', '--count', `${sha}..HEAD`], {
             env: hardenedSpawnEnv(),
@@ -279,3 +279,3 @@ function hasUncommittedIndexedEdit(root: string): boolean {
     try {
-        out = execFileSync('git', ['-C', root, 'status', '--porcelain', '--untracked-files=all'], {
+        out = execFileSync('git', [...GIT_SAFE_ARGS, '-C', root, 'status', '--porcelain', '--untracked-files=all'], {
             env: hardenedSpawnEnv(),
diff --git a/src/scripts/code_graph/estate_manifests.ts b/src/scripts/code_graph/estate_manifests.ts
index 38eeeb628d..4c517ebfd2 100644
--- a/src/scripts/code_graph/estate_manifests.ts
+++ b/src/scripts/code_graph/estate_manifests.ts
@@ -11,3 +11,3 @@ import * as path from 'node:path';
 
-import { hardenedSpawnEnv } from '../_lib/spawn_env.js';
+import { GIT_SAFE_ARGS, hardenedSpawnEnv } from '../_lib/spawn_env.js';
 import { MANIFEST_NAME, readProjectProbe, walkedPath } from './build.js';
@@ -182,3 +182,3 @@ function manifestPathsFromGit(root: string): string[] | null {
     try {
-        out = execFileSync('git', ['-C', root, 'ls-files', '-z', '--cached'], {
+        out = execFileSync('git', [...GIT_SAFE_ARGS, '-C', root, 'ls-files', '-z', '--cached'], {
             env: hardenedSpawnEnv(),
diff --git a/src/scripts/code_graph/map.ts b/src/scripts/code_graph/map.ts
index 8df5f32bd2..1a6eea404a 100644
--- a/src/scripts/code_graph/map.ts
+++ b/src/scripts/code_graph/map.ts
@@ -22,3 +22,3 @@ import { fileURLToPath } from 'node:url';
 import { write_atomic } from '../_lib/fs_atomic.js';
-import { hardenedSpawnEnv } from '../_lib/spawn_env.js';
+import { GIT_SAFE_ARGS, hardenedSpawnEnv } from '../_lib/spawn_env.js';
 import { buildFromRepo, readProjectProbe } from './build.js';
@@ -94,3 +94,3 @@ function gitHead(root: string): string {
     try {
-        return execFileSync('git', ['-C', root, 'rev-parse', '--short=12', 'HEAD'], {
+        return execFileSync('git', [...GIT_SAFE_ARGS, '-C', root, 'rev-parse', '--short=12', 'HEAD'], {
             env: hardenedSpawnEnv(),
@@ -180,3 +180,3 @@ function isGitRepo(root: string): boolean {
     try {
-        execFileSync('git', ['-C', root, 'rev-parse', '--is-inside-work-tree'], {
+        execFileSync('git', [...GIT_SAFE_ARGS, '-C', root, 'rev-parse', '--is-inside-work-tree'], {
             env: hardenedSpawnEnv(),
@@ -223,3 +223,3 @@ export function diffFiles(root: string, rev: string): string[] | null {
         const run = (args: string[]): string[] =>
-            execFileSync('git', ['-C', root, ...args], {
+            execFileSync('git', [...GIT_SAFE_ARGS, '-C', root, ...args], {
                 env: hardenedSpawnEnv(),
@@ -443,3 +443,3 @@ function headDate(root: string): string {
     try {
-        return execFileSync('git', ['-C', root, 'log', '-1', '--format=%cs'], {
+        return execFileSync('git', [...GIT_SAFE_ARGS, '-C', root, 'log', '-1', '--format=%cs'], {
             env: hardenedSpawnEnv(),
diff --git a/src/scripts/code_graph/map_answers.ts b/src/scripts/code_graph/map_answers.ts
index 53da7ac4f9..04ec0d68a9 100644
--- a/src/scripts/code_graph/map_answers.ts
+++ b/src/scripts/code_graph/map_answers.ts
@@ -17,3 +17,3 @@ import { parse as parseYaml } from 'yaml';
 
-import { hardenedSpawnEnv } from '../_lib/spawn_env.js';
+import { GIT_SAFE_ARGS, hardenedSpawnEnv } from '../_lib/spawn_env.js';
 import type { FileRole, MapModel } from './map_model.js';
@@ -312,3 +312,3 @@ export function readGitHistory(root: string, days = GIT_WINDOW_DAYS): Map<string
     const git = (args: string[]): string =>
-        execFileSync('git', ['-C', root, ...args], {
+        execFileSync('git', [...GIT_SAFE_ARGS, '-C', root, ...args], {
             env: hardenedSpawnEnv(),
diff --git a/tests/scripts/code_graph_git_safe_args.test.ts b/tests/scripts/code_graph_git_safe_args.test.ts
new file mode 100644
index 0000000000..401a7a31d5
--- /dev/null
+++ b/tests/scripts/code_graph_git_safe_args.test.ts
@@ -0,0 +1,70 @@
+/**
+ * The code-graph's git probes must not run exec config from the TARGET
+ * checkout's own `.git/config`. `hardenedSpawnEnv()` strips env-borne config
+ * only; `core.fsmonitor` set in the repository still runs on `git status` /
+ * `git diff`, so every call carries `-c core.fsmonitor=false`.
+ */
+import { execFileSync } from 'node:child_process';
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+import { afterEach, describe, expect, it } from 'vitest';
+
+import { GIT_SAFE_ARGS } from '../../src/scripts/_lib/spawn_env.js';
+import { diffFiles } from '../../src/scripts/code_graph/map.js';
+
+const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
+const CODE_GRAPH = path.join(REPO, 'src', 'scripts', 'code_graph');
+
+const tmp: string[] = [];
+afterEach(() => {
+    for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
+});
+
+function hostileRepo(): { root: string; marker: string } {
+    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-fsmonitor-'));
+    tmp.push(root);
+    const marker = path.join(root, '..', `${path.basename(root)}.marker`);
+    tmp.push(marker);
+    const git = (...a: string[]) => execFileSync('git', ['-C', root, ...a], { stdio: 'ignore' });
+    git('init', '-q');
+    git('config', 'user.email', 't@example.com');
+    git('config', 'user.name', 't');
+    fs.writeFileSync(path.join(root, 'a.txt'), 'x\n');
+    git('add', 'a.txt');
+    git('commit', '-qm', 'init');
+    const hook = path.join(root, '.git', 'fsm.sh');
+    fs.writeFileSync(hook, `#!/bin/sh\ntouch '${marker}'\n`, { mode: 0o755 });
+    git('config', 'core.fsmonitor', hook);
+    fs.writeFileSync(path.join(root, 'a.txt'), 'y\n');
+    return { root, marker };
+}
+
+describe('code-graph git probes ignore repo-local exec config', () => {
+    it('the fixture is live: plain git status runs the fsmonitor hook', () => {
+        const { root, marker } = hostileRepo();
+        execFileSync('git', ['-C', root, 'status', '--porcelain'], { stdio: 'ignore' });
+        expect(fs.existsSync(marker)).toBe(true);
+    });
+
+    it('diffFiles against a hostile checkout does not run the hook', () => {
+        const { root, marker } = hostileRepo();
+        expect(diffFiles(root, 'HEAD')).toEqual(['a.txt']);
+        expect(fs.existsSync(marker)).toBe(false);
+    });
+
+    it('every execFileSync git call under code_graph/ carries GIT_SAFE_ARGS', () => {
+        expect(GIT_SAFE_ARGS).toContain('core.fsmonitor=false');
+        const bare: string[] = [];
+        for (const f of fs.readdirSync(CODE_GRAPH)) {
+            if (!f.endsWith('.ts')) continue;
+            const lines = fs.readFileSync(path.join(CODE_GRAPH, f), 'utf-8').split('\n');
+            lines.forEach((l, i) => {
+                if (/execFileSync\(\s*['"]git['"]/.test(l) && !l.includes('...GIT_SAFE_ARGS')) bare.push(`${f}:${i + 1}`);
+            });
+        }
+        expect(bare).toEqual([]);
+    });
+});
```

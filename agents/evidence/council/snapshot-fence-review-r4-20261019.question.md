<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-19 for branch
     drain/road-to-a-canvas-the-code-owns-snapshot-fence-20261018, round 4,
     committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-a-canvas-the-code-owns-snapshot-fence-20261018, round 4 — a snapshot fence in block_config_weakening

This is a ratification review under ADR-268 § 4 for a diff touching a governance hook. Please review the complete diff below and return findings.

Context, from the tree:

- `src/scripts/hooks/block_config_weakening.ts` is a PreToolUse governance hook. Before this change, a call whose tool is not in `EDIT_TOOLS` returned `EXIT_ALLOW` at once; only edit-tool calls reached the path loop, where `allowlist` and `class-c` paths can block. Shell tools never reached the path loop.
- Roadmap step 7.1: snapshot directories (`*-snapshots/`, `__screenshots__/`) are `advisory`; a shell call running a visual runner with `--update-snapshots` warns with the acceptance step; warn, never block.
- Round 1 found two downgrades (snapshot classification before class-C; command check before path decisions); both were fixed. Round 2 asked that the shell check stop depending on shell and edit tools being disjoint, for a test pinning that, and noted `--update-snapshots=false` matched; all three were addressed. Round 3 (2/2 REQUEST_CHANGES) found that a path classified `advisory` skipped the entry-count and decide steps every other path runs.
- What changed after round 3: an advisory snapshot path now runs every existing check exactly as a non-snapshot path does; only the warning is added after the loop. The branch has since been merged with current `main`; the hook delta against `main` is the diff below and nothing else in `src/` changed.

Measured at the head: the hook's test file passes; subject digest `1a4e2199ae0bbcb19fc3056ee1f87d76afe19bb43d081c7c71b4428d12531338` (covers only the hook).

Questions:

1. Does any input that this hook blocked before this diff now reach WARN or ALLOW? Name the input if so.
2. Does any input that this hook allowed before this diff now block?
3. Classify the change: `ratified` (authority-expanding but acceptable), `confirmed-non-expanding` (governance surface touched, no expansion of what the agent may do), or `request-changes` (with the concrete defect).

Complete diff, `git diff origin/main...HEAD -- src/scripts/hooks/block_config_weakening.ts`:

```diff
diff --git a/src/scripts/hooks/block_config_weakening.ts b/src/scripts/hooks/block_config_weakening.ts
index 32ea4e8c9..4a6ca8c57 100644
--- a/src/scripts/hooks/block_config_weakening.ts
+++ b/src/scripts/hooks/block_config_weakening.ts
@@ -137,6 +137,21 @@ const CLASS_C_BASENAMES: readonly string[] = ['.agent-settings.yml', '.agent-set
 /** Where the class contract lives, relative to the package root. */
 export const SETTINGS_CLASSES_RELATIVE = 'docs/contracts/settings-classes.md';
 
+/** Visual baselines: accepted by a human, never by the run that produced them. */
+const SNAPSHOT_DIR = /(^|\/)([^/]+-snapshots|__screenshots__)\//;
+
+const SNAPSHOT_ACCEPTANCE =
+    'baseline update: show the image diff to the user and land the new baselines in a commit of its own, on the pinned renderer.';
+/** Shell tools only: an edit payload carrying a `command` field must never pre-empt a path decision. */
+const SHELL_TOOL = /^(bash|bashtool|shell|launch[-_]process)$/i;
+
+/** A visual-runner baseline update, answered with the acceptance step. Warn only. */
+export function snapshotUpdateWarning(tool: string, command: unknown): string | null {
+    if (!SHELL_TOOL.test(tool) || typeof command !== 'string') return null;
+    if (!/--update-snapshots(?=\s|$)/.test(command) || !/\b(playwright|test-storybook)\b/.test(command)) return null;
+    return SNAPSHOT_ACCEPTANCE;
+}
+
 /** Classify a target path into a config surface, or null for everything else. */
 export function classify_target(p: string): ConfigKind {
     const posix = p.split(path.sep).join('/');
@@ -159,7 +174,8 @@ export function classify_target(p: string): ConfigKind {
     if (CLASS_C_BASENAMES.includes(base)) {
         return 'class-c';
     }
-    return null;
+    // Last, so a blocking class above is never downgraded by its directory.
+    return SNAPSHOT_DIR.test(posix) ? 'advisory' : null;
 }
 
 /**
@@ -595,7 +611,12 @@ export function main(): number {
 
     const { tool, paths, ti } = _extract(envelope);
     if (!tool || !EDIT_TOOLS.has(tool) || ti === null) {
-        return EXIT_ALLOW;
+        // Reached only by a call that was ALLOW before this branch existed, so the
+        // shell warning can never stand in for a path decision.
+        const snap = EDIT_TOOLS.has(tool) ? null : snapshotUpdateWarning(tool, ti?.['command']);
+        if (snap === null) return EXIT_ALLOW;
+        process.stdout.write(`${JSON.stringify({ decision: 'warn', reason: snap })}\n`);
+        return EXIT_WARN;
     }
 
     const cwd = envelope['cwd'];
@@ -604,6 +625,7 @@ export function main(): number {
     const sidRaw = envelope['session_id'] ?? envelope['sessionId'];
     const session = typeof sidRaw === 'string' && sidRaw ? sidRaw : 'default';
 
+    let snapWarn: string | null = null;
     for (const p of paths) {
         const kind = classify_target(p);
         if (kind === null) {
@@ -625,6 +647,9 @@ export function main(): number {
             return EXIT_BLOCK;
         }
 
+        // A snapshot path still runs every check below; only its warning text is deferred.
+        const isSnap = kind === 'advisory' && SNAPSHOT_DIR.test(p.split(path.sep).join('/'));
+        if (isSnap) snapWarn = `${path.relative(root, abs) || p}: ${SNAPSHOT_ACCEPTANCE}`;
         const added = added_entries(ti, on_disk);
         if (added <= 0) {
             continue;
@@ -636,11 +661,15 @@ export function main(): number {
             process.stderr.write(`block-config-weakening: BLOCKED — ${d.reason}\n`);
             return EXIT_BLOCK;
         }
-        if (d.action === 'warn') {
+        if (d.action === 'warn' && !isSnap) {
             process.stdout.write(`${JSON.stringify({ decision: 'warn', reason: d.reason })}\n`);
             return EXIT_WARN;
         }
     }
+    if (snapWarn !== null) {
+        process.stdout.write(`${JSON.stringify({ decision: 'warn', reason: snapWarn })}\n`);
+        return EXIT_WARN;
+    }
     return EXIT_ALLOW;
 }
 
```

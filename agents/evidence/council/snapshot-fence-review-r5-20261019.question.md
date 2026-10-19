<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-19 for branch
     drain/road-to-a-canvas-the-code-owns-snapshot-fence-20261018, round 5,
     committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-a-canvas-the-code-owns-snapshot-fence-20261018, round 5 — a snapshot fence in block_config_weakening

This is a ratification review under ADR-268 § 4 for a diff touching a governance hook. Please review the complete diff below and return findings.

Context, from the tree:

- `src/scripts/hooks/block_config_weakening.ts` is a PreToolUse governance hook. Before this change, a call whose tool is not in `EDIT_TOOLS` returned `EXIT_ALLOW` at once; only edit-tool calls reached the path loop, where `allowlist` and `class-c` paths can block.
- Roadmap step 7.1: snapshot directories (`*-snapshots/`, `__screenshots__/`) are `advisory`; a shell call running a visual runner with `--update-snapshots` warns with the acceptance step; warn, never block.
- Round 4 (`agents/evidence/council/snapshot-fence-review-r4-20261019.question.md`): one seat `confirmed-non-expanding`, one seat `request-changes` with two points.
  - (a) The shell warning was still discarded when a shell name is also in `EDIT_TOOLS`. Changed: the warning is now computed for every tool (`cmdWarn`) and deferred — emitted on the early ALLOW branch, or after the path loop as the initial value of `snapWarn`, so any path block returns first. `main()` now reads stdin and delegates to `evaluate(envelope, editTools = EDIT_TOOLS)`; the parameter exists so a test can create the overlap. A new test adds `Bash` to a copy of the edit-tool set and asserts (i) a command-only call warns (exit 2) and (ii) the same call carrying an allowlist write over the session cap blocks (exit 1). With the old initialisation (`snapWarn = null`) the test fails with `expected 0 to be 2`.
  - (b) Snapshot paths that previously classified `null` now enter `added_entries()` and `decide()`; could they block? The unchanged `decide()` in the tree, verbatim for the relevant part:

```ts
export function decide(kind: ConfigKind, rel_path: string, session_total: number, added: number): Decision {
    if (kind === null || added <= 0) {
        return { action: 'allow', reason: '' };
    }
    if (kind === 'advisory') {
        return { action: 'warn', reason: `${rel_path}: this edit loosens a gate threshold. ...` };
    }
    if (session_total > SESSION_ENTRY_CAP) { return { action: 'block', ... }; }
```

  and in the loop `const total = kind === 'allowlist' ? bump_session(...) : added;`. A snapshot path is only ever `advisory` (classification is last in `classify_target`, after `class-c` and `allowlist`), so its `decide()` result is `allow` or `warn`; its `warn` is suppressed in favour of the deferred snapshot warning.

Measured at the head: 59 tests pass in the hook's test file; hook bundle 1,546,004 B of 1,550,000 B; subject digest `e53a9dc304ae402b1c66d9442c0d625a075c0f7e37f69883f215a77d1fce9c40` (covers only the hook).

Questions:

1. Does any input that this hook blocked before this diff now reach WARN or ALLOW? Name the input if so.
2. Does any input that this hook allowed before this diff now block?
3. Classify the change: `ratified` (authority-expanding but acceptable), `confirmed-non-expanding` (governance surface touched, no expansion of what the agent may do), or `request-changes` (with the concrete defect).

Complete diff, `git diff origin/main...HEAD -- src/scripts/hooks/block_config_weakening.ts`:

```diff
diff --git a/src/scripts/hooks/block_config_weakening.ts b/src/scripts/hooks/block_config_weakening.ts
index 32ea4e8c9..5e0732c13 100644
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
@@ -592,10 +608,19 @@ export function main(): number {
     if (!_isObject(envelope)) {
         return EXIT_ALLOW;
     }
+    return evaluate(envelope);
+}
 
+/** The decision for one envelope; `editTools` is a parameter only so a test can make a shell name overlap it. */
+export function evaluate(envelope: JsonObject, editTools: ReadonlySet<string> = EDIT_TOOLS): number {
     const { tool, paths, ti } = _extract(envelope);
-    if (!tool || !EDIT_TOOLS.has(tool) || ti === null) {
-        return EXIT_ALLOW;
+    // Computed for every tool and emitted only where no path decision is left,
+    // so a shell name that is also an edit tool still warns and never pre-empts a block.
+    const cmdWarn = snapshotUpdateWarning(tool, ti?.['command']);
+    if (!tool || !editTools.has(tool) || ti === null) {
+        if (cmdWarn === null) return EXIT_ALLOW;
+        process.stdout.write(`${JSON.stringify({ decision: 'warn', reason: cmdWarn })}\n`);
+        return EXIT_WARN;
     }
 
     const cwd = envelope['cwd'];
@@ -604,6 +629,7 @@ export function main(): number {
     const sidRaw = envelope['session_id'] ?? envelope['sessionId'];
     const session = typeof sidRaw === 'string' && sidRaw ? sidRaw : 'default';
 
+    let snapWarn: string | null = cmdWarn;
     for (const p of paths) {
         const kind = classify_target(p);
         if (kind === null) {
@@ -625,6 +651,9 @@ export function main(): number {
             return EXIT_BLOCK;
         }
 
+        // A snapshot path still runs every check below; only its warning text is deferred.
+        const isSnap = kind === 'advisory' && SNAPSHOT_DIR.test(p.split(path.sep).join('/'));
+        if (isSnap) snapWarn = `${path.relative(root, abs) || p}: ${SNAPSHOT_ACCEPTANCE}`;
         const added = added_entries(ti, on_disk);
         if (added <= 0) {
             continue;
@@ -636,11 +665,15 @@ export function main(): number {
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

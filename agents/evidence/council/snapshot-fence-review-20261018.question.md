<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch
     drain/road-to-a-canvas-the-code-owns-snapshot-fence-20261018, round 1,
     committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-a-canvas-the-code-owns-snapshot-fence-20261018, round 1 — a snapshot fence in block_config_weakening

Context, from the tree:

- `src/scripts/hooks/block_config_weakening.ts` is a PreToolUse governance hook (`fail_closed: false`, `effect: permission`). It classifies a target path as `allowlist` (blocks past a per-session cap), `advisory` (warns, exit 2, never blocks), `class-c` (blocks a guarded settings key) or null. Its own header records the council decision of 2026-08-02 that baselines and budgets warn and never block.
- Roadmap step 7.1 of `road-to-a-canvas-the-code-owns` asks: `classify_target` returns `advisory` for `*-snapshots/**` and `__screenshots__/**`; a Bash call carrying `--update-snapshots` on a visual runner warns with the acceptance step; warn, never block; measure the hook bundle before and after.
- The ratification gate classes the hook as a governance surface, so this change carries its own record. The gate's subject digest at commit `c20fbef0f` is `20d8f4ac66a893fe45d8f7090bf93df53dd4e73da9a4e6647d6ff3b653840277`, covering only `src/scripts/hooks/block_config_weakening.ts`.

The change:

- a `SNAPSHOT_DIR` pattern and an exported `snapshotUpdateWarning(command)` that returns a warning only when the command carries `--update-snapshots` AND names `playwright` or `test-storybook`;
- `classify_target` returns `advisory` for a path inside a `*-snapshots/` or `__screenshots__/` directory;
- `main()` checks `tool_input.command` first and returns `EXIT_WARN` with the acceptance step when the warning applies; for an edit-tool write into a snapshot directory it counts one added entry so the existing `advisory` branch of `decide` warns.

Measured at `c20fbef0f`: the hook's test file passes (56 tests, three new ones under `-t snapshot`, seen red before the implementation); the composed hook bundle went from 1,547,451 to 1,548,120 B against a 1,550,000 B ceiling. The branch is stacked on PR #2470 (which carries the rest of the roadmap and no change to this hook); `git diff drain/road-to-a-canvas-the-code-owns-20261018...drain/road-to-a-canvas-the-code-owns-snapshot-fence-20261018` shows this change alone.

Review the diff below. For each defect report file:line, the failure scenario and a severity. Questions a review should answer include: whether any path or command that warns today could now be allowed or blocked differently (an authority change in either direction); whether the early `command` check can pre-empt a block the hook would otherwise issue; whether the warning wording reaching an edit-tool snapshot write is accurate; and whether the change expands what the hook may do. State your stance (APPROVE or REQUEST_CHANGES), whether it is authority-expanding or non-expanding, and the single highest-leverage change.

```diff
diff --git a/src/scripts/hooks/block_config_weakening.ts b/src/scripts/hooks/block_config_weakening.ts
index 32ea4e8c9..74af0000d 100644
--- a/src/scripts/hooks/block_config_weakening.ts
+++ b/src/scripts/hooks/block_config_weakening.ts
@@ -137,6 +137,15 @@ const CLASS_C_BASENAMES: readonly string[] = ['.agent-settings.yml', '.agent-set
 /** Where the class contract lives, relative to the package root. */
 export const SETTINGS_CLASSES_RELATIVE = 'docs/contracts/settings-classes.md';
 
+/** Visual baselines: accepted by a human, never by the run that produced them. */
+const SNAPSHOT_DIR = /(^|\/)([^/]+-snapshots|__screenshots__)\//;
+
+/** A visual-runner baseline update, answered with the acceptance step. Warn only. */
+export function snapshotUpdateWarning(command: string): string | null {
+    if (!/--update-snapshots\b/.test(command) || !/\b(playwright|test-storybook)\b/.test(command)) return null;
+    return 'baseline update: show the image diff to the user and land the new baselines in a commit of its own, on the pinned renderer.';
+}
+
 /** Classify a target path into a config surface, or null for everything else. */
 export function classify_target(p: string): ConfigKind {
     const posix = p.split(path.sep).join('/');
@@ -147,7 +156,7 @@ export function classify_target(p: string): ConfigKind {
     if (/(^|-)baselines?\.json$/.test(base)) {
         return 'advisory';
     }
-    if (/-budget(s)?\.(json|ya?ml)$/.test(base) || base === 'budgets.yml') {
+    if (/-budget(s)?\.(json|ya?ml)$/.test(base) || base === 'budgets.yml' || SNAPSHOT_DIR.test(posix)) {
         return 'advisory';
     }
     // `settings.json` only under a host directory: the bare name is common
@@ -594,6 +603,11 @@ export function main(): number {
     }
 
     const { tool, paths, ti } = _extract(envelope);
+    const snap = typeof ti?.['command'] === 'string' ? snapshotUpdateWarning(ti['command']) : null;
+    if (snap !== null) {
+        process.stdout.write(`${JSON.stringify({ decision: 'warn', reason: snap })}\n`);
+        return EXIT_WARN;
+    }
     if (!tool || !EDIT_TOOLS.has(tool) || ti === null) {
         return EXIT_ALLOW;
     }
@@ -625,7 +639,7 @@ export function main(): number {
             return EXIT_BLOCK;
         }
 
-        const added = added_entries(ti, on_disk);
+        const added = SNAPSHOT_DIR.test(p.split(path.sep).join('/')) ? 1 : added_entries(ti, on_disk);
         if (added <= 0) {
             continue;
         }
```

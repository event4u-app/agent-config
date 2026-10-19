<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch
     drain/road-to-a-canvas-the-code-owns-snapshot-fence-20261018, round 2,
     committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-a-canvas-the-code-owns-snapshot-fence-20261018, round 2 — a snapshot fence in block_config_weakening

Context, from the tree:

- `src/scripts/hooks/block_config_weakening.ts` is a PreToolUse governance hook (`fail_closed: false`, `effect: permission`). It classifies a target path as `allowlist` (blocks past a per-session cap), `advisory` (warns, exit 2, never blocks), `class-c` (blocks a guarded settings key) or null. Its header records the council decision of 2026-08-02 that baselines and budgets warn and never block.
- Roadmap step 7.1 of `road-to-a-canvas-the-code-owns`: `classify_target` returns `advisory` for `*-snapshots/**` and `__screenshots__/**`; a Bash call carrying `--update-snapshots` on a visual runner warns with the acceptance step; warn, never block.
- Round 1 (prompt: `agents/evidence/council/snapshot-fence-review-20261018.question.md`) reached one seat; `anthropic` timed out. `openai` requested changes and classed the round-1 diff authority-expanding for two reasons: (1) the snapshot directory was tested before the class-C basenames, so `component-snapshots/.agent-settings.yml` went from blocked to advisory; (2) a `command` check ran before the path loop for any tool, so an edit payload carrying a matching `command` field returned a warn without its paths being judged. It also named the constant `added = 1` as an inaccurate reuse of the entry-count path whose warning text spoke of thresholds, and asked for monotonicity tests.

What changed in response, at the head below:

- the snapshot test is the LAST step of `classify_target`, after allowlist, baselines, budgets, host `settings.json` and the class-C basenames;
- `snapshotUpdateWarning(tool, command)` returns a warning only for a shell tool (`bash`, `bashtool`, `shell`, `launch-process` / `launch_process`, case-insensitive) — an edit tool carrying a `command` field gets null and proceeds to the path checks;
- a snapshot write no longer fakes an entry count: inside the path loop it records the acceptance-step warning and `continue`s, and that warning is emitted only after every path in the envelope has been judged, so an allowlist or class-C path in the same envelope still blocks first;
- new tests: class-C and allowlist files inside both snapshot-directory forms keep their class; `Edit`/`Write` with a matching `command` return null; the hook process run end to end returns exit 2 with the acceptance step for a snapshot write and for a shell update, and exit 0 for `npx playwright test` without the flag. A sensitivity probe removing the shell-tool restriction turned one of them red.

Measured at the head: the hook's test file passes (57 tests); the composed hook bundle is 1,548,578 B against a 1,550,000 B ceiling (1,547,451 B before the change). The ratification gate's subject digest is `dc7d97f5e2af4e1d2015bb61c175dc500850e199c731fe88afc5c852f8618b96`, covering only `src/scripts/hooks/block_config_weakening.ts`. The branch is stacked on PR #2470, which carries no change to this hook; `git diff drain/road-to-a-canvas-the-code-owns-20261018...drain/road-to-a-canvas-the-code-owns-snapshot-fence-20261018 -- src/scripts/hooks/block_config_weakening.ts` shows the diff below.

Review the diff. For each defect report file:line, the failure scenario and a severity. Questions a review should answer include: whether any path, payload or command that blocked before this diff can now warn or pass (in either direction, any authority change); whether the round-1 findings are resolved; whether a shell-tool name used by a supported host is missing from the restriction in a way that weakens anything; and whether the change is authority-expanding or non-expanding. State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

```diff
diff --git a/src/scripts/hooks/block_config_weakening.ts b/src/scripts/hooks/block_config_weakening.ts
index 32ea4e8c9..3c63bfb22 100644
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
+    if (!/--update-snapshots\b/.test(command) || !/\b(playwright|test-storybook)\b/.test(command)) return null;
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
@@ -594,6 +610,11 @@ export function main(): number {
     }
 
     const { tool, paths, ti } = _extract(envelope);
+    const snap = snapshotUpdateWarning(tool, ti?.['command']);
+    if (snap !== null) {
+        process.stdout.write(`${JSON.stringify({ decision: 'warn', reason: snap })}\n`);
+        return EXIT_WARN;
+    }
     if (!tool || !EDIT_TOOLS.has(tool) || ti === null) {
         return EXIT_ALLOW;
     }
@@ -604,6 +625,7 @@ export function main(): number {
     const sidRaw = envelope['session_id'] ?? envelope['sessionId'];
     const session = typeof sidRaw === 'string' && sidRaw ? sidRaw : 'default';
 
+    let snapWarn: string | null = null;
     for (const p of paths) {
         const kind = classify_target(p);
         if (kind === null) {
@@ -625,6 +647,10 @@ export function main(): number {
             return EXIT_BLOCK;
         }
 
+        if (kind === 'advisory' && SNAPSHOT_DIR.test(p.split(path.sep).join('/'))) {
+            snapWarn = `${path.relative(root, abs) || p}: ${SNAPSHOT_ACCEPTANCE}`;
+            continue;
+        }
         const added = added_entries(ti, on_disk);
         if (added <= 0) {
             continue;
@@ -641,6 +667,10 @@ export function main(): number {
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

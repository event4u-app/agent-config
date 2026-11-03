<!-- evidence-type: analysis -->

# Ratification review — hook-bundle ceiling raise (branch docs/game-roadmap-owner-answers)

subject: 8d87be4c607a40ec38a2a0f869b479437309d2e64dbb4e716169a7a60b51db51

The line above is the `ratification_subject` digest of the gated content at
revision `b6c0a429ef` — `src/config/hook-bundle-budget.json`, the only gated
file in the branch.

The change:

- ceiling 1,581,000 -> 1,581,900 B (`raise_log` entry `from` 1,581,000);
- measured with `check_hook_bundle_composition` on origin/main at
  `1ac7eebe04` with a real `npm ci` install: 1,581,318 B; the Consistency
  workflow on main for that commit fails the same gate with the same figure;
- the branch's only other change is a roadmap markdown file outside the bundle;
- the growth on main since the last raise is #2816 (feat/web-launch-write-time),
  whose diff to the bundled sources between `e4dc5cfa2a` and `1ac7eebe04` is
  shown below.

Questions: (1) does the change expand any authority, permission or
safety-floor reach? (2) is the raise_log entry accurate against the diff?
Answer with findings, then end your reply with exactly one line in this form:

`STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`

## Diff of the gated file against origin/main

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 2fce0c228f..c7e68d3fa8 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1581000,
+    "max_bytes": 1581900,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
@@ -172,6 +172,15 @@
             "what_was_added": "Measured per module against origin/main with the esbuild metafile, +2,192 B: hooks/memory_recall_hook.ts 777 B (reads the host's autoMemoryDirectory before the slug walk, so recall finds a relocated memory store), hooks/skill_route_hook.ts 762 B (unions the installer's own name-only listing record into the known-bare set on claude), handoff_context_hook.ts 393 B (annotates branch and commit drift between a handoff header and the checkout), _lib/skill_listing_record.ts 167 B (a leaf so the hook does not import the whole overrides module), 93 B of small edits. The gate measured 1,580,385 B; main builds to 1,578,148 B. The 45 B between the module sum and the bundle delta is esbuild's per-module wrapper.",
             "why_it_could_not_be_avoided": "Room was looked for first: the memory hook already reads the settings file inline instead of importing the settings reader (that import alone had pushed the bundle over earlier), and the listing record is a leaf module for the same reason. The branch fitted under the ceiling until main grew to 452 B of headroom. The alternative, deferring one of the three features, was put to the council and rejected by both seats.",
             "what_would_have_caught_it": "Nothing earlier: the growth is the features, and main's growth consumed the headroom between this branch's two measurements. Sized to the measurement plus about 600 bytes of rebuild jitter."
+        },
+        {
+            "date": "2026-11-03",
+            "from": 1581000,
+            "to": 1581900,
+            "by": "agent, docs/game-roadmap-owner-answers (trunk repair; this branch changes no bundled source)",
+            "what_was_added": "Nothing on this branch. The trunk at 1ac7eebe04 measures 1,581,318 B, 318 over the 1,581,000 ceiling: #2816 (feat/web-launch-write-time) and #2817 (analysis/inbox-2026-11-n) each fitted under the ceiling alone and were merged minutes apart, so #2816's dispatch-path growth landed on top of #2817's raise without a raise_log entry of its own. The Consistency run on main for 1ac7eebe04 fails this gate with the same 1,581,318 B.",
+            "why_it_could_not_be_avoided": "The bytes are already on the trunk; a ceiling below the trunk's own reading fails every branch cut from it, the same reasoning the first 2026-11-03 entry used for its base overage. Shrinking #2816's addition would be a feature change on code this branch did not write.",
+            "what_would_have_caught_it": "Measuring the ceiling on the merge result rather than on each branch, as the first raise_log entry already says; two PRs merged in sequence without the second re-running against the first. Sized to the trunk measurement plus about 580 bytes of rebuild jitter."
         }
     ],
     "chunks": [
```

## Bundled-source diff of #2816 (e4dc5cfa2a..1ac7eebe04)

```diff
diff --git a/src/scripts/hooks/design_pass_hook.ts b/src/scripts/hooks/design_pass_hook.ts
index dea23b5204..f3dac3b376 100644
--- a/src/scripts/hooks/design_pass_hook.ts
+++ b/src/scripts/hooks/design_pass_hook.ts
@@ -94,7 +94,8 @@ import { HANDOVER_SHAPES, isUiPath, isUiTreePath } from '../_lib/ui_surface.js';
 import { loadDesignContext, scanFile } from '../lint_design_slop.js';
 import { unwrap } from './envelope.js';
 import { readHookStdin } from './hook_stdin.js';
-import { CHUNK_BASENAME, loadSvgScan } from './svg_rules_loader.js';
+import { CHUNK_BASENAME, isBundled, loadSvgScan } from './svg_rules_loader.js';
+import { WEB_LAUNCH_CHUNK, loadWebLaunchScan } from './web_launch_rows_loader.js';
 import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';
 
 const SETTINGS_FILE = '.agent-settings.yml';
@@ -625,6 +626,15 @@ export function render(result: PassResult, conformance?: string): string {
     return lines.join('\n');
 }
 
+/** The written files the web-launch rows read. No size cap: the scan is linear, and any cap is a padding bypass. */
+export const WEB_LAUNCH_RE = /\.(html?|css)$/i;
+
+/** Mark a pass degraded, APPENDING the reason: two degradations are two facts. */
+export function withDegradation(result: PassResult, reason: string): PassResult {
+    const prior = result.degradation_reason;
+    return { ...result, verification: 'degraded', degradation_reason: prior ? `${prior}; ${reason}` : reason };
+}
+
 function main(): number {
     const root = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
     if (!enabled(root)) return EXIT_ALLOW;
@@ -653,6 +663,7 @@ function main(): number {
     const findings: Finding[] = [];
     let scanFailed: string | null = null;
     let svgRulesUnavailable = false;
+    const webLaunchGaps: string[] = [];
     try {
         const ctx = loadDesignContext(root);
         for (const rel of targets) {
@@ -673,6 +684,13 @@ function main(): number {
                 if (scan === null) svgRulesUnavailable = true;
                 else findings.push(...svgFindings(scan(content, rel) as SvgRuleFinding[], rel));
             }
+            if (WEB_LAUNCH_RE.test(rel)) {
+                // No chunk in a bundled install: the file is reported unchecked,
+                // never passed as clean.
+                const scan = loadWebLaunchScan();
+                if (scan !== null) findings.push(...scan(rel, content));
+                else if (isBundled()) webLaunchGaps.push(rel);
+            }
             for (const f of scanFile(content, rel, ctx)) {
                 findings.push({
                     file: rel,
@@ -713,15 +731,16 @@ function main(): number {
         // turn where both degradations held reported only the newer one. Two
         // degradations are two facts; the operator needs both or they fix one
         // and are surprised by the other.
-        const svgReason = `the SVG rule set could not be loaded (expected dist/hooks/${CHUNK_BASENAME} beside the dispatch bundle) — the .svg files in this turn were not checked`;
-        result = {
-            ...result,
-            verification: 'degraded',
-            degradation_reason:
-                result.degradation_reason === undefined || result.degradation_reason === ''
-                    ? svgReason
-                    : `${result.degradation_reason}; ${svgReason}`,
-        };
+        result = withDegradation(
+            result,
+            `the SVG rule set could not be loaded (expected dist/hooks/${CHUNK_BASENAME} beside the dispatch bundle) — the .svg files in this turn were not checked`,
+        );
+    }
+    if (webLaunchGaps.length > 0) {
+        result = withDegradation(
+            result,
+            `web-launch rows not run: ${webLaunchGaps.join(', ')} (no ${WEB_LAUNCH_CHUNK})`,
+        );
     }
 
     for (const f of result.findings) state.surfaced.push(`${f.file}::${f.rule}::${f.line}`);
diff --git a/src/scripts/hooks/web_launch_rows.ts b/src/scripts/hooks/web_launch_rows.ts
new file mode 100644
index 0000000000..50e989c03d
--- /dev/null
+++ b/src/scripts/hooks/web_launch_rows.ts
@@ -0,0 +1,23 @@
+/**
+ * The chunk entry for `design_pass_hook`'s web-launch rows: a third-party load
+ * on first paint and a superseded statute on a legal page, over one written
+ * file. Built as `web_launch_rows.chunk.cjs` by `hook_chunks.mjs` and loaded only
+ * for an `.html`/`.css` write, so the register, the supersession table and the
+ * row code cost the shared dispatch bundle nothing.
+ */
+import { origins } from '../../config/third-party-origins.json';
+import { supersessions } from '../../config/web-launch-readiness.json';
+import { type OriginRow, type Supersession, writeTimeFindings } from '../web_launch_third_party.js';
+import type { Finding } from './design_pass_hook.js';
+
+/** Already in the hook's Finding shape, so the dispatch bundle carries no mapping. Advisory P2. */
+export function scanWebLaunch(rel: string, content: string): Finding[] {
+    return writeTimeFindings(rel, content, origins as OriginRow[], supersessions as Supersession[]).map((h) => ({
+        file: rel,
+        severity: 'P2',
+        catalogId: 'web-launch',
+        rule: h.check,
+        line: h.line,
+        message: h.text,
+    }));
+}
diff --git a/src/scripts/hooks/web_launch_rows_loader.ts b/src/scripts/hooks/web_launch_rows_loader.ts
new file mode 100644
index 0000000000..9530e275ff
--- /dev/null
+++ b/src/scripts/hooks/web_launch_rows_loader.ts
@@ -0,0 +1,21 @@
+/**
+ * Loads `scanWebLaunch` from its conditional chunk beside the dispatch bundle,
+ * through the shared `loadChunkExport`. Unbundled (source) runs return null:
+ * the rows are tested through `scanWebLaunch` directly. A failed bundled load is
+ * reported by the hook as a degraded pass, never as a clean one.
+ */
+import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+import type { Finding } from './design_pass_hook.js';
+import { isBundled, loadChunkExport } from './svg_rules_loader.js';
+
+export type WebLaunchScan = (rel: string, content: string) => Finding[];
+
+export const WEB_LAUNCH_CHUNK = 'web_launch_rows.chunk.cjs';
+
+export function loadWebLaunchScan(selfUrl: string = import.meta.url, bundled: boolean = isBundled()): WebLaunchScan | null {
+    if (!bundled) return null;
+    const specifier = path.join(path.dirname(fileURLToPath(selfUrl)), WEB_LAUNCH_CHUNK);
+    return loadChunkExport<WebLaunchScan>(selfUrl, specifier, 'scanWebLaunch', true);
+}
```

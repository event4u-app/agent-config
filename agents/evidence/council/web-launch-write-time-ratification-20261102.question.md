<!-- evidence-type: original-review -->

# Ratification prompt — web-launch write-time carrier and its chunk ceiling (verbatim, as sent 2026-11-02)

~~~text
Ratification review of one change touching src/config/hook-bundle-budget.json, a file on this repository's ratification watched set.

subject: 0a1e3b64b6d51cc804ec37e3f3e60d22cbc3f33b7453f671762811b914d63214

Under this repository's governance (ADR-268 § 4), a change to a governance surface needs a record from a party other than its author, with one closed verdict:
- ratified: the change expands what an agent may do, and that expansion is approved
- confirmed-non-expanding: the change does not expand any authority, weaken any gate, or make an enforcing step non-enforcing
- refused: the change must not land

History, stated because this is the second attempt. An earlier version of this change was reviewed in one piece (loader refactor + chunk + a max_bytes RAISE 1,562,000 -> 1,563,000) with only the budget-file diff shown. One seat refused: it asked for the refactor, the chunk and the raise as separate reviewed changes, with the full diff in view, and raised the concern of a new parse surface over untrusted content. Response:
1. The refactor ships alone as its own PR (refactor/hook-chunk-loader, behaviour-neutral, no gated file, bundle 1,560,694 -> 1,560,823 B).
2. This change is stacked on it and RAISES NOTHING: max_bytes stays 1,562,000. The earlier +1,000 raise came from measuring with a symlinked node_modules, which inflates the bundle by about 2.3 KB of path text; measured on an APFS-cloned node_modules, as the budget's own derivation prescribes, the dispatch bundle is 1,561,665 B with this change.
3. The only edit to the gated file is one new `chunks` row (a ceiling for the new chunk), which the composition gate REQUIRES for every chunk hook_chunks.mjs builds.

What the change does. design_pass_hook's post_tool_use pass (advisory; the concern is declared severity advisory and the dispatcher caps it there; exit 0) gains: for an .html/.css file the agent itself just wrote, report (a) a third-party resource the markup loads on first paint and (b) an imprint line citing a superseded statute. The rows are pure functions over the file's text: regular expressions over the agent's own written bytes, no network, no execution, no file other than the one written; the outputs are fixed-vocabulary advisory messages. The row code, a 12-row provider register and a 1-row supersession table live in web_launch_rows.chunk.cjs (11,326 B) and are required only for .html/.css writes, through the integrity-checked loadChunkExport; a missing or mismatched chunk yields no findings, never an error.

Full diff (stacked on the refactor; the refactor's own diff is the svg_rules_loader.ts hunk):
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 624c6d74f8..d1d950e93f 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -213,6 +213,12 @@
             "max_bytes": 10800,
             "registered_at": "2026-10-28",
             "derivation": "Measured 9,807 bytes on 2026-10-28 (the intake-pass concern, its task-prompt and question predicates after council round 1, and the shared `isSyntheticPrompt` reader), no `yaml`. The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on `user_prompt_submit` on every host that binds the slot; the dispatch bundle carries only its LAZY_CONCERNS row. A missing chunk falls back to the spawn path and costs latency, never the line."
+        },
+        {
+            "entry": "src/scripts/hooks/web_launch_rows.ts",
+            "max_bytes": 13000,
+            "registered_at": "2026-11-02",
+            "derivation": "Measured 11,326 bytes on 2026-11-02: rows 2.1 and 2.2 of check_web_launch_readiness (third-party load on first paint, superseded statute on a legal page), the 12-row provider register and the one-row supersession table. Loaded by design_pass_hook only for an .html/.css write. The ceiling is that reading plus about 15 %, rounded, for register rows that enter one named defect at a time."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index 086ae575ac..30a67229c1 100644
--- a/src/scripts/hook_chunks.mjs
+++ b/src/scripts/hook_chunks.mjs
@@ -89,6 +89,10 @@ export const HOOK_CHUNKS = Object.freeze([
         entry: 'src/scripts/hooks/intake_pass_hook.ts',
         outfile: 'dist/hooks/intake_pass.chunk.cjs',
     }),
+    Object.freeze({
+        entry: 'src/scripts/hooks/web_launch_rows.ts',
+        outfile: 'dist/hooks/web_launch_rows.chunk.cjs',
+    }),
 ]);
 
 /**
diff --git a/src/scripts/hooks/design_pass_hook.ts b/src/scripts/hooks/design_pass_hook.ts
index ac732f7278..d33dead8fe 100644
--- a/src/scripts/hooks/design_pass_hook.ts
+++ b/src/scripts/hooks/design_pass_hook.ts
@@ -94,6 +94,7 @@ import { HANDOVER_SHAPES, isUiPath, isUiTreePath } from '../_lib/ui_surface.js';
 import { loadDesignContext, scanFile } from '../lint_design_slop.js';
 import { readHookStdin } from './hook_stdin.js';
 import { CHUNK_BASENAME, loadSvgScan } from './svg_rules_loader.js';
+import { loadWebLaunchScan } from './web_launch_rows_loader.js';
 import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';
 
 const SETTINGS_FILE = '.agent-settings.yml';
@@ -624,6 +625,19 @@ export function render(result: PassResult, conformance?: string): string {
     return lines.join('\n');
 }
 
+/** Rows 2.1 and 2.2 of `check_web_launch_readiness` over one written file, advisory. */
+export function webLaunchFindings(rel: string, content: string, scan = loadWebLaunchScan()): Finding[] {
+    if (scan === null || !/\.(html?|css)$/i.test(rel)) return [];
+    return scan(rel, content).map((h) => ({
+        file: rel,
+        severity: 'P2' as const,
+        catalogId: 'web-launch',
+        rule: h.check,
+        line: h.line,
+        message: h.text,
+    }));
+}
+
 function main(): number {
     const root = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
     if (!enabled(root)) return EXIT_ALLOW;
@@ -674,6 +688,7 @@ function main(): number {
                 if (scan === null) svgRulesUnavailable = true;
                 else findings.push(...svgFindings(scan(content, rel) as SvgRuleFinding[], rel));
             }
+            findings.push(...webLaunchFindings(rel, content));
             for (const f of scanFile(content, rel, ctx)) {
                 findings.push({
                     file: rel,
diff --git a/src/scripts/hooks/svg_rules_loader.ts b/src/scripts/hooks/svg_rules_loader.ts
index 836d728faf..bb77ef5e90 100644
--- a/src/scripts/hooks/svg_rules_loader.ts
+++ b/src/scripts/hooks/svg_rules_loader.ts
@@ -112,16 +112,27 @@ export function loadSvgScanUncached(
     selfUrl: string = import.meta.url,
     bundled: boolean = isBundled(),
 ): SvgScan | null {
+    let specifier: string;
+    try {
+        specifier = rulesSpecifier(selfUrl, bundled);
+    } catch {
+        return null;
+    }
+    return loadChunkExport<SvgScan>(selfUrl, specifier, 'scanSvg', bundled);
+}
+
+/**
+ * Require the function `name` from a conditional chunk, or null. Shared so a
+ * second chunk loader adds no copy of this logic to the dispatch bundle.
+ */
+export function loadChunkExport<T>(selfUrl: string, specifier: string, name: string, bundled: boolean): T | null {
     try {
-        const specifier = rulesSpecifier(selfUrl, bundled);
         // The chunk runs inside the dispatch process, so it gets the bundle's
         // own integrity check: a mismatch with its sidecar is not executed.
         // No sidecar is `unverifiable` and allowed, as for `dispatch.js`.
         if (bundled && verifyBundle(specifier).state === 'mismatch') return null;
-        const req = createRequire(selfUrl);
-        const mod = req(specifier) as Record<string, unknown>;
-        const scan = mod['scanSvg'];
-        return typeof scan === 'function' ? (scan as SvgScan) : null;
+        const fn = (createRequire(selfUrl)(specifier) as Record<string, unknown>)[name];
+        return typeof fn === 'function' ? (fn as T) : null;
     } catch {
         return null;
     }
diff --git a/src/scripts/hooks/web_launch_rows.ts b/src/scripts/hooks/web_launch_rows.ts
new file mode 100644
index 0000000000..575b53617a
--- /dev/null
+++ b/src/scripts/hooks/web_launch_rows.ts
@@ -0,0 +1,14 @@
+/**
+ * The chunk entry for `design_pass_hook`'s web-launch rows: a third-party load
+ * on first paint and a superseded statute on a legal page, over one written
+ * file. Built as `web_launch_rows.chunk.cjs` by `hook_chunks.mjs` and loaded only
+ * for an `.html`/`.css` write, so the register, the supersession table and the
+ * row code cost the shared dispatch bundle nothing.
+ */
+import { origins } from '../../config/third-party-origins.json';
+import { supersessions } from '../../config/web-launch-readiness.json';
+import { type OriginRow, type Supersession, type WriteTimeHit, writeTimeFindings } from '../web_launch_third_party.js';
+
+export function scanWebLaunch(rel: string, content: string): WriteTimeHit[] {
+    return writeTimeFindings(rel, content, origins as OriginRow[], supersessions as Supersession[]);
+}
diff --git a/src/scripts/hooks/web_launch_rows_loader.ts b/src/scripts/hooks/web_launch_rows_loader.ts
new file mode 100644
index 0000000000..40b119d856
--- /dev/null
+++ b/src/scripts/hooks/web_launch_rows_loader.ts
@@ -0,0 +1,21 @@
+/**
+ * Loads `scanWebLaunch` from its conditional chunk beside the dispatch bundle,
+ * through the shared `loadChunkExport`. Unbundled (source) runs return null:
+ * the rows are tested through `scanWebLaunch` directly. A failed load loses only
+ * these rows, never the pass.
+ */
+import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+import type { WriteTimeHit } from '../web_launch_third_party.js';
+import { isBundled, loadChunkExport } from './svg_rules_loader.js';
+
+export type WebLaunchScan = (rel: string, content: string) => WriteTimeHit[];
+
+export const WEB_LAUNCH_CHUNK = 'web_launch_rows.chunk.cjs';
+
+export function loadWebLaunchScan(selfUrl: string = import.meta.url, bundled: boolean = isBundled()): WebLaunchScan | null {
+    if (!bundled) return null;
+    const specifier = path.join(path.dirname(fileURLToPath(selfUrl)), WEB_LAUNCH_CHUNK);
+    return loadChunkExport<WebLaunchScan>(selfUrl, specifier, 'scanWebLaunch', true);
+}

Answer each of these, one at a time, keyed by number:
1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

Close with exactly one line:
STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>
~~~

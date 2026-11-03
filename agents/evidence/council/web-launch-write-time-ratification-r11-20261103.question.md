<!-- evidence-type: original-review -->

# Ratification prompt, round 11 — web-launch write-time carrier, its chunk ceiling, a dispatch-ceiling raise, and two defects the write-time path exposed (verbatim, as sent 2026-11-03)

~~~text
Ratification review, round 11, of one change touching src/config/hook-bundle-budget.json, a file on this repository's ratification watched set.

subject: 979d668b117507fdd2acba59368203676064ff710616e0f663cc24d896bcf2bc

Closed verdicts (ADR-268 § 4): ratified (an approved expansion of what an agent may do) · confirmed-non-expanding (no authority expanded, no gate weakened, no enforcing step made non-enforcing) · refused (must not land).

Context: rounds 1 to 10 reviewed this change (agents/evidence/council/web-launch-write-time-ratification{,-r2,...,-r10}-2026110{2,3}.question.md). Round 10 split: one seat ratified, one refused (DEALBREAKER: yes). Since round 10 the branch carries one fix commit and a merge of origin/main (56 commits). The subject changed because the merge touched hook-bundle-budget.json, as stated below.

What the change does: design_pass_hook, on a dispatched post_tool_use write of an .html/.css file, runs rows 2.1 (third-party load on first paint) and 2.2 (superseded statute on a legal page) of check_web_launch_readiness over that one file and returns them as advisory findings; the rows live in a conditional chunk loaded only for such a write. Two defects on origin/main, exposed by this path, are fixed in the same change: (A) design_pass_hook read the dispatcher's envelope as if it were the host payload, so every dispatched post_tool_use of the design pass exited allow in 0 ms and the stop slot never ran; stdin is now read through the shared unwrap() helper. (B) cssBlocks in design_slop_rules.ts (used by nine rules) was quadratic (100,000 characters 39 s); it now walks brace positions once, at most 77 ms for all 23 rules on three 1,000,000-character shapes.

The round-10 dealbreaker and what was done with it: the refusing seat held that the 1,000,000-character cap was a padding bypass — a tracker-laden page padded past the cap got only a "web-launch rows not run" note at write time. The cap is removed. Measured: the web-launch scan is linear, at most 41 ms per 1,000,000 characters across comment, whitespace, '<' and tag-dense padding, 10,000,000 tag-dense characters at most 400 ms; the design-slop scan already ran uncapped on the same content, so the cap bounded no latency, only coverage. The constant WEB_LAUNCH_MAX_CHARS and its one-line unit test asserting its value are deleted with it. The boundary test becomes: a page padded past 4,000,000 characters, before or after its loads, still surfaces both findings with no "not run" note; it fails with the cap restored (verified by restoring it and rebuilding). The degraded note remains for one case only: a bundled install whose chunk is missing.

Other round-10 points: "advisory P2 unverified" — the findings are emitted as additionalContext and the post_tool_use pass exits allow; nothing in this change adds a blocking path. visibleText on unclosed blocks: the two implementations are meant to differ there, pinned by the round-8 tests; equivalence is tested only on well-formed pages for that reason. tagsOf reports the line a tag starts on, by design and tested.

The merge: origin/main raised max_bytes 1,562,000 -> 1,567,400 for an unrelated session-register change, from the same base as this branch's own raise 1,562,000 -> 1,563,500. The branch raise entry was dropped and replaced by one raise_log entry 1,567,400 -> 1,568,700: the merged bundle measures 1,568,217 bytes (817 over main's ceiling); the margin is 483 bytes. The web_launch_rows chunk ceiling (14,000; chunk 13,287) is carried over unchanged.

Scope of what is shown: the full diff of src at three lines of context, and of tests only every added describe/it line, extracted mechanically (git diff -U0 of tests, added lines matching describe( or it(, unfiltered). The full test diff does not fit the council bundle ceiling of 51,200 bytes; this boundary was set by the repository owner, not by the author.

Full diff against origin/main (src):
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index d4a864631a..7065c528cb 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1567400,
+    "max_bytes": 1568700,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
@@ -154,6 +154,15 @@
             "what_was_added": "Profile awareness on the session-register path, which runs on session_start: `session_profile` in `_lib/session_register.ts` (reads only the environment) plus `install/agentSwitchProfile.ts` (2,033 B), newly pulled into the bundle so the profile is parsed by the one existing matching rule rather than a second copy; and `_lib/provider_home.ts` (903 B), the single resolver for `CLAUDE_CONFIG_DIR` / `CODEX_HOME` that `claude_plugin.claude_config_dir` now delegates to. Measured 1,566,892 bytes by the gate, 4,892 over the 1,562,000 ceiling; the base sat at 1,561,506.",
             "why_it_could_not_be_avoided": "Room was looked for first: `sessions_cli.ts` (16,380 B) rides in through `env_session_id` and `other_worktree_branches_detailed`, but extracting those is an unrelated refactor of two hooks and a CLI; the schema-flag code added to it is tree-shaken because the bundled entry never reaches `cmd_list`. Inlining a reduced agent-switch path match would save about 1.5 KB at the cost of a second matching rule that drifts from the first. The profile must be recorded when the session registers, in the hook, because a later reader runs in another process with another environment.",
             "what_would_have_caught_it": "Nothing earlier: the growth is the feature. Sized to the measurement plus about 500 bytes of rebuild jitter."
+        },
+        {
+            "date": "2026-11-03",
+            "from": 1567400,
+            "to": 1568700,
+            "by": "agent, feat/web-launch-write-time",
+            "what_was_added": "The design_pass_hook call site for the web-launch rows (rows 2.1/2.2 of check_web_launch_readiness at write time): the .html/.css path test, the chunk loader and the degraded-pass reason, plus the envelope read through unwrap() and the one-pass cssBlocks in design_slop_rules.ts. The rows themselves stay in web_launch_rows.chunk.cjs. Measured 1,568,217 bytes by the gate after merging origin/main, 817 over the 1,567,400 ceiling. This replaces the branch-local 1,562,000 -> 1,563,500 raise of 2026-11-02, which collided with the main-side raise from the same base and was dropped in the merge.",
+            "why_it_could_not_be_avoided": "A write-time carrier needs a call site in the dispatch bundle to decide whether to load the chunk; everything else is already in the chunk. cssBlocks was rewritten compactly so its fix needed no bytes of its own. The new ceiling is the reading plus 483 bytes, the same margin as the neighbouring raises, so an esbuild symbol rename does not red the gate.",
+            "what_would_have_caught_it": "Nothing earlier: the growth is the feature."
         }
     ],
     "chunks": [
@@ -222,6 +231,12 @@
             "max_bytes": 10800,
             "registered_at": "2026-10-28",
             "derivation": "Measured 9,807 bytes on 2026-10-28 (the intake-pass concern, its task-prompt and question predicates after council round 1, and the shared `isSyntheticPrompt` reader), no `yaml`. The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on `user_prompt_submit` on every host that binds the slot; the dispatch bundle carries only its LAZY_CONCERNS row. A missing chunk falls back to the spawn path and costs latency, never the line."
+        },
+        {
+            "entry": "src/scripts/hooks/web_launch_rows.ts",
+            "max_bytes": 14000,
+            "registered_at": "2026-11-02",
+            "derivation": "Measured 13,287 bytes on 2026-11-02: rows 2.1 and 2.2, already in the hook Finding shape, of check_web_launch_readiness (third-party load on first paint, superseded statute on a legal page), the 12-row provider register and the one-row supersession table. Loaded by design_pass_hook only for an .html/.css write. The ceiling is the next thousand above that reading; the 713-byte (5.4 %) margin is what that rounding leaves, not a growth estimate. A register row serialises to 150-223 bytes (mean 181), so the margin admits about three more rows before the chunk must be re-measured and this row re-derived."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
diff --git a/src/scripts/design_slop_rules.ts b/src/scripts/design_slop_rules.ts
index be889e2e25..0afc95bb89 100644
--- a/src/scripts/design_slop_rules.ts
+++ b/src/scripts/design_slop_rules.ts
@@ -107,20 +107,33 @@ export interface SlopRule {
 /** Split CSS-ish text into naive `selector { body }` blocks with the line of `{`. */
 export function cssBlocks(content: string): Array<{ selector: string; body: string; line: number }> {
   const blocks: Array<{ selector: string; body: string; line: number }> = [];
-  const re = /([^{}]+)\{([^{}]*)\}/g;
-  // Comments blanked, not removed: line numbers hold.
-  content = content.replace(/\/\*[^]*?\*\//g, (c) => c.replace(/./g, " "));
-  let m: RegExpExecArray | null;
-  while ((m = re.exec(content)) !== null) {
-    // The match starts right after the previous `}`, newline included; the
-    // block's line is where its selector starts.
-    const sel = m[1] ?? "";
-    const line = lineOf(content, m.index + sel.length - sel.trimStart().length);
-    blocks.push({ selector: sel.trim(), body: m[2] ?? "", line });
+  content = blankComments(content);
+  // The blocks `/([^{}]+)\{([^{}]*)\}/g` finds, in one pass over the braces: that
+  // regex restarts at every position of a brace-free run, quadratic on a minified
+  // page, and so was counting lines from the top for every block. A selector
+  // always starts right after the previous brace, newline included; the block's
+  // line is where the selector's text starts.
+  const at = [...content.matchAll(/[{}]/g)].map((m) => m.index);
+  for (let k = 0, line = 1, i = 0; k + 1 < at.length; k++) {
+    const start = k ? at[k - 1]! + 1 : 0;
+    const sel = content.slice(start, at[k]);
+    if (!sel || content[at[k]!] !== "{" || content[at[k + 1]!] !== "}") continue;
+    for (const end = start + sel.length - sel.trimStart().length; i < end; i++) if (content[i] === "\n") line++;
+    blocks.push({ selector: sel.trim(), body: content.slice(at[k]! + 1, at[++k]), line });
   }
   return blocks;
 }
 
+/** Comments blanked, not removed, so line numbers hold. An unclosed opener blanks nothing. */
+function blankComments(s: string): string {
+  let out = "";
+  let from = 0;
+  for (let a, z; (a = s.indexOf("/*", from)) >= 0 && (z = s.indexOf("*/", a + 2)) >= 0; from = z + 2) {
+    out += s.slice(from, a) + s.slice(a, z + 2).replace(/./g, " ");
+  }
+  return out + s.slice(from);
+}
+
 function lineOf(content: string, index: number): number {
   return (content.slice(0, index).match(/\n/g) ?? []).length + 1;
 }
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
index ac732f7278..f3dac3b376 100644
--- a/src/scripts/hooks/design_pass_hook.ts
+++ b/src/scripts/hooks/design_pass_hook.ts
@@ -92,8 +92,10 @@ import { compareInputs } from '../_lib/probe_inputs.js';
 import { trigger_matches, type Trigger } from '../_lib/router_match.js';
 import { HANDOVER_SHAPES, isUiPath, isUiTreePath } from '../_lib/ui_surface.js';
 import { loadDesignContext, scanFile } from '../lint_design_slop.js';
+import { unwrap } from './envelope.js';
 import { readHookStdin } from './hook_stdin.js';
-import { CHUNK_BASENAME, loadSvgScan } from './svg_rules_loader.js';
+import { CHUNK_BASENAME, isBundled, loadSvgScan } from './svg_rules_loader.js';
+import { WEB_LAUNCH_CHUNK, loadWebLaunchScan } from './web_launch_rows_loader.js';
 import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';
 
 const SETTINGS_FILE = '.agent-settings.yml';
@@ -624,6 +626,15 @@ export function render(result: PassResult, conformance?: string): string {
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
@@ -631,12 +642,10 @@ function main(): number {
     const slotArg = process.argv.includes('--slot') ? process.argv[process.argv.indexOf('--slot') + 1] : undefined;
     const slot: PassResult['slot'] = slotArg === 'stop' ? 'stop' : 'post_tool_use';
 
-    let payload: unknown = null;
-    try {
-        payload = JSON.parse(readHookStdin() || 'null');
-    } catch {
-        return EXIT_ALLOW; // fail_closed: false — an unparsable payload is not a block
-    }
+    // Dispatched in-process, stdin is the dispatcher's envelope with the host
+    // payload under `payload`; a direct run gets the host payload itself.
+    // Unparsable stdin yields {}, which names no target: not a block.
+    const [, payload] = unwrap(readHookStdin(), 'claude');
 
     const state = readState(root);
     let targets: string[];
@@ -654,6 +663,7 @@ function main(): number {
     const findings: Finding[] = [];
     let scanFailed: string | null = null;
     let svgRulesUnavailable = false;
+    const webLaunchGaps: string[] = [];
     try {
         const ctx = loadDesignContext(root);
         for (const rel of targets) {
@@ -674,6 +684,13 @@ function main(): number {
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
@@ -714,15 +731,16 @@ function main(): number {
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
diff --git a/src/scripts/web_launch_third_party.ts b/src/scripts/web_launch_third_party.ts
index 82555f6136..179b98886e 100644
--- a/src/scripts/web_launch_third_party.ts
+++ b/src/scripts/web_launch_third_party.ts
@@ -77,16 +77,19 @@ export function loadRegister(root: string, asOf: string): OriginRow[] {
 const isPage = (f: FileLike): boolean => /\.html?$/i.test(f.base);
 const isCss = (f: FileLike): boolean => /\.css$/i.test(f.base);
 
-/** Past this, a line is a bundler artefact; its contents are reported undecided. */
-const MINIFIED = 400;
-
 /**
  * Loadable contexts only. An anchor is followed by the visitor, prose is not
  * markup, and a `dns-prefetch` hint resolves a name without contacting the
  * provider — it is reported undecided, never as a load.
+ *
+ * Tags are found over the WHOLE file text, not per line, so a tag a formatter
+ * wrapped over several lines and a minified one-line page are both read. A tag
+ * runs to the first `>` after it, of any length, unless another tag start comes
+ * first: then it is unclosed. Each character belongs to at most one tag, which
+ * keeps the scan linear on a page of unterminated `<link`. An unclosed tag is
+ * never dropped silently — the file is reported as carrying unread tags.
  */
-const LINK_RE = /<link\b[^>]*>/gi;
-const SRC_TAG_RE = /<(script|iframe|img|video|audio|source|embed)\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
+const TAG_START_RE = /<(link|script|iframe|img|video|audio|source|embed)\b/gi;
 const CSS_IMPORT_RE = /@import\s+(?:url\(\s*)?["']?((?:https?:)?\/\/[^"')\s]+)/gi;
 const CSS_URL_RE = /\burl\(\s*["']?((?:https?:)?\/\/[^"')\s]+)/gi;
 const LOAD_RELS = new Set(['stylesheet', 'preconnect', 'preload', 'modulepreload', 'icon']);
@@ -111,17 +114,61 @@ function absolute(raw: string): URL | null {
     }
 }
 
+/** The attribute itself — preceded by whitespace, so `data-src` is never read as `src`. */
+const ATTR_RE = new Map<string, RegExp>();
 function attr(tag: string, name: string): string | undefined {
-    return new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1];
+    let re = ATTR_RE.get(name);
+    if (re === undefined) {
+        re = new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i');
+        ATTR_RE.set(name, re);
+    }
+    return re.exec(tag)?.[1];
+}
+
+interface Tag {
+    name: string;
+    /** Empty when the tag is unclosed. */
+    tag: string;
+    line: number;
+    closed: boolean;
+}
+
+/** Every loadable tag of a page with the 1-based line it starts on. Linear: one window per tag start. */
+export function tagsOf(text: string): Tag[] {
+    const starts: number[] = [0];
+    for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
+    const lineAt = (pos: number): number => {
+        let lo = 0;
+        let hi = starts.length - 1;
+        while (lo < hi) {
+            const mid = (lo + hi + 1) >> 1;
+            if ((starts[mid] ?? 0) <= pos) lo = mid;
+            else hi = mid - 1;
+        }
+        return lo + 1;
+    };
+    const found = [...text.matchAll(TAG_START_RE)];
+    const out: Tag[] = [];
+    // The next `>` only moves forward, so all the searches together read the text once.
+    let gt = -2;
+    found.forEach((m, k) => {
+        const at = m.index ?? 0;
+        if (gt !== -1 && gt < at) gt = text.indexOf('>', at);
+        const next = found[k + 1]?.index ?? Number.POSITIVE_INFINITY;
+        const name = (m[1] ?? '').toLowerCase();
+        const closed = gt !== -1 && gt < next;
+        out.push({ name, tag: closed ? text.slice(at, gt + 1) : '', line: lineAt(at), closed });
+    });
+    return out;
 }
 
 /** Hosts the build itself claims through rel="canonical" — absolute self-references, not third parties. */
 function ownHosts(files: readonly FileLike[]): Set<string> {
     const out = new Set<string>();
     for (const f of files.filter(isPage)) {
-        for (const tag of f.text.match(LINK_RE) ?? []) {
-            if ((attr(tag, 'rel') ?? '').toLowerCase() !== 'canonical') continue;
-            const u = absolute(attr(tag, 'href') ?? '');
+        for (const t of tagsOf(f.text)) {
+            if (!t.closed || t.name !== 'link' || (attr(t.tag, 'rel') ?? '').toLowerCase() !== 'canonical') continue;
+            const u = absolute(attr(t.tag, 'href') ?? '');
             if (u !== null) out.add(u.host.toLowerCase());
         }
     }
@@ -131,58 +178,69 @@ function ownHosts(files: readonly FileLike[]): Set<string> {
 interface Extracted {
     loads: Load[];
     prefetch: Hit[];
-    minified: Hit[];
+    /** One per page carrying loadable tags that never close. */
+    unread: Hit[];
 }
 
 export function extractLoads(files: readonly FileLike[]): Extracted {
     const own = ownHosts(files);
     const loads: Load[] = [];
     const prefetch: Hit[] = [];
-    const minified: Hit[] = [];
-    const push = (f: FileLike, i: number, raw: string, how: string): void => {
+    const unread: Hit[] = [];
+    const push = (f: FileLike, line: number, raw: string, how: string): void => {
         const url = absolute(raw);
         if (url === null || own.has(url.host.toLowerCase())) return;
-        loads.push({ file: f.rel, line: i + 1, url, how });
+        loads.push({ file: f.rel, line, url, how });
     };
     for (const f of files) {
         if (!isPage(f) && !isCss(f)) continue;
-        f.lines.forEach((line, i) => {
-            if (line.length > MINIFIED && /https?:\/\//i.test(line)) {
-                minified.push({
+        if (isPage(f)) {
+            const tags = tagsOf(f.text);
+            const unclosed = tags.filter((t) => !t.closed);
+            if (unclosed.length > 0) {
+                const n = unclosed.length;
+                unread.push({
                     file: f.rel,
-                    line: i + 1,
-                    text: `this line is ${String(line.length)} characters (minified); its third-party references are undecided.`,
+                    line: unclosed[0]?.line ?? 1,
+                    text:
+                        `${String(n)} loadable tag${n === 1 ? '' : 's'} (link, script, iframe, img, video, audio, source, embed) ` +
+                        `never close${n === 1 ? 's' : ''} before the next tag or the end of the file; whether ${n === 1 ? 'it loads' : 'they load'} is undecided.`,
                 });
-                return;
             }
-            if (isPage(f)) {
-                for (const tag of line.match(LINK_RE) ?? []) {
-                    const rels = (attr(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
-                    const href = attr(tag, 'href') ?? '';
-                    if (rels.includes('dns-prefetch')) {
-                        const u = absolute(href);
-                        if (u !== null && !own.has(u.host.toLowerCase())) {
-                            prefetch.push({
-                                file: f.rel,
-                                line: i + 1,
-                                text: `dns-prefetch for \`${u.host}\` resolves a name without a request to the provider; whether a load follows is undecided.`,
-                            });
-                        }
-                        continue;
+            for (const t of tags) {
+                if (!t.closed) continue;
+                if (t.name !== 'link') {
+                    const src = attr(t.tag, 'src');
+                    if (src !== undefined) push(f, t.line, src, `<${t.name} src>`);
+                    continue;
+                }
+                const rels = (attr(t.tag, 'rel') ?? '').toLowerCase().split(/\s+/);
+                const href = attr(t.tag, 'href') ?? '';
+                if (rels.includes('dns-prefetch')) {
+                    const u = absolute(href);
+                    if (u !== null && !own.has(u.host.toLowerCase())) {
+                        prefetch.push({
+                            file: f.rel,
+                            line: t.line,
+                            text: `dns-prefetch for \`${u.host}\` resolves a name without a request to the provider; whether a load follows is undecided.`,
+                        });
                     }
-                    const rel = rels.find((r) => LOAD_RELS.has(r));
-                    if (rel !== undefined) push(f, i, href, `<link rel="${rel}">`);
+                    continue;
                 }
-                for (const m of line.matchAll(SRC_TAG_RE)) push(f, i, m[2] ?? '', `<${(m[1] ?? '').toLowerCase()} src>`);
+                const rel = rels.find((r) => LOAD_RELS.has(r));
+                if (rel !== undefined) push(f, t.line, href, `<link rel="${rel}">`);
             }
-            // CSS rules, in a stylesheet or an inline <style> block of a page.
-            for (const m of line.matchAll(CSS_IMPORT_RE)) push(f, i, m[1] ?? '', 'CSS @import');
+        }
+        // CSS rules, in a stylesheet or an inline <style> block of a page. Both
+        // patterns start at a literal and hold no nested quantifier: linear.
+        f.lines.forEach((line, i) => {
+            for (const m of line.matchAll(CSS_IMPORT_RE)) push(f, i + 1, m[1] ?? '', 'CSS @import');
             if (!/@import/i.test(line)) {
-                for (const m of line.matchAll(CSS_URL_RE)) push(f, i, m[1] ?? '', 'CSS url()');
+                for (const m of line.matchAll(CSS_URL_RE)) push(f, i + 1, m[1] ?? '', 'CSS url()');
             }
         });
     }
-    return { loads, prefetch, minified };
+    return { loads, prefetch, unread };
 }
 
 export function resolveOrigin(url: URL, register: readonly OriginRow[]): OriginRow | undefined {
@@ -195,15 +253,17 @@ export function resolveOrigin(url: URL, register: readonly OriginRow[]): OriginR
 interface Classified {
     findings: Hit[];
     undecided: Hit[];
+    /** The unread-tag subset of `undecided`: file-local, so write time reports it too. */
+    unread: Hit[];
     loaded: Map<string, OriginRow>;
 }
 
 /** 2.1 — split the loads into findings and undecided, with the providers that load. */
 export function classifyLoads(files: readonly FileLike[], register: readonly OriginRow[]): Classified {
-    const { loads, prefetch, minified } = extractLoads(files);
+    const { loads, prefetch, unread } = extractLoads(files);
     const gated = new Set(files.filter((f) => GATE_RE.test(f.text)).map((f) => f.rel));
     const findings: Hit[] = [];
-    const undecided: Hit[] = [...prefetch, ...minified];
+    const undecided: Hit[] = [...prefetch, ...unread];
     const loaded = new Map<string, OriginRow>();
     for (const l of loads) {
         const row = resolveOrigin(l.url, register);
@@ -241,7 +301,7 @@ export function classifyLoads(files: readonly FileLike[], register: readonly Ori
             text: `${l.how} loads \`${l.url.host}\` (${row.provider}, ${row.category}) on first paint, before any visitor interaction${extra}.`,
         });
     }
-    return { findings, undecided, loaded };
+    return { findings, undecided, unread, loaded };
 }
 
 const IMPRINT_RE = /(impressum|imprint|legal-notice)/i;
@@ -249,24 +309,42 @@ const PRIVACY_RE = /(datenschutz|privacy)/i;
 const legalPages = (files: readonly FileLike[], re: RegExp): FileLike[] =>
     files.filter((f) => isPage(f) && re.test(f.rel.replace(/\\/g, '/')));
 
-/** Visible text of a page: tags, scripts and styles removed. */
+/**
+ * Visible text of a page: tags, scripts and styles removed, in one forward
+ * pass. Not regex-based on purpose: `<[^>]+>` and a lazy script matcher are
+ * quadratic on a page of unclosed `<`, which agent-written markup can be. An
+ * unclosed tag, script or style swallows the rest of the input.
+ */
 export function visibleText(html: string): string {
-    return html
-        .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
-        .replace(/<[^>]+>/g, ' ')
-        .replace(/&nbsp;/g, ' ')
-        .replace(/\s+/g, ' ')
-        .trim();
+    const lower = html.toLowerCase();
+    let out = '';
+    let i = 0;
+    while (i < html.length) {
+        const lt = html.indexOf('<', i);
+        if (lt < 0) {
+            out += html.slice(i);
+            break;
+        }
+        out += `${html.slice(i, lt)} `;
+        const block = /^<(script|style)\b/.exec(lower.slice(lt, lt + 8));
+        const end = block === null ? html.indexOf('>', lt) : lower.indexOf(`</${block[1] ?? ''}`, lt);
+        if (end < 0) break;
+        const close = block === null ? end : html.indexOf('>', end);
+        if (close < 0) break;
+        i = close + 1;
+    }
+    return out.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
 }
 
 /** 2.2 — a located imprint citing a provision the supersession table marks replaced. */
 export function supersededStatute(files: readonly FileLike[], table: readonly Supersession[]): Hit[] {
     const hits: Hit[] = [];
+    const compiled = table.map((s) => [s, new RegExp(s.pattern, 'i')] as const);
     for (const f of legalPages(files, IMPRINT_RE)) {
         f.lines.forEach((line, i) => {
             const text = visibleText(line);
-            for (const s of table) {
-                if (!new RegExp(s.pattern, 'i').test(text)) continue;
+            for (const [s, re] of compiled) {
+                if (!re.test(text)) continue;
                 hits.push({
                     file: f.rel,
                     line: i + 1,
@@ -282,7 +360,7 @@ export function supersededStatute(files: readonly FileLike[], table: readonly Su
  * 2.3 — a bracketed template token left in a legal page. A bracket holding a
  * number (`[1]`) is a footnote; one holding a word is a slot nobody filled.
  */
-const PLACEHOLDER_RE = /\[(?=[^\]\d]*[A-Za-zÄÖÜäöüß])[^\]\d]{2,40}\]|\blorem\s+ipsum\b/i;
+const PLACEHOLDER_RE = /\[(?=[^\]\d]{0,40}[A-Za-zÄÖÜäöüß])[^\]\d]{2,40}\]|\blorem\s+ipsum\b/i;
 
 export function legalPagePlaceholders(files: readonly FileLike[]): Hit[] {
     const hits: Hit[] = [];
@@ -368,13 +446,14 @@ export const MESSAGE_SAMPLES = (): string[] => {
 };
 
 export interface WriteTimeHit extends Hit {
-    check: 'third-party-load-in-markup' | 'superseded-statute-in-legal-page';
+    check: 'third-party-load-in-markup' | 'third-party-load-unread' | 'superseded-statute-in-legal-page';
 }
 
 /**
  * The write-time half (road-to-a-page-that-says-what-it-loads 4.2): rows 2.1 and
- * 2.2 over ONE file the agent just wrote, for `design_pass_hook`. Findings only —
- * an undecided needs the whole build and is left to the checker.
+ * 2.2 over ONE file the agent just wrote, for `design_pass_hook`. Findings, plus
+ * unclosed loadable tags — the one undecided a single file settles; every other
+ * undecided needs the whole build and is left to the checker.
  */
 export function writeTimeFindings(
     rel: string,
@@ -385,7 +464,10 @@ export function writeTimeFindings(
     if (!/\.(html?|css)$/i.test(rel)) return [];
     const file: FileLike = { rel, base: path.basename(rel), text: content, lines: content.split('\n') };
     return [
-        ...classifyLoads([file], register).findings.map((h) => ({ ...h, check: 'third-party-load-in-markup' as const })),
+        ...((c) => [
+            ...c.findings.map((h) => ({ ...h, check: 'third-party-load-in-markup' as const })),
+            ...c.unread.map((h) => ({ ...h, check: 'third-party-load-unread' as const })),
+        ])(classifyLoads([file], register)),
         ...supersededStatute([file], supersessions).map((h) => ({ ...h, check: 'superseded-statute-in-legal-page' as const })),
     ];
 }

Added describe/it lines of the test diff, per file:
== tests/hooks/design_pass.test.ts
  it('reads the path out of the dispatcher envelope an in-process concern receives', () => {
== tests/hooks/design_pass_web_launch.test.ts
  describe('design_pass_hook — web-launch rows at write time', () => {
  it('reads exactly the written .html/.css files, and they are pass surfaces', () => {
  it('a page loading Google Fonts surfaces the preconnect and the stylesheet, advisory P2', () => {
  it('a stylesheet @import of the provider surfaces its line', () => {
  it('an imprint citing the superseded statute surfaces it', () => {
  it('the safe twins surface nothing', () => {
  describe('the loader', () => {
  it('unbundled, returns null (the hook then neither scans nor reports a gap)', () => {
  it('bundled, reads scanWebLaunch from the chunk beside it, and null when absent', () => {
  describe('withDegradation — an unchecked file is never a clean pass', () => {
  it('marks the pass degraded with the reason', () => {
  it('appends to an earlier reason rather than replacing it', () => {
== tests/hooks/design_pass_web_launch_dispatch.test.ts
  const webLaunchLines = (ctx: string): string[] => ctx.split('\n').filter((l) => l.includes('[P2 web-launch]'));
  describe.runIf(fs.existsSync(BUNDLE))('a written page reaches the agent through the bundled dispatcher', () => {
  it('a page loading Google Fonts surfaces both loads, with file and line', () => {
  it('a stylesheet @import of the provider surfaces line 1', () => {
  it('the safe twin surfaces no web-launch row, and the pass did not degrade for it', () => {
  it('no size lets a load go unreported: a page padded past 4,000,000 characters, before or after its loads, still surfaces both', () => {
== tests/scripts/design_slop_css_blocks_linear.test.ts
  describe('cssBlocks equals the regex it replaced', () => {
  it('on every .html/.css fixture in the tree', () => {
  it('on 5,000 generated strings over the characters the scan branches on', () => {
  describe('cssBlocks is linear on a megabyte', () => {
  it(name, () => {
  it('and still numbers lines on the megabyte', () => {
== tests/scripts/web_launch_linear.test.ts
  describe('linear on pathological input', () => {
  it(`${name} (${String(body.length)} chars) finishes fast in an imprint`, () => {
  it('visibleText drops an unclosed script to the end, linearly', () => {
  it('a minified page still reports its statute citation', () => {
  describe('tags are found whatever the line layout (round-3 ratification)', () => {
  it('a <link> wrapped over several lines by a formatter is found, on the line it starts', () => {
  it('a minified single-line page still reports its third-party loads', () => {
  it('a canonical link wrapped over lines still marks the host as the site itself', () => {
  const file = { rel: 'index.html', base: 'index.html', text: page, lines: page.split('\n') };
  it('a click-to-load iframe carrying only data-src is not a load', () => {
  it('an unterminated tag does not hide the next one, and is itself reported as unread', () => {
  describe('a long tag is read, an unclosed one is never a silent pass (round-5 ratification)', () => {
  it('a closed tag padded far past any window is still read', () => {
  it('an inline base64 image before a load does not hide the load', () => {
  it('a loadable tag with no closer at all is reported once per file, with its count', () => {
  it('the checker counts the same file undecided, never clean', () => {
  it('an unclosed tag before a closed one leaves the closed one read', () => {
  it('sparse unclosed tags in a megabyte file read the text once, with or without a final closer', () => {
  it('a page of unclosed link tags yields one hit, linearly', () => {
  describe('tagsOf line numbers at the edges (round-9 ratification)', () => {
  it('a tag at offset 0 is on line 1', () => {
  it('a tag starting right after the last newline is on the last line, and one at EOF unclosed still counts', () => {
  it('CRLF and lone-LF line endings number the same lines', () => {
  it('every tag of a page with one tag per line lands on its own line, across the binary-search boundaries', () => {
  it('blank lines between tags are counted, not skipped', () => {
  describe('legal-page placeholders: the bounded lookahead (round-9 ratification)', () => {
  const imprint = (text: string) => [{ rel: 'impressum.html', base: 'impressum.html', text, lines: text.split('\n') }];
  it('reports a word slot, never a footnote, a one-letter bracket, or a slot longer than 40', () => {
  it('agrees with the unbounded form on every line of a generated corpus', () => {
  it('a line of open brackets with no letter finishes within one hook event', () => {
  describe('visibleText agrees with the regex it replaced on well-formed pages (round-9 ratification)', () => {
  it('covers a real corpus, not a handful', () => {
  it('produces the same text on every fixture page that closes its script and style blocks', () => {

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

Close with exactly one line, as the last line of your reply, in plain text: no markdown, no bold, no bullet, all three fields on that one line, separated by " | ", in this shape:
STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>
~~~

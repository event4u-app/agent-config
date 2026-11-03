<!-- evidence-type: original-review -->

# Ratification prompt, round 8 — web-launch write-time carrier, its chunk ceiling and a dispatch-ceiling raise (verbatim, as sent 2026-11-02)

~~~text
Ratification review, round 8, of one change touching src/config/hook-bundle-budget.json, a file on this repository's ratification watched set.

subject: 9afab01b1b4cdf242765c6b1c27f762c0ed1e2f954f98fa557f6ae3d84243312

Closed verdicts (ADR-268 § 4): ratified (an approved expansion of what an agent may do) · confirmed-non-expanding (no authority expanded, no gate weakened, no enforcing step made non-enforcing) · refused (must not land).

Context: rounds 1 to 7 reviewed this change with the dispatch-bundle ceiling (max_bytes) unchanged at 1,562,000 (agents/evidence/council/web-launch-write-time-ratification{,-r2,-r3,-r4,-r5,-r6,-r7}-20261102.question.md). Round 7: both seats confirmed-non-expanding; both set DEALBREAKER: yes on test-quality points (the 500 ms threshold is not derived from a requirement; the megabyte cases assert time, not output; the timing sensitivity was shown by a local edit, not by a test). None of those points is changed in this round.

What changed since round 7, and why this is a new subject: origin/main was merged in. On main the dispatch bundle grew to 1,561,921 bytes (gate self-tests now ship in it), leaving 79 bytes under the 1,562,000 ceiling. This change's call site in design_pass_hook adds 1,063 bytes, so the merged bundle reads 1,562,984 bytes, 984 over. This round therefore adds a raise: max_bytes 1,562,000 -> 1,563,500, with a raise_log entry (the file's shrink_only gate fails a raise without one). 1,563,500 is the reading plus 516 bytes, the margin the previous raise (2026-11-01) left (494). The chunk ceiling row (web_launch_rows.chunk.cjs, 14,000 bytes; chunk measures 13,287) is unchanged since round 6.

Full diff against origin/main (src and tests):
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 624c6d74f8..97d14e8e9f 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1562000,
+    "max_bytes": 1563500,
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
+            "to": 1563500,
+            "by": "agent, feat/web-launch-write-time",
+            "what_was_added": "The design_pass_hook call site for the web-launch rows (rows 2.1/2.2 of check_web_launch_readiness at write time): the .html/.css path test, the 1,000,000-character cap, the chunk loader and the degraded-pass reason. The rows themselves stay in web_launch_rows.chunk.cjs. Measured 1,562,984 bytes, 984 over the 1,562,000 ceiling; origin/main alone measures 1,561,921.",
+            "why_it_could_not_be_avoided": "A write-time carrier needs a call site in the dispatch bundle to decide whether to load the chunk; the call site is the 1,063-byte delta, everything else is already in the chunk. The new ceiling is the reading plus 516 bytes, the same margin the 2026-11-01 raise left (494), so an esbuild symbol rename does not red the gate.",
+            "what_would_have_caught_it": "Nothing earlier: the growth is the feature. The headroom it was measured against (1,306 B) was consumed on main by the gate self-tests before this landed."
         }
     ],
     "chunks": [
@@ -213,6 +222,12 @@
             "max_bytes": 10800,
             "registered_at": "2026-10-28",
             "derivation": "Measured 9,807 bytes on 2026-10-28 (the intake-pass concern, its task-prompt and question predicates after council round 1, and the shared `isSyntheticPrompt` reader), no `yaml`. The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on `user_prompt_submit` on every host that binds the slot; the dispatch bundle carries only its LAZY_CONCERNS row. A missing chunk falls back to the spawn path and costs latency, never the line."
+        },
+        {
+            "entry": "src/scripts/hooks/web_launch_rows.ts",
+            "max_bytes": 14000,
+            "registered_at": "2026-11-02",
+            "derivation": "Measured 13,287 bytes on 2026-11-02: rows 2.1 and 2.2, already in the hook Finding shape, of check_web_launch_readiness (third-party load on first paint, superseded statute on a legal page), the 12-row provider register and the one-row supersession table. Loaded by design_pass_hook only for an .html/.css write. The ceiling is that reading plus 713 bytes (5.4 %), rounded up to the next thousand, for register rows that enter one named defect at a time."
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
index ac732f7278..f4907280d0 100644
--- a/src/scripts/hooks/design_pass_hook.ts
+++ b/src/scripts/hooks/design_pass_hook.ts
@@ -93,7 +93,8 @@ import { trigger_matches, type Trigger } from '../_lib/router_match.js';
 import { HANDOVER_SHAPES, isUiPath, isUiTreePath } from '../_lib/ui_surface.js';
 import { loadDesignContext, scanFile } from '../lint_design_slop.js';
 import { readHookStdin } from './hook_stdin.js';
-import { CHUNK_BASENAME, loadSvgScan } from './svg_rules_loader.js';
+import { CHUNK_BASENAME, isBundled, loadSvgScan } from './svg_rules_loader.js';
+import { WEB_LAUNCH_CHUNK, loadWebLaunchScan } from './web_launch_rows_loader.js';
 import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';
 
 const SETTINGS_FILE = '.agent-settings.yml';
@@ -624,6 +625,16 @@ export function render(result: PassResult, conformance?: string): string {
     return lines.join('\n');
 }
 
+/** The written files the web-launch rows read, and the most they read of one. */
+export const WEB_LAUNCH_RE = /\.(html?|css)$/i;
+export const WEB_LAUNCH_MAX_CHARS = 1_000_000;
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
@@ -654,6 +665,7 @@ function main(): number {
     const findings: Finding[] = [];
     let scanFailed: string | null = null;
     let svgRulesUnavailable = false;
+    const webLaunchGaps: string[] = [];
     try {
         const ctx = loadDesignContext(root);
         for (const rel of targets) {
@@ -674,6 +686,13 @@ function main(): number {
                 if (scan === null) svgRulesUnavailable = true;
                 else findings.push(...svgFindings(scan(content, rel) as SvgRuleFinding[], rel));
             }
+            if (WEB_LAUNCH_RE.test(rel)) {
+                // Over the cap, or no chunk in a bundled install: the file is
+                // reported unchecked, never passed as clean.
+                const scan = content.length > WEB_LAUNCH_MAX_CHARS ? null : loadWebLaunchScan();
+                if (scan !== null) findings.push(...scan(rel, content));
+                else if (isBundled() || content.length > WEB_LAUNCH_MAX_CHARS) webLaunchGaps.push(rel);
+            }
             for (const f of scanFile(content, rel, ctx)) {
                 findings.push({
                     file: rel,
@@ -714,15 +733,16 @@ function main(): number {
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
+            `web-launch rows not run: ${webLaunchGaps.join(', ')} (too large, or no ${WEB_LAUNCH_CHUNK})`,
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
diff --git a/tests/hooks/design_pass_web_launch.test.ts b/tests/hooks/design_pass_web_launch.test.ts
new file mode 100644
index 0000000000..590cd76237
--- /dev/null
+++ b/tests/hooks/design_pass_web_launch.test.ts
@@ -0,0 +1,90 @@
+// Rows 2.1 and 2.2 of check_web_launch_readiness reach the agent at write time
+// through design_pass_hook's post_tool_use pass (road-to-a-page-check-at-write-time 1.1).
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+import { pathToFileURL } from 'node:url';
+
+import { describe, expect, it } from 'vitest';
+
+import {
+    WEB_LAUNCH_MAX_CHARS,
+    WEB_LAUNCH_RE,
+    isPassSurface,
+    withDegradation,
+    type PassResult,
+} from '../../src/scripts/hooks/design_pass_hook';
+import { scanWebLaunch } from '../../src/scripts/hooks/web_launch_rows';
+import { WEB_LAUNCH_CHUNK, loadWebLaunchScan } from '../../src/scripts/hooks/web_launch_rows_loader';
+
+const CORPUS = path.resolve(__dirname, '..', 'fixtures', 'third-party-load');
+const read = (rel: string): string => fs.readFileSync(path.join(CORPUS, rel), 'utf8');
+
+describe('design_pass_hook — web-launch rows at write time', () => {
+    it('reads exactly the written .html/.css files, and they are pass surfaces', () => {
+        for (const p of ['site/index.html', 'site/a.htm', 'site/css/site.css']) {
+            expect(WEB_LAUNCH_RE.test(p), p).toBe(true);
+            expect(isPassSurface(p), p).toBe(true);
+        }
+        expect(WEB_LAUNCH_RE.test('app/layout.tsx')).toBe(false);
+        expect(WEB_LAUNCH_RE.test('logo.svg')).toBe(false);
+    });
+
+    it('a page loading Google Fonts surfaces the preconnect and the stylesheet, advisory P2', () => {
+        const f = scanWebLaunch('index.html', read('planted/index.html'));
+        expect(f.map((x) => [x.rule, x.line])).toEqual([
+            ['third-party-load-in-markup', 6],
+            ['third-party-load-in-markup', 7],
+        ]);
+        expect(f.every((x) => x.severity === 'P2' && x.file === 'index.html')).toBe(true);
+    });
+
+    it('a stylesheet @import of the provider surfaces its line', () => {
+        expect(scanWebLaunch('css/site.css', read('planted/css/site.css')).map((x) => x.line)).toEqual([1]);
+    });
+
+    it('an imprint citing the superseded statute surfaces it', () => {
+        const f = scanWebLaunch('impressum.html', read('planted/impressum.html'));
+        expect(f.some((x) => x.rule === 'superseded-statute-in-legal-page' && x.line === 6)).toBe(true);
+    });
+
+    it('the safe twins surface nothing', () => {
+        for (const rel of ['index.html', 'css/site.css', 'kontakt.html', 'ueber-uns.html', 'impressum.html']) {
+            expect(scanWebLaunch(rel, read(`safe/${rel}`)), rel).toEqual([]);
+        }
+    });
+
+    it('the input cap is one megabyte of characters', () => {
+        expect(WEB_LAUNCH_MAX_CHARS).toBe(1_000_000);
+    });
+});
+
+describe('the loader', () => {
+    it('unbundled, returns null (the hook then neither scans nor reports a gap)', () => {
+        expect(loadWebLaunchScan(import.meta.url, false)).toBeNull();
+    });
+
+    it('bundled, reads scanWebLaunch from the chunk beside it, and null when absent', () => {
+        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-chunk-'));
+        try {
+            const self = pathToFileURL(path.join(dir, 'dispatch.js')).href;
+            expect(loadWebLaunchScan(self, true)).toBeNull();
+            fs.writeFileSync(path.join(dir, WEB_LAUNCH_CHUNK), 'exports.scanWebLaunch = () => [{ rule: "x", line: 1 }];');
+            expect(loadWebLaunchScan(self, true)?.('a.html', '')).toHaveLength(1);
+        } finally {
+            fs.rmSync(dir, { recursive: true, force: true });
+        }
+    });
+});
+
+describe('withDegradation — an unchecked file is never a clean pass', () => {
+    const base: PassResult = { slot: 'post_tool_use', findings: [], blocked: [], audit_missing: [], verification: 'verified' };
+
+    it('marks the pass degraded with the reason', () => {
+        expect(withDegradation(base, 'r1')).toMatchObject({ verification: 'degraded', degradation_reason: 'r1' });
+    });
+
+    it('appends to an earlier reason rather than replacing it', () => {
+        expect(withDegradation(withDegradation(base, 'r1'), 'r2').degradation_reason).toBe('r1; r2');
+    });
+});
diff --git a/tests/scripts/web_launch_linear.test.ts b/tests/scripts/web_launch_linear.test.ts
new file mode 100644
index 0000000000..34d7c4a3c8
--- /dev/null
+++ b/tests/scripts/web_launch_linear.test.ts
@@ -0,0 +1,133 @@
+// The web-launch rows read agent-written markup, so they must stay linear on
+// pathological input: a minified single-line page, an unclosed <script>, a page
+// of '<' or '[' with no closer. Ratification round 2 of the write-time carrier
+// found quadratic paths here; each case below reproduced one before the fix.
+import * as path from 'node:path';
+
+import { describe, expect, it } from 'vitest';
+
+import { loadConfig } from '../../src/scripts/check_web_launch_readiness';
+import { classifyLoads, loadRegister, visibleText, writeTimeFindings } from '../../src/scripts/web_launch_third_party';
+
+const REPO = path.resolve(__dirname, '..', '..');
+const register = loadRegister(REPO, '2026-11-02');
+const table = loadConfig(REPO).supersessions;
+const N = 200_000;
+
+const loads = (rel: string, body: string): string[] =>
+    writeTimeFindings(rel, body, register, table).filter((h) => h.check === 'third-party-load-in-markup').map((h) => `${String(h.line)}`);
+const unread = (rel: string, body: string): string[] =>
+    writeTimeFindings(rel, body, register, table).filter((h) => h.check === 'third-party-load-unread').map((h) => `${String(h.line)}`);
+
+const timed = (fn: () => unknown): number => {
+    const t = performance.now();
+    fn();
+    return performance.now() - t;
+};
+
+const CASES: Record<string, string> = {
+    'unclosed script tags on one line': '<script>'.repeat(N / 8),
+    'opening angle brackets with no closer': '<'.repeat(N),
+    'link tags with no closer': '<link rel=stylesheet href=x'.repeat(N / 28),
+    'brackets with no closer': '[Firmenname'.repeat(N / 11),
+};
+
+describe('linear on pathological input', () => {
+    for (const [name, body] of Object.entries(CASES)) {
+        it(`${name} (${String(body.length)} chars) finishes fast in an imprint`, () => {
+            const ms = timed(() => writeTimeFindings('impressum.html', body, register, table));
+            expect(ms).toBeLessThan(1_000);
+        });
+    }
+
+    it('visibleText drops an unclosed script to the end, linearly', () => {
+        expect(visibleText('<p>a</p><script>x')).toBe('a');
+        expect(timed(() => visibleText('<script>'.repeat(N / 8)))).toBeLessThan(500);
+    });
+
+    it('a minified page still reports its statute citation', () => {
+        const page = `<html><body>${'<p>x</p>'.repeat(200)}<p>Angaben gemäß § 5 TMG</p></body></html>`;
+        expect(writeTimeFindings('impressum.html', page, register, table).some((h) => h.check === 'superseded-statute-in-legal-page')).toBe(true);
+    });
+});
+
+describe('tags are found whatever the line layout (round-3 ratification)', () => {
+
+    it('a <link> wrapped over several lines by a formatter is found, on the line it starts', () => {
+        const page = '<head>\n  <link\n    rel="stylesheet"\n    href="https://fonts.googleapis.com/css2?family=Inter"\n  />\n</head>';
+        expect(loads('index.html', page)).toEqual(['2']);
+    });
+
+    it('a minified single-line page still reports its third-party loads', () => {
+        const page = `<html><head>${'<meta name="x" content="y">'.repeat(40)}<link rel="stylesheet" href="https://fonts.googleapis.com/css2"><iframe src="https://www.youtube.com/embed/x"></iframe></head></html>`;
+        expect(loads('index.html', page)).toEqual(['1', '1']);
+    });
+
+    it('a canonical link wrapped over lines still marks the host as the site itself', () => {
+        const page = '<link\n rel="canonical"\n href="https://shop.example/"\n><script src="https://shop.example/app.js"></script>';
+        const file = { rel: 'index.html', base: 'index.html', text: page, lines: page.split('\n') };
+        const c = classifyLoads([file], register);
+        expect([c.findings, c.undecided]).toEqual([[], []]);
+        // Without the canonical, the same script is an unknown third party.
+        const bare = '<script src="https://shop.example/app.js"></script>';
+        expect(classifyLoads([{ ...file, text: bare, lines: [bare] }], register).undecided).toHaveLength(1);
+    });
+
+    it('a click-to-load iframe carrying only data-src is not a load', () => {
+        const page = '<iframe data-src="https://www.youtube.com/embed/x" title="Video"></iframe>';
+        expect(loads('ueber-uns.html', page)).toEqual([]);
+    });
+
+    it('an unterminated tag does not hide the next one, and is itself reported as unread', () => {
+        const page = `<link rel="stylesheet" href="https://fonts.googleapis.com/a" ${'x'.repeat(5_000)}\n<link rel="stylesheet" href="https://fonts.googleapis.com/b">`;
+        expect(loads('index.html', page)).toEqual(['2']);
+        expect(unread('index.html', page)).toEqual(['1']);
+    });
+});
+
+describe('a long tag is read, an unclosed one is never a silent pass (round-5 ratification)', () => {
+    it('a closed tag padded far past any window is still read', () => {
+        const page = `<link data-pad="${'x'.repeat(5_000)}" rel="stylesheet" href="https://fonts.googleapis.com/a">`;
+        expect(loads('index.html', page)).toEqual(['1']);
+    });
+
+    it('an inline base64 image before a load does not hide the load', () => {
+        const page = `<img src="data:image/png;base64,${'A'.repeat(20_000)}">\n<link rel="stylesheet" href="https://fonts.googleapis.com/a">`;
+        expect(loads('index.html', page)).toEqual(['2']);
+        expect(unread('index.html', page)).toEqual([]);
+    });
+
+    it('a loadable tag with no closer at all is reported once per file, with its count', () => {
+        const page = `<p>a</p>\n<link rel="stylesheet" href="https://fonts.googleapis.com/a"\n<script src="https://x.example/a.js"`;
+        const hits = writeTimeFindings('index.html', page, register, table).filter((h) => h.check === 'third-party-load-unread');
+        expect(hits.map((h) => h.line)).toEqual([2]);
+        expect(hits[0]?.text).toMatch(/2 loadable tags/);
+    });
+
+    it('the checker counts the same file undecided, never clean', () => {
+        const page = '<link rel="stylesheet" href="https://fonts.googleapis.com/a"';
+        const c = classifyLoads([{ rel: 'index.html', base: 'index.html', text: page, lines: [page] }], register);
+        expect(c.findings).toEqual([]);
+        expect(c.undecided).toHaveLength(1);
+    });
+
+    it('an unclosed tag before a closed one leaves the closed one read', () => {
+        const page = '<link rel="stylesheet" href="https://fonts.googleapis.com/a"\n<script src="https://www.youtube.com/s.js"></script>';
+        expect(loads('index.html', page)).toEqual(['2']);
+        expect(unread('index.html', page)).toEqual(['1']);
+    });
+
+    it('sparse unclosed tags in a megabyte file read the text once, with or without a final closer', () => {
+        const gap = 'x'.repeat(99_990);
+        const sparse = Array.from({ length: 10 }, () => `<link href=x${gap}`).join('');
+        const dense = '<link '.repeat(166_000);
+        for (const body of [sparse, `${sparse}>`, `<link href=x${'x'.repeat(999_000)}`, dense]) {
+            expect(timed(() => writeTimeFindings('index.html', body, register, table))).toBeLessThan(500);
+        }
+    });
+
+    it('a page of unclosed link tags yields one hit, linearly', () => {
+        const body = '<link rel=stylesheet href=x'.repeat(N / 28);
+        expect(timed(() => expect(unread('index.html', body)).toHaveLength(1))).toBeLessThan(1_000);
+    });
+});

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

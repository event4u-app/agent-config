<!-- evidence-type: original-review -->

# Ratification prompt, round 13 — web-launch write-time carrier and its chunk ceiling, after main absorbed the dispatch raise (verbatim, as sent 2026-11-03)

~~~text
Ratification review, round 13, of one change touching src/config/hook-bundle-budget.json, a file on this repository's ratification watched set.

subject: 3846af2b354e00f4b09a67b875eead8e0d848646883c2110c28218445061b49a

Closed verdicts (ADR-268 § 4): ratified (an approved expansion of what an agent may do) · confirmed-non-expanding (no authority expanded, no gate weakened, no enforcing step made non-enforcing) · refused (must not land).

Context: rounds 1 to 12 reviewed this change (agents/evidence/council/web-launch-write-time-ratification{,-r2,...,-r12}-2026110{2,3}.question.md). Round 12 split: one seat ratified, one refused (DEALBREAKER: yes), on two grounds: an unbundled run (a source checkout, not an installed bundle) skips the web-launch scan without a degraded note, and the scan has no size or time bound. The repository owner was asked and decided to land the change despite the split; the record agents/evidence/ratifications/web-launch-write-time-20261102.md states that decision. Since then main moved: its dispatch ceiling was raised by an unrelated change to 1,578,600, and this branch merged it. The subject changed for that reason only.

What changed in the watched file: this branch no longer raises max_bytes. Its raise_log entry is gone; the bundle measures 1,577,188 of main's 1,578,600. The only change to hook-bundle-budget.json is one chunks row: src/scripts/hooks/web_launch_rows.ts, ceiling 14,000, measured 13,287.

What the change does (unchanged since round 12): design_pass_hook, on a dispatched post_tool_use write of an .html/.css file, runs rows 2.1 (third-party load on first paint) and 2.2 (superseded statute on a legal page) of check_web_launch_readiness over that one file and returns them as P2 findings in the pass's additionalContext; the post_tool_use pass exits allow, as it does for every other design finding. The rows live in that chunk, loaded only for such a write. A bundled install whose chunk is missing gets a degraded pass naming the files not checked. There is no size cap (round 10 held the 1,000,000-character cap to be a padding bypass); the scan is linear, at most 41 ms per 1,000,000 characters across four padding shapes and at most 400 ms on 10,000,000 tag-dense characters, and a test pads a page past 4,000,000 characters before and after its loads and expects both findings, red with the cap restored. In an unbundled source run the loader returns null and no scan or note happens; installs ship the bundle.

Scope of what is shown: the full diff of src at three lines of context, and of tests only every added describe/it line, extracted mechanically (git diff -U0 of tests, added lines matching describe( or it(, unfiltered). The full test diff does not fit the council bundle ceiling of 51,200 bytes; this boundary was set by the repository owner, not by the author.

Full diff against origin/main (src):
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 9010525d22..122a73a34d 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -231,6 +231,12 @@
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
  describe('a written page reaches the agent through the bundled dispatcher', () => {
  it('a page loading Google Fonts surfaces both loads, with file and line', () => {
  it('a stylesheet @import of the provider surfaces line 1', () => {
  it('the safe twin surfaces no web-launch row, and the pass did not degrade for it', () => {
  it('no size lets a load go unreported: a page padded past 4,000,000 characters, before or after its loads, still surfaces both', () => {
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

<!-- evidence-type: original-review -->

# Ratification prompt, round 2 — web-launch write-time carrier and its chunk ceiling (verbatim, as sent 2026-11-02)

~~~text
Ratification review, round 2, of one change touching src/config/hook-bundle-budget.json, a file on this repository's ratification watched set.

subject: a0b47ca5f2f0ac2ef056df3f701fcb3bc10097f0bfe6ef18c9f88959577506bd

Closed verdicts (ADR-268 § 4):
- ratified: the change expands what an agent may do, and that expansion is approved
- confirmed-non-expanding: the change does not expand any authority, weaken any gate, or make an enforcing step non-enforcing
- refused: the change must not land

What round 1 asked, and what changed:
1. "The SVG loader refactor is in the diff although claimed separate." It is a separate PR (#2800, refactor/hook-chunk-loader, behaviour-neutral, no gated file). This change is stacked on it; the diff below is THIS change only (refactor/hook-chunk-loader...HEAD).
2. "writeTimeFindings is not shown, so the parse claims are unauditable." Its full source and every function it calls is included below, verbatim.
3. "Unbounded input size." The call site now reads a written file only when it is at most 1,000,000 characters (WEB_LAUNCH_MAX_CHARS).
4. "Silent degradation if the chunk fails to load." A file over the cap, or a bundled install with no (or an integrity-mismatched) chunk, now marks the pass `degraded` with the file named, through a shared withDegradation that the existing SVG branch also uses (appending, never overwriting an earlier reason). Unbundled source runs skip the rows without a degradation, because there is no chunk to expect.
5. "Non-HTML/CSS writes pay the regex/function overhead." The extension test is at the call site; other writes skip the branch.
6. "No tests." tests/hooks/design_pass_web_launch.test.ts (in the diff): planted findings with lines, safe twins silent, extension predicate, the cap, the loader (unbundled null, bundled present/absent), and withDegradation appending.
The ceiling: max_bytes is NOT raised (1,562,000). Dispatch bundle measured 1,561,886 B with this change on an APFS-cloned node_modules; the one gated edit is a new `chunks` row (ceiling 13,000 for the 11,467-byte chunk), which the composition gate requires for every chunk hook_chunks.mjs builds.

Regex construction: every regular expression in the rows is a compile-time literal, except one built per supersession row from the config's `pattern` field (a repository-authored file, not written by the agent); no regex is built from the scanned content. Every scanning regex is linear: tag matchers are `<link\b[^>]*>` and `<(tag)\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>`, which contain no nested quantifiers.

Diff of this change:
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 624c6d74f8..c7a88b6b6e 100644
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
+            "derivation": "Measured 11,467 bytes on 2026-11-02: rows 2.1 and 2.2, already in the hook Finding shape, of check_web_launch_readiness (third-party load on first paint, superseded statute on a legal page), the 12-row provider register and the one-row supersession table. Loaded by design_pass_hook only for an .html/.css write. The ceiling is that reading plus about 15 %, rounded, for register rows that enter one named defect at a time."
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


src/scripts/web_launch_third_party.ts — the functions writeTimeFindings reaches, verbatim:

/** Load the register; a lapsed or malformed `review_by` is an error, not a warning. */
export function loadRegister(root: string, asOf: string): OriginRow[] {
    const doc = JSON.parse(fs.readFileSync(path.join(root, REGISTER_REL), 'utf-8')) as {
        origins?: OriginRow[];
    };
    const rows = doc.origins ?? [];
    const bad: string[] = [];
    for (const r of rows) {
        if (!ISO.test(r.review_by ?? '')) bad.push(`${r.host}: review_by "${r.review_by}" is not YYYY-MM-DD`);
        else if (r.review_by < asOf) bad.push(`${r.host}: review_by lapsed on ${r.review_by} (as of ${asOf})`);
        if ((r.privacy_tokens ?? []).length === 0) bad.push(`${r.host}: no privacy_tokens`);
        if ((r.evidence ?? '').trim() === '') bad.push(`${r.host}: no evidence — a row enters with the defect that evidences it`);
    }
    if (bad.length > 0) throw new Error(`${REGISTER_REL}:\n  - ${bad.join('\n  - ')}`);
    return rows;
}

const isPage = (f: FileLike): boolean => /\.html?$/i.test(f.base);
const isCss = (f: FileLike): boolean => /\.css$/i.test(f.base);

/** Past this, a line is a bundler artefact; its contents are reported undecided. */
const MINIFIED = 400;

/**
 * Loadable contexts only. An anchor is followed by the visitor, prose is not
 * markup, and a `dns-prefetch` hint resolves a name without contacting the
 * provider — it is reported undecided, never as a load.
 */
const LINK_RE = /<link\b[^>]*>/gi;
const SRC_TAG_RE = /<(script|iframe|img|video|audio|source|embed)\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
const CSS_IMPORT_RE = /@import\s+(?:url\(\s*)?["']?((?:https?:)?\/\/[^"')\s]+)/gi;
const CSS_URL_RE = /\burl\(\s*["']?((?:https?:)?\/\/[^"')\s]+)/gi;
const LOAD_RELS = new Set(['stylesheet', 'preconnect', 'preload', 'modulepreload', 'icon']);

/** A file-level marker that a load may sit behind a consent or click-to-load gate. */
const GATE_RE = /(click-to-load|data-consent|consent|cookiebanner|cookie-banner|cookieconsent|klaro|usercentrics|borlabs|osano)/i;

interface Load {
    file: string;
    line: number;
    url: URL;
    how: string;
}

function absolute(raw: string): URL | null {
    const s = raw.startsWith('//') ? `https:${raw}` : raw;
    if (!/^https?:\/\//i.test(s)) return null;
    try {
        return new URL(s);
    } catch {
        return null;
    }
}

function attr(tag: string, name: string): string | undefined {
    return new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1];
}

/** Hosts the build itself claims through rel="canonical" — absolute self-references, not third parties. */
function ownHosts(files: readonly FileLike[]): Set<string> {
    const out = new Set<string>();
    for (const f of files.filter(isPage)) {
        for (const tag of f.text.match(LINK_RE) ?? []) {
            if ((attr(tag, 'rel') ?? '').toLowerCase() !== 'canonical') continue;
            const u = absolute(attr(tag, 'href') ?? '');
            if (u !== null) out.add(u.host.toLowerCase());
        }
    }
    return out;
}

interface Extracted {
    loads: Load[];
    prefetch: Hit[];
    minified: Hit[];
}

export function extractLoads(files: readonly FileLike[]): Extracted {
    const own = ownHosts(files);
    const loads: Load[] = [];
    const prefetch: Hit[] = [];
    const minified: Hit[] = [];
    const push = (f: FileLike, i: number, raw: string, how: string): void => {
        const url = absolute(raw);
        if (url === null || own.has(url.host.toLowerCase())) return;
        loads.push({ file: f.rel, line: i + 1, url, how });
    };
    for (const f of files) {
        if (!isPage(f) && !isCss(f)) continue;
        f.lines.forEach((line, i) => {
            if (line.length > MINIFIED && /https?:\/\//i.test(line)) {
                minified.push({
                    file: f.rel,
                    line: i + 1,
                    text: `this line is ${String(line.length)} characters (minified); its third-party references are undecided.`,
                });
                return;
            }
            if (isPage(f)) {
                for (const tag of line.match(LINK_RE) ?? []) {
                    const rels = (attr(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
                    const href = attr(tag, 'href') ?? '';
                    if (rels.includes('dns-prefetch')) {
                        const u = absolute(href);
                        if (u !== null && !own.has(u.host.toLowerCase())) {
                            prefetch.push({
                                file: f.rel,
                                line: i + 1,
                                text: `dns-prefetch for \`${u.host}\` resolves a name without a request to the provider; whether a load follows is undecided.`,
                            });
                        }
                        continue;
                    }
                    const rel = rels.find((r) => LOAD_RELS.has(r));
                    if (rel !== undefined) push(f, i, href, `<link rel="${rel}">`);
                }
                for (const m of line.matchAll(SRC_TAG_RE)) push(f, i, m[2] ?? '', `<${(m[1] ?? '').toLowerCase()} src>`);
            }
            // CSS rules, in a stylesheet or an inline <style> block of a page.
            for (const m of line.matchAll(CSS_IMPORT_RE)) push(f, i, m[1] ?? '', 'CSS @import');
            if (!/@import/i.test(line)) {
                for (const m of line.matchAll(CSS_URL_RE)) push(f, i, m[1] ?? '', 'CSS url()');
            }
        });
    }
    return { loads, prefetch, minified };
}

export function resolveOrigin(url: URL, register: readonly OriginRow[]): OriginRow | undefined {
    const host = url.host.toLowerCase();
    return register.find(
        (r) => r.host.toLowerCase() === host && (r.path_prefix === undefined || url.pathname.startsWith(r.path_prefix)),
    );
}

interface Classified {
    findings: Hit[];
    undecided: Hit[];
    loaded: Map<string, OriginRow>;
}

/** 2.1 — split the loads into findings and undecided, with the providers that load. */
export function classifyLoads(files: readonly FileLike[], register: readonly OriginRow[]): Classified {
    const { loads, prefetch, minified } = extractLoads(files);
    const gated = new Set(files.filter((f) => GATE_RE.test(f.text)).map((f) => f.rel));
    const findings: Hit[] = [];
    const undecided: Hit[] = [...prefetch, ...minified];
    const loaded = new Map<string, OriginRow>();
    for (const l of loads) {
        const row = resolveOrigin(l.url, register);
        if (row === undefined) {
            undecided.push({
                file: l.file,
                line: l.line,
                text: `${l.how} requests \`${l.url.host}\`, an unknown third party (not in ${REGISTER_REL}); its provider is undecided.`,
            });
            continue;
        }
        // Analytics ordering is `analytics-and-consent-wiring`'s question, and it
        // answers it with source order this row does not read. Reporting the same
        // tag here would make one script two findings. It still counts as LOADED
        // for privacy-page coverage unless a gate sits in its file.
        if (row.category === 'analytics') {
            if (!gated.has(l.file)) loaded.set(row.provider, row);
            continue;
        }
        if (gated.has(l.file)) {
            undecided.push({
                file: l.file,
                line: l.line,
                text:
                    `${l.how} loads \`${l.url.host}\` (${row.provider}) in a file that also carries a consent or ` +
                    'click-to-load mechanism; whether the request waits for it is undecided statically.',
            });
            continue;
        }
        loaded.set(row.provider, row);
        const extra = l.how === '<link rel="preconnect">' ? ' — a connection carrying the visitor IP opens before any request' : '';
        findings.push({
            file: l.file,
            line: l.line,
            text: `${l.how} loads \`${l.url.host}\` (${row.provider}, ${row.category}) on first paint, before any visitor interaction${extra}.`,
        });
    }
    return { findings, undecided, loaded };
}

const IMPRINT_RE = /(impressum|imprint|legal-notice)/i;
const PRIVACY_RE = /(datenschutz|privacy)/i;
const legalPages = (files: readonly FileLike[], re: RegExp): FileLike[] =>
    files.filter((f) => isPage(f) && re.test(f.rel.replace(/\\/g, '/')));

/** Visible text of a page: tags, scripts and styles removed. */
export function visibleText(html: string): string {
    return html
        .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** 2.2 — a located imprint citing a provision the supersession table marks replaced. */
export function supersededStatute(files: readonly FileLike[], table: readonly Supersession[]): Hit[] {
    const hits: Hit[] = [];
    for (const f of legalPages(files, IMPRINT_RE)) {
        f.lines.forEach((line, i) => {
            const text = visibleText(line);
            for (const s of table) {
                if (!new RegExp(s.pattern, 'i').test(text)) continue;
                hits.push({
                    file: f.rel,
                    line: i + 1,
                    text: `cites ${s.cites}; superseded on ${s.effective} by ${s.replaced_by} (authority: ${s.authority.split(' -- ')[0]}).`,
                });
            }
export interface WriteTimeHit extends Hit {
    check: 'third-party-load-in-markup' | 'superseded-statute-in-legal-page';
}

/**
 * The write-time half (road-to-a-page-that-says-what-it-loads 4.2): rows 2.1 and
 * 2.2 over ONE file the agent just wrote, for `design_pass_hook`. Findings only —
 * an undecided needs the whole build and is left to the checker.
 */
export function writeTimeFindings(
    rel: string,
    content: string,
    register: readonly OriginRow[],
    supersessions: readonly Supersession[],
): WriteTimeHit[] {
    if (!/\.(html?|css)$/i.test(rel)) return [];
    const file: FileLike = { rel, base: path.basename(rel), text: content, lines: content.split('\n') };
    return [
        ...classifyLoads([file], register).findings.map((h) => ({ ...h, check: 'third-party-load-in-markup' as const })),
        ...supersededStatute([file], supersessions).map((h) => ({ ...h, check: 'superseded-statute-in-legal-page' as const })),
    ];
}

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

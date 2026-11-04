<!-- evidence-type: original-review -->

# Ratification prompt, round 3 — web-launch write-time carrier and its chunk ceiling (verbatim, as sent 2026-11-02)

~~~text
Ratification review, round 3, of one change touching src/config/hook-bundle-budget.json, a file on this repository's ratification watched set.

subject: bf2e4e28c7375b23967b99dc1bf73b6ef56c641acce96709962597908e2df03d

Closed verdicts (ADR-268 § 4): ratified · confirmed-non-expanding · refused (definitions as in rounds 1 and 2: ratified = an approved expansion of what an agent may do; confirmed-non-expanding = no authority expanded, no gate weakened, no enforcing step made non-enforcing; refused = must not land).

The round-2 prompt (agents/evidence/council/web-launch-write-time-ratification-r2-20261102.question.md) carried the full change and every function writeTimeFindings reaches. Round 2: one seat ratified; one refused on quadratic-time paths over agent-written markup and asked for (1) a per-line cap, (2) hoisting supersession regex compilation out of the line loop, (3) a test with a large single-line file.

What changed since round 2 (diff below, src and tests only):
- Reproduced first: a 200,000-character imprint of unclosed '<' took 11.5 s; a line of unclosed '<link' tags 1.3 s.
- visibleText is a single forward pass with indexOf, no regex over tags; an unclosed tag, script or style swallows the rest of the input. This removes the lazy script matcher and the '<[^>]+>' matcher the refusal named.
- Per-line cap: a line longer than MINIFIED (400 characters) is never searched for tags, in extractLoads and in ownHosts (which previously ran the link matcher over the whole file text). A long line naming a URL is reported undecided, as before.
- The placeholder lookahead is bounded ({0,40}); supersession patterns compile once per call, not per line.
- tests/scripts/web_launch_linear.test.ts times four pathological 200,000-character shapes (unclosed script tags, bare '<', unclosed link tags, unclosed '[') under 1 s each; all four now finish in well under that, and a minified imprint still reports its statute citation.
- Both the write-time carrier and the already-merged checker share these functions, so the fix hardens both.
Unchanged since round 2: max_bytes is not raised (1,562,000; dispatch bundle 1,561,886 B); the one gated edit is the chunk ceiling row (13,000 for a 12,071-byte chunk); the 1,000,000-character input cap and the degraded-not-clean reporting at the call site.

On the round-2 refusal's other points, answered rather than changed: a renamed extension (.xhtml) or an ignored advisory finding is out of reach for a post-write advisory pass by design; the same rows run in check_web_launch_readiness over the build, which is where a page is audited. The pass is advisory and exits 0, so it cannot block or be used to block a write.

Diff since round 2:
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index c7a88b6b6e..a6c07dea2d 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -218,7 +218,7 @@
             "entry": "src/scripts/hooks/web_launch_rows.ts",
             "max_bytes": 13000,
             "registered_at": "2026-11-02",
-            "derivation": "Measured 11,467 bytes on 2026-11-02: rows 2.1 and 2.2, already in the hook Finding shape, of check_web_launch_readiness (third-party load on first paint, superseded statute on a legal page), the 12-row provider register and the one-row supersession table. Loaded by design_pass_hook only for an .html/.css write. The ceiling is that reading plus about 15 %, rounded, for register rows that enter one named defect at a time."
+            "derivation": "Measured 12,071 bytes on 2026-11-02: rows 2.1 and 2.2, already in the hook Finding shape, of check_web_launch_readiness (third-party load on first paint, superseded statute on a legal page), the 12-row provider register and the one-row supersession table. Loaded by design_pass_hook only for an .html/.css write. The ceiling is that reading plus about 15 %, rounded, for register rows that enter one named defect at a time."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
diff --git a/src/scripts/web_launch_third_party.ts b/src/scripts/web_launch_third_party.ts
index 82555f6136..0035d6bbf3 100644
--- a/src/scripts/web_launch_third_party.ts
+++ b/src/scripts/web_launch_third_party.ts
@@ -119,7 +119,7 @@ function attr(tag: string, name: string): string | undefined {
 function ownHosts(files: readonly FileLike[]): Set<string> {
     const out = new Set<string>();
     for (const f of files.filter(isPage)) {
-        for (const tag of f.text.match(LINK_RE) ?? []) {
+        for (const tag of f.lines.filter((l) => l.length <= MINIFIED).flatMap((l) => l.match(LINK_RE) ?? [])) {
             if ((attr(tag, 'rel') ?? '').toLowerCase() !== 'canonical') continue;
             const u = absolute(attr(tag, 'href') ?? '');
             if (u !== null) out.add(u.host.toLowerCase());
@@ -147,12 +147,16 @@ export function extractLoads(files: readonly FileLike[]): Extracted {
     for (const f of files) {
         if (!isPage(f) && !isCss(f)) continue;
         f.lines.forEach((line, i) => {
-            if (line.length > MINIFIED && /https?:\/\//i.test(line)) {
-                minified.push({
-                    file: f.rel,
-                    line: i + 1,
-                    text: `this line is ${String(line.length)} characters (minified); its third-party references are undecided.`,
-                });
+            // A line past MINIFIED is never searched for tags: an unclosed tag
+            // matcher over a long line is quadratic. One naming a URL is undecided.
+            if (line.length > MINIFIED) {
+                if (/https?:\/\//i.test(line)) {
+                    minified.push({
+                        file: f.rel,
+                        line: i + 1,
+                        text: `this line is ${String(line.length)} characters (minified); its third-party references are undecided.`,
+                    });
+                }
                 return;
             }
             if (isPage(f)) {
@@ -249,24 +253,42 @@ const PRIVACY_RE = /(datenschutz|privacy)/i;
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
@@ -282,7 +304,7 @@ export function supersededStatute(files: readonly FileLike[], table: readonly Su
  * 2.3 — a bracketed template token left in a legal page. A bracket holding a
  * number (`[1]`) is a footnote; one holding a word is a slot nobody filled.
  */
-const PLACEHOLDER_RE = /\[(?=[^\]\d]*[A-Za-zÄÖÜäöüß])[^\]\d]{2,40}\]|\blorem\s+ipsum\b/i;
+const PLACEHOLDER_RE = /\[(?=[^\]\d]{0,40}[A-Za-zÄÖÜäöüß])[^\]\d]{2,40}\]|\blorem\s+ipsum\b/i;
 
 export function legalPagePlaceholders(files: readonly FileLike[]): Hit[] {
     const hits: Hit[] = [];
diff --git a/tests/scripts/web_launch_linear.test.ts b/tests/scripts/web_launch_linear.test.ts
new file mode 100644
index 0000000000..6eed3b8b7d
--- /dev/null
+++ b/tests/scripts/web_launch_linear.test.ts
@@ -0,0 +1,47 @@
+// The web-launch rows read agent-written markup, so they must stay linear on
+// pathological input: a minified single-line page, an unclosed <script>, a page
+// of '<' or '[' with no closer. Ratification round 2 of the write-time carrier
+// found quadratic paths here; each case below reproduced one before the fix.
+import * as path from 'node:path';
+
+import { describe, expect, it } from 'vitest';
+
+import { loadConfig } from '../../src/scripts/check_web_launch_readiness';
+import { loadRegister, visibleText, writeTimeFindings } from '../../src/scripts/web_launch_third_party';
+
+const REPO = path.resolve(__dirname, '..', '..');
+const register = loadRegister(REPO, '2026-11-02');
+const table = loadConfig(REPO).supersessions;
+const N = 200_000;
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

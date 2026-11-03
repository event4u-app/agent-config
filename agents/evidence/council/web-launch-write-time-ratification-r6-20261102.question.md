<!-- evidence-type: original-review -->

# Ratification prompt, round 6 — web-launch write-time carrier and its chunk ceiling (verbatim, as sent 2026-11-02)

~~~text
Ratification review, round 6, of one change touching src/config/hook-bundle-budget.json, a file on this repository's ratification watched set.

subject: c8ed9c1350cc667c7623e4d5d4ea49e64ad0a6fcb63ea88e6853ee9980c82497

Closed verdicts (ADR-268 § 4): ratified (an approved expansion of what an agent may do) · confirmed-non-expanding (no authority expanded, no gate weakened, no enforcing step made non-enforcing) · refused (must not land).

Context: rounds 2 to 5 carried the change and its scanning functions (agents/evidence/council/web-launch-write-time-ratification-r{2,3,4,5}-20261102.question.md). Round 5: both seats refused. Their named defects, and what this round does about each:

1. "A tag not closed within the 2,000-character window is skipped silently; the old undecided fallback for long lines is gone, so a missed load reads as all clear." Changed. An unclosed loadable tag is no longer dropped: each page carrying one or more is reported once, with the count and the first line, as undecided in the checker (classifyLoads().undecided) and as a P2 hint `third-party-load-unread` at write time. Tested: two unclosed tags give one hit on line 2 naming 2 tags; the checker puts the same file in undecided with no finding.
2. "The 2,000-character window is an evasion path: pad a tag past it and it is skipped." The window is removed. A tag now runs to the first '>' after its start, of any length, unless another tag start comes first (then it is unclosed, see 1). Each character belongs to at most one tag, and the search for the next '>' only moves forward, so the scan stays linear without a length cap. Tested: a closed <link> padded with a 5,000-character attribute is read; a 20,000-character inline base64 <img> before a font link neither hides the link nor counts as unread.
3. "The chunk ceiling derivation does not check out: 13,000 is not 12,296 plus 15 %." Correct, the stated percentage was wrong. The chunk is now 13,287 bytes (the fix above), the row is 14,000, and the derivation states the arithmetic: plus 713 bytes (5.4 %), rounded up to the next thousand. max_bytes of the dispatch bundle is not raised (1,562,000; bundle 1,561,886 B).
4. "attr() recompiles its regex on every call." Changed: one compiled pattern per attribute name, cached.
5. "The line-start array grows with the file's line count." Kept: the hook does not scan a file over 1,000,000 characters (WEB_LAUNCH_MAX_CHARS) and reports such a file as an unchecked gap, so the array is bounded by that cap.
6. "The data-src test does not show the old behaviour failing." Not changed in this round.

Performance on the pathological shapes (about 200,000 characters each): 0-9 ms; a page of unclosed <link> tags yields one hit in 2 ms.

Diff since round 5 (src and tests):
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index ad2467a24e..2b1ef71dc6 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -216,9 +216,9 @@
         },
         {
             "entry": "src/scripts/hooks/web_launch_rows.ts",
-            "max_bytes": 13000,
+            "max_bytes": 14000,
             "registered_at": "2026-11-02",
-            "derivation": "Measured 12,296 bytes on 2026-11-02: rows 2.1 and 2.2, already in the hook Finding shape, of check_web_launch_readiness (third-party load on first paint, superseded statute on a legal page), the 12-row provider register and the one-row supersession table. Loaded by design_pass_hook only for an .html/.css write. The ceiling is that reading plus about 15 %, rounded, for register rows that enter one named defect at a time."
+            "derivation": "Measured 13,287 bytes on 2026-11-02: rows 2.1 and 2.2, already in the hook Finding shape, of check_web_launch_readiness (third-party load on first paint, superseded statute on a legal page), the 12-row provider register and the one-row supersession table. Loaded by design_pass_hook only for an .html/.css write. The ceiling is that reading plus 713 bytes (5.4 %), rounded up to the next thousand, for register rows that enter one named defect at a time."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
diff --git a/src/scripts/web_launch_third_party.ts b/src/scripts/web_launch_third_party.ts
index e368b73d1f..179b98886e 100644
--- a/src/scripts/web_launch_third_party.ts
+++ b/src/scripts/web_launch_third_party.ts
@@ -83,13 +83,13 @@ const isCss = (f: FileLike): boolean => /\.css$/i.test(f.base);
  * provider — it is reported undecided, never as a load.
  *
  * Tags are found over the WHOLE file text, not per line, so a tag a formatter
- * wrapped over several lines and a minified one-line page are both read. Each
- * tag is closed within MAX_TAG characters of its start or skipped: the window is
- * what keeps the scan linear on a page of unterminated `<link`, and a tag longer
- * than that is not one a browser was meant to load.
+ * wrapped over several lines and a minified one-line page are both read. A tag
+ * runs to the first `>` after it, of any length, unless another tag start comes
+ * first: then it is unclosed. Each character belongs to at most one tag, which
+ * keeps the scan linear on a page of unterminated `<link`. An unclosed tag is
+ * never dropped silently — the file is reported as carrying unread tags.
  */
 const TAG_START_RE = /<(link|script|iframe|img|video|audio|source|embed)\b/gi;
-const MAX_TAG = 2_000;
 const CSS_IMPORT_RE = /@import\s+(?:url\(\s*)?["']?((?:https?:)?\/\/[^"')\s]+)/gi;
 const CSS_URL_RE = /\burl\(\s*["']?((?:https?:)?\/\/[^"')\s]+)/gi;
 const LOAD_RELS = new Set(['stylesheet', 'preconnect', 'preload', 'modulepreload', 'icon']);
@@ -115,14 +115,22 @@ function absolute(raw: string): URL | null {
 }
 
 /** The attribute itself — preceded by whitespace, so `data-src` is never read as `src`. */
+const ATTR_RE = new Map<string, RegExp>();
 function attr(tag: string, name: string): string | undefined {
-    return new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1];
+    let re = ATTR_RE.get(name);
+    if (re === undefined) {
+        re = new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i');
+        ATTR_RE.set(name, re);
+    }
+    return re.exec(tag)?.[1];
 }
 
 interface Tag {
     name: string;
+    /** Empty when the tag is unclosed. */
     tag: string;
     line: number;
+    closed: boolean;
 }
 
 /** Every loadable tag of a page with the 1-based line it starts on. Linear: one window per tag start. */
@@ -139,13 +147,18 @@ export function tagsOf(text: string): Tag[] {
         }
         return lo + 1;
     };
+    const found = [...text.matchAll(TAG_START_RE)];
     const out: Tag[] = [];
-    for (const m of text.matchAll(TAG_START_RE)) {
+    // The next `>` only moves forward, so all the searches together read the text once.
+    let gt = -2;
+    found.forEach((m, k) => {
         const at = m.index ?? 0;
-        const close = text.slice(at, at + MAX_TAG).indexOf('>');
-        if (close < 0) continue;
-        out.push({ name: (m[1] ?? '').toLowerCase(), tag: text.slice(at, at + close + 1), line: lineAt(at) });
-    }
+        if (gt !== -1 && gt < at) gt = text.indexOf('>', at);
+        const next = found[k + 1]?.index ?? Number.POSITIVE_INFINITY;
+        const name = (m[1] ?? '').toLowerCase();
+        const closed = gt !== -1 && gt < next;
+        out.push({ name, tag: closed ? text.slice(at, gt + 1) : '', line: lineAt(at), closed });
+    });
     return out;
 }
 
@@ -154,7 +167,7 @@ function ownHosts(files: readonly FileLike[]): Set<string> {
     const out = new Set<string>();
     for (const f of files.filter(isPage)) {
         for (const t of tagsOf(f.text)) {
-            if (t.name !== 'link' || (attr(t.tag, 'rel') ?? '').toLowerCase() !== 'canonical') continue;
+            if (!t.closed || t.name !== 'link' || (attr(t.tag, 'rel') ?? '').toLowerCase() !== 'canonical') continue;
             const u = absolute(attr(t.tag, 'href') ?? '');
             if (u !== null) out.add(u.host.toLowerCase());
         }
@@ -165,12 +178,15 @@ function ownHosts(files: readonly FileLike[]): Set<string> {
 interface Extracted {
     loads: Load[];
     prefetch: Hit[];
+    /** One per page carrying loadable tags that never close. */
+    unread: Hit[];
 }
 
 export function extractLoads(files: readonly FileLike[]): Extracted {
     const own = ownHosts(files);
     const loads: Load[] = [];
     const prefetch: Hit[] = [];
+    const unread: Hit[] = [];
     const push = (f: FileLike, line: number, raw: string, how: string): void => {
         const url = absolute(raw);
         if (url === null || own.has(url.host.toLowerCase())) return;
@@ -179,7 +195,20 @@ export function extractLoads(files: readonly FileLike[]): Extracted {
     for (const f of files) {
         if (!isPage(f) && !isCss(f)) continue;
         if (isPage(f)) {
-            for (const t of tagsOf(f.text)) {
+            const tags = tagsOf(f.text);
+            const unclosed = tags.filter((t) => !t.closed);
+            if (unclosed.length > 0) {
+                const n = unclosed.length;
+                unread.push({
+                    file: f.rel,
+                    line: unclosed[0]?.line ?? 1,
+                    text:
+                        `${String(n)} loadable tag${n === 1 ? '' : 's'} (link, script, iframe, img, video, audio, source, embed) ` +
+                        `never close${n === 1 ? 's' : ''} before the next tag or the end of the file; whether ${n === 1 ? 'it loads' : 'they load'} is undecided.`,
+                });
+            }
+            for (const t of tags) {
+                if (!t.closed) continue;
                 if (t.name !== 'link') {
                     const src = attr(t.tag, 'src');
                     if (src !== undefined) push(f, t.line, src, `<${t.name} src>`);
@@ -211,7 +240,7 @@ export function extractLoads(files: readonly FileLike[]): Extracted {
             }
         });
     }
-    return { loads, prefetch };
+    return { loads, prefetch, unread };
 }
 
 export function resolveOrigin(url: URL, register: readonly OriginRow[]): OriginRow | undefined {
@@ -224,15 +253,17 @@ export function resolveOrigin(url: URL, register: readonly OriginRow[]): OriginR
 interface Classified {
     findings: Hit[];
     undecided: Hit[];
+    /** The unread-tag subset of `undecided`: file-local, so write time reports it too. */
+    unread: Hit[];
     loaded: Map<string, OriginRow>;
 }
 
 /** 2.1 — split the loads into findings and undecided, with the providers that load. */
 export function classifyLoads(files: readonly FileLike[], register: readonly OriginRow[]): Classified {
-    const { loads, prefetch } = extractLoads(files);
+    const { loads, prefetch, unread } = extractLoads(files);
     const gated = new Set(files.filter((f) => GATE_RE.test(f.text)).map((f) => f.rel));
     const findings: Hit[] = [];
-    const undecided: Hit[] = [...prefetch];
+    const undecided: Hit[] = [...prefetch, ...unread];
     const loaded = new Map<string, OriginRow>();
     for (const l of loads) {
         const row = resolveOrigin(l.url, register);
@@ -270,7 +301,7 @@ export function classifyLoads(files: readonly FileLike[], register: readonly Ori
             text: `${l.how} loads \`${l.url.host}\` (${row.provider}, ${row.category}) on first paint, before any visitor interaction${extra}.`,
         });
     }
-    return { findings, undecided, loaded };
+    return { findings, undecided, unread, loaded };
 }
 
 const IMPRINT_RE = /(impressum|imprint|legal-notice)/i;
@@ -415,13 +446,14 @@ export const MESSAGE_SAMPLES = (): string[] => {
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
@@ -432,7 +464,10 @@ export function writeTimeFindings(
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
diff --git a/tests/scripts/web_launch_linear.test.ts b/tests/scripts/web_launch_linear.test.ts
index ebf6a055aa..df95fe8a01 100644
--- a/tests/scripts/web_launch_linear.test.ts
+++ b/tests/scripts/web_launch_linear.test.ts
@@ -14,6 +14,11 @@ const register = loadRegister(REPO, '2026-11-02');
 const table = loadConfig(REPO).supersessions;
 const N = 200_000;
 
+const loads = (rel: string, body: string): string[] =>
+    writeTimeFindings(rel, body, register, table).filter((h) => h.check === 'third-party-load-in-markup').map((h) => `${String(h.line)}`);
+const unread = (rel: string, body: string): string[] =>
+    writeTimeFindings(rel, body, register, table).filter((h) => h.check === 'third-party-load-unread').map((h) => `${String(h.line)}`);
+
 const timed = (fn: () => unknown): number => {
     const t = performance.now();
     fn();
@@ -47,8 +52,6 @@ describe('linear on pathological input', () => {
 });
 
 describe('tags are found whatever the line layout (round-3 ratification)', () => {
-    const loads = (rel: string, body: string): string[] =>
-        writeTimeFindings(rel, body, register, table).filter((h) => h.check === 'third-party-load-in-markup').map((h) => `${String(h.line)}`);
 
     it('a <link> wrapped over several lines by a formatter is found, on the line it starts', () => {
         const page = '<head>\n  <link\n    rel="stylesheet"\n    href="https://fonts.googleapis.com/css2?family=Inter"\n  />\n</head>';
@@ -75,8 +78,41 @@ describe('tags are found whatever the line layout (round-3 ratification)', () =>
         expect(loads('ueber-uns.html', page)).toEqual([]);
     });
 
-    it('an unterminated tag is skipped, never read to the end of the file', () => {
+    it('an unterminated tag does not hide the next one, and is itself reported as unread', () => {
         const page = `<link rel="stylesheet" href="https://fonts.googleapis.com/a" ${'x'.repeat(5_000)}\n<link rel="stylesheet" href="https://fonts.googleapis.com/b">`;
         expect(loads('index.html', page)).toEqual(['2']);
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
+    it('a page of unclosed link tags yields one hit, linearly', () => {
+        const body = '<link rel=stylesheet href=x'.repeat(N / 28);
+        expect(timed(() => expect(unread('index.html', body)).toHaveLength(1))).toBeLessThan(1_000);
     });
 });

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

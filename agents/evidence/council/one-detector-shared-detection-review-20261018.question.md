<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch drain/road-to-one-detector-and-the-senders-we-own-20261018b,
     round 1, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261018b, round 1 — every credential consumer reads the one rule table

This is a ratification review under ADR-268 § 4. The ratification gate classifies
exactly one file of this diff as gated: `src/scripts/_lib/egress_rules.ts`
(hook-plumbing source, because the dispatcher's egress stage bundles it). Its
subject digest at the reviewed commit is
`274440f06fe8b1e7a9feca7711157e0ba277a80f7f3f4f44e45cae82aa8ffc60`.

Context, from the tree (roadmap `road-to-one-detector-and-the-senders-we-own`, step 2.2):

- Credential detection was spelled privately in seven places (the MCP config lint,
  `workspace_secrets` and `cross_repo_retrieve` through it, the council bundler, the
  `explain last` scrubber, the council `api_key_ref` check, the low-impact corpus
  redactor, two key-file loaders). An `sk-ant-api03-…` key was `high` in the commit
  scanner and passed two of the others unchanged.
- This change moves every one of them onto the rule table. Each keeps its own policy
  for a hit (refuse, mask, report, redact a line); only detection is shared.
- The table gains six credential rows the consumers carried and it lacked (OpenAI,
  Google OAuth, GitHub app tokens, xAI, Perplexity, Groq) and a `prefixes` field for
  shape-only surfaces, plus `CREDENTIAL_PREFIXES`, `prefixesOf`, `vendorPrefix`,
  `rawKeyPrefixPattern`, `replacementEnd`, `pemMaskEnd`.
- The commit scanner (`secret_detector`, read by `check_secret_leak`) reads the
  credential rows, so it now also detects those six shapes. `check_secret_leak --all`
  over the tracked tree stays green.
- A first version of this move (built 2026-10-17, then reverted for want of this
  record) narrowed five consumers. This version fixes that: `rawKeyPrefixPattern`
  holds a prefix to a token start only where its own row is anchored;
  `workspace_secrets` keeps its two looser readings (GitHub token family at any
  length, OpenAI key glued to a word) over the table's prefixes; the bundler keeps its
  unanchored OpenAI shape; an unproven key block (BEGIN and END labels differ) is
  masked through the nearest END marker by a masking surface.
- Tests: `egress_legacy_superset.test.ts` freezes every pre-move pattern and runs an
  adversarial corpus (glued, after `_`, quoted, in a URL, long tails, mismatched PEM
  labels) through old and new; wherever the old consumer acted the new one must, and a
  masking consumer must leave no six-character digit-bearing window of the old match.
  Each of the four fixes was seen red with it removed. `egress_drift_matrix.test.ts`
  runs a positive fixture per credential row against every consumer. 104 test files /
  2,794 tests over the egress, council, secret-detector, workspace, cross-repo, MCP and
  explain suites pass; `tsc --noEmit` is clean.
- A new gate, `check_credential_spelling`, fails a second spelling of a declared prefix
  under `src/scripts` and `src/cli` (self-test with 5 cases, 3 rejecting; gate ledger;
  runs in `rule-backstops.yml` and `task ci`; registered in `src/config/gate-coverage.yml`
  with a create-only canary). It cannot see a prefix spelled through a character class or
  a keyword assignment; those are recorded as the new step 2.7.
- The hook bundle measures 1,546,633 B against its 1,550,000 B ceiling; no ceiling is
  raised.

The diff below is the gated file and the consumers that read it. The council's own
bundler redacts secret-looking lines in this prompt, so a few diff lines may arrive as
`[redacted: …]`; judge from the surrounding code and say if a redaction hides
something you need.

Review it. For each defect report file:line, the failure scenario and a severity.
Questions a review should answer include: does any consumer now catch LESS than it did
before (a narrowed detection is the defect this review exists to find); does the shared
table change any consumer's policy for a hit (refuse vs mask vs report); is the widened
commit scanner a risk to `check_secret_leak` verdicts; is this edit authority-expanding
in the sense of ADR-268 § 4, or a non-expanding change to a gated surface. State your
stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

```diff
diff --git a/src/cli/python/workspace_secrets.ts b/src/cli/python/workspace_secrets.ts
index 7baefe850..b75f16028 100644
--- a/src/cli/python/workspace_secrets.ts
+++ b/src/cli/python/workspace_secrets.ts
@@ -7,7 +7,7 @@
  * same `subn`/`finditer` counting, same `scrub_obj` depth + cycle guard,
  * same `[SECRET]` placeholder.
  *
- * Leaf module — `RegExp` only, **zero internal imports** — so the
+ * Near-leaf module — its one import is the pure rule table (no I/O) — so the
  * hot-path analytics `emit()` and the heavier `knowledge_ingest` can both
  * depend on it cheaply without dragging in PII redaction, chunking, or file
  * I/O. Every workspace store that persists text or arbitrary payloads at rest
@@ -16,8 +16,9 @@
  *
  * Two confidence tiers:
  *
- * - **HIGH** — structurally unambiguous credentials (AWS access-key id, GitHub
- *   PAT, OpenAI key, PEM private-key block). Near-zero false-positive rate, so
+ * - **HIGH** — structurally unambiguous credentials: the credential rows of
+ *   the one rule table (vendor keys, tokens, PEM private-key block, a
+ *   connection URI with an inline password). Near-zero false-positive rate, so
  *   safe to scrub destructively or to refuse a write over.
  * - **FUZZY** — the generic `key/secret/token/password = <value>` assignment.
  *   Fires on legitimate prose ("password reset token: see attached"), so it is
@@ -28,22 +29,87 @@
  * two surfaces stay byte-consistent.
  */
 
+import {
+    detect,
+    EGRESS_RULES,
+    type EgressRule,
+    pemMaskEnd,
+    prefixesOf,
+    rawKeyPrefixPattern,
+    replacementEnd,
+} from '../../scripts/_lib/egress_rules.js';
+
 export const PLACEHOLDER = '[SECRET]';
 
-// --- HIGH-confidence patterns (gitleaks-equivalent subset) ------------------
-//
-// Python compiles each pattern once; JS needs a FRESH `RegExp` per match call
-// because the `g` flag carries `lastIndex` state. `_finditer` / `_subn` below
-// each construct a local global-flagged copy, so the module-level patterns
-// stay stateless (matching Python's stateless compiled patterns).
+// --- HIGH-confidence tier: the credential rows of the one rule table -------
 //
-// `[\s\S]` mirrors Python `re.DOTALL`-style `[\s\S]` (the .py uses the same
-// idiom, not the DOTALL flag). `*?` is lazy in both engines.
-const _RE_PRIVATE_KEY =
-    /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/;
-const _RE_AWS = /AKIA[0-9A-Z]{16}/;
-const _RE_GH = /gh[pousr]_[A-Za-z0-9]{36,}/;
-const _RE_OPENAI = /sk-[A-Za-z0-9]{20,}/;
+// Detection lives in `src/scripts/_lib/egress_rules.ts`, the only place a
+// credential pattern is defined (road-to-one-detector-and-the-senders-we-own
+// 2.2); this module keeps its own policy — the `[SECRET]` placeholder, the
+// HIGH/FUZZY tiers and the counts. `generic-assignment` is left to the FUZZY tier
+// below, which is this module's own, looser reading of the same shape.
+
+const HIGH_RULES: readonly EgressRule[] = EGRESS_RULES.filter(
+    (r) => r.class === 'credential' && r.rule !== 'generic-assignment',
+);
+
+// The finding names this module has always reported; a row without one reports
+// its rule id.
+const LEGACY_NAME: Readonly<Record<string, string>> = {
+    'pem-private-key': 'private_key',
+    'aws-access-key': 'aws_access_key',
+    'github-pat': 'github_pat',
+    'github-app-token': 'github_pat',
+    'openai-api-key': 'openai_key',
+};
+const LEGACY_ORDER = ['private_key', 'aws_access_key', 'github_pat', 'openai_key'];
+const rank = (name: string): number => {
+    const i = LEGACY_ORDER.indexOf(name);
+    return i < 0 ? LEGACY_ORDER.length : i;
+};
+
+// This module's own, looser readings of two shapes, kept so the move to the
+// table narrows nothing: the GitHub token family at any length and an OpenAI key
+// glued to a preceding word. The prefixes are the table's.
+const OWN_SHAPES: ReadonlyArray<readonly [string, RegExp]> = [
+    [
+        'github_pat',
+        rawKeyPrefixPattern(36, [...prefixesOf('github-pat'), ...prefixesOf('github-app-token')], {
+            boundary: 'never',
+            tail: 'A-Za-z0-9',
+        }),
+    ],
+    ['openai_key', rawKeyPrefixPattern(20, prefixesOf('openai-api-key'), { boundary: 'never', tail: 'A-Za-z0-9' })],
+];
+
+type Span = { name: string; start: number; end: number };
+
+/** HIGH spans in report order, each widened to the bytes a scrub must remove. */
+function highSpans(text: string): Span[] {
+    const spans: Span[] = detect(text, HIGH_RULES).map((s) => ({
+        name: LEGACY_NAME[s.rule] ?? s.rule,
+        start: s.start,
+        // A masking surface cannot refuse; an unproven extent masks through the
+        // nearest key-end marker, else the detection span.
+        end: replacementEnd(text, s) ?? (s.rule === 'pem-private-key' ? pemMaskEnd(text, s) : null) ?? s.end,
+    }));
+    for (const [name, re] of OWN_SHAPES) {
+        for (const m of text.matchAll(re)) spans.push({ name, start: m.index, end: m.index + m[0].length });
+    }
+    // One finding per value: a span inside another span of the same name is that span.
+    const kept = spans.filter(
+        (a, i) =>
+            !spans.some(
+                (b, j) =>
+                    j !== i &&
+                    b.name === a.name &&
+                    b.start <= a.start &&
+                    b.end >= a.end &&
+                    (b.end - b.start > a.end - a.start || j < i),
+            ),
+    );
+    return kept.sort((x, y) => rank(x.name) - rank(y.name) || x.start - y.start);
+}
 
 // --- FUZZY pattern (heuristic key/value assignment) -------------------------
 // Python `(?i)` inline flag → JS `i` flag. Character class is identical.
@@ -52,16 +118,7 @@ const _RE_KV_SECRET =
 
 type PatternEntry = readonly [string, RegExp];
 
-// Ordered HIGH-confidence first so the private-key block is consumed before
-// the narrower key patterns can fragment it.
-export const HIGH_CONFIDENCE: readonly PatternEntry[] = [
-    ['private_key', _RE_PRIVATE_KEY],
-    ['aws_access_key', _RE_AWS],
-    ['github_pat', _RE_GH],
-    ['openai_key', _RE_OPENAI],
-];
 export const FUZZY: readonly PatternEntry[] = [['kv_secret', _RE_KV_SECRET]];
-export const ALL_PATTERNS: readonly PatternEntry[] = [...HIGH_CONFIDENCE, ...FUZZY];
 
 // Recursion guard for `scrub_obj` — deep / cyclic structures degrade to a
 // controlled return instead of a RangeError on the never-raises hot path.
@@ -113,11 +170,7 @@ export function scan(text: unknown, opts?: { include_fuzzy?: boolean }): Finding
     if (typeof text !== 'string' || !text) {
         return [];
     }
-    const out: Finding[] = [];
-    for (const [name, pat] of HIGH_CONFIDENCE) {
-        const n = _finditerCount(pat, text);
-        for (let i = 0; i < n; i += 1) out.push({ pattern: name, confidence: 'high' });
-    }
+    const out: Finding[] = highSpans(text).map((s) => ({ pattern: s.name, confidence: 'high' }));
     if (include_fuzzy) {
         for (const [name, pat] of FUZZY) {
             const n = _finditerCount(pat, text);
@@ -133,13 +186,25 @@ export function scrub(text: unknown, opts?: { include_fuzzy?: boolean }): [strin
     if (typeof text !== 'string' || !text) {
         return [text as string, 0];
     }
+    const spans = highSpans(text).sort((x, y) => x.start - y.start);
+    const merged: Array<{ start: number; end: number }> = [];
+    for (const sp of spans) {
+        const last = merged[merged.length - 1];
+        if (last !== undefined && sp.start < last.end) last.end = Math.max(last.end, sp.end);
+        else merged.push({ start: sp.start, end: sp.end });
+    }
     let out = text;
-    let count = 0;
-    const patterns = include_fuzzy ? ALL_PATTERNS : HIGH_CONFIDENCE;
-    for (const [, pat] of patterns) {
-        const [next, n] = _subn(pat, PLACEHOLDER, out);
-        out = next;
-        count += n;
+    for (let i = merged.length - 1; i >= 0; i -= 1) {
+        const m = merged[i] as { start: number; end: number };
+        out = out.slice(0, m.start) + PLACEHOLDER + out.slice(m.end);
+    }
+    let count = merged.length;
+    if (include_fuzzy) {
+        for (const [, pat] of FUZZY) {
+            const [next, n] = _subn(pat, PLACEHOLDER, out);
+            out = next;
+            count += n;
+        }
     }
     return [out, count];
 }
diff --git a/src/scripts/_cli/explain_last/scrubber.ts b/src/scripts/_cli/explain_last/scrubber.ts
index 0ff635149..7c06229e4 100644
--- a/src/scripts/_cli/explain_last/scrubber.ts
+++ b/src/scripts/_cli/explain_last/scrubber.ts
@@ -16,7 +16,7 @@
  *
  * Masks applied (resolution order):
  *
- * 1. Raw-key secret prefixes (`sk_live_…`, `ghp_…` etc.) and inline
+ * 1. Raw-key secret prefixes (the rule table's, at a token start) and inline
  *    `api_key=…` shapes → `<secret>`.
  * 2. Emails → `<email>`.
  * 3. Absolute file paths (`/Users/…`, `/home/…`, `C:\…`) → `<path>`.
@@ -39,29 +39,17 @@
  *    matching the original's `f"<{len(out)} chars>"`.
  */
 
-export const LONG_STRING_THRESHOLD = 200;
-
-const _RAW_KEY_PREFIXES: readonly string[] = [
-    'sk_live_', 'sk_test_', 'ghp_', 'github_pat_', 'gho_', 'ghs_',
-    'ghu_', 'xoxb-', 'xoxp-', 'AIza', 'AKIA',
-];
+import { rawKeyPrefixPattern } from '../../_lib/egress_rules.js';
 
-/** Escape a literal for a RegExp, mirroring Python's `re.escape`. */
-function _reEscape(literal: string): string {
-    // Python `re.escape` escapes non-alphanumerics; under the `u` flag a
-    // `\-` is an illegal escape, so `-` is escaped via its unicode form.
-    // The fixed prefixes only contain `-` (e.g. `xoxb-`), so this is the
-    // sole case that matters; the broad class covers the rest faithfully.
-    return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/-/g, '\\u002d');
-}
+export const LONG_STRING_THRESHOLD = 200;
 
 // Unicode word-char class standing in for Python's default-mode `\w`.
 const _W = '\\p{L}\\p{N}_';
 
-const _RAW_KEY_RE = new RegExp(
-    '(?:' + _RAW_KEY_PREFIXES.map(_reEscape).join('|') + ')[A-Za-z0-9_-]{6,}',
-    'gu',
-);
+// The raw-key prefixes are the rule table's (road-to-one-detector-and-the-
+// senders-we-own 2.2); this surface keeps its own policy: prefix plus six key
+// characters is enough to mask, because it cannot refuse.
+const _RAW_KEY_RE = rawKeyPrefixPattern(6);
 const _API_KEY_RE = new RegExp(
     '\\bapi[_-]?key\\b\\s*[:=]\\s*[A-Za-z0-9+/=_-]{12,}',
     'giu',
diff --git a/src/scripts/_lib/egress_rules.ts b/src/scripts/_lib/egress_rules.ts
index e5ef4eaba..38ce919ab 100644
--- a/src/scripts/_lib/egress_rules.ts
+++ b/src/scripts/_lib/egress_rules.ts
@@ -32,6 +32,12 @@ export interface EgressRule {
     /** The rule fires only when `words` matches within `window` chars of the value. */
     readonly context?: { readonly words: RegExp; readonly window: number };
     readonly exclusions?: readonly RegExp[];
+    /**
+     * Literal vendor prefixes that mark a raw key by construction. Surfaces that
+     * act on shape alone (a config ref, a masked log value) read these instead of
+     * spelling their own list.
+     */
+    readonly prefixes?: readonly string[];
 }
 
 export interface SpanBounds {
@@ -97,6 +103,19 @@ export function pemBlockEnd(text: string, span: SpanBounds): number | null {
     return m.index + m[0].length;
 }
 
+/**
+ * End of the first key-end marker of any label after the header, or null. For a
+ * masking surface that cannot refuse: when the block's extent is unproven it
+ * masks too much rather than leaving the key body behind.
+ */
+export function pemMaskEnd(text: string, span: SpanBounds): number | null {
+    KEY_MARKER.lastIndex = span.end;
+    for (let m = KEY_MARKER.exec(text); m !== null; m = KEY_MARKER.exec(text)) {
+        if (m[1] === 'END') return m.index + m[0].length;
+    }
+    return null;
+}
+
 const PREFIX_RUN =
     'Starts only where the literal prefix occurs; the single class after it either reaches its minimum and consumes the whole run (the global scan resumes past it) or fails within the minimum, so each character is read a bounded number of times.';
 const FIXED_RUN =
@@ -110,6 +129,7 @@ export const EGRESS_RULES: readonly EgressRule[] = [
     {
         rule: 'anthropic-api-key',
         type: 'APIKEY',
+        prefixes: ['sk-ant-'],
         class: 'credential',
         replacement: 'detection',
         kind: 'anthropic-api-key',
@@ -119,6 +139,7 @@ export const EGRESS_RULES: readonly EgressRule[] = [
     {
         rule: 'anthropic-project-key',
         type: 'APIKEY',
+        prefixes: ['sk-proj-'],
         class: 'credential',
         replacement: 'detection',
         kind: 'anthropic-api-key',
@@ -128,6 +149,7 @@ export const EGRESS_RULES: readonly EgressRule[] = [
     {
         rule: 'aws-access-key',
         type: 'APIKEY',
+        prefixes: ['AKIA'],
         class: 'credential',
         replacement: 'detection',
         pattern: /AKIA[0-9A-Z]{16}/g,
@@ -136,6 +158,7 @@ export const EGRESS_RULES: readonly EgressRule[] = [
     {
         rule: 'google-api-key',
         type: 'APIKEY',
+        prefixes: ['AIza'],
         class: 'credential',
         replacement: 'detection',
         pattern: /AIza[0-9A-Za-z_-]{35}/g,
@@ -144,6 +167,7 @@ export const EGRESS_RULES: readonly EgressRule[] = [
     {
         rule: 'github-pat',
         type: 'TOKEN',
+        prefixes: ['ghp_'],
         class: 'credential',
         replacement: 'detection',
         pattern: /ghp_[0-9A-Za-z]{36}/g,
@@ -152,12 +176,67 @@ export const EGRESS_RULES: readonly EgressRule[] = [
     {
         rule: 'github-fine-grained-pat',
         type: 'TOKEN',
+        prefixes: ['github_pat_'],
         class: 'credential',
         replacement: 'detection',
         kind: 'github-pat',
         pattern: /github_pat_[0-9A-Za-z_]{22,}/g,
         linearity: PREFIX_RUN,
     },
+    {
+        rule: 'openai-api-key',
+        type: 'APIKEY',
+        prefixes: ['sk-'],
+        class: 'credential',
+        replacement: 'detection',
+        pattern: /(?<![A-Za-z0-9])sk-[A-Za-z0-9]{20,}/g,
+        linearity: PREFIX_RUN,
+    },
+    {
+        rule: 'google-oauth-token',
+        type: 'TOKEN',
+        prefixes: ['ya29.'],
+        class: 'credential',
+        replacement: 'detection',
+        pattern: /(?<![A-Za-z0-9])ya29\.[0-9A-Za-z_-]{20,}/g,
+        linearity: PREFIX_RUN,
+    },
+    {
+        rule: 'github-app-token',
+        type: 'TOKEN',
+        prefixes: ['gho_', 'ghu_', 'ghs_', 'ghr_'],
+        class: 'credential',
+        replacement: 'detection',
+        pattern: /gh[ousr]_[A-Za-z0-9]{36,}/g,
+        linearity: PREFIX_RUN,
+    },
+    {
+        rule: 'xai-api-key',
+        type: 'APIKEY',
+        prefixes: ['xai-'],
+        class: 'credential',
+        replacement: 'detection',
+        pattern: /(?<![A-Za-z0-9])xai-[A-Za-z0-9]{20,}/g,
+        linearity: PREFIX_RUN,
+    },
+    {
+        rule: 'perplexity-api-key',
+        type: 'APIKEY',
+        prefixes: ['pplx-'],
+        class: 'credential',
+        replacement: 'detection',
+        pattern: /pplx-[A-Za-z0-9]{20,}/g,
+        linearity: PREFIX_RUN,
+    },
+    {
+        rule: 'groq-api-key',
+        type: 'APIKEY',
+        prefixes: ['gsk_'],
+        class: 'credential',
+        replacement: 'detection',
+        pattern: /(?<![A-Za-z0-9])gsk_[A-Za-z0-9]{20,}/g,
+        linearity: PREFIX_RUN,
+    },
     {
         rule: 'jwt',
         type: 'TOKEN',
@@ -172,6 +251,7 @@ export const EGRESS_RULES: readonly EgressRule[] = [
     {
         rule: 'stripe-secret-key',
         type: 'APIKEY',
+        prefixes: ['sk_live_', 'sk_test_'],
         class: 'credential',
         replacement: 'detection',
         pattern: /sk_(?:live|test)_[0-9A-Za-z]{16,}/g,
@@ -180,6 +260,7 @@ export const EGRESS_RULES: readonly EgressRule[] = [
     {
         rule: 'slack-token',
         type: 'TOKEN',
+        prefixes: ['xoxb-', 'xoxp-', 'xoxa-', 'xoxr-', 'xoxs-'],
         class: 'credential',
         replacement: 'detection',
         pattern: /xox[baprs]-[0-9A-Za-z-]{10,}/g,
@@ -219,6 +300,66 @@ export const EGRESS_RULES: readonly EgressRule[] = [
     },
 ];
 
+/** Every raw-key prefix the table declares, longest first. */
+export const CREDENTIAL_PREFIXES: readonly string[] = EGRESS_RULES.flatMap((r) => r.prefixes ?? []).sort(
+    (a, b) => b.length - a.length,
+);
+
+/** The prefixes one row declares; throws on an unknown rule so a rename cannot go silent. */
+export function prefixesOf(rule: string): readonly string[] {
+    const row = EGRESS_RULES.find((r) => r.rule === rule);
+    if (row === undefined) throw new Error(`egress rule ${rule}: no such row`);
+    return row.prefixes ?? [];
+}
+
+/** A row's first declared prefix — the shape a key file of that vendor starts with. */
+export function vendorPrefix(rule: string): string {
+    const first = prefixesOf(rule)[0];
+    if (first === undefined) throw new Error(`egress rule ${rule}: declares no prefix`);
+    return first;
+}
+
+// A prefix is held to a token start only where its own row is; a prefix whose
+// row matches mid-word stays unanchored, so a shape-only surface never misses
+// what the row would catch.
+const ANCHORED_PREFIXES: ReadonlySet<string> = new Set(
+    EGRESS_RULES.filter((r) => r.pattern.source.startsWith('(?<!')).flatMap((r) => r.prefixes ?? []),
+);
+
+/**
+ * A raw-key prefix followed by at least `minTail` key characters. Coarser than
+ * the rows on purpose: it is for surfaces that refuse or mask on shape alone,
+ * where a short or truncated key must still be caught. `boundary: 'never'` drops
+ * the token-start requirement for every prefix; `tail` narrows the key class.
+ */
+export function rawKeyPrefixPattern(
+    minTail: number,
+    prefixes: readonly string[] = CREDENTIAL_PREFIXES,
+    opts: { readonly boundary?: 'row' | 'never'; readonly tail?: string } = {},
+): RegExp {
+    const alt = [...prefixes]
+        .sort((a, b) => b.length - a.length)
+        .map((p) => {
+            const lit = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
+            return opts.boundary !== 'never' && ANCHORED_PREFIXES.has(p) ? `(?<![A-Za-z0-9])${lit}` : lit;
+        })
+        .join('|');
+    return new RegExp(`(?:${alt})[${opts.tail ?? 'A-Za-z0-9_-'}]{${minTail},}`, 'g');
+}
+
+/**
+ * End of the bytes a replacement of `span` must remove, or null when the row
+ * cannot prove it (the caller then decides: a refusing surface refuses, a
+ * masking surface masks the detection span).
+ */
+export function replacementEnd(text: string, span: EgressSpan): number | null {
+    const row = EGRESS_RULES.find((r) => r.rule === span.rule);
+    if (row === undefined) return null;
+    if (row.replacement === 'detection') return span.end;
+    const end = row.replacement.through(text, span);
+    return end === null || end < span.end ? null : end;
+}
+
 /**
  * Returns a description of the first unbounded quantifier (`+`, `*`, `{n,}`)
  * outside a character class, or null. Escapes and classes are skipped.
diff --git a/src/scripts/ai_council/bundler.ts b/src/scripts/ai_council/bundler.ts
index 8b5f05c2f..5e421a6d5 100644
--- a/src/scripts/ai_council/bundler.ts
+++ b/src/scripts/ai_council/bundler.ts
@@ -20,6 +20,8 @@ import { spawnSync } from 'node:child_process';
 import * as fs from 'node:fs';
 import * as path from 'node:path';
 
+import { detect, prefixesOf, rawKeyPrefixPattern, replacementEnd } from '../_lib/egress_rules.js';
+
 export const MAX_BUNDLE_BYTES = 50 * 1024; // 50 KB hard ceiling; user must narrow scope on hit.
 
 /** Raised when the assembled bundle exceeds MAX_BUNDLE_BYTES. */
@@ -76,30 +78,79 @@ function _splitlines(s: string): string[] {
 
 // ── redaction patterns ───────────────────────────────────────────────────
 // Each pattern is matched line-wise; matching lines are replaced with the
-// placeholder. Order matters — the most specific pattern goes first.
+// placeholder. Order matters — the most specific pattern goes first. Credential
+// shapes are not spelled here: they come from the one rule table
+// (road-to-one-detector-and-the-senders-we-own 2.2), which this module reads
+// for detection only; replacing whole lines stays this module's policy.
 
 const _REDACTION_LINE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
     [/~?\/?\.event4u\/agent-config\/[^/\s]+\.key/u, '[redacted: agent-config key path]'],
     [/~?\/?\.config\/agent-config\/[^/\s]+\.key/u, '[redacted: agent-config key path]'],
     [/^\s*Authorization:\s/iu, '[redacted: Authorization header]'],
     [/(api[_-]?key|secret|token|password)\s*[:=]/iu, '[redacted: secret-like assignment]'],
-    [/sk-ant-[A-Za-z0-9_\-]{8,}/u, '[redacted: anthropic-key-like token]'],
-    [/sk-[A-Za-z0-9_\-]{20,}/u, '[redacted: openai-key-like token]'],
+    [rawKeyPrefixPattern(8, prefixesOf('anthropic-api-key')), '[redacted: anthropic-key-like token]'],
+    [
+        rawKeyPrefixPattern(20, [...prefixesOf('openai-api-key'), ...prefixesOf('anthropic-project-key')], {
+            boundary: 'never',
+        }),
+        '[redacted: openai-key-like token]',
+    ],
 ];
 
+const _ANTHROPIC_LABEL = '[redacted: anthropic-key-like token]';
+const _OPENAI_LABEL = '[redacted: openai-key-like token]';
+const _CREDENTIAL_LABEL = '[redacted: credential-like token]';
+const _RULE_LABEL: Readonly<Record<string, string>> = {
+    'anthropic-api-key': _ANTHROPIC_LABEL,
+    'openai-api-key': _OPENAI_LABEL,
+    'anthropic-project-key': _OPENAI_LABEL,
+};
+
+/**
+ * Line index -> placeholder for every line a credential's replacement extent
+ * touches, so a multi-line value (a PEM block) loses every line it spans.
+ */
+function _credentialLines(lines: readonly string[]): Map<number, string> {
+    const joined = lines.join('\n');
+    const starts: number[] = [];
+    let at = 0;
+    for (const line of lines) {
+        starts.push(at);
+        at += line.length + 1;
+    }
+    const lineOf = (offset: number): number => {
+        let i = 0;
+        while (i + 1 < starts.length && (starts[i + 1] as number) <= offset) i += 1;
+        return i;
+    };
+    const out = new Map<number, string>();
+    for (const span of detect(joined)) {
+        if (span.class !== 'credential') continue;
+        const end = replacementEnd(joined, span) ?? span.end;
+        const label = _RULE_LABEL[span.rule] ?? _CREDENTIAL_LABEL;
+        for (let i = lineOf(span.start); i <= lineOf(Math.max(span.start, end - 1)); i += 1) {
+            if (!out.has(i)) out.set(i, label);
+        }
+    }
+    return out;
+}
+
 /** Apply redaction patterns to a multi-line text buffer. */
 export function redact(text: string): string {
+    const lines = _splitlines(text);
+    const credential = _credentialLines(lines);
     const out: string[] = [];
-    for (const line of _splitlines(text)) {
+    lines.forEach((line, i) => {
         let replaced = line;
         for (const [pattern, placeholder] of _REDACTION_LINE_PATTERNS) {
+            pattern.lastIndex = 0;
             if (pattern.test(replaced)) {
                 replaced = placeholder;
                 break;
             }
         }
-        out.push(replaced);
-    }
+        out.push(replaced === line ? (credential.get(i) ?? line) : replaced);
+    });
     return out.join('\n');
 }
 
diff --git a/src/scripts/ai_council/clients.ts b/src/scripts/ai_council/clients.ts
index 4e377932d..55d508d0f 100644
--- a/src/scripts/ai_council/clients.ts
+++ b/src/scripts/ai_council/clients.ts
@@ -45,6 +45,7 @@ import * as fs from 'node:fs';
 import * as os from 'node:os';
 import * as path from 'node:path';
 
+import { vendorPrefix } from '../_lib/egress_rules.js';
 import { hardenedSpawnEnv } from '../_lib/spawn_env.js';
 import { boundFor } from './cli_agency_bounds.js';
 import {
@@ -363,12 +364,12 @@ function _loadKey(p: string, prefix: string, installScript: string): string {
 
 export function load_anthropic_key(p: string | null = null): string {
     const resolved = p !== null ? p : _resolveKeyPath(ANTHROPIC_KEY_FILENAME);
-    return _loadKey(resolved, 'sk-ant-', 'src/scripts/install_anthropic_key.sh');
+    return _loadKey(resolved, vendorPrefix('anthropic-api-key'), 'src/scripts/install_anthropic_key.sh');
 }
 
 export function load_openai_key(p: string | null = null): string {
     const resolved = p !== null ? p : _resolveKeyPath(OPENAI_KEY_FILENAME);
-    return _loadKey(resolved, 'sk-', 'src/scripts/install_openai_key.sh');
+    return _loadKey(resolved, vendorPrefix('openai-api-key'), 'src/scripts/install_openai_key.sh');
 }
 
 // ── attribute-access helpers (mirror Python getattr) ──────────────────
diff --git a/src/scripts/ai_council/config.ts b/src/scripts/ai_council/config.ts
index 9b00ac795..268bb52bd 100644
--- a/src/scripts/ai_council/config.ts
+++ b/src/scripts/ai_council/config.ts
@@ -75,6 +75,7 @@ import * as path from 'node:path';
 
 import { parse as parseYaml } from 'yaml';
 
+import { CREDENTIAL_PREFIXES } from '../_lib/egress_rules.js';
 import * as user_global_paths from '../_lib/user_global_paths.js';
 import * as budget from './cli_call_budget.js';
 // LAYERING CONSTRAINT, load-bearing: this is a VALUE import from quorum, while
@@ -108,17 +109,10 @@ const _FALLBACK_DEPS = {
 
 /**
  * Prefixes that signal "this is a raw API key" so we refuse it loudly
- * even when the user accidentally inlined it in `api_key_ref`.
+ * even when the user accidentally inlined it in `api_key_ref`. The rule
+ * table owns them (road-to-one-detector-and-the-senders-we-own 2.2).
  */
-export const _RAW_KEY_PREFIXES: readonly string[] = [
-    'sk-',
-    'sk-ant-',
-    'ya29.',
-    'AIza',
-    'xai-',
-    'pplx-',
-    'gsk_',
-];
+export const _RAW_KEY_PREFIXES: readonly string[] = CREDENTIAL_PREFIXES;
 
 // ── value type shapes ──────────────────────────────────────────────
 
diff --git a/src/scripts/cross_repo_retrieve.ts b/src/scripts/cross_repo_retrieve.ts
index 2afa1d820..164d8d6ae 100644
--- a/src/scripts/cross_repo_retrieve.ts
+++ b/src/scripts/cross_repo_retrieve.ts
@@ -19,7 +19,9 @@
  * TypeScript and a `.ts` cannot import a `.py`, so the redaction + chunking
  * primitives are ported faithfully inline here and verified byte-identical
  * against the retired Python implementations (differential-tested, no behavior divergence).
- * They carry no legacy-source-path literal, matching the `.py`.
+ * They carry no legacy-source-path literal, matching the `.py`. The secret
+ * scrub is the exception: it calls the ported `workspace_secrets.scrub`, whose
+ * credential detection is the one rule table's.
  *
  * Scope guards (Option A):
  *   - read-only, no writes, no network;
@@ -38,6 +40,7 @@ import * as fs from 'node:fs';
 import * as path from 'node:path';
 import { fileURLToPath, pathToFileURL } from 'node:url';
 
+import { scrub } from '../cli/python/workspace_secrets.js';
 import { collect } from './linked_projects_list.js';
 
 const _HERE = fileURLToPath(import.meta.url);
@@ -57,23 +60,6 @@ const SKIP_DIRS: ReadonlySet<string> = new Set([
 
 const CHUNK_BYTES = 2 * 1024;
 
-// workspace_secrets patterns (HIGH-confidence first, then FUZZY).
-const _RE_PRIVATE_KEY =
-    /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g;
-const _RE_AWS = /AKIA[0-9A-Z]{16}/g;
-const _RE_GH = /gh[pousr]_[A-Za-z0-9]{36,}/g;
-const _RE_OPENAI = /sk-[A-Za-z0-9]{20,}/g;
-const _RE_KV_SECRET =
-    /(?:api[_-]?key|secret|token|password|passwd|bearer)\s*[:=]\s*['"]?[A-Za-z0-9_\-+/=]{12,}['"]?/gi;
-const _SECRET_PATTERNS: ReadonlyArray<RegExp> = [
-    _RE_PRIVATE_KEY,
-    _RE_AWS,
-    _RE_GH,
-    _RE_OPENAI,
-    _RE_KV_SECRET,
-];
-const _SECRET_PLACEHOLDER = '[SECRET]';
-
 // knowledge_ingest PII patterns.
 const _RE_EMAIL = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
 const _RE_PHONE = new RegExp(
@@ -97,19 +83,9 @@ function _subn(text: string, pat: RegExp, repl: string): [string, number] {
     return [out, n];
 }
 
-/** Faithful port of `workspace_secrets.scrub(text, include_fuzzy=True)`. */
+/** `workspace_secrets.scrub(text, include_fuzzy=True)`: credential detection is the rule table's. */
 function _scrub_secrets(text: string): [string, number] {
-    if (typeof text !== 'string' || text === '') {
-        return [text, 0];
-    }
-    let count = 0;
-    let out = text;
-    for (const pat of _SECRET_PATTERNS) {
-        const [t, n] = _subn(out, pat, _SECRET_PLACEHOLDER);
-        out = t;
-        count += n;
-    }
-    return [out, count];
+    return scrub(text, { include_fuzzy: true });
 }
 
 /** Faithful port of `knowledge_ingest.redact(text, counters)`. */
diff --git a/src/scripts/lint_mcp_config_security.ts b/src/scripts/lint_mcp_config_security.ts
index adf10a2b1..554e30b6f 100644
--- a/src/scripts/lint_mcp_config_security.ts
+++ b/src/scripts/lint_mcp_config_security.ts
@@ -23,6 +23,7 @@ import * as path from 'node:path';
 import * as fs from 'node:fs';
 import { fileURLToPath, pathToFileURL } from 'node:url';
 
+import { detect } from './_lib/egress_rules.js';
 import * as sl from './_lib/security_lint.js';
 import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
 
@@ -31,16 +32,11 @@ export const CHECK = 'mcp-config-security';
 //   Python: re.compile(r"(^|/)(\.mcp\.json|mcp\.json|claude_desktop_config\.json)")
 const _NAME_HINTS = /(^|\/)(\.mcp\.json|mcp\.json|claude_desktop_config\.json)/;
 
-// Real secret VALUES (prefix + enough key chars to be a live credential).
-//   Python (no flags):
-const _SECRET = new RegExp(
-    'sk-ant-[A-Za-z0-9_\\-]{20,}' +
-        '|sk-proj-[A-Za-z0-9_\\-]{20,}' +
-        '|AKIA[0-9A-Z]{16}' +
-        '|AIza[0-9A-Za-z_\\-]{35}' +
-        '|ghp_[0-9A-Za-z]{36}' +
-        '|eyJ[A-Za-z0-9_\\-]{10,}\\.[A-Za-z0-9_\\-]{10,}\\.[A-Za-z0-9_\\-]{10,}',
-);
+// Real secret VALUES — detected by the one rule table, which owns every
+// credential pattern (road-to-one-detector-and-the-senders-we-own 2.2).
+export function hasInlineSecret(text: string): boolean {
+    return detect(text).some((span) => span.class === 'credential');
+}
 
 // Line-level smells (match on a single line).
 const _MED: ReadonlyArray<[RegExp, string]> = [
@@ -135,7 +131,7 @@ export function _scan(sf: sl.ScannedFile): sl.Finding[] {
     const out: sl.Finding[] = [];
     for (const [start, numbered] of _candidate_chunks(sf)) {
         for (const [lineno, text] of numbered) {
-            if (_SECRET.test(text)) {
+            if (hasInlineSecret(text)) {
                 out.push(
                     new sl.Finding(
                         sf.rel,
```

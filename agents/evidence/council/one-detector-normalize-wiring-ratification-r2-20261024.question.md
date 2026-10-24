<!-- evidence-type: analysis -->

<!-- A prompt for the council, written 2026-10-24 for branch drain/one-detector-20261024,
     round 2, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/one-detector-20261024, round 2 — the senders detect through the normalisation

Ratification review under ADR-268 § 4, round 2. Round 1's prompt is
`agents/evidence/council/one-detector-normalize-wiring-ratification-20261024.question.md`.

`check_kernel_edit_ratified --base origin/main` now gates two files:
`src/scripts/_lib/egress_normalize.ts` (hook-plumbing source, in the dispatch
import closure through `knowledge_global_redaction.ts`) and
`src/config/hook-bundle-budget.json`. Reviewed commit `462aa3560f`; subject digest
`08cea2fa47ed5542eb4301510ade1216ecf13bace3380423d6fdc3e7c57635ee`, from
`./scripts-run src/scripts/ratification_subject --files $(git diff --name-only origin/main...HEAD) --base-ref origin/main`.

## What happened in round 1

Both seats answered round 1, but the run recorded no verdict: the second
(peer) round was refused before sending by the council's own final egress
check, because a round-1 answer quoted an example key block with a zero-width
character in its markers, which the newly wired check now recognises. The
round-1 answer texts were not kept. The part of one answer captured at the
refusal named a defect: a rule's extent reader (`pemBlockEnd`, and the
council's `maskingEnd`) still searched the ORIGINAL text with non-normalising
patterns, so such a block was refused by `replaceValues` and, in the council's
masking path, left its body behind.

## What changed since round 1

- `detectWithExtent` (in `egress_normalize.ts`) returns the spans plus an
  `end(span, reader)` that runs an extent reader on the normalised text and maps
  its end back to original offsets. `replaceValues`, `tallyText` and
  `CouncilEgress.replace` use it; `detectNormalized` is its `spans`.
- Two tests (`a key block whose markers are disguised leaves whole`) build such a
  block at run time; they failed before this change and pass after it.
- The engine chunk now measures 32,305 B. Its ceiling in
  `src/config/hook-bundle-budget.json` rises 32,000 -> 33,000 with a new
  `raise_log` entry; no other value in that file changes.

This round runs with `--rounds 1`, so no answer is forwarded to a second round.

## Unchanged from round 1

The branch calls the normalised detection from `replaceValues`
(`_lib/egress_token.ts`), `tallyText` (`_lib/egress_text.ts`) and
`CouncilEgress.replace` / `CouncilEgress.check` (`ai_council/council_egress.ts`).
`LATIN_TWIN` moved from `confusables.ts` into `egress_normalize.ts` as a string of
three-hex-digit code points aligned with a string of Latin letters (checked equal
to the old map, 50 pairs). `normalizeForDetection` keeps one `origin` array.

## The question

Classify the change and look for defects:

- **Verdict:** `confirmed-non-expanding` (touches a gated surface, expands no
  authority), `ratified` (expands authority, and you approve), or
  `REQUEST_CHANGES` with the findings that block it.
- **Defects to look for, not limited to:** offsets mapped wrongly in either
  direction (astral characters, a hidden character at a span edge, a folded
  letter at a span edge, an end offset that lands between a hidden character and
  the next visible one); an extent reader that now over- or under-replaces; a
  final check that refuses a body it should pass, or passes one it should
  refuse; a misaligned `FOREIGN`/`LATIN` pair; whether the ceiling raise is
  justified by what it carries; anything the dispatcher now loads or runs that it
  did not before.

State which files you actually read. Inlined below: the `src/` delta
(`git diff origin/main...HEAD -- src` at `462aa3560f`) and the whole gated module.
Left out: the roadmap prose, the bench report
`internal/bench/reports/egress-placeholders-engine-ci-2026-10-24.md` and the two
prompt files.

## The `src/` delta

~~~diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 9a2c72d2d8..50d610e35f 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -54,6 +54,16 @@
             "what_was_added": "A user-addressed channel in the dispatcher: a `notification` concern may reply `user_notice`, and on claude the dispatcher emits it as `systemMessage`, the field the host documents as shown to the user and not added to model context (hooks/user_notice.ts: collectUserNotice; host_semantics: withUserNotice, which merges context, the native emission and the notice as structures and falls back to the old output whenever a field it would extend has the wrong type, and writeStdout, which writes the output and only then a small user-global receipt naming the session and the notice id for each notice actually in the output, so a concern counts a notice as shown only on that receipt). Plus one LAZY_CONCERNS row for `update-notice`, whose body ships in its own chunk. Measured with one esbuild invocation over origin/main and over this branch after merging it: +2,945 bytes of own source (host_semantics +1,582, user_notice +1,095, dispatch_hook +116, lazy_concern +152; identifier renames elsewhere net 0), so 1,553,708 B against 1,551,000, the base reading 1,550,763. The logic sits in the two helper modules rather than in dispatch_hook.ts because that file is at the 1,500-line source cap. The first measurement, +1,391 B, predated the structural merge, the type guards and the delivery receipt that council rounds asked for.",
             "why_it_could_not_be_avoided": "The channel is what step 3.1 was reopened for: every host runs the dispatcher on pipes, so a notice on stderr reached nobody, and a council round refused the registration for exactly that. The bytes are dispatcher code on the emission path of every event, so a chunk cannot carry them; the concern body is already in one. Room was not re-tried: the 2026-10-23 and 2026-10-24 entries measured the two narrow-event chunk candidates (`session-eol`, `handoff-context`) as buying a few hundred bytes for a quarter-megabyte require on every event, and nothing in this tree has changed that trade. Own code was compacted first (1,545 -> 1,391 B).",
             "what_would_have_caught_it": "Nothing earlier: the base sat about 240 bytes under the ceiling. Sized to this change plus 292 bytes."
+        },
+        {
+            "date": "2026-10-24",
+            "chunk": "src/scripts/_lib/egress_engine.ts",
+            "from": 32000,
+            "to": 33000,
+            "by": "agent, drain/one-detector-20261024 (road-to-one-detector-and-the-senders-we-own 2.5)",
+            "what_was_added": "The invisible-character normalisation of one-detector 2.5 wired into the engine: `replaceValues` and `tallyText` now detect through `egress_normalize.ts` (`detectWithExtent`), and a rule's extent reader (`through`) runs on the normalised text with its end mapped back, so a key block whose BEGIN and END markers both carry a zero-width character is removed whole instead of refused or left behind. Measured 30,511 bytes on origin/main, 31,907 with the wiring alone, 32,305 with the extent fix.",
+            "why_it_could_not_be_avoided": "The 2026-10-18 derivation queued this rescan inside the 32,000 ceiling and the 2026-10-22 raise recorded it as not yet in the chunk. Room was taken first: `LATIN_TWIN` moved out of confusables.ts as a hex-encoded string pair so the chunk no longer carries that module's four script regexes, and the normaliser keeps one origin array instead of two (32,670 down to 31,907). The extent fix that a council seat found in round 1 of the ratification review adds about 400 bytes of mapping code no smaller form carries. The chunk loads only when a caller needs detection; the dispatch bundle is unchanged.",
+            "what_would_have_caught_it": "Measuring the wired engine when 2.5 was first built rather than the unwired module, and a disguised-marker key block in the extent tests from the start."
         }
     ],
     "chunks": [
@@ -65,7 +75,7 @@
         },
         {
             "entry": "src/scripts/_lib/egress_engine.ts",
-            "max_bytes": 32000,
+            "max_bytes": 33000,
             "registered_at": "2026-10-18",
             "derivation": "Measured 18,478 bytes on 2026-10-18 (the rule table, the token grammar and the commit scanner, with the per-rule linearity prose moved to a test-only module). The ceiling is that reading plus the queued engine work of road-to-one-detector-and-the-senders-we-own (validated identifier rules about 4.3 KB, known values, the invisible-character rescan and the variant suffix about 1-2 KB each), rounded up. An AI council of two providers chose on 2026-10-18 to move the engine out of the dispatch bundle into this conditional chunk rather than raise the dispatch ceiling, and asked that the chunk carry a measured budget of its own so the move does not just relocate uncontrolled growth. A raise follows the same rule as max_bytes: a raise_log entry naming the chunk (`chunk`: this entry) and what was added."
         },
diff --git a/src/scripts/_lib/confusables.ts b/src/scripts/_lib/confusables.ts
index e3769f5fba..e4a550b64f 100644
--- a/src/scripts/_lib/confusables.ts
+++ b/src/scripts/_lib/confusables.ts
@@ -49,25 +49,6 @@ export const CONFUSABLE_FOREIGN: ReadonlySet<number> = new Set([
     0x03a1 /*Ρ→P*/, 0x03a4 /*Τ→T*/, 0x03a5 /*Υ→Y*/, 0x03a7 /*Χ→X*/, 0x0392 /*Β→B*/,
 ]);
 
-/**
- * The basic-Latin twin of each confusable foreign letter that has one, for a
- * detector that folds a lookalike back before matching. Every key is in
- * `CONFUSABLE_FOREIGN`, which a test holds.
- */
-export const LATIN_TWIN: ReadonlyMap<number, string> = new Map([
-    [0x0430, 'a'], [0x0435, 'e'], [0x043e, 'o'], [0x0440, 'p'], [0x0441, 'c'],
-    [0x0443, 'y'], [0x0445, 'x'], [0x0455, 's'], [0x0456, 'i'], [0x0458, 'j'],
-    [0x04bb, 'h'], [0x0501, 'd'], [0x051b, 'q'],
-    [0x0410, 'A'], [0x0412, 'B'], [0x0415, 'E'], [0x041a, 'K'], [0x041c, 'M'],
-    [0x041d, 'H'], [0x041e, 'O'], [0x0420, 'P'], [0x0421, 'C'], [0x0422, 'T'],
-    [0x0423, 'Y'], [0x0425, 'X'], [0x0405, 'S'], [0x0406, 'I'], [0x0408, 'J'],
-    [0x03b1, 'a'], [0x03b5, 'e'], [0x03bf, 'o'], [0x03bd, 'v'], [0x03c1, 'p'],
-    [0x03c5, 'u'], [0x03c7, 'x'], [0x03ba, 'k'],
-    [0x0391, 'A'], [0x0392, 'B'], [0x0395, 'E'], [0x0396, 'Z'], [0x0397, 'H'],
-    [0x0399, 'I'], [0x039a, 'K'], [0x039c, 'M'], [0x039d, 'N'], [0x039f, 'O'],
-    [0x03a1, 'P'], [0x03a4, 'T'], [0x03a5, 'Y'], [0x03a7, 'X'],
-]);
-
 type ScriptName = 'latin' | 'cyrillic' | 'greek' | 'other';
 
 function _script_of(ch: string): ScriptName {
diff --git a/src/scripts/_lib/egress_normalize.test.ts b/src/scripts/_lib/egress_normalize.test.ts
index 28d8e205ff..6e6071ec64 100644
--- a/src/scripts/_lib/egress_normalize.test.ts
+++ b/src/scripts/_lib/egress_normalize.test.ts
@@ -12,9 +12,12 @@ import { fileURLToPath } from 'node:url';
 
 import { describe, expect, it } from 'vitest';
 
-import { CONFUSABLE_FOREIGN, LATIN_TWIN } from './confusables.js';
-import { detectNormalized, HIDDEN_UNICODE_RE, normalizeForDetection } from './egress_normalize.js';
+import { CONFUSABLE_FOREIGN } from './confusables.js';
+import { detectNormalized, HIDDEN_UNICODE_RE, LATIN_TWIN, normalizeForDetection } from './egress_normalize.js';
 import { detect } from './egress_rules.js';
+import { tallyText } from './egress_text.js';
+import { parseTokens, replaceValues, TokenScope } from './egress_token.js';
+import { CouncilEgress } from '../ai_council/council_egress.js';
 
 const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
 const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'global-knowledge-redaction');
@@ -51,6 +54,64 @@ describe('the smuggling fixtures', () => {
     });
 });
 
+describe('the senders read through the normalisation', () => {
+    // The two fixtures each hide one value: a key broken by a zero-width space and
+    // an address with a Cyrillic letter. Plain `detect` sees neither (above).
+    const hiddenKey = read('zerowidth-secret.md');
+    const homoglyph = read('homoglyph-email.md');
+    const keyBytes = (text: string): string => {
+        const s = detectNormalized(text).find((x) => x.type === 'APIKEY');
+        return text.slice(s!.start, s!.end);
+    };
+
+    it('replaceValues removes the disguised key bytes and mints a token for them', () => {
+        const out = replaceValues(hiddenKey, new TokenScope());
+        expect(out.includes(keyBytes(hiddenKey))).toBe(false);
+        expect(parseTokens(out).some((t) => t.type === 'APIKEY')).toBe(true);
+    });
+
+    it('replaceValues replaces the homoglyph address', () => {
+        const out = replaceValues(homoglyph, new TokenScope());
+        expect(parseTokens(out).some((t) => t.type === 'EMAIL')).toBe(true);
+    });
+
+    it('tallyText counts both disguised values', () => {
+        expect(tallyText(hiddenKey).found.some((f) => f.type === 'APIKEY')).toBe(true);
+        expect(tallyText(homoglyph).found.some((f) => f.type === 'EMAIL')).toBe(true);
+    });
+
+    it('the council replaces both, and its final check refuses a body that still carries one', () => {
+        const egress = new CouncilEgress({ identifiers: true });
+        expect(egress.replace(hiddenKey).includes(keyBytes(hiddenKey))).toBe(false);
+        expect(parseTokens(egress.replace(homoglyph)).some((t) => t.type === 'EMAIL')).toBe(true);
+        expect(new CouncilEgress({ identifiers: true }).check(hiddenKey)?.reason).toBe('high-confidence-finding');
+        expect(new CouncilEgress({ identifiers: true }).check(homoglyph)?.reason).toBe('high-confidence-finding');
+    });
+});
+
+describe('a key block whose markers are disguised leaves whole', () => {
+    // Built at run time: an invisible character inside BEGIN and inside END, and a
+    // body no rule matches on its own, so only the block extent can remove it.
+    const ZW = String.fromCodePoint(0x200b);
+    const BODY = ['MIIEvQIBADANBgkqhkiG9w0BAQEFAASC', 'BKcwggSjAgEAAoIBAQC7'].join('');
+    const block = (label: string): string =>
+        [`-----BE${ZW}GIN ${label}PRIVATE KEY-----`, BODY, `-----E${ZW}ND ${label}PRIVATE KEY-----`].join('\n');
+    const text = `before\n${block('')}\nafter`;
+
+    it('replaceValues removes the body through the disguised END marker', () => {
+        const out = replaceValues(text, new TokenScope());
+        expect(out.includes(BODY)).toBe(false);
+        expect(out.startsWith('before\n') && out.endsWith('\nafter')).toBe(true);
+    });
+
+    it('the council masks the body too, and nothing of the block reaches the final check', () => {
+        const egress = new CouncilEgress({ identifiers: false });
+        const out = egress.replace(text);
+        expect(out.includes(BODY)).toBe(false);
+        expect(egress.check(out)).toBe(null);
+    });
+});
+
 describe('evasion corpus — counted misses per mutation', () => {
     const EMAIL = j('jane.doe', '@acme-kunde.de');
     const IBAN = j('DE89', '3704', '0044', '0532', '0130', '00');
diff --git a/src/scripts/_lib/egress_normalize.ts b/src/scripts/_lib/egress_normalize.ts
index 935d613918..5c739e2ae0 100644
--- a/src/scripts/_lib/egress_normalize.ts
+++ b/src/scripts/_lib/egress_normalize.ts
@@ -8,9 +8,20 @@
  * back to the original offsets, so a replacement removes the disguised bytes
  * too. Pure: no I/O.
  */
-import { LATIN_TWIN } from './confusables.js';
 import { detect, EGRESS_RULES, type EgressRule, type EgressSpan } from './egress_rules.js';
 
+// Aligned: the n-th code point of FOREIGN, three hex digits each, folds to the
+// n-th letter of LATIN. Kept here, not in confusables.ts, so the engine chunk
+// does not carry that module's script regexes.
+const FOREIGN = '43043543e4404414434454554564584bb50151b41041241541a41c41d41e4204214224234254054064083b13b53bf3bd3c13c53c73ba39139239539639739939a39c39d39f3a13a43a53a7';
+const LATIN = 'aeopcyxsijhdqABEKMHOPCTYXSIJaeovpuxkABEZHIKMNOPTYX';
+
+/**
+ * The basic-Latin twin of each confusable foreign letter that has one. Every
+ * key is in `CONFUSABLE_FOREIGN` (confusables.ts), which a test holds.
+ */
+export const LATIN_TWIN: ReadonlyMap<number, string> = new Map([...LATIN].map((c, i) => [parseInt(FOREIGN.slice(i * 3, i * 3 + 3), 16), c]));
+
 /**
  * Invisible and bidirectional-control characters: soft hyphen, zero-width
  * marks, bidi embeddings and isolates, word joiners, the BOM and the Tag block.
@@ -19,17 +30,15 @@ export const HIDDEN_UNICODE_RE = /[­​-‏‪-‮⁠-⁤⁦-⁩﻿\u{E0000}-\u
 
 export interface Normalized {
     readonly text: string;
-    /** For each UTF-16 unit of `text`, the original offsets of the character it came from. */
-    readonly originStart: readonly number[];
-    readonly originEnd: readonly number[];
+    /** For each UTF-16 unit of `text`, the original offset of the character it came from. */
+    readonly origin: readonly number[];
     readonly hidden: number;
     readonly folded: number;
 }
 
 export function normalizeForDetection(text: string): Normalized {
-    const out: string[] = [];
-    const originStart: number[] = [];
-    const originEnd: number[] = [];
+    let out = '';
+    const origin: number[] = [];
     let hidden = 0;
     let folded = 0;
     let at = 0;
@@ -38,30 +47,51 @@ export function normalizeForDetection(text: string): Normalized {
         if (HIDDEN_UNICODE_RE.test(ch)) {
             hidden += 1;
         } else {
-            const twin = LATIN_TWIN.get(ch.codePointAt(0) as number);
-            if (twin !== undefined) folded += 1;
-            const emit = twin ?? ch;
-            for (let k = 0; k < emit.length; k += 1) {
-                originStart.push(at);
-                originEnd.push(at + ch.length);
-            }
-            out.push(emit);
+            const emit = LATIN_TWIN.get(ch.codePointAt(0) as number) ?? ch;
+            if (emit !== ch) folded += 1;
+            out += emit;
+            for (let k = 0; k < emit.length; k += 1) origin.push(at);
         }
         at += ch.length;
     }
-    return { text: out.join(''), originStart, originEnd, hidden, folded };
+    return { text: out, origin, hidden, folded };
+}
+
+export interface NormalizedDetection {
+    readonly spans: EgressSpan[];
+    /**
+     * An extent reader such as a rule's `through`, applied to the text the spans
+     * were found in, with its end in original offsets. A disguised END marker is
+     * then seen by the reader exactly as the disguised BEGIN was by the rule.
+     */
+    end<S extends EgressSpan>(span: S, read: (text: string, span: S) => number | null): number | null;
 }
 
 /**
  * `detect`, run on the normalised text with spans in original offsets. With no
  * invisible or confusable character the result is `detect(text)` exactly.
  */
-export function detectNormalized(text: string, rules: readonly EgressRule[] = EGRESS_RULES): EgressSpan[] {
+export function detectWithExtent(text: string, rules: readonly EgressRule[] = EGRESS_RULES): NormalizedDetection {
     const n = normalizeForDetection(text);
-    if (n.hidden === 0 && n.folded === 0) return detect(text, rules);
-    return detect(n.text, rules).map((s) => ({
-        ...s,
-        start: n.originStart[s.start] as number,
-        end: n.originEnd[s.end - 1] as number,
-    }));
+    if (n.hidden === 0 && n.folded === 0) return { spans: detect(text, rules), end: (s, read) => read(text, s) };
+    const back = (i: number): number => {
+        const o = n.origin[i - 1] as number;
+        return o + ((text.codePointAt(o) as number) > 0xffff ? 2 : 1);
+    };
+    const fwd = (o: number): number => {
+        let i = 0;
+        while (i < n.origin.length && (n.origin[i] as number) < o) i += 1;
+        return i;
+    };
+    return {
+        spans: detect(n.text, rules).map((s) => ({ ...s, start: n.origin[s.start] as number, end: back(s.end) })),
+        end: (s, read) => {
+            const e = read(n.text, { ...s, start: fwd(s.start), end: fwd(s.end) });
+            return e === null ? null : back(e);
+        },
+    };
+}
+
+export function detectNormalized(text: string, rules: readonly EgressRule[] = EGRESS_RULES): EgressSpan[] {
+    return detectWithExtent(text, rules).spans;
 }
diff --git a/src/scripts/_lib/egress_text.ts b/src/scripts/_lib/egress_text.ts
index 4165e9f2e8..12d0cc7a16 100644
--- a/src/scripts/_lib/egress_text.ts
+++ b/src/scripts/_lib/egress_text.ts
@@ -3,7 +3,8 @@
 // (`egress_engine.ts`, D9), so the stage keeps the field walk and the chunk
 // keeps everything that reads a rule.
 
-import { detect, EGRESS_RULES, type EgressClass } from './egress_rules.js';
+import { detectWithExtent } from './egress_normalize.js';
+import { EGRESS_RULES, type EgressClass } from './egress_rules.js';
 import { EgressRefusedError, replaceValues, type TokenScope } from './egress_token.js';
 
 const RULE_BY_ID = new Map(EGRESS_RULES.map((r) => [r.rule, r]));
@@ -19,10 +20,11 @@ export interface TextTally {
 export function tallyText(text: string): TextTally {
     const found: Array<{ class: EgressClass; type: string }> = [];
     const refused: string[] = [];
-    for (const span of detect(text)) {
+    const at = detectWithExtent(text);
+    for (const span of at.spans) {
         const policy = RULE_BY_ID.get(span.rule)?.replacement;
         if (policy !== undefined && policy !== 'detection') {
-            const end = policy.through(text, span);
+            const end = at.end(span, policy.through);
             if (end === null || end < span.end) {
                 refused.push(span.rule);
                 continue;
diff --git a/src/scripts/_lib/egress_token.ts b/src/scripts/_lib/egress_token.ts
index 14fbe02c8a..926168ad3d 100644
--- a/src/scripts/_lib/egress_token.ts
+++ b/src/scripts/_lib/egress_token.ts
@@ -5,7 +5,8 @@
 
 import { createHmac, randomBytes } from 'node:crypto';
 
-import { detect, EGRESS_RULES, type EgressClass, type EgressSpan, replaceSpans } from './egress_rules.js';
+import { detectWithExtent, type NormalizedDetection } from './egress_normalize.js';
+import { EGRESS_RULES, type EgressClass, type EgressSpan, replaceSpans } from './egress_rules.js';
 
 export const TOKEN_FP_LENGTH = 6;
 
@@ -209,12 +210,12 @@ const RULE_BY_ID = new Map(EGRESS_RULES.map((r) => [r.rule, r]));
 const CLASS_RANK: Readonly<Record<EgressClass, number>> = { credential: 1, identifier: 0 };
 
 /** The bytes each detection obliges a replacement to remove; overlapping extents merge. */
-function replacementSpans(text: string, detected: readonly EgressSpan[]): EgressSpan[] {
+function replacementSpans(detected: readonly EgressSpan[], at: NormalizedDetection): EgressSpan[] {
     const extents = detected.map((s) => {
         const policy = RULE_BY_ID.get(s.rule)?.replacement;
         if (policy === undefined) throw new EgressRefusedError(s.rule);
         if (policy === 'detection') return s;
-        const end = policy.through(text, s);
+        const end = at.end(s, policy.through);
         if (end === null || end < s.end) throw new EgressRefusedError(s.rule);
         return { ...s, end };
     });
@@ -243,8 +244,9 @@ function replacementSpans(text: string, detected: readonly EgressSpan[]): Egress
  */
 export function replaceValues(text: string, scope: TokenScope): string {
     const owned = parseTokens(text).filter((t) => scope.owns(text.slice(t.start, t.end)));
-    const detected = detect(text).filter((s) => !owned.some((t) => t.start <= s.start && s.end <= t.end));
-    const spans = replacementSpans(text, detected);
+    const at = detectWithExtent(text);
+    const detected = at.spans.filter((s) => !owned.some((t) => t.start <= s.start && s.end <= t.end));
+    const spans = replacementSpans(detected, at);
     // Mint in text order first: replaceSpans substitutes right to left, and minting
     // inside its callback would number the last value 1.
     const tokens = spans.map((s) => scope.mint(s.type, s.class, text.slice(s.start, s.end)));
diff --git a/src/scripts/_lib/production_reach.ts b/src/scripts/_lib/production_reach.ts
index 843b140ae8..09f9303cae 100644
--- a/src/scripts/_lib/production_reach.ts
+++ b/src/scripts/_lib/production_reach.ts
@@ -5,9 +5,9 @@
  * dynamic `import()` not followed. A symbol counts as reached when some module
  * in the closure imports it BY NAME from its defining module (or imports that
  * module whole), or when the defining module is itself an entry. Reaching the
- * module is not enough — `egress_normalize.ts` is in the closure for one regex
- * while `detectNormalized` has no production importer, and that is the case
- * this exists to see.
+ * module is not enough — `egress_normalize.ts` was in the closure for one regex
+ * while `detectNormalized` had no production importer (until one-detector 2.5
+ * wired it), and that is the case this exists to see.
  */
 import { spawnSync } from 'node:child_process';
 import * as fs from 'node:fs';
diff --git a/src/scripts/ai_council/council_egress.ts b/src/scripts/ai_council/council_egress.ts
index cfa2b045c4..53c8223aab 100644
--- a/src/scripts/ai_council/council_egress.ts
+++ b/src/scripts/ai_council/council_egress.ts
@@ -17,8 +17,8 @@
  * decision D8, which this module does not take.
  */
 
+import { detectNormalized, detectWithExtent } from '../_lib/egress_normalize.js';
 import {
-    detect,
     EGRESS_RULES,
     type EgressRule,
     type EgressSpan,
@@ -26,8 +26,6 @@ import {
     prefixesOf,
     rawKeyPrefixPattern,
     replaceSpans,
-    resolveOverlaps,
-    findSpans,
     REVIEW_CREDENTIAL_ROWS,
 } from '../_lib/egress_rules.js';
 import { parseTokens, TokenScope } from '../_lib/egress_token.js';
@@ -88,9 +86,10 @@ export class CouncilEgress {
      * proven is replaced through the nearest END marker, as the line masks did.
      */
     replace(text: string): string {
-        const spans = resolveOverlaps(findSpans(text, BUNDLE_RULES))
+        const at = detectWithExtent(text, BUNDLE_RULES);
+        const spans = at.spans
             .filter((s) => s.class === 'credential' || this.opts.identifiers)
-            .map((s) => ({ ...s, end: maskingEnd(text, s) }));
+            .map((s) => ({ ...s, end: at.end(s, maskingEnd) ?? s.end }));
         spans.sort((a, b) => a.start - b.start);
         const merged: EgressSpan[] = [];
         for (const s of spans) {
@@ -124,7 +123,7 @@ export class CouncilEgress {
         for (const value of this.replaced) {
             if (body.includes(value)) return { reason: 'replaced-value-present', what: 'value replaced in this run' };
         }
-        for (const s of detect(body)) {
+        for (const s of detectNormalized(body)) {
             const high = s.class === 'credential' ? s.rule !== 'generic-assignment' : s.validated && this.opts.identifiers;
             if (high) return { reason: 'high-confidence-finding', what: s.rule };
         }
~~~

## `src/scripts/_lib/egress_normalize.ts` in full

~~~ts
/**
 * Detection through invisible characters and lookalike letters.
 *
 * A zero-width space inside an address, or a Cyrillic `а` in place of a Latin
 * `a`, defeats every pattern while the value still reads whole to a model. So
 * the text is normalised — invisible characters removed, each confusable letter
 * folded to its Latin twin — the table is run on that, and every span is mapped
 * back to the original offsets, so a replacement removes the disguised bytes
 * too. Pure: no I/O.
 */
import { detect, EGRESS_RULES, type EgressRule, type EgressSpan } from './egress_rules.js';

// Aligned: the n-th code point of FOREIGN, three hex digits each, folds to the
// n-th letter of LATIN. Kept here, not in confusables.ts, so the engine chunk
// does not carry that module's script regexes.
const FOREIGN = '43043543e4404414434454554564584bb50151b41041241541a41c41d41e4204214224234254054064083b13b53bf3bd3c13c53c73ba39139239539639739939a39c39d39f3a13a43a53a7';
const LATIN = 'aeopcyxsijhdqABEKMHOPCTYXSIJaeovpuxkABEZHIKMNOPTYX';

/**
 * The basic-Latin twin of each confusable foreign letter that has one. Every
 * key is in `CONFUSABLE_FOREIGN` (confusables.ts), which a test holds.
 */
export const LATIN_TWIN: ReadonlyMap<number, string> = new Map([...LATIN].map((c, i) => [parseInt(FOREIGN.slice(i * 3, i * 3 + 3), 16), c]));

/**
 * Invisible and bidirectional-control characters: soft hyphen, zero-width
 * marks, bidi embeddings and isolates, word joiners, the BOM and the Tag block.
 */
export const HIDDEN_UNICODE_RE = /[­​-‏‪-‮⁠-⁤⁦-⁩﻿\u{E0000}-\u{E007F}]/gu;

export interface Normalized {
    readonly text: string;
    /** For each UTF-16 unit of `text`, the original offset of the character it came from. */
    readonly origin: readonly number[];
    readonly hidden: number;
    readonly folded: number;
}

export function normalizeForDetection(text: string): Normalized {
    let out = '';
    const origin: number[] = [];
    let hidden = 0;
    let folded = 0;
    let at = 0;
    for (const ch of text) {
        HIDDEN_UNICODE_RE.lastIndex = 0;
        if (HIDDEN_UNICODE_RE.test(ch)) {
            hidden += 1;
        } else {
            const emit = LATIN_TWIN.get(ch.codePointAt(0) as number) ?? ch;
            if (emit !== ch) folded += 1;
            out += emit;
            for (let k = 0; k < emit.length; k += 1) origin.push(at);
        }
        at += ch.length;
    }
    return { text: out, origin, hidden, folded };
}

export interface NormalizedDetection {
    readonly spans: EgressSpan[];
    /**
     * An extent reader such as a rule's `through`, applied to the text the spans
     * were found in, with its end in original offsets. A disguised END marker is
     * then seen by the reader exactly as the disguised BEGIN was by the rule.
     */
    end<S extends EgressSpan>(span: S, read: (text: string, span: S) => number | null): number | null;
}

/**
 * `detect`, run on the normalised text with spans in original offsets. With no
 * invisible or confusable character the result is `detect(text)` exactly.
 */
export function detectWithExtent(text: string, rules: readonly EgressRule[] = EGRESS_RULES): NormalizedDetection {
    const n = normalizeForDetection(text);
    if (n.hidden === 0 && n.folded === 0) return { spans: detect(text, rules), end: (s, read) => read(text, s) };
    const back = (i: number): number => {
        const o = n.origin[i - 1] as number;
        return o + ((text.codePointAt(o) as number) > 0xffff ? 2 : 1);
    };
    const fwd = (o: number): number => {
        let i = 0;
        while (i < n.origin.length && (n.origin[i] as number) < o) i += 1;
        return i;
    };
    return {
        spans: detect(n.text, rules).map((s) => ({ ...s, start: n.origin[s.start] as number, end: back(s.end) })),
        end: (s, read) => {
            const e = read(n.text, { ...s, start: fwd(s.start), end: fwd(s.end) });
            return e === null ? null : back(e);
        },
    };
}

export function detectNormalized(text: string, rules: readonly EgressRule[] = EGRESS_RULES): EgressSpan[] {
    return detectWithExtent(text, rules).spans;
}
~~~

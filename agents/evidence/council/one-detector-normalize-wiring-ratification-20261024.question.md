<!-- evidence-type: analysis -->

<!-- A prompt for the council, written 2026-10-24 for branch drain/one-detector-20261024,
     round 1, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/one-detector-20261024, round 1 — the senders detect through `detectNormalized`

Ratification review under ADR-268 § 4. `check_kernel_edit_ratified --base origin/main`
gates exactly one file on this branch: `src/scripts/_lib/egress_normalize.ts`
(hook-plumbing source — it is in the dispatch import closure because
`knowledge_global_redaction.ts` imports `HIDDEN_UNICODE_RE` from it). Reviewed
commit `9010d6ba90`; subject digest
`7d6343157ff5ec5ee52b13ac3be5ece882591284702ca3ad1d45f5e84d45e2ab`, from
`./scripts-run src/scripts/ratification_subject --files $(git diff --name-only origin/main...HEAD) --base-ref origin/main`.

The `src/` delta is inlined below (`git diff origin/main...HEAD -- src`, at
`4f2713a40f`), followed by the whole of the gated file as it stands. Left out of
the inline material: the roadmap prose, the bench report
`internal/bench/reports/egress-placeholders-engine-ci-2026-10-24.md` and this
prompt. If you can read the branch, `git diff origin/main...drain/one-detector-20261024`
shows all of it; every file is in scope, not only the gated one.

## What the branch does

Roadmap `road-to-one-detector-and-the-senders-we-own` step 2.5 built
`detectNormalized` (detection after removing invisible characters and folding
Cyrillic/Greek lookalike letters to Latin, spans mapped back to original
offsets), but no production path called it. This branch calls it from:

1. `replaceValues` in `src/scripts/_lib/egress_token.ts` and `tallyText` in
   `src/scripts/_lib/egress_text.ts` — both in the egress engine chunk the
   dispatcher loads lazily (egress stage, injection path);
2. `CouncilEgress.replace` and `CouncilEgress.check` (the final check before a
   council member call) in `src/scripts/ai_council/council_egress.ts`.

To keep the engine chunk under its 32,000-byte ceiling without a raise, the
`LATIN_TWIN` map moved out of `src/scripts/_lib/confusables.ts` (which also
carries four script regexes the chunk would otherwise include) into
`egress_normalize.ts`, encoded as a string of three-hex-digit code points aligned
with a string of Latin letters; and `normalizeForDetection` keeps one `origin`
array instead of two, computing a span's end from the original character's
length. The decoded map was checked equal to the old one (50 entries, same
pairs). The chunk measures 31,907 B (`check_hook_bundle_composition`).

Four new tests in `src/scripts/_lib/egress_normalize.test.ts`
(› `the senders read through the normalisation`) fail with the three call sites
reverted and pass with them.

## The question

Classify the change and look for defects:

- **Verdict:** `confirmed-non-expanding` (touches a gated surface, expands no
  authority), `ratified` (expands authority, and you approve), or
  `REQUEST_CHANGES` with the findings that block it.
- **Defects to look for, not limited to:** a span mapped back to the wrong
  original offsets (astral characters, a hidden character at a span edge, a
  folded letter at a span edge); a replacement extent (`through`) computed on
  the original text from a mapped span that now refuses or under-replaces; a
  final check that refuses a body it should pass, or passes one it should
  refuse; a misaligned `FOREIGN`/`LATIN` pair; anything the dispatcher now loads
  or runs that it did not before.

State which files you actually read.

## The `src/` delta

~~~diff
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
index 28d8e205ff..8c2b3a5870 100644
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
@@ -51,6 +54,41 @@ describe('the smuggling fixtures', () => {
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
 describe('evasion corpus — counted misses per mutation', () => {
     const EMAIL = j('jane.doe', '@acme-kunde.de');
     const IBAN = j('DE89', '3704', '0044', '0532', '0130', '00');
diff --git a/src/scripts/_lib/egress_normalize.ts b/src/scripts/_lib/egress_normalize.ts
index 935d613918..b67641899e 100644
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
@@ -38,18 +47,14 @@ export function normalizeForDetection(text: string): Normalized {
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
 }
 
 /**
@@ -59,9 +64,8 @@ export function normalizeForDetection(text: string): Normalized {
 export function detectNormalized(text: string, rules: readonly EgressRule[] = EGRESS_RULES): EgressSpan[] {
     const n = normalizeForDetection(text);
     if (n.hidden === 0 && n.folded === 0) return detect(text, rules);
-    return detect(n.text, rules).map((s) => ({
-        ...s,
-        start: n.originStart[s.start] as number,
-        end: n.originEnd[s.end - 1] as number,
-    }));
+    return detect(n.text, rules).map((s) => {
+        const last = n.origin[s.end - 1] as number;
+        return { ...s, start: n.origin[s.start] as number, end: last + ((text.codePointAt(last) as number) > 0xffff ? 2 : 1) };
+    });
 }
diff --git a/src/scripts/_lib/egress_text.ts b/src/scripts/_lib/egress_text.ts
index 4165e9f2e8..d22b93c0cf 100644
--- a/src/scripts/_lib/egress_text.ts
+++ b/src/scripts/_lib/egress_text.ts
@@ -3,7 +3,8 @@
 // (`egress_engine.ts`, D9), so the stage keeps the field walk and the chunk
 // keeps everything that reads a rule.
 
-import { detect, EGRESS_RULES, type EgressClass } from './egress_rules.js';
+import { detectNormalized } from './egress_normalize.js';
+import { EGRESS_RULES, type EgressClass } from './egress_rules.js';
 import { EgressRefusedError, replaceValues, type TokenScope } from './egress_token.js';
 
 const RULE_BY_ID = new Map(EGRESS_RULES.map((r) => [r.rule, r]));
@@ -19,7 +20,7 @@ export interface TextTally {
 export function tallyText(text: string): TextTally {
     const found: Array<{ class: EgressClass; type: string }> = [];
     const refused: string[] = [];
-    for (const span of detect(text)) {
+    for (const span of detectNormalized(text)) {
         const policy = RULE_BY_ID.get(span.rule)?.replacement;
         if (policy !== undefined && policy !== 'detection') {
             const end = policy.through(text, span);
diff --git a/src/scripts/_lib/egress_token.ts b/src/scripts/_lib/egress_token.ts
index 14fbe02c8a..d9aeaf51e6 100644
--- a/src/scripts/_lib/egress_token.ts
+++ b/src/scripts/_lib/egress_token.ts
@@ -5,7 +5,8 @@
 
 import { createHmac, randomBytes } from 'node:crypto';
 
-import { detect, EGRESS_RULES, type EgressClass, type EgressSpan, replaceSpans } from './egress_rules.js';
+import { detectNormalized } from './egress_normalize.js';
+import { EGRESS_RULES, type EgressClass, type EgressSpan, replaceSpans } from './egress_rules.js';
 
 export const TOKEN_FP_LENGTH = 6;
 
@@ -243,7 +244,7 @@ function replacementSpans(text: string, detected: readonly EgressSpan[]): Egress
  */
 export function replaceValues(text: string, scope: TokenScope): string {
     const owned = parseTokens(text).filter((t) => scope.owns(text.slice(t.start, t.end)));
-    const detected = detect(text).filter((s) => !owned.some((t) => t.start <= s.start && s.end <= t.end));
+    const detected = detectNormalized(text).filter((s) => !owned.some((t) => t.start <= s.start && s.end <= t.end));
     const spans = replacementSpans(text, detected);
     // Mint in text order first: replaceSpans substitutes right to left, and minting
     // inside its callback would number the last value 1.
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
index cfa2b045c4..65fd2c4b47 100644
--- a/src/scripts/ai_council/council_egress.ts
+++ b/src/scripts/ai_council/council_egress.ts
@@ -17,8 +17,8 @@
  * decision D8, which this module does not take.
  */
 
+import { detectNormalized } from '../_lib/egress_normalize.js';
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
@@ -88,7 +86,7 @@ export class CouncilEgress {
      * proven is replaced through the nearest END marker, as the line masks did.
      */
     replace(text: string): string {
-        const spans = resolveOverlaps(findSpans(text, BUNDLE_RULES))
+        const spans = detectNormalized(text, BUNDLE_RULES)
             .filter((s) => s.class === 'credential' || this.opts.identifiers)
             .map((s) => ({ ...s, end: maskingEnd(text, s) }));
         spans.sort((a, b) => a.start - b.start);
@@ -124,7 +122,7 @@ export class CouncilEgress {
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

/**
 * `detect`, run on the normalised text with spans in original offsets. With no
 * invisible or confusable character the result is `detect(text)` exactly.
 */
export function detectNormalized(text: string, rules: readonly EgressRule[] = EGRESS_RULES): EgressSpan[] {
    const n = normalizeForDetection(text);
    if (n.hidden === 0 && n.folded === 0) return detect(text, rules);
    return detect(n.text, rules).map((s) => {
        const last = n.origin[s.end - 1] as number;
        return { ...s, start: n.origin[s.start] as number, end: last + ((text.codePointAt(last) as number) > 0xffff ? 2 : 1) };
    });
}
~~~

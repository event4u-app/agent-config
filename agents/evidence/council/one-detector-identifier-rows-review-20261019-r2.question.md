<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-19 for branch drain/road-to-one-detector-and-the-senders-we-own-20261019z,
     round 2, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261019z, round 2 — identifier rows in the one rule table

Ratification review under ADR-268 § 4, round 2. The one gated file is still
`src/scripts/_lib/egress_rules.ts`. Reviewed commit `0eab3db7a`; subject digest
`9ba3386e3c49da8237a12a6f0d4ac5395ab8af8b034a74cb91744736fd8e57dd`. Round 1's
prompt is `agents/evidence/council/one-detector-identifier-rows-review-20261019.question.md`.

Round 1 (both seats REQUEST_CHANGES) raised these; what changed for each:

1. **Storage recall loss** (both seats, critical/high): the two stores that keep text
   (`knowledge_ingest`, `cross_repo_retrieve`) now detect with
   `STORAGE_IDENTIFIER_RULES` in `identifier_redaction.ts` — the identifier rows with
   every `context` requirement removed, checksums kept. A new row `phone-nanp`
   (North American shape) restores the US formats the old phone regex tagged.
   `identifier_redaction.test.ts` drives both stores' real `redact()` with a
   context-free card, national phone, US phone, IBAN, SSN, `.md` e-mail and tax ID
   and asserts each is tagged and counted, and that a timestamp, a file name and a
   version string stay untouched. Remaining difference from the old regexes, stated:
   a 13–19 digit run that fails Luhn and an IBAN-shaped string that fails mod-97 are
   no longer tagged, because neither is the identifier it looks like.
2. **`.md` TLD** excluded as a file name: removed from the file-name exclusion; a
   test asserts `person@company.md` is detected.
3. **Unbalanced parentheses**: both phone patterns now accept a parenthesised
   group only with both parentheses (`\([0-9]{1,6}\)` as an alternative, never
   independent optionals); a test asserts no detected phone span covers an
   unbalanced parenthesis, seen red with the old pattern restored.
4. **Census silently skipping unreadable files**: a tracked path missing from the
   working tree is skipped, any other read failure now throws; the header states
   the census bounds false positives only and does not protect recall.
5. **`isValidUsSsn` on malformed input**: validates its full shape and returns
   false on any other input (tested on four malformed values).
6. **Allowlist digests**: the two addresses are `dev@event4u.app` (the `author`
   e-mail in `package.json` and the plugin manifests) and `m.berg@galawork.de`
   (the copyright holder in `REUSE.toml`); both are already in tracked, published
   files.
7. **Classification**: both seats called the change authority-expanding (every
   all-row reader — the egress stage in a non-`off` mode, the token replacer, the
   host-carrier session table — gains identifier subjects). The record would be
   written as `ratified`, not `confirmed-non-expanding`.

Unchanged from round 1: the other rows, the linearity companion, the egress stage
default `off`, the commit scanner and the other credential-only readers. Engine
chunk 25,741 of 28,000 B; dispatch bundle unchanged. Suites green: identifier rows,
census, storage redaction, rule table, parity, drift matrix, legacy superset,
token, knowledge-ingest, cross-repo, egress stage; `tsc --noEmit` clean. PREREG (b)
reading after the fixes: 20 of 14,274 tracked files with an identifier detection,
0 of 400 labelled negatives.

The diff below is round 2's change (`e32a4d7f7..0eab3db7a`, source and tests),
followed by the gated file in full at `0eab3db7a`.

Review it. For each defect report file:line, the failure scenario and a severity.
Say whether each round-1 finding is closed. Close with a classification
(`ratified`, `confirmed-non-expanding`, or a refusal) and a one-line stance.

## Round-2 diff

```diff
diff --git a/src/scripts/_lib/egress_identifier_census.test.ts b/src/scripts/_lib/egress_identifier_census.test.ts
index 1c2507867..e4b319b46 100644
--- a/src/scripts/_lib/egress_identifier_census.test.ts
+++ b/src/scripts/_lib/egress_identifier_census.test.ts
@@ -5,7 +5,8 @@
  * matched tens of thousands of times over the tracked tree) re-run through the
  * table. A row that starts matching ordinary code or prose raises a count past
  * its ceiling and turns this red; lowering a ceiling after a precision gain is
- * the expected direction.
+ * the expected direction. A ceiling bounds false positives only: a row that
+ * stops detecting stays green here, which the rule tests guard instead.
  */
 import { execFileSync } from 'node:child_process';
 import * as fs from 'node:fs';
@@ -25,6 +26,7 @@ const CEILING: Readonly<Record<string, number>> = {
     email: 2,
     'phone-international': 0,
     'phone-national': 0,
+    'phone-nanp': 0,
     'de-tax-id': 0,
     'us-ssn': 0,
 };
@@ -36,12 +38,10 @@ describe('identifier census over src/ and docs/', () => {
             .filter(Boolean);
         const counts: Record<string, number> = Object.fromEntries(IDENTIFIER_RULES.map((r) => [r.rule, 0]));
         for (const f of files) {
-            let body: Buffer;
-            try {
-                body = fs.readFileSync(path.join(REPO, f));
-            } catch {
-                continue;
-            }
+            const full = path.join(REPO, f);
+            // A tracked path deleted in the working tree is not part of the corpus; any other read failure is.
+            if (!fs.existsSync(full)) continue;
+            const body = fs.readFileSync(full);
             if (body.length > 2_000_000 || body.includes(0)) continue;
             for (const s of detect(body.toString('utf8'))) {
                 if (s.class === 'identifier') counts[s.rule] = (counts[s.rule] ?? 0) + 1;
diff --git a/src/scripts/_lib/egress_identifier_rules.test.ts b/src/scripts/_lib/egress_identifier_rules.test.ts
index 1b167bf54..644151727 100644
--- a/src/scripts/_lib/egress_identifier_rules.test.ts
+++ b/src/scripts/_lib/egress_identifier_rules.test.ts
@@ -15,6 +15,7 @@ import {
     IDENTIFIER_RULES,
     isValidGermanTaxId,
     isValidIban,
+    isValidUsSsn,
     passesLuhn,
 } from './egress_rules.js';
 
@@ -45,14 +46,17 @@ describe('identifier rows — positives', () => {
         expect(has(`Kreditkarte: ${CARD}`, 'payment-card')).toBe(true);
     });
 
-    it('an e-mail address at a real domain', () => {
+    it('an e-mail address at a real domain, a .md country domain included', () => {
         expect(has(`write to ${EMAIL} today`, 'email')).toBe(true);
+        expect(has(j('contact ', 'person', '@company.md'), 'email')).toBe(true);
     });
 
     it('a phone number with a country code, or a national one with a phone word', () => {
         expect(has(j('call +49 30 ', '1234 5678'), 'phone-international')).toBe(true);
         expect(has(j('Tel. 030 ', '1234 5678'), 'phone-national')).toBe(true);
         expect(has(j('Telefon: (0221) ', '98765-43'), 'phone-national')).toBe(true);
+        expect(has(j('call +49 (30) ', '1234 5678'), 'phone-international')).toBe(true);
+        expect(has(j('phone (212) ', '555-0142'), 'phone-nanp')).toBe(true);
     });
 
     it('a German tax ID with a tax word, and an SSN', () => {
@@ -104,6 +108,19 @@ describe('identifier rows — negatives', () => {
         expect(has('AuditLog\\n\\n@admin.register', 'email')).toBe(false);
     });
 
+    it('an unbalanced parenthesis is not part of a number', () => {
+        for (const text of [j('call +49 (30 ', '12345678'), j('call +49 30) ', '12345678')]) {
+            const span = detect(text).find((s) => s.type === 'PHONE');
+            const covered = span === undefined ? '' : text.slice(span.start, span.end);
+            expect(covered.includes('(') || covered.includes(')'), text).toBe(false);
+        }
+    });
+
+    it('the SSN validator answers false on any input that is not the shape', () => {
+        for (const v of ['', '123456789', '123-45-678', 'abc-de-fghi']) expect(isValidUsSsn(v), v).toBe(false);
+        expect(isValidUsSsn(SSN)).toBe(true);
+    });
+
     it('a national number with no phone word, and a date after a diff marker', () => {
         expect(has(j('ref 030 ', '1234 5678'), 'phone-national')).toBe(false);
         expect(has('decided on\n+2026-10-01 by the council', 'phone-international')).toBe(false);
@@ -124,7 +141,7 @@ describe('identifier rows — negatives', () => {
 
 describe('identifier rows — table invariants', () => {
     it('every identifier row is class identifier and carries a validator, a context or exclusions', () => {
-        expect(IDENTIFIER_RULES.length).toBe(7);
+        expect(IDENTIFIER_RULES.length).toBe(8);
         for (const r of IDENTIFIER_RULES) {
             expect(r.class).toBe('identifier');
             expect(r.validator !== undefined || r.context !== undefined || r.exclusions !== undefined, r.rule).toBe(true);
diff --git a/src/scripts/_lib/egress_normalize.test.ts b/src/scripts/_lib/egress_normalize.test.ts
index 5ebd2752c..28d8e205f 100644
--- a/src/scripts/_lib/egress_normalize.test.ts
+++ b/src/scripts/_lib/egress_normalize.test.ts
@@ -40,7 +40,7 @@ describe('the smuggling fixtures', () => {
     });
 
     it('text with no hidden or confusable character detects exactly as detect()', () => {
-        const text = j('mail ', 'jane', '@acme-kunde.de and IBAN ', 'DE89370400440532013000');
+        const text = j('mail ', 'jane', '@acme-kunde.de and IBAN ', 'DE89', '3704', '0044', '0532', '0130', '00');
         expect(detectNormalized(text)).toEqual(detect(text));
     });
 
diff --git a/src/scripts/_lib/egress_rules.ts b/src/scripts/_lib/egress_rules.ts
index 8f24db356..dd42eee5c 100644
--- a/src/scripts/_lib/egress_rules.ts
+++ b/src/scripts/_lib/egress_rules.ts
@@ -190,8 +190,10 @@ export function isValidGermanTaxId(value: string): boolean {
 
 /** US social security number: no 000, 666 or 9xx area, no 00 group, no 0000 serial. */
 export function isValidUsSsn(value: string): boolean {
-    const [area, group, serial] = value.split('-');
-    return area !== '000' && area !== '666' && !(area as string).startsWith('9') && group !== '00' && serial !== '0000';
+    const m = /^([0-9]{3})-([0-9]{2})-([0-9]{4})$/.exec(value);
+    if (m === null) return false;
+    const [, area, group, serial] = m as unknown as [string, string, string, string];
+    return area !== '000' && area !== '666' && !area.startsWith('9') && group !== '00' && serial !== '0000';
 }
 
 // Addresses that name no one: documentation and reserved domains (RFC 2606,
@@ -202,7 +204,7 @@ const EMAIL_EXCLUSIONS: readonly RegExp[] = [
     /^(?:no-?reply|do-?not-?reply|noreply\+[^@]*)@/i,
     /@users\.noreply\.github\.com$/i,
     /@[0-9]x\.[a-z]+$/i,
-    /\.(?:png|jpe?g|gif|svg|webp|ico|js|mjs|cjs|ts|tsx|css|json|md|ya?ml|lock)$/i,
+    /\.(?:png|jpe?g|gif|svg|webp|ico|js|mjs|cjs|ts|tsx|css|json|ya?ml|lock)$/i,
 ];
 
 /**
@@ -423,7 +425,7 @@ export const EGRESS_RULES: readonly EgressRule[] = [
         type: 'PHONE',
         class: 'identifier',
         replacement: 'detection',
-        pattern: /(?<![A-Za-z0-9+])\+[1-9][0-9]{0,2}(?:[ ./-]?\(?(?=([0-9]{1,6}))\1\)?){1,5}(?![0-9])/g,
+        pattern: /(?<![A-Za-z0-9+])\+[1-9][0-9]{0,2}(?:[ ./-]?(?:\([0-9]{1,6}\)|(?=([0-9]{1,6}))\1)){1,5}(?![0-9])/g,
         validator: phoneDigits(8, 15),
     },
     {
@@ -431,10 +433,18 @@ export const EGRESS_RULES: readonly EgressRule[] = [
         type: 'PHONE',
         class: 'identifier',
         replacement: 'detection',
-        pattern: /(?<![A-Za-z0-9+])\(?0[1-9][0-9]{1,4}\)?(?:[ ./-]?(?=([0-9]{2,8}))\1){1,3}(?![0-9])/g,
+        pattern: /(?<![A-Za-z0-9+(])(?:\(0[1-9][0-9]{1,4}\)|0[1-9][0-9]{1,4})(?:[ ./-]?(?=([0-9]{2,8}))\1){1,3}(?![0-9])/g,
         validator: phoneDigits(7, 13),
         context: { words: /\b(?:tel|telefon|telephone|phone|mobil|mobile|cell|fax|handy|call|ruf)\b/i, window: 32 },
     },
+    {
+        rule: 'phone-nanp',
+        type: 'PHONE',
+        class: 'identifier',
+        replacement: 'detection',
+        pattern: /(?<![A-Za-z0-9+(-])(?:\([2-9][0-9]{2}\) ?|[2-9][0-9]{2}[ .-])[2-9][0-9]{2}[ .-][0-9]{4}(?![0-9-])/g,
+        context: { words: /\b(?:tel|telephone|phone|mobile|cell|fax|call)\b/i, window: 32 },
+    },
     {
         rule: 'de-tax-id',
         type: 'TAXID',
diff --git a/src/scripts/_lib/egress_rules_linearity.ts b/src/scripts/_lib/egress_rules_linearity.ts
index 07ba31b77..57b4ab4c3 100644
--- a/src/scripts/_lib/egress_rules_linearity.ts
+++ b/src/scripts/_lib/egress_rules_linearity.ts
@@ -41,9 +41,10 @@ export const LINEARITY: Readonly<Record<string, string>> = {
     'email':
         'Starts only where no address character precedes; the local part is bounded at 64, each label at 63 and the labels at eight, and the label class must end on a dot, so an attempt reads a bounded window and backtracking inside it is bounded by those constants.',
     'phone-international':
-        'Starts only at a plus sign; each digit group is consumed atomically by a lookahead-plus-backreference of at most six digits, so groups split only at separators or the six-digit cap, and at most five groups follow: an attempt reads at most about 45 characters with no re-split.',
+        'Starts only at a plus sign; each digit group is either a parenthesised run of at most six digits or consumed atomically by a lookahead-plus-backreference of at most six, so groups split only at separators or the six-digit cap, and at most five groups follow: an attempt reads at most about 45 characters with no re-split.',
     'phone-national':
-        'Starts only at a zero after a non-word character; the area code is bounded at five digits and each of at most three groups is consumed atomically by a lookahead-plus-backreference of at most eight digits, so an attempt reads at most about 35 characters with no re-split.',
+        'Starts only at a zero after a non-word character; the area code, bare or parenthesised, is bounded at five digits and each of at most three groups is consumed atomically by a lookahead-plus-backreference of at most eight digits, so an attempt reads at most about 35 characters with no re-split.',
+    'phone-nanp': 'Fixed shape: a three-digit area code, bare or parenthesised, then three and four digits with single separators; an attempt reads at most sixteen characters.',
     'de-tax-id':
         'Starts only at a digit boundary; exactly ten repetitions of an optional space and one digit follow, so an attempt reads at most 21 characters.',
     'us-ssn': 'Fixed-length digit runs between hyphens: every attempt reads at most eleven characters.',
diff --git a/src/scripts/_lib/identifier_redaction.test.ts b/src/scripts/_lib/identifier_redaction.test.ts
new file mode 100644
index 000000000..b6fba7979
--- /dev/null
+++ b/src/scripts/_lib/identifier_redaction.test.ts
@@ -0,0 +1,39 @@
+/**
+ * The two stores that keep text tag a genuine identifier whether or not a
+ * context word stands next to it. Values are assembled at runtime and compared
+ * by boolean, so a failure never prints one.
+ */
+import { describe, expect, it } from 'vitest';
+
+import { redact as ingestRedact } from '../../cli/python/knowledge_ingest.js';
+import { redact as crossRepoRedact } from '../cross_repo_retrieve.js';
+
+const j = (...p: string[]): string => p.join('');
+const CASES: ReadonlyArray<readonly [string, string, string]> = [
+    ['card, no card word', j('Account: ', '4111', '1111', '1111', '1111'), 'CC'],
+    ['national phone, no phone word', j('reach the desk at 030 ', '1234 5678'), 'PHONE'],
+    ['US phone, no phone word', j('desk ', '212-555-', '0142'), 'PHONE'],
+    ['IBAN', j('IBAN ', 'DE89', '3704', '0044', '0532', '0130', '00'), 'IBAN'],
+    ['SSN', j('file ', '123-', '45-', '6789'), 'SSN'],
+    ['e-mail at a .md domain', j('write ', 'person', '@company.md'), 'EMAIL'],
+    ['German tax ID, no tax word', j('ref ', '8609', '5742', '719'), 'TAXID'],
+];
+
+describe.each([
+    ['knowledge_ingest', (t: string, c: Record<string, number>) => ingestRedact(t, c)[0]],
+    ['cross_repo_retrieve', (t: string, c: Record<string, number>) => crossRepoRedact(t, c)[0]],
+] as const)('%s redacts before it stores', (_name, redact) => {
+    it.each(CASES)('%s', (_label, text, tag) => {
+        const counters: Record<string, number> = {};
+        const out = redact(text, counters);
+        expect(out.includes(`[${tag}]`)).toBe(true);
+        expect(counters[tag]).toBe(1);
+    });
+
+    it('leaves a number that fails its checksum, and ordinary prose, alone', () => {
+        const counters: Record<string, number> = {};
+        const text = j('build 1760912000000 shipped; see README.md and v2.3.4');
+        expect(redact(text, counters) === text).toBe(true);
+        expect(counters).toEqual({});
+    });
+});
diff --git a/src/scripts/_lib/identifier_redaction.ts b/src/scripts/_lib/identifier_redaction.ts
index d01fc3096..97e487cae 100644
--- a/src/scripts/_lib/identifier_redaction.ts
+++ b/src/scripts/_lib/identifier_redaction.ts
@@ -1,16 +1,23 @@
 /**
  * Class-tag redaction of identifiers for stores that keep text (knowledge
- * ingestion, cross-repo retrieval). Detection is the rule table's identifier
- * rows, so a value is tagged only where its checksum or context holds; the tag
- * spelling and the counter keys are this consumer's.
+ * ingestion, cross-repo retrieval).
+ *
+ * Detection is the rule table's identifier rows, read recall-first: a store
+ * that persists text has no reviewer after it, so a missed value is the costly
+ * error and a context word is not required here. The rows' checksums still
+ * hold — a number that fails Luhn is not a card, a string that fails mod-97 is
+ * not an IBAN. The tag spelling and the counter keys are this consumer's.
  */
-import { detect, IDENTIFIER_RULES, replaceSpans } from './egress_rules.js';
+import { detect, type EgressRule, IDENTIFIER_RULES, replaceSpans } from './egress_rules.js';
+
+/** The identifier rows with every context requirement dropped. */
+export const STORAGE_IDENTIFIER_RULES: readonly EgressRule[] = IDENTIFIER_RULES.map(({ context: _context, ...rest }) => rest);
 
 /** Counter key and tag per placeholder type; `CC` predates the table's `CARD`. */
 const TAG: Readonly<Record<string, string>> = { CARD: 'CC' };
 
 export function redactIdentifiers(text: string, counters: Record<string, number>): string {
-    const spans = detect(text, IDENTIFIER_RULES);
+    const spans = detect(text, STORAGE_IDENTIFIER_RULES);
     return replaceSpans(text, spans, (s) => {
         const tag = TAG[s.type] ?? s.type;
         counters[tag] = (counters[tag] ?? 0) + 1;
```

## `src/scripts/_lib/egress_rules.ts` at `0eab3db7a`

```ts
// The one rule table for values that must not leave for a model provider in
// plaintext (docs/contracts/egress-placeholders-v1.md). Every credential and
// identifier pattern is defined here and nowhere else; consumers decide policy
// (refuse, replace, report), this module only detects.
//
// Pure: no import, no I/O, no network. Every rule states why it is linear on a
// hostile input; the parity test pins what the move from secret_detector kept.

export type EgressClass = 'credential' | 'identifier';

export interface EgressRule {
    readonly rule: string;
    /** Placeholder type a replacement prints, e.g. `APIKEY`. */
    readonly type: string;
    readonly class: EgressClass;
    /** Finding kind reported by the commit-time scanner; defaults to `rule`. */
    readonly kind?: string;
    /** MUST carry the global flag. */
    readonly pattern: RegExp;
    /**
     * Which bytes a replacement must remove. `'detection'`: the detection span is
     * the whole secret. A `through` function returns the end of the secret for a
     * detection span, or null when that end cannot be proven; the replacer then
     * refuses the whole text rather than replace part of it.
     */
    readonly replacement: 'detection' | { readonly through: (text: string, span: SpanBounds) => number | null };
    /** Capture group holding the value; the whole match when absent. A rule that sets it MUST carry the d flag. */
    readonly valueGroup?: number;
    readonly validator?: (value: string) => boolean;
    /** The rule fires only when `words` matches within `window` chars of the value. */
    readonly context?: { readonly words: RegExp; readonly window: number };
    readonly exclusions?: readonly RegExp[];
    /**
     * Literal vendor prefixes that mark a raw key by construction. Surfaces that
     * act on shape alone (a config ref, a masked log value) read these instead of
     * spelling their own list.
     */
    readonly prefixes?: readonly string[];
    /**
     * The row matches only at a token start (its pattern opens with a lookbehind
     * for a key character). A shape-only surface reading the prefixes holds them
     * to a token start exactly when this is set; a test checks it against what the
     * row actually matches.
     */
    readonly tokenStart?: true;
}

export interface SpanBounds {
    readonly start: number;
    readonly end: number;
}

/** A detected value: offsets into the scanned text, never the value itself. */
export interface EgressSpan {
    readonly rule: string;
    readonly type: string;
    readonly class: EgressClass;
    readonly start: number;
    readonly end: number;
    readonly validated: boolean;
}

export function shannonEntropy(value: string): number {
    const freq = new Map<string, number>();
    for (const ch of value) {
        freq.set(ch, (freq.get(ch) ?? 0) + 1);
    }
    const n = value.length;
    let entropy = 0;
    for (const count of freq.values()) {
        const p = count / n;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}

// A keyword-shaped assignment of a low-entropy word (`secret: moderate`) or of a
// code expression (`opts.apiKey`, `${API_KEY}`, `load()`) is not a credential.
const GENERIC_MIN_LENGTH = 16;
const GENERIC_MIN_ENTROPY = 3.3;
const CODE_EXPR = /[()$`{}<>[\];,]|->|=>|\.\w/;

export function looksLikeSecretValue(value: string): boolean {
    if (value.length < GENERIC_MIN_LENGTH || CODE_EXPR.test(value)) {
        return false;
    }
    const hasDigit = /[0-9]/.test(value);
    const mixedCase = /[a-z]/.test(value) && /[A-Z]/.test(value);
    if (!hasDigit && !mixedCase) {
        return false;
    }
    return shannonEntropy(value) >= GENERIC_MIN_ENTROPY;
}

// The nearest key marker after the header decides: an END carrying the same
// label as the header ends the block; another BEGIN, an END with a different
// label, or no marker at all means the extent is unproven. One sticky scan from
// the header to the nearest marker keeps this linear even over many headers.
const KEY_MARKER = /-----(BEGIN|END) ([A-Z ]*)PRIVATE KEY-----/g;
const BEGIN_LABEL = /^-----BEGIN ([A-Z ]*)PRIVATE KEY-----/;

export function pemBlockEnd(text: string, span: SpanBounds): number | null {
    const label = BEGIN_LABEL.exec(text.slice(span.start, span.end))?.[1];
    if (label === undefined) return null;
    KEY_MARKER.lastIndex = span.end;
    const m = KEY_MARKER.exec(text);
    if (m === null || m[1] !== 'END' || m[2] !== label) return null;
    return m.index + m[0].length;
}

/**
 * End of the first key-end marker of any label after the header, or null. For a
 * masking surface that cannot refuse: when the block's extent is unproven it
 * masks too much rather than leaving the key body behind.
 */
export function pemMaskEnd(text: string, span: SpanBounds): number | null {
    KEY_MARKER.lastIndex = span.end;
    for (let m = KEY_MARKER.exec(text); m !== null; m = KEY_MARKER.exec(text)) {
        if (m[1] === 'END') return m.index + m[0].length;
    }
    return null;
}

// Identifier validators. A shape alone is never enough to replace an identifier:
// each row carries a checksum, a context word, or both, because a false positive
// here damages ordinary code and review text.

// IBAN length per country (ISO 13616 registry), packed as `CCnn` pairs.
const IBAN_LENGTHS =
    'AD24AE23AL28AT20AZ28BA20BE16BG22BH22BR29BY28CH21CR22CY28CZ24DE22DK18DO28EE20EG29ES24FI18FO18FR27GB22GE22GI23GL18GR27GT28HR21HU28IE22IL23IQ23IS26IT27JO30KW30KZ20LB28LC32LI21LT20LU20LV21MC27MD24ME22MK19MR27MT31MU30NL18NO15PK24PL28PS29PT25QA29RO24RS22SA24SC31SE24SI19SK24SM27ST25SV28TL23TN24TR26UA29VA22VG24XK20';

export function isValidIban(value: string): boolean {
    const iban = value.replace(/ /g, '').toUpperCase();
    const at = IBAN_LENGTHS.indexOf(iban.slice(0, 2));
    if (at === -1 || at % 4 !== 0 || Number(IBAN_LENGTHS.slice(at + 2, at + 4)) !== iban.length) return false;
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) return false;
    let rest = 0;
    for (const ch of iban.slice(4) + iban.slice(0, 4)) {
        const n = ch <= '9' ? ch.charCodeAt(0) - 48 : ch.charCodeAt(0) - 55;
        rest = n > 9 ? (rest * 100 + n) % 97 : (rest * 10 + n) % 97;
    }
    return rest === 1;
}

export function passesLuhn(value: string): boolean {
    const digits = value.replace(/[ -]/g, '');
    if (!/^[0-9]{13,19}$/.test(digits) || /^(.)\1+$/.test(digits)) return false;
    let sum = 0;
    for (let i = 0; i < digits.length; i += 1) {
        let d = digits.charCodeAt(digits.length - 1 - i) - 48;
        if (i % 2 === 1) {
            d *= 2;
            if (d > 9) d -= 9;
        }
        sum += d;
    }
    return sum % 10 === 0;
}

/** E.164 bounds: a country code plus at most 15 digits in all; never a date after a diff marker. */
function phoneDigits(min: number, max: number): (value: string) => boolean {
    return (value) => {
        if (/^\+?[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(value)) return false;
        const n = value.replace(/[^0-9]/g, '').length;
        return n >= min && n <= max;
    };
}

/**
 * German tax identification number: 11 digits, no leading zero, one digit of
 * the first ten repeated two or three times and no other repeated, and an
 * ISO 7064 MOD 11,10 check digit.
 */
export function isValidGermanTaxId(value: string): boolean {
    const d = value.replace(/ /g, '');
    if (!/^[1-9][0-9]{10}$/.test(d)) return false;
    const counts = new Map<string, number>();
    for (const ch of d.slice(0, 10)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    const repeated = [...counts.values()].filter((c) => c > 1);
    if (repeated.length !== 1 || (repeated[0] as number) > 3) return false;
    let product = 10;
    for (let i = 0; i < 10; i += 1) {
        let sum = (d.charCodeAt(i) - 48 + product) % 10;
        if (sum === 0) sum = 10;
        product = (sum * 2) % 11;
    }
    const check = (11 - product) % 10;
    return check === d.charCodeAt(10) - 48;
}

/** US social security number: no 000, 666 or 9xx area, no 00 group, no 0000 serial. */
export function isValidUsSsn(value: string): boolean {
    const m = /^([0-9]{3})-([0-9]{2})-([0-9]{4})$/.exec(value);
    if (m === null) return false;
    const [, area, group, serial] = m as unknown as [string, string, string, string];
    return area !== '000' && area !== '666' && !area.startsWith('9') && group !== '00' && serial !== '0000';
}

// Addresses that name no one: documentation and reserved domains (RFC 2606,
// RFC 6761), no-reply senders, and image-density file names (`logo@2x.png`).
const EMAIL_EXCLUSIONS: readonly RegExp[] = [
    /^git@/i,
    /@(?:[a-z0-9-]+\.)*(?:example\.(?:com|net|org)|example|test|invalid|localhost|local)$/i,
    /^(?:no-?reply|do-?not-?reply|noreply\+[^@]*)@/i,
    /@users\.noreply\.github\.com$/i,
    /@[0-9]x\.[a-z]+$/i,
    /\.(?:png|jpe?g|gif|svg|webp|ico|js|mjs|cjs|ts|tsx|css|json|ya?ml|lock)$/i,
];

/**
 * The repository's own published identities (package author, copyright holder),
 * held as keyed 64-bit FNV-1a digests of the lower-cased address so the list
 * reads as noise. A digest hides an address from a reader, not from someone who
 * guesses it; the list exists to keep the tree's own metadata out of a review's
 * placeholder count.
 */
const EMAIL_ALLOWLIST_DIGESTS: ReadonlySet<string> = new Set(['924acfa874365f8a', '8066a43fc18158bf']);

export function emailAllowlistDigest(address: string): string {
    let h = 0xcbf29ce484222325n;
    for (const ch of `egress-email-allowlist-v1\u0000${address.toLowerCase()}`) {
        h ^= BigInt(ch.codePointAt(0) as number);
        h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
    }
    return h.toString(16).padStart(16, '0');
}

function isReportableEmail(value: string): boolean {
    return !EMAIL_ALLOWLIST_DIGESTS.has(emailAllowlistDigest(value));
}

// Quantifiers are unbounded where the pattern is linear without a bound, so a
// long value is matched whole and no suffix survives a replacement. Each rule's
// argument for why it is linear lives in `egress_rules_linearity.ts`, kept out
// of this module because no runtime path reads it; a test refuses a row without
// one. A bound remains only where the unbounded form was quadratic, and what
// that bound loses is published in DETECTION_CEILINGS.
export const EGRESS_RULES: readonly EgressRule[] = [
    {
        rule: 'anthropic-api-key',
        type: 'APIKEY',
        prefixes: ['sk-ant-'],
        class: 'credential',
        replacement: 'detection',
        kind: 'anthropic-api-key',
        pattern: /sk-ant-[A-Za-z0-9_-]{20,}/g,
    },
    {
        rule: 'anthropic-project-key',
        type: 'APIKEY',
        prefixes: ['sk-proj-'],
        class: 'credential',
        replacement: 'detection',
        kind: 'anthropic-api-key',
        pattern: /sk-proj-[A-Za-z0-9_-]{20,}/g,
    },
    {
        rule: 'aws-access-key',
        type: 'APIKEY',
        prefixes: ['AKIA'],
        class: 'credential',
        replacement: 'detection',
        pattern: /AKIA[0-9A-Z]{16}/g,
    },
    {
        rule: 'google-api-key',
        type: 'APIKEY',
        prefixes: ['AIza'],
        class: 'credential',
        replacement: 'detection',
        pattern: /AIza[0-9A-Za-z_-]{35}/g,
    },
    {
        rule: 'github-pat',
        type: 'TOKEN',
        prefixes: ['ghp_'],
        class: 'credential',
        replacement: 'detection',
        pattern: /ghp_[0-9A-Za-z]{36}/g,
    },
    {
        rule: 'github-fine-grained-pat',
        type: 'TOKEN',
        prefixes: ['github_pat_'],
        class: 'credential',
        replacement: 'detection',
        kind: 'github-pat',
        pattern: /github_pat_[0-9A-Za-z_]{22,}/g,
    },
    {
        rule: 'openai-api-key',
        type: 'APIKEY',
        prefixes: ['sk-'],
        class: 'credential',
        replacement: 'detection',
        tokenStart: true,
        pattern: /(?<![A-Za-z0-9])sk-[A-Za-z0-9]{20,}/g,
    },
    {
        rule: 'google-oauth-token',
        type: 'TOKEN',
        prefixes: ['ya29.'],
        class: 'credential',
        replacement: 'detection',
        tokenStart: true,
        pattern: /(?<![A-Za-z0-9])ya29\.[0-9A-Za-z_-]{20,}/g,
    },
    {
        rule: 'github-app-token',
        type: 'TOKEN',
        prefixes: ['gho_', 'ghu_', 'ghs_', 'ghr_'],
        class: 'credential',
        replacement: 'detection',
        pattern: /gh[ousr]_[A-Za-z0-9]{36,}/g,
    },
    {
        rule: 'xai-api-key',
        type: 'APIKEY',
        prefixes: ['xai-'],
        class: 'credential',
        replacement: 'detection',
        tokenStart: true,
        pattern: /(?<![A-Za-z0-9])xai-[A-Za-z0-9]{20,}/g,
    },
    {
        rule: 'perplexity-api-key',
        type: 'APIKEY',
        prefixes: ['pplx-'],
        class: 'credential',
        replacement: 'detection',
        pattern: /pplx-[A-Za-z0-9]{20,}/g,
    },
    {
        rule: 'groq-api-key',
        type: 'APIKEY',
        prefixes: ['gsk_'],
        class: 'credential',
        replacement: 'detection',
        tokenStart: true,
        pattern: /(?<![A-Za-z0-9])gsk_[A-Za-z0-9]{20,}/g,
    },
    {
        rule: 'jwt',
        type: 'TOKEN',
        class: 'credential',
        replacement: 'detection',
        pattern:
            /(?<![A-Za-z0-9_-])(?=((?:(?!eyJ)[A-Za-z0-9_-])*))\1(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/dg,
        valueGroup: 2,
    },
    {
        rule: 'stripe-secret-key',
        type: 'APIKEY',
        prefixes: ['sk_live_', 'sk_test_'],
        class: 'credential',
        replacement: 'detection',
        pattern: /sk_(?:live|test)_[0-9A-Za-z]{16,}/g,
    },
    {
        rule: 'slack-token',
        type: 'TOKEN',
        prefixes: ['xoxb-', 'xoxp-', 'xoxa-', 'xoxr-', 'xoxs-'],
        class: 'credential',
        replacement: 'detection',
        pattern: /xox[baprs]-[0-9A-Za-z-]{10,}/g,
    },
    {
        rule: 'pem-private-key',
        type: 'PRIVATEKEY',
        class: 'credential',

        pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
        replacement: { through: pemBlockEnd },
    },
    {
        rule: 'db-connection-uri',
        type: 'DBURI',
        class: 'credential',
        replacement: 'detection',
        pattern: /(?<![a-z0-9+.-])(?=((?:(?!\b[a-z])[a-z0-9+.-])*))\1(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s:/@]+@)/dg,
        valueGroup: 2,
    },
    {
        rule: 'generic-assignment',
        type: 'SECRET',
        class: 'credential',
        replacement: 'detection',
        pattern:
            /(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"]?([^'"\s]{8,})['"]?/dgi,
        valueGroup: 1,
        validator: looksLikeSecretValue,
    },
    {
        rule: 'iban',
        type: 'IBAN',
        class: 'identifier',
        replacement: 'detection',
        pattern: /(?<![A-Za-z0-9])[A-Z]{2}[0-9]{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?(?![A-Za-z0-9])/g,
        validator: isValidIban,
    },
    {
        rule: 'payment-card',
        type: 'CARD',
        class: 'identifier',
        replacement: 'detection',
        pattern: /(?<![0-9])[0-9](?:[ -]?[0-9]){12,18}(?![0-9])/g,
        validator: passesLuhn,
        context: {
            words: /\b(?:card|credit|debit|visa|mastercard|amex|maestro|kreditkarte|karte|kartennummer|payment|zahlung)\b/i,
            window: 48,
        },
    },
    {
        rule: 'email',
        type: 'EMAIL',
        class: 'identifier',
        replacement: 'detection',
        pattern:
            /(?<![A-Za-z0-9._%+\\-])[A-Za-z0-9][A-Za-z0-9._%+-]{0,63}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.){1,8}[A-Za-z]{2,24}(?![A-Za-z0-9-])/g,
        exclusions: EMAIL_EXCLUSIONS,
        validator: isReportableEmail,
    },
    {
        rule: 'phone-international',
        type: 'PHONE',
        class: 'identifier',
        replacement: 'detection',
        pattern: /(?<![A-Za-z0-9+])\+[1-9][0-9]{0,2}(?:[ ./-]?(?:\([0-9]{1,6}\)|(?=([0-9]{1,6}))\1)){1,5}(?![0-9])/g,
        validator: phoneDigits(8, 15),
    },
    {
        rule: 'phone-national',
        type: 'PHONE',
        class: 'identifier',
        replacement: 'detection',
        pattern: /(?<![A-Za-z0-9+(])(?:\(0[1-9][0-9]{1,4}\)|0[1-9][0-9]{1,4})(?:[ ./-]?(?=([0-9]{2,8}))\1){1,3}(?![0-9])/g,
        validator: phoneDigits(7, 13),
        context: { words: /\b(?:tel|telefon|telephone|phone|mobil|mobile|cell|fax|handy|call|ruf)\b/i, window: 32 },
    },
    {
        rule: 'phone-nanp',
        type: 'PHONE',
        class: 'identifier',
        replacement: 'detection',
        pattern: /(?<![A-Za-z0-9+(-])(?:\([2-9][0-9]{2}\) ?|[2-9][0-9]{2}[ .-])[2-9][0-9]{2}[ .-][0-9]{4}(?![0-9-])/g,
        context: { words: /\b(?:tel|telephone|phone|mobile|cell|fax|call)\b/i, window: 32 },
    },
    {
        rule: 'de-tax-id',
        type: 'TAXID',
        class: 'identifier',
        replacement: 'detection',
        pattern: /(?<![0-9])[1-9](?: ?[0-9]){10}(?![0-9])/g,
        validator: isValidGermanTaxId,
        context: {
            words: /\b(?:steuer-?id|steuer-?identifikationsnummer|identifikationsnummer|idnr|tax[ -]?id|tin)\b/i,
            window: 48,
        },
    },
    {
        rule: 'us-ssn',
        type: 'SSN',
        class: 'identifier',
        replacement: 'detection',
        pattern: /(?<![0-9-])[0-9]{3}-[0-9]{2}-[0-9]{4}(?![0-9-])/g,
        validator: isValidUsSsn,
    },
];

/** The credential rows alone, for consumers whose verdict reads credentials only. */
export const CREDENTIAL_RULES: readonly EgressRule[] = EGRESS_RULES.filter((r) => r.class === 'credential');
export const IDENTIFIER_RULES: readonly EgressRule[] = EGRESS_RULES.filter((r) => r.class === 'identifier');

/** Every raw-key prefix the table declares, longest first. */
export const CREDENTIAL_PREFIXES: readonly string[] = EGRESS_RULES.flatMap((r) => r.prefixes ?? []).sort(
    (a, b) => b.length - a.length,
);

/** The prefixes one row declares; throws on an unknown rule so a rename cannot go silent. */
export function prefixesOf(rule: string): readonly string[] {
    const row = EGRESS_RULES.find((r) => r.rule === rule);
    if (row === undefined) throw new Error(`egress rule ${rule}: no such row`);
    return row.prefixes ?? [];
}

/** A row's first declared prefix — the shape a key file of that vendor starts with. */
export function vendorPrefix(rule: string): string {
    const first = prefixesOf(rule)[0];
    if (first === undefined) throw new Error(`egress rule ${rule}: declares no prefix`);
    return first;
}

const TOKEN_START_PREFIXES: ReadonlySet<string> = new Set(
    EGRESS_RULES.filter((r) => r.tokenStart === true).flatMap((r) => r.prefixes ?? []),
);

/**
 * A raw-key prefix followed by at least `minTail` key characters. Coarser than
 * the rows on purpose: it is for surfaces that refuse or mask on shape alone,
 * where a short or truncated key must still be caught.
 *
 * `boundary: 'row'` (the default) holds a prefix to a token start exactly where
 * its own row declares `tokenStart`, so the pattern never misses what the row
 * would catch and a short prefix (`sk-`) does not fire inside a word.
 * `boundary: 'never'` drops the token start for every prefix: it is for a
 * consumer whose own pre-table reading matched mid-word, and dropping it there
 * is what keeps that consumer from narrowing. `tail` narrows the key class.
 */
export function rawKeyPrefixPattern(
    minTail: number,
    prefixes: readonly string[] = CREDENTIAL_PREFIXES,
    opts: { readonly boundary?: 'row' | 'never'; readonly tail?: string } = {},
): RegExp {
    const alt = [...prefixes]
        .sort((a, b) => b.length - a.length)
        .map((p) => {
            const lit = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return opts.boundary !== 'never' && TOKEN_START_PREFIXES.has(p) ? `(?<![A-Za-z0-9])${lit}` : lit;
        })
        .join('|');
    return new RegExp(`(?:${alt})[${opts.tail ?? 'A-Za-z0-9_-'}]{${minTail},}`, 'g');
}

/**
 * End of the bytes a replacement of `span` must remove, or null when the row
 * cannot prove it (the caller then decides: a refusing surface refuses, a
 * masking surface masks the detection span).
 */
export function replacementEnd(text: string, span: EgressSpan): number | null {
    const row = EGRESS_RULES.find((r) => r.rule === span.rule);
    if (row === undefined) return null;
    if (row.replacement === 'detection') return span.end;
    const end = row.replacement.through(text, span);
    return end === null || end < span.end ? null : end;
}

/**
 * End of the bytes a MASKING surface removes for `span`. A surface that cannot
 * refuse must not leave key material behind when the row cannot prove the extent:
 * an unproven key block is masked through the nearest END marker of any label,
 * and only a span with nothing better falls back to its detection span. Every
 * masking consumer reads this, so the fallback is decided once.
 */
export function maskingEnd(text: string, span: EgressSpan): number {
    return replacementEnd(text, span) ?? (span.rule === 'pem-private-key' ? pemMaskEnd(text, span) : null) ?? span.end;
}

/**
 * Returns a description of the first unbounded quantifier (`+`, `*`, `{n,}`)
 * outside a character class, or null. Escapes and classes are skipped.
 */
export function findUnboundedQuantifier(pattern: RegExp): string | null {
    const src = pattern.source;
    let inClass = false;
    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (ch === '\\') {
            i++;
            continue;
        }
        if (inClass) {
            if (ch === ']') inClass = false;
            continue;
        }
        if (ch === '[') {
            inClass = true;
            continue;
        }
        if (ch === '+' || ch === '*') {
            return `'${ch}' at ${i}`;
        }
        if (ch === '{') {
            const m = /^\{\d+,\}/.exec(src.slice(i));
            if (m) return `'${m[0]}' at ${i}`;
        }
    }
    return null;
}

const CLASS_RANK: Readonly<Record<EgressClass, number>> = {
    credential: 1,
    identifier: 0,
};

/** A global or sticky regex keeps lastIndex between calls; reset it so every call tests the whole value. */
function testWholeValue(re: RegExp, value: string): boolean {
    re.lastIndex = 0;
    return re.test(value);
}

/**
 * Applies every field of a row to one regex match: value extraction from the
 * engine's capture offsets, exclusions, the context window and the validator.
 * The single place both readers of the table evaluate a candidate.
 */
export function evaluateMatch(
    r: EgressRule,
    text: string,
    m: RegExpExecArray,
): { start: number; end: number; validated: boolean } | null {
    const value = r.valueGroup !== undefined ? m[r.valueGroup] : m[0];
    if (value === undefined || value.length === 0) return null;
    const start = r.valueGroup !== undefined ? (m.indices?.[r.valueGroup]?.[0] ?? -1) : m.index;
    if (start < 0) {
        throw new Error(`egress rule ${r.rule}: a valueGroup rule needs the d flag for capture offsets`);
    }
    const end = start + value.length;
    if (r.exclusions?.some((x) => testWholeValue(x, value))) return null;
    if (r.context) {
        const lo = Math.max(0, start - r.context.window);
        const hi = Math.min(text.length, end + r.context.window);
        const around = text.slice(lo, start) + ' ' + text.slice(end, hi);
        r.context.words.lastIndex = 0;
        if (!r.context.words.test(around)) return null;
    }
    if (r.validator) {
        return r.validator(value) ? { start, end, validated: true } : null;
    }
    return { start, end, validated: false };
}

/** Candidate spans per rule, before overlap resolution. */
export function findSpans(text: string, rules: readonly EgressRule[] = EGRESS_RULES): EgressSpan[] {
    const out: EgressSpan[] = [];
    for (const r of rules) {
        r.pattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = r.pattern.exec(text)) !== null) {
            if (m[0].length === 0) {
                r.pattern.lastIndex += 1;
                continue;
            }
            const c = evaluateMatch(r, text, m);
            if (c === null) continue;
            const { start, end, validated } = c;
            out.push({
                rule: r.rule,
                type: r.type,
                class: r.class,
                start,
                end,
                validated,
            });
        }
    }
    return out;
}

/**
 * Resolves overlaps: the more sensitive class wins, then the validated span,
 * then the longer one, then the earlier one. Result is ordered by start.
 */
export function resolveOverlaps(spans: readonly EgressSpan[]): EgressSpan[] {
    const ranked = [...spans].sort(
        (a, b) =>
            CLASS_RANK[b.class] - CLASS_RANK[a.class] ||
            Number(b.validated) - Number(a.validated) ||
            b.end - b.start - (a.end - a.start) ||
            a.start - b.start,
    );
    const kept: EgressSpan[] = [];
    for (const s of ranked) {
        if (!kept.some((k) => s.start < k.end && k.start < s.end)) kept.push(s);
    }
    return kept.sort((a, b) => a.start - b.start);
}

export function detect(text: string, rules: readonly EgressRule[] = EGRESS_RULES): EgressSpan[] {
    return resolveOverlaps(findSpans(text, rules));
}

/**
 * Replaces non-overlapping spans right to left, so every offset still refers
 * to the original text. `index` is the span's position in start order.
 */
export function replaceSpans(
    text: string,
    spans: readonly EgressSpan[],
    replacement: (span: EgressSpan, index: number) => string,
): string {
    const ordered = [...spans].sort((a, b) => a.start - b.start);
    for (let i = 1; i < ordered.length; i++) {
        if ((ordered[i] as EgressSpan).start < (ordered[i - 1] as EgressSpan).end) {
            throw new Error('replaceSpans: spans overlap; resolve them first');
        }
    }
    let out = text;
    for (let i = ordered.length - 1; i >= 0; i--) {
        const s = ordered[i] as EgressSpan;
        out = out.slice(0, s.start) + replacement(s, i) + out.slice(s.end);
    }
    return out;
}

/** A case the pre-move rule pack detected and this table deliberately does not. */
export interface DetectionCeiling {
    readonly rule: string;
    readonly ceiling: string;
    /** Case ids in egress_rules_parity.test.ts that demonstrate the loss. */
    readonly cases: readonly string[];
}

export const DETECTION_CEILINGS: readonly DetectionCeiling[] = [];
```

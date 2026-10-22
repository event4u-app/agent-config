<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-19 for branch drain/road-to-one-detector-and-the-senders-we-own-20261019z,
     round 1, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261019z, round 1 — identifier rows in the one rule table

This is a ratification review under ADR-268 § 4. The ratification gate classifies
exactly one file of this diff as gated: `src/scripts/_lib/egress_rules.ts`
(hook-plumbing source: the dispatcher's egress stage loads the egress engine
chunk that contains it). The subject digest over the branch's changed-file list
at the reviewed commit `e32a4d7f7` is
`0bf30ce0ec15b03a1ae7d2e3425af0d69d38408927c0f5643c82e4cca94f9e76`.

Context, from the tree (roadmap `road-to-one-detector-and-the-senders-we-own`, step 2.3):

- Until this change the rule table held credential rows only. Two consumers
  (knowledge ingestion `src/cli/python/knowledge_ingest.ts`, cross-repo
  retrieval `src/scripts/cross_repo_retrieve.ts`) carried their own unvalidated
  identifier regexes (e-mail, phone, IBAN, card, SSN) and replaced matches with
  class tags.
- This change adds seven identifier rows to the table: `iban` (country length and
  ISO 13616 mod-97), `payment-card` (Luhn plus a card word within 48 characters),
  `email` (shape, exclusions for documentation/reserved domains, no-reply senders,
  `git@` remotes and file names, and an allowlist of the repository's two published
  identities held as keyed 64-bit FNV-1a digests), `phone-international`
  (`+` country code, 8–15 digits, not a date after a diff marker), `phone-national`
  (leading 0 plus a phone word), `de-tax-id` (structure, ISO 7064 MOD 11,10, a tax
  word) and `us-ssn` (reserved ranges excluded). Each row has a `LINEARITY`
  argument in `egress_rules_linearity.ts`.
- It exports `CREDENTIAL_RULES` and `IDENTIFIER_RULES`. The two consumers above now
  tag through `src/scripts/_lib/identifier_redaction.ts` (detect with the identifier
  rows, tag spellings and counter keys unchanged, `CARD` keeps the legacy `CC` key).
  `self_repair_payload` now passes `CREDENTIAL_RULES` so its payload floor keeps the
  verdict it had. Readers that already filter by class (the commit-time scanner
  `secret_detector`, the MCP config lint, the council bundler's line masking) are
  unchanged.
- Readers that take every row and so start seeing identifiers: the dispatcher's
  egress stage (`egress.placeholders.mode`, default `off`; in `observe` it counts,
  in `protect`/`strict` concerns see a placeholder view), the in-memory token
  replacer and the host-carrier session table.
- Measured: the identifier rows over the tracked tree's `src/` and `docs/` give 2
  e-mail detections and 0 of every other row (pinned as ceilings in
  `egress_identifier_census.test.ts`); over all 14,268 tracked text files, 21 files
  carry an identifier detection, most of them deliberate synthetic PII in tests.
  PREREG endpoints (a) and (b) on a seeded corpus written in the same session:
  recall 100% per type, 0 of 400 labelled negatives. The engine chunk measures
  25,320 B against its 28,000 B ceiling; the dispatch bundle is unchanged.
- Tests: `egress_identifier_rules.test.ts` (positives, negatives, table invariants,
  pathological-input timing; the IBAN checksum and the card context each seen red
  when neutralised), the census test, and the existing egress, secret-detector,
  workspace-secrets, knowledge-ingest, cross-repo and self-repair suites, all green;
  `tsc --noEmit` is clean; `check_secret_leak --all` and `check_credential_spelling`
  are green.
- Known recall change in the two tagging consumers: values the old regexes tagged
  and the validated rows do not — a national phone number with no phone word, a
  card number with no card word or failing Luhn, an IBAN-shaped string with a bad
  checksum, an unpunctuated 13–19 digit run (e.g. a millisecond timestamp).

The diff below is the gated file, its linearity companion, the new tagging module,
the three consumer edits and the two new test files. The council's own bundler
redacts secret-looking lines in this prompt, so a few lines may arrive as
`[redacted: …]`; say if a redaction hides something you need.

Review it. For each defect report file:line, the failure scenario and a severity.
Questions a review should answer include: is any row super-linear on a hostile
input; does any validator accept what it should refuse or refuse what it should
accept; does any reader that now sees identifier rows change a verdict in a way
not listed above; is the recall change in the tagging consumers acceptable for a
store that keeps text; and is this change authority-expanding or
non-expanding under ADR-268 § 4. Close with a classification
(`ratified`, `confirmed-non-expanding`, or a refusal) and a one-line stance.

## Diff

```diff
diff --git a/src/cli/python/knowledge_ingest.ts b/src/cli/python/knowledge_ingest.ts
index 085751ab6..4008e12f9 100644
--- a/src/cli/python/knowledge_ingest.ts
+++ b/src/cli/python/knowledge_ingest.ts
@@ -53,8 +53,9 @@
  * - uuid7 uses `crypto.randomBytes` for `secrets.randbits` via `BigInt`; the
  *   value is random so it is NOT byte-comparable (tests normalise it), but the
  *   layout regex `^[0-9a-f]{8}-...-7...-[89ab]...$` validates.
- * - PII regexes are ported with the `g` flag for `subn`-equivalent counting.
- *   Node V8 supports the Python `(?<=\s)|(?<=^)` lookbehind in `_RE_PHONE`.
+ * - PII is detected by the egress rule table's identifier rows, not by the
+ *   Python port's own regexes: a value is tagged only where its checksum or
+ *   context holds.
  * - `chunk_text` measures bytes with `Buffer.byteLength(s, 'utf-8')`; the
  *   hard-split slices a `Buffer` and `.toString('utf-8')` (Node's lenient
  *   decode ≈ Python `decode(errors="ignore")` for whole-codepoint boundaries).
@@ -77,6 +78,7 @@ import * as path from 'node:path';
 import process from 'node:process';
 import { fileURLToPath, pathToFileURL } from 'node:url';
 
+import { redactIdentifiers } from '../../scripts/_lib/identifier_redaction.js';
 import * as workspace_secrets from './workspace_secrets.js';
 
 // --- Bounds (contract §Bounds) ---------------------------------------------
@@ -224,31 +226,9 @@ export function uuid7_ts(value: string): number {
 
 // --- Redaction (contract §Redaction defaults) -------------------------------
 
-const _RE_EMAIL = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
-const _RE_PHONE = new RegExp(
-    '(?:(?<=\\s)|(?<=^))' +
-        '(?:\\+?\\d{1,3}[\\s.\\-]?)?' +
-        '(?:\\(\\d{2,4}\\)[\\s.\\-]?|\\d{2,4}[\\s.\\-])' +
-        '\\d{2,4}[\\s.\\-]?\\d{2,4}(?:[\\s.\\-]?\\d{2,4})?',
-    'gm',
-);
-const _RE_IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;
-const _RE_CC = /\b(?:\d[ \-]?){13,19}\b/g;
-const _RE_SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
-
 // Secret patterns live in the shared leaf module ``workspace_secrets`` so the
 // ingestion redactor and the per-store pre-write guard stay in lock-step.
 
-/** `pat.subn(repl, text)` → `[clean, count]` (non-overlapping, left-to-right). */
-function _subn(pat: RegExp, repl: string, text: string): [string, number] {
-    let count = 0;
-    const clean = text.replace(pat, () => {
-        count += 1;
-        return repl;
-    });
-    return [clean, count];
-}
-
 /**
  * Replace PII and secret patterns with class placeholders.
  *
@@ -256,29 +236,11 @@ function _subn(pat: RegExp, repl: string, text: string): [string, number] {
  * names without brackets so the manifest can sum them.
  */
 export function redact(text: string, counters: Record<string, number>): [string, number] {
-    const _bump = (name: string, n = 1): void => {
-        counters[name] = (counters[name] ?? 0) + n;
-    };
-
     // Secrets first — never stored, manifest counter incremented. The shared
     // module replaces every match with ``[SECRET]`` (both tiers).
-    let [out, secrets_count] = workspace_secrets.scrub(text) as [string, number];
-    // PII placeholders.
-    const patterns: ReadonlyArray<[RegExp, string]> = [
-        [_RE_IBAN, 'IBAN'],
-        [_RE_CC, 'CC'],
-        [_RE_SSN, 'SSN'],
-        [_RE_EMAIL, 'EMAIL'],
-        [_RE_PHONE, 'PHONE'],
-    ];
-    for (const [pat, tag] of patterns) {
-        const [next, n] = _subn(pat, `[${tag}]`, out);
-        out = next;
-        if (n) {
-            _bump(tag, n);
-        }
-    }
-    return [out, secrets_count];
+    const [out, secrets_count] = workspace_secrets.scrub(text) as [string, number];
+    // PII placeholders, detected by the rule table's identifier rows.
+    return [redactIdentifiers(out, counters), secrets_count];
 }
 
 // --- Chunking ---------------------------------------------------------------
diff --git a/src/scripts/_lib/egress_identifier_census.test.ts b/src/scripts/_lib/egress_identifier_census.test.ts
new file mode 100644
index 000000000..1c2507867
--- /dev/null
+++ b/src/scripts/_lib/egress_identifier_census.test.ts
@@ -0,0 +1,55 @@
+/**
+ * The identifier rows over this tree's shipped surfaces, pinned as ceilings.
+ *
+ * The census the unvalidated copies were measured with (one phone regex alone
+ * matched tens of thousands of times over the tracked tree) re-run through the
+ * table. A row that starts matching ordinary code or prose raises a count past
+ * its ceiling and turns this red; lowering a ceiling after a precision gain is
+ * the expected direction.
+ */
+import { execFileSync } from 'node:child_process';
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+import { describe, expect, it } from 'vitest';
+
+import { detect, IDENTIFIER_RULES } from './egress_rules.js';
+
+const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
+
+/** Per identifier rule, the most hits `src/` and `docs/` may carry. */
+const CEILING: Readonly<Record<string, number>> = {
+    iban: 0,
+    'payment-card': 0,
+    email: 2,
+    'phone-international': 0,
+    'phone-national': 0,
+    'de-tax-id': 0,
+    'us-ssn': 0,
+};
+
+describe('identifier census over src/ and docs/', () => {
+    it('stays within each pinned ceiling', () => {
+        const files = execFileSync('git', ['-C', REPO, 'ls-files', '-z', '--', 'src', 'docs'], { encoding: 'utf8' })
+            .split('\0')
+            .filter(Boolean);
+        const counts: Record<string, number> = Object.fromEntries(IDENTIFIER_RULES.map((r) => [r.rule, 0]));
+        for (const f of files) {
+            let body: Buffer;
+            try {
+                body = fs.readFileSync(path.join(REPO, f));
+            } catch {
+                continue;
+            }
+            if (body.length > 2_000_000 || body.includes(0)) continue;
+            for (const s of detect(body.toString('utf8'))) {
+                if (s.class === 'identifier') counts[s.rule] = (counts[s.rule] ?? 0) + 1;
+            }
+        }
+        expect(Object.keys(CEILING).sort()).toEqual(IDENTIFIER_RULES.map((r) => r.rule).sort());
+        for (const [rule, n] of Object.entries(counts)) {
+            expect(n, `${rule}: ${n} hits, ceiling ${CEILING[rule]}`).toBeLessThanOrEqual(CEILING[rule] as number);
+        }
+    }, 60_000);
+});
diff --git a/src/scripts/_lib/egress_identifier_rules.test.ts b/src/scripts/_lib/egress_identifier_rules.test.ts
new file mode 100644
index 000000000..1b167bf54
--- /dev/null
+++ b/src/scripts/_lib/egress_identifier_rules.test.ts
@@ -0,0 +1,155 @@
+/**
+ * The identifier rows: each detects its class only where its proof holds.
+ *
+ * Every planted value is assembled at runtime, so this file adds nothing to the
+ * identifier census over `src/`, and assertions compare by boolean so a failure
+ * never prints a planted value.
+ */
+import { describe, expect, it } from 'vitest';
+
+import {
+    CREDENTIAL_RULES,
+    detect,
+    EGRESS_RULES,
+    emailAllowlistDigest,
+    IDENTIFIER_RULES,
+    isValidGermanTaxId,
+    isValidIban,
+    passesLuhn,
+} from './egress_rules.js';
+
+const j = (...parts: string[]): string => parts.join('');
+const IBAN = j('DE89', '3704', '0044', '0532', '0130', '00');
+const IBAN_SPACED = j('DE89 ', '3704 ', '0044 ', '0532 ', '0130 ', '00');
+const IBAN_GB = j('GB82', 'WEST', '1234', '5698', '7654', '32');
+const CARD = j('4111', '1111', '1111', '1111');
+const CARD_SPACED = j('4111 ', '1111 ', '1111 ', '1111');
+const TAX_ID = j('8609', '5742', '719');
+const SSN = j('123', '-45-', '6789');
+const EMAIL = j('jane.doe', '@', 'galawork-customer', '.de');
+
+const rulesOf = (text: string): string[] => detect(text).map((s) => s.rule);
+const has = (text: string, rule: string): boolean => rulesOf(text).includes(rule);
+
+describe('identifier rows — positives', () => {
+    it('an IBAN, compact or in groups of four, is one IBAN span covering the value', () => {
+        for (const v of [IBAN, IBAN_SPACED, IBAN_GB]) {
+            const text = `Bank: ${v}.`;
+            const spans = detect(text).filter((s) => s.rule === 'iban');
+            expect(spans.length === 1 && text.slice(spans[0]!.start, spans[0]!.end) === v).toBe(true);
+        }
+    });
+
+    it('a card number with a card word nearby', () => {
+        expect(has(`Visa card ${CARD_SPACED}`, 'payment-card')).toBe(true);
+        expect(has(`Kreditkarte: ${CARD}`, 'payment-card')).toBe(true);
+    });
+
+    it('an e-mail address at a real domain', () => {
+        expect(has(`write to ${EMAIL} today`, 'email')).toBe(true);
+    });
+
+    it('a phone number with a country code, or a national one with a phone word', () => {
+        expect(has(j('call +49 30 ', '1234 5678'), 'phone-international')).toBe(true);
+        expect(has(j('Tel. 030 ', '1234 5678'), 'phone-national')).toBe(true);
+        expect(has(j('Telefon: (0221) ', '98765-43'), 'phone-national')).toBe(true);
+    });
+
+    it('a German tax ID with a tax word, and an SSN', () => {
+        expect(has(`Steuer-ID ${TAX_ID}`, 'de-tax-id')).toBe(true);
+        expect(has(`SSN ${SSN}`, 'us-ssn')).toBe(true);
+    });
+});
+
+describe('identifier rows — negatives', () => {
+    it('a wrong IBAN checksum, a wrong length or an unknown country', () => {
+        expect(isValidIban(IBAN.replace('89', '88'))).toBe(false);
+        expect(isValidIban(IBAN.slice(0, -1))).toBe(false);
+        expect(isValidIban(`ZZ${IBAN.slice(2)}`)).toBe(false);
+        expect(has(`Bank: ${IBAN.replace('89', '88')}`, 'iban')).toBe(false);
+    });
+
+    it('a Luhn-valid number with no card word, and a card word with a Luhn-invalid number', () => {
+        expect(has(`id ${CARD}`, 'payment-card')).toBe(false);
+        expect(has(`card ${CARD.replace(/1$/, '2')}`, 'payment-card')).toBe(false);
+        expect(passesLuhn(j('0000', '0000', '0000', '0000'))).toBe(false);
+    });
+
+    it('a millisecond timestamp and a long numeric id are not cards', () => {
+        expect(has(`created ${j('1760', '9120', '00000')} card`, 'payment-card')).toBe(false);
+    });
+
+    it('documentation, reserved, no-reply, git remote and file-name addresses are not reported', () => {
+        for (const addr of [
+            j('alice', '@example.com'),
+            j('bob', '@corp.example'),
+            j('ci', '@host.test'),
+            j('noreply', '@vendor.io'),
+            j('do-not-reply', '@vendor.io'),
+            j('123+bot', '@users.noreply.github.com'),
+            j('git', '@github.com'),
+            j('logo', '@2x.png'),
+        ]) {
+            expect(has(`mail ${addr} now`, 'email'), addr).toBe(false);
+        }
+    });
+
+    it("the repository's own published identities are allowlisted by digest", () => {
+        expect(has(j('dev', '@event4u.app'), 'email')).toBe(false);
+        expect(emailAllowlistDigest(j('DEV', '@EVENT4U.APP'))).toBe(emailAllowlistDigest(j('dev', '@event4u.app')));
+        expect(has(j('dev2', '@event4u.app'), 'email')).toBe(true);
+    });
+
+    it('a decorator after an escaped newline is not an address', () => {
+        expect(has('AuditLog\\n\\n@admin.register', 'email')).toBe(false);
+    });
+
+    it('a national number with no phone word, and a date after a diff marker', () => {
+        expect(has(j('ref 030 ', '1234 5678'), 'phone-national')).toBe(false);
+        expect(has('decided on\n+2026-10-01 by the council', 'phone-international')).toBe(false);
+    });
+
+    it('a tax ID with no tax word, a broken check digit, or a non-structured run', () => {
+        expect(has(`ref ${TAX_ID}`, 'de-tax-id')).toBe(false);
+        expect(isValidGermanTaxId(TAX_ID.replace(/9$/, '8'))).toBe(false);
+        expect(isValidGermanTaxId(j('1234', '5678', '901'))).toBe(false);
+    });
+
+    it('an SSN in a reserved range', () => {
+        for (const v of [j('000', '-45-6789'), j('666', '-45-6789'), j('912', '-45-6789'), j('123', '-00-6789'), j('123', '-45-0000')]) {
+            expect(has(`SSN ${v}`, 'us-ssn'), v).toBe(false);
+        }
+    });
+});
+
+describe('identifier rows — table invariants', () => {
+    it('every identifier row is class identifier and carries a validator, a context or exclusions', () => {
+        expect(IDENTIFIER_RULES.length).toBe(7);
+        for (const r of IDENTIFIER_RULES) {
+            expect(r.class).toBe('identifier');
+            expect(r.validator !== undefined || r.context !== undefined || r.exclusions !== undefined, r.rule).toBe(true);
+        }
+        expect(CREDENTIAL_RULES.length + IDENTIFIER_RULES.length).toBe(EGRESS_RULES.length);
+    });
+
+    it('a credential wins an overlap with an identifier', () => {
+        const uri = j('postgres://dbuser:', 's3cr3tpassword', '@db.internal.acme.de/x');
+        expect(rulesOf(uri)).toEqual(['db-connection-uri']);
+    });
+
+    it('stays linear on pathological inputs', () => {
+        const inputs = [
+            '+' + '1 '.repeat(20_000),
+            '0'.repeat(50_000),
+            'a'.repeat(30_000) + '@' + 'b.'.repeat(20_000),
+            'DE89 '.repeat(20_000),
+            '1-'.repeat(30_000),
+            'Tel 0' + '12 '.repeat(20_000),
+        ];
+        for (const text of inputs) {
+            const started = Date.now();
+            detect(text, IDENTIFIER_RULES);
+            expect(Date.now() - started, text.slice(0, 12)).toBeLessThan(2_000);
+        }
+    });
+});
diff --git a/src/scripts/_lib/egress_rules.ts b/src/scripts/_lib/egress_rules.ts
index 78eaa1bca..8f24db356 100644
--- a/src/scripts/_lib/egress_rules.ts
+++ b/src/scripts/_lib/egress_rules.ts
@@ -121,6 +121,112 @@ export function pemMaskEnd(text: string, span: SpanBounds): number | null {
     return null;
 }
 
+// Identifier validators. A shape alone is never enough to replace an identifier:
+// each row carries a checksum, a context word, or both, because a false positive
+// here damages ordinary code and review text.
+
+// IBAN length per country (ISO 13616 registry), packed as `CCnn` pairs.
+const IBAN_LENGTHS =
+    'AD24AE23AL28AT20AZ28BA20BE16BG22BH22BR29BY28CH21CR22CY28CZ24DE22DK18DO28EE20EG29ES24FI18FO18FR27GB22GE22GI23GL18GR27GT28HR21HU28IE22IL23IQ23IS26IT27JO30KW30KZ20LB28LC32LI21LT20LU20LV21MC27MD24ME22MK19MR27MT31MU30NL18NO15PK24PL28PS29PT25QA29RO24RS22SA24SC31SE24SI19SK24SM27ST25SV28TL23TN24TR26UA29VA22VG24XK20';
+
+export function isValidIban(value: string): boolean {
+    const iban = value.replace(/ /g, '').toUpperCase();
+    const at = IBAN_LENGTHS.indexOf(iban.slice(0, 2));
+    if (at === -1 || at % 4 !== 0 || Number(IBAN_LENGTHS.slice(at + 2, at + 4)) !== iban.length) return false;
+    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) return false;
+    let rest = 0;
+    for (const ch of iban.slice(4) + iban.slice(0, 4)) {
+        const n = ch <= '9' ? ch.charCodeAt(0) - 48 : ch.charCodeAt(0) - 55;
+        rest = n > 9 ? (rest * 100 + n) % 97 : (rest * 10 + n) % 97;
+    }
+    return rest === 1;
+}
+
+export function passesLuhn(value: string): boolean {
+    const digits = value.replace(/[ -]/g, '');
+    if (!/^[0-9]{13,19}$/.test(digits) || /^(.)\1+$/.test(digits)) return false;
+    let sum = 0;
+    for (let i = 0; i < digits.length; i += 1) {
+        let d = digits.charCodeAt(digits.length - 1 - i) - 48;
+        if (i % 2 === 1) {
+            d *= 2;
+            if (d > 9) d -= 9;
+        }
+        sum += d;
+    }
+    return sum % 10 === 0;
+}
+
+/** E.164 bounds: a country code plus at most 15 digits in all; never a date after a diff marker. */
+function phoneDigits(min: number, max: number): (value: string) => boolean {
+    return (value) => {
+        if (/^\+?[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(value)) return false;
+        const n = value.replace(/[^0-9]/g, '').length;
+        return n >= min && n <= max;
+    };
+}
+
+/**
+ * German tax identification number: 11 digits, no leading zero, one digit of
+ * the first ten repeated two or three times and no other repeated, and an
+ * ISO 7064 MOD 11,10 check digit.
+ */
+export function isValidGermanTaxId(value: string): boolean {
+    const d = value.replace(/ /g, '');
+    if (!/^[1-9][0-9]{10}$/.test(d)) return false;
+    const counts = new Map<string, number>();
+    for (const ch of d.slice(0, 10)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
+    const repeated = [...counts.values()].filter((c) => c > 1);
+    if (repeated.length !== 1 || (repeated[0] as number) > 3) return false;
+    let product = 10;
+    for (let i = 0; i < 10; i += 1) {
+        let sum = (d.charCodeAt(i) - 48 + product) % 10;
+        if (sum === 0) sum = 10;
+        product = (sum * 2) % 11;
+    }
+    const check = (11 - product) % 10;
+    return check === d.charCodeAt(10) - 48;
+}
+
+/** US social security number: no 000, 666 or 9xx area, no 00 group, no 0000 serial. */
+export function isValidUsSsn(value: string): boolean {
+    const [area, group, serial] = value.split('-');
+    return area !== '000' && area !== '666' && !(area as string).startsWith('9') && group !== '00' && serial !== '0000';
+}
+
+// Addresses that name no one: documentation and reserved domains (RFC 2606,
+// RFC 6761), no-reply senders, and image-density file names (`logo@2x.png`).
+const EMAIL_EXCLUSIONS: readonly RegExp[] = [
+    /^git@/i,
+    /@(?:[a-z0-9-]+\.)*(?:example\.(?:com|net|org)|example|test|invalid|localhost|local)$/i,
+    /^(?:no-?reply|do-?not-?reply|noreply\+[^@]*)@/i,
+    /@users\.noreply\.github\.com$/i,
+    /@[0-9]x\.[a-z]+$/i,
+    /\.(?:png|jpe?g|gif|svg|webp|ico|js|mjs|cjs|ts|tsx|css|json|md|ya?ml|lock)$/i,
+];
+
+/**
+ * The repository's own published identities (package author, copyright holder),
+ * held as keyed 64-bit FNV-1a digests of the lower-cased address so the list
+ * reads as noise. A digest hides an address from a reader, not from someone who
+ * guesses it; the list exists to keep the tree's own metadata out of a review's
+ * placeholder count.
+ */
+const EMAIL_ALLOWLIST_DIGESTS: ReadonlySet<string> = new Set(['924acfa874365f8a', '8066a43fc18158bf']);
+
+export function emailAllowlistDigest(address: string): string {
+    let h = 0xcbf29ce484222325n;
+    for (const ch of `egress-email-allowlist-v1\u0000${address.toLowerCase()}`) {
+        h ^= BigInt(ch.codePointAt(0) as number);
+        h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
+    }
+    return h.toString(16).padStart(16, '0');
+}
+
+function isReportableEmail(value: string): boolean {
+    return !EMAIL_ALLOWLIST_DIGESTS.has(emailAllowlistDigest(value));
+}
+
 // Quantifiers are unbounded where the pattern is linear without a bound, so a
 // long value is matched whole and no suffix survives a replacement. Each rule's
 // argument for why it is linear lives in `egress_rules_linearity.ts`, kept out
@@ -282,8 +388,79 @@ export const EGRESS_RULES: readonly EgressRule[] = [
         valueGroup: 1,
         validator: looksLikeSecretValue,
     },
+    {
+        rule: 'iban',
+        type: 'IBAN',
+        class: 'identifier',
+        replacement: 'detection',
+        pattern: /(?<![A-Za-z0-9])[A-Z]{2}[0-9]{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?(?![A-Za-z0-9])/g,
+        validator: isValidIban,
+    },
+    {
+        rule: 'payment-card',
+        type: 'CARD',
+        class: 'identifier',
+        replacement: 'detection',
+        pattern: /(?<![0-9])[0-9](?:[ -]?[0-9]){12,18}(?![0-9])/g,
+        validator: passesLuhn,
+        context: {
+            words: /\b(?:card|credit|debit|visa|mastercard|amex|maestro|kreditkarte|karte|kartennummer|payment|zahlung)\b/i,
+            window: 48,
+        },
+    },
+    {
+        rule: 'email',
+        type: 'EMAIL',
+        class: 'identifier',
+        replacement: 'detection',
+        pattern:
+            /(?<![A-Za-z0-9._%+\\-])[A-Za-z0-9][A-Za-z0-9._%+-]{0,63}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.){1,8}[A-Za-z]{2,24}(?![A-Za-z0-9-])/g,
+        exclusions: EMAIL_EXCLUSIONS,
+        validator: isReportableEmail,
+    },
+    {
+        rule: 'phone-international',
+        type: 'PHONE',
+        class: 'identifier',
+        replacement: 'detection',
+        pattern: /(?<![A-Za-z0-9+])\+[1-9][0-9]{0,2}(?:[ ./-]?\(?(?=([0-9]{1,6}))\1\)?){1,5}(?![0-9])/g,
+        validator: phoneDigits(8, 15),
+    },
+    {
+        rule: 'phone-national',
+        type: 'PHONE',
+        class: 'identifier',
+        replacement: 'detection',
+        pattern: /(?<![A-Za-z0-9+])\(?0[1-9][0-9]{1,4}\)?(?:[ ./-]?(?=([0-9]{2,8}))\1){1,3}(?![0-9])/g,
+        validator: phoneDigits(7, 13),
+        context: { words: /\b(?:tel|telefon|telephone|phone|mobil|mobile|cell|fax|handy|call|ruf)\b/i, window: 32 },
+    },
+    {
+        rule: 'de-tax-id',
+        type: 'TAXID',
+        class: 'identifier',
+        replacement: 'detection',
+        pattern: /(?<![0-9])[1-9](?: ?[0-9]){10}(?![0-9])/g,
+        validator: isValidGermanTaxId,
+        context: {
+            words: /\b(?:steuer-?id|steuer-?identifikationsnummer|identifikationsnummer|idnr|tax[ -]?id|tin)\b/i,
+            window: 48,
+        },
+    },
+    {
+        rule: 'us-ssn',
+        type: 'SSN',
+        class: 'identifier',
+        replacement: 'detection',
+        pattern: /(?<![0-9-])[0-9]{3}-[0-9]{2}-[0-9]{4}(?![0-9-])/g,
+        validator: isValidUsSsn,
+    },
 ];
 
+/** The credential rows alone, for consumers whose verdict reads credentials only. */
+export const CREDENTIAL_RULES: readonly EgressRule[] = EGRESS_RULES.filter((r) => r.class === 'credential');
+export const IDENTIFIER_RULES: readonly EgressRule[] = EGRESS_RULES.filter((r) => r.class === 'identifier');
+
 /** Every raw-key prefix the table declares, longest first. */
 export const CREDENTIAL_PREFIXES: readonly string[] = EGRESS_RULES.flatMap((r) => r.prefixes ?? []).sort(
     (a, b) => b.length - a.length,
diff --git a/src/scripts/_lib/egress_rules_linearity.ts b/src/scripts/_lib/egress_rules_linearity.ts
index 3baecdddb..07ba31b77 100644
--- a/src/scripts/_lib/egress_rules_linearity.ts
+++ b/src/scripts/_lib/egress_rules_linearity.ts
@@ -34,6 +34,19 @@ export const LINEARITY: Readonly<Record<string, string>> = {
         'Starts only at the literal header; the label class excludes the dash, so label runs of different headers are disjoint, and backtracking over one run tries the fixed 16-character suffix at each position: linear with a constant factor of 16.',
     'db-connection-uri':
         'One attempt per scheme-character run: the lookbehind admits a start only at the run boundary, and the lookahead-plus-backreference consumes the run up to its first word-boundary letter atomically. Every such start in one run reaches the same :// at the same run end, so the first one matches whenever any later one would, and nothing the unbounded scheme matched is lost. The userinfo classes exclude : and /, so each userinfo run is read by one attempt per side.',
+    'iban':
+        'Starts only at a country-code boundary; every quantifier is bounded (at most seven four-character groups and a three-character tail), so an attempt reads at most 37 characters.',
+    'payment-card':
+        'Starts only at a digit boundary; each repetition reads one digit after an optional single separator, so a digit can be the end of only one repetition and an attempt reads at most 37 characters.',
+    'email':
+        'Starts only where no address character precedes; the local part is bounded at 64, each label at 63 and the labels at eight, and the label class must end on a dot, so an attempt reads a bounded window and backtracking inside it is bounded by those constants.',
+    'phone-international':
+        'Starts only at a plus sign; each digit group is consumed atomically by a lookahead-plus-backreference of at most six digits, so groups split only at separators or the six-digit cap, and at most five groups follow: an attempt reads at most about 45 characters with no re-split.',
+    'phone-national':
+        'Starts only at a zero after a non-word character; the area code is bounded at five digits and each of at most three groups is consumed atomically by a lookahead-plus-backreference of at most eight digits, so an attempt reads at most about 35 characters with no re-split.',
+    'de-tax-id':
+        'Starts only at a digit boundary; exactly ten repetitions of an optional space and one digit follow, so an attempt reads at most 21 characters.',
+    'us-ssn': 'Fixed-length digit runs between hyphens: every attempt reads at most eleven characters.',
     'generic-assignment':
         'Starts only at a keyword; the whitespace runs end at the first non-space and the value run at the first quote or space, and a match moves the global scan past the value, so no character is read by more than one successful attempt and a failed attempt stops at the first character after the whitespace.',
 };
diff --git a/src/scripts/_lib/identifier_redaction.ts b/src/scripts/_lib/identifier_redaction.ts
new file mode 100644
index 000000000..d01fc3096
--- /dev/null
+++ b/src/scripts/_lib/identifier_redaction.ts
@@ -0,0 +1,19 @@
+/**
+ * Class-tag redaction of identifiers for stores that keep text (knowledge
+ * ingestion, cross-repo retrieval). Detection is the rule table's identifier
+ * rows, so a value is tagged only where its checksum or context holds; the tag
+ * spelling and the counter keys are this consumer's.
+ */
+import { detect, IDENTIFIER_RULES, replaceSpans } from './egress_rules.js';
+
+/** Counter key and tag per placeholder type; `CC` predates the table's `CARD`. */
+const TAG: Readonly<Record<string, string>> = { CARD: 'CC' };
+
+export function redactIdentifiers(text: string, counters: Record<string, number>): string {
+    const spans = detect(text, IDENTIFIER_RULES);
+    return replaceSpans(text, spans, (s) => {
+        const tag = TAG[s.type] ?? s.type;
+        counters[tag] = (counters[tag] ?? 0) + 1;
+        return `[${tag}]`;
+    });
+}
diff --git a/src/scripts/_lib/self_repair_payload.ts b/src/scripts/_lib/self_repair_payload.ts
index d2d5ad1ca..5f399f7d4 100644
--- a/src/scripts/_lib/self_repair_payload.ts
+++ b/src/scripts/_lib/self_repair_payload.ts
@@ -9,7 +9,7 @@
  * list. A finding refuses and is named by WHERE it was found and which rule
  * fired — never by the value, because the refusal is printed and stored.
  */
-import { detect } from './egress_rules.js';
+import { CREDENTIAL_RULES, detect } from './egress_rules.js';
 
 export type PayloadPart = 'branch' | 'commit' | 'object' | 'title' | 'body';
 
@@ -65,7 +65,7 @@ export function scanPayload(payload: ReleasePayload, deny: readonly string[]): P
     ];
     for (const [part, text] of parts) {
         const rules = new Set<string>();
-        for (const span of detect(text)) {
+        for (const span of detect(text, CREDENTIAL_RULES)) {
             rules.add(span.rule);
         }
         for (const d of denyRes) {
diff --git a/src/scripts/cross_repo_retrieve.ts b/src/scripts/cross_repo_retrieve.ts
index 21b007d59..51e80dc80 100644
--- a/src/scripts/cross_repo_retrieve.ts
+++ b/src/scripts/cross_repo_retrieve.ts
@@ -40,6 +40,7 @@ import * as fs from 'node:fs';
 import * as path from 'node:path';
 import { fileURLToPath, pathToFileURL } from 'node:url';
 
+import { redactIdentifiers } from './_lib/identifier_redaction.js';
 import { scrub } from './_lib/workspace_secrets.js';
 import { collect } from './linked_projects_list.js';
 
@@ -60,29 +61,6 @@ const SKIP_DIRS: ReadonlySet<string> = new Set([
 
 const CHUNK_BYTES = 2 * 1024;
 
-// knowledge_ingest PII patterns.
-const _RE_EMAIL = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
-const _RE_PHONE = new RegExp(
-    '(?:(?<=\\s)|(?<=^))' +
-        '(?:\\+?\\d{1,3}[\\s.\\-]?)?' +
-        '(?:\\(\\d{2,4}\\)[\\s.\\-]?|\\d{2,4}[\\s.\\-])' +
-        '\\d{2,4}[\\s.\\-]?\\d{2,4}(?:[\\s.\\-]?\\d{2,4})?',
-    'g',
-);
-const _RE_IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;
-const _RE_CC = /\b(?:\d[ \-]?){13,19}\b/g;
-const _RE_SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
-
-/** Count and replace all matches like Python `re.subn`. */
-function _subn(text: string, pat: RegExp, repl: string): [string, number] {
-    let n = 0;
-    const out = text.replace(pat, () => {
-        n += 1;
-        return repl;
-    });
-    return [out, n];
-}
-
 /** `workspace_secrets.scrub(text, include_fuzzy=True)`: credential detection is the rule table's. */
 function _scrub_secrets(text: string): [string, number] {
     return scrub(text, { include_fuzzy: true });
@@ -90,25 +68,8 @@ function _scrub_secrets(text: string): [string, number] {
 
 /** Faithful port of `knowledge_ingest.redact(text, counters)`. */
 function redact(text: string, counters: Record<string, number>): [string, number] {
-    const _bump = (name: string, n = 1): void => {
-        counters[name] = (counters[name] ?? 0) + n;
-    };
-    let [out, secrets_count] = _scrub_secrets(text);
-    const piiPats: ReadonlyArray<[RegExp, string]> = [
-        [_RE_IBAN, 'IBAN'],
-        [_RE_CC, 'CC'],
-        [_RE_SSN, 'SSN'],
-        [_RE_EMAIL, 'EMAIL'],
-        [_RE_PHONE, 'PHONE'],
-    ];
-    for (const [pat, tag] of piiPats) {
-        const [t, n] = _subn(out, pat, `[${tag}]`);
-        out = t;
-        if (n) {
-            _bump(tag, n);
-        }
-    }
-    return [out, secrets_count];
+    const [out, secrets_count] = _scrub_secrets(text);
+    return [redactIdentifiers(out, counters), secrets_count];
 }
 
 /** UTF-8 byte length, mirror of Python `len(s.encode("utf-8"))`. */
```

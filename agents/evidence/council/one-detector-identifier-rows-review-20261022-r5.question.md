<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-22 for branch feat/subagent-system-2583,
     round 5 of the identifier-rows review, committed verbatim so the verdict recorded
     beside it can be checked against what was actually asked. Not edited after the run. -->

# Review branch feat/subagent-system-2583 — the egress rule table and the engine chunk ceiling

Ratification review under ADR-268 § 4. The gated files are
`src/scripts/_lib/egress_rules.ts` and `src/config/hook-bundle-budget.json`; subject digest
`16781cafd9e23dfdfd860a250735fe636b2a4f5ad54c2e02a318d019ff328f08` at revision `11cc54fd45`.

What the diff contains:

1. The validated identifier rows reviewed in rounds 1-4 on another branch
   (`agents/evidence/council/one-detector-identifier-rows-review-20261019*.question.md`), now
   carried onto this branch by cherry-pick. Round 3 found the gated pattern correct and named
   one test gap, closed by test-only round-4 changes; round 4 itself never ran (the council's
   necessity filter skipped it).
2. Three new credential rows — `huggingface-token` (`hf_`), `nvidia-api-key` (`nvapi-`),
   `replicate-api-token` (`r8_`) — after a reproduction showed bare keys of all three passing
   the council egress unmasked (0 of 50 each), with fixtures in the drift matrix, the
   replacement end-to-end suite, the parity reference and a linearity argument each.
3. The conditional engine chunk's byte ceiling raised 28,000 → 32,000 with a `raise_log` entry;
   measured 30,445 bytes. The dispatch bundle is unchanged (1,524,901 of 1,550,000).

Review it. For each defect report file:line, the failure scenario and a severity. Close with a
classification (`ratified`, `confirmed-non-expanding`, or a refusal) and a one-line stance.

## Diff (`git diff origin/main -- src/scripts/_lib/egress_rules.ts src/config/hook-bundle-budget.json`)

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 1c634b3fb5..ad25d41a83 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -17,6 +17,16 @@
             "what_was_added": "Nothing in this commit. The 1,500,000 ceiling was red on the very commit that registered it: measured 1,511,489 bytes at 22b19e520, which is the merge of the PR that introduced the budget. Its derivation read 1,469,738 bytes on the PR branch, whose base predated three PRs that had merged meanwhile \u2014 the failure-event binding of #2160 (sixteen concerns on a new slot), the touched-file quality pass of #2152, and the evidence classification of #2153 \u2014 and #2162 landed after it. The gate ran on each PR's pre-merge tree and never on the merge result, so every one of those PRs was green alone and the trunk was red the moment they were together.",
             "why_it_could_not_be_avoided": "The bytes are deliberately merged capability, not an accident to trim: the composition check above shows one parser and no duplicate dependency, so there is nothing to remove that would not remove a feature. The alternative \u2014 reverting a merged lane to fit a ceiling derived against a base that no longer exists \u2014 would discard working code to satisfy a number that never described this tree.",
             "what_would_have_caught_it": "Measuring the ceiling against the merge result rather than the PR branch. A ceiling derived on a branch is a statement about that branch; the trunk is what the gate defends, and the two diverge exactly when several lanes land in one day."
+        },
+        {
+            "date": "2026-10-22",
+            "chunk": "src/scripts/_lib/egress_engine.ts",
+            "from": 28000,
+            "to": 32000,
+            "by": "agent, during the feat/subagent-system-2583 run",
+            "what_was_added": "The queued engine work the 28,000 ceiling was sized for, landed together: the validated identifier rows of one-detector 2.3 (IBAN, card, e-mail with a keyed-digest allowlist, three phone shapes, German tax id, US SSN), the invisible-character and lookalike-letter normalisation of 2.5, and three free-tier credential rows (Hugging Face, NVIDIA, Replicate) of free-hands 1.2. Measured 30,445 bytes.",
+            "why_it_could_not_be_avoided": "Each addition is a detection row or the normalisation that keeps one from being hidden; the 2026-10-18 derivation already counted them as the chunk's planned growth and underestimated their sum by about 2.4 KB. The chunk is loaded only when a caller needs detection, so no dispatch pays these bytes; the dispatch bundle itself is unchanged.",
+            "what_would_have_caught_it": "Re-measuring the queued items' sum when the ceiling was set, rather than estimating each."
         }
     ],
     "chunks": [
@@ -28,7 +38,7 @@
         },
         {
             "entry": "src/scripts/_lib/egress_engine.ts",
-            "max_bytes": 28000,
+            "max_bytes": 32000,
             "registered_at": "2026-10-18",
             "derivation": "Measured 18,478 bytes on 2026-10-18 (the rule table, the token grammar and the commit scanner, with the per-rule linearity prose moved to a test-only module). The ceiling is that reading plus the queued engine work of road-to-one-detector-and-the-senders-we-own (validated identifier rules about 4.3 KB, known values, the invisible-character rescan and the variant suffix about 1-2 KB each), rounded up. An AI council of two providers chose on 2026-10-18 to move the engine out of the dispatch bundle into this conditional chunk rather than raise the dispatch ceiling, and asked that the chunk carry a measured budget of its own so the move does not just relocate uncontrolled growth. A raise follows the same rule as max_bytes: a raise_log entry naming the chunk (`chunk`: this entry) and what was added."
         },
diff --git a/src/scripts/_lib/egress_rules.ts b/src/scripts/_lib/egress_rules.ts
index 53b79227b5..69ce4126ab 100644
--- a/src/scripts/_lib/egress_rules.ts
+++ b/src/scripts/_lib/egress_rules.ts
@@ -192,6 +192,114 @@ export function pemMaskEnd(text: string, span: SpanBounds): number | null {
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
+    const m = /^([0-9]{3})-([0-9]{2})-([0-9]{4})$/.exec(value);
+    if (m === null) return false;
+    const [area, group, serial] = [m[1] as string, m[2] as string, m[3] as string];
+    return area !== '000' && area !== '666' && !area.startsWith('9') && group !== '00' && serial !== '0000';
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
+    /\.(?:png|jpe?g|gif|svg|webp|ico|js|mjs|cjs|ts|tsx|css|json|ya?ml|lock)$/i,
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
@@ -302,6 +410,33 @@ export const EGRESS_RULES: readonly EgressRule[] = [
         tokenStart: true,
         pattern: /(?<![A-Za-z0-9])gsk_[A-Za-z0-9]{20,}/g,
     },
+    {
+        rule: 'huggingface-token',
+        type: 'TOKEN',
+        prefixes: ['hf_'],
+        class: 'credential',
+        replacement: 'detection',
+        tokenStart: true,
+        pattern: /(?<![A-Za-z0-9])hf_[A-Za-z0-9]{30,}/g,
+    },
+    {
+        rule: 'nvidia-api-key',
+        type: 'APIKEY',
+        prefixes: ['nvapi-'],
+        class: 'credential',
+        replacement: 'detection',
+        tokenStart: true,
+        pattern: /(?<![A-Za-z0-9])nvapi-[A-Za-z0-9_-]{40,}/g,
+    },
+    {
+        rule: 'replicate-api-token',
+        type: 'TOKEN',
+        prefixes: ['r8_'],
+        class: 'credential',
+        replacement: 'detection',
+        tokenStart: true,
+        pattern: /(?<![A-Za-z0-9])r8_[A-Za-z0-9]{30,}/g,
+    },
     {
         rule: 'jwt',
         type: 'TOKEN',
@@ -358,6 +493,81 @@ export const EGRESS_RULES: readonly EgressRule[] = [
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
+        pattern: /(?<![A-Za-z0-9+])\+[1-9][0-9]{0,2}(?:[ ./-]?(?:\([0-9]{1,6}\)|(?=([0-9]{1,6}))\1)){1,5}(?![0-9])/g,
+        validator: phoneDigits(8, 15),
+    },
+    {
+        rule: 'phone-national',
+        type: 'PHONE',
+        class: 'identifier',
+        replacement: 'detection',
+        pattern: /(?<![A-Za-z0-9+(])(?:\(0[1-9][0-9]{1,4}\)|0[1-9][0-9]{1,4})(?:[ ./-]?(?=([0-9]{2,8}))\1){1,3}(?![0-9])/g,
+        validator: phoneDigits(7, 13),
+        context: { words: /\b(?:tel|telefon|telephone|phone|mobil|mobile|cell|fax|handy|call|ruf)\b/i, window: 32 },
+    },
+    {
+        rule: 'phone-nanp',
+        type: 'PHONE',
+        class: 'identifier',
+        replacement: 'detection',
+        pattern: /(?<![A-Za-z0-9+(-])(?:\+?1[ .-]?)?(?:\([2-9][0-9]{2}\) ?|[2-9][0-9]{2}[ .-]?)[2-9][0-9]{2}[ .-]?[0-9]{4}(?![0-9-])/g,
+        context: { words: /\b(?:tel|telephone|phone|mobile|cell|fax|call)\b/i, window: 32 },
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
 
 // A value that is a type word, a literal, a language keyword or a credential
@@ -435,6 +645,10 @@ export const REVIEW_CREDENTIAL_ROWS: readonly EgressRule[] = [
     },
 ];
 
+/** The credential rows alone, for consumers whose verdict reads credentials only. */
+export const CREDENTIAL_RULES: readonly EgressRule[] = EGRESS_RULES.filter((r) => r.class === 'credential');
+export const IDENTIFIER_RULES: readonly EgressRule[] = EGRESS_RULES.filter((r) => r.class === 'identifier');
+
 /** Every raw-key prefix the table declares, longest first. */
 export const CREDENTIAL_PREFIXES: readonly string[] = EGRESS_RULES.flatMap((r) => r.prefixes ?? []).sort(
     (a, b) => b.length - a.length,
```

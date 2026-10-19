<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-20 for branch drain/road-to-one-detector-and-the-senders-we-own-20261019z,
     round 3, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261019z, round 3 — identifier rows in the one rule table

Ratification review under ADR-268 § 4, round 3. The one gated file is
`src/scripts/_lib/egress_rules.ts`. Reviewed commit `c7b09b725`; subject digest
`50e98992c08f5e538a25c1e2dc1d5758954930f1c9b21f19d24356f36df7eca8`. Earlier prompts:
`agents/evidence/council/one-detector-identifier-rows-review-20261019.question.md` and
`agents/evidence/council/one-detector-identifier-rows-review-20261019-r2.question.md`.

Round 2 (both seats REQUEST_CHANGES) left one blocking finding open: the
`phone-nanp` row missed `1-212-555-0142` and compact `2125550142`, so the two stores
could persist North American numbers the old regex tagged; both seats asked for a
differential parity test against the old detector rather than single examples.
Round 2 also confirmed findings 2–7 of round 1 closed.

What changed:

- `phone-nanp` now takes an optional `1` / `+1` prefix and optional single
  separators:
  `(?<![A-Za-z0-9+(-])(?:\+?1[ .-]?)?(?:\([2-9][0-9]{2}\) ?|[2-9][0-9]{2}[ .-]?)[2-9][0-9]{2}[ .-]?[0-9]{4}(?![0-9-])`.
  In the egress path it still needs a phone word; the stores drop that requirement.
- `identifier_redaction.test.ts` freezes the stores' old phone regex verbatim and
  holds 16 phone shapes (US with dashes, dots, spaces, parentheses, `1-`, `1 `,
  `+1 `, `+1-`; German and UK international, with and without a parenthesised
  area; German national with spaces, hyphens, parentheses): each is asserted to be
  tagged by the old regex AND counted once as `PHONE` by both stores' real
  `redact()`. Compact US numbers, which the old regex did not tag, are now tagged.
  Shapes the old regex tagged that are not phone numbers (`2026-10-19`,
  `10.20.30`, `1999 2000 2001`) are asserted as deliberate losses. With the
  round-2 pattern restored, two parity cases fail.
- The two allowlisted addresses stay as digests in the source (named in round 2's
  prompt and present in tracked published files); writing them beside the digests
  would undo the reason for hashing them and add two census hits.
- `isValidUsSsn` drops the tuple cast.

Suites green: identifier rows, census, storage redaction (34 cases), rule table,
knowledge-ingest, cross-repo; `tsc --noEmit` clean. Engine chunk 25,773 of 28,000 B.

The diff below is round 3's change (`0eab3db7a..c7b09b725`, source and tests).

Review it. For each defect report file:line, the failure scenario and a severity.
Say whether the open round-2 finding is closed. Close with a classification
(`ratified`, `confirmed-non-expanding`, or a refusal) and a one-line stance.

## Round-3 diff

```diff
diff --git a/src/scripts/_lib/egress_rules.ts b/src/scripts/_lib/egress_rules.ts
index dd42eee5c..ca1d9c197 100644
--- a/src/scripts/_lib/egress_rules.ts
+++ b/src/scripts/_lib/egress_rules.ts
@@ -192,7 +192,7 @@ export function isValidGermanTaxId(value: string): boolean {
 export function isValidUsSsn(value: string): boolean {
     const m = /^([0-9]{3})-([0-9]{2})-([0-9]{4})$/.exec(value);
     if (m === null) return false;
-    const [, area, group, serial] = m as unknown as [string, string, string, string];
+    const [area, group, serial] = [m[1] as string, m[2] as string, m[3] as string];
     return area !== '000' && area !== '666' && !area.startsWith('9') && group !== '00' && serial !== '0000';
 }
 
@@ -442,7 +442,7 @@ export const EGRESS_RULES: readonly EgressRule[] = [
         type: 'PHONE',
         class: 'identifier',
         replacement: 'detection',
-        pattern: /(?<![A-Za-z0-9+(-])(?:\([2-9][0-9]{2}\) ?|[2-9][0-9]{2}[ .-])[2-9][0-9]{2}[ .-][0-9]{4}(?![0-9-])/g,
+        pattern: /(?<![A-Za-z0-9+(-])(?:\+?1[ .-]?)?(?:\([2-9][0-9]{2}\) ?|[2-9][0-9]{2}[ .-]?)[2-9][0-9]{2}[ .-]?[0-9]{4}(?![0-9-])/g,
         context: { words: /\b(?:tel|telephone|phone|mobile|cell|fax|call)\b/i, window: 32 },
     },
     {
diff --git a/src/scripts/_lib/egress_rules_linearity.ts b/src/scripts/_lib/egress_rules_linearity.ts
index 57b4ab4c3..745fa0cc5 100644
--- a/src/scripts/_lib/egress_rules_linearity.ts
+++ b/src/scripts/_lib/egress_rules_linearity.ts
@@ -44,7 +44,7 @@ export const LINEARITY: Readonly<Record<string, string>> = {
         'Starts only at a plus sign; each digit group is either a parenthesised run of at most six digits or consumed atomically by a lookahead-plus-backreference of at most six, so groups split only at separators or the six-digit cap, and at most five groups follow: an attempt reads at most about 45 characters with no re-split.',
     'phone-national':
         'Starts only at a zero after a non-word character; the area code, bare or parenthesised, is bounded at five digits and each of at most three groups is consumed atomically by a lookahead-plus-backreference of at most eight digits, so an attempt reads at most about 35 characters with no re-split.',
-    'phone-nanp': 'Fixed shape: a three-digit area code, bare or parenthesised, then three and four digits with single separators; an attempt reads at most sixteen characters.',
+    'phone-nanp': 'Fixed shape: an optional country prefix of at most three characters, a three-digit area code bare or parenthesised, then three and four digits with optional single separators; every quantifier is bounded, so an attempt reads at most twenty characters.',
     'de-tax-id':
         'Starts only at a digit boundary; exactly ten repetitions of an optional space and one digit follow, so an attempt reads at most 21 characters.',
     'us-ssn': 'Fixed-length digit runs between hyphens: every attempt reads at most eleven characters.',
diff --git a/src/scripts/_lib/identifier_redaction.test.ts b/src/scripts/_lib/identifier_redaction.test.ts
index b6fba7979..b7d3df7d0 100644
--- a/src/scripts/_lib/identifier_redaction.test.ts
+++ b/src/scripts/_lib/identifier_redaction.test.ts
@@ -37,3 +37,69 @@ describe.each([
         expect(counters).toEqual({});
     });
 });
+
+/**
+ * Differential parity with the phone regex the two stores carried before the
+ * table (frozen verbatim). Every phone-shaped value it tagged is still tagged;
+ * the shapes it tagged that are not phone numbers are listed as deliberate losses.
+ */
+const LEGACY_PHONE = new RegExp(
+    '(?:(?<=\\s)|(?<=^))' +
+        '(?:\\+?\\d{1,3}[\\s.\\-]?)?' +
+        '(?:\\(\\d{2,4}\\)[\\s.\\-]?|\\d{2,4}[\\s.\\-])' +
+        '\\d{2,4}[\\s.\\-]?\\d{2,4}(?:[\\s.\\-]?\\d{2,4})?',
+    'gm',
+);
+const legacyTags = (text: string): boolean => {
+    LEGACY_PHONE.lastIndex = 0;
+    return LEGACY_PHONE.test(text);
+};
+
+describe('phone parity with the legacy store regex', () => {
+    const PHONES = [
+        j('212-555-', '0142'),
+        j('212.555.', '0142'),
+        j('212 555 ', '0142'),
+        j('(212) 555-', '0142'),
+        j('(212)555-', '0142'),
+        j('1-212-555-', '0142'),
+        j('1 212 555 ', '0142'),
+        j('+1 212 555 ', '0142'),
+        j('+1-212-555-', '0142'),
+        j('+49 30 ', '1234 5678'),
+        j('+49 (30) ', '1234 5678'),
+        j('+44 20 ', '7946 0958'),
+        j('030 ', '1234 5678'),
+        j('030-', '1234-5678'),
+        j('(030) ', '1234 5678'),
+        j('0221 ', '987 6543'),
+    ];
+    it.each(PHONES)('%s — tagged by the legacy regex and by both stores', (v) => {
+        const text = `x ${v}`;
+        expect(legacyTags(text)).toBe(true);
+        for (const redact of [ingestRedact, crossRepoRedact]) {
+            const counters: Record<string, number> = {};
+            redact(text, counters);
+            expect(counters['PHONE'], v).toBe(1);
+        }
+    });
+
+    it('compact US numbers, which the legacy regex never tagged, are tagged now', () => {
+        for (const v of [j('212555', '0142'), j('1212555', '0142')]) {
+            expect(legacyTags(`x ${v}`)).toBe(false);
+            const counters: Record<string, number> = {};
+            ingestRedact(`x ${v}`, counters);
+            expect(counters['PHONE'], v).toBe(1);
+        }
+    });
+
+    it('deliberate losses: shapes the legacy regex tagged that are not phone numbers', () => {
+        for (const v of ['2026-10-19', '10.20.30', '1999 2000 2001']) {
+            expect(legacyTags(`x ${v}`), v).toBe(true);
+            const counters: Record<string, number> = {};
+            ingestRedact(`x ${v}`, counters);
+            expect(counters['PHONE'], v).toBeUndefined();
+        }
+    });
+});
+
```

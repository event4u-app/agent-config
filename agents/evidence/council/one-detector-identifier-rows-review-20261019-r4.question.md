<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-20 for branch drain/road-to-one-detector-and-the-senders-we-own-20261019z,
     round 4, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261019z, round 4 — identifier rows in the one rule table

Ratification review under ADR-268 § 4, round 4. The one gated file is
`src/scripts/_lib/egress_rules.ts`, unchanged since round 3; the subject digest
is still `50e98992c08f5e538a25c1e2dc1d5758954930f1c9b21f19d24356f36df7eca8`.
Reviewed commit `cd04d58d4`. Earlier prompts are the three files
`agents/evidence/council/one-detector-identifier-rows-review-20261019*.question.md`.

Round 3 (both seats REQUEST_CHANGES) found the gated pattern correct and named one
gap: the compact-NANP regression case ran through knowledge ingestion only, not
through cross-repo retrieval, and the test header overstated its coverage as a
differential.

What changed (test-only): the compact case and the deliberate-loss case now run
through both stores' real `redact()`, as the 16-shape compatibility case already
did, and the header calls the corpus a curated sample of the old regex's input
space rather than an exhaustive differential. 34 cases green.

The diff below is round 4's change (`c7b09b725..cd04d58d4`).

Review it. For each defect report file:line, the failure scenario and a severity.
Say whether the round-3 finding is closed. Close with a classification
(`ratified`, `confirmed-non-expanding`, or a refusal) and a one-line stance.

## Round-4 diff

```diff
diff --git a/src/scripts/_lib/identifier_redaction.test.ts b/src/scripts/_lib/identifier_redaction.test.ts
index b7d3df7d0..beed6379c 100644
--- a/src/scripts/_lib/identifier_redaction.test.ts
+++ b/src/scripts/_lib/identifier_redaction.test.ts
@@ -39,9 +39,10 @@ describe.each([
 });
 
 /**
- * Differential parity with the phone regex the two stores carried before the
- * table (frozen verbatim). Every phone-shaped value it tagged is still tagged;
- * the shapes it tagged that are not phone numbers are listed as deliberate losses.
+ * Curated compatibility with the phone regex the two stores carried before the
+ * table (frozen verbatim): each listed phone shape it tagged is still tagged by
+ * both stores, and the listed shapes it tagged that are not phone numbers are
+ * deliberate losses. A sample of its input space, not an exhaustive differential.
  */
 const LEGACY_PHONE = new RegExp(
     '(?:(?<=\\s)|(?<=^))' +
@@ -87,18 +88,22 @@ describe('phone parity with the legacy store regex', () => {
     it('compact US numbers, which the legacy regex never tagged, are tagged now', () => {
         for (const v of [j('212555', '0142'), j('1212555', '0142')]) {
             expect(legacyTags(`x ${v}`)).toBe(false);
-            const counters: Record<string, number> = {};
-            ingestRedact(`x ${v}`, counters);
-            expect(counters['PHONE'], v).toBe(1);
+            for (const redact of [ingestRedact, crossRepoRedact]) {
+                const counters: Record<string, number> = {};
+                redact(`x ${v}`, counters);
+                expect(counters['PHONE'], v).toBe(1);
+            }
         }
     });
 
     it('deliberate losses: shapes the legacy regex tagged that are not phone numbers', () => {
         for (const v of ['2026-10-19', '10.20.30', '1999 2000 2001']) {
             expect(legacyTags(`x ${v}`), v).toBe(true);
-            const counters: Record<string, number> = {};
-            ingestRedact(`x ${v}`, counters);
-            expect(counters['PHONE'], v).toBeUndefined();
+            for (const redact of [ingestRedact, crossRepoRedact]) {
+                const counters: Record<string, number> = {};
+                redact(`x ${v}`, counters);
+                expect(counters['PHONE'], v).toBeUndefined();
+            }
         }
     });
 });
```

<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-15 for branch drain/placeholders-phase-1,
     committed verbatim so the verdict recorded beside it can be checked against
     what was actually asked. Not edited after the run. -->

# Review the release-surface test change — round 3

Round 2 found one gap and both seats named the same change: the between-cut check covered only untombstoned removals, leaving type changes, enum-value removals and additions without a default to be found only at the next cut. The diff below is the complete change to `tests/scripts/release_settings_delta.test.ts` against the branch head, so it shows rounds 1–3 together.

The round-3 addition: `expect(refusalLines(classifySettingsDelta(committed, live))).toEqual([])`, where `live = emitReleasedSurface(committed.version)`. Both functions are the cut's own (`src/scripts/_lib/release_settings_surface.ts`, already imported by this test file). The own-key removal check and the inherited-property assertion are kept. The comment now names the four refused classes. Sensitivity checked: changing one committed entry's `type` from `boolean` to `string` in the committed fixture makes the single-writer test report a difference; the fixture was restored from a copy.

Not changed from round 2: the sort-comparison style difference both seats called cosmetic.

State whether the delta resolves the round-2 finding. Report any defect with line references and a severity, your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

```diff
diff --git a/tests/scripts/release_settings_delta.test.ts b/tests/scripts/release_settings_delta.test.ts
index cec25438d..8db9a2bfe 100644
--- a/tests/scripts/release_settings_delta.test.ts
+++ b/tests/scripts/release_settings_delta.test.ts
@@ -244,12 +244,31 @@ describe('release settings delta — the released surface', () => {
 
     it('single-writer: the committed file is written by the cut and nothing else', () => {
         const committed = readReleasedSurface();
-        // It is a real surface, not a stub: the live schema at the committed
-        // version agrees with it key for key.
-        expect(Object.keys(committed.entries).length).toBeGreaterThan(50);
-        expect(serializeReleasedSurface(committed)).toBe(
-            serializeReleasedSurface(emitReleasedSurface(committed.version)),
+        // It is a real surface, not a stub: more than 50 entries, keys sorted,
+        // no descriptions, sorted tombstone lists. It is NOT compared with a
+        // fresh emission of the live schema: between two cuts the live schema
+        // may gain a key or change a default, and those differences are what
+        // the next cut reads with `classifySettingsDelta`. What must hold
+        // between cuts is that the live schema carries none of the changes
+        // the cut would refuse: an untombstoned removal, a type change, an
+        // enum removal, an addition without a default.
+        const keys = Object.keys(committed.entries);
+        expect(keys.length).toBeGreaterThan(50);
+        expect(keys).toEqual([...keys].sort());
+        for (const [k, e] of Object.entries(committed.entries)) {
+            expect(`${k}:${String('description' in e)}`).toBe(`${k}:false`);
+        }
+        expect(committed.removedKeys).toEqual([...committed.removedKeys].sort());
+        expect(committed.renamedKeys.map(([from]) => from)).toEqual(
+            committed.renamedKeys.map(([from]) => from).sort((a, b) => a.localeCompare(b)),
         );
+        const vanishedFrom = (released: readonly string[], live: object): string[] =>
+            released.filter((k) => !Object.hasOwn(live, k) && !REMOVED_KEYS.has(k) && !RENAMED_KEYS.has(k));
+        const live = emitReleasedSurface(committed.version);
+        expect(refusalLines(classifySettingsDelta(committed, live))).toEqual([]);
+        expect(vanishedFrom(keys, live.entries)).toEqual([]);
+        // An inherited property name is not a live key.
+        expect(vanishedFrom(['constructor', 'toString'], {})).toEqual(['constructor', 'toString']);
 
         // Writer set, read from the source tree. The CALL shape and not the
         // bare name: prose elsewhere names the function, and a mention is not
```

<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-15 for branch drain/placeholders-phase-1,
     committed verbatim so the verdict recorded beside it can be checked against
     what was actually asked. Not edited after the run. -->

# Review the release-surface test change — delta since round 1

Round 1 reviewed a change to `tests/scripts/release_settings_delta.test.ts` that replaces "the committed released surface equals a fresh emission of the live schema" with shape checks plus "no released key vanishes from the live schema without a tombstone". Both seats agreed the original equality does not hold between two cuts, and asked for changes.

What the delta below does with each round-1 point:

1. `k in live` matched inherited properties (both seats) — now `Object.hasOwn(live, k)`, inside a small `vanishedFrom` helper, with an assertion that `constructor` and `toString` against `{}` are reported as vanished. Sensitivity checked: with `k in live` restored, the new assertion reports a difference.
2. The comment said "emitted shape" but checked only parts of `entries` (openai) — the comment now lists what is checked, and the fixture's own `removedKeys` and `renamedKeys` are asserted sorted (not compared with today's maps, which may evolve between cuts).
3. Restore equality for keys present in both the committed file and the live schema (anthropic) — not taken. The cut classifies changes to existing entries: `computeSurfaceDelta` yields six kinds — `removed`, `type_changed`, `enum_removed`, `added`, `default_changed`, `enum_added` — and `classifySettingsDelta` (excerpt below) turns the breaking ones (untombstoned removal, type change, enum removal, addition without a default) into findings the cut refuses on; `default_changed` and `enum_added` go to the release's review form rather than refusing. Requiring per-entry equality between cuts would make every legitimate default change before the next cut red, which is the same false invariant as the original equality.
4. `not.toHaveProperty('description')` for clearer failures (openai, suggestion) — not taken; the existing constructed-string form is kept unchanged.

State whether the delta resolves the round-1 findings, and whether point 3's reasoning holds. Report any defect with line references and a severity, your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

Excerpt, `src/scripts/_lib/release_settings_surface.ts` (`classifySettingsDelta` and its findings):

```ts
export function classifySettingsDelta(oldS: ReleasedSurface, newS: ReleasedSurface): SettingsDeltaFindings {
    const delta = computeSurfaceDelta(oldS, newS);
    const removedMap = new Set(newS.removedKeys);
    const renamedMap = new Map(newS.renamedKeys);
    const renameTargets = new Set(newS.renamedKeys.map(([, to]) => to));

    const findings: SettingsDeltaFindings = {
        untombstoned_removals: [],
        carried_removals: [],
        type_changed: [],
        enum_removed: [],
        added_without_default: [],
    };
    for (const c of delta.changes) {
        if (c.kind === 'removed') {
            const to = renamedMap.get(c.key);
            if (to !== undefined) findings.carried_removals.push({ key: c.key, via: 'renamed', to });
            else if (removedMap.has(c.key)) findings.carried_removals.push({ key: c.key, via: 'removed' });
            else findings.untombstoned_removals.push(c.key);
        } else if (c.kind === 'type_changed') {
            findings.type_changed.push(c.key);
        } else if (c.kind === 'enum_removed') {
            findings.enum_removed.push({ key: c.key, values: c.values ?? [] });
        } else if (c.kind === 'added') {
            if (c.new?.default === undefined && !renameTargets.has(c.key)) {
                findings.added_without_default.push(c.key);
            }
        }
    }
    return findings;
}

/** The four refusing classes, as `label: keys` lines. Empty when the cut is clean. */
export function refusalLines(f: SettingsDeltaFindings): string[] {
    const out: string[] = [];
    if (f.untombstoned_removals.length > 0) {
        out.push(
            `removed with no entry in REMOVED_KEYS or RENAMED_KEYS: ${f.untombstoned_removals.join(', ')}`,
        );
    }
    if (f.type_changed.length > 0) out.push(`type changed: ${f.type_changed.join(', ')}`);
    if (f.enum_removed.length > 0) {
        out.push(
            `vocabulary value removed: ${f.enum_removed
                .map((e) => `${e.key} (${e.values.join(', ')})`)
                .join(', ')}`,
        );
    }
    if (f.added_without_default.length > 0) {
        out.push(`added with no default: ${f.added_without_default.join(', ')}`);
    }
    return out;
```

The delta:

```diff
diff --git a/tests/scripts/release_settings_delta.test.ts b/tests/scripts/release_settings_delta.test.ts
index 2547effbe..3b72febd7 100644
--- a/tests/scripts/release_settings_delta.test.ts
+++ b/tests/scripts/release_settings_delta.test.ts
@@ -244,21 +244,27 @@ describe('release settings delta — the released surface', () => {
 
     it('single-writer: the committed file is written by the cut and nothing else', () => {
         const committed = readReleasedSurface();
-        // It is a real surface, not a stub: emitted shape, sorted, no
-        // descriptions. It is NOT compared with a fresh emission of the live
-        // schema: between two cuts the live schema may gain a key, and that
-        // difference is exactly what the next cut reads with
-        // `classifySettingsDelta`. What must hold between cuts is that no
-        // released key vanishes from the live schema without a tombstone.
+        // It is a real surface, not a stub: more than 50 entries, keys sorted,
+        // no descriptions, sorted tombstone lists. It is NOT compared with a
+        // fresh emission of the live schema: between two cuts the live schema
+        // may gain a key or change a default, and those differences are what
+        // the next cut reads with `classifySettingsDelta`. What must hold
+        // between cuts is that no released key vanishes without a tombstone.
         const keys = Object.keys(committed.entries);
         expect(keys.length).toBeGreaterThan(50);
         expect(keys).toEqual([...keys].sort());
         for (const [k, e] of Object.entries(committed.entries)) {
             expect(`${k}:${String('description' in e)}`).toBe(`${k}:false`);
         }
-        const live = emitReleasedSurface(committed.version).entries;
-        const vanished = keys.filter((k) => !(k in live) && !REMOVED_KEYS.has(k) && !RENAMED_KEYS.has(k));
-        expect(vanished).toEqual([]);
+        expect(committed.removedKeys).toEqual([...committed.removedKeys].sort());
+        expect(committed.renamedKeys.map(([from]) => from)).toEqual(
+            committed.renamedKeys.map(([from]) => from).sort((a, b) => a.localeCompare(b)),
+        );
+        const vanishedFrom = (released: readonly string[], live: object): string[] =>
+            released.filter((k) => !Object.hasOwn(live, k) && !REMOVED_KEYS.has(k) && !RENAMED_KEYS.has(k));
+        expect(vanishedFrom(keys, emitReleasedSurface(committed.version).entries)).toEqual([]);
+        // An inherited property name is not a live key.
+        expect(vanishedFrom(['constructor', 'toString'], {})).toEqual(['constructor', 'toString']);
 
         // Writer set, read from the source tree. The CALL shape and not the
         // bare name: prose elsewhere names the function, and a mention is not
```

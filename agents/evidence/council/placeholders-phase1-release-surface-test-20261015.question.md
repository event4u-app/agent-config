<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-15 for branch drain/placeholders-phase-1,
     committed verbatim so the verdict recorded beside it can be checked against
     what was actually asked. Not edited after the run. -->

# Review a test-assertion change in tests/scripts/release_settings_delta.test.ts

Branch `drain/placeholders-phase-1` adds one settings key, `egress.placeholders.mode` (template, zod schema in `src/server/schemas/settings.ts`, class table). Package version is 16.5.0 and `tests/fixtures/settings_surface_released.json` (the released settings surface, written only by the release cut via `writeReleasedSurface`) carries `"version": "16.5.0"`.

CI went red on `release settings delta — the released surface > single-writer: the committed file is written by the cut and nothing else`, at the assertion that the committed file serialises identically to `emitReleasedSurface(committed.version)`, i.e. to a fresh emission of the LIVE schema. With the new key the live emission has one more entry than the committed file. The same test passes on `origin/main` (085ec41ff), where no key was added since the 16.5.0 cut.

The proposed change replaces that equality (diff below). It keeps: at least 50 entries, keys sorted, no `description` field, the writer-set check and the history check (every commit that modifies the committed file also changes `package.json`). It adds: every key in the committed file is present in the live emission or tombstoned in `REMOVED_KEYS` / `RENAMED_KEYS`. It drops: equality between the committed file and the live schema. The alternative — editing the committed fixture on this branch — would violate the history half of the same test, since this branch does not move the package version.

Question: is the original equality a correct invariant between two release cuts, or does it only hold at the cut commit? Does the replacement keep what the test exists to protect, and does it drop anything the remaining assertions or the cut's own `assert_settings_surface_delta` / `classifySettingsDelta` do not cover? Report defects with line references and a severity, state your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change. A seen-red check was run: adding a fake key to the committed fixture (not in the live schema) turns the new assertion red; the fixture was restored.

Context, from `src/scripts/_lib/release_settings_surface.ts` (header and the cut-time assertion, abridged):

```ts
/**
 * The settings-surface reading a cut performs, and the file it reads it from.
 *
 * `docs/releases.md` § The stability surface names `.agent-settings.yml` keys
 * as part of the public contract (`SETTINGS_REMOVAL_RULE`). The bump could not see
 * that surface at all: it reads commit SUBJECTS (`release.ts` `commits_since`
 * → `infer_bump`), so a key deleted under a `feat:` subject proposes a minor
 * and names nothing. Nothing else checked either — `lint_settings_classes`
 * validates the tombstone entries that EXIST, and the loader's removal warning
 * walks `REMOVED_KEYS` only, so a key deleted from the schema with no entry in
 * either map produces no warning anywhere and the installed value simply stops
 * applying.
 *
 * Three parts, in the order a cut uses them:
 *
 * 1. {@link emitReleasedSurface} — the flattened settings surface at one
 *    version, plus the KEYS of both tombstone maps. Descriptions are dropped
 *    (prose churn is not a surface change) and there is no timestamp, so two
 *    runs at the same version produce byte-identical output.
 * 2. {@link SETTINGS_SURFACE_FIXTURE} — one committed file holding (1) as of
 *    the LAST release. `release.ts` rewrites it inside the cut, which is its
 *    only writer; `check_release_pr_shape` allows it on a release PR.
 * 3. {@link classifySettingsDelta} / {@link assert_settings_surface_delta} —
 *    the delta between the committed file and the live schema, via
 *    `computeSurfaceDelta` (D3: the consumer-side delta and its six kinds are
 *    reused rather than given a second vocabulary), classified into the four
 *    refusals and the one carried case.
 *
 * Preview semantics match the two assertions this one sits beside in
 * `release.ts`: under `--dry-run` it PRINTS what the real run will refuse and
 * returns, because `--dry-run exits 0` is a contract that file's tests pin.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { zodToJsonSchema } from 'zod-to-json-schema';

import { settingsSchema } from '../../server/schemas/settings.js';
import { computeSurfaceDelta, flattenSurface, type SettingsSurface, type SurfaceEntry } from '../../shared/settingsSurface.js';
import { REPO_ROOT } from '../release_env.js';
 * @param emit Seam for the live surface. Production passes nothing; tests
 * inject a planted surface, because the alternative — reaching the refusal
 * only by editing the tracked zod schema — would make every refusal branch
 * testable exclusively through a tracked-file edit.
 */
export function assert_settings_surface_delta(
    target: string,
    opts: {
        previewOnly?: boolean;
        emit?: (version: string) => ReleasedSurface;
        read?: () => ReleasedSurface;
        write?: (line: string) => void;
        proofs?: ReadonlyMap<string, string>;
    } = {},
): SettingsDeltaFindings | null {
    const write = opts.write ?? ((line: string): void => void process.stderr.write(line));
    let released: ReleasedSurface;
    try {
        released = (opts.read ?? readReleasedSurface)();
    } catch (e) {
        // A missing or unreadable file is an environment failure, not a
        // finding: diagnosing it as "a key was removed" sends the releaser to
        // edit a schema that is not the problem.
        die(
            `refusing the ${target} cut: ${SETTINGS_SURFACE_FIXTURE_REL} could not be read ` +
                `(${e instanceof Error ? e.message : String(e)}). That is an environment failure, not a ` +
                'settings change — restore the file from the last release, then re-run.',
        );
        return null;
    }
    const live = (opts.emit ?? emitReleasedSurface)(target);
    const findings = classifySettingsDelta(released, live);

    const carried = carriedLine(findings);
    if (carried !== null) write(`settings surface ${released.version} → ${target}: ${carried}\n`);

 *
 * Descriptions are dropped rather than kept-and-ignored: keeping them would
 * make every reworded help string a diff on a file whose only job is to carry
 * the comparable shape, and a file that churns for prose reasons stops being
 * read. `computeSurfaceDelta` has no `description_changed` kind, so nothing
 * downstream loses a signal.
 */
export function emitReleasedSurface(version: string): ReleasedSurface {
    const surface = flattenSurface(_jsonSchema(), version);
    const entries: Record<string, SurfaceEntry> = {};
    for (const key of Object.keys(surface.entries).sort()) {
        const { description: _drop, ...rest } = surface.entries[key] as SurfaceEntry;
        entries[key] = rest;
    }
    return {
        version,
        entries,
        removedKeys: [...REMOVED_KEYS.keys()].sort(),
        renamedKeys: [...RENAMED_KEYS.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    };
}

/** Serialize exactly as the committed file is written — one trailing newline. */
export function serializeReleasedSurface(s: ReleasedSurface): string {
    return `${JSON.stringify(s, null, 2)}\n`;
}

/** Rewrite the committed file. Called by `release.ts` inside the cut, nowhere else. */
export function writeReleasedSurface(version: string, target = SETTINGS_SURFACE_FIXTURE): void {
    fs.writeFileSync(target, serializeReleasedSurface(emitReleasedSurface(version)), 'utf8');
}

/** Read the committed file. Throws when it is missing — a cut cannot proceed blind. */
export function readReleasedSurface(target = SETTINGS_SURFACE_FIXTURE): ReleasedSurface {
    return JSON.parse(fs.readFileSync(target, 'utf8')) as ReleasedSurface;
}

```

The diff:

```diff
diff --git a/tests/scripts/release_settings_delta.test.ts b/tests/scripts/release_settings_delta.test.ts
index cec25438d..2547effbe 100644
--- a/tests/scripts/release_settings_delta.test.ts
+++ b/tests/scripts/release_settings_delta.test.ts
@@ -243,14 +243,23 @@ describe('release settings delta — the released surface', () => {
     });
 
     it('single-writer: the committed file is written by the cut and nothing else', () => {
         const committed = readReleasedSurface();
-        // It is a real surface, not a stub: the live schema at the committed
-        // version agrees with it key for key.
-        expect(Object.keys(committed.entries).length).toBeGreaterThan(50);
-        expect(serializeReleasedSurface(committed)).toBe(
-            serializeReleasedSurface(emitReleasedSurface(committed.version)),
-        );
+        // It is a real surface, not a stub: emitted shape, sorted, no
+        // descriptions. It is NOT compared with a fresh emission of the live
+        // schema: between two cuts the live schema may gain a key, and that
+        // difference is exactly what the next cut reads with
+        // `classifySettingsDelta`. What must hold between cuts is that no
+        // released key vanishes from the live schema without a tombstone.
+        const keys = Object.keys(committed.entries);
+        expect(keys.length).toBeGreaterThan(50);
+        expect(keys).toEqual([...keys].sort());
+        for (const [k, e] of Object.entries(committed.entries)) {
+            expect(`${k}:${String('description' in e)}`).toBe(`${k}:false`);
+        }
+        const live = emitReleasedSurface(committed.version).entries;
+        const vanished = keys.filter((k) => !(k in live) && !REMOVED_KEYS.has(k) && !RENAMED_KEYS.has(k));
+        expect(vanished).toEqual([]);
 
         // Writer set, read from the source tree. The CALL shape and not the
         // bare name: prose elsewhere names the function, and a mention is not
         // a writer. `--untracked` so the module counts on the branch that
```

// Tests for src/shared/settingsClasses.ts — the pure half of the A/B/C fence,
// shared by the lint, the `settings:set` writer, and the Fastify write route.
//
// Weighted at `guardedChangedKeys`, because that function decides whether a
// write reaches disk without a human, and its most dangerous line — the
// contract-unreadable branch — is one inverted operator away from fail-open.
import { describe, expect, it } from 'vitest';

import {
    buildSettingsClassIndex,
    classOfPath,
    guardedChangedKeys,
    isUnsetSettingValue,
    parseSettingsClassRows,
    type SettingsChange,
    type SettingsClass,
} from '../../src/shared/settingsClasses.js';

const index = (pairs: Array<[string, SettingsClass]>): Map<string, SettingsClass> => new Map(pairs);

const change = (path: string, from: unknown, to: unknown): SettingsChange => ({ path, from, to });

describe('classOfPath', () => {
    it('prefers an exact row over an ancestor', () => {
        const i = index([
            ['a', 'C'],
            ['a.b', 'A'],
        ]);
        expect(classOfPath(i, 'a.b')).toBe('A');
    });

    it('inherits the nearest classified ancestor', () => {
        // A map-valued C key never appears in a flattened diff under its own
        // name; its children must inherit the C rather than read as unknown.
        const i = index([['subagents.host_capabilities', 'C']]);
        expect(classOfPath(i, 'subagents.host_capabilities.subagent_spawn')).toBe('C');
        expect(classOfPath(i, 'subagents.host_capabilities.deep.deeper')).toBe('C');
    });

    it('returns undefined when nothing on the path is classified', () => {
        expect(classOfPath(index([['a.b', 'A']]), 'x.y.z')).toBeUndefined();
        expect(classOfPath(index([['a.b', 'A']]), 'a')).toBeUndefined();
    });
});

describe('guardedChangedKeys', () => {
    const classes = index([
        ['personal.play_by_play', 'A'],
        ['personal.canary_name', 'B'],
        ['personal.autonomy', 'C'],
        ['screenshots.identity_allowlist', 'C'],
        ['subagents.host_capabilities', 'C'],
    ]);

    it('guards a changed C key', () => {
        expect(guardedChangedKeys(classes, [change('personal.autonomy', 'auto', 'on')])).toEqual([
            'personal.autonomy',
        ]);
    });

    it('does not guard a changed A or B key', () => {
        expect(
            guardedChangedKeys(classes, [
                change('personal.play_by_play', false, true),
                change('personal.canary_name', '', 'Matze'),
            ]),
        ).toEqual([]);
    });

    it('guards a child of a map-valued C key', () => {
        // The live case: subagents.host_capabilities is `{}` in the template and
        // passthrough in the schema, so a child arrives as its own diff path.
        expect(
            guardedChangedKeys(classes, [change('subagents.host_capabilities.subagent_spawn', undefined, true)]),
        ).toEqual(['subagents.host_capabilities.subagent_spawn']);
    });

    it('guards a changed key the contract does not classify at all', () => {
        // Unverifiable is not unguarded — the same per-key refusal the CLI
        // writer applies to an unclassified key.
        expect(guardedChangedKeys(classes, [change('mystery.key', 1, 2)])).toEqual(['mystery.key']);
    });

    it('guards EVERYTHING when the contract could not be read', () => {
        // The fail-closed branch. Inverting its condition is a one-character
        // fail-open regression, and this is the assertion that catches it.
        expect(
            guardedChangedKeys(null, [
                change('personal.play_by_play', false, true),
                change('personal.canary_name', '', 'Matze'),
            ]),
        ).toEqual(['personal.canary_name', 'personal.play_by_play']);
    });

    it('skips a pair whose two sides are both unset', () => {
        // A key written as null reads back as '' through the comment-preserving
        // merge. A confirmation that appears on every save is one nobody reads.
        expect(guardedChangedKeys(classes, [change('personal.autonomy', '', null)])).toEqual([]);
        expect(guardedChangedKeys(classes, [change('personal.autonomy', undefined, '')])).toEqual([]);
    });

    it('still guards an emptied allowlist — one side unset is not both', () => {
        // The failure this must not have: dropping every entry from an
        // allow-list is the most consequential edit such a key can take.
        expect(
            guardedChangedKeys(classes, [change('screenshots.identity_allowlist', ['matze4u'], [])]),
        ).toEqual(['screenshots.identity_allowlist']);
        expect(guardedChangedKeys(classes, [change('personal.autonomy', 'auto', '')])).toEqual([
            'personal.autonomy',
        ]);
    });

    it('sorts, so the reported list is stable', () => {
        expect(
            guardedChangedKeys(classes, [
                change('screenshots.identity_allowlist', [], ['x']),
                change('personal.autonomy', 'auto', 'on'),
            ]),
        ).toEqual(['personal.autonomy', 'screenshots.identity_allowlist']);
    });
});

describe('isUnsetSettingValue', () => {
    it('treats only absent, null, and the empty scalar as unset', () => {
        for (const v of [undefined, null, '']) {
            expect(isUnsetSettingValue(v)).toBe(true);
        }
        // An empty array and an empty map are VALUES — emptying an allowlist is
        // a decision, not an absence.
        for (const v of [[], {}, 0, false, 'x']) {
            expect(isUnsetSettingValue(v)).toBe(false);
        }
    });
});

describe('buildSettingsClassIndex', () => {
    it('drops a row whose class is not A|B|C rather than defaulting it', () => {
        const rows = parseSettingsClassRows('| `a.b` | D | `1` | why |\n| `c.d` | A | `1` | why |\n');
        const i = buildSettingsClassIndex(rows);
        // A typo in the contract must never widen the fence: the caller gets
        // `undefined`, which every caller treats as refuse.
        expect(i.get('a.b')).toBeUndefined();
        expect(i.get('c.d')).toBe('A');
    });

    it('keeps the FIRST row when a key is duplicated', () => {
        const rows = parseSettingsClassRows('| `a.b` | C | `1` | why |\n| `a.b` | A | `1` | why |\n');
        expect(buildSettingsClassIndex(rows).get('a.b')).toBe('C');
    });
});

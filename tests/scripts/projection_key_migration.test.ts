import { describe, expect, it } from 'vitest';

import { REMOVED_KEYS, warnRemovedKeys } from '../../src/scripts/_lib/settings_removed_keys.js';
import {
    LEGACY_FULL_VALUE,
    MIGRATION_WINDOW,
    migrationLines,
    readLegacyProjectionIntent,
} from '../../src/scripts/_lib/projection_key_migration.js';

const intent = (tree: Record<string, unknown>) => readLegacyProjectionIntent(tree);

describe('the one-window read of the removed projection keys', () => {
    it('names exactly the two values that mean "keep the full layer"', () => {
        expect(LEGACY_FULL_VALUE).toEqual({
            'lean_projection.mode': 'eager-all',
            'projection.mode': 'legacy-all',
        });
    });

    it('turns an explicitly written full value into the receipt pin', () => {
        const r = intent({ lean_projection: { mode: 'eager-all' } });
        expect(r.pin).toBe(true);
        expect(r.rows).toEqual([{ key: 'lean_projection.mode', value: 'eager-all', disposition: 'pin' }]);
    });

    it('pins on either key, and on both at once', () => {
        expect(intent({ projection: { mode: 'legacy-all' } }).pin).toBe(true);
        const both = intent({ lean_projection: { mode: 'eager-all' }, projection: { mode: 'legacy-all' } });
        expect(both.pin).toBe(true);
        expect(both.rows.map((r) => r.disposition)).toEqual(['pin', 'pin']);
    });

    for (const [tree, value] of [
        [{ lean_projection: { mode: 'delivery' } }, 'delivery'],
        [{ lean_projection: { mode: 'thin' } }, 'thin'],
        [{ projection: { mode: 'scoped' } }, 'scoped'],
        [{ projection: { mode: 'tiered' } }, 'tiered'],
        [{ projection: { mode: 'nonsense' } }, 'nonsense'],
    ] as const) {
        it(`drops \`${value}\` and does not pin`, () => {
            const r = intent(tree as Record<string, unknown>);
            expect(r.pin).toBe(false);
            expect(r.rows).toHaveLength(1);
            expect(r.rows[0]?.disposition).toBe('dropped');
            expect(r.rows[0]?.value).toBe(value);
        });
    }

    it('says nothing when no leftover key is present', () => {
        const r = intent({ personal: { canary_name: 'x' } });
        expect(r.pin).toBe(false);
        expect(r.rows).toEqual([]);
        expect(migrationLines(r)).toEqual([]);
    });

    it('prints both dispositions, never only the one it acted on', () => {
        const r = intent({ lean_projection: { mode: 'eager-all' }, projection: { mode: 'tiered' } });
        const lines = migrationLines(r);
        expect(lines.some((l) => l.includes('lean_projection.mode') && l.includes('full'))).toBe(true);
        expect(lines.some((l) => l.includes('projection.mode') && l.includes('ignored'))).toBe(true);
        expect(lines.every((l) => l.includes(MIGRATION_WINDOW))).toBe(true);
    });

    it('is tolerant of a tree whose branch is not an object', () => {
        for (const tree of [{ lean_projection: 'eager-all' }, { projection: null }, { lean_projection: ['x'] }]) {
            expect(() => intent(tree as Record<string, unknown>)).not.toThrow();
            expect(intent(tree as Record<string, unknown>).rows).toEqual([]);
        }
    });

    it('trims and lower-cases before comparing, so a hand-edited value still reads', () => {
        expect(intent({ lean_projection: { mode: '  EAGER-ALL ' } }).pin).toBe(true);
    });

    it('ignores a non-string value rather than guessing at it', () => {
        expect(intent({ lean_projection: { mode: 3 } }).rows).toEqual([]);
    });
});

describe('the removed keys carry tombstones (step 4.2)', () => {
    it('every key Phase 4 removed is in REMOVED_KEYS, and each reason names what decides instead', () => {
        for (const key of ['lean_projection.mode', 'lean_projection.hosts', 'projection.rule_workspaces']) {
            const reason = REMOVED_KEYS.get(key);
            expect(reason, `${key} has no tombstone`).toBeTypeOf('string');
            expect(reason).toMatch(/layer_form_decision|THINNABLE_HOSTS|host-injection-effect|consumerRuleWorkspaces/);
        }
    });

    it('a leftover value is warned about once, by name, on stderr', () => {
        const written: string[] = [];
        const real = process.stderr.write.bind(process.stderr);
        process.stderr.write = ((chunk: string) => {
            written.push(String(chunk));
            return true;
        }) as typeof process.stderr.write;
        try {
            warnRemovedKeys({ lean_projection: { mode: 'delivery' } });
            warnRemovedKeys({ lean_projection: { mode: 'delivery' } });
        } finally {
            process.stderr.write = real;
        }
        const hits = written.filter((l) => l.startsWith('lean_projection.mode was removed'));
        expect(hits).toHaveLength(1); // once per process, not once per call
    });

    it('the keys the migration reads are exactly the keys that have tombstones', () => {
        expect(Object.keys(LEGACY_FULL_VALUE).every((k) => REMOVED_KEYS.has(k) || k === 'projection.mode')).toBe(true);
    });
});

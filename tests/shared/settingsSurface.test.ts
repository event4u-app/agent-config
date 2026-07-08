/**
 * Settings-surface flatten / delta / classification
 * (road-to-settings-change-review) — the pure engine behind the
 * upgrade-time settings review form.
 */
import { describe, expect, it } from 'vitest';
import {
    flattenSurface,
    computeSurfaceDelta,
    classifyChange,
    type SettingsSurface,
} from '../../src/shared/settingsSurface.js';

const SCHEMA_V1 = {
    type: 'object',
    properties: {
        personal: {
            type: 'object',
            properties: {
                autonomy: { type: 'string', enum: ['auto', 'on', 'off'], default: 'auto', description: 'Autonomy mode' },
                minimal_output: { type: 'boolean', default: true },
            },
        },
        rule_loading_tier: { type: 'string', enum: ['minimal', 'balanced', 'full'], default: 'balanced' },
    },
};

const SCHEMA_V2 = {
    type: 'object',
    properties: {
        personal: {
            type: 'object',
            properties: {
                // default flipped + a NEW enum value
                autonomy: { type: 'string', enum: ['auto', 'on', 'off', 'strict'], default: 'on', description: 'Autonomy mode' },
                minimal_output: { type: 'boolean', default: true },
            },
        },
        // enum value REMOVED ('minimal' gone)
        rule_loading_tier: { type: 'string', enum: ['balanced', 'full'], default: 'balanced' },
        // brand-new setting
        discipline_profile: { type: 'string', enum: ['auto', 'off'], default: 'auto' },
    },
};

function surfaces(): { v1: SettingsSurface; v2: SettingsSurface } {
    return {
        v1: flattenSurface(SCHEMA_V1, '8.0.0'),
        v2: flattenSurface(SCHEMA_V2, '9.0.0'),
    };
}

describe('flattenSurface', () => {
    it('flattens nested objects to dotted leaves with default/enum/description', () => {
        const { v1 } = surfaces();
        expect(Object.keys(v1.entries).sort()).toEqual([
            'personal.autonomy', 'personal.minimal_output', 'rule_loading_tier',
        ]);
        expect(v1.entries['personal.autonomy']).toMatchObject({
            type: 'string', default: 'auto', enum: ['auto', 'on', 'off'], description: 'Autonomy mode',
        });
    });

    it('unwraps a $ref/definitions root (zod-to-json-schema named output)', () => {
        const wrapped = { $ref: '#/definitions/S', definitions: { S: SCHEMA_V1 } };
        const s = flattenSurface(wrapped, '8.0.0');
        expect(Object.keys(s.entries)).toHaveLength(3);
    });
});

describe('computeSurfaceDelta', () => {
    it('detects added keys, default changes, enum additions and removals', () => {
        const { v1, v2 } = surfaces();
        const delta = computeSurfaceDelta(v1, v2);
        const kinds = delta.changes.map((c) => `${c.key}:${c.kind}`);
        expect(kinds).toContain('discipline_profile:added');
        expect(kinds).toContain('personal.autonomy:default_changed');
        expect(kinds).toContain('personal.autonomy:enum_added');
        expect(kinds).toContain('rule_loading_tier:enum_removed');
        // unchanged key contributes nothing
        expect(kinds.some((k) => k.startsWith('personal.minimal_output'))).toBe(false);
        expect(delta.oldVersion).toBe('8.0.0');
        expect(delta.newVersion).toBe('9.0.0');
    });

    it('is empty for identical surfaces', () => {
        const { v1 } = surfaces();
        expect(computeSurfaceDelta(v1, { ...v1, version: '8.0.1' }).changes).toEqual([]);
    });

    it('reports removed keys', () => {
        const { v1, v2 } = surfaces();
        const delta = computeSurfaceDelta(v2, v1);
        expect(delta.changes.map((c) => `${c.key}:${c.kind}`)).toContain('discipline_profile:removed');
    });
});

describe('classifyChange', () => {
    it('enum_removed hitting the stored value is must_fix, otherwise info', () => {
        const { v1, v2 } = surfaces();
        const change = computeSurfaceDelta(v1, v2).changes
            .find((c) => c.key === 'rule_loading_tier' && c.kind === 'enum_removed')!;
        expect(classifyChange(change, 'minimal')).toBe('must_fix');
        expect(classifyChange(change, 'balanced')).toBe('info');
    });

    it('default_changed preselects adopt for never-customized values', () => {
        const { v1, v2 } = surfaces();
        const change = computeSurfaceDelta(v1, v2).changes
            .find((c) => c.key === 'personal.autonomy' && c.kind === 'default_changed')!;
        expect(classifyChange(change, 'auto')).toBe('adopt');      // == old default
        expect(classifyChange(change, undefined)).toBe('adopt');   // never present
        expect(classifyChange(change, 'off')).toBe('review');      // customized
    });

    it('added settings with a default are info; without a default must_fix', () => {
        const { v1, v2 } = surfaces();
        const added = computeSurfaceDelta(v1, v2).changes
            .find((c) => c.key === 'discipline_profile' && c.kind === 'added')!;
        expect(classifyChange(added, undefined)).toBe('info');
        expect(classifyChange({ ...added, new: { type: 'string' } }, undefined)).toBe('must_fix');
    });
});

import { describe, expect, it } from 'vitest';

import { hooksValueError, load_surface_matrix } from '../../src/scripts/lint_surface_matrix.js';

describe('lint_surface_matrix — hooks value', () => {
    it.each(['ac-owned-settings-block', 'settings-hooks-opt-in', 'plugin', 'none'])('%s is legal', (v) => {
        expect(hooksValueError(v)).toBeNull();
    });

    it('the retired value is refused with the new one named', () => {
        const err = hooksValueError('managed-settings-block');
        expect(err).toContain('renamed to `ac-owned-settings-block`');
        expect(err).toContain('organisation layer');
    });

    it('an unknown value lists the legal set', () => {
        expect(hooksValueError('bogus')).toContain('not in {ac-owned-settings-block');
    });

    it('the shipped matrix uses no retired value', () => {
        for (const entry of Object.values(load_surface_matrix())) {
            expect(hooksValueError(entry.hooks)).toBeNull();
        }
    });
});

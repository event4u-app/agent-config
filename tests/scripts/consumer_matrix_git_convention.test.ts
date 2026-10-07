/**
 * The consumer-matrix leg that runs `git:convention show` from a packed global
 * install. The leg itself needs the tarball; its verdict is the pure function
 * below, exercised here against the JSON the verb prints.
 */
import { describe, expect, it } from 'vitest';

import { checkGitConventionShow } from '../../src/scripts/consumer_matrix.js';

function shown(overrides: Record<string, Record<string, unknown>> = {}): string {
    const base: Record<string, Record<string, unknown>> = {
        commit_format: { value: 'ticket-conventional', state: 'valid', source: '.git-convention.yml at 0123456789ab' },
        branch_pattern: { value: '{type}/{slug}', state: 'absent', source: null },
        update_strategy: { value: 'rebase', state: 'valid', source: '.git-convention.yml at 0123456789ab' },
    };
    for (const [k, v] of Object.entries(overrides)) base[k] = { ...base[k], ...v };
    return JSON.stringify({ ok: true, keys: base, target: { ref: 'origin/main', sha: '0'.repeat(40) } });
}

describe('checkGitConventionShow', () => {
    it('passes when both committed values are read from the carrier', () => {
        expect(checkGitConventionShow(0, shown())).toContain('update_strategy=rebase');
    });

    it('fails on a non-zero exit', () => {
        expect(() => checkGitConventionShow(1, shown())).toThrow(/exit 1/);
    });

    it('fails when the output is not JSON', () => {
        expect(() => checkGitConventionShow(0, 'usage: …')).toThrow(/not JSON/);
    });

    it('fails when the strategy did not come from the committed carrier', () => {
        expect(() => checkGitConventionShow(0, shown({ update_strategy: { value: 'merge', state: 'absent', source: null } }))).toThrow(
            /update_strategy/,
        );
    });

    it('fails when the commit format did not come from the committed carrier', () => {
        expect(() =>
            checkGitConventionShow(0, shown({ commit_format: { value: 'ticket-scope', state: 'absent', source: null } })),
        ).toThrow(/commit_format/);
    });
});

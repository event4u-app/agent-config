import { describe, expect, it } from 'vitest';

import { behindRemedy } from '../../src/scripts/check_branch_freshness.js';
import type { GitConventionReading } from '../../src/scripts/_lib/git_convention.js';

function reading(partial: Partial<GitConventionReading>): GitConventionReading {
    return { key: 'update_strategy', value: 'merge', source: null, state: 'absent', reason: null, detail: null, ...partial };
}

describe('the behind remedy follows git.update_strategy', () => {
    it('prints the merge command under the default strategy', () => {
        const text = behindRemedy('main', reading({})).join('\n');
        expect(text).toContain('git fetch origin && git merge origin/main');
        expect(text).toContain('roadmap:progress');
    });

    it('prints the pointer, never a merge, under rebase', () => {
        const text = behindRemedy('main', reading({ value: 'rebase', state: 'valid', source: '/r/.agent-settings.yml' })).join('\n');
        expect(text).not.toContain('git merge');
        expect(text).toContain('references/branch-update.md');
        expect(text).toContain('rebase');
    });

    it('prints no merge when the strategy cannot be read, and names why', () => {
        const text = behindRemedy(
            'main',
            reading({ value: null, state: 'malformed', source: '/r/.agent-settings.yml', reason: 'git-convention-malformed', detail: 'x' }),
        ).join('\n');
        expect(text).not.toContain('git merge');
        expect(text).toContain('git-convention-malformed');
        expect(text).toContain('references/branch-update.md');
    });
});

/**
 * The refusal for a behind branch under `rebase` is built from the dry run's
 * facts, not by editing the dry run's sentence: a reworded dry-run message must
 * not leak "would merge" or "Dry run" into a refusal that merges nothing.
 */
import { describe, expect, it } from 'vitest';

import { behindRefusalMessage, type Plan } from '../../src/scripts/sync_pr_branch.js';

function plan(message: string): Plan {
    return {
        exit: 0,
        message,
        generated: [],
        remeasured: [],
        authored: [],
        scanned: 1,
        behind: 1,
        summary: 'base set: origin/main',
        behindDetail: 'origin/main (2 behind)',
    };
}

describe('behindRefusalMessage', () => {
    it('names what the branch is behind and claims no merge and no dry run', () => {
        const m = behindRefusalMessage(plan('base set: origin/main. Behind: origin/main (2 behind) — would merge in that order. Dry run, nothing changed.'), 'rebase');
        expect(m).toContain('git.update_strategy is `rebase`');
        expect(m).toContain('base set: origin/main. Behind: origin/main (2 behind).');
        expect(m).not.toMatch(/would merge|Dry run/);
    });

    it('stays correct when the dry-run sentence is reworded', () => {
        const m = behindRefusalMessage(plan('base set: origin/main. Behind: origin/main (2 behind); a merge would apply them. Dry run only.'), 'rebase');
        expect(m).toContain('Behind: origin/main (2 behind).');
        expect(m).not.toMatch(/would|Dry run/);
    });
});

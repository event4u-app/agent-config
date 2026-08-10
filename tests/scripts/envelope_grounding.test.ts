/**
 * envelope_grounding — the drift anchor + scripted grounding
 * (road-to-cost-parity-3 Phase 3.2 / 3.2b / 3.3).
 *
 * The three fixtures the roadmap names pin the comparison, and the third is
 * the one that justifies the whole design: same branch name in a different
 * repo or worktree must report drift, which branch+HEAD alone cannot see.
 */
import { describe, expect, it } from 'vitest';

import {
    canonicalizeRepoIdentity,
    describeDrift,
    type RepoAnchor,
} from '../../src/scripts/_lib/envelope_grounding.js';

const REPO = 'github.com/event4u-app/agent-config';

function anchor(over: Partial<RepoAnchor> = {}): RepoAnchor {
    return { repo_identity: REPO, branch: 'feat/x', head: 'a'.repeat(40), ...over };
}

function envelope(over: Record<string, unknown> = {}): Record<string, unknown> {
    return { repo_identity: REPO, branch: 'feat/x', head: 'a'.repeat(40), ...over };
}

describe('canonicalizeRepoIdentity', () => {
    it('collapses every spelling of one remote into one identity', () => {
        const forms = [
            'git@github.com:event4u-app/agent-config.git',
            'https://github.com/event4u-app/agent-config',
            'https://github.com/event4u-app/agent-config.git',
            'ssh://git@GitHub.com/event4u-app/agent-config.git',
            'https://user:token@github.com/event4u-app/agent-config.git/',
        ];
        for (const form of forms) {
            expect(canonicalizeRepoIdentity(form)).toBe(REPO);
        }
    });

    it('lower-cases the host but never the path — repo names are case-bearing', () => {
        expect(canonicalizeRepoIdentity('git@GitHub.com:Org/RepoName.git')).toBe('github.com/Org/RepoName');
    });
});

describe('drift comparison — the three pinned fixtures', () => {
    it('same identity + same HEAD stays silent', () => {
        expect(describeDrift(envelope(), anchor())).toEqual([]);
    });

    it('same identity + moved HEAD reports commit drift', () => {
        const drift = describeDrift(envelope(), anchor({ head: 'b'.repeat(40) }));
        expect(drift).toHaveLength(1);
        expect(drift[0]).toContain('COMMIT DRIFT');
        expect(drift[0]).toContain('re-read anything the envelope quotes');
    });

    it('same branch name in a DIFFERENT repo reports identity drift', () => {
        // branch and HEAD are identical — the case branch+HEAD alone is blind to.
        const drift = describeDrift(envelope(), anchor({ repo_identity: 'github.com/someone/other' }));
        expect(drift).toHaveLength(1);
        expect(drift[0]).toContain('IDENTITY DRIFT');
        expect(drift[0]).toContain('same branch name');
    });

    it('a remote-less checkout anchors on the git dir, and two worktrees differ', () => {
        const a = envelope({ repo_identity: '/repo/.git' });
        expect(describeDrift(a, anchor({ repo_identity: '/repo/.git' }))).toEqual([]);
        expect(describeDrift(a, anchor({ repo_identity: '/other/.git' }))).toHaveLength(1);
    });
});

describe('drift is silent on what it cannot know', () => {
    it('an envelope with no anchor produces no drift — absent is not a mismatch', () => {
        expect(describeDrift({ task: 'x' }, anchor())).toEqual([]);
    });

    it('an unreadable tree produces no drift — a null reading is not evidence', () => {
        expect(
            describeDrift(envelope(), { repo_identity: null, branch: null, head: null }),
        ).toEqual([]);
    });

    it('reports branch drift and commit drift independently', () => {
        const drift = describeDrift(envelope(), anchor({ branch: 'main', head: 'c'.repeat(40) }));
        expect(drift.map((d) => d.split(':')[0])).toEqual(['BRANCH DRIFT', 'COMMIT DRIFT']);
    });
});

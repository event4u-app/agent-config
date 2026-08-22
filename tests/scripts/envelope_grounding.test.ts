/**
 * envelope_grounding — the drift anchor + scripted grounding
 * (road-to-cost-parity-3 Phase 3.2 / 3.2b / 3.3).
 *
 * The three fixtures the roadmap names pin the comparison, and the third is
 * the one that justifies the whole design: same branch name in a different
 * repo or worktree must report drift, which branch+HEAD alone cannot see.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { statePathFor } from '../../src/scripts/before_complete_hook.js';
import {
    canonicalizeRepoIdentity,
    describeDrift,
    readLastVerify,
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

describe('readLastVerify — the reader now resolves the path the producer writes', () => {
    /**
     * The pre-fix reader resolved `agents/runtime/state/verify-before-complete.json`
     * and the producer has never written it, so `null` was the ONLY answer this
     * function could give. These two cases are therefore the sabotage probe as
     * well as the contract: the non-null case fails against the old constant,
     * which is what makes the green meaningful.
     *
     * The state file is written through the producer's own path builder rather
     * than a literal digest — a hand-computed digest in a test is a second
     * implementation of the thing under test.
     */
    function withRoot(body: (root: string) => void): void {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'envelope-grounding-'));
        try {
            body(root);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    }

    it('returns the recorded command for a session whose producer state exists', () => {
        withRoot((root) => {
            const rel = statePathFor('session-alpha');
            fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
            fs.writeFileSync(
                path.join(root, rel),
                JSON.stringify({
                    session_id: 'session-alpha',
                    last_verification: { command: 'task ci', tool: 'Bash', at: '2026-08-20T10:00:00Z' },
                }),
                'utf-8',
            );
            const line = readLastVerify(root, 'session-alpha');
            expect(line).not.toBeNull();
            expect(line).toContain('task ci');
            expect(line).toContain('2026-08-20T10:00:00Z');
        });
    });

    /**
     * The multi-line case, and it is the one that mattered in practice.
     *
     * A recorded command is whatever the operator ran, and a heredoc — the
     * ordinary shape for `git commit -F - <<'MSG'` — records a multi-line
     * string. The pre-fix reader sliced to MAX_FIELD_CHARS and kept the
     * newlines, so `validateRecycleEnvelope`'s `isShortLine` rejected the value
     * and `session:recycle` refused its OWN machine-collected field. Composing a
     * valid envelope was impossible whenever the previous verification command
     * spanned more than one line, and the error named `last_verify` without
     * hinting that the composer had not supplied it.
     *
     * Reproduced 2026-08-21 against a real 512-char heredoc in this repository.
     */
    it('flattens a multi-line command — a heredoc must not produce an unusable field', () => {
        withRoot((root) => {
            const rel = statePathFor('session-heredoc');
            fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
            const multiline = ["git commit -q -F - <<'MSG'", 'feat: a subject', '', 'A body line.', 'MSG'].join('\n');
            fs.writeFileSync(
                path.join(root, rel),
                JSON.stringify({
                    session_id: 'session-heredoc',
                    last_verification: { command: multiline, tool: 'Bash', at: '2026-08-21T10:00:00Z' },
                }),
                'utf-8',
            );
            const line = readLastVerify(root, 'session-heredoc');
            expect(line).not.toBeNull();
            // The property the envelope validator actually checks.
            expect(line).not.toContain('\n');
            // Flattened, not truncated at the first newline — the command stays
            // identifiable, which is the whole point of the field.
            expect(line).toContain('git commit');
            expect(line).toContain('feat: a subject');
            expect(line).toContain('2026-08-21T10:00:00Z');
        });
    });

    it('collapses a run of whitespace rather than leaving a ragged field', () => {
        withRoot((root) => {
            const rel = statePathFor('session-ragged');
            fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
            fs.writeFileSync(
                path.join(root, rel),
                JSON.stringify({
                    session_id: 'session-ragged',
                    last_verification: { command: 'task   ci\t\t--verbose\n', tool: 'Bash', at: '2026-08-21T10:00:00Z' },
                }),
                'utf-8',
            );
            expect(readLastVerify(root, 'session-ragged')).toContain('task ci --verbose @');
        });
    });

    it('returns null for a session whose producer state does not exist', () => {
        withRoot((root) => {
            expect(readLastVerify(root, 'session-with-no-state')).toBeNull();
        });
    });

    it('never reads a NEIGHBOURING session state — the digest paths are distinct', () => {
        withRoot((root) => {
            const rel = statePathFor('session-alpha');
            fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
            fs.writeFileSync(
                path.join(root, rel),
                JSON.stringify({ last_verification: { command: 'task ci', at: 'x' } }),
                'utf-8',
            );
            // A second session in the same tree must not inherit the first's line.
            expect(readLastVerify(root, 'session-beta')).toBeNull();
        });
    });

    it('an absent session id yields null rather than an arbitrary neighbour', () => {
        withRoot((root) => {
            const rel = statePathFor('session-alpha');
            fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
            fs.writeFileSync(
                path.join(root, rel),
                JSON.stringify({ last_verification: { command: 'task ci', at: 'x' } }),
                'utf-8',
            );
            expect(readLastVerify(root, null)).toBeNull();
            expect(readLastVerify(root, '   ')).toBeNull();
        });
    });
});

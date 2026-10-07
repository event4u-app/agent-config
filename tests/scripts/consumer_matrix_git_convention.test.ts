/**
 * The consumer-matrix leg that runs `git:convention show` from a packed global
 * install. The leg itself needs the tarball; its verdict is the pure function
 * below, exercised here against the JSON the verb prints.
 */
import { describe, expect, it } from 'vitest';

import { checkGitConventionShow, checkGitConventionSubject, checkGitConventionSync } from '../../src/scripts/consumer_matrix.js';

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

describe('checkGitConventionSubject', () => {
    const valid = { status: 0, stdout: '1 subject(s) valid under git.commit_format: ticket-conventional' };
    const rejected = { status: 1, stdout: '✗ DEV-1 feat(api,DEV-1): x\n  … the ticket `DEV-1` stands inside the scope …' };

    it('passes when a valid subject resolves and a ticket inside a compound scope is rejected', () => {
        expect(checkGitConventionSubject(valid, rejected)).toContain('compound scope');
    });

    it('fails when the valid subject does not exit 0', () => {
        expect(() => checkGitConventionSubject({ status: 127, stdout: '' }, rejected)).toThrow(/valid subject/);
    });

    it('fails when the compound-scope ticket is accepted', () => {
        expect(() => checkGitConventionSubject(valid, { status: 0, stdout: '1 subject(s) valid' })).toThrow(/compound scope/);
    });
});

describe('checkGitConventionSync', () => {
    const current = { status: 0, stdout: '✅  sync_pr_branch: current' };
    const behind = { status: 3, stdout: '⚠️  sync_pr_branch: refused — the branch is behind and git.update_strategy is `rebase`; this script only merges.' };

    it('passes when a current branch exits 0 and a behind one is refused under the committed rebase', () => {
        expect(checkGitConventionSync(current, behind)).toContain('exit 3');
    });

    it('fails when the verb is missing from the install', () => {
        expect(() => checkGitConventionSync({ status: 2, stdout: '', stderr: 'unknown subcommand: sync' }, behind)).toThrow(/current branch/);
    });

    it('fails when a behind branch is not refused under rebase', () => {
        expect(() => checkGitConventionSync(current, { status: 0, stdout: '✅  merged' })).toThrow(/behind branch/);
    });
});

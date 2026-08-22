/**
 * Base-ref ratchet — the property a count comparison cannot express.
 *
 * The load-bearing negative fixture is `swap-one-out-add-one-in`: the entry
 * COUNT is unchanged, so every count-based ratchet in this tree passes it,
 * and the estate still moved backwards. If that case ever goes green here,
 * this module has stopped doing the one thing it was written for.
 *
 * The fixtures drive real `git` against a throwaway repository rather than a
 * stubbed shell, because the rename half of the contract IS git's rename
 * detection — a stub would be asserting the mock.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';

import { rmTempRepo } from '../_lib/rm_temp_repo.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    BaseRefUnavailableError,
    RATCHET_RESET_KEY,
    RatchetGrowthError,
    assertNoNewEntries,
    compareToBaseRef,
    defaultEntriesOf,
    describeComparison,
    resolveBaseRef,
} from '../../src/scripts/_lib/ratchet_base_ref.js';

let repo: string;

function git(...args: string[]): string {
    return execFileSync('git', args, { cwd: repo, encoding: 'utf-8' });
}

function writeBaseline(rel: string, value: unknown): void {
    writeFileSync(join(repo, rel), `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'ratchet-baseref-'));
    git('init', '--quiet', '--initial-branch=main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    git('config', 'commit.gpgsign', 'false');
    mkdirSync(join(repo, 'src', 'config'), { recursive: true });
    writeBaseline('src/config/allow.json', ['a.md', 'b.md', 'c.md']);
    git('add', '-A');
    git('commit', '--quiet', '-m', 'baseline');
    git('branch', 'base');
});

afterEach(() => {
    // Retrying remove: git can still be finishing work in this `.git` after the
    // spawnSync that started it returned, and a plain recursive rmSync then
    // fails ENOTEMPTY. Observed on ubuntu and macOS across three PRs while the
    // same suite passed locally every time. See `rmTempRepo`.
    rmTempRepo(repo);
});

const opts = () => ({ baselinePath: 'src/config/allow.json', baseRef: 'base', repoRoot: repo });

describe('assertNoNewEntries', () => {
    it('passes when the baseline is unchanged', () => {
        expect(() => assertNoNewEntries(opts())).not.toThrow();
    });

    it('passes when entries are only removed — the wanted direction', () => {
        writeBaseline('src/config/allow.json', ['a.md']);
        const c = assertNoNewEntries(opts());
        expect(c.verdict).toBe('ok');
        expect(c.removed).toEqual(['b.md', 'c.md']);
    });

    it('FAILS on a single added entry', () => {
        writeBaseline('src/config/allow.json', ['a.md', 'b.md', 'c.md', 'd.md']);
        expect(() => assertNoNewEntries(opts())).toThrow(RatchetGrowthError);
    });

    it('FAILS on swap-one-out-add-one-in, where the COUNT is unchanged', () => {
        writeBaseline('src/config/allow.json', ['a.md', 'b.md', 'z.md']);
        let caught: RatchetGrowthError | undefined;
        try {
            assertNoNewEntries(opts());
        } catch (e) {
            caught = e as RatchetGrowthError;
        }
        expect(caught).toBeInstanceOf(RatchetGrowthError);
        expect(caught?.added).toEqual(['z.md']);
        // The count-based ratchet this replaces would have seen 3 → 3 and passed.
        const c = compareToBaseRef(opts());
        expect(c.headCount).toBe(c.baseCount);
    });

    it('names every added entry in the error message', () => {
        writeBaseline('src/config/allow.json', ['a.md', 'b.md', 'c.md', 'new-one.md', 'new-two.md']);
        let message = '';
        try {
            assertNoNewEntries(opts());
        } catch (e) {
            message = (e as Error).message;
        }
        expect(message).toContain('new-one.md');
        expect(message).toContain('new-two.md');
        expect(message).toContain(RATCHET_RESET_KEY);
    });
});

describe('renames are not growth', () => {
    it('treats a git-detected rename of an entry path as the same entry', () => {
        // The entry keys are paths; move the file git tracks AND the entry.
        const long = `${'x'.repeat(400)}\n`;
        writeFileSync(join(repo, 'a.md'), long, 'utf-8');
        writeFileSync(join(repo, 'b.md'), long.replace('x', 'y'), 'utf-8');
        writeFileSync(join(repo, 'c.md'), long.replace('x', 'z'), 'utf-8');
        git('add', '-A');
        git('commit', '--quiet', '-m', 'add tracked files');
        git('branch', '-f', 'base', 'HEAD');

        renameSync(join(repo, 'a.md'), join(repo, 'moved.md'));
        writeBaseline('src/config/allow.json', ['moved.md', 'b.md', 'c.md']);
        git('add', '-A');
        git('commit', '--quiet', '-m', 'rename a.md -> moved.md');

        const c = assertNoNewEntries(opts());
        expect(c.verdict).toBe('ok');
        expect(c.renamed).toEqual([{ from: 'a.md', to: 'moved.md' }]);
        expect(c.added).toEqual([]);
        // A rename must not read as a removal either — the entry still exists.
        expect(c.removed).toEqual([]);
    });
});

describe('the declared-reset path', () => {
    it('reports rather than throws when a reason is declared', () => {
        writeBaseline('src/config/allow.json', {
            [RATCHET_RESET_KEY]: 'linter rewritten; every finding re-classified on the real corpus',
            'a.md': 1,
            'q.md': 1,
        });
        const c = assertNoNewEntries(opts());
        expect(c.verdict).toBe('reset');
        expect(c.added).toEqual(['q.md']);
        expect(describeComparison('allow.json', c)).toContain('RE-BASELINED');
    });

    it('an empty reason is not a reset — it still throws', () => {
        writeBaseline('src/config/allow.json', { [RATCHET_RESET_KEY]: '   ', 'a.md': 1, 'q.md': 1 });
        expect(() => assertNoNewEntries(opts())).toThrow(RatchetGrowthError);
    });
});

describe('the base side is never assumed empty', () => {
    it('throws when the base ref does not resolve', () => {
        expect(() => assertNoNewEntries({ ...opts(), baseRef: 'no-such-ref' })).toThrow(
            BaseRefUnavailableError,
        );
    });

    it('throws when the working-copy baseline is unreadable', () => {
        rmSync(join(repo, 'src/config/allow.json'));
        expect(() => assertNoNewEntries(opts())).toThrow(BaseRefUnavailableError);
    });

    it('REFUSES a baseline absent at base by default — a typo would pass forever', () => {
        writeBaseline('src/config/fresh.json', ['only', 'entries']);
        expect(() => assertNoNewEntries({ ...opts(), baselinePath: 'src/config/fresh.json' })).toThrow(
            BaseRefUnavailableError,
        );
    });

    it('accepts an absent-at-base baseline only on the explicit opt-in', () => {
        writeBaseline('src/config/fresh.json', ['only', 'entries']);
        const c = assertNoNewEntries({
            ...opts(),
            baselinePath: 'src/config/fresh.json',
            allowNewBaseline: true,
        });
        expect(c.verdict).toBe('new_baseline');
        expect(c.baseCount).toBe(0);
        expect(describeComparison('fresh.json', c)).toContain('NEW BASELINE');
    });
});

describe('resolveBaseRef', () => {
    it('prefers an explicit RATCHET_BASE_REF', () => {
        expect(resolveBaseRef(repo, { RATCHET_BASE_REF: 'base' })).toBe('base');
    });

    it('ignores an explicit ref that does not resolve, falling through', () => {
        // The fixture repo is initialised on `main`, which is the last rung.
        expect(resolveBaseRef(repo, { RATCHET_BASE_REF: 'nope' })).toBe('main');
    });

    it('uses GITHUB_BASE_REF when it resolves', () => {
        expect(resolveBaseRef(repo, { GITHUB_BASE_REF: 'base' })).toBe('base');
    });

    it('does NOT take the merge parent outside GitHub Actions', () => {
        // A feature branch that merged main back in has a merge commit at its
        // tip. Taking HEAD^1 there compares the branch against its own previous
        // commit, so every real change reads as growth — observed on the first
        // run of this resolver, hence the fixture.
        git('checkout', '--quiet', '-b', 'side', 'base');
        writeFileSync(join(repo, 'side.txt'), 'side\n', 'utf-8');
        git('add', '-A');
        git('commit', '--quiet', '-m', 'side work');
        git('checkout', '--quiet', 'main');
        writeFileSync(join(repo, 'main.txt'), 'main\n', 'utf-8');
        git('add', '-A');
        git('commit', '--quiet', '-m', 'main work');
        git('merge', '--quiet', '--no-ff', '-m', 'merge side', 'side');

        expect(resolveBaseRef(repo, {})).not.toBe('HEAD^1');
    });

    it('returns null when nothing resolves rather than assuming a base', () => {
        expect(resolveBaseRef(repo, {}, () => ({ ok: false, stdout: '', stderr: '' }))).toBeNull();
    });
});

describe('defaultEntriesOf', () => {
    it('reads an array of strings', () => {
        expect(defaultEntriesOf(['a', 'b'])).toEqual(['a', 'b']);
    });

    it('reads an array of objects by their first identifying field', () => {
        expect(defaultEntriesOf([{ path: 'p.md', line: 3 }, { id: 'x' }])).toEqual(['p.md', 'x']);
    });

    it('reads an object by its keys, excluding the reset marker', () => {
        expect(defaultEntriesOf({ [RATCHET_RESET_KEY]: 'why', a: 1, b: 2 })).toEqual(['a', 'b']);
    });
});

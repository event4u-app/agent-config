import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NO_CONVENTION, runGitConvention } from '../../../src/scripts/_cli/cmd_git_convention.js';
import { MIN_N } from '../../../src/scripts/_lib/git_convention_measure.js';

const made: string[] = [];
const prevHome = process.env.EVENT4U_CONFIG_HOME;

beforeEach(() => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'git-convention-measure-home-'));
    made.push(home);
    process.env.EVENT4U_CONFIG_HOME = home;
});

afterEach(() => {
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
    if (prevHome === undefined) delete process.env.EVENT4U_CONFIG_HOME;
    else process.env.EVENT4U_CONFIG_HOME = prevHome;
});

const git = (cwd: string, ...args: string[]): string =>
    execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function commit(dir: string, subject: string, author = 'a'): void {
    git(dir, '-c', `user.name=${author}`, '-c', `user.email=${author}@example.com`, 'commit', '-q', '--allow-empty', '-m', subject);
}

/** A repository whose history, oldest first, is `subjects`; `author(i)` names who wrote each. */
function repo(subjects: string[], author: (i: number) => string = () => 'a'): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'git-convention-measure-')));
    made.push(dir);
    git(dir, 'init', '-q', '-b', 'main');
    subjects.forEach((s, i) => commit(dir, s, author(i)));
    return dir;
}

interface Measured {
    convention_established: boolean | null;
    sample: { eligible: number; capped: boolean; capped_total: number };
    verdict: { established: string | null; reasons: string[]; strongest: string[] };
    branches: { sampled: number; pattern: string | null };
    update_style: { adopted: boolean };
    team_file: string | null;
    card: string | null;
}

function measure(dir: string, ...args: string[]): Measured {
    const r = runGitConvention(['measure', '--json', ...args], dir);
    expect(r.code).toBe(0);
    return JSON.parse(r.out.join('\n')) as Measured;
}

describe('git:convention measure', () => {
    it('proposes a clearly dominant family and its team-file line', () => {
        const dir = repo(Array.from({ length: 40 }, (_, i) => `DEV-${i + 1} feat(api): change ${i}`), (i) => `dev${i % 3}`);
        const m = measure(dir);
        expect(m.convention_established).toBe(false);
        expect(m.verdict.established).toBe('ticket-conventional');
        expect(m.team_file).toBe('git:\n  commit_format: ticket-conventional\n');
        expect(m.update_style.adopted).toBe(false);
    });

    it('stays below the bar on a mixed history and offers the two strongest families', () => {
        const dir = repo(Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? `feat: add ${i}` : `[DEV-${i + 1}] Add ${i}`)), (i) => `dev${i % 3}`);
        const m = measure(dir);
        expect(m.verdict.established).toBeNull();
        expect([...m.verdict.strongest].sort()).toEqual(['conventional', 'ticket-prefix']);
        expect(m.team_file).toBeNull();
        const text = runGitConvention(['measure'], dir).out.join('\n');
        expect(text).toContain('below the bar');
    });

    it('never proposes a family on a tiny history', () => {
        const m = measure(repo(Array.from({ length: 5 }, (_, i) => `feat: add ${i}`)));
        expect(m.sample.eligible).toBe(5);
        expect(m.verdict.established).toBeNull();
        expect(m.verdict.reasons.join(' ')).toContain(`< ${MIN_N}`);
    });

    it('caps a prolific author so their history alone cannot set the family', () => {
        const subjects = [
            ...Array.from({ length: 20 }, (_, i) => `fix: old ${i}`),
            ...Array.from({ length: 50 }, (_, i) => `[DEV-${i + 1}] Change ${i}`),
            ...Array.from({ length: 20 }, (_, i) => `fix: new ${i}`),
        ];
        const dir = repo(subjects, (i) => (i >= 20 && i < 70 ? 'prolific' : `dev${i % 3}`));
        const m = measure(dir);
        expect(m.sample.capped).toBe(true);
        expect(m.sample.capped_total).toBeLessThan(m.sample.eligible);
        expect(m.verdict.established).not.toBe('ticket-prefix');
    });

    it('proposes a branch_pattern from the remote branch names, excluding HEAD and the default branch', () => {
        const dir = repo(Array.from({ length: 3 }, (_, i) => `feat: ${i}`));
        const sha = git(dir, 'rev-parse', 'HEAD').trim();
        git(dir, 'update-ref', 'refs/remotes/origin/main', sha);
        git(dir, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');
        for (let i = 1; i <= 11; i++) git(dir, 'update-ref', `refs/remotes/origin/DEV-${i}-thing`, sha);
        const m = measure(dir);
        expect(m.branches.sampled).toBe(11);
        expect(m.branches.pattern).toBe('{ticket}-{slug}');
        expect(m.team_file).toBe('git:\n  branch_pattern: "{ticket}-{slug}"\n');
        expect(m.team_file).not.toContain('update_strategy');
    });

    it('renders the team file and the card for the family the user chose', () => {
        const dir = repo(Array.from({ length: 5 }, (_, i) => `feat: add ${i}`));
        const m = measure(dir, '--family', 'conventional');
        expect(m.team_file).toBe('git:\n  commit_format: ticket-scope\n');
        expect(m.card).toContain('dominant_family: conventional');
        expect(runGitConvention(['measure', '--family', 'nope'], dir).code).toBe(2);
        expect(runGitConvention(['measure', '--limit', '0'], dir).code).toBe(2);
    });
});

describe('the no-convention line', () => {
    it('show and subject report it with neither a declaration nor an approved card', () => {
        const dir = repo(['feat: seed']);
        const show = runGitConvention(['show', '--key', 'commit_format'], dir);
        expect(show.code).toBe(0);
        expect(show.out).toContain(NO_CONVENTION);
        expect(JSON.parse(runGitConvention(['show', '--json'], dir).out.join('\n')).convention_established).toBe(false);
        const subject = runGitConvention(['subject'], dir, 'feat: x\n');
        expect(subject.code).toBe(0);
        expect(subject.out).toContain(NO_CONVENTION);
        expect(JSON.parse(runGitConvention(['subject', '--json'], dir, 'feat: x\n').out.join('\n')).convention_established).toBe(false);
    });

    it('stays silent once an approved card exists', () => {
        const dir = repo(['feat: seed']);
        fs.mkdirSync(path.join(dir, 'agents/memory/curated/conventions/approved'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'agents/memory/curated/conventions/approved/commit-subject.md'), '---\ndominant_family: conventional\n---\n');
        expect(runGitConvention(['show'], dir).out).not.toContain(NO_CONVENTION);
        expect(runGitConvention(['subject'], dir, 'feat: x\n').out).not.toContain(NO_CONVENTION);
    });

    it('stays silent under a committed declaration of the default value', () => {
        const dir = repo(['feat: seed']);
        fs.writeFileSync(path.join(dir, '.git-convention.yml'), 'git:\n  commit_format: ticket-scope\n');
        git(dir, 'add', '.git-convention.yml');
        commit(dir, 'chore: declare');
        expect(runGitConvention(['show'], dir).out).not.toContain(NO_CONVENTION);
    });
});

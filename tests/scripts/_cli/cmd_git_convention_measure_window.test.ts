/**
 * `measure` on histories the plain 24-month window misreads: one whose every
 * commit is older (the window samples nothing), and the card `--family` prints,
 * which the approved-card reader has to recognise when it is saved as printed.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APPROVED_CARD, NO_CONVENTION, runGitConvention } from '../../../src/scripts/_cli/cmd_git_convention.js';
import { MIN_N } from '../../../src/scripts/_lib/git_convention_measure.js';

const made: string[] = [];
const prevHome = process.env.EVENT4U_CONFIG_HOME;

beforeEach(() => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'git-convention-window-home-'));
    made.push(home);
    process.env.EVENT4U_CONFIG_HOME = home;
});

afterEach(() => {
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
    if (prevHome === undefined) delete process.env.EVENT4U_CONFIG_HOME;
    else process.env.EVENT4U_CONFIG_HOME = prevHome;
});

const git = (cwd: string, args: string[], env: Record<string, string> = {}): string =>
    execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });

/** `subjects` oldest first, every commit dated `date`. */
function repo(subjects: string[], date: string | null): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'git-convention-window-')));
    made.push(dir);
    git(dir, ['init', '-q', '-b', 'main']);
    const env = date === null ? {} : { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
    subjects.forEach((s, i) => git(dir, ['-c', `user.name=dev${i % 3}`, '-c', `user.email=dev${i % 3}@example.com`, 'commit', '-q', '--allow-empty', '-m', s], env));
    git(dir, ['update-ref', 'refs/remotes/origin/main', git(dir, ['rev-parse', 'HEAD']).trim()]);
    git(dir, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main']);
    return dir;
}

const conventional = (n: number): string[] => Array.from({ length: n }, (_, i) => `feat: change ${i}`);

describe('measure when the 24-month window yields too few commits', () => {
    it('samples the newest commits regardless of age and says so', () => {
        const dir = repo(conventional(40), '2020-01-01T00:00:00Z');
        const r = runGitConvention(['measure', '--json'], dir);
        expect(r.code).toBe(0);
        const m = JSON.parse(r.out.join('\n')) as { sample: { read: number; window_extended: boolean }; verdict: { established: string | null } };
        expect(m.sample.read).toBe(40);
        expect(m.sample.window_extended).toBe(true);
        expect(m.verdict.established).toBe('conventional');
        const text = runGitConvention(['measure'], dir).out.join('\n');
        expect(text).toMatch(/fewer than 30 since 24 months ago — sampled the newest 40 regardless of age/);
    });

    it('keeps the window when it yields enough', () => {
        const dir = repo(conventional(MIN_N + 2), null);
        const m = JSON.parse(runGitConvention(['measure', '--json'], dir).out.join('\n')) as { sample: { window_extended: boolean } };
        expect(m.sample.window_extended).toBe(false);
    });
});

describe('the card measure --family prints', () => {
    it('is recognised by show when saved exactly as printed', () => {
        const dir = repo(conventional(40), null);
        const out = runGitConvention(['measure', '--family', 'conventional'], dir).out;
        const at = out.findIndex((l) => l.startsWith('card '));
        expect(at).toBeGreaterThan(-1);
        const card = out.slice(at + 1).join('\n');
        expect(card.startsWith('---\n')).toBe(true);
        fs.mkdirSync(path.dirname(path.join(dir, APPROVED_CARD)), { recursive: true });
        fs.writeFileSync(path.join(dir, APPROVED_CARD), `${card}\n`);
        const show = runGitConvention(['show', '--key', 'commit_format'], dir).out.join('\n');
        expect(show).not.toContain(NO_CONVENTION);
    });

    it('is recognised by show when saved with the two-space indent older output carried', () => {
        const dir = repo(conventional(40), null);
        fs.mkdirSync(path.dirname(path.join(dir, APPROVED_CARD)), { recursive: true });
        fs.writeFileSync(path.join(dir, APPROVED_CARD), '  ---\n  dominant_family: conventional\n  ---\n');
        expect(runGitConvention(['show', '--key', 'commit_format'], dir).out.join('\n')).not.toContain(NO_CONVENTION);
    });
});

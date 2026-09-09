/**
 * `changedFiles` refuses an option-shaped rev (14.23.0 finding 549923656232).
 *
 * The finding claimed shell command injection; there is no shell, so that half
 * is refuted here by a positive control. What IS reachable is option injection:
 * the rev is concatenated into `<ref>..HEAD`, and `--output=/tmp/x..HEAD` is a
 * well-formed `git diff` option whose value is a filename — git writes it and
 * exits 0, so the call returned a file list rather than a refusal. The guard is
 * one line, so its sensitivity is the whole test: neutralise the `startsWith`
 * check and the first case below writes the file and stops returning null.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { changedFiles } from '../../src/scripts/code_graph/cli.js';

let repo: string;

beforeAll(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-rev-guard-'));
    const git = (...args: string[]): void => {
        execFileSync('git', ['-C', repo, ...args], { stdio: 'ignore' });
    };
    git('init', '-q', '.');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'test');
    fs.writeFileSync(path.join(repo, 'a.txt'), 'one\n');
    git('add', 'a.txt');
    git('commit', '-qm', 'first');
    fs.writeFileSync(path.join(repo, 'a.txt'), 'two\n');
    git('add', 'a.txt');
    git('commit', '-qm', 'second');
});

describe('changedFiles — an option-shaped rev is refused before git runs', () => {
    it('does not let --output write a file, and returns null', () => {
        const target = path.join(repo, 'PWNED..HEAD');
        expect(changedFiles(repo, `--output=${path.join(repo, 'PWNED')}`)).toBeNull();
        expect(fs.existsSync(target)).toBe(false);
    });

    it('refuses every option-shaped rev, not only --output', () => {
        for (const ref of ['--help', '-p', '--exit-code', '--stat']) {
            expect(changedFiles(repo, ref)).toBeNull();
        }
    });

    it('a shell metacharacter in a rev is inert, never executed', () => {
        const planted = path.join(os.tmpdir(), 'cg-rev-guard-should-not-exist');
        expect(changedFiles(repo, `$(touch ${planted})`)).toBeNull();
        expect(fs.existsSync(planted)).toBe(false);
    });

    it('still resolves a legitimate rev', () => {
        expect(changedFiles(repo, 'HEAD~1')).toEqual(['a.txt']);
    });
});

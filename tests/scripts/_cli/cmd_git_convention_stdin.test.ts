/**
 * `git:convention subject` reads stdin to EOF as a real process does.
 *
 * A synchronous read of fd 0 gave up on a pipe that had no data yet: a writer
 * that started late, or a long batch of subjects, came back as
 * "no subjects on stdin", exit 2 — the exit the reference reads as "the verb
 * cannot run", so the caller fell back to validating by reading. The unit
 * suites hand the subjects in as a string and never touch fd 0.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TSX = path.join(REPO, 'node_modules', '.bin', 'tsx');
const CLI = path.join(REPO, 'src', 'scripts', '_cli', 'cmd_git_convention.ts');

function run(pipeline: string): { status: number | null; out: string } {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gitconv-stdin-home-'));
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gitconv-stdin-repo-'));
    spawnSync('git', ['init', '-q', '-b', 'main', cwd]);
    const r = spawnSync('sh', ['-c', `${pipeline} | "${TSX}" "${CLI}" subject --family conventional`], {
        cwd,
        encoding: 'utf-8',
        env: { ...process.env, HOME: home, EVENT4U_CONFIG_HOME: home, GIT_CONFIG_GLOBAL: '/dev/null' },
        timeout: 60_000,
    });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

describe('git:convention subject reads all of stdin', () => {
    it('waits for a writer that starts late', () => {
        const r = run(`(sleep 2; echo 'feat: add export')`);
        expect(r.out).not.toContain('no subjects on stdin');
        expect(r.out).toContain('1 subject(s) valid');
        expect(r.status).toBe(0);
    }, 90_000);

    it('reads a batch larger than one pipe buffer', () => {
        const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gitconv-stdin-')), 'subjects.txt');
        const lines = Array.from({ length: 1200 }, (_, i) => `feat: add subject line number ${String(i)} for volume testing of the stdin reader path`);
        fs.writeFileSync(file, `${lines.join('\n')}\n`);
        expect(fs.statSync(file).size).toBeGreaterThan(65_536);
        const r = run(`cat "${file}"`);
        expect(r.out).toContain('1200 subject(s) valid');
        expect(r.status).toBe(0);
    }, 90_000);

    it('still treats an empty stdin as a usage error, named so it is not read as an unavailable verb', () => {
        const r = run(':');
        expect(r.status).toBe(2);
        expect(r.out).toContain('no subjects on stdin');
        expect(r.out).toContain('the verb ran');
    }, 90_000);
});

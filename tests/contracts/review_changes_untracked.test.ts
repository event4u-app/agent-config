/**
 * `/review:changes` step 2 diffs untracked files by default (owner decision
 * OQ-62, E9, 2026-11-02). Before that the step only LISTED them, so a review of
 * a branch whose new module had not been `git add`-ed yet judged a diff that did
 * not contain the module: a false green with the reviewer's name on it.
 *
 * The step carries its procedure as one fenced `bash` block. This test does not
 * assert the prose — it EXTRACTS that block and RUNS it in a throwaway repo
 * holding one small text file, one binary, one file over the cap and one
 * gitignored file, then checks what the reviewer would actually be shown.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMMAND = join(REPO_ROOT, 'src/domains/engineering-base/review/changes/command.md');

function gatherSection(): string {
    const raw = fs.readFileSync(COMMAND, 'utf8');
    const start = raw.indexOf('### 2. Gather the diff');
    const end = raw.indexOf('\n### 3.', start);
    expect(start, 'step 2 heading present').toBeGreaterThanOrEqual(0);
    return raw.slice(start, end);
}

function untrackedScript(): string {
    const m = /```bash\n([\s\S]*?ls-files --others --exclude-standard[\s\S]*?)```/.exec(gatherSection());
    expect(m, 'step 2 carries the untracked-file procedure as a bash block').not.toBeNull();
    return (m as RegExpExecArray)[1] as string;
}

describe('review/changes step 2 — the stated contract', () => {
    it('no longer tells the reviewer to skip untracked content', () => {
        expect(gatherSection()).not.toMatch(/do not diff them by default/);
    });

    it('states the cap in the prose, not only in the script', () => {
        expect(gatherSection()).toMatch(/100 KB/);
    });
});

describe('review/changes step 2 — the procedure, run', () => {
    let work: string;
    const run = (cmd: string, args: string[]) => spawnSync(cmd, args, { cwd: work, encoding: 'utf8' });

    beforeEach(() => {
        work = fs.realpathSync(fs.mkdtempSync(join(os.tmpdir(), 'review-untracked-')));
        run('git', ['init', '-q']);
        fs.writeFileSync(join(work, '.gitignore'), 'ignored.txt\n');
        fs.writeFileSync(join(work, 'tracked.txt'), 'tracked\n');
        run('git', ['add', '-A']);
        run('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-qm', 'init']);
        fs.writeFileSync(join(work, 'new module.ts'), 'export const answer = 42;\n');
        fs.writeFileSync(join(work, 'blob.bin'), Buffer.from([0, 1, 2, 0, 255, 0]));
        fs.writeFileSync(join(work, 'huge.txt'), 'x'.repeat(102_401));
        fs.writeFileSync(join(work, 'ignored.txt'), 'secret-looking content\n');
    });

    afterEach(() => {
        fs.rmSync(work, { recursive: true, force: true });
    });

    it('diffs a small text file as an added file, including a name with a space', () => {
        const r = run('bash', ['-c', untrackedScript()]);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toContain('new file mode');
        expect(r.stdout).toContain('+export const answer = 42;');
    });

    it('lists — never diffs — a binary and an over-cap file, naming the reason', () => {
        const r = run('bash', ['-c', untrackedScript()]);
        expect(r.stdout).toMatch(/untracked, not diffed \(binary\): blob\.bin/);
        expect(r.stdout).toMatch(/untracked, not diffed \(over the 100 KB cap, 102401 bytes\): huge\.txt/);
        expect(r.stdout).not.toContain('x'.repeat(200));
    });

    it('respects .gitignore', () => {
        const r = run('bash', ['-c', untrackedScript()]);
        expect(r.stdout).not.toContain('ignored.txt');
        expect(r.stdout).not.toContain('secret-looking content');
    });
});

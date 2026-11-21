import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pushedBranch } from '../../src/scripts/hooks/push_settle_hook.js';
import { pushedBranchFromReport, pushSections } from '../../src/scripts/_lib/push_report.js';

/**
 * Real git output from a temp bare remote, not hand-written tables: the defect
 * is that two git commands print the same ref line under different headers,
 * so the fixture must be what git prints.
 */
const ENV = {
    ...process.env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
    LC_ALL: 'C',
};

function git(cwd: string, ...args: string[]): string {
    const r = spawnSync(
        'git',
        ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'core.hooksPath=/dev/null', '-c', 'init.defaultBranch=main', ...args],
        { cwd, env: ENV, encoding: 'utf8' },
    );
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
    return `${r.stdout}${r.stderr}`;
}

function commit(cwd: string, file: string): void {
    fs.writeFileSync(path.join(cwd, file), `${file}\n`);
    git(cwd, 'add', file);
    git(cwd, 'commit', '-q', '-m', file);
}

let root = '';
const out: Record<'fetch' | 'pull' | 'push' | 'combined', string> = { fetch: '', pull: '', push: '', combined: '' };

beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'push-report-'));
    const remote = path.join(root, 'remote.git');
    const a = path.join(root, 'a');
    const b = path.join(root, 'b');
    git(root, 'init', '-q', '--bare', remote);
    git(root, 'clone', '-q', remote, a);
    commit(a, 'one');
    git(a, 'push', '-q', 'origin', 'main');
    git(root, 'clone', '-q', remote, b);

    // A moves main and adds a branch; B fetches both.
    commit(a, 'two');
    git(a, 'push', '-q', 'origin', 'main');
    git(a, 'checkout', '-q', '-b', 'feat/x');
    commit(a, 'three');
    git(a, 'push', '-q', 'origin', 'feat/x');
    out.fetch = git(b, 'fetch', 'origin');

    commit(a, 'four');
    git(a, 'push', '-q', 'origin', 'feat/x');
    git(b, 'checkout', '-q', 'feat/x');
    out.pull = git(b, 'pull', '--ff-only', 'origin', 'feat/x');

    commit(b, 'five');
    out.push = git(b, 'push', 'origin', 'feat/x');

    git(a, 'checkout', '-q', 'main');
    commit(a, 'six');
    git(a, 'push', '-q', 'origin', 'main');
    git(b, 'checkout', '-q', 'main');
    const fetched = git(b, 'fetch', 'origin');
    git(b, 'merge', '-q', '--ff-only', 'origin/main');
    commit(b, 'seven');
    out.combined = `${fetched}${git(b, 'push', 'origin', 'main')}`;
});

afterAll(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true });
});

describe('fetch is not a push', () => {
    it('captured real fetch and push reports with their headers', () => {
        expect(out.fetch).toMatch(/^From /m);
        expect(out.fetch).toMatch(/->\s+origin\/main/);
        expect(out.push).toMatch(/^To /m);
        expect(out.combined).toMatch(/^From [\s\S]*^To /m);
    });

    it('a fetch or a pull report names no pushed branch', () => {
        expect(pushedBranchFromReport(out.fetch)).toBeNull();
        expect(pushedBranchFromReport(out.pull)).toBeNull();
        expect(pushSections(out.fetch)).toEqual([]);
    });

    it('a push, alone or after a fetch in the same run, names its branch', () => {
        expect(pushedBranchFromReport(out.push)).toBe('feat/x');
        expect(pushedBranchFromReport(out.combined)).toBe('main');
    });

    it('a rejected push names nothing', () => {
        const rejected = 'To /tmp/remote.git\n ! [rejected]        main -> main (fetch first)\n';
        expect(pushedBranchFromReport(rejected)).toBeNull();
    });

    it('characterises the unwired live reader, which still reads the fetch as a push', () => {
        expect(pushedBranch(out.fetch)).not.toBeNull();
    });
});

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { recordParent } from '../../../src/scripts/_lib/branch_parents.js';
import { gcBranches, indexBranch, readManifest } from '../../../src/scripts/code_graph/branches.js';

let root: string;
let build: string;
const git = (...args: string[]): string => execFileSync('git', args, { cwd: root, encoding: 'utf-8', env: { ...process.env, GIT_AUTHOR_NAME: 'Dev', GIT_AUTHOR_EMAIL: 'd@example.com', GIT_COMMITTER_NAME: 'Dev', GIT_COMMITTER_EMAIL: 'd@example.com' } });
const w = (rel: string, body: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
};

beforeAll(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-delta-base-')));
    git('init', '-q', '-b', 'main');
    w('src/a.ts', 'export const a = 1;\n');
    w('src/b.ts', 'export const b = 1;\n');
    git('add', '.');
    git('commit', '-qm', 'init');
    git('checkout', '-qb', 'feat');
    w('src/a.ts', 'export const a = 2;\n');
    git('commit', '-qam', 'feat');
    git('checkout', '-q', 'main');
    build = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-delta-build-'));
});
afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(build, { recursive: true, force: true });
});

describe('a delta manifest keeps the base it was diffed from (7.3)', () => {
    it('the child still reads its own blob after the parent changes a file and is re-indexed', async () => {
        await indexBranch(root, build, 'main', { day: '2026-10-01' });
        await indexBranch(root, build, 'feat', { day: '2026-10-01' });
        const own = git('rev-parse', 'feat:src/b.ts').trim();
        expect(readManifest(build, 'feat')!.files['src/b.ts']).toBe(own);

        w('src/b.ts', 'export const b = 99;\n');
        git('commit', '-qam', 'parent moves on');
        await indexBranch(root, build, 'main', { day: '2026-10-02' });

        expect(readManifest(build, 'main')!.files['src/b.ts']).not.toBe(own);
        const child = readManifest(build, 'feat')!;
        expect(child.files['src/b.ts']).toBe(own);
        expect(child.files['src/a.ts']).toBe(git('rev-parse', 'feat:src/a.ts').trim());
    }, 60_000);

    it('gc rewriting a child whole, after its re-indexed parent is gone, keeps the child its own blobs', async () => {
        git('branch', '-q', 'mid', 'main');
        git('checkout', '-q', 'mid');
        w('src/c.ts', 'export const c = 1;\n');
        git('add', '.');
        git('commit', '-qm', 'mid');
        git('checkout', '-qb', 'leaf');
        w('src/a.ts', 'export const a = 3;\n');
        git('commit', '-qam', 'leaf');
        git('checkout', '-q', 'main');
        recordParent(root, 'leaf', 'mid');
        await indexBranch(root, build, 'mid', { day: '2026-10-02' });
        await indexBranch(root, build, 'leaf', { day: '2026-10-02' });
        const own = git('rev-parse', 'leaf:src/c.ts').trim();
        git('checkout', '-q', 'mid');
        w('src/c.ts', 'export const c = 2;\n');
        git('commit', '-qam', 'mid moves on');
        git('checkout', '-q', 'main');
        await indexBranch(root, build, 'mid', { day: '2026-10-02' });
        git('branch', '-q', '-D', 'mid');
        const r = gcBranches(root, build, { day: '2026-10-03', now: Date.now() + 3_600_000 });
        expect(r.dropped.map((x) => x.ref)).toContain('mid');
        const leaf = readManifest(build, 'leaf')!;
        expect(leaf.files['src/c.ts']).toBe(own);
        expect(leaf.parent).toBeUndefined();
    }, 60_000);
});

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { gcBranches, indexBranch, listManifests, pinBranch, readManifest, storeDir } from '../../src/scripts/code_graph/branches.js';

let root: string;
let remote: string;
let build: string;
const git = (...args: string[]): string => execFileSync('git', args, { cwd: root, encoding: 'utf-8', env: { ...process.env, GIT_AUTHOR_NAME: 'Dev', GIT_AUTHOR_EMAIL: 'd@example.com', GIT_COMMITTER_NAME: 'Dev', GIT_COMMITTER_EMAIL: 'd@example.com' } });
const w = (rel: string, body: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
};

beforeAll(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-gc-')));
    remote = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-gc-remote-')));
    execFileSync('git', ['init', '-q', '--bare', remote]);
    git('init', '-q', '-b', 'main');
    for (let i = 0; i < 30; i++) w(`src/f${i}.ts`, `export const v${i} = ${i};\n`);
    git('add', '.');
    git('commit', '-qm', 'init');
    git('remote', 'add', 'origin', remote);
    git('checkout', '-qb', 'feat-remote');
    w('src/f1.ts', 'export const v1 = 100;\n');
    git('commit', '-qam', 'remote feature');
    git('push', '-q', 'origin', 'feat-remote');
    git('checkout', '-qb', 'feat-pinned');
    git('checkout', '-q', 'main');
    build = path.join(root, '.cache');
});
afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(remote, { recursive: true, force: true });
});

describe('branches clean themselves (7.3, H16)', () => {
    it('stores a branch as a delta against its parent and reads it back whole', async () => {
        await indexBranch(root, build, 'main', { day: '2026-10-01' });
        await indexBranch(root, build, 'feat-remote', { day: '2026-10-01' });
        const raw = JSON.parse(fs.readFileSync(path.join(storeDir(build), 'manifests', 'feat-remote.json'), 'utf-8'));
        expect(raw.parent).toBe('main');
        expect(Object.keys(raw.delta.set)).toEqual(['src/f1.ts']);
        expect(raw.files).toBeUndefined();
        const m = readManifest(build, 'feat-remote')!;
        expect(Object.keys(m.files)).toHaveLength(30);
        expect(m.files['src/f1.ts']).not.toBe(readManifest(build, 'main')!.files['src/f1.ts']);
    }, 60_000);

    it('lets a remote-tracking branch expire unless it is pinned', async () => {
        await indexBranch(root, build, 'feat-pinned', { day: '2026-10-01' });
        pinBranch(build, 'feat-pinned');
        const r = gcBranches(root, build, { day: '2026-11-15', now: Date.now() + 3_600_000 });
        expect(r.dropped.map((x) => x.ref)).toEqual(['feat-remote']);
        expect(r.kept.map((x) => `${x.ref}: ${x.why}`).sort()).toEqual(['feat-pinned: pinned', 'main: default branch']);
    }, 60_000);

    it('stops inside its time budget and says so', () => {
        const r = gcBranches(root, build, { budgetMs: 0 });
        expect(r.bounded).toBe(true);
    });

    it('runs inside refresh', () => {
        const out = execFileSync(path.resolve(__dirname, '../../scripts-run'), ['src/scripts/code_graph/cli', 'refresh', '--root', root, '--out', path.join(build, 'code-graph-v1.json')], { encoding: 'utf-8' });
        expect(out).toMatch(/branch gc: \d+ dropped/);
        expect(listManifests(build).map((m) => m.ref).sort()).toEqual(['feat-pinned', 'main']);
    }, 120_000);
});

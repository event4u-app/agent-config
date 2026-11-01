import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';
import { keepMapLocal, MAP_IGNORE_LINES } from '../../src/scripts/code_graph/map_local.js';
import { ensureViewer } from '../../src/scripts/code_graph/map_viewer_file.js';

let root: string;
let mapDir: string;

function git(...args: string[]): string {
    return execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: root, encoding: 'utf-8' });
}

function write(rel: string, body: string): void {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
}

const tracked = (): string[] => git('ls-files', 'agents/map').split('\n').filter(Boolean);
const staged = (): string => git('diff', '--cached', '--name-status').trim();

/** A repository as an older release left it: map committed, viewer page included, no ignore for it. */
async function olderReleaseRepo(): Promise<void> {
    write('.gitignore', '/agents/map/.build/\n');
    write('src/a.ts', 'export const a = 1;\n');
    write('src/b.ts', "import { a } from './a.js';\nexport const b = a;\n");
    git('init', '-q');
    git('add', '-A');
    git('commit', '-qm', 'init');
    await buildMap(root);
    fs.rmSync(path.join(mapDir, '.gitignore'));
    git('add', '-A');
    git('commit', '-qm', 'map with its viewer page');
}

beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-local-')));
    mapDir = path.join(root, 'agents', 'map');
    fs.mkdirSync(path.join(root, 'agents'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('an existing repository keeps the viewer page out of git on its own (ADR-297 amendment 2)', () => {
    it('a tracked viewer page is unstaged from the index, stays on disk, and the folder ignores it', async () => {
        await olderReleaseRepo();
        expect(tracked()).toContain('agents/map/index.html');
        const out = keepMapLocal(mapDir);
        expect(out).toEqual({ ignore: 'written', untracked: true });
        expect(tracked()).not.toContain('agents/map/index.html');
        expect(fs.existsSync(path.join(mapDir, 'index.html'))).toBe(true);
        expect(staged()).toBe('D\tagents/map/index.html');
        expect(git('status', '--porcelain', '--', 'agents/map/index.html').trim()).toBe('D  agents/map/index.html');
        expect(git('check-ignore', '--no-index', 'agents/map/index.html', 'agents/map/.build/x').trim().split('\n')).toHaveLength(2);
        expect(keepMapLocal(mapDir)).toEqual({ ignore: 'present', untracked: false });
    });

    it('a refresh path does it: rendering the viewer runs the upkeep first', async () => {
        await olderReleaseRepo();
        ensureViewer(mapDir);
        expect(tracked()).not.toContain('agents/map/index.html');
    });

    it('a redraw does it too, and nothing is committed', async () => {
        await olderReleaseRepo();
        const head = git('rev-parse', 'HEAD');
        await buildMap(root);
        expect(tracked()).not.toContain('agents/map/index.html');
        expect(git('rev-parse', 'HEAD')).toBe(head);
    });

    it("the user's own lines in the folder's .gitignore stay; only missing lines are appended, once", async () => {
        await olderReleaseRepo();
        fs.writeFileSync(path.join(mapDir, '.gitignore'), 'notes/\n/.build/');
        keepMapLocal(mapDir);
        keepMapLocal(mapDir);
        const lines = fs.readFileSync(path.join(mapDir, '.gitignore'), 'utf-8').split('\n').filter(Boolean);
        expect(lines).toEqual(['notes/', '/.build/', '/index.html']);
        for (const l of MAP_IGNORE_LINES) expect(lines.filter((x) => x === l)).toHaveLength(1);
    });

    it('during a merge nothing is staged; the next run after it does it', async () => {
        await olderReleaseRepo();
        const merge = path.join(root, '.git', 'MERGE_HEAD');
        fs.writeFileSync(merge, `${git('rev-parse', 'HEAD').trim()}\n`);
        expect(keepMapLocal(mapDir).untracked).toBe(false);
        expect(tracked()).toContain('agents/map/index.html');
        fs.rmSync(merge);
        expect(keepMapLocal(mapDir).untracked).toBe(true);
    });

    it('a folder outside any git work tree is left alone', async () => {
        fs.mkdirSync(mapDir, { recursive: true });
        fs.writeFileSync(path.join(mapDir, 'index.html'), '<!doctype html>');
        expect(keepMapLocal(mapDir)).toEqual({ ignore: 'skipped', untracked: false });
        expect(fs.existsSync(path.join(mapDir, '.gitignore'))).toBe(false);
    });

    it('a symlinked map folder is never written through', async () => {
        await olderReleaseRepo();
        const elsewhere = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-local-target-')));
        try {
            fs.rmSync(mapDir, { recursive: true });
            fs.symlinkSync(elsewhere, mapDir);
            expect(keepMapLocal(mapDir).ignore).toBe('skipped');
            expect(fs.existsSync(path.join(elsewhere, '.gitignore'))).toBe(false);
        } finally {
            fs.rmSync(elsewhere, { recursive: true, force: true });
        }
    });
});

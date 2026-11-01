import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { windowLog } from '../../src/scripts/code_graph/git_window.js';
import { readHistory } from '../../src/scripts/code_graph/lanes/history/history.js';
import { readGitHistory } from '../../src/scripts/code_graph/map_answers.js';

let root: string;
let build: string;

function git(...args: string[]): string {
    return execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=Ann', ...args], { cwd: root, encoding: 'utf-8' });
}

function commit(files: Record<string, string>, msg: string): void {
    for (const [rel, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body);
    }
    git('add', '-A');
    git('commit', '-qm', msg);
}

/** A git that counts the history walks it is asked for. */
function countingGit(): { git: (args: readonly string[]) => string; walks: () => number } {
    let walks = 0;
    return {
        git: (args) => {
            if (args.includes('--name-status')) walks++;
            return execFileSync('git', [...args], { cwd: root, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
        },
        walks: () => walks,
    };
}

beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-window-')));
    build = path.join(root, 'agents', 'map', '.build');
    fs.mkdirSync(build, { recursive: true });
    fs.writeFileSync(path.join(root, '.gitignore'), '/agents/map/.build/\n');
    git('init', '-q');
    for (let i = 0; i < 3; i++) commit({ 'a.ts': `a${i}`, 'b.ts': `b${i}` }, `pair ${i}`);
    commit({ 'c.ts': 'c' }, 'single');
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('one history window per HEAD, shared by the history lane and the map', () => {
    it('a second read at the same HEAD walks no history', () => {
        const g = countingGit();
        const first = windowLog(root, 180, { git: g.git });
        const second = windowLog(root, 180, { git: g.git });
        expect(g.walks()).toBe(1);
        expect(second).toEqual(first);
        expect('log' in first && first.log).toContain('a.ts');
    });

    it('a new commit, or another window length, walks it again', () => {
        const g = countingGit();
        windowLog(root, 180, { git: g.git });
        windowLog(root, 30, { git: g.git });
        expect(g.walks()).toBe(2);
        commit({ 'c.ts': 'c2' }, 'next');
        const after = windowLog(root, 30, { git: g.git });
        expect(g.walks()).toBe(3);
        expect('log' in after && after.log.match(/c\.ts/g)?.length).toBe(2);
    });

    it('without a graph build folder nothing is kept and nothing is created', () => {
        fs.rmSync(path.join(root, 'agents'), { recursive: true });
        const g = countingGit();
        windowLog(root, 180, { git: g.git });
        windowLog(root, 180, { git: g.git });
        expect(g.walks()).toBe(2);
        expect(fs.existsSync(path.join(root, 'agents'))).toBe(false);
    });

    it('the lane and the map read the same commits from the one kept pass', () => {
        const lane = readHistory(root, { min_co_changes: 3, min_strength: 0.5 });
        expect(fs.existsSync(path.join(build, 'history-window.log'))).toBe(true);
        const pair = lane.relations.find((r) => r.relation === 'co-changes');
        expect([pair?.from, pair?.to].sort()).toEqual(['a.ts', 'b.ts']);
        const facts = readGitHistory(root);
        expect(facts?.get('a.ts')?.churn).toBe(3);
        expect(facts?.get('c.ts')?.owners).toEqual([['Ann', 1]]);
    });

    it('names why it cannot read: outside a repository, and in a shallow clone', () => {
        const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-window-none-'));
        try {
            expect(windowLog(outside, 180, { cacheDir: null })).toEqual({ skip: 'not a git repository or no commits' });
        } finally {
            fs.rmSync(outside, { recursive: true, force: true });
        }
        const shallow = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-window-shallow-'));
        try {
            execFileSync('git', ['clone', '-q', '--depth', '1', `file://${root}`, shallow], { stdio: 'ignore' });
            expect(windowLog(shallow, 180, { cacheDir: null })).toEqual({ skip: 'shallow clone' });
        } finally {
            fs.rmSync(shallow, { recursive: true, force: true });
        }
    });
});

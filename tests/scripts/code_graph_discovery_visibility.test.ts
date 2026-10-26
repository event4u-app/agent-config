import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { gitVisibleFiles } from '../../src/scripts/_lib/git_visible_files.js';
import { walkFiles } from '../../src/scripts/_lib/infra_files/walk.js';
import { buildGraph, discoverFiles } from '../../src/scripts/code_graph/build.js';
import { extractFile } from '../../src/scripts/code_graph/extract.js';

let root: string;

const write = (rel: string, text: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
};
const git = (...args: string[]): void => {
    execFileSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: root, stdio: 'ignore' });
};
const rels = (abs: string[]): string[] => abs.map((f) => path.relative(root, f).split(path.sep).join('/'));

beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-visible-')));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('file discovery honours .gitignore', () => {
    it('drops ignored files, keeps tracked and untracked ones', () => {
        git('init', '-q');
        write('.gitignore', 'secret-inbox/\n*.local.ts\n');
        write('src/a.ts', 'export const a = 1;\n');
        write('secret-inbox/leak.ts', 'export const leak = 1;\n');
        write('src/b.local.ts', 'export const b = 1;\n');
        git('add', '.gitignore', 'src/a.ts');
        git('commit', '-qm', 'init');
        write('src/new.ts', 'export const n = 1;\n'); // untracked, not ignored

        expect(rels(discoverFiles(root)).sort()).toEqual(['src/a.ts', 'src/new.ts']);
        expect(walkFiles(root, (n) => n.endsWith('.ts')).map((r) => r.split(path.sep).join('/'))).toEqual(['src/a.ts', 'src/new.ts']);
    });

    it('walks everything outside a git work tree', () => {
        write('.gitignore', 'secret-inbox/\n');
        write('secret-inbox/leak.ts', 'export const leak = 1;\n');
        expect(gitVisibleFiles(root)).toBeNull();
        expect(rels(discoverFiles(root))).toEqual(['secret-inbox/leak.ts']);
    });

    it('treats a root the enclosing repository ignores as not answerable', () => {
        git('init', '-q');
        write('.gitignore', 'scratch/\n');
        write('scratch/x.ts', 'export const x = 1;\n');
        expect(gitVisibleFiles(path.join(root, 'scratch'))).toBeNull();
        expect(rels(discoverFiles(path.join(root, 'scratch')))).toEqual(['scratch/x.ts']);
    });
});

describe('an absolute import specifier', () => {
    it('never reaches the graph as a path', async () => {
        const src = "import { run } from '/Users/someone/project/tool.ts';\nexport const r = run;\n";
        const ex = await extractFile('src/a.ts', src, 'typescript');
        const g = buildGraph([{ path: 'src/a.ts', source: src }], [ex]);
        const targets = g.edges.map((e) => e.target).filter((t) => t.startsWith('external:'));
        expect(targets.length).toBeGreaterThan(0);
        expect(targets.every((t) => !t.includes('/Users/'))).toBe(true);
        expect(targets).toContain('external:<absolute>#run');
    });
});

describe('a nested repository git does not track', () => {
    it('is walked as before, its ignore rules aside', () => {
        git('init', '-q');
        write('src/a.ts', 'export const a = 1;\n');
        git('add', 'src/a.ts');
        git('commit', '-qm', 'init');
        write('vendor-repo/x.ts', 'export const x = 1;\n');
        execFileSync('git', ['init', '-q'], { cwd: path.join(root, 'vendor-repo'), stdio: 'ignore' });
        expect(rels(discoverFiles(root)).sort()).toEqual(['src/a.ts', 'vendor-repo/x.ts']);
    });
});

/**
 * H.4 — introducing-commit candidates: last change of each fixed line, format-
 * only commits skipped, renames followed, a declared `Fixes: <sha>` wins.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { changedOldLines, inducersOf } from '../../src/scripts/code_graph/bug_inducers.js';
import { Repo } from './_bugs/repo.js';

let repo: Repo;
let inducer: string;
let whitespace: string;
let renamed: string;
beforeEach(() => {
    repo = new Repo();
    repo.write('src/sum.ts', 'export function sum(a: number, b: number) {\n  return a + b;\n}\n');
    repo.commit('feat: sum');
    repo.write('src/sum.ts', 'export function sum(a: number, b: number) {\n  return a - b;\n}\n');
    inducer = repo.commit('refactor: simplify sum');
    repo.write('src/sum.ts', 'export function sum(a: number, b: number) {\n      return a - b;\n}\n');
    whitespace = repo.commit('style: indent');
    repo.run('mv', 'src/sum.ts', 'src/total.ts');
    renamed = repo.commit('refactor: rename sum file');
});
afterEach(() => repo.cleanup());

describe('changedOldLines', () => {
    it('lists old-side ranges and ignores pure insertions', () => {
        const diff = '--- a/x.ts\n+++ b/x.ts\n@@ -2 +2 @@\n-a\n+b\n@@ -5,0 +6,1 @@\n+c\n--- /dev/null\n+++ b/y.ts\n@@ -0,0 +1 @@\n+d\n';
        expect(changedOldLines(diff)).toEqual([{ file: 'x.ts', start: 2, end: 2 }]);
    });
});

describe('inducersOf', () => {
    it('blames the fixed line past a whitespace-only commit and across a rename', () => {
        repo.write('src/total.ts', 'export function sum(a: number, b: number) {\n      return a + b;\n}\n');
        const fix = repo.commit('fix: sum adds');
        const r = inducersOf(repo.git, fix);
        expect(r.candidates.map((c) => c.sha)).toEqual([inducer]);
        expect(r.candidates[0]).toMatchObject({ method: 'blame', witnesses: [{ file: 'src/total.ts', line: 2 }] });
        for (const notIt of [whitespace, renamed]) expect(r.candidates.map((c) => c.sha)).not.toContain(notIt);
    });

    it('a declared Fixes: <sha> wins over blame', () => {
        repo.write('src/total.ts', 'export function sum(a: number, b: number) {\n      return a + b;\n}\n');
        const fix = repo.commit(`fix: sum adds\n\nFixes: ${whitespace.slice(0, 10)}`);
        const r = inducersOf(repo.git, fix);
        expect(r.candidates).toEqual([{ sha: whitespace, method: 'declared', witnesses: [] }]);
    });

    it('a tracker suspect commit is a separate signal, not a candidate', () => {
        repo.write('src/total.ts', 'export function sum(a: number, b: number) {\n      return a + b;\n}\n');
        const fix = repo.commit('fix: sum adds');
        const r = inducersOf(repo.git, fix, { trackerSuspect: renamed });
        expect(r.tracker_suspect).toBe(renamed);
        expect(r.candidates.map((c) => c.sha)).toEqual([inducer]);
    });

    it('skips a format-only commit that blame -w alone would still name', () => {
        // A commit that only adds a blank line above the buggy line moves it; blame
        // without the skip would still credit the inducer, and must not credit the blank-line commit.
        repo.write('src/total.ts', 'export function sum(a: number, b: number) {\n\n      return a - b;\n}\n');
        const blank = repo.commit('style: blank line');
        repo.write('src/total.ts', 'export function sum(a: number, b: number) {\n\n      return a + b;\n}\n');
        const r = inducersOf(repo.git, repo.commit('fix: sum adds'));
        expect(r.candidates.map((c) => c.sha)).toEqual([inducer]);
        expect(r.candidates.map((c) => c.sha)).not.toContain(blank);
    });
});

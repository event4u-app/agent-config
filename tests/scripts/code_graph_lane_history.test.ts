import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_HISTORY_THRESHOLDS, hiddenDependencies, parseNameStatusLog, readHistory } from '../../src/scripts/code_graph/lanes/history/history.js';
import type { LaneOutput } from '../../src/scripts/code_graph/lanes/lane_fact.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';

let root: string;
let tick = 0;
const HEAD_DAY = Date.parse('2026-10-01T12:00:00Z');

function iso(daysBeforeHead: number): string {
    return new Date(HEAD_DAY - daysBeforeHead * 86_400_000).toISOString();
}

/** One commit: `null` deletes, a `[from, to]` pair renames. */
function commit(changes: Array<string | null | [string, string]>, daysBeforeHead = 10, deleted: string[] = []): void {
    for (const c of changes) {
        if (Array.isArray(c)) {
            execFileSync('git', ['-C', root, 'mv', c[0], c[1]], { stdio: 'ignore' });
            continue;
        }
        if (c === null) continue;
        const p = path.join(root, c);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.appendFileSync(p, `line ${tick++}\n`);
    }
    for (const d of deleted) execFileSync('git', ['-C', root, 'rm', '-q', d], { stdio: 'ignore' });
    execFileSync('git', ['-C', root, 'add', '-A'], { stdio: 'ignore' });
    const date = iso(daysBeforeHead);
    execFileSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', `c${tick}`], {
        stdio: 'ignore',
        env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
    });
}

/** Days count down so commits stay in chronological order. */
let clock = 100;
function next(changes: Array<string | null | [string, string]>, deleted: string[] = []): void {
    commit(changes, clock, deleted);
    clock -= 0.5;
}

function pair(out: LaneOutput, a: string, b: string) {
    return out.relations.find((r) => r.relation === 'co-changes' && r.from === a && r.to === b);
}

beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-history-')));
    execFileSync('git', ['-C', root, 'init', '-q', '-b', 'main'], { stdio: 'ignore' });
    tick = 0;
    clock = 100;
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('readHistory', () => {
    it('reports a pair that changed together often enough, with count, strength and the latest commit as witness', () => {
        for (let i = 0; i < 3; i++) next(['a.ts', 'b.ts']);
        next(['a.ts']);
        const out = readHistory(root);
        const r = pair(out, 'a.ts', 'b.ts');
        expect(r).toBeDefined();
        expect(r?.attrs.count).toBe(3);
        expect(r?.attrs.strength).toBe(0.75);
        const head = execFileSync('git', ['-C', root, 'log', '-1', '--format=%H', '--', 'b.ts'], { encoding: 'utf-8' }).trim();
        expect(r?.attrs.last_sha).toBe(head);
        expect(r?.witness).toEqual({ file: 'a.ts', line: 1, hash: head.slice(0, 8) });
        expect(r?.attrs.files).toEqual(['a.ts', 'b.ts']);
        expect(r?.guess).toBe(false);
        expect(out.lane).toBe('history');
    });

    it('needs the minimum count: one shared commit short is no pair', () => {
        for (let i = 0; i < DEFAULT_HISTORY_THRESHOLDS.min_co_changes - 1; i++) next(['a.ts', 'b.ts']);
        expect(pair(readHistory(root), 'a.ts', 'b.ts')).toBeUndefined();
        expect(pair(readHistory(root, { min_co_changes: 2 }), 'a.ts', 'b.ts')).toBeDefined();
    });

    it('cuts on strength against the busier file, inclusive at the threshold', () => {
        for (let i = 0; i < 3; i++) next(['a.ts', 'b.ts']);
        for (let i = 0; i < 7; i++) next(['a.ts']);
        // 3 shared of a's 10 commits: exactly 0.3, kept.
        expect(pair(readHistory(root), 'a.ts', 'b.ts')?.attrs.strength).toBe(0.3);
        next(['a.ts']);
        // 3 of 11: below the bar.
        expect(pair(readHistory(root), 'a.ts', 'b.ts')).toBeUndefined();
    });

    it('skips commits over the file cap and says so', () => {
        for (let i = 0; i < 2; i++) next(['a.ts', 'b.ts']);
        const many = Array.from({ length: 51 }, (_, i) => `bulk/f${i}.ts`);
        next(['a.ts', 'b.ts', ...many.slice(2)]);
        const out = readHistory(root);
        expect(pair(out, 'a.ts', 'b.ts')).toBeUndefined();
        expect(out.skipped.some((s) => /over 50 files/.test(s.reason))).toBe(true);
        // The cap is data: raising it admits the commit.
        expect(pair(readHistory(root, { max_files_per_commit: 100 }), 'a.ts', 'b.ts')?.attrs.count).toBe(3);
    });

    it('follows a rename so the file keeps its history under the current name', () => {
        for (let i = 0; i < 2; i++) next(['old.ts', 'f.ts']);
        next([['old.ts', 'renamed.ts'], 'f.ts']);
        next(['renamed.ts', 'f.ts']);
        const out = readHistory(root);
        expect(pair(out, 'f.ts', 'renamed.ts')?.attrs.count).toBe(4);
        expect(out.relations.some((r) => r.from === 'old.ts' || r.to === 'old.ts')).toBe(false);
    });

    it('leaves out files that no longer exist', () => {
        for (let i = 0; i < 3; i++) next(['a.ts', 'gone.ts']);
        next([], ['gone.ts']);
        expect(readHistory(root).relations).toEqual([]);
    });

    it('reads only the window before HEAD, anchored on the commit date', () => {
        for (let i = 0; i < 3; i++) commit(['h.ts', 'i.ts'], 400 - i);
        commit(['z.ts'], 1);
        expect(pair(readHistory(root), 'h.ts', 'i.ts')).toBeUndefined();
        expect(pair(readHistory(root, { window_days: 500 }), 'h.ts', 'i.ts')).toBeDefined();
    });

    it('returns no pairs and a reason outside a git repository', () => {
        const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-history-plain-'));
        try {
            const out = readHistory(plain);
            expect(out.relations).toEqual([]);
            expect(out.skipped[0]?.reason).toMatch(/not a git repository|no commits/);
        } finally {
            fs.rmSync(plain, { recursive: true, force: true });
        }
    });
});

describe('parseNameStatusLog', () => {
    it('maps a chain of renames to the newest name', () => {
        const log = ['\x1es3\x1f2026-01-03\n\nR100\tb.ts\tc.ts\n', '\x1es2\x1f2026-01-02\n\nR100\ta.ts\tb.ts\n', '\x1es1\x1f2026-01-01\n\nM\ta.ts\nM\tx.ts\n'].join('');
        const commits = parseNameStatusLog(log, new Set(['c.ts', 'x.ts']));
        expect(commits.map((c) => c.files)).toEqual([['c.ts'], ['c.ts'], ['c.ts', 'x.ts']]);
        expect(commits[2]?.touched).toBe(2);
    });
});

describe('hiddenDependencies', () => {
    const coupled: LaneOutput = {
        lane: 'history',
        facts: [],
        relations: [
            { relation: 'co-changes', from: 'a.ts', to: 'b.ts', attrs: { count: 3, strength: 1, last_sha: 'abcdef0123' }, witness: { file: 'a.ts', line: 1, hash: 'abcdef01' }, rung: 'T1', owner: '.git', guess: false },
            { relation: 'co-changes', from: 'c.ts', to: 'd.ts', attrs: { count: 4, strength: 0.5, last_sha: '1234567890' }, witness: { file: 'c.ts', line: 1, hash: '12345678' }, rung: 'T1', owner: '.git', guess: false },
        ],
        skipped: [],
    };
    const node = (id: string, file: string) => ({ id, label: id, kind: 'function' as const, source_file: file, source_location: [1, 1, 1, 1] });
    const graph: Pick<CodeGraph, 'nodes' | 'edges'> = {
        nodes: [node('b.ts#g', 'b.ts'), node('a.ts#f', 'a.ts'), node('c.ts#h', 'c.ts'), node('d.ts#k', 'd.ts')],
        edges: [{ source: 'b.ts#g', target: 'a.ts#f', relation: 'calls', confidence: 'EXTRACTED', resolved_via: 'import-specifier', provider: 'native' }],
    };

    it('keeps only pairs with no static edge in either direction, with both witnesses', () => {
        const hidden = hiddenDependencies(coupled, graph);
        expect(hidden.map((h) => [h.a, h.b])).toEqual([['c.ts', 'd.ts']]);
        expect(hidden[0]?.witnesses.map((w) => w.file)).toEqual(['c.ts', 'd.ts']);
        expect(hidden[0]?.witnesses[1].hash).toBe('12345678');
    });

    it('treats an edge between other files, or within one file, as no link', () => {
        const g = { nodes: graph.nodes, edges: [{ ...graph.edges[0]!, source: 'c.ts#h', target: 'c.ts#h' }] };
        expect(hiddenDependencies(coupled, g).map((h) => h.a)).toEqual(['a.ts', 'c.ts']);
    });
});

describe('readHistory on this repository', () => {
    it('finds at least one co-change pair', () => {
        const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
        const out = readHistory(repo);
        expect(out.relations.length).toBeGreaterThanOrEqual(1);
    }, 120_000);
});

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';
import {
    blastLevel,
    blastOf,
    callCounts,
    duplicateBasenames,
    finishAnswers,
    globToRegExp,
    HEALTH_FORMULA,
    knowledgeKind,
    knowledgeOf,
    readFileFacts,
    readGitHistory,
    readLayerRules,
} from '../../src/scripts/code_graph/map_answers.js';
import type { FileRole, MapFile, MapModel } from '../../src/scripts/code_graph/map_model.js';

let root: string;

function write(rel: string, body: string): void {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
}

function git(...args: string[]): void {
    execFileSync('git', ['-C', root, ...args], { stdio: 'ignore' });
}

function commitAs(name: string, date: string, msg: string): void {
    execFileSync('git', ['-C', root, 'add', '-A'], { stdio: 'ignore' });
    execFileSync('git', ['-C', root, '-c', `user.name=${name}`, '-c', `user.email=${name.toLowerCase()}@example.com`, 'commit', '-q', '-m', msg], {
        stdio: 'ignore',
        env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
    });
}

beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-answers-')));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function file(p: string, role: FileRole, extra: Partial<MapFile> = {}): MapFile {
    return { path: p, role, area: -1, inFiles: 0, outFiles: 0, guesses: 0, symbols: [], symbolsOmitted: 0, externals: [], tests: [], ...extra };
}

function model(files: MapFile[], edges: Array<[number, number, number]> = []): MapModel {
    return {
        version: 1,
        thresholds: { seed: 1, infraInDegree: 10, smallArea: 3, maxAreaShare: 0.25, symbolsPerFile: 40, listCap: 15, neighboursPerArea: 12 },
        files,
        edges,
        guessEdges: [],
        areas: [],
        areaEdges: [],
        analyses: {
            hubs: [],
            surprises: [],
            cycles: [],
            cyclesTotal: 0,
            roleCounts: {} as MapModel['analyses']['roleCounts'],
            externals: [],
            guessShare: 0,
            trustedEdges: edges.length,
            guessEdgeCount: 0,
            requestPaths: [],
            requestPathsTotal: 0,
            requestPathsResolved: 0,
        },
    };
}

describe('blast numbers (1.5)', () => {
    it('counts direct and transitive dependents to depth 3 and nothing beyond', () => {
        // e → d → c → b → a: a change to a reaches b directly, c and d transitively, e at depth 4 not at all.
        const roles: FileRole[] = ['code', 'code', 'code', 'code', 'code'];
        const edges: Array<[number, number, number]> = [[1, 0, 1], [2, 1, 1], [3, 2, 1], [4, 3, 1]];
        const b = blastOf(roles, edges);
        expect(b[0]).toEqual({ direct: 1, transitive: 2, score: 2, share: 0.6, level: 'critical' });
        expect(b[4]).toMatchObject({ direct: 0, transitive: 0, level: 'low' });
    });

    it('leaves tests and docs out of the scope and gives them no record', () => {
        const roles: FileRole[] = ['code', 'test', 'doc', 'code'];
        const edges: Array<[number, number, number]> = [[1, 0, 1], [2, 0, 1], [3, 0, 1]];
        const b = blastOf(roles, edges);
        expect(b[0]?.direct).toBe(1);
        expect(b[1]).toBeUndefined();
        expect(b[2]).toBeUndefined();
    });

    it('reaches a file once even when two paths lead to it', () => {
        const roles: FileRole[] = ['code', 'code', 'code', 'code'];
        const edges: Array<[number, number, number]> = [[1, 0, 1], [2, 0, 1], [3, 1, 1], [3, 2, 1]];
        expect(blastOf(roles, edges)[0]).toMatchObject({ direct: 2, transitive: 1 });
    });

    it('levels by share of the scope', () => {
        expect([0.5, 0.25, 0.1, 0.09].map(blastLevel)).toEqual(['critical', 'high', 'medium', 'low']);
    });
});

describe('knowledge per file (3.1)', () => {
    it('reads the kind of knowledge from where the file sits', () => {
        expect(knowledgeKind('docs/contracts/x.md', 'doc')).toBe('contract');
        expect(knowledgeKind('agents/roadmaps/road-to-x.md', 'doc')).toBe('roadmap-active');
        expect(knowledgeKind('agents/roadmaps/later/road-to-x.md', 'doc')).toBe('roadmap-later');
        expect(knowledgeKind('agents/roadmaps/stubs/road-to-x.md', 'doc')).toBe('roadmap-planned');
        expect(knowledgeKind('agents/roadmaps/archive/road-to-x.md', 'doc')).toBe('roadmap-archived');
        expect(knowledgeKind('agents/evidence/reviews/a.md', 'doc')).toBe('evidence');
        expect(knowledgeKind('agents/tmp.old/inbox-2026-01-a/a.md', 'doc')).toBe('draft');
        expect(knowledgeKind('README.md', 'doc')).toBe('doc');
        expect(knowledgeKind('src/a.ts', 'code')).toBeNull();
    });

    it('carries the finding when drafts outnumber contracts', () => {
        const paths = ['src/a.ts', 'agents/tmp/inbox-2026-01-c/d1.md', 'agents/tmp.old/inbox-2026-01-d/d2.md', 'docs/contracts/c.md'];
        const kinds = paths.map((p, i) => knowledgeKind(p, i === 0 ? 'code' : 'doc'));
        const k = knowledgeOf(kinds, paths, [[1, 0, 1], [2, 0, 1], [3, 0, 1]], []);
        expect(k[0]?.finding).toEqual({ drafts: 2, contracts: 1 });
    });

    it('marks a roadmap that also sits in an inbox folder as a duplicate', () => {
        expect([...duplicateBasenames(['agents/roadmaps/archive/r.md', 'agents/tmp.old/inbox-2026-01-b/r.md', 'agents/roadmaps/s.md'])]).toEqual(['r.md']);
    });

    it('lists linked knowledge contracts first, from trusted and guessed edges alike', () => {
        const paths = ['src/a.ts', 'agents/tmp/d.md', 'docs/contracts/c.md', 'src/b.ts'];
        const kinds = paths.map((p, i) => knowledgeKind(p, i === 0 || i === 3 ? 'code' : 'doc'));
        const k = knowledgeOf(kinds, paths, [[1, 0, 1]], [[2, 0, 1]]);
        expect(k[0]).toEqual({ files: [2, 1], total: 2 });
        expect(k[0]?.finding).toBeUndefined();
        expect(k[3]).toBeUndefined();
        expect(k[1]).toBeUndefined();
    });
});

describe('call counts per symbol (1.4)', () => {
    it('splits accepted calls into same-file and other-file and ignores guesses', () => {
        const fileOf = new Map([['a#f', 'a.ts'], ['a#g', 'a.ts'], ['b#h', 'b.ts']]);
        const c = callCounts(
            [
                { source: 'a#g', target: 'a#f', relation: 'calls', accepted: true },
                { source: 'b#h', target: 'a#f', relation: 'uses', accepted: true },
                { source: 'b#h', target: 'a#f', relation: 'calls', accepted: false },
                { source: 'b#h', target: 'a#f', relation: 'imports', accepted: true },
            ],
            fileOf,
        );
        expect(c.get('a#f')).toEqual([1, 1]);
    });
});

describe('size and language (1.1)', () => {
    it('counts lines with and without a trailing newline and gives a binary file none', () => {
        write('a.ts', 'x\ny\n');
        write('b.py', 'x\ny');
        fs.writeFileSync(path.join(root, 'c.bin'), Buffer.from([1, 0, 2]));
        expect(readFileFacts(root, ['a.ts', 'b.py', 'c.bin', 'gone.md'])).toEqual([
            { loc: 2, lang: 'typescript' },
            { loc: 2, lang: 'python' },
            { lang: 'other' },
            { lang: 'markdown' },
        ]);
    });
});

describe('git history (1.2)', () => {
    it('counts commits per file in the window before HEAD, names owners and never an e-mail', () => {
        git('init', '-q');
        write('a.ts', '1\n');
        commitAs('Old', '2020-01-01T00:00:00Z', 'outside the window');
        write('a.ts', '2\n');
        commitAs('Ann', '2026-01-01T00:00:00Z', 'one');
        write('a.ts', '3\n');
        write('b.ts', '1\n');
        commitAs('Bob', '2026-02-01T00:00:00Z', 'two');
        write('a.ts', '4\n');
        commitAs('Ann', '2026-03-01T00:00:00Z', 'three');
        const h = readGitHistory(root);
        expect(h?.get('a.ts')).toEqual({ churn: 3, owners: [['Ann', 0.667], ['Bob', 0.333]], lastChange: '2026-03-01' });
        expect(h?.get('b.ts')?.churn).toBe(1);
        expect(JSON.stringify([...(h?.values() ?? [])])).not.toContain('@');
    });

    it('answers null outside a repository', () => {
        expect(readGitHistory(root)).toBeNull();
    });
});

describe('layers, violations, hotspots and health (Phase 2)', () => {
    it('matches globs by segment and across depth', () => {
        expect(globToRegExp('src/ui/**').test('src/ui/a/b.ts')).toBe(true);
        expect(globToRegExp('src/*.ts').test('src/a/b.ts')).toBe(false);
        expect(globToRegExp('src/**/x.ts').test('src/x.ts')).toBe(true);
    });

    it('reports an edge the layer rules do not allow, and never one inside a layer', () => {
        write('layers.yaml', 'layers:\n  - name: ui\n    paths: ["src/ui/**"]\n  - name: domain\n    paths: ["src/domain/**"]\nallow:\n  ui: [domain]\n');
        const rules = readLayerRules(path.join(root, 'layers.yaml'));
        expect(rules).not.toBeNull();
        const m = model(
            [file('src/domain/d.ts', 'code', { layer: 'domain' }), file('src/ui/u.ts', 'code', { layer: 'ui' }), file('src/ui/v.ts', 'code', { layer: 'ui' })],
            [[0, 1, 1], [1, 0, 1], [2, 1, 1]],
        );
        finishAnswers(m, rules);
        expect(m.violations).toEqual([{ kind: 'layer', severity: 'high', files: [0, 1], layers: ['domain', 'ui'] }]);
        expect(m.analyses.layerBreaches).toBe(1);
        expect(m.legend?.find((l) => l.key === 'layer')?.available).toBe(true);
    });

    it('answers no layers.yaml with no rules', () => {
        expect(readLayerRules(path.join(root, 'none.yaml'))).toBeNull();
    });

    it('withholds the grade while a part is missing and always carries the formula', () => {
        const m = model([file('a.ts', 'code', { loc: 10, lang: 'typescript' })]);
        finishAnswers(m, null);
        expect(m.health?.grade).toBeUndefined();
        expect(m.health?.formula).toBe(HEALTH_FORMULA);
        expect(m.hotspots).toBeUndefined();
        expect(m.legend?.find((l) => l.key === 'churn')).toMatchObject({ available: false, reason: 'needs git history' });
        expect(m.languages).toEqual([['typescript', 1, 10]]);
    });

    it('grades once every part is present and ranks hotspots by churn times lines', () => {
        const m = model([
            file('a.ts', 'code', { loc: 100, churn: 2 }),
            file('b.ts', 'code', { loc: 10, churn: 30 }),
            file('c.ts', 'code', { loc: 50, churn: 0 }),
        ]);
        m.analyses.deadFiles = 0;
        finishAnswers(m, null);
        expect(m.hotspots).toEqual([[1, 30, 10, 300], [0, 2, 100, 200]]);
        expect(m.health?.parts.dead).toBeDefined();
        expect(m.health?.parts.hotspots).toBeDefined();
        expect(m.health?.grade).toMatch(/^[A-F]$/);
        const sum = ['dead', 'cycles', 'guesses', 'hotspots'].reduce(
            (n, k) => n + (m.health?.parts[k as 'dead']?.points ?? 0),
            0,
        );
        expect(m.health?.score).toBeCloseTo(sum, 5);
        expect(m.health?.parts.hotspots?.value).toBe(0);
    });

    it('counts a hotspot by absolute churn and size, never by a percentile of the tree', () => {
        const files = Array.from({ length: 20 }, (_, i) => file(`f${i}.ts`, 'code', { loc: 600, churn: i === 0 ? 25 : 1 }));
        const m = model(files);
        m.analyses.deadFiles = 0;
        finishAnswers(m, null);
        expect(m.health?.parts.hotspots?.value).toBe(0.05);
        expect(m.health?.parts.hotspots?.points).toBe(0);
    });
});

describe('the map writer answers on a real tree', () => {
    it('writes size, language, churn, owners, blast, call counts and the dead flag into map.json', async () => {
        fs.mkdirSync(path.join(root, 'agents'));
        write('src/util/log.ts', 'export function log(m: string): void { void m; }\n');
        write('src/a.ts', "import { log } from './util/log.js';\nexport function a(): void { log('a'); }\n");
        write('src/b.ts', "import { a } from './a.js';\nexport function b(): void { a(); }\n");
        write('src/lonely.ts', 'export function nobody(): number { return 1; }\n');
        git('init', '-q');
        commitAs('Ann', '2026-05-01T00:00:00Z', 'init');
        const res = await buildMap(root);
        const doc = JSON.parse(fs.readFileSync(path.join(res.outDir, 'map.json'), 'utf-8')) as { model: MapModel };
        const m = doc.model;
        const byPath = (p: string): MapFile => m.files.find((f) => f.path === p) as MapFile;
        expect(byPath('src/a.ts')).toMatchObject({ loc: 2, lang: 'typescript', churn: 1, owners: [['Ann', 1]], lastChange: '2026-05-01' });
        expect(byPath('src/util/log.ts').blast).toMatchObject({ direct: 1, transitive: 1 });
        const logSym = byPath('src/util/log.ts').symbols.find((s) => s[0] === 'log');
        expect(logSym?.[4]).toBe(1);
        expect(byPath('src/lonely.ts').dead).toBe(true);
        expect(byPath('src/a.ts').dead).toBeUndefined();
        expect(m.analyses.deadBasis).toMatch(/exports unchecked/);
        expect(m.pin).toMatchObject({ date: '2026-05-01' });
        expect(m.health?.formula).toBe(HEALTH_FORMULA);
        expect(JSON.stringify(doc)).not.toContain('@example.com');
    });
});

describe('the Workbench page (Phase 4)', () => {
    it('ships the frame the design names and none of the design\'s demo figures', async () => {
        fs.mkdirSync(path.join(root, 'agents'));
        write('src/a.ts', 'export const a = 1;\n');
        const res = await buildMap(root);
        const html = fs.readFileSync(path.join(res.outDir, 'index.html'), 'utf-8');
        for (const id of ['health', 'kpis', 'colorby', 'explorer', 'lenses', 'crumbs', 'legend', 'lensview', 'foot', 'tabs', 'panel', 'dim2d', 'fullcard'])
            expect(html).toContain(`id="${id}"`);
        // The design was drawn with this repository's numbers at one pin; none may be baked in.
        for (const demo of ['12.493', '74.515', 'session_register', 'Skript-Sammelbecken', 'd95b952d7142'])
            expect(html).not.toContain(demo);
        expect(html).not.toMatch(/fonts\.googleapis/);
    });
});

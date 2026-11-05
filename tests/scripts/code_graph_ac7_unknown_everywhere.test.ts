/**
 * AC-7 of road-to-a-graph-that-wins, audited end-to-end: a partial parse and a
 * skipped lane read `unknown` in every review answer, never `0`, and no capped
 * answer drops an item uncounted.
 *
 * Every assertion runs twice over one fixture — once answered from the parsed
 * JSON, once through the SQLite twin above the indexed-read threshold — because
 * the two stores reached the verbs through different node readers, and the
 * indexed one used to hand back file nodes without their `partial` flag.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { capAnswer, capReviewRisk } from '../../src/scripts/code_graph/answer_detail.js';
import { testsForModuleAnswer } from '../../src/scripts/code_graph/answer_correctness.js';
import { ask, type Scope } from '../../src/scripts/code_graph/ask.js';
import { askGraphOptions, graphSources } from '../../src/scripts/code_graph/cli_ask.js';
import { loadGraph, type LoadedGraph } from '../../src/scripts/code_graph/query.js';
import { loadRiskSource, renderReviewRisk, reviewRisk } from '../../src/scripts/code_graph/review_risk.js';
import { emitSqliteTwin, openGraphIndex, sqliteTwinPath } from '../../src/scripts/code_graph/sqlite_store.js';
import type { CodeEdge, CodeGraph, CodeNode } from '../../src/scripts/code_graph/types.js';
import { dead, impact, testsForAnswer } from '../../src/scripts/code_graph/verbs.js';
import { isSqliteAvailableSync, loadSqliteSync } from '../../src/scripts/_lib/sqlite_guard.js';

const CALLERS = 250;
const TESTS = 250;
const PARTIAL = 'src/a.ts';
const TARGET = 'src/a.ts#target';
const ENV = 'AGENT_CONFIG_GRAPH_INDEXED_MIN_EDGES';
const CLI = path.resolve('src/scripts/code_graph/cli.ts');

function fixture(): CodeGraph {
    const node = (id: string, kind: string, file: string, loc: number[], extra: Partial<CodeNode> = {}): CodeNode =>
        ({ id, label: id.includes('#') ? id.split('#')[1]! : id, kind, source_file: file, source_location: loc, ...extra }) as CodeNode;
    const edge = (source: string, target: string, relation: CodeEdge['relation']): CodeEdge => ({
        source,
        target,
        relation,
        confidence: 'EXTRACTED',
        resolved_via: 'import-specifier',
        provider: 'native',
    });
    const nodes: CodeNode[] = [node(PARTIAL, 'file', PARTIAL, [], { partial: true }), node(TARGET, 'function', PARTIAL, [1, 0, 3, 0]), node('src/b.ts', 'file', 'src/b.ts', [])];
    const edges: CodeEdge[] = [edge(PARTIAL, TARGET, 'member')];
    for (let i = 0; i < CALLERS; i++) {
        const id = `src/b.ts#caller${String(i).padStart(3, '0')}`;
        nodes.push(node(id, 'function', 'src/b.ts', [i * 3 + 1, 0, i * 3 + 2, 0]));
        edges.push(edge('src/b.ts', id, 'member'), edge(id, TARGET, 'calls'));
    }
    for (let i = 0; i < TESTS; i++) {
        const id = `tests/t${String(i).padStart(3, '0')}.test.ts`;
        nodes.push(node(id, 'file', id, []));
        edges.push(edge(id, TARGET, 'tests'));
    }
    return {
        schema_version: 3,
        source_checksum: 'ac7-fixture',
        languages: ['typescript'],
        grammar_abi: 14,
        edge_confidence_counts: { EXTRACTED: edges.length, INFERRED: 0, AMBIGUOUS: 0 },
        suppressed_edge_counts: { dynamic_no_candidate: 0 },
        lanes_run: [
            { lane: 'code', facts: nodes.length, relations: edges.length },
            { lane: 'history', facts: 0, relations: 0, skipped_reason: 'shallow clone' },
        ],
        nodes,
        edges,
    } as CodeGraph;
}

const sqliteOk = isSqliteAvailableSync();
let dir = '';
let jsonPath = '';
const graph = fixture();
const scope: Scope = { repoId: 'r', branch: 'main', worktree: '/w', user: 'u' };

beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-ac7-'));
    jsonPath = path.join(dir, 'graph.json');
    fs.writeFileSync(jsonPath, JSON.stringify(graph));
    if (sqliteOk) expect(emitSqliteTwin(graph, jsonPath)).toBe(true);
});

afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

/** Run `fn` with the indexed-read threshold at `min` edges, so the fixture is answered by the store named. */
function withThreshold<T>(min: string, fn: () => T): T {
    const before = process.env[ENV];
    process.env[ENV] = min;
    try {
        return fn();
    } finally {
        if (before === undefined) delete process.env[ENV];
        else process.env[ENV] = before;
    }
}

const PATHS = [
    { name: 'json', min: String(Number.MAX_SAFE_INTEGER), indexed: false },
    { name: 'index', min: '0', indexed: true },
] as const;

function withGraph<T>(min: string, fn: (g: LoadedGraph) => T): T {
    return withThreshold(min, () => {
        const g = loadGraph(jsonPath);
        try {
            return fn(g);
        } finally {
            g.close();
        }
    });
}

describe.runIf(sqliteOk).each(PATHS)('AC-7 on the $name path', ({ min, indexed }) => {
    it('answers from the store under test', () => {
        withGraph(min, (g) => expect(g.graph === null).toBe(indexed));
    });

    it('carries the lane record, the skipped lane included', () => {
        withGraph(min, (g) => expect(g.lanesRun()?.find((l) => l.lane === 'history')?.skipped_reason).toBe('shallow clone'));
    });

    it('review-risk: the partial file is listed and the skipped lane renders unknown, never 0', () => {
        withThreshold(min, () => {
            const loaded = loadRiskSource(jsonPath);
            try {
                expect(loaded.via).toBe(indexed ? 'index' : 'json');
                const r = reviewRisk(dir, loaded.source, 'HEAD', [{ file: PARTIAL, from: 1, to: 3 }]);
                expect(r.partial_files).toEqual([PARTIAL]);
                expect(r.complete).toBe(false);
                const partners = r.terms.find((t) => t.term === 'missing partners')!;
                expect(partners.unknown).toBe('shallow clone');
                const text = renderReviewRisk(r).join('\n');
                expect(text).toContain('missing partners unknown (shallow clone)');
                expect(text).not.toMatch(/missing partners 0/);
                // Capped: every dropped item is counted.
                const callers = r.terms.find((t) => t.term === 'callers')!;
                expect(callers.items.length).toBe(CALLERS + TESTS);
                const capped = capReviewRisk(r, 'minimal');
                const kept = capped.terms.find((t) => t.term === 'callers')!;
                expect(kept.items.length).toBeLessThan(CALLERS + TESTS);
                expect(kept.count).toBe(CALLERS + TESTS);
                expect(capped.omitted['callers']).toBe(CALLERS + TESTS - kept.items.length);
            } finally {
                loaded.close();
            }
        });
    });

    it('impact: the partial file is listed, and a capped answer counts what it drops', () => {
        withGraph(min, (g) => {
            const r = impact(g, [PARTIAL], 'fresh', 2);
            expect(r.partial_files).toEqual([PARTIAL]);
            expect(r.complete).toBe(false);
            expect(r.dependents.length).toBe(CALLERS + TESTS);
            const fields = ['dependents', 'reached', 'test_files', 'producing_edges', 'lines', 'recommended_reads'] as const;
            const capped = capAnswer(r, [...fields], 'minimal', ['reached', 'producing_edges', 'lines']);
            for (const f of fields) expect((capped[f] as unknown[]).length + (capped.omitted[f] ?? 0)).toBe((r[f] as unknown[]).length);
            expect(capped.omitted['dependents']).toBeGreaterThan(0);
        });
    });

    it('tests-for: the partial file is listed, and a capped answer counts what it drops', () => {
        withGraph(min, (g) => {
            for (const r of [testsForAnswer(g, TARGET, 'fresh'), testsForModuleAnswer(g, TARGET, 'fresh')]) {
                expect(r.partial_files).toEqual([PARTIAL]);
                expect(r.complete).toBe(false);
                expect(r.tests.length).toBe(TESTS);
                const capped = capAnswer(r, ['tests', 'lines', 'recommended_reads'], 'minimal');
                expect(capped.tests.length).toBeLessThan(TESTS);
                expect(capped.omitted['tests']).toBe(TESTS - capped.tests.length);
            }
        });
    });

    it('ask: the skipped lane and the partial file are degraded, never silent', () => {
        withGraph(min, (g) => {
            const r = ask(`where is ${TARGET}`, graphSources(g, 'r'), scope, { format: 'concise', ...askGraphOptions(g) });
            expect(r.envelope.answer.map((a) => a.id)).toContain(TARGET);
            expect(r.degraded.join('\n')).toMatch(/history lane skipped \(shallow clone\) — its facts are unknown, not absent/);
            expect(r.degraded.join('\n')).toContain(`${PARTIAL} parsed with errors`);
            expect(r.envelope.confidence).toBe('low');
        });
    });

    it('ask: a capped answer counts every caller, including those past the walk limit', () => {
        withGraph(min, (g) => {
            const r = ask(`who uses ${TARGET}`, graphSources(g, 'r'), scope, { format: 'hint', ...askGraphOptions(g) });
            expect(r.intent).toBe('usage');
            // Every in-neighbour: the callers, the tests and the declaring file node.
            expect(r.envelope.counts.total).toBe(CALLERS + TESTS + 1);
            expect(r.envelope.counts.shown).toBeLessThan(CALLERS + TESTS);
            expect(r.envelope.complete).toBe(false);
        });
    });

    it('dead: a partial file could hold the missing call, so the list is not complete', () => {
        withGraph(min, (g) => {
            const r = dead(g, [], 'fresh');
            expect(r.refusal).toBeNull();
            // The callers have no reference in-edge, so they are candidates.
            expect(r.dead.length).toBe(CALLERS);
            expect(r.partial_files).toEqual([PARTIAL]);
            expect(r.complete).toBe(false);
            const capped = capAnswer(r, ['dead', 'excluded', 'lines', 'recommended_reads'], 'minimal');
            expect(capped.omitted['dead']).toBe(CALLERS - capped.dead.length);
        });
    });

    it('dead (CLI): prints the partial files and that the list is a candidate set, not proof', () => {
        const out = withThreshold(min, () =>
            execFileSync('npx', ['tsx', CLI, 'dead', '--root', dir, '--graph', jsonPath, '--accept-missing-exports', '--detail', 'minimal'], {
                encoding: 'utf8',
                env: { ...process.env },
            }),
        );
        expect(out).toContain(`partial files (parsed with errors, a call from them may be missing — not complete): ${PARTIAL}`);
        expect(out).toMatch(/omitted by --detail cap: dead \d+/);
    }, 120_000);
});

describe.runIf(sqliteOk)('AC-7 — a twin that predates the graph-level facts', () => {
    it('is not answered from (never a silent 0), and is re-emitted with them', () => {
        const old = path.join(dir, 'old.json');
        fs.writeFileSync(old, JSON.stringify(graph));
        expect(emitSqliteTwin(graph, old)).toBe(true);
        const { DatabaseSync } = loadSqliteSync('test');
        const db = new DatabaseSync(sqliteTwinPath(old));
        try {
            db.exec("DELETE FROM meta WHERE key IN ('partial', 'lanes_run')");
        } finally {
            db.close();
        }
        withThreshold('0', () => {
            const g = loadGraph(old);
            try {
                expect(g.graph).not.toBeNull();
                expect(impact(g, [PARTIAL], 'fresh', 2).partial_files).toEqual([PARTIAL]);
                expect(g.lanesRun()?.find((l) => l.lane === 'history')?.skipped_reason).toBe('shallow clone');
            } finally {
                g.close();
            }
            const index = openGraphIndex(old)!;
            try {
                expect(index.meta('partial')).toBe(JSON.stringify([PARTIAL]));
            } finally {
                index.close();
            }
        });
    });
});

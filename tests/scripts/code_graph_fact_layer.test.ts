/**
 * The fact layer: the fact shape through both stores, the one vocabulary file,
 * the lane merge, and the one drift engine.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo, serializeGraph } from '../../src/scripts/code_graph/build.js';
import { evaluateDrift, loadRules, renderDrift, ruleError, type DriftRule } from '../../src/scripts/code_graph/drift.js';
import { DRIFT_RULES } from '../../src/scripts/code_graph/drift_rules.js';
import { type LaneOutput, spanHash } from '../../src/scripts/code_graph/lanes/lane_fact.js';
import { readDelivery } from '../../src/scripts/code_graph/lanes/delivery/index.js';
import { readInterfaces } from '../../src/scripts/code_graph/lanes/interfaces/index.js';
import { applyLaneOutputs, mergeLaneOutputs } from '../../src/scripts/code_graph/lanes/merge.js';
import { readRuntime } from '../../src/scripts/code_graph/lanes/runtime/index.js';
import { loadGraph } from '../../src/scripts/code_graph/query.js';
import { openGraphIndex } from '../../src/scripts/code_graph/sqlite_store.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';
import {
    directionError,
    KINDS,
    LANE_CAP,
    LANES,
    RELATIONS,
    VOCABULARY,
    VOCABULARY_VERSION,
    vocabularyErrors,
} from '../../src/scripts/code_graph/vocabulary.js';

const P1 = path.resolve(__dirname, '../fixtures/code-graph/correctness/p1-blog');
const CG = path.resolve(__dirname, '../../src/scripts/code_graph');

let dir: string;
let cache: string;
let graph: CodeGraph;

beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-facts-'));
    cache = path.join(dir, 'graph.json');
    ({ graph } = await buildFromRepo(P1, cache));
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('2.1 — the fact shape survives both stores', () => {
    it('round-trips every fact field of every node and edge through SQLite', () => {
        const index = openGraphIndex(cache);
        expect(index).not.toBeNull();
        try {
            const nodes = graph.nodes.filter((n) => n.fact);
            const edges = graph.edges.filter((e) => e.fact);
            expect(nodes.length).toBeGreaterThan(10);
            expect(edges.length).toBeGreaterThan(10);
            for (const n of nodes) {
                const back = index!.getNode(n.id)?.fact;
                expect(back, n.id).toStrictEqual(n.fact);
                for (const k of ['owner', 'witness', 'rung'] as const) expect(back?.[k], `${n.id}.${k}`).toBeDefined();
            }
            for (const e of edges) {
                const back = index!.edgesFrom(e.source).find((x) => x.target === e.target && x.relation === e.relation);
                expect(back?.fact, `${e.source} ${e.relation} ${e.target}`).toStrictEqual(e.fact);
                expect(back?.resolved_via).toBe(e.resolved_via);
            }
        } finally {
            index?.close();
        }
    });

    it('round-trips through the JSON byte for byte', () => {
        const again = JSON.parse(serializeGraph(graph)) as CodeGraph;
        expect(serializeGraph(again)).toBe(serializeGraph(graph));
        const col = again.nodes.find((n) => n.id === 'column:comments.post_id');
        expect(col?.fact).toMatchObject({ owner: expect.stringMatching(/migrations/), rung: 'T1', resolved_via: 'schema-call' });
        expect(col?.fact?.witness).toMatchObject({ line: expect.any(Number), hash: expect.stringMatching(/^[0-9a-f]{8}$/) });
    });

    it('a witness hash is the hash of the line it names', () => {
        const col = graph.nodes.find((n) => n.id === 'column:posts.author_id')!;
        const line = fs.readFileSync(path.join(P1, col.fact!.witness.file), 'utf-8').split('\n')[col.fact!.witness.line - 1]!;
        expect(col.fact!.witness.hash).toBe(spanHash(line.trim()));
    });
});

describe('2.2 — one vocabulary file', () => {
    it('carries a version stamp, keeps each lane under its cap, and gives every kind one lane', () => {
        expect(Number.isInteger(VOCABULARY_VERSION)).toBe(true);
        const seen = new Map<string, string>();
        for (const lane of LANES) {
            const l = VOCABULARY[lane];
            expect(l.kinds.length, lane).toBeLessThanOrEqual(LANE_CAP.kinds);
            expect(Object.keys(l.relations).length, lane).toBeLessThanOrEqual(LANE_CAP.relations);
            for (const k of l.kinds) {
                expect(seen.has(k), `${k} in ${lane} and ${seen.get(k)}`).toBe(false);
                seen.set(k, lane);
            }
        }
        for (const k of ['table', 'column', 'service', 'operation', 'resource', 'environment', 'workflow', 'job', 'decision']) expect(KINDS.has(k), k).toBe(true);
        for (const r of ['references', 'reads', 'writes', 'calls-out', 'configured-by', 'described-by', 'deploys-to', 'triggers', 'governs', 'supersedes', 'co-changes']) {
            expect(RELATIONS.has(r), r).toBe(true);
        }
    });

    it('names in every direction only kinds it lists', () => {
        for (const [r, def] of RELATIONS) {
            for (const k of [...def.from, ...def.to]) expect(k === '*' || KINDS.has(k), `${r}: ${k}`).toBe(true);
        }
    });

    it('reads a relation in its stated direction only', () => {
        expect(directionError('supersedes', 'decision', 'decision')).toBeNull();
        expect(directionError('supersedes', 'file', 'decision')).toMatch(/may not start at a file/);
        expect(directionError('references', 'column', 'method')).toMatch(/may not end at a method/);
        expect(directionError('frobs', 'file', 'file')).toMatch(/not in the vocabulary/);
    });

    /**
     * Kind literals of the nodes and facts a reader writes: `kind: 'x'` in an
     * object literal that also names its `source_file` (a node) or `rung` (a
     * lane fact), and the first argument of a lane emitter's `.fact('x', …)`.
     */
    const kindsUsed = (src: string): string[] => [
        ...[...src.matchAll(/\{(?:[^{}]|\{[^{}]*\})*\}/g)]
            .map((m) => m[0])
            .filter((obj) => /\b(source_file|rung)\b/.test(obj))
            .flatMap((obj) => [...obj.matchAll(/\bkind:\s*'([a-z][a-z-]*)'/g)].map((k) => k[1] as string)),
        ...[...src.matchAll(/\.fact\(\s*'([a-z][a-z-]*)'/g)].map((m) => m[1] as string),
    ];
    const readerSources = (): Array<[string, string]> => {
        const out: Array<[string, string]> = [];
        const walk = (d: string): void => {
            for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                const p = path.join(d, e.name);
                if (e.isDirectory()) walk(p);
                else if (e.name.endsWith('.ts')) out.push([path.relative(CG, p), fs.readFileSync(p, 'utf-8')]);
            }
        };
        for (const sub of ['providers', 'lanes']) if (fs.existsSync(path.join(CG, sub))) walk(path.join(CG, sub));
        for (const f of ['build.ts', 'extract.ts', 'extract_more.ts', 'conventions_default.ts', 'docs_layer.ts', 'foreign.ts']) out.push([f, fs.readFileSync(path.join(CG, f), 'utf-8')]);
        return out;
    };

    it('no reader or provider writes a node kind the vocabulary does not list', () => {
        const stray = readerSources().flatMap(([f, src]) => kindsUsed(src).filter((k) => !KINDS.has(k)).map((k) => `${f}: ${k}`));
        expect(stray).toEqual([]);
        const used = new Set(readerSources().flatMap(([, src]) => kindsUsed(src)));
        for (const k of ['route', 'table', 'column', 'file']) expect(used.has(k), `scan saw no ${k}`).toBe(true);
    });

    it('that scan fails on a kind used in code but absent from the file', () => {
        expect(kindsUsed("nodes.push({ id, kind: 'widget', label, source_file: f })").filter((k) => !KINDS.has(k))).toEqual(['widget']);
        expect(kindsUsed("facts.push({ kind: 'gizmo', id, witness: w, rung: 'T1' })")).toEqual(['gizmo']);
        expect(kindsUsed("em.fact('sprocket', key, name, {}, file, 1)")).toEqual(['sprocket']);
    });

    it('every graph a provider builds fits the vocabulary', () => {
        expect(vocabularyErrors(graph)).toEqual([]);
    });
});

const witness = (file: string, line: number, text: string) => ({ file, line, hash: spanHash(text) });

function sampleOutputs(): LaneOutput[] {
    return [
        {
            lane: 'decisions',
            facts: [
                { kind: 'decision', id: 'ADR-2', name: 'ADR-2 new', attrs: { status: 'accepted' }, witness: witness('docs/adr/ADR-2.md', 1, '# ADR-2'), rung: 'T1', owner: 'docs/adr/ADR-2.md' },
                { kind: 'decision', id: 'ADR-1', name: 'ADR-1 old', attrs: { status: 'superseded' }, witness: witness('docs/adr/ADR-1.md', 1, '# ADR-1'), rung: 'T1', owner: 'docs/adr/ADR-1.md' },
                { kind: 'widget', id: 'w', name: 'w', attrs: {}, witness: witness('x', 1, 'x'), rung: 'T1', owner: 'x' },
            ],
            relations: [
                { relation: 'supersedes', from: 'decision:ADR-2', to: 'decision:ADR-1', attrs: {}, witness: witness('docs/adr/ADR-2.md', 3, 'Supersedes ADR-1'), rung: 'T1', owner: 'docs/adr/ADR-2.md', guess: false },
                { relation: 'governs', from: 'decision:ADR-2', to: 'table:posts', attrs: {}, witness: witness('docs/adr/ADR-2.md', 5, 'posts'), rung: 'T1', owner: 'docs/adr/ADR-2.md', guess: true },
                { relation: 'supersedes', from: 'table:posts', to: 'decision:ADR-1', attrs: {}, witness: witness('x', 1, 'x'), rung: 'T1', owner: 'x', guess: false },
                { relation: 'governs', from: 'decision:ADR-2', to: 'nowhere', attrs: {}, witness: witness('x', 1, 'x'), rung: 'T1', owner: 'x', guess: false },
            ],
            skipped: [],
        },
    ];
}

describe('the lane merge', () => {
    it('merges vocabulary facts and relations, and refuses the rest with the reason', () => {
        const r = mergeLaneOutputs(graph, sampleOutputs());
        expect(r.merged).toEqual({ nodes: 2, edges: 3 });
        expect(r.refused.map((x) => x.reason)).toEqual(['kind "widget" is not in the vocabulary', '"supersedes" may not start at a table']);
        expect(r.graph.edges.some((e) => e.relation === 'governs' && e.target === 'nowhere')).toBe(true);
        expect(mergeLaneOutputs(graph, [{ ...sampleOutputs()[0]!, facts: [], relations: [sampleOutputs()[0]!.relations[0]!] }]).refused.map((x) => x.reason)).toEqual([
            'source not in the graph: decision:ADR-2',
        ]);
        const sup = r.graph.edges.find((e) => e.relation === 'supersedes');
        expect([sup?.source, sup?.target]).toEqual(['decision:ADR-2', 'decision:ADR-1']);
        expect(sup?.resolved_via).toBe('lane-read');
        const gov = r.graph.edges.find((e) => e.relation === 'governs' && e.target === 'table:posts');
        expect([gov?.confidence, gov?.resolved_via]).toEqual(['INFERRED', 'name-lookup']);
        expect(validateGraph(JSON.parse(serializeGraph(r.graph))).errors).toEqual([]);
        expect(vocabularyErrors(r.graph)).toEqual([]);
        expect(graph.nodes.some((n) => n.kind === 'decision')).toBe(false);
    });

    it('replaces a lane as a whole, so merging twice is merging once', () => {
        const once = mergeLaneOutputs(graph, sampleOutputs()).graph;
        const twice = mergeLaneOutputs(once, sampleOutputs()).graph;
        expect(serializeGraph(twice)).toBe(serializeGraph(once));
    });

    it('writes the merged facts into the graph file and its SQLite twin', () => {
        const file = path.join(dir, 'merged.json');
        fs.copyFileSync(cache, file);
        applyLaneOutputs(file, sampleOutputs());
        const index = openGraphIndex(file);
        try {
            expect(index?.getNode('decision:ADR-1')?.fact).toMatchObject({ lane: 'decisions', rung: 'T1', owner: 'docs/adr/ADR-1.md' });
            expect(index?.edgesFrom('decision:ADR-2').map((e) => e.relation).sort()).toEqual(['governs', 'governs', 'supersedes']);
        } finally {
            index?.close();
        }
        const g = loadGraph(file);
        expect(g.kindCount('decision')).toBe(2);
        g.close();
    });
});

describe('the lane readers merge through the one merge', () => {
    const FIX = path.resolve(__dirname, '../fixtures/code-graph');
    for (const [name, read, sub] of [
        ['runtime', readRuntime, 'runtime/drift'],
        ['delivery', readDelivery, 'delivery/drift'],
        ['interfaces', readInterfaces, 'interfaces/p5'],
    ] as const) {
        it(`${name}: every fact and relation fits the vocabulary`, async () => {
            const root = path.join(FIX, sub);
            const { graph: base } = await buildFromRepo(root, null);
            const out = (read as (r: string) => LaneOutput)(root);
            const r = mergeLaneOutputs(base, [out]);
            expect(out.facts.length).toBeGreaterThan(0);
            expect(r.refused).toEqual([]);
            expect(r.merged).toEqual({ nodes: out.facts.length, edges: out.relations.length });
            expect(vocabularyErrors(r.graph)).toEqual([]);
            expect(validateGraph(JSON.parse(serializeGraph(r.graph))).errors).toEqual([]);
        });
    }
});

describe('2.3 — one drift engine', () => {
    it('finds DR-1 on comments.post_id, DR-3 on Tag and DR-4 on post_tag in the P1 fixture', () => {
        const r = evaluateDrift(graph, DRIFT_RULES);
        expect(r.refused).toEqual([]);
        expect(r.findings.filter((f) => ['DR-1', 'DR-3', 'DR-4'].includes(f.rule)).map((f) => `${f.rule} ${f.subject}`)).toEqual([
            'DR-1 column:comments.post_id',
            'DR-3 app/Models/Tag.php#Tag',
            'DR-4 table:post_tag',
        ]);
    });

    it('gives each finding both witnesses, the engine, the completeness and the tier', () => {
        const f = evaluateDrift(graph, DRIFT_RULES).findings.find((x) => x.rule === 'DR-1')!;
        expect(f.tier).toBe('advice');
        expect(f.engine).toBe('pgsql');
        expect(f.completeness).toBe('complete');
        expect(f.witnesses[0].at).toMatch(/^app\/Models\/(Comment|Post)\.php:\d+$/);
        expect(f.witnesses[1]).toMatchObject({ id: 'column:comments.post_id', at: expect.stringMatching(/create_comments_table\.php:\d+$/) });
        expect(f.witnesses[1]!.hash).toMatch(/^[0-9a-f]{8}$/);
    });

    it('does not flag a relation a foreign key backs', () => {
        expect(evaluateDrift(graph, DRIFT_RULES).findings.some((f) => f.rule === 'DR-1' && f.subject === 'column:posts.user_id')).toBe(false);
    });

    it('prints its basis first', () => {
        const lines = renderDrift(evaluateDrift(graph, DRIFT_RULES));
        expect(lines[0]).toMatch(new RegExp(`^basis: graph ${graph.source_checksum.slice(0, 12)} · vocabulary v\\d+ · ${new Set(DRIFT_RULES.map((x) => x.id)).size} rule\\(s\\) · 0 waiver\\(s\\)$`));
    });

    it('honours a waiver with a reason, and refuses one without', () => {
        const r = evaluateDrift(graph, DRIFT_RULES, [
            { rule: 'DR-4', subject: 'table:post_tag', reason: 'tags are in a later release' },
            { rule: 'DR-3', subject: 'app/Models/Tag.php#Tag', reason: '  ' },
        ]);
        expect(r.findings.find((f) => f.rule === 'DR-4')?.waived).toEqual({ reason: 'tags are in a later release' });
        expect(r.findings.find((f) => f.rule === 'DR-3')?.waived).toBeUndefined();
        expect(r.refused).toEqual(['waiver DR-3 on app/Models/Tag.php#Tag: a waiver needs a non-empty reason']);
        expect(r.basis.waivers).toBe(1);
    });

    it('a rule file change adds a finding without any engine change', () => {
        const file = path.join(dir, 'rules.json');
        fs.writeFileSync(file, JSON.stringify(DRIFT_RULES, null, 2));
        const before = evaluateDrift(graph, loadRules(file)).findings.length;
        const extra: DriftRule = {
            id: 'DR-12',
            lane: 'data',
            title: 'nullable timestamp column',
            tier: 'advice',
            select: { kind: 'column', attrs: { type: 'timestamp', nullable: true } },
            expect: { edge_to: '$self', relation: 'writes' },
            subject: '$self',
            message: '$self is nullable and nothing writes it',
        };
        fs.writeFileSync(file, JSON.stringify([...DRIFT_RULES, extra], null, 2));
        const after = evaluateDrift(graph, loadRules(file));
        expect(after.findings.length).toBeGreaterThan(before);
        expect(after.findings.some((f) => f.rule === 'DR-12' && f.subject === 'column:posts.deleted_at')).toBe(true);
    });

    it('refuses a gate rule without a precision and a rule outside its family', () => {
        expect(ruleError({ ...DRIFT_RULES[0]!, tier: 'gate' })).toMatch(/needs a recorded precision/);
        expect(ruleError({ ...DRIFT_RULES[0]!, id: 'IF-1' })).toMatch(/belongs to the interfaces lane/);
        expect(ruleError({ ...DRIFT_RULES[0]!, tier: 'gate', precision: 0.95 })).toBeNull();
        const r = evaluateDrift(graph, [{ ...DRIFT_RULES[0]!, tier: 'gate' }]);
        expect(r.findings).toEqual([]);
        expect(r.refused.length).toBe(1);
    });

    it('exempts what the rule exempts', () => {
        const poly = mergeLaneOutputs(graph, []).graph;
        const e = poly.edges.find((x) => x.relation === 'uses' && x.target === 'column:comments.post_id')!;
        const patched: CodeGraph = { ...poly, edges: poly.edges.map((x) => (x.relation === 'uses' && x.target === e.target ? { ...x, fact: { ...x.fact!, attrs: { ...x.fact!.attrs, kind: 'polymorphic' } } } : x)) };
        expect(evaluateDrift(patched, DRIFT_RULES).findings.some((f) => f.rule === 'DR-1')).toBe(false);
    });
});

describe('2.5 — an older graph stays readable', () => {
    it('loads and answers a schema-6 graph with no facts and no schema kinds', () => {
        const old: CodeGraph = {
            schema_version: 6,
            source_checksum: 'old',
            languages: ['typescript'],
            grammar_abi: 14,
            edge_confidence_counts: { EXTRACTED: 1, INFERRED: 0, AMBIGUOUS: 0 },
            suppressed_edge_counts: { dynamic_no_candidate: 0 },
            nodes: [
                { id: 'a.ts', label: 'a.ts', kind: 'file', source_file: 'a.ts', source_location: [] },
                { id: 'a.ts#f', label: 'f', kind: 'function', source_file: 'a.ts', source_location: [1, 1, 2, 1] },
            ],
            edges: [{ source: 'a.ts', target: 'a.ts#f', relation: 'member', confidence: 'EXTRACTED', resolved_via: 'same-file', provider: 'native' }],
        };
        const file = path.join(dir, 'old.json');
        fs.writeFileSync(file, JSON.stringify(old));
        const g = loadGraph(file);
        try {
            expect(g.out.get('a.ts')?.map((e) => e.target)).toEqual(['a.ts#f']);
            expect(g.byId.get('a.ts#f')?.fact).toBeUndefined();
        } finally {
            g.close();
        }
    });
});

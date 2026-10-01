/**
 * A foreign graph that detects must also load, and must never gate
 * (road-to-a-tree-that-keeps-its-neighbours Phase 3).
 *
 * The defect: `detect.ts` accepted a `links`-shaped consumer graph and
 * `query.ts` threw on it, so a consumer was told their graph was found and
 * then watched every verb crash. These fixtures pin the three halves of the
 * repair — it loads, its edges are guesses, and the gate verbs refuse it by
 * name instead of answering "nothing found" from a graph they trust nothing in.
 *
 * A hand-written graph literal is the right fixture HERE, unlike the native
 * verb tests which build through the real extractor: the subject is a shape
 * this package's extractor can never produce.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { consumerCandidates, detectSources } from '../../src/scripts/code_graph/detect.js';
import { adaptForeignGraph, isAllForeign, looksForeign } from '../../src/scripts/code_graph/foreign.js';
import { loadGraph } from '../../src/scripts/code_graph/query.js';
import { GUESS_RESOLVED_VIA } from '../../src/scripts/code_graph/types.js';
import { dead, impact, untested } from '../../src/scripts/code_graph/verbs.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const dirs: string[] = [];
const handles: Array<{ close: () => void }> = [];

function tmp(): string {
    const d = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'cg-foreign-'));
    dirs.push(d);
    return d;
}

afterEach(() => {
    while (handles.length > 0) handles.pop()?.close();
    while (dirs.length > 0) {
        const d = dirs.pop();
        if (d !== undefined) fs.rmSync(d, { recursive: true, force: true });
    }
});

/** A `links`-shaped graph of `n` nodes, as another tool would write one. */
function foreignDoc(n: number): Record<string, unknown> {
    const nodes = Array.from({ length: n }, (_, i) => ({
        id: `src/mod${i}.ts#fn${i}`,
        label: `fn${i}`,
        file: `src/mod${i}.ts`,
    }));
    const links = nodes.slice(1).map((node, i) => ({
        source: node.id,
        target: nodes[i]!.id,
        relation: i % 2 === 0 ? 'calls' : 'imports',
    }));
    return { nodes, links };
}

function writeForeign(doc: unknown): { dir: string; file: string } {
    const dir = tmp();
    const file = path.join(dir, 'graph.json');
    fs.writeFileSync(file, JSON.stringify(doc), 'utf-8');
    return { dir, file };
}

describe('looksForeign', () => {
    it('recognises the links shape', () => {
        expect(looksForeign({ nodes: [], links: [] })).toBe(true);
    });

    it('recognises an edges shape with no schema_version — ours always writes one', () => {
        expect(looksForeign({ nodes: [], edges: [] })).toBe(true);
    });

    it('leaves a native graph alone', () => {
        expect(looksForeign({ nodes: [], edges: [], schema_version: 4 })).toBe(false);
    });

    it('is not fooled by a document that is not a graph at all', () => {
        expect(looksForeign({ links: [] })).toBe(false);
        expect(looksForeign('a string')).toBe(false);
    });
});

describe('adaptForeignGraph (3.1)', () => {
    it('produces a graph the native validator accepts', () => {
        const r = adaptForeignGraph(foreignDoc(20));
        expect(r).not.toBeNull();
        expect(validateGraph(r?.graph).errors).toStrictEqual([]);
    });

    it('tags every edge foreign, and foreign is in the guess set', () => {
        const r = adaptForeignGraph(foreignDoc(20));
        expect(r?.graph.edges.every((e) => e.resolved_via === 'foreign')).toBe(true);
        expect(GUESS_RESOLVED_VIA.has('foreign')).toBe(true);
    });

    it('synthesises schema_version and a checksum of the document itself', () => {
        const a = adaptForeignGraph(foreignDoc(5));
        const b = adaptForeignGraph(foreignDoc(6));
        expect(a?.graph.schema_version).toBeTypeOf('number');
        expect(a?.graph.source_checksum).toMatch(/^[0-9a-f]{64}$/);
        expect(a?.graph.source_checksum).not.toBe(b?.graph.source_checksum);
    });

    it('COUNTS an unmapped relation and never guesses it into a native one', () => {
        const r = adaptForeignGraph({
            nodes: [{ id: 'a' }, { id: 'b' }],
            links: [{ source: 'a', target: 'b', relation: 'depends_on_somehow' }],
        });
        expect(r?.graph.edges).toStrictEqual([]);
        expect(r?.unmapped_relations).toStrictEqual({ depends_on_somehow: 1 });
    });

    it('counts an edge with a missing endpoint rather than dropping it silently', () => {
        const r = adaptForeignGraph({
            nodes: [{ id: 'a' }],
            links: [{ source: 'a', relation: 'calls' }, { source: 'nope', target: 'a', relation: 'calls' }],
        });
        expect(r?.malformed_edges).toBe(2);
    });

    it('records an empty source_location rather than inventing a line number', () => {
        const r = adaptForeignGraph({ nodes: [{ id: 'a' }], links: [] });
        expect(r?.graph.nodes[0]?.source_location).toStrictEqual([]);
    });

    it('answers null for a document with no node or edge list', () => {
        expect(adaptForeignGraph({ nodes: [] })).toBeNull();
        expect(adaptForeignGraph(null)).toBeNull();
    });
});

describe('loadGraph over a foreign file (3.1 verify)', () => {
    it('a 20-node links graph loads and answers with a resolved_via histogram', () => {
        const { file } = writeForeign(foreignDoc(20));
        const g = loadGraph(file, 'fixture');
        handles.push(g);
        expect(g.graph!.nodes).toHaveLength(20);
        expect(g.graph!.edges).toHaveLength(19);
        const histogram = new Map<string, number>();
        for (const e of g.graph!.edges) {
            histogram.set(e.resolved_via, (histogram.get(e.resolved_via) ?? 0) + 1);
        }
        expect([...histogram.entries()]).toStrictEqual([['foreign', 19]]);
        expect(g.byId.get('src/mod3.ts#fn3')?.label).toBe('fn3');
    });

    it('still throws on a document that is neither ours nor adaptable', () => {
        const { file } = writeForeign({ nodes: 'not an array', links: [] });
        expect(() => loadGraph(file, 'fixture')).toThrow(/invalid graph at/);
    });
});

describe('consumer-declared index paths (3.2)', () => {
    it('keeps the generic default list when nothing is declared', () => {
        expect(consumerCandidates(tmp())).toStrictEqual([
            'graph.json',
            'code-graph.json',
            '.code-graph/graph.json',
        ]);
    });

    it('extends the list from the project setting', () => {
        const dir = tmp();
        fs.mkdirSync(path.join(dir, 'agents', 'settings'), { recursive: true });
        fs.writeFileSync(
            path.join(dir, '.agent-settings.yml'),
            'code_graph:\n  consumer_index_paths:\n    - build/my-index.json\n',
            'utf-8',
        );
        expect(consumerCandidates(dir)).toContain('build/my-index.json');
    });

    it('drops an absolute path and one escaping the project root', () => {
        const dir = tmp();
        fs.writeFileSync(
            path.join(dir, '.agent-settings.yml'),
            'code_graph:\n  consumer_index_paths:\n    - /etc/passwd\n    - ../../elsewhere.json\n',
            'utf-8',
        );
        expect(consumerCandidates(dir)).toStrictEqual([
            'graph.json',
            'code-graph.json',
            '.code-graph/graph.json',
        ]);
    });

    it('a declared path is actually detected', () => {
        const dir = tmp();
        fs.writeFileSync(
            path.join(dir, '.agent-settings.yml'),
            'code_graph:\n  consumer_index_paths:\n    - build/idx.json\n',
            'utf-8',
        );
        fs.mkdirSync(path.join(dir, 'build'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'build', 'idx.json'), JSON.stringify(foreignDoc(3)), 'utf-8');
        const verdicts = detectSources(dir, path.join(dir, 'absent-cache.json'));
        expect(verdicts.some((v) => v.kind === 'consumer' && v.path.endsWith('build/idx.json'))).toBe(
            true,
        );
    });
});

describe('the gate verbs refuse an all-foreign graph (3.3)', () => {
    function foreignGraph(): ReturnType<typeof loadGraph> {
        const { file } = writeForeign(foreignDoc(20));
        const g = loadGraph(file, 'fixture');
        handles.push(g);
        return g;
    }

    it('untested refuses with a named reason', () => {
        const r = untested(foreignGraph(), ['src/mod1.ts'], 'fresh');
        expect(r.refusal_reason).toBe('foreign-edges-not-accepted');
        expect(r.refusal).toMatch(/did not build/);
        expect(r.untested).toStrictEqual([]);
        expect(r.tested).toStrictEqual([]);
    });

    it('impact refuses with a named reason', () => {
        const r = impact(foreignGraph(), ['src/mod1.ts'], 'fresh');
        expect(r.refusal_reason).toBe('foreign-edges-not-accepted');
        expect(r.dependents).toStrictEqual([]);
    });

    it('dead refuses with a named reason, before it even reads its entry points', () => {
        const r = dead(foreignGraph(), [], 'fresh');
        expect(r.refusal_reason).toBe('foreign-edges-not-accepted');
        expect(r.dead).toStrictEqual([]);
    });

    it('the refusal explains what an empty answer would have meant', () => {
        const r = impact(foreignGraph(), ['src/mod1.ts'], 'fresh');
        expect(r.refusal).toContain('nothing found');
        expect(r.refusal).toContain('nothing trusted');
    });

    it('isAllForeign is false for an empty graph — nothing to refuse', () => {
        expect(isAllForeign({ edges: [] } as never)).toBe(false);
    });

    it('a MIXED graph is not refused — the guess filter already excludes the foreign edges', () => {
        const g = foreignGraph();
        const mixed = {
            ...g,
            graph: {
                ...g.graph!,
                edges: [
                    ...g.graph!.edges,
                    { ...g.graph!.edges[0]!, resolved_via: 'import-specifier', provider: 'native' },
                ],
            },
        } as typeof g;
        expect(impact(mixed, ['src/mod1.ts'], 'fresh').refusal).toBeNull();
        expect(untested(mixed, ['src/mod1.ts'], 'fresh').refusal).toBeNull();
    });
});

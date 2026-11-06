import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { runEdgeOracle, scoreAgainstOracle } from '../../../internal/bench/code-graph/edge_oracle.js';
import { readScipIndex } from '../../../src/scripts/code_graph/scip_reader.js';

/** The SCIP wire subset `scip_reader.ts` reads — same shape as code_graph_scip.test.ts builds. */
function varint(n: number): number[] {
    const out: number[] = [];
    let v = n;
    while (v > 0x7f) {
        out.push((v & 0x7f) | 0x80);
        v = Math.floor(v / 128);
    }
    out.push(v);
    return out;
}
function field(num: number, wire: number, payload: number[]): number[] {
    return [...varint(num * 8 + wire), ...(wire === 2 ? varint(payload.length) : []), ...payload];
}
const str = (s: string): number[] => [...Buffer.from(s, 'utf-8')];
function occurrence(line: number, symbol: string, definition: boolean): number[] {
    return [
        ...field(1, 2, [...varint(line), ...varint(0), ...varint(5)]),
        ...field(2, 2, str(symbol)),
        ...(definition ? field(3, 0, varint(1)) : []),
    ];
}
function scipIndex(docs: Array<{ path: string; occ: number[][] }>): Buffer {
    const bytes: number[] = [...field(1, 2, str('metadata'))];
    for (const d of docs) bytes.push(...field(2, 2, [...field(1, 2, str(d.path)), ...d.occ.flatMap((o) => field(2, 2, o))]));
    return Buffer.from(bytes);
}

const sym = (file: string, name: string): string => `scip-typescript npm fixture 1.0 \`${file}\`/${name}().`;

const node = (id: string, kind: string, loc: number[]) => ({ id, label: id.split('#')[1] ?? id, kind, source_file: id.split('#')[0] as string, source_location: loc });
const edge = (source: string, target: string, relation: string, resolved_via: string) => ({
    source,
    target,
    relation,
    confidence: 'EXTRACTED',
    resolved_via,
    provider: 'native',
});

/**
 * a.ts imports `helper` from b.ts (line 1), calls it inside `run` (line 3) and
 * calls `util` from d.ts (line 4). c.ts declares a second `helper` nobody calls.
 */
const index = scipIndex([
    {
        path: 'a.ts',
        occ: [
            occurrence(0, sym('b.ts', 'helper'), false),
            occurrence(2, sym('b.ts', 'helper'), false),
            occurrence(3, sym('d.ts', 'util'), false),
            occurrence(3, sym('node_modules/lib/index.d.ts', 'vendor'), false),
            occurrence(3, 'local 4', false),
        ],
    },
    { path: 'b.ts', occ: [occurrence(0, sym('b.ts', 'helper'), true)] },
    { path: 'c.ts', occ: [occurrence(0, sym('c.ts', 'helper'), true)] },
    { path: 'd.ts', occ: [occurrence(0, sym('d.ts', 'util'), true)] },
    { path: 'node_modules/lib/index.d.ts', occ: [occurrence(0, sym('node_modules/lib/index.d.ts', 'vendor'), true)] },
]);

const graph = {
    nodes: [
        node('a.ts', 'file', []),
        node('a.ts#run', 'function', [2, 0, 4, 1]),
        node('b.ts', 'file', []),
        node('b.ts#helper', 'function', [1, 0, 1, 20]),
        node('c.ts', 'file', []),
        node('c.ts#helper', 'function', [1, 0, 1, 20]),
        node('d.ts', 'file', []),
        node('d.ts#util', 'function', [1, 0, 1, 20]),
        node('e.php', 'file', []),
        node('e.php#go', 'function', [1, 0, 3, 1]),
    ],
    edges: [
        // Stated, and the oracle sees a.ts reference b.ts#helper.
        edge('a.ts', 'b.ts#helper', 'imports', 'import-specifier'),
        // Guessed onto the wrong same-named callable: the oracle refutes it.
        edge('a.ts#run', 'c.ts#helper', 'calls', 'name-lookup'),
        // Not scored: unresolved, vendored target, a file the oracle never indexed, a non-reference relation.
        edge('a.ts#run', 'symbol:strlen', 'calls', 'name-lookup'),
        edge('a.ts', 'node_modules/lib/index.d.ts#vendor', 'imports', 'import-specifier'),
        edge('e.php#go', 'a.ts#run', 'calls', 'name-lookup'),
        edge('a.ts', 'a.ts#run', 'member', 'same-file'),
    ],
};

describe('scoreAgainstOracle', () => {
    const r = scoreAgainstOracle(graph as never, readScipIndex(index));

    it('confirms the import-specifier edge the oracle states, at file and symbol level', () => {
        expect(r.by_mechanism['import-specifier']).toMatchObject({
            graph_edges: 1,
            scored: 1,
            confirmed_file: 1,
            precision_file: 1,
            symbol_scored: 1,
            confirmed_symbol: 1,
            precision_symbol: 1,
        });
    });

    it('refutes the name-lookup edge the oracle does not see', () => {
        expect(r.by_mechanism['name-lookup']).toMatchObject({ scored: 1, confirmed_file: 0, precision_file: 0, confirmed_symbol: 0 });
    });

    it('keeps out-of-root, vendored, unresolved and un-indexed edges out of the denominators', () => {
        expect(r.excluded).toMatchObject({ unresolved_target: 1, out_of_root: 1, outside_oracle_coverage: 1 });
        // The un-indexed PHP caller is a graph edge of the mechanism, but not a scored one.
        expect(r.by_mechanism['name-lookup']).toMatchObject({ graph_edges: 2, scored: 1 });
        expect(r.by_mechanism['same-file']).toBeUndefined();
    });

    it('reports the oracle reference the graph lacks, by kind, and recall against the oracle', () => {
        expect(r.oracle.file_pairs).toBe(2);
        expect(r.recall_file).toBe(0.5);
        expect(r.recall_symbol).toBe(0.5);
        expect(r.missing_by_kind).toEqual({ method: 1 });
        expect(r.missing_examples).toEqual([{ source_file: 'a.ts', target_file: 'd.ts', kind: 'method' }]);
    });

    it('narrows both sides to a path prefix', () => {
        const scoped = scoreAgainstOracle(graph as never, readScipIndex(index), { prefix: 'b.ts' });
        expect(scoped.oracle.file_pairs).toBe(0);
        expect(Object.keys(scoped.by_mechanism)).toEqual([]);
    });
});

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('runEdgeOracle', () => {
    it('exits non-zero naming the indexer and its install command when neither --scip nor scip-typescript is available', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-oracle-'));
        dirs.push(root);
        fs.writeFileSync(path.join(root, 'graph.json'), JSON.stringify(graph));
        const err: string[] = [];
        const code = runEdgeOracle(['--root', root, '--graph', path.join(root, 'graph.json')], {
            pathEnv: root,
            stderr: (s) => err.push(s),
            stdout: () => undefined,
        });
        expect(code).not.toBe(0);
        expect(err.join('')).toContain('scip-typescript');
        expect(err.join('')).toContain('npm i -g @sourcegraph/scip-typescript');
    });

    it('writes markdown and JSON when given an index', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-oracle-'));
        dirs.push(root);
        fs.writeFileSync(path.join(root, 'graph.json'), JSON.stringify(graph));
        fs.writeFileSync(path.join(root, 'index.scip'), index);
        const out: string[] = [];
        const code = runEdgeOracle(
            ['--root', root, '--graph', path.join(root, 'graph.json'), '--scip', path.join(root, 'index.scip'), '--out', path.join(root, 'report.md')],
            { pathEnv: '', stderr: () => undefined, stdout: (s) => out.push(s) },
        );
        expect(code).toBe(0);
        const json = JSON.parse(out.join(''));
        expect(json.typescript.by_mechanism['import-specifier'].precision_file).toBe(1);
        expect(json.php).toBeNull();
        const md = fs.readFileSync(path.join(root, 'report.md'), 'utf8');
        expect(md).toContain('| `name-lookup` |');
        expect(md).toContain('never an arm or a provider');
    });
});

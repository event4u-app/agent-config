import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { runEdgeOracle, scorePhpAgainstPsalm, type PhpOracle } from '../../../internal/bench/code-graph/edge_oracle.js';
import { phpSymbolMap } from '../../../internal/bench/code-graph/php_edge_oracle.js';

const node = (id: string, kind: string, loc: number[]) => ({ id, label: id.split('#')[1]?.split('::').pop() ?? id, kind, source_file: id.split('#')[0] as string, source_location: loc });
const edge = (source: string, target: string, relation: string, resolved_via: string) => ({ source, target, relation, confidence: 'EXTRACTED', resolved_via, provider: 'native' });

/**
 * A::run calls B::help (line 7) and imports B (line 2); a name-lookup guess also
 * sends it to C::help, which nothing calls. D.php calls B::help and the graph
 * lacks that edge. lang/x.php was left out of the Psalm analysis.
 */
const graph = {
    nodes: [
        node('app/A.php', 'file', []),
        node('app/A.php#A', 'class', [4, 1, 12, 2]),
        node('app/A.php#A::run', 'method', [5, 5, 10, 6]),
        node('app/B.php#B', 'class', [3, 1, 7, 2]),
        node('app/B.php#B::help', 'method', [4, 5, 6, 6]),
        node('app/C.php#C', 'class', [3, 1, 7, 2]),
        node('app/C.php#C::help', 'method', [4, 5, 6, 6]),
        node('app/D.php#D', 'class', [2, 1, 5, 2]),
        node('lang/x.php', 'file', []),
    ],
    edges: [
        edge('app/A.php#A::run', 'app/B.php#B::help', 'calls', 'import-specifier'),
        edge('app/A.php#A::run', 'app/C.php#C::help', 'calls', 'name-lookup'),
        edge('app/A.php', 'app/B.php', 'imports', 'psr4'),
        edge('lang/x.php', 'app/B.php#B::help', 'calls', 'name-lookup'),
        edge('app/A.php#A::run', 'symbol:foo', 'calls', 'dynamic'),
        edge('app/A.php#A::run', 'app/B.php#B', 'routes-to', 'lane-read'),
        edge('app/A.php#A', 'app/A.php#A::run', 'member', 'same-file'),
    ],
};

const oracle: PhpOracle = {
    symbol_of: {
        'app/B.php#B': 'App\\B',
        'app/B.php': 'App\\B',
        'app/B.php#B::help': 'App\\B::help',
        'app/C.php#C::help': 'App\\C::help',
    },
    sites: {
        'App\\B::help': [
            { file: 'app/A.php', line: 7 },
            { file: 'app/D.php', line: 3 },
        ],
        'App\\B': [{ file: 'app/A.php', line: 2 }],
        'App\\C::help': [],
    },
    analyzed: ['app/A.php', 'app/B.php', 'app/C.php', 'app/D.php'],
};

describe('scorePhpAgainstPsalm', () => {
    const r = scorePhpAgainstPsalm(graph as never, oracle);

    it('confirms a call Psalm saw from the source method and refutes a name-lookup guess', () => {
        expect(r.by_mechanism['import-specifier']).toMatchObject({ scored: 1, confirmed_file: 1, precision_file: 1, symbol_scored: 1, confirmed_symbol: 1 });
        expect(r.by_mechanism['name-lookup']).toMatchObject({ graph_edges: 2, scored: 1, confirmed_file: 0, precision_file: 0, confirmed_symbol: 0 });
    });

    it('scores a file-target import through the file’s one class, at file level only', () => {
        expect(r.by_mechanism['psr4']).toMatchObject({ scored: 1, confirmed_file: 1, symbol_scored: 0, precision_symbol: null });
    });

    it('counts a source Psalm did not analyse as outside coverage, never as refuted', () => {
        expect(r.excluded).toMatchObject({ outside_oracle_coverage: 1, unresolved_target: 1, not_reference_relation: 2 });
    });

    it('measures recall over the cross-file pairs Psalm reports for the mapped symbols', () => {
        // Pairs: A→B (two symbols) and D→B. The graph covers A→B only.
        expect(r.oracle.file_pairs).toBe(2);
        expect(r.recall_file).toBe(0.5);
        // Symbol pairs: A→B::help, A→B, D→B::help; the graph covers A→B::help.
        expect(r.oracle.symbol_pairs).toBe(3);
        expect(r.recall_symbol).toBeCloseTo(1 / 3);
        expect(r.missing_by_kind).toEqual({ method: 1 });
    });

    it('does not let a site outside the source method confirm it at symbol level', () => {
        const moved: PhpOracle = { ...oracle, sites: { ...oracle.sites, 'App\\B::help': [{ file: 'app/A.php', line: 11 }] } };
        const m = scorePhpAgainstPsalm(graph as never, moved).by_mechanism['import-specifier'];
        expect(m).toMatchObject({ confirmed_file: 1, confirmed_symbol: 0 });
    });
});

describe('phpSymbolMap', () => {
    it('keeps a node only when Psalm’s enclosing symbol names it, and maps a one-class file', () => {
        const nodes = [
            node('app/B.php#B', 'class', [3, 1, 7, 2]),
            node('app/B.php#B::help', 'method', [4, 5, 6, 6]),
            node('app/E.php#E', 'class', [3, 1, 4, 2]),
            node('app/E.php#F', 'class', [5, 1, 6, 2]),
            node('app/G.php#G::gone', 'method', [9, 5, 9, 9]),
            // Psalm records no reference location for a global function.
            node('tests/H.php#helper', 'function', [3, 1, 5, 2]),
        ];
        const enclosing = new Map([
            ['app/B.php:3', 'App\\B'],
            ['app/B.php:4', 'App\\B::HELP'],
            ['app/E.php:3', 'App\\E'],
            ['app/E.php:5', 'App\\F'],
            ['app/G.php:9', 'App\\G'],
            ['tests/H.php:3', 'helper'],
        ]);
        expect(phpSymbolMap(nodes as never, enclosing)).toEqual({
            'app/B.php#B': 'App\\B',
            'app/B.php#B::help': 'App\\B::HELP',
            'app/B.php': 'App\\B',
            'app/E.php#E': 'App\\E',
            'app/E.php#F': 'App\\F',
        });
    });
});

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('runEdgeOracle --php-oracle', () => {
    it('scores PHP alone when no SCIP index is given, without asking for the TypeScript indexer', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-php-oracle-'));
        dirs.push(root);
        fs.writeFileSync(path.join(root, 'graph.json'), JSON.stringify(graph));
        fs.writeFileSync(path.join(root, 'php.json'), JSON.stringify(oracle));
        const out: string[] = [];
        const code = runEdgeOracle(
            ['--root', root, '--graph', path.join(root, 'graph.json'), '--php-oracle', path.join(root, 'php.json'), '--out', path.join(root, 'r.md')],
            { pathEnv: '', stderr: () => undefined, stdout: (s) => out.push(s) },
        );
        expect(code).toBe(0);
        const json = JSON.parse(out.join(''));
        expect(json.php.by_mechanism['import-specifier'].precision_file).toBe(1);
        expect(json.typescript).toBeNull();
        expect(fs.readFileSync(path.join(root, 'r.md'), 'utf8')).toContain('Psalm');
    });
});

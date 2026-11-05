#!/usr/bin/env tsx
/**
 * Edge precision and recall per `resolved_via`, against a SCIP oracle for
 * TypeScript/JavaScript and a Psalm oracle for PHP (road-to-a-graph-that-wins 2.6).
 *
 *   tsx internal/bench/code-graph/edge_oracle.ts --root <dir> --graph <graph.json>
 *       [--scip <index.scip>] [--php-oracle <php-oracle.json>] [--prefix src/scripts/]
 *       [--out report.md] [--json report.json]
 *
 * `--php-oracle` is the file `php_edge_oracle.ts` writes; given alone, only PHP is
 * scored and no TypeScript indexer is looked for.
 *
 * The oracle is a measuring instrument that lives under `internal/bench/` only:
 * never an arm, never a provider (K1). Its index comes from an indexer the
 * maintainer installed; this runner never fetches one (ADR-259). Without
 * `--scip` it runs `scip-typescript` from PATH, and without that it exits
 * naming the indexer and the install command.
 *
 * Scored relations are the ones that assert "this code names that code" —
 * the claim a compiler's reference index can confirm or refute:
 * `calls imports uses inherits references injects tests`. Left out: `member`
 * (containment, true by construction) and every lane relation (`routes-to`,
 * `renders`, `reads`, `migrates`, …), whose evidence is a string or a framework
 * table a TypeScript reference index cannot see.
 *
 * A graph edge is scored only when both its files are documents of the index —
 * a PHP caller under a TypeScript oracle is outside coverage, not refuted.
 * `confirmed_file`: the oracle has a reference from the source file into the
 * target file. `confirmed_symbol` (targets that are symbols, not files): the
 * oracle has a reference from the source file onto that exact node, mapped with
 * `scipEdges` from the graph's own node ranges. Recall is over cross-file oracle
 * pairs. Out-of-root and `node_modules` paths are dropped on both sides.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { alignScipLinesUnder, readScipIndex, scipEdges, type ScipDocument } from '../../../src/scripts/code_graph/scip_reader.js';
import type { CodeGraph } from '../../../src/scripts/code_graph/types.js';
import { edgeCensus, type EdgeCensus } from './edge_census.js';

export const REFERENCE_RELATIONS: ReadonlySet<string> = new Set(['calls', 'imports', 'uses', 'inherits', 'references', 'injects', 'tests']);

export const INDEXER = 'scip-typescript';
export const INDEXER_INSTALL = 'npm i -g @sourcegraph/scip-typescript';

export interface MechanismScore {
    graph_edges: number;
    scored: number;
    confirmed_file: number;
    precision_file: number | null;
    symbol_scored: number;
    confirmed_symbol: number;
    precision_symbol: number | null;
    /** Cross-file oracle pairs at least one edge of this mechanism covers. */
    oracle_pairs_covered: number;
}

export interface OracleScore {
    by_mechanism: Record<string, MechanismScore>;
    excluded: {
        unresolved_target: number;
        out_of_root: number;
        outside_prefix: number;
        not_reference_relation: number;
        outside_oracle_coverage: number;
    };
    oracle: { documents: number; file_pairs: number; symbol_pairs: number };
    recall_file: number | null;
    recall_symbol: number | null;
    missing_by_kind: Record<string, number>;
    missing_examples: Array<{ source_file: string; target_file: string; kind: string }>;
}

const MAX_EXAMPLES = 20;

const fileOf = (id: string): string => id.split('#')[0] as string;

function inRoot(file: string): boolean {
    if (!file || path.isAbsolute(file) || file === '..' || file.startsWith('../')) return false;
    return !file.split('/').includes('node_modules');
}

/** The kind a SCIP symbol names, read off its last descriptor suffix. */
export function scipKind(symbol: string): string {
    if (symbol.endsWith(').')) return 'method';
    if (symbol.endsWith('#')) return 'type';
    if (symbol.endsWith('/')) return 'namespace';
    if (symbol.endsWith(':')) return 'meta';
    if (symbol.endsWith('.')) return 'term';
    return 'other';
}

const ratio = (n: number, d: number): number | null => (d === 0 ? null : n / d);

export function scoreAgainstOracle(
    graph: Pick<CodeGraph, 'nodes' | 'edges'>,
    docs: readonly ScipDocument[],
    opts: { prefix?: string } = {},
): OracleScore {
    const prefix = opts.prefix ?? '';
    const indexed = new Set(docs.map((d) => d.path).filter(inRoot));

    // Oracle, file level: every in-root reference, same-file included (for confirmation).
    const defFile = new Map<string, string>();
    for (const d of docs)
        for (const o of d.occurrences)
            if (o.definition && o.symbol && !o.symbol.startsWith('local ') && !defFile.has(o.symbol)) defFile.set(o.symbol, d.path);
    const oracleFilePairs = new Set<string>();
    const crossKinds = new Map<string, Set<string>>();
    for (const d of docs) {
        if (!inRoot(d.path)) continue;
        for (const o of d.occurrences) {
            if (o.definition || !o.symbol || o.symbol.startsWith('local ')) continue;
            const tf = defFile.get(o.symbol);
            if (tf === undefined || !inRoot(tf)) continue;
            const key = `${d.path}\0${tf}`;
            oracleFilePairs.add(key);
            if (tf === d.path || !d.path.startsWith(prefix)) continue;
            const kinds = crossKinds.get(key) ?? new Set<string>();
            kinds.add(scipKind(o.symbol));
            crossKinds.set(key, kinds);
        }
    }

    // Oracle, symbol level: the target node the reference lands on, per source file.
    const oracleTargets = new Map<string, Set<string>>();
    for (const e of scipEdges(docs, graph.nodes)) {
        const sf = fileOf(e.source);
        if (!inRoot(sf) || !inRoot(fileOf(e.target))) continue;
        const set = oracleTargets.get(sf) ?? new Set<string>();
        set.add(e.target);
        oracleTargets.set(sf, set);
    }
    const oracleSymbolPairs = new Set<string>();
    for (const [sf, targets] of oracleTargets) {
        if (!sf.startsWith(prefix)) continue;
        for (const t of targets) if (t.includes('#') && fileOf(t) !== sf) oracleSymbolPairs.add(`${sf}\0${t}`);
    }

    const excluded = { unresolved_target: 0, out_of_root: 0, outside_prefix: 0, not_reference_relation: 0, outside_oracle_coverage: 0 };
    const by: Record<string, MechanismScore> = {};
    const coveredBy = new Map<string, Set<string>>();
    const graphFilePairs = new Set<string>();
    const graphSymbolPairs = new Set<string>();
    for (const e of graph.edges) {
        if (e.target.startsWith('symbol:')) {
            excluded.unresolved_target++;
            continue;
        }
        const sf = fileOf(e.source);
        const tf = fileOf(e.target);
        if (!inRoot(sf) || !inRoot(tf)) {
            excluded.out_of_root++;
            continue;
        }
        if (!sf.startsWith(prefix)) {
            excluded.outside_prefix++;
            continue;
        }
        if (!REFERENCE_RELATIONS.has(e.relation)) {
            excluded.not_reference_relation++;
            continue;
        }
        const m = (by[e.resolved_via] ??= {
            graph_edges: 0,
            scored: 0,
            confirmed_file: 0,
            precision_file: null,
            symbol_scored: 0,
            confirmed_symbol: 0,
            precision_symbol: null,
            oracle_pairs_covered: 0,
        });
        m.graph_edges++;
        if (!indexed.has(sf) || !indexed.has(tf)) {
            excluded.outside_oracle_coverage++;
            continue;
        }
        m.scored++;
        const fileKey = `${sf}\0${tf}`;
        graphFilePairs.add(fileKey);
        if (oracleFilePairs.has(fileKey)) {
            m.confirmed_file++;
            if (sf !== tf) {
                const set = coveredBy.get(e.resolved_via) ?? new Set<string>();
                set.add(fileKey);
                coveredBy.set(e.resolved_via, set);
            }
        }
        if (e.target.includes('#')) {
            m.symbol_scored++;
            graphSymbolPairs.add(`${sf}\0${e.target}`);
            if (oracleTargets.get(sf)?.has(e.target)) m.confirmed_symbol++;
        }
    }
    for (const [via, m] of Object.entries(by)) {
        m.precision_file = ratio(m.confirmed_file, m.scored);
        m.precision_symbol = ratio(m.confirmed_symbol, m.symbol_scored);
        m.oracle_pairs_covered = coveredBy.get(via)?.size ?? 0;
    }

    const missing_by_kind: Record<string, number> = {};
    const missing_examples: OracleScore['missing_examples'] = [];
    let coveredFile = 0;
    for (const key of [...crossKinds.keys()].sort()) {
        if (graphFilePairs.has(key)) {
            coveredFile++;
            continue;
        }
        const [source_file, target_file] = key.split('\0') as [string, string];
        for (const kind of [...(crossKinds.get(key) as Set<string>)].sort()) {
            missing_by_kind[kind] = (missing_by_kind[kind] ?? 0) + 1;
            if (missing_examples.length < MAX_EXAMPLES) missing_examples.push({ source_file, target_file, kind });
        }
    }
    let coveredSymbol = 0;
    for (const key of oracleSymbolPairs) if (graphSymbolPairs.has(key)) coveredSymbol++;

    return {
        by_mechanism: Object.fromEntries(Object.entries(by).sort((a, b) => (a[0] < b[0] ? -1 : 1))),
        excluded,
        oracle: { documents: indexed.size, file_pairs: crossKinds.size, symbol_pairs: oracleSymbolPairs.size },
        recall_file: ratio(coveredFile, crossKinds.size),
        recall_symbol: ratio(coveredSymbol, oracleSymbolPairs.size),
        missing_by_kind,
        missing_examples,
    };
}

/**
 * The PHP oracle, written by `php_edge_oracle.ts` from one Psalm analysis:
 * `symbol_of` maps a graph node id (or a one-class file id) to the Psalm symbol
 * it declares, `sites` holds Psalm's reference sites per symbol, `analyzed` the
 * PHP files the analysis covered.
 */
export interface PhpOracle {
    symbol_of: Record<string, string>;
    sites: Record<string, Array<{ file: string; line: number }>>;
    analyzed: string[];
}

const emptyMechanism = (): MechanismScore => ({
    graph_edges: 0,
    scored: 0,
    confirmed_file: 0,
    precision_file: null,
    symbol_scored: 0,
    confirmed_symbol: 0,
    precision_symbol: null,
    oracle_pairs_covered: 0,
});

/**
 * PHP edges against Psalm references. An edge is scored when its source file
 * was analysed and its target maps to a Psalm symbol; `confirmed_file` when
 * Psalm has a reference to that symbol in the source file, `confirmed_symbol`
 * (symbol targets) when that reference lies inside the source node's range.
 * Recall is over the cross-file pairs Psalm reports for the mapped symbols —
 * the graph's own declarations, so a symbol the graph never declared is
 * outside it.
 */
export function scorePhpAgainstPsalm(graph: Pick<CodeGraph, 'nodes' | 'edges'>, oracle: PhpOracle, opts: { prefix?: string } = {}): OracleScore {
    const prefix = opts.prefix ?? '';
    const analyzed = new Set(oracle.analyzed);
    const range = new Map(graph.nodes.map((n) => [n.id, n.source_location]));
    const kindOf = new Map(graph.nodes.map((n) => [n.id, n.kind]));
    const sitesOf = (id: string): Array<{ file: string; line: number }> => {
        const s = oracle.symbol_of[id];
        return s === undefined ? [] : (oracle.sites[s] ?? []);
    };

    const excluded = { unresolved_target: 0, out_of_root: 0, outside_prefix: 0, not_reference_relation: 0, outside_oracle_coverage: 0 };
    const by: Record<string, MechanismScore> = {};
    const coveredBy = new Map<string, Set<string>>();
    const graphFilePairs = new Set<string>();
    const graphSymbolPairs = new Set<string>();
    for (const e of graph.edges) {
        if (e.target.startsWith('symbol:')) {
            excluded.unresolved_target++;
            continue;
        }
        const sf = fileOf(e.source);
        const tf = fileOf(e.target);
        if (!inRoot(sf) || !inRoot(tf)) {
            excluded.out_of_root++;
            continue;
        }
        if (!sf.startsWith(prefix)) {
            excluded.outside_prefix++;
            continue;
        }
        if (!REFERENCE_RELATIONS.has(e.relation)) {
            excluded.not_reference_relation++;
            continue;
        }
        if (!sf.endsWith('.php') || !tf.endsWith('.php')) continue;
        const m = (by[e.resolved_via] ??= emptyMechanism());
        m.graph_edges++;
        if (!analyzed.has(sf) || oracle.symbol_of[e.target] === undefined) {
            excluded.outside_oracle_coverage++;
            continue;
        }
        m.scored++;
        const fileKey = `${sf}\0${tf}`;
        graphFilePairs.add(fileKey);
        const inSource = sitesOf(e.target).filter((s) => s.file === sf);
        if (inSource.length > 0) {
            m.confirmed_file++;
            if (sf !== tf) {
                const set = coveredBy.get(e.resolved_via) ?? new Set<string>();
                set.add(fileKey);
                coveredBy.set(e.resolved_via, set);
            }
        }
        if (e.target.includes('#')) {
            m.symbol_scored++;
            graphSymbolPairs.add(`${sf}\0${e.target}`);
            const loc = range.get(e.source) ?? [];
            const within = e.source.includes('#') && loc.length >= 3 ? (l: number) => (loc[0] as number) <= l && l <= (loc[2] as number) : () => true;
            if (inSource.some((s) => within(s.line))) m.confirmed_symbol++;
        }
    }
    for (const [via, m] of Object.entries(by)) {
        m.precision_file = ratio(m.confirmed_file, m.scored);
        m.precision_symbol = ratio(m.confirmed_symbol, m.symbol_scored);
        m.oracle_pairs_covered = coveredBy.get(via)?.size ?? 0;
    }

    const crossKinds = new Map<string, Set<string>>();
    const oracleSymbolPairs = new Set<string>();
    for (const id of Object.keys(oracle.symbol_of)) {
        const tf = fileOf(id);
        for (const s of sitesOf(id)) {
            if (s.file === tf || !inRoot(s.file) || !s.file.startsWith(prefix) || !analyzed.has(s.file)) continue;
            const key = `${s.file}\0${tf}`;
            const kinds = crossKinds.get(key) ?? new Set<string>();
            if (id.includes('#')) {
                kinds.add(kindOf.get(id) ?? 'other');
                oracleSymbolPairs.add(`${s.file}\0${id}`);
            }
            crossKinds.set(key, kinds);
        }
    }
    const missing_by_kind: Record<string, number> = {};
    const missing_examples: OracleScore['missing_examples'] = [];
    let coveredFile = 0;
    for (const key of [...crossKinds.keys()].sort()) {
        if (graphFilePairs.has(key)) {
            coveredFile++;
            continue;
        }
        const [source_file, target_file] = key.split('\0') as [string, string];
        for (const kind of [...(crossKinds.get(key) as Set<string>)].sort()) {
            missing_by_kind[kind] = (missing_by_kind[kind] ?? 0) + 1;
            if (missing_examples.length < MAX_EXAMPLES) missing_examples.push({ source_file, target_file, kind });
        }
    }
    let coveredSymbol = 0;
    for (const key of oracleSymbolPairs) if (graphSymbolPairs.has(key)) coveredSymbol++;

    return {
        by_mechanism: Object.fromEntries(Object.entries(by).sort((a, b) => (a[0] < b[0] ? -1 : 1))),
        excluded,
        oracle: { documents: analyzed.size, file_pairs: crossKinds.size, symbol_pairs: oracleSymbolPairs.size },
        recall_file: ratio(coveredFile, crossKinds.size),
        recall_symbol: ratio(coveredSymbol, oracleSymbolPairs.size),
        missing_by_kind,
        missing_examples,
    };
}

const pct = (v: number | null): string => (v === null ? '—' : `${(v * 100).toFixed(1)} %`);

export interface ReportMeta {
    root: string;
    graph: string;
    prefix: string;
    census: EdgeCensus;
    /** Index path and indexer, or null when no TypeScript oracle ran. */
    scip: { path: string; indexer: string } | null;
    php_oracle: string | null;
}

export function renderMarkdown(report: { typescript: OracleScore | null; php: OracleScore | null }, meta: ReportMeta): string {
    const lines = [
        '# Edge precision and recall against a compiler-grade oracle',
        '',
        `Root \`${meta.root}\` · graph \`${meta.graph}\`${meta.prefix ? ` · prefix \`${meta.prefix}\`` : ''}.`,
        'The oracle is a measuring instrument under `internal/bench/`, never an arm or a provider (K1);',
        'its indexes were produced by indexers the maintainer installed, never fetched (ADR-259).',
        `Scored relations: ${[...REFERENCE_RELATIONS].map((x) => `\`${x}\``).join(', ')}.`,
        `Census (same graph): name_lookup_calls ${meta.census.name_lookup_calls}, name_lookup_multi ${meta.census.name_lookup_multi}, name_collision_edges ${meta.census.name_collision_edges}.`,
        '',
    ];
    if (report.typescript && meta.scip) lines.push(...renderSection(`TypeScript / JavaScript — SCIP index \`${meta.scip.path}\` (${meta.scip.indexer})`, report.typescript));
    else lines.push('## TypeScript / JavaScript', '', 'Not measured: no SCIP index was given.', '');
    if (report.php && meta.php_oracle) lines.push(...renderSection(`PHP — Psalm references \`${meta.php_oracle}\``, report.php));
    else lines.push('## PHP', '', 'Not measured: no Psalm oracle was given (`--php-oracle`).', '');
    return lines.join('\n');
}

function renderSection(title: string, r: OracleScore): string[] {
    const lines = [
        `## ${title}`,
        '',
        '| `resolved_via` | graph edges | scored | confirmed (file) | precision (file) | symbol-scored | confirmed (symbol) | precision (symbol) | oracle pairs covered |',
        '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
    ];
    for (const [via, m] of Object.entries(r.by_mechanism)) {
        lines.push(
            `| \`${via}\` | ${m.graph_edges} | ${m.scored} | ${m.confirmed_file} | ${pct(m.precision_file)} | ${m.symbol_scored} | ${m.confirmed_symbol} | ${pct(m.precision_symbol)} | ${m.oracle_pairs_covered} |`,
        );
    }
    lines.push(
        '',
        `Oracle: ${r.oracle.documents} documents, ${r.oracle.file_pairs} cross-file pairs, ${r.oracle.symbol_pairs} cross-file symbol pairs.`,
        `Recall (file): ${pct(r.recall_file)} · recall (symbol): ${pct(r.recall_symbol)}.`,
        '',
        `Excluded: ${Object.entries(r.excluded)
            .map(([k, v]) => `${k} ${v}`)
            .join(' · ')}.`,
        '',
        '### Oracle pairs the graph lacks, by kind',
        '',
        '| kind | missing |',
        '|---|---:|',
        ...Object.entries(r.missing_by_kind)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `| ${k} | ${v} |`),
        '',
        ...r.missing_examples.map((x) => `- \`${x.source_file}\` → \`${x.target_file}\` (${x.kind})`),
        '',
    );
    return lines;
}

export function findOnPath(name: string, pathEnv: string): string | null {
    for (const dir of pathEnv.split(path.delimiter)) {
        if (!dir) continue;
        const candidate = path.join(dir, name);
        try {
            fs.accessSync(candidate, fs.constants.X_OK);
            if (fs.statSync(candidate).isFile()) return candidate;
        } catch {
            // not here
        }
    }
    return null;
}

export interface OracleIo {
    pathEnv: string;
    stdout: (s: string) => void;
    stderr: (s: string) => void;
}

function parseArgs(argv: readonly string[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (!a.startsWith('--')) continue;
        const v = argv[i + 1];
        if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
        out[a.slice(2)] = v;
        i++;
    }
    return out;
}

export function runEdgeOracle(argv: readonly string[], io: OracleIo): number {
    let args: Record<string, string>;
    try {
        args = parseArgs(argv);
    } catch (e) {
        io.stderr(`edge_oracle: ${(e as Error).message}\n`);
        return 2;
    }
    const root = args.root;
    const graphPath = args.graph;
    if (!root || !graphPath) {
        io.stderr('usage: edge_oracle.ts --root <dir> --graph <graph.json> [--scip <index.scip>] [--php-oracle <php-oracle.json>] [--prefix <path>] [--out <md>] [--json <json>]\n');
        return 2;
    }
    const phpPath = args['php-oracle'] ?? null;
    let scipPath = args.scip;
    let indexer = 'supplied with --scip';
    if (!scipPath && phpPath === null) {
        const bin = findOnPath(INDEXER, io.pathEnv);
        if (!bin) {
            io.stderr(
                `edge_oracle: no oracle index. Pass --scip <index.scip>, or install the indexer \`${INDEXER}\` yourself (\`${INDEXER_INSTALL}\`) — this runner never fetches one (ADR-259).\n`,
            );
            return 3;
        }
        scipPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'edge-oracle-')), 'index.scip');
        const inferArgs = fs.existsSync(path.join(root, 'tsconfig.json')) ? [] : ['--infer-tsconfig'];
        const res = spawnSync(bin, ['index', '--output', scipPath, ...inferArgs], { cwd: root, encoding: 'utf8' });
        if (res.status !== 0 || !fs.existsSync(scipPath)) {
            io.stderr(`edge_oracle: ${INDEXER} failed (exit ${String(res.status)}): ${(res.stderr ?? '').slice(-2000)}\n`);
            return 4;
        }
        indexer = `${bin}`;
    }
    const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8')) as CodeGraph;
    const prefix = args.prefix ?? '';
    const typescript = scipPath ? scoreAgainstOracle(graph, alignScipLinesUnder(readScipIndex(fs.readFileSync(scipPath)), root), { prefix }) : null;
    const php = phpPath === null ? null : scorePhpAgainstPsalm(graph, JSON.parse(fs.readFileSync(phpPath, 'utf8')) as PhpOracle, { prefix });
    const meta: ReportMeta = {
        root,
        graph: graphPath,
        prefix,
        census: edgeCensus(graph),
        scip: scipPath ? { path: scipPath, indexer } : null,
        php_oracle: phpPath,
    };
    const json = `${JSON.stringify({ meta: { ...meta, reference_relations: [...REFERENCE_RELATIONS] }, typescript, php }, null, 2)}\n`;
    if (args.json) fs.writeFileSync(args.json, json);
    else io.stdout(json);
    if (args.out) fs.writeFileSync(args.out, renderMarkdown({ typescript, php }, meta));
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(
        runEdgeOracle(process.argv.slice(2), {
            pathEnv: process.env.PATH ?? '',
            stdout: (s) => process.stdout.write(s),
            stderr: (s) => process.stderr.write(s),
        }),
    );
}

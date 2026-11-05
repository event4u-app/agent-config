#!/usr/bin/env tsx
/**
 * The PHP half of the 2.6 edge oracle (road-to-a-graph-that-wins 2.6): one Psalm
 * analysis answering "who references this?" for every PHP declaration the graph
 * holds, written as the `--php-oracle` file `edge_oracle.ts` scores against.
 *
 *   tsx internal/bench/code-graph/php_edge_oracle.ts --dir <subject> --graph <graph.json>
 *       --out <php-oracle.json> [--subject <name>]
 *
 * `<subject>` is a throwaway copy with `oracle.sh deps` already run — the same
 * directory `oracle_truth.ts` reads; the analysis itself runs in the pinned
 * oracle image with no network (ADR-259). Psalm names a symbol by its
 * fully-qualified name, the graph by file and label, so each declaration is
 * mapped through `enclosing.php` (the parser Psalm ships) at the node's own
 * line, and kept only when the symbol's last segment is the node's label.
 * `--subject` selects the per-subject exclusions `oracle_truth.ts` measured.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CodeGraph, CodeNode } from '../../../src/scripts/code_graph/types.js';
import type { PhpOracle } from './edge_oracle.js';
import { dataOnlyDirs, type Enclosing, PATHOLOGICAL_FILES, psalmRound, type Refs, resolveEnclosing, writePsalmConfig } from './oracle_truth.js';

// No `function`: Psalm 7 records reference locations for methods and class-likes
// only — a call to a global function (a Pest helper) is never a location, so a
// function target is outside this oracle, never refuted by it.
const DECLARATION_KINDS: ReadonlySet<string> = new Set(['class', 'interface', 'trait', 'enum', 'method']);
const CLASS_LIKE: ReadonlySet<string> = new Set(['class', 'interface', 'trait', 'enum']);

const siteOf = (n: Pick<CodeNode, 'source_file' | 'source_location'>): string => `${n.source_file}:${String(n.source_location[0])}`;
const lastSegment = (symbol: string): string => symbol.split('::').pop()?.split('\\').pop() ?? symbol;

/** Graph node id → Psalm symbol, plus a file id for every file declaring exactly one class-like. */
export function phpSymbolMap(nodes: readonly CodeNode[], enclosing: Enclosing): Record<string, string> {
    const out: Record<string, string> = {};
    const classesIn = new Map<string, string[]>();
    for (const n of nodes) {
        if (!n.source_file.endsWith('.php') || !DECLARATION_KINDS.has(n.kind) || n.source_location.length < 1) continue;
        const sym = enclosing.get(siteOf(n));
        if (!sym || sym === '-' || lastSegment(sym).toLowerCase() !== n.label.toLowerCase()) continue;
        out[n.id] = sym;
        if (CLASS_LIKE.has(n.kind)) classesIn.set(n.source_file, [...(classesIn.get(n.source_file) ?? []), sym]);
    }
    for (const [file, syms] of classesIn) if (syms.length === 1) out[file] = syms[0] as string;
    return out;
}

/** Tracked PHP files the Psalm config analyses: everything but its ignore list and the measured exclusions. */
function analyzedFiles(dir: string, excludedDirs: readonly string[], excludedFiles: readonly string[]): string[] {
    const ignored = ['vendor/', 'node_modules/', 'storage/', 'bootstrap/cache/', 'public/', '.oracle/', ...excludedDirs.map((d) => `${d}/`)];
    const files = spawnSync('git', ['ls-files', '*.php'], { cwd: dir, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
    return files.filter((f) => !ignored.some((p) => f.startsWith(p)) && !excludedFiles.includes(f)).sort();
}

export function runPhpEdgeOracle(argv: readonly string[]): number {
    const args: Record<string, string> = {};
    for (let i = 0; i < argv.length; i += 2) if (argv[i]?.startsWith('--') && argv[i + 1] !== undefined) args[(argv[i] as string).slice(2)] = argv[i + 1] as string;
    if (!args.dir || !args.graph || !args.out) {
        process.stderr.write('usage: php_edge_oracle.ts --dir <subject> --graph <graph.json> --out <php-oracle.json> [--subject <name>]\n');
        return 2;
    }
    const dir = path.resolve(args.dir);
    if (!fs.existsSync(path.join(dir, 'vendor'))) {
        process.stderr.write(`php_edge_oracle: ${dir} has no vendor/ — run \`oracle.sh deps\` on a throwaway copy first\n`);
        return 3;
    }
    const graph = JSON.parse(fs.readFileSync(args.graph, 'utf8')) as CodeGraph;
    fs.mkdirSync(path.join(dir, '.oracle'), { recursive: true });

    const enclosing: Enclosing = new Map();
    const declarations = graph.nodes.filter((n) => n.source_file.endsWith('.php') && DECLARATION_KINDS.has(n.kind) && n.source_location.length > 0);
    resolveEnclosing(dir, declarations.map(siteOf), enclosing);
    const symbolOf = phpSymbolMap(graph.nodes, enclosing);

    const excludedDirs = dataOnlyDirs(dir);
    const excludedFiles = PATHOLOGICAL_FILES[args.subject ?? ''] ?? [];
    writePsalmConfig(dir, excludedDirs, excludedFiles);
    const refs: Refs = new Map();
    psalmRound(dir, [...new Set(Object.values(symbolOf))].sort(), refs);

    const oracle: PhpOracle & { meta: Record<string, unknown> } = {
        meta: {
            declarations: declarations.length,
            mapped: Object.keys(symbolOf).filter((k) => k.includes('#')).length,
            excluded_dirs: excludedDirs,
            excluded_files: excludedFiles,
        },
        symbol_of: symbolOf,
        sites: Object.fromEntries([...refs].sort((a, b) => (a[0] < b[0] ? -1 : 1))),
        analyzed: analyzedFiles(dir, excludedDirs, excludedFiles),
    };
    fs.writeFileSync(args.out, `${JSON.stringify(oracle, null, 1)}\n`);
    process.stdout.write(`php_edge_oracle: ${oracle.meta['mapped'] as number}/${declarations.length} declarations mapped, ${refs.size} symbols answered, ${oracle.analyzed.length} files analysed\n`);
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(runPhpEdgeOracle(process.argv.slice(2)));
}

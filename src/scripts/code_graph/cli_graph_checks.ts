/**
 * The small read-only verbs of `code-graph`: `lint`, `scope` and `suggest-verb`.
 * Kept out of `cli.ts` so it stays under the source-size ceiling.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { UsageError } from './cli_args.js';
import { graphHome } from './graph_home.js';
import { suggestVerb } from './intent.js';
import { lintGraph } from './lint.js';
import { explainScope, readScopeRules } from './scope.js';
import type { CodeGraph } from './types.js';

/**
 * `suggest-verb "<question>"` (Phase 9 D3) — print the `code_graph` verb a
 * pure regex table thinks best answers a free-text structure question. A
 * standalone hint only: never resolves a graph, never runs a query itself.
 */
export function cmdSuggestVerb(argv: string[]): number {
    const question = argv.filter((a) => !a.startsWith('--')).join(' ').trim();
    if (!question) {
        process.stderr.write('usage: code_graph/cli.ts suggest-verb "<question>"\n');
        return 2;
    }
    process.stdout.write(`${suggestVerb(question)}\n`);
    return 0;
}

/** `lint [--root P] [--graph P]` — nodes, then edges; one line per problem, exit 1 when there is any. */
export function cmdLint(argv: string[]): number {
    const opt = (name: string): string | undefined => {
        const i = argv.indexOf(name);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const root = path.resolve(opt('--root') ?? '.');
    const file = opt('--graph') ?? graphHome(root).cachePath;
    if (!fs.existsSync(file)) throw new UsageError(`no graph at ${file} — run \`code-graph build\` first`);
    const g = JSON.parse(fs.readFileSync(file, 'utf-8')) as CodeGraph;
    const problems = lintGraph(g);
    for (const p of problems) process.stdout.write(`${p.kind}: ${p.item} — ${p.detail}\n`);
    process.stdout.write(`code-graph lint: ${g.nodes.length} nodes, ${g.edges.length} edges, ${problems.length} problem(s)\n`);
    return problems.length === 0 ? 0 : 1;
}

/** `scope <path…> [--root P]` — one line per path: its scope and the rule that decided. */
export function cmdScope(argv: string[]): number {
    const at = argv.indexOf('--root');
    const root = at >= 0 ? path.resolve(argv[at + 1] ?? '.') : process.cwd();
    const paths = argv.filter((a, i) => a !== '--root' && argv[i - 1] !== '--root');
    if (paths.length === 0) throw new UsageError('scope needs at least one path');
    const overrides = readScopeRules(path.join(root, 'agents', 'map', 'layers.yaml'));
    for (const p of paths) process.stdout.write(`${explainScope(path.isAbsolute(p) ? path.relative(root, p) : p, overrides)}\n`);
    return 0;
}

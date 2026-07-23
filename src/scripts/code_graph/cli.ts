#!/usr/bin/env tsx
/**
 * Native code-graph engine CLI (Class-A, ADR-124).
 *
 *   build    [--root P] [--out P] [--force]   (re)build the deterministic graph
 *   validate [--graph P]                       schema-gate a graph.json
 *
 * Query subcommands (query/path/explain/affected/detect) are added by the
 * Phase-3 query tier. Deterministic, LLM-free, no network. Exit codes:
 * 0 ok · 1 not-found / validation-failed · 2 usage · 3 internal.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { buildFromRepo } from './build.js';
import { validateGraph } from './validate.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');
export const DEFAULT_CACHE = path.join(REPO_ROOT, 'agents', 'runtime', 'state', 'code-graph-v1.json');

function flag(argv: string[], name: string): string | null {
    const i = argv.indexOf(name);
    return i >= 0 && i + 1 < argv.length ? (argv[i + 1] as string) : null;
}

async function cmdBuild(argv: string[]): Promise<number> {
    const root = flag(argv, '--root') ?? REPO_ROOT;
    const out = argv.includes('--out') ? flag(argv, '--out') : DEFAULT_CACHE;
    if (!fs.existsSync(root)) {
        process.stderr.write(`code-graph: root not found: ${root}\n`);
        return 1;
    }
    const { graph, fileCount } = await buildFromRepo(root, out);
    const c = graph.edge_confidence_counts;
    process.stdout.write(
        `✅  code-graph built — ${fileCount} files · ${graph.nodes.length} nodes · ${graph.edges.length} edges\n` +
            `    languages: ${graph.languages.join(', ') || '(none)'} · grammar ABI ${graph.grammar_abi}\n` +
            `    edges: EXTRACTED ${c.EXTRACTED} · INFERRED ${c.INFERRED} · AMBIGUOUS ${c.AMBIGUOUS}\n` +
            (out ? `    cache: ${path.relative(REPO_ROOT, out)}\n` : ''),
    );
    return 0;
}

function cmdValidate(argv: string[]): number {
    const p = flag(argv, '--graph') ?? DEFAULT_CACHE;
    if (!fs.existsSync(p)) {
        process.stderr.write(`code-graph: graph not found: ${p}\n`);
        return 1;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (e) {
        process.stderr.write(`code-graph: graph is not valid JSON: ${(e as Error).message}\n`);
        return 1;
    }
    const r = validateGraph(parsed);
    if (r.ok) {
        process.stdout.write(`✅  graph schema valid: ${path.relative(REPO_ROOT, p)}\n`);
        return 0;
    }
    process.stderr.write(`❌  graph schema invalid (${r.errors.length}):\n`);
    for (const e of r.errors) process.stderr.write(`  ${e}\n`);
    return 1;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
    const sub = argv[0];
    try {
        if (sub === 'build') return await cmdBuild(argv.slice(1));
        if (sub === 'validate') return cmdValidate(argv.slice(1));
        process.stderr.write('usage: code_graph/cli.ts <build|validate> [options]\n');
        return 2;
    } catch (e) {
        process.stderr.write(`code-graph: internal error: ${(e as Error).message}\n`);
        return 3;
    }
}

const _invokedDirectly = (() => {
    if (process.argv[1] === undefined) return false;
    try {
        return fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(_HERE);
    } catch {
        return import.meta.url === `file://${process.argv[1]}`;
    }
})();
if (_invokedDirectly) {
    main().then((rc) => process.exit(rc));
}

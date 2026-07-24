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
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { hardenedSpawnEnv } from '../_lib/spawn_env.js';
import { buildFromRepo } from './build.js';
import { detectSources, pickSource } from './detect.js';
import { affected, explain, loadGraph, type LoadedGraph, path as graphPath, query, type QueryResult } from './query.js';
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
    const update = argv.includes('--update');
    const { graph, fileCount, reExtracted, reused } = await buildFromRepo(root, out, { update });
    const c = graph.edge_confidence_counts;
    process.stdout.write(
        `✅  code-graph ${update ? 'updated' : 'built'} — ${fileCount} files · ${graph.nodes.length} nodes · ${graph.edges.length} edges\n` +
            `    languages: ${graph.languages.join(', ') || '(none)'} · grammar ABI ${graph.grammar_abi}\n` +
            `    edges: EXTRACTED ${c.EXTRACTED} · INFERRED ${c.INFERRED} · AMBIGUOUS ${c.AMBIGUOUS}\n` +
            (update ? `    incremental: ${reExtracted} re-extracted · ${reused} reused\n` : '') +
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

function resolveGraph(argv: string[]): { g: LoadedGraph; note: string } | { err: string } {
    const explicit = flag(argv, '--graph');
    const root = flag(argv, '--root') ?? REPO_ROOT;
    if (explicit) {
        if (!fs.existsSync(explicit)) return { err: `graph not found: ${explicit}` };
        return { g: loadGraph(explicit, path.relative(REPO_ROOT, explicit)), note: '' };
    }
    const picked = pickSource(detectSources(root, DEFAULT_CACHE));
    if (!picked) return { err: 'no code-graph source found — run `code_graph build` or ship a graph.json' };
    if (picked.kind === 'scip') return { err: `${picked.note ?? 'SCIP detected'} — pass --graph <json> or install peer tooling` };
    const staleNote = picked.stale ? ` ⚠ index is ${picked.commits_behind ?? 'N'} commit(s) behind — rebuild before trusting` : '';
    return { g: loadGraph(picked.path, `${picked.kind}:${path.relative(REPO_ROOT, picked.path)}`), note: staleNote };
}

function render(r: QueryResult, staleNote: string): number {
    process.stdout.write(`source: ${r.source}${staleNote}\n`);
    if (r.seeds.length) process.stdout.write(`seeds: ${r.seeds.join(', ')}\n`);
    for (const l of r.lines) process.stdout.write(`  ${l}\n`);
    if (r.truncated) process.stdout.write('  … (budget reached — narrow the seed or raise --budget)\n');
    if (!r.lines.length) process.stdout.write('  (no matching relations)\n');
    return 0;
}

function budgetOf(argv: string[]): number {
    const b = Number(flag(argv, '--budget'));
    return Number.isFinite(b) && b > 0 ? b : 1500;
}

function changedNodeSeeds(g: LoadedGraph, root: string, ref: string): string[] {
    let files: string[];
    try {
        files = execFileSync('git', ['-C', root, 'diff', '--name-only', `${ref}..HEAD`], {
            env: hardenedSpawnEnv(),
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
        })
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
    } catch {
        return [];
    }
    const set = new Set(files);
    return g.graph.nodes.filter((n) => set.has(n.source_file) && n.kind !== 'file').map((n) => n.id);
}

function cmdQuery(kind: 'query' | 'explain' | 'affected' | 'path', argv: string[]): number {
    const r = resolveGraph(argv);
    if ('err' in r) {
        process.stderr.write(`code-graph: ${r.err}\n`);
        return 1;
    }
    const positional = argv.filter((a) => !a.startsWith('--') && !isFlagValue(argv, a));
    const budget = budgetOf(argv);
    if (kind === 'affected' && flag(argv, '--since')) {
        const root = flag(argv, '--root') ?? REPO_ROOT;
        const seeds = changedNodeSeeds(r.g, root, flag(argv, '--since') as string);
        const merged: QueryResult = { source: r.g.source, seeds: [], lines: [], truncated: false };
        for (const s of seeds) {
            const one = affected(r.g, s, 2, budget);
            merged.seeds.push(...one.seeds);
            merged.lines.push(...one.lines);
        }
        return render(merged, r.note);
    }
    const a = positional[0];
    if (!a) {
        process.stderr.write(`usage: code_graph/cli.ts ${kind} <symbol> [--graph P] [--budget N]\n`);
        return 2;
    }
    if (kind === 'path') {
        const b = positional[1];
        if (!b) {
            process.stderr.write('usage: code_graph/cli.ts path <a> <b>\n');
            return 2;
        }
        return render(graphPath(r.g, a, b, budget), r.note);
    }
    const fn = kind === 'query' ? query : kind === 'explain' ? explain : affected;
    return render(fn(r.g, a, budget), r.note);
}

function isFlagValue(argv: string[], token: string): boolean {
    const i = argv.indexOf(token);
    return i > 0 && (argv[i - 1] as string).startsWith('--');
}

function cmdDetect(argv: string[]): number {
    const root = flag(argv, '--root') ?? REPO_ROOT;
    const verdicts = detectSources(root, DEFAULT_CACHE);
    if (!verdicts.length) {
        process.stdout.write('no code-graph source detected\n');
        return 1;
    }
    for (const v of verdicts) {
        const fresh = v.stale === undefined ? '' : v.stale ? ` · STALE${v.commits_behind !== undefined ? ` (${v.commits_behind} behind)` : ''}` : ' · fresh';
        process.stdout.write(`${v.kind.padEnd(9)} ${path.relative(REPO_ROOT, v.path)}${fresh}${v.note ? ` · ${v.note}` : ''}\n`);
    }
    const picked = pickSource(verdicts);
    if (picked) process.stdout.write(`→ query would use: ${picked.kind}\n`);
    return 0;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
    const sub = argv[0];
    try {
        if (sub === 'build') return await cmdBuild(argv.slice(1));
        if (sub === 'validate') return cmdValidate(argv.slice(1));
        if (sub === 'detect') return cmdDetect(argv.slice(1));
        if (sub === 'query' || sub === 'explain' || sub === 'affected' || sub === 'path')
            return cmdQuery(sub, argv.slice(1));
        process.stderr.write(
            'usage: code_graph/cli.ts <build|validate|detect|query|explain|affected|path> [options]\n',
        );
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

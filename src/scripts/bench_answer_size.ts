#!/usr/bin/env node
/**
 * Per-verb answer-size bench on the real graph. Each probe prints the raw
 * answer size, the budgeted size, the grade the budget chose and a cost line;
 * the run is red when a budgeted answer exceeds its budget.
 *
 *   --probe <name>   one probe (affected-hubs, graph-impact, ask-size, ask-latency)
 *   --all            every probe
 *   --graph P        graph cache (default: this repository's)
 *   --json           machine output
 *
 * `ask-latency` records the p95 of `ask` over the fixed questions; it carries
 * no claim and never fails the run.
 *
 * Exit codes: 0 within budget · 1 over budget · 2 usage or no graph.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ask } from './code_graph/ask.js';
import { graphSources } from './code_graph/cli_ask.js';
import { DEFAULT_ANSWER_BUDGET, budgetImpactReport, budgetQueryReport, tokensOf } from './code_graph/answer_budget.js';
import { changedFiles } from './code_graph/cli.js';
import { graphHome } from './code_graph/graph_home.js';
import { type LoadedGraph, affected, loadGraph } from './code_graph/query.js';
import { impact } from './code_graph/verbs.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export interface ProbeRow {
    probe: string;
    case: string;
    raw_tokens: number;
    tokens: number;
    budget: number;
    level: string;
    shown: number;
    total: number;
    ok: boolean;
}

export interface LatencyRow {
    probe: 'ask-latency';
    questions: number;
    p95_ms: number;
}

type Probe = (g: LoadedGraph, root: string) => ProbeRow[] | LatencyRow;

const row = (probe: string, c: string, raw: unknown, budgeted: { budget: { tokens: number; budget: number; level: string; shown: number; total: number } }): ProbeRow => ({
    probe,
    case: c,
    raw_tokens: tokensOf(raw),
    tokens: budgeted.budget.tokens,
    budget: budgeted.budget.budget,
    level: budgeted.budget.level,
    shown: budgeted.budget.shown,
    total: budgeted.budget.total,
    ok: budgeted.budget.tokens <= budgeted.budget.budget,
});

/** Questions the dearest answers came from; `affected` on a hub symbol and a hook. */
export const HUB_SEEDS = ['gpt_tokens', 'src/scripts/hooks/code_graph_context_hook.ts'];

export const PROBES: Record<string, Probe> = {
    'affected-hubs': (g) =>
        HUB_SEEDS.map((s) => {
            const r = affected(g, s);
            return row('affected-hubs', `affected ${s}`, r, budgetQueryReport(g, r, DEFAULT_ANSWER_BUDGET));
        }),
    'graph-impact': (g, root) => {
        const files = changedFiles(root, 'HEAD~1') ?? [];
        const r = impact(g, files, 'fresh', 2);
        return [row('graph-impact', 'graph_impact HEAD~1', r, budgetImpactReport(g, r as never, DEFAULT_ANSWER_BUDGET))];
    },
    'ask-latency': (g, root) => {
        const sources = graphSources(g, 'bench');
        const scope = { repoId: 'bench', branch: 'bench', worktree: root, user: 'bench' };
        const ms: number[] = [];
        for (const q of ASK_QUESTIONS) {
            const t = performance.now();
            ask(q, sources, scope);
            ms.push(Math.round(performance.now() - t));
        }
        return { probe: 'ask-latency', questions: ASK_QUESTIONS.length, p95_ms: p95(ms) };
    },
    'ask-size': (g, root) => {
        const sources = graphSources(g, 'bench');
        const scope = { repoId: 'bench', branch: 'bench', worktree: root, user: 'bench' };
        return ASK_QUESTIONS.map((q) => {
            const r = ask(q, sources, scope);
            const tokens = tokensOf(r.envelope);
            return { probe: 'ask-size', case: `ask "${q}"`, raw_tokens: tokensOf(r), tokens, budget: DEFAULT_ANSWER_BUDGET, level: r.envelope.format, shown: r.envelope.counts.shown, total: r.envelope.counts.total, ok: tokens <= DEFAULT_ANSWER_BUDGET };
        });
    },
};

/** The fixed questions `ask` is measured on. */
export const ASK_QUESTIONS = [
    'which tests cover rule_inject_hook.ts',
    'what breaks if I change gpt_tokens',
    'who uses readProvenance',
    'explain contextPack',
    'which PR introduced bugReferences',
    'how should we fix the error in checkSubject',
    'did the fix in testsFor hold',
    'what calls resolveSeeds',
    'where is graphHome used',
    'what does budgetAnswer return',
];

/** Optional late-bound probes (the `ask` entry point registers its latency probe here). */
export function registerProbe(name: string, probe: Probe): void {
    PROBES[name] = probe;
}

export function p95(samples: readonly number[]): number {
    if (samples.length === 0) return 0;
    const s = [...samples].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)] as number;
}

export function format(rows: ReadonlyArray<ProbeRow | LatencyRow>): string {
    return rows
        .map((r) =>
            r.probe === 'ask-latency'
                ? `ask-latency      ${(r as LatencyRow).questions} questions, p95 ${(r as LatencyRow).p95_ms} ms (recorded, no claim)`
                : `${(r as ProbeRow).ok ? '✅' : '❌'}  ${(r as ProbeRow).case}: ${(r as ProbeRow).raw_tokens} → ${(r as ProbeRow).tokens} tok (budget ${(r as ProbeRow).budget}, grade ${(r as ProbeRow).level}, ${(r as ProbeRow).shown}/${(r as ProbeRow).total} shown) · cost ≈ ${(r as ProbeRow).tokens} tok per answer`,
        )
        .join('\n');
}

export async function main(argv: readonly string[] = process.argv.slice(2), root: string = REPO_ROOT): Promise<number> {
    const i = argv.indexOf('--probe');
    const names = argv.includes('--all') ? Object.keys(PROBES) : i >= 0 && argv[i + 1] ? [argv[i + 1] as string] : [];
    if (names.length === 0 || names.some((n) => !(n in PROBES))) {
        process.stderr.write(`usage: bench_answer_size --probe <${Object.keys(PROBES).join('|')}> | --all [--graph P] [--json]\n`);
        return 2;
    }
    const gi = argv.indexOf('--graph');
    const cache = gi >= 0 && argv[gi + 1] ? (argv[gi + 1] as string) : graphHome(root).cachePath;
    if (!fs.existsSync(cache)) {
        process.stderr.write(`bench_answer_size: no graph at ${cache} — build one with \`agent-config code-graph build\`\n`);
        return 2;
    }
    const g = loadGraph(cache, `native:${path.relative(root, cache)}`);
    const rows: Array<ProbeRow | LatencyRow> = [];
    for (const n of names) {
        const out = (PROBES[n] as Probe)(g, root);
        rows.push(...(Array.isArray(out) ? out : [out]));
    }
    process.stdout.write(argv.includes('--json') ? `${JSON.stringify(rows, null, 1)}\n` : `${format(rows)}\n`);
    return rows.some((r) => r.probe !== 'ask-latency' && !(r as ProbeRow).ok) ? 1 : 0;
}

if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(_HERE)) {
    main().then((rc) => process.exit(rc));
}

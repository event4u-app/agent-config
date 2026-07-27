#!/usr/bin/env tsx
/**
 * bench_hook_latency — standing, published hook-dispatch latency harness.
 *
 * road-to-credible-install Phase 1: the 9.8.0 external review measured
 * ~1.6 s p50 per PreToolUse dispatch (CLI → bash → tsx → per-concern tsx
 * re-spawn). The precompiled single-process dispatcher (dist/hooks/
 * dispatch.js) replaces that chain; THIS harness is the re-runnable proof
 * and the regression net. An external reviewer runs it from a fresh clone:
 *
 *     npm ci && npm run build:cli && npm run build:hooks
 *     ./scripts-run src/scripts/bench_hook_latency            # measure + print
 *     ./scripts-run src/scripts/bench_hook_latency --gate     # enforce budget
 *     ./scripts-run src/scripts/bench_hook_latency --update   # record numbers
 *
 * Method (pinned so numbers reproduce):
 *   - N invocations per hook event (default 50, --runs N) of
 *     `node dist/hooks/dispatch.js --platform claude --event <e>` with a
 *     synthetic payload on stdin and a throwaway temp workspace as
 *     --project-dir (concern state lands there, never in the repo).
 *   - AGENT_CONFIG_REPLAY=1 (feedback-dir writes off — measures dispatch,
 *     not audit-trail I/O).
 *   - Wall-clock per invocation around spawnSync; p50/p95 per event.
 *
 * Gate semantics (--gate):
 *   - pre_tool_use p95 must be ≤ budgets_ms.pre_tool_use.p95_ci
 *   - every event p95 must be ≤ budgets_ms.any_hook_event.p95_ci
 *   - when docs/hook-latency.json exists, a p95 regression beyond
 *     regression_gate.max_regression_pct fails.
 *   Budgets: src/config/hook-latency-budget.json (pre-registered, owner +
 *   review date — see the Phase-6 budget-ownership lint).
 *
 * Exit codes: 0 green · 1 budget/regression exceeded · 2 internal error.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const BUNDLE = path.join(REPO_ROOT, 'dist', 'hooks', 'dispatch.js');
const BUDGET_PATH = path.join(REPO_ROOT, 'src', 'config', 'hook-latency-budget.json');
const RESULTS_PATH = path.join(REPO_ROOT, 'docs', 'hook-latency.json');

const EVENTS: readonly string[] = [
    'pre_tool_use',
    'post_tool_use',
    'user_prompt_submit',
    'stop',
    'session_start',
    'session_end',
];

interface EventResult {
    event: string;
    runs: number;
    p50_ms: number;
    p95_ms: number;
    max_ms: number;
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[Math.max(0, idx)] as number;
}

function syntheticPayload(event: string, workspace: string): string {
    // Claude-shaped payload; concerns read tool_name/tool_input for
    // pre/post_tool_use. A plain Read is the common non-matching case —
    // the fast path consumers pay on every tool call.
    return JSON.stringify({
        session_id: 'bench-hook-latency',
        cwd: workspace,
        hook_event_name: event,
        tool_name: 'Read',
        tool_input: { file_path: path.join(workspace, 'README.md') },
    });
}

export function benchEvent(event: string, runs: number, workspace: string): EventResult {
    const durations: number[] = [];
    const payload = syntheticPayload(event, workspace);
    for (let i = 0; i < runs; i += 1) {
        const started = performance.now();
        const proc = spawnSync(
            process.execPath,
            [
                BUNDLE,
                '--platform',
                'claude',
                '--event',
                event,
                '--project-dir',
                workspace,
            ],
            {
                input: payload,
                encoding: 'utf-8',
                env: { ...process.env, AGENT_CONFIG_REPLAY: '1' },
                timeout: 60000,
            },
        );
        const elapsed = performance.now() - started;
        if (proc.error) {
            throw new Error(`dispatch failed on ${event}: ${proc.error.message}`);
        }
        durations.push(elapsed);
    }
    durations.sort((a, b) => a - b);
    return {
        event,
        runs,
        p50_ms: Math.round(percentile(durations, 50)),
        p95_ms: Math.round(percentile(durations, 95)),
        max_ms: Math.round(durations[durations.length - 1] as number),
    };
}

function loadJson<T>(p: string): T | null {
    try {
        return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
    } catch {
        return null;
    }
}

interface Budget {
    budgets_ms: {
        pre_tool_use: { p95_ci: number };
        any_hook_event: { p95_ci: number };
    };
    regression_gate: { max_regression_pct: number };
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const gate = argv.includes('--gate');
    const update = argv.includes('--update');
    const runsIdx = argv.indexOf('--runs');
    const runs = runsIdx >= 0 ? Number.parseInt(argv[runsIdx + 1] ?? '50', 10) : 50;

    if (!fs.existsSync(BUNDLE)) {
        process.stderr.write(
            `bench_hook_latency: bundle missing at ${BUNDLE} — run \`npm run build:hooks\` first\n`,
        );
        return 2;
    }
    const budget = loadJson<Budget>(BUDGET_PATH);
    if (budget === null) {
        process.stderr.write(`bench_hook_latency: budget file missing/invalid at ${BUDGET_PATH}\n`);
        return 2;
    }

    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-hook-bench-'));
    const results: EventResult[] = [];
    try {
        for (const event of EVENTS) {
            const r = benchEvent(event, runs, workspace);
            results.push(r);
            process.stdout.write(
                `${event.padEnd(20)} p50 ${String(r.p50_ms).padStart(5)} ms · p95 ${String(r.p95_ms).padStart(5)} ms · max ${String(r.max_ms).padStart(5)} ms (n=${r.runs})\n`,
            );
        }
    } finally {
        fs.rmSync(workspace, { recursive: true, force: true });
    }

    let failed = false;
    const prior = loadJson<{ results: EventResult[] }>(RESULTS_PATH);
    for (const r of results) {
        const anyCap = budget.budgets_ms.any_hook_event.p95_ci;
        const cap = r.event === 'pre_tool_use' ? budget.budgets_ms.pre_tool_use.p95_ci : anyCap;
        if (gate && r.p95_ms > cap) {
            process.stderr.write(
                `❌  ${r.event}: p95 ${r.p95_ms} ms exceeds the pre-registered budget (${cap} ms)\n`,
            );
            failed = true;
        }
        if (gate && prior !== null) {
            const prev = prior.results.find((x) => x.event === r.event);
            if (prev !== undefined && prev.p95_ms > 0) {
                const regressionPct = ((r.p95_ms - prev.p95_ms) / prev.p95_ms) * 100;
                if (regressionPct > budget.regression_gate.max_regression_pct) {
                    process.stderr.write(
                        `❌  ${r.event}: p95 regressed ${Math.round(regressionPct)}% vs recorded ` +
                            `${prev.p95_ms} ms (allowed: ${budget.regression_gate.max_regression_pct}%)\n`,
                    );
                    failed = true;
                }
            }
        }
    }

    if (update) {
        const doc = {
            _comment:
                'Recorded hook-dispatch latency (bench_hook_latency --update). Method pinned in src/scripts/bench_hook_latency.ts; budgets in src/config/hook-latency-budget.json. Re-run from a fresh clone to reproduce.',
            recorded_at: new Date().toISOString(),
            node: process.version,
            platform: `${os.platform()}-${os.arch()}`,
            hardware_note: 'see hook-latency-budget.json hardware_reference — CI numbers are the gated ones',
            runs_per_event: runs,
            results,
        };
        fs.writeFileSync(RESULTS_PATH, `${JSON.stringify(doc, null, 4)}\n`);
        process.stdout.write(`recorded → ${path.relative(REPO_ROOT, RESULTS_PATH)}\n`);
    }

    if (failed) return 1;
    process.stdout.write(gate ? '✅  hook-latency budget met\n' : 'ℹ️  measurement only (no gate)\n');
    return 0;
}

const _selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_selfPath)) {
    process.exit(main());
}

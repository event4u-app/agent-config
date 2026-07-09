#!/usr/bin/env tsx
/**
 * Second-brain paired measurement — substrate on vs off vs placebo
 * (road-to-second-brain-delta-proof Phase 2).
 *
 * Runs the deterministic recall corpus (Phase 1) through a FIXED host under
 * three arms and scores each transcript with `second_brain_score` (no
 * model-in-the-loop grading):
 *
 *   - memory-off — the k+1 question alone (no prior-session context): the
 *     no-memory baseline; the agent must re-derive from scratch.
 *   - memory-on  — the question + the prior-session fact the substrate would
 *     surface (perfect retrieval): the substrate's ideal output.
 *   - placebo    — the question + an EQUAL-BYTE inert block (no relevant
 *     content): isolates "relevant retrieved content" from "mere extra
 *     context", exactly as the discipline benchmark isolates content from
 *     length.
 *
 * A PASS requires memory-on to beat BOTH memory-off AND placebo (a sign test
 * over the paired per-task scores). Otherwise an honest NULL is recorded.
 *
 * HONEST SCOPING (stated, not buried): the Phase-1 corpus is one-fact-per-task
 * by construction, so memory-on injects the exact fact — this measures the
 * CONTEXT-VALUE UPPER BOUND (does the right prior fact, perfectly retrieved,
 * let the model answer) NOT the substrate's retrieval PRECISION under a large
 * store. A large-store retrieval-precision corpus is the follow-up; this run
 * bounds the ceiling and isolates it from mere-extra-context via the placebo.
 *
 * Modes:
 *   --dry-run   build every prompt + score a STUBBED "ideal" transcript per
 *               arm (memory-on stub contains the fact, off/placebo do not) — no
 *               API calls, no spend; proves the harness + arms wire correctly.
 *   --run       live calls to the fixed host (SPEND). Writes the pinned report.
 *   --host <id> fixed host model id (default claude-haiku-4-5-20251001).
 *   --seeds <n> repetitions per arm×task (default 3).
 *
 * Exit codes: 0 ok / 1 run error / 2 usage.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { load_anthropic_key } from './ai_council/clients.js';
import { loadCorpus, scoreTask, type RecallTask } from './second_brain_score.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const REPORT_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'reports');

const DEFAULT_HOST = 'claude-haiku-4-5-20251001';
const DEFAULT_SEEDS = 3;

export type Arm = 'memory-off' | 'memory-on' | 'placebo';
export const ARMS: readonly Arm[] = ['memory-off', 'memory-on', 'placebo'];

/** The prior-session memory block the substrate would surface for a task. */
function memoryBlock(task: RecallTask): string {
    return `Prior-session memory (recalled by the second-brain substrate):\n- ${task.session_k}`;
}

/** Equal-byte inert filler, sized to the memory block, with no relevant content. */
function placeboBlock(task: RecallTask): string {
    const target = memoryBlock(task).length;
    const filler =
        'Prior-session memory (recalled by the second-brain substrate):\n- ' +
        'Note: routine housekeeping; no decisions or constraints were recorded in this window. ';
    let out = filler;
    while (out.length < target) out += 'Nothing further of record. ';
    return out.slice(0, target);
}

/** Build the arm-specific prompt for a task. */
export function buildPrompt(task: RecallTask, arm: Arm): string {
    const q = task.session_k1_prompt;
    const preamble =
        'You are continuing a multi-session engineering project. Answer the ' +
        'question using what the project has decided so far. Be concise and concrete.';
    if (arm === 'memory-off') {
        return `${preamble}\n\n${q}`;
    }
    const block = arm === 'memory-on' ? memoryBlock(task) : placeboBlock(task);
    return `${preamble}\n\n${block}\n\n${q}`;
}

// --- minimal Anthropic Messages call (reuses the repo key resolution) -------

interface CallResult {
    text: string;
    tokens_in: number;
    tokens_out: number;
}

async function callAnthropic(
    model: string,
    prompt: string,
    apiKey: string,
): Promise<CallResult> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model,
            max_tokens: 256,
            temperature: 0.7,
            messages: [{ role: 'user', content: prompt }],
        }),
    });
    if (!res.ok) {
        throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (data.content ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('');
    return {
        text,
        tokens_in: data.usage?.input_tokens ?? 0,
        tokens_out: data.usage?.output_tokens ?? 0,
    };
}

/** Stub transcript for --dry-run: memory-on "recalls" the fact, others don't. */
function stubTranscript(task: RecallTask, arm: Arm): string {
    if (arm === 'memory-on') {
        return `${task.session_k} — carrying that forward: ${task.answer_key.must_contain.join(' ')}.`;
    }
    return "I don't have that from a prior session; I'd need it re-stated.";
}

interface ArmTaskResult {
    task: string;
    metric: string;
    arm: Arm;
    passes: number; // over seeds
    seeds: number;
    tokens_in: number;
    tokens_out: number;
}

export interface RunReport {
    schema_version: number;
    kind: string;
    roadmap: string;
    host: string;
    seeds: number;
    mode: 'dry-run' | 'live';
    scoping: string;
    per_arm_task: ArmTaskResult[];
    aggregate: Record<Arm, { pass: number; total: number; pass_rate: number }>;
    paired: {
        'on-vs-off': { on_wins: number; off_wins: number; ties: number; sign_p: number };
        'on-vs-placebo': { on_wins: number; placebo_wins: number; ties: number; sign_p: number };
    };
    verdict: 'PASS' | 'NULL';
    cost: { calls: number; tokens_in: number; tokens_out: number };
}

/** Two-sided sign-test p-value via exact binomial (ties excluded). */
export function signTestP(wins: number, losses: number): number {
    const n = wins + losses;
    if (n === 0) return 1;
    const k = Math.min(wins, losses);
    // sum of binomial tail P(X<=k) under p=0.5, times 2, capped at 1
    let cum = 0;
    for (let i = 0; i <= k; i++) cum += _choose(n, i);
    const p = (cum / 2 ** n) * 2;
    return Math.min(1, p);
}
function _choose(n: number, k: number): number {
    let r = 1;
    for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
    return r;
}

export async function run(opts: {
    mode: 'dry-run' | 'live';
    host: string;
    seeds: number;
}): Promise<RunReport> {
    const tasks = loadCorpus();
    const apiKey = opts.mode === 'live' ? load_anthropic_key() : '';
    const rows: ArmTaskResult[] = [];
    let calls = 0;
    let tIn = 0;
    let tOut = 0;

    for (const task of tasks) {
        for (const arm of ARMS) {
            let passes = 0;
            let ai = 0;
            let ao = 0;
            for (let s = 0; s < opts.seeds; s++) {
                let transcript: string;
                if (opts.mode === 'dry-run') {
                    transcript = stubTranscript(task, arm);
                } else {
                    const r = await callAnthropic(opts.host, buildPrompt(task, arm), apiKey);
                    transcript = r.text;
                    ai += r.tokens_in;
                    ao += r.tokens_out;
                    calls += 1;
                    tIn += r.tokens_in;
                    tOut += r.tokens_out;
                }
                if (scoreTask(transcript, task).pass) passes += 1;
            }
            rows.push({
                task: task.id,
                metric: task.metric,
                arm,
                passes,
                seeds: opts.seeds,
                tokens_in: ai,
                tokens_out: ao,
            });
        }
    }

    const agg = {} as RunReport['aggregate'];
    for (const arm of ARMS) {
        const armRows = rows.filter((r) => r.arm === arm);
        const pass = armRows.reduce((s, r) => s + r.passes, 0);
        const total = armRows.reduce((s, r) => s + r.seeds, 0);
        agg[arm] = { pass, total, pass_rate: total ? pass / total : 0 };
    }

    const pairCompare = (a: Arm, b: Arm) => {
        let aw = 0;
        let bw = 0;
        let ties = 0;
        for (const task of tasks) {
            const ra = rows.find((r) => r.task === task.id && r.arm === a)!;
            const rb = rows.find((r) => r.task === task.id && r.arm === b)!;
            if (ra.passes > rb.passes) aw += 1;
            else if (rb.passes > ra.passes) bw += 1;
            else ties += 1;
        }
        return { aw, bw, ties, p: signTestP(aw, bw) };
    };
    const onOff = pairCompare('memory-on', 'memory-off');
    const onPlacebo = pairCompare('memory-on', 'placebo');

    // PASS: memory-on beats BOTH off and placebo, each significant at p<0.05.
    const verdict: 'PASS' | 'NULL' =
        onOff.aw > onOff.bw &&
        onOff.p < 0.05 &&
        onPlacebo.aw > onPlacebo.bw &&
        onPlacebo.p < 0.05
            ? 'PASS'
            : 'NULL';

    return {
        schema_version: 1,
        kind: `second-brain-delta-${opts.mode}`,
        roadmap: 'road-to-second-brain-delta-proof',
        host: opts.host,
        seeds: opts.seeds,
        mode: opts.mode,
        scoping:
            'CONTEXT-VALUE UPPER BOUND on a one-fact-per-task corpus: memory-on injects the ' +
            'exact prior fact (perfect retrieval). Measures whether the right prior fact + the ' +
            'placebo-isolated retrieval mechanism let the model answer — NOT retrieval precision ' +
            'under a large store (that is the follow-up corpus).',
        per_arm_task: rows,
        aggregate: agg,
        paired: {
            'on-vs-off': { on_wins: onOff.aw, off_wins: onOff.bw, ties: onOff.ties, sign_p: onOff.p },
            'on-vs-placebo': {
                on_wins: onPlacebo.aw,
                placebo_wins: onPlacebo.bw,
                ties: onPlacebo.ties,
                sign_p: onPlacebo.p,
            },
        },
        verdict,
        cost: { calls, tokens_in: tIn, tokens_out: tOut },
    };
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
    const mode = argv.includes('--run') ? 'live' : argv.includes('--dry-run') ? 'dry-run' : null;
    if (mode === null) {
        process.stderr.write('usage: second_brain_run --dry-run | --run [--host <id>] [--seeds <n>]\n');
        return 2;
    }
    const hostIdx = argv.indexOf('--host');
    const host = hostIdx >= 0 ? String(argv[hostIdx + 1]) : DEFAULT_HOST;
    const seedIdx = argv.indexOf('--seeds');
    const seeds = seedIdx >= 0 ? Number(argv[seedIdx + 1]) : DEFAULT_SEEDS;

    let report: RunReport;
    try {
        report = await run({ mode, host, seeds });
    } catch (e) {
        process.stderr.write(`second_brain_run: ${String(e)}\n`);
        return 1;
    }

    if (mode === 'live') {
        fs.mkdirSync(REPORT_DIR, { recursive: true });
        const out = path.join(REPORT_DIR, 'second-brain-delta.json');
        fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
        process.stdout.write(`wrote ${path.relative(REPO_ROOT, out)}\n`);
    }
    const a = report.aggregate;
    process.stdout.write(
        `${mode}: on=${a['memory-on'].pass}/${a['memory-on'].total} ` +
            `off=${a['memory-off'].pass}/${a['memory-off'].total} ` +
            `placebo=${a.placebo.pass}/${a.placebo.total} · ` +
            `on-vs-off p=${report.paired['on-vs-off'].sign_p.toFixed(4)} ` +
            `on-vs-placebo p=${report.paired['on-vs-placebo'].sign_p.toFixed(4)} · ` +
            `${report.verdict} · calls=${report.cost.calls}\n`,
    );
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    main().then((code) => process.exit(code));
}

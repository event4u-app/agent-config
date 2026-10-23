#!/usr/bin/env tsx
/**
 * PREREG endpoint (e), paired task quality: each task runs twice with one model,
 * once as written (arm A, control) and once after `replaceValues` with the
 * production egress engine (arm B, treatment).
 *
 *   check   — build every pair and run the arm-B pre-check, no model call
 *   run     — print-mode child sessions on the operator's subscription login,
 *             from an empty scratch dir with user settings and tools off,
 *             sequential, with a delay; one results.jsonl row per arm
 *   verdict — the paired verdict through `decidePairedVerdict`
 *
 * Flags: --limit N, --delay MS, --results <file>.
 * Rows hold pass/fail and token counts only — never an answer, a prompt or a
 * value; the task set is regenerated from SEED.
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalValue, replaceValues, TOKEN_PATTERN, TokenScope } from '../../../src/scripts/_lib/egress_token.js';
import { decidePairedVerdict, floorWarning, MIN_DISCORDANT } from '../../../src/scripts/_lib/paired_verdict.js';
import { generateTasks, score, SEED, type Task } from './tasks.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODEL = 'sonnet';

type Arm = 'A' | 'B';

interface Pair {
    task: Task;
    input: Record<Arm, string>;
}

interface Row {
    pair_id: string;
    family: Task['family'];
    arm: Arm;
    pass?: boolean;
    model?: string;
    input_tokens?: number;
    output_tokens?: number;
    duration_ms?: number;
    error?: string;
}

/** Arm B must carry at least one minted token and no planted value in any spelling; arm A must carry them all. */
export function precheck(task: Task, armB: string): string | null {
    for (const p of task.planted) {
        if (!task.prompt.includes(p.value)) return `arm A lacks a planted ${p.type}`;
        if (armB.includes(p.value) || armB.includes(canonicalValue(p.type, p.value))) return `arm B still carries a planted ${p.type}`;
    }
    const tokens = [...armB.matchAll(new RegExp(TOKEN_PATTERN.source, 'g'))].map((m) => m[1]);
    if (tokens.length < task.planted.length) return `arm B has ${String(tokens.length)} token(s) for ${String(task.planted.length)} planted value(s)`;
    if (task.family === 'review' && armB.split('\n').length !== task.prompt.split('\n').length) return 'arm B changed the line count';
    return null;
}

export function buildPairs(seed: number = SEED): { pairs: Pair[]; rejected: Array<{ id: string; reason: string }> } {
    const pairs: Pair[] = [];
    const rejected: Array<{ id: string; reason: string }> = [];
    for (const task of generateTasks(seed)) {
        const armB = replaceValues(task.prompt, new TokenScope());
        const why = precheck(task, armB);
        if (why !== null) rejected.push({ id: task.id, reason: why });
        else pairs.push({ task, input: { A: task.prompt, B: armB } });
    }
    return { pairs, rejected };
}

function runChild(cwd: string, prompt: string): Promise<{ stdout: string; code: number }> {
    return new Promise((resolve) => {
        const p = spawn(
            'claude',
            ['-p', '--setting-sources', 'project,local', '--tools', '', '--model', MODEL, '--output-format', 'json', '--no-session-persistence'],
            { cwd, stdio: ['pipe', 'pipe', 'pipe'] },
        );
        let out = '';
        p.stdout.on('data', (d) => (out += d));
        p.stdin.end(prompt);
        p.on('close', (code) => resolve({ stdout: out, code: code ?? 1 }));
    });
}

async function runArm(pair: Pair, arm: Arm): Promise<Row> {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `egress-paired-${arm}-`));
    const started = Date.now();
    const { stdout, code } = await runChild(cwd, pair.input[arm]);
    fs.rmSync(cwd, { recursive: true, force: true });
    const base = { pair_id: pair.task.id, family: pair.task.family, arm };
    let parsed: { result?: string; is_error?: boolean; usage?: Record<string, number>; modelUsage?: Record<string, unknown> };
    try {
        parsed = JSON.parse(stdout) as typeof parsed;
    } catch {
        return { ...base, error: `child exit ${String(code)}, no JSON` };
    }
    if (parsed.is_error || typeof parsed.result !== 'string') return { ...base, error: 'child reported an error' };
    const u = parsed.usage ?? {};
    return {
        ...base,
        pass: score(parsed.result, pair.task),
        model: Object.keys(parsed.modelUsage ?? {}).join(','),
        input_tokens: (u['input_tokens'] ?? 0) + (u['cache_creation_input_tokens'] ?? 0) + (u['cache_read_input_tokens'] ?? 0),
        output_tokens: u['output_tokens'] ?? 0,
        duration_ms: Date.now() - started,
    };
}

function readRows(file: string): Row[] {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Row);
}

export function pairedDeltas(rows: readonly Row[]): { deltas: number[]; perArm: Record<Arm, { pass: number; n: number }>; byFamily: Record<string, { A: number; B: number; n: number }> } {
    const ok = rows.filter((r) => r.error === undefined && typeof r.pass === 'boolean');
    const byPair = new Map<string, Partial<Record<Arm, Row>>>();
    for (const r of ok) byPair.set(r.pair_id, { ...byPair.get(r.pair_id), [r.arm]: r });
    const deltas: number[] = [];
    const perArm: Record<Arm, { pass: number; n: number }> = { A: { pass: 0, n: 0 }, B: { pass: 0, n: 0 } };
    const byFamily: Record<string, { A: number; B: number; n: number }> = {};
    for (const p of byPair.values()) {
        if (!p.A || !p.B) continue;
        deltas.push(Number(p.B.pass) - Number(p.A.pass));
        const f = (byFamily[p.A.family] ??= { A: 0, B: 0, n: 0 });
        f.n += 1;
        for (const arm of ['A', 'B'] as const) {
            perArm[arm].n += 1;
            if (p[arm]!.pass) {
                perArm[arm].pass += 1;
                f[arm] += 1;
            }
        }
    }
    return { deltas, perArm, byFamily };
}

function flag(name: string): string | undefined {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
    const cmd = process.argv[2];
    const results = flag('results') ?? path.join(HERE, 'results.jsonl');
    const { pairs, rejected } = buildPairs();
    if (cmd === 'check') {
        console.log(JSON.stringify({ pairs: pairs.length, rejected }, null, 2));
        process.exitCode = rejected.length === 0 ? 0 : 1;
        return;
    }
    if (cmd === 'run') {
        if (rejected.length > 0) {
            console.error(`pre-check rejected ${String(rejected.length)} pair(s); fix the task set first`);
            process.exitCode = 1;
            return;
        }
        const done = new Set(readRows(results).filter((r) => r.error === undefined).map((r) => `${r.pair_id}:${r.arm}`));
        const limit = Number(flag('limit') ?? String(pairs.length));
        const delay = Number(flag('delay') ?? '1500');
        let consecutiveErrors = 0;
        for (const pair of pairs.slice(0, limit)) {
            for (const arm of ['A', 'B'] as const) {
                if (done.has(`${pair.task.id}:${arm}`)) continue;
                const row = await runArm(pair, arm);
                fs.appendFileSync(results, `${JSON.stringify(row)}\n`);
                console.log(`${pair.task.id} ${arm} ${row.error ? `ERROR ${row.error}` : row.pass ? 'pass' : 'fail'}`);
                consecutiveErrors = row.error ? consecutiveErrors + 1 : 0;
                if (consecutiveErrors >= 3) {
                    console.error('three consecutive child errors (refusal or rate limit): stopping');
                    process.exitCode = 3;
                    return;
                }
                await new Promise((r) => setTimeout(r, delay));
            }
        }
        return;
    }
    if (cmd === 'verdict') {
        const { deltas, perArm, byFamily } = pairedDeltas(readRows(results));
        const v = decidePairedVerdict({ deltas });
        console.log(
            JSON.stringify(
                {
                    seed: SEED,
                    model: MODEL,
                    pairs_completed: deltas.length,
                    per_arm: perArm,
                    by_family: byFamily,
                    verdict: v,
                    min_discordant: MIN_DISCORDANT,
                    floor_warning: floorWarning(v),
                    // A regression is the published loss; underpowered is an absent measurement, never a pass.
                    bar_reading: v.kind === 'regression' ? 'loss' : v.kind === 'underpowered' ? 'undecided' : 'met',
                    no_loss_upper_bound_rule_of_three: v.losses === 0 && deltas.length > 0 ? 3 / deltas.length : null,
                },
                null,
                2,
            ),
        );
        return;
    }
    console.error('usage: run.ts check | run [--limit N] [--delay MS] [--results F] | verdict [--results F]');
    process.exitCode = 2;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) void main();

#!/usr/bin/env tsx
/**
 * Anchor-scoring runner — constrained anchor evaluation with frozen verdicts
 * (ADR-202, amended; attempt 2).
 *
 * Two phases, deliberately separate commands, because the freeze is the thing
 * that makes the run reproducible:
 *
 *   --generate DIR   answer both arms once, freeze transcripts.json
 *   --score DIR      evaluate every anchor with both evaluators, freeze
 *                    verdicts.json, then score — κ, δ, thresholds, verdict
 *
 * Re-scoring a frozen directory is repeatable by construction: the scorer is a
 * pure function over the frozen verdicts. Re-GENERATING is a new experiment with
 * its own directory and its own δ, never a re-run of this one.
 *
 * Exit codes: 0 ok · 1 usage/IO error · 2 verdict FAIL or instrument FAIL.
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import * as yaml from 'js-yaml';

import { build_thin, RULES_SOURCE } from './project_thin_rules.js';
import { cohensKappa } from './check_quality_regression.js';
import {
    delta_from_spread,
    eval_prompt,
    eval_with_retry,
    key,
    resolve,
    verdict,
    type Arm,
    type TaskAnchors,
} from './_lib/anchor_eval.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CORPUS = path.join(REPO_ROOT, 'internal/bench/corpora/token-quality-golden.yaml');
const REPORT = path.join(REPO_ROOT, 'internal/bench/reports/quality-run.json');

const ANSWER_MODEL = 'claude-sonnet-4-5';
const EVAL_ANTHROPIC = 'claude-sonnet-4-5';
const EVAL_OPENAI = process.env['ANCHOR_EVAL_OPENAI_MODEL'] ?? 'gpt-5';
const ANSWER_SYSTEM =
    'You are an AI coding agent governed by the following always-loaded package rules. '
    + 'Answer the user request as that agent would, honouring these rules:\n\n';
const EVAL_SYSTEM = 'You are a strict checklist grader. You output only the requested JSON.';

interface RawTask {
    id: string;
    rules: string[];
    prompt: string;
    expected: { must_include?: string[]; must_not?: string[] };
}

export function load_tasks(limit: number | null): Array<RawTask & TaskAnchors> {
    const doc = yaml.load(fs.readFileSync(CORPUS, 'utf-8')) as { tasks: RawTask[] };
    const all = doc.tasks.map((t) => ({
        ...t,
        must_include: t.expected.must_include ?? [],
        must_not: t.expected.must_not ?? [],
    }));
    return limit === null ? all : all.slice(0, limit);
}

function contexts(): Record<Arm, string> {
    // Mirror `project_thin_rules.measure()` exactly — same file set, same join —
    // so the arms this run bills for are the arms the token measurement reports.
    // `build_thin`'s first parameter is the rules DIRECTORY, not a scope; passing
    // a scope string there silently yields an empty map and a rule-free "thin"
    // arm, which would measure nothing.
    const names = fs.readdirSync(RULES_SOURCE).filter((f) => f.endsWith('.md')).sort();
    const eager = names.map((f) => fs.readFileSync(path.join(RULES_SOURCE, f), 'utf-8')).join('');
    const thin = [...build_thin(RULES_SOURCE, null).values()].join('');
    if (thin.length === 0) throw new Error('thin projection is empty — refusing to run a rule-free arm');
    return { eager, thin };
}

function anthropic(model: string): (s: string, u: string) => string {
    const require = createRequire(import.meta.url);
    const c = require('./ai_council/clients.js') as {
        AnthropicClient: new (o: { model: string; api_key: string }) => { ask(s: string, u: string): { text: string } };
        load_anthropic_key: () => string;
    };
    const cl = new c.AnthropicClient({ model, api_key: c.load_anthropic_key() });
    return (s, u) => cl.ask(s, u).text;
}

function openai(model: string): (s: string, u: string) => string {
    const require = createRequire(import.meta.url);
    const c = require('./ai_council/clients.js') as {
        OpenAIClient: new (o: { model: string; api_key: string }) => { ask(s: string, u: string): { text: string } };
        load_openai_key: () => string;
    };
    const cl = new c.OpenAIClient({ model, api_key: c.load_openai_key() });
    return (s, u) => cl.ask(s, u).text;
}

// ── generate ────────────────────────────────────────────────────────────────
function generate(dir: string, limit: number | null): number {
    const tasks = load_tasks(limit);
    const ctx = contexts();
    const ask = anthropic(ANSWER_MODEL);
    fs.mkdirSync(dir, { recursive: true });
    const out: Record<string, Record<Arm, string>> = {};
    let i = 0;
    for (const t of tasks) {
        i += 1;
        process.stdout.write(`  [${i}/${tasks.length}] ${t.id}\n`);
        out[t.id] = {
            thin: ask(ANSWER_SYSTEM + ctx.thin, t.prompt),
            eager: ask(ANSWER_SYSTEM + ctx.eager, t.prompt),
        };
    }
    fs.writeFileSync(
        path.join(dir, 'transcripts.json'),
        JSON.stringify({ answer_model: ANSWER_MODEL, task_count: tasks.length, limit, transcripts: out }, null, 2) + '\n',
    );
    process.stdout.write(`\n❄️  frozen: ${path.relative(REPO_ROOT, dir)}/transcripts.json (${tasks.length} tasks × 2 arms)\n`);
    return 0;
}

// ── score ───────────────────────────────────────────────────────────────────
function score(dir: string): number {
    const frozen = JSON.parse(fs.readFileSync(path.join(dir, 'transcripts.json'), 'utf-8')) as {
        answer_model: string;
        transcripts: Record<string, Record<Arm, string>>;
    };
    const ids = new Set(Object.keys(frozen.transcripts));
    const tasks = load_tasks(null).filter((t) => ids.has(t.id));
    const evalA = anthropic(EVAL_ANTHROPIC);
    const evalB = openai(EVAL_OPENAI);

    const labelsA: string[] = [];
    const labelsB: string[] = [];
    const resolved = new Map<string, boolean>();
    const disagreements: Array<{ task_id: string; arm: Arm; kind: string; anchor: string; a: string; b: string; resolved_to: boolean }> = [];
    let retries = 0;
    let n = 0;

    for (const t of tasks) {
        for (const arm of ['thin', 'eager'] as const) {
            n += 1;
            process.stdout.write(`  [${n}/${tasks.length * 2}] ${t.id} · ${arm}\n`);
            const p = eval_prompt(t.prompt, frozen.transcripts[t.id]![arm], t.must_include, t.must_not);
            const ra = eval_with_retry((u) => evalA(EVAL_SYSTEM, u), p, t.must_include.length, t.must_not.length);
            const rb = eval_with_retry((u) => evalB(EVAL_SYSTEM, u), p, t.must_include.length, t.must_not.length);
            if (ra.retried) retries += 1;
            if (rb.retried) retries += 1;

            const record = (kind: 'must_include' | 'must_not', idx: number, anchor: string, a: boolean | null, b: boolean | null): void => {
                labelsA.push(String(a));
                labelsB.push(String(b));
                const r = resolve(kind, a, b);
                resolved.set(key(t.id, arm, kind, idx), r);
                if (a !== b) {
                    disagreements.push({ task_id: t.id, arm, kind, anchor, a: String(a), b: String(b), resolved_to: r });
                }
            };
            t.must_include.forEach((anchor, idx) => record('must_include', idx, anchor, ra.include[idx]!, rb.include[idx]!));
            t.must_not.forEach((anchor, idx) => record('must_not', idx, anchor, ra.not[idx]!, rb.not[idx]!));
        }
    }

    const kappa = cohensKappa(labelsA, labelsB);
    const input = { tasks, resolved };
    const v = verdict(input, { kappa });
    const delta = delta_from_spread(input);

    fs.writeFileSync(
        path.join(dir, 'verdicts.json'),
        JSON.stringify({ evaluators: [EVAL_ANTHROPIC, EVAL_OPENAI], retries, labelsA, labelsB, disagreements }, null, 2) + '\n',
    );

    // quality-run.json — the schema check_quality_regression reads. Per-pair
    // winners are emitted for compatibility; the DECISION is the two-leg
    // aggregate below, and saying so here is the split ADR-202 required be explicit.
    const results = tasks.map((t) => {
        let thin = 0;
        let eager = 0;
        t.must_include.forEach((_, i) => {
            if (resolved.get(key(t.id, 'thin', 'must_include', i)) === true) thin += 1;
            if (resolved.get(key(t.id, 'eager', 'must_include', i)) === true) eager += 1;
        });
        return {
            id: t.id,
            winner: thin > eager ? 'thin' : eager > thin ? 'eager' : 'tie',
            length_delta: 0,
            winner_is_longer: null,
        };
    });
    fs.mkdirSync(path.dirname(REPORT), { recursive: true });
    fs.writeFileSync(
        REPORT,
        JSON.stringify(
            {
                threshold: 0.48,
                judge_model: `anchor-scoring:${EVAL_ANTHROPIC}+${EVAL_OPENAI}`,
                note: 'Per-pair winners are schema compatibility only. The decision is the two-leg aggregate in `anchor_verdict`.',
                anchor_verdict: { ...v, delta_from_spread_pp: delta, retries, disagreement_count: disagreements.length },
                results,
            },
            null,
            2,
        ) + '\n',
    );

    const line = (ok: boolean, s: string): void => {
        process.stdout.write(`  ${ok ? '✅' : '❌'} ${s}\n`);
    };
    process.stdout.write('\n── verdict ──\n');
    line(v.instrument_ok, `κ = ${kappa.toFixed(3)} (floor ${v.kappa_floor})`);
    line(v.delta_registered, `δ = ${delta.toFixed(2)} pp (ceiling ${v.delta_ceiling_pp} pp)`);
    line(v.must_not_ok, `must_not: ${v.thin.must_not_violations.length} thin / ${v.eager.must_not_violations.length} eager violations`);
    line(v.non_inferiority_ok, `must_include: thin ${(v.thin.rate * 100).toFixed(1)}% vs eager ${(v.eager.rate * 100).toFixed(1)}% (gap ${v.rate_gap_pp.toFixed(2)} pp)`);
    line(v.per_rule_floor_ok, `per-rule floor: ${v.per_rule_floor_breaches.length} breach(es)`);
    process.stdout.write(`\n  ${v.pass ? '✅ PASS' : '❌ FAIL'} · disagreements ${disagreements.length} · retries ${retries}\n`);
    return v.pass ? 0 : 2;
}

function main(argv: string[]): number {
    const gi = argv.indexOf('--generate');
    const si = argv.indexOf('--score');
    const li = argv.indexOf('--limit');
    const limit = li >= 0 ? Number(argv[li + 1]) : null;
    if (gi >= 0) return generate(path.resolve(argv[gi + 1] ?? ''), limit);
    if (si >= 0) return score(path.resolve(argv[si + 1] ?? ''));
    process.stderr.write('usage: anchor_scoring_run --generate DIR [--limit N] | --score DIR\n');
    return 1;
}

if (process.argv[1] !== undefined && process.argv[1].endsWith('anchor_scoring_run.ts')) {
    process.exit(main(process.argv.slice(2)));
}
export { generate, score };

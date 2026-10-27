#!/usr/bin/env node
/**
 * Three-arm run over the map task set (`internal/bench/ab/map-task-set/`).
 *
 *   vanilla  plugin off (`--setting-sources project,local`), no map
 *   ac       the installed package, no map in the working copy
 *   ac-map   the installed package, the map drawn into the working copy before
 *            the run, plus a system-prompt note: find with the map, confirm with
 *            the source, re-read after the change
 *
 * Every arm gets the same task prompt with the same `AFFECTED SET` request, so
 * M2 asks each arm the same question. Scoring is `_lib/bench_map_metrics.ts`;
 * the model call, fixture clone, pricing and spend cap are the A/B harness's own
 * (`bench_ab_task_runner.run_live`, `_lib/bench_ab_workspace`, `SweepBudget`).
 *
 * `--dry-run` replaces only the model call with a stub that applies nothing,
 * the naive change or the reference change, one per arm, then asserts that the
 * metrics come out as those three behaviours imply. A green dry run proves the
 * plumbing — clone, map build, hidden check, section parser, aggregation, report
 * — and nothing about the hypothesis; its report says `tier: dry-run`.
 *
 * Exit codes: 0 ok · 1 bad invocation or missing host CLI · 2 refused, sweep
 * budget abort, or a dry run whose metrics do not match the stub.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as v1 from './bench_ab_task_runner.js';
import { SweepBudget, cost_usd, is_bare_alias, tier_for_model, type TierRates, type TokensBreakdown } from './_lib/bench_ab_activation.js';
import { preserve_transcript, reset_fixture } from './_lib/bench_ab_workspace.js';
import { load_pricing } from './_lib/bench_cost.js';
import {
    AFFECTED_FOOTER,
    AFFECTED_HEADER,
    AFFECTED_SET_INSTRUCTION,
    MAP_FIXTURES_ROOT,
    apply_reference,
    evaluate_hidden_check,
    load_map_tasks,
    parse_affected_section,
    score_affected,
    summarise_arm,
    total_tokens,
    type ArmSummary,
    type MapRunRecord,
    type MapTask,
} from './_lib/bench_map_metrics.js';
import { missingTraceFields, parseTrace, type TrialTrace } from './_lib/bench_map_trace.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const PRICING_PATH = path.join(REPO_ROOT, 'internal', 'bench', 'pricing.yaml');
const REPORTS_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'reports', 'map-task-set');
const SCRIPTS_RUN = path.join(REPO_ROOT, 'scripts-run');

export type StubBehaviour = 'none' | 'naive' | 'reference';

export interface MapArmSpec {
    setting_sources: string | null;
    map: boolean;
    inject: string | null;
    /** The package form installed into the clone from the tree under test; `null` = no package. */
    install: 'lean' | 'full' | null;
    /** Not in the default arm list; selected with `--arms`. */
    optional?: boolean;
}

export const MAP_CONFIRM_TEXT = [
    'This repository carries a prebuilt map of itself: agents/map/MAP.md and agents/map/code/map.json,',
    'and a code-graph index under agents/map/.build/ that the graph_* tools and',
    '`agent-config code-graph` read.',
    'Use the map to find every place a change affects. The map is an index, not the truth:',
    'before relying on a place it names, re-read its witness with `agent-config code-graph confirm <id…>`',
    '(or `graph_node` with mode=confirm); start a task with `agent-config code-graph pack "<task>" --diff`',
    '(or `graph_query` with mode=pack) for the confirmed facts it touches; treat every usage count as a',
    'lower bound and search the source text for names the map may not know; and when you are done run',
    '`agent-config code-graph refresh --touched` so the map re-reads every file you changed.',
].join('\n');

/**
 * The map arm must run the confirm/pack verbs of the tree under test, not the
 * globally installed package, which may predate them: an `agent-config` shim
 * first on PATH execs this checkout's entry point. Written once per run, in
 * the temp dir so it never lands beside the published report.
 */
function branchCliShim(): string {
    const bin = path.join(os.tmpdir(), `map-arm-bin-${process.pid}`);
    const shim = path.join(bin, 'agent-config');
    if (!fs.existsSync(shim)) {
        fs.mkdirSync(bin, { recursive: true });
        fs.writeFileSync(shim, `#!/bin/sh\nexec ${JSON.stringify(path.join(REPO_ROOT, 'agent-config'))} "$@"\n`, { mode: 0o755 });
    }
    return bin;
}

/**
 * Five arms, so a payload effect and a map effect read apart (H29): the map with
 * its note on a bare host, and the same pair on the package's lean form. No arm
 * reads user scope — the package an arm runs is the one installed into its clone
 * from the tree under test, never whatever the operator has installed.
 */
export const MAP_ARMS: Record<string, MapArmSpec> = {
    vanilla: { setting_sources: 'project,local', map: false, inject: null, install: null },
    'vanilla-map': { setting_sources: 'project,local', map: true, inject: MAP_CONFIRM_TEXT, install: null },
    'ac-lean': { setting_sources: 'project,local', map: false, inject: null, install: 'lean' },
    'ac-lean-map': { setting_sources: 'project,local', map: true, inject: MAP_CONFIRM_TEXT, install: 'lean' },
    'ac-full': { setting_sources: 'project,local', map: false, inject: null, install: 'full', optional: true },
};

export const DEFAULT_MAP_ARMS: readonly string[] = Object.entries(MAP_ARMS)
    .filter(([, s]) => !s.optional)
    .map(([a]) => a);

/**
 * Copy the `<form>/.claude` projection of the tree under test into the clone.
 * `BENCH_AC_TREE_DIR` names a directory holding `lean/` and `full/` projections
 * the operator generated from that tree; nothing here guesses one.
 */
export function install_into_clone(clone: string, form: 'lean' | 'full', treeDir: string | undefined = process.env['BENCH_AC_TREE_DIR']): void {
    if (!treeDir) throw new Error('BENCH_AC_TREE_DIR is not set; it must name the lean/ and full/ projections of the tree under test');
    const from = path.join(treeDir, form, '.claude');
    if (!fs.existsSync(from)) throw new Error(`no ${form} projection at ${from}`);
    fs.cpSync(from, path.join(clone, '.claude'), { recursive: true });
}

/** What the dry-run stub does per arm — three distinct behaviours, so every metric branch runs. */
export const DRY_RUN_STUB: Record<string, StubBehaviour> = {
    vanilla: 'none',
    'vanilla-map': 'naive',
    'ac-lean': 'naive',
    'ac-lean-map': 'reference',
    'ac-full': 'reference',
};

type Dict = Record<string, unknown>;

export interface MapTrial extends MapRunRecord {
    reason: string | null;
    check_failures: { index: number; reason: string; protects: string | null }[];
    tokens_breakdown: TokensBreakdown | Record<string, never>;
    map_build: { ok: boolean; ms: number; detail: string } | null;
    workspace: string;
    transcript_path: string | null;
    synthetic: boolean;
    /** What the agent did, redacted (`_lib/bench_map_trace.ts`); absent on records older than 5.1. */
    trace?: TrialTrace;
}

/** The package version an arm runs under, with its form; `none` for an arm without the package. */
export function acVersion(spec: MapArmSpec): string {
    if (!spec.install) return 'none';
    try {
        return `${String((JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8')) as { version?: string }).version ?? 'unknown')} ${spec.install}`;
    } catch {
        return 'unknown';
    }
}

/** The stream a stub agent would have produced: reads of the task's primary files (and the map, for a map arm), then edits. */
export function stub_stream(task: MapTask, behaviour: StubBehaviour, spec: MapArmSpec): string {
    const ev = (o: unknown): string => JSON.stringify(o);
    const use = (name: string, input: Record<string, string>): string => ev({ type: 'assistant', message: { model: 'stub', content: [{ type: 'tool_use', name, input }] } });
    const lines = [ev({ type: 'system', subtype: 'init', model: 'stub', tools: ['Bash', 'Edit', 'Read'], mcp_servers: [] })];
    if (spec.map) lines.push(use('Read', { file_path: 'agents/map/MAP.md' }), use('Bash', { command: 'agent-config code-graph affected' }));
    for (const f of task.primary) lines.push(use('Read', { file_path: f }));
    if (behaviour !== 'none') for (const f of task.primary) lines.push(use('Edit', { file_path: f }));
    lines.push(ev({ type: 'result', subtype: 'success', num_turns: lines.length, modelUsage: { stub: {} } }));
    return lines.join('\n');
}

/** Draw the map into the working copy with the shipped CLI, the way a user's project gets one. */
export function build_map(clone: string): { ok: boolean; ms: number; detail: string } {
    fs.mkdirSync(path.join(clone, 'agents'), { recursive: true });
    const t0 = Date.now();
    const r = spawnSync(SCRIPTS_RUN, ['src/scripts/code_graph/cli', 'map', '--root', clone, '--no-verify'], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        timeout: 180_000,
    });
    const ok = r.status === 0 && fs.existsSync(path.join(clone, 'agents', 'map', 'code', 'map.json'));
    const tail = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-2).join(' | ');
    return { ok, ms: Date.now() - t0, detail: ok ? 'map drawn' : `exit=${r.status ?? 'null'} ${tail}` };
}

/** The synthetic answer a stub gives — its declared set mirrors what it changed. */
export function stub_transcript(task: MapTask, behaviour: StubBehaviour): string {
    if (behaviour === 'none') return 'I looked at the task and made no change.';
    const places = behaviour === 'naive' ? [...task.primary] : [...task.affected.map((a) => a.id), 'README.md'];
    return ['Done.', '', AFFECTED_HEADER, ...places.map((p) => `- ${p}`), AFFECTED_FOOTER, ''].join('\n');
}

export function stub_usage(behaviour: StubBehaviour, seed: number): TokensBreakdown {
    const base = { none: 1000, naive: 2000, reference: 4000 }[behaviour];
    return { input_tokens: base, output_tokens: 100 + seed, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
}

export interface TrialOpts {
    seed: number;
    model: string | null;
    max_budget: number | null;
    timeout: number;
    rates: TierRates | null;
    sp_dir: string;
    dry_run: boolean;
    map_build: boolean;
}

export function run_trial(task: MapTask, arm: string, opts: TrialOpts): MapTrial {
    const spec = MAP_ARMS[arm] as MapArmSpec;
    const [clone] = reset_fixture({ id: task.id, fixture: task.fixture }, arm, opts.seed);
    let map_build: MapTrial['map_build'] = null;
    if (spec.install && !opts.dry_run) install_into_clone(clone, spec.install);
    if (spec.map && opts.map_build) {
        map_build = build_map(clone);
    }
    let transcript = '';
    let breakdown: TokensBreakdown | Record<string, never> = {};
    let errored = false;
    let reason: string | null = null;
    let trace: TrialTrace | undefined;
    if (map_build && !map_build.ok) {
        errored = true;
        reason = `map build failed: ${map_build.detail}`;
    } else if (opts.dry_run) {
        const behaviour = DRY_RUN_STUB[arm] ?? 'none';
        if (behaviour !== 'none') {
            apply_reference(task, MAP_FIXTURES_ROOT, clone, behaviour === 'naive' ? task.primary : undefined);
        }
        transcript = stub_transcript(task, behaviour);
        breakdown = stub_usage(behaviour, opts.seed);
        trace = parseTrace(stub_stream(task, behaviour, spec), { wall_s: 0, ac_version: acVersion(spec), payload: spec.inject });
    } else {
        let sp_file: string | null = null;
        if (spec.inject) {
            sp_file = path.join(opts.sp_dir, `.sp-map-${arm}.txt`);
            fs.writeFileSync(sp_file, spec.inject, 'utf-8');
        }
        const run = v1.run_live({ id: task.id, prompt: task.prompt + AFFECTED_SET_INSTRUCTION }, clone, opts.timeout, {
            ...(spec.map ? { env: { PATH: `${branchCliShim()}${path.delimiter}${process.env['PATH'] ?? ''}` } } : {}),
            sysprompt_file: sp_file,
            setting_sources: spec.setting_sources,
            max_budget: opts.max_budget,
            model: opts.model,
            stream: true,
        }) as unknown as Dict;
        trace = parseTrace(String(run['stream'] ?? ''), { wall_s: Number(run['wall_time_seconds'] ?? 0), ac_version: acVersion(spec), payload: spec.inject, clone });
        transcript = String(run['transcript'] ?? '');
        breakdown = (run['tokens_breakdown'] ?? {}) as TokensBreakdown | Record<string, never>;
        errored = Boolean(run['errored']);
        reason = run['reason'] === undefined || run['reason'] === null ? null : String(run['reason']);
    }
    const check = evaluate_hidden_check(task, clone);
    return {
        task_id: task.id,
        area: task.area,
        arm,
        seed: opts.seed,
        errored,
        success: !errored && check.pass,
        check_passed: check.pass,
        broken_dependents: check.broken_dependents,
        affected: score_affected(task, parse_affected_section(transcript)),
        tokens: total_tokens(breakdown),
        usd: opts.rates ? cost_usd(breakdown, opts.rates) : 0,
        reason,
        check_failures: check.failures,
        tokens_breakdown: breakdown,
        map_build,
        workspace: clone,
        transcript_path: opts.dry_run ? null : preserve_transcript(clone, transcript),
        synthetic: opts.dry_run,
        ...(trace ? { trace } : {}),
    };
}

/**
 * What the stub's three behaviours imply for the metrics. Each line is a
 * plumbing defect: a scorer, parser or aggregator that does not report what the
 * stub demonstrably did.
 */
export function dry_run_problems(summaries: Record<string, ArmSummary>, tasks: MapTask[], seeds: number): string[] {
    const problems: string[] = [];
    const n = tasks.length * seeds;
    for (const [arm, s] of Object.entries(summaries)) {
        const behaviour = DRY_RUN_STUB[arm];
        if (s.runs !== n) problems.push(`${arm}: ${s.runs} runs, expected ${n}`);
        if (s.errored !== 0) problems.push(`${arm}: ${s.errored} errored runs`);
        if (s.m3_tokens_total <= 0) problems.push(`${arm}: no tokens counted`);
        if (behaviour === 'reference') {
            if (s.successes !== n) problems.push(`${arm}: reference change passed ${s.successes}/${n} hidden checks`);
            if (s.m2_mean_recall !== 1) problems.push(`${arm}: recall ${String(s.m2_mean_recall)} for a complete declared set`);
            const p = s.m2_mean_precision ?? 1;
            if (!(p < 1 && p > 0)) problems.push(`${arm}: precision ${String(s.m2_mean_precision)} despite one extra declared place`);
            if (s.m3_tokens_per_success === null || Math.abs(s.m3_tokens_per_success * s.successes - s.m3_tokens_total) > 1e-6) {
                problems.push(`${arm}: tokens per success is not total ÷ successes`);
            }
        } else {
            if (s.successes !== 0) problems.push(`${arm}: ${s.successes} hidden checks passed on a ${behaviour} change`);
            if (s.m1_wrong_change_share !== 1) problems.push(`${arm}: wrong-change share ${String(s.m1_wrong_change_share)}`);
            if (s.m3_tokens_per_success !== null) problems.push(`${arm}: tokens per success without a success`);
        }
        if (behaviour === 'naive') {
            if (s.m1_runs_with_broken_dependent !== n) problems.push(`${arm}: naive change broke a dependent in ${s.m1_runs_with_broken_dependent}/${n}`);
            if (s.m2_mean_precision !== 1) problems.push(`${arm}: precision ${String(s.m2_mean_precision)} for primary-only declarations`);
            if ((s.m2_mean_recall ?? 1) >= 1) problems.push(`${arm}: recall ${String(s.m2_mean_recall)} for a primary-only set`);
        }
        if (behaviour === 'none') {
            if (s.m2_section_missing !== n) problems.push(`${arm}: ${s.m2_section_missing}/${n} runs without a declared section`);
            if (s.m2_mean_precision !== null) problems.push(`${arm}: precision reported without any declaration`);
        }
    }
    return problems;
}

interface Args {
    arms: string[];
    seeds: number;
    tasks: string[];
    limit: number;
    model: string | null;
    budget: number;
    max_usd: number | null;
    timeout: number;
    token_budget: number;
    dry_run: boolean;
    map_build: boolean;
    out_dir: string | null;
    fresh: boolean;
    /** Re-score a stored report: no clone, no model call, no spend. */
    rescore: string | null;
    /** Fail unless every trial carries every trace field. */
    check_trace_fields: boolean;
    print_arms: boolean;
}

class UsageError extends Error {}

export function parse_args(argv: string[]): Args {
    const a: Args = {
        arms: [...DEFAULT_MAP_ARMS],
        seeds: 1,
        tasks: [],
        limit: 0,
        model: null,
        budget: 1.0,
        max_usd: null,
        timeout: 900,
        token_budget: 1_500_000,
        dry_run: false,
        map_build: true,
        out_dir: null,
        fresh: false,
        rescore: null,
        check_trace_fields: false,
        print_arms: false,
    };
    const num = (flag: string, v: string | undefined): number => {
        const n = Number(v);
        if (v === undefined || !Number.isFinite(n)) throw new UsageError(`${flag} needs a number`);
        return n;
    };
    const list = (v: string | undefined): string[] => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    for (let i = 0; i < argv.length; i++) {
        const flag = argv[i] as string;
        const next = (): string | undefined => argv[++i];
        switch (flag) {
            case '--arms': a.arms = list(next()); break;
            case '--seeds': a.seeds = num(flag, next()); break;
            case '--tasks': a.tasks = list(next()); break;
            case '--limit': a.limit = num(flag, next()); break;
            case '--model': a.model = next() ?? null; break;
            case '--budget': a.budget = num(flag, next()); break;
            case '--max-usd': a.max_usd = num(flag, next()); break;
            case '--timeout': a.timeout = num(flag, next()); break;
            case '--token-budget': a.token_budget = num(flag, next()); break;
            case '--dry-run': a.dry_run = true; break;
            case '--no-map-build': a.map_build = false; break;
            case '--out-dir': a.out_dir = next() ?? null; break;
            case '--fresh': a.fresh = true; break;
            case '--rescore': a.rescore = next() ?? null; break;
            case '--check-trace-fields': a.check_trace_fields = true; break;
            case '--print-arms': a.print_arms = true; break;
            default: throw new UsageError(`unknown argument: ${flag}`);
        }
    }
    for (const arm of a.arms) if (!(arm in MAP_ARMS)) throw new UsageError(`unknown arm: ${arm}`);
    if (a.seeds < 1 || !Number.isInteger(a.seeds)) throw new UsageError('--seeds must be a positive integer');
    return a;
}

function checkpoint_path(dir: string, a: Args, task_ids: string[]): string {
    const key = createHash('sha256')
        .update(JSON.stringify([a.model, a.seeds, a.arms, a.budget, a.timeout, task_ids]))
        .digest('hex')
        .slice(0, 16);
    return path.join(dir, 'checkpoints', `${key}.jsonl`);
}

function load_checkpoint(file: string): Map<string, MapTrial> {
    const done = new Map<string, MapTrial>();
    if (!fs.existsSync(file)) return done;
    for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
        if (!line.trim()) continue;
        try {
            const t = JSON.parse(line) as MapTrial;
            done.set(`${t.task_id}|${t.arm}|${t.seed}`, t);
        } catch {
            // A torn last line from a killed run is dropped; that trial re-runs.
        }
    }
    return done;
}

/**
 * Re-score a stored report with today's grading: the outcome from `errored` and
 * the recorded check failures, M2 from the preserved transcript when it is still
 * on disk (else the stored score). Prints one line per arm and area.
 */
export function rescore_report(file: string, budget_tokens_per_run?: number): { lines: string[]; summaries: Record<string, ArmSummary> } {
    const report = JSON.parse(fs.readFileSync(file, 'utf-8')) as { arms: string[]; budget_tokens_per_run?: number; records: Array<MapRunRecord & { check_failures?: string[]; transcript_path?: string | null }> };
    const tasks = new Map(load_map_tasks().map((t) => [t.id, t] as const));
    const records: MapRunRecord[] = report.records.map((r) => {
        const task = tasks.get(r.task_id);
        const tp = r.transcript_path;
        const affected = task && tp && fs.existsSync(tp) ? score_affected(task, parse_affected_section(fs.readFileSync(tp, 'utf-8'))) : r.affected;
        const check_passed = (r.check_failures ?? []).length === 0;
        return { ...r, affected, check_passed, success: !r.errored && check_passed };
    });
    const budget = budget_tokens_per_run ?? report.budget_tokens_per_run ?? 1_500_000;
    const summaries: Record<string, ArmSummary> = {};
    const lines: string[] = [];
    for (const arm of report.arms) {
        const s = (summaries[arm] = summarise_arm(arm, records, budget));
        lines.push(`${arm}: ${s.successes}/${s.runs} success · ${s.errored_check_passed} errored, check passed · M2 recall ${s.m2_mean_recall?.toFixed(3) ?? '–'}`);
        for (const [area, v] of Object.entries(s.by_area).sort()) lines.push(`${arm} ${area} ${v.checks_passed}/${v.runs} checks passed (${v.successes} clean)`);
    }
    return { lines, summaries };
}

export function main(argv: string[] = process.argv.slice(2)): number {
    let a: Args;
    try {
        a = parse_args(argv);
    } catch (e) {
        process.stderr.write(`bench_map_task_set: ${(e as Error).message}\n`);
        return 1;
    }
    if (a.print_arms) {
        const rows = Object.entries(MAP_ARMS).map(([arm, s]) => `  ${arm.padEnd(12)} package ${s.install ?? 'none'} · map ${s.map ? 'yes + note' : 'no'}${s.optional ? ' · optional' : ''}`);
        process.stdout.write(`${Object.keys(MAP_ARMS).length} arms (default: ${DEFAULT_MAP_ARMS.join(', ')})\n${rows.join('\n')}\n`);
        return 0;
    }
    if (a.rescore) {
        if (!fs.existsSync(a.rescore)) {
            process.stderr.write(`bench_map_task_set: no report at ${a.rescore}\n`);
            return 1;
        }
        process.stdout.write(`${rescore_report(a.rescore).lines.join('\n')}\n`);
        return 0;
    }
    let tasks = load_map_tasks();
    // `--tasks N` with a bare count takes the first N tasks.
    if (a.tasks.length === 1 && /^\d+$/.test(a.tasks[0] as string)) {
        a.limit = Number(a.tasks[0]);
        a.tasks = [];
    }
    if (a.tasks.length) {
        const unknown = a.tasks.filter((id) => !tasks.some((t) => t.id === id));
        if (unknown.length) {
            process.stderr.write(`bench_map_task_set: unknown task(s): ${unknown.join(', ')}\n`);
            return 1;
        }
        tasks = tasks.filter((t) => a.tasks.includes(t.id));
    } else if (a.limit > 0) {
        tasks = tasks.slice(0, a.limit);
    }

    if (!a.dry_run) {
        if (!a.model) {
            process.stderr.write('bench_map_task_set: a live run needs --model <full model id>\n');
            return 1;
        }
        if (is_bare_alias(a.model)) {
            process.stderr.write(`bench_map_task_set: refusing bare model alias "${a.model}" — pin a full id\n`);
            return 2;
        }
        if (v1.claude_executable() === null) {
            process.stderr.write('bench_map_task_set: claude CLI not found\n');
            return 1;
        }
    }
    const [rates] = load_pricing(PRICING_PATH);
    const tier = a.model ? tier_for_model(a.model) : null;
    const tier_rates: TierRates | null = tier && rates[tier] ? (rates[tier] as TierRates) : null;
    if (a.max_usd !== null && tier_rates === null) {
        process.stderr.write(`bench_map_task_set: --max-usd given but no pricing row matches "${a.model ?? ''}"\n`);
        return 2;
    }

    const out_dir = a.out_dir ?? (a.dry_run ? fs.mkdtempSync(path.join(os.tmpdir(), 'map-task-set-dryrun-')) : REPORTS_DIR);
    fs.mkdirSync(out_dir, { recursive: true });
    const ckpt = a.dry_run ? null : checkpoint_path(out_dir, a, tasks.map((t) => t.id));
    if (ckpt && a.fresh) fs.rmSync(ckpt, { force: true });
    const done = ckpt ? load_checkpoint(ckpt) : new Map<string, MapTrial>();
    if (ckpt) fs.mkdirSync(path.dirname(ckpt), { recursive: true });

    const budget = new SweepBudget(a.max_usd, tier_rates);
    const opts = (seed: number): TrialOpts => ({
        seed,
        model: a.model,
        max_budget: a.budget > 0 ? a.budget : null,
        timeout: a.timeout,
        rates: tier_rates,
        sp_dir: out_dir,
        dry_run: a.dry_run,
        map_build: a.map_build,
    });

    const records: MapTrial[] = [];
    let aborted: string | null = null;
    const total = tasks.length * a.arms.length * a.seeds;
    outer: for (const task of tasks) {
        for (const arm of a.arms) {
            for (let seed = 0; seed < a.seeds; seed++) {
                const key = `${task.id}|${arm}|${seed}`;
                let trial = done.get(key);
                if (!trial) {
                    trial = run_trial(task, arm, opts(seed));
                    if (ckpt) fs.appendFileSync(ckpt, `${JSON.stringify(trial)}\n`);
                }
                records.push(trial);
                process.stderr.write(
                    `[${records.length}/${total}] ${task.id} · ${arm} · seed ${seed} → ` +
                        `${trial.errored ? 'ERRORED' : trial.success ? 'ok' : 'WRONG'} ` +
                        `recall ${trial.affected.recall.toFixed(2)} · ${trial.tokens} tok\n`,
                );
                const over = budget.add(trial.tokens_breakdown);
                if (over) {
                    aborted = over;
                    break outer;
                }
            }
        }
    }

    const summaries: Record<string, ArmSummary> = {};
    for (const arm of a.arms) summaries[arm] = summarise_arm(arm, records, a.token_budget);
    const problems = a.dry_run && !aborted ? dry_run_problems(summaries, tasks, a.seeds) : [];

    const stamp = v1.utc_stamp();
    const payload = {
        schema: 'map-task-set/0.1',
        stamp,
        tier: a.dry_run ? 'dry-run' : 'live',
        synthetic: a.dry_run,
        model: a.model,
        arms: a.arms,
        seeds: a.seeds,
        tasks: tasks.map((t) => t.id),
        budget_usd_per_run: a.budget,
        sweep_cap_usd: a.max_usd,
        sweep_spend_usd: Number(budget.spent_usd.toFixed(4)),
        budget_tokens_per_run: a.token_budget,
        map_confirm_text: MAP_CONFIRM_TEXT,
        aborted,
        dry_run_problems: problems,
        summaries,
        records,
    };
    const out = path.join(out_dir, `${stamp}-map-task-set${a.dry_run ? '-dryrun' : ''}.json`);
    fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
    if (ckpt && !aborted) fs.rmSync(ckpt, { force: true });

    for (const s of Object.values(summaries)) {
        process.stdout.write(
            `${s.arm.padEnd(8)} M1 wrong ${fmt(s.m1_wrong_change_share)} · M2 recall ${fmt(s.m2_mean_recall)} ` +
                `precision ${fmt(s.m2_mean_precision)} · M3 tok/success ${s.m3_tokens_per_success === null ? 'n/a' : Math.round(s.m3_tokens_per_success)} ` +
                `· $${s.usd_total.toFixed(2)}\n`,
        );
    }
    process.stdout.write(
        `bench_map_task_set: wrote ${out} (${records.length}/${total} runs, ` +
            (a.dry_run ? 'DRY RUN — stub agent, no model, not publishable' : `spend $${budget.spent_usd.toFixed(2)}`) +
            ')\n',
    );
    if (aborted) {
        process.stderr.write(`bench_map_task_set: ${aborted}\n`);
        return 2;
    }
    if (a.check_trace_fields) {
        const short = records.map((r) => [`${r.task_id}|${r.arm}|${r.seed}`, missingTraceFields(r.trace)] as const).filter(([, m]) => m.length);
        if (short.length) {
            for (const [k, m] of short) process.stderr.write(`  ${k}: no ${m.join(', ')}\n`);
            return 1;
        }
        process.stdout.write(`trace fields: complete on ${records.length} trial(s)\n`);
    }
    if (problems.length) {
        process.stderr.write(`bench_map_task_set: DRY RUN FAILED — ${problems.length} plumbing problem(s)\n`);
        for (const p of problems) process.stderr.write(`  ${p}\n`);
        return 2;
    }
    return 0;
}

function fmt(x: number | null): string {
    return x === null ? 'n/a' : x.toFixed(3);
}

function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (isCliEntry()) {
    process.exitCode = main();
}

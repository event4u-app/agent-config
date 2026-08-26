#!/usr/bin/env node
/**
 * Quantitative skill-eval orchestrator (skill-writing § 7).
 *
 * Ported from the retired Python `src/scripts/run_skill_evals.py` (ADR-200 — Python→TS
 * migration, Phase 8 / Wave 8e). The CLI contract is pinned:
 * same subcommands (`scaffold`, `aggregate`, `report`), same flags
 * (`--run`), same exit codes (0 success; 1 on `sys.exit(msg)` errors),
 * same byte-identical stdout / stderr prose and byte-identical written
 * JSON files (json.dumps indent=2 + trailing newline). No behaviour
 * changes.
 *
 * SKILLS_ROOT diverges from the mirrored .py source: it resolves the live
 * skills tree through the shared resolver instead of replicating the retired
 * container literal. Replicating it made every subcommand fail in
 * `_skill_dir()` before doing any work — the twin was byte-faithful to a
 * source that no longer exists and runnable against nothing. Documented per
 * ADR-200 § 6 in `docs/migration/divergences/src-scripts-run_skill_evals.md`;
 * an undocumented difference would be a regression by definition.
 *
 * Sub-agent SPAWNING is per-environment (Claude Code, Augment Code,
 * council) and is left as a stub `_spawn_subagent(...)` that authors
 * implement once for their environment. The rest of the loop —
 * scaffold / aggregate / report — works out of the box and reads /
 * writes JSON files in `runs/`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { SRC_SKILLS } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/run_skill_evals.ts → parents[2] is the repo root (mirrors
// `Path(__file__).resolve().parent.parent.parent` in the .py).
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const SKILLS_ROOT = SRC_SKILLS();

/** JSON value type for eval specs / grades. */
type JsonValue =
    | null
    | boolean
    | number
    | string
    | JsonValue[]
    | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

/**
 * Raised by `sys.exit(msg)`. Carries the message printed to stderr; the
 * caller exits with code 1. Mirrors CPython's `SystemExit(str)` → write
 * the message to stderr and exit 1.
 */
class SysExit extends Error {
    constructor(readonly text: string) {
        super(text);
        this.name = 'SysExit';
    }
}

function _skill_dir(skill: string): string {
    const p = path.join(SKILLS_ROOT, skill);
    if (!_isDir(p)) {
        throw new SysExit(`error: skill '${skill}' not found at ${p}`);
    }
    return p;
}

function _evals_dir(skill: string): string {
    return path.join(_skill_dir(skill), 'evals');
}

function _load_evals(skill: string): JsonObject {
    const f = path.join(_evals_dir(skill), 'evals.json');
    if (!_exists(f)) {
        throw new SysExit(`error: ${f} not found — create it before scaffolding`);
    }
    return JSON.parse(fs.readFileSync(f, 'utf-8')) as JsonObject;
}

function _timestamp(): string {
    // datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    const d = new Date();
    const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
    return (
        `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
    );
}

/**
 * STUB — implement per environment. Mirrors the Python NotImplementedError
 * contract. The live spawn path is not exercised by tests.
 */
export function _spawn_subagent(
    _prompt: string,
    _options: { load_skill: string | null },
): JsonObject {
    throw new Error(
        'implement _spawn_subagent for this environment (Claude Code, ' +
            'Augment, council, ...) — see docstring contract',
    );
}

/**
 * Count "findings" in an eval output for the `finding_floor` assertion
 * (roadmap `road-to-operator-runtime-harvest`, Phase 1). With an explicit
 * `pattern`, counts non-overlapping global regex matches; without one, counts
 * markdown list-item lines (the default shape a skill's findings take).
 *
 * Deterministic on purpose: this only *counts*. The substantive judgement —
 * is each match a real finding, and what should `n` be per host — is the
 * calibration layer. CALIBRATED 2026-07-12: the cross-model count-distribution
 * pass (`bench_parity_count.ts`, design in
 * `docs/design/cross-model-parity-eval.md`) recorded per-host finding-count
 * distributions over the orchestration corpus for 2 vendors and derived
 * per-task floors from the cross-host lower envelope
 * (`internal/bench/reports/parity-count.json`). `finding_floor` is therefore an
 * ENFORCING gate: a fixture's `n` is justified against the cross-vendor norm,
 * not one vendor's output shape. New floors follow the same envelope rule
 * (max(1, min over hosts of median count); negative controls excluded).
 */
export function _count_findings(output: string, pattern?: string): number {
    if (pattern !== undefined && pattern !== '') {
        let re: RegExp;
        try {
            re = new RegExp(pattern, 'g');
        } catch {
            return 0;
        }
        const m = output.match(re);
        return m ? m.length : 0;
    }
    let count = 0;
    for (const line of output.split('\n')) {
        if (/^\s*(?:[-*+]|\d+[.)])\s+\S/.test(line)) {
            count += 1;
        }
    }
    return count;
}

/**
 * Load the recorded tool trace from `<run_dir>/tool-trace.json` — an array of
 * tool-call names (strings) or `{tool: string}` objects. Returns null when the
 * file is absent (→ tool-choice / trajectory assertions report manual-pending).
 */
export function _load_tool_trace(run_dir: string): string[] | null {
    const p = path.join(run_dir, 'tool-trace.json');
    if (!_exists(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as Array<string | { tool?: string }>;
    if (!Array.isArray(raw)) return null;
    return raw.map((e) => (typeof e === 'string' ? e : (e.tool ?? ''))).filter((s) => s !== '');
}

/**
 * Load the recorded EVENT trace, or `null` when the run did not record one.
 *
 * Sibling of {@link _load_tool_trace}, and deliberately a separate file rather
 * than a widened tool trace: a tool call is something the agent did, an event
 * is something the harness observed — a gate running, a hook concern firing, a
 * refusal. Conflating them would make "the linter ran" indistinguishable from
 * "the agent invoked the linter", and the interesting failure is precisely the
 * case where a gate was SKIPPED while the agent narrated that it passed.
 */
export function _load_event_trace(run_dir: string): string[] | null {
    const p = path.join(run_dir, 'event-trace.json');
    if (!_exists(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as Array<string | { event?: string }>;
    if (!Array.isArray(raw)) return null;
    return raw.map((e) => (typeof e === 'string' ? e : (e.event ?? ''))).filter((s) => s !== '');
}

/** Count meaningful steps: tool calls net of retries (a call whose name equals
 * the immediately-preceding call name is a retry, not a new step). */
export function _count_meaningful_steps(trace: string[]): number {
    let steps = 0;
    let prev: string | null = null;
    for (const t of trace) {
        if (t !== prev) steps += 1;
        prev = t;
    }
    return steps;
}

export function _grade_assertions(
    output: string,
    run_dir: string,
    assertions: JsonObject[],
): JsonObject[] {
    const results: JsonObject[] = [];
    for (const a of assertions) {
        const kind = a['kind'] as string | undefined;
        if (kind === 'contains') {
            const ok = output.includes(a['value'] as string);
            results.push({ kind, value: a['value'] as JsonValue, pass: ok });
        } else if (kind === 'not_contains') {
            // U2 golden-adversarial negative: benign look-alikes must NOT be flagged.
            const ok = !output.includes(a['value'] as string);
            results.push({ kind, value: a['value'] as JsonValue, pass: ok });
        } else if (kind === 'file_exists') {
            const apath = a['path'] as string;
            const ok = _exists(path.join(run_dir, apath)) || _exists(apath);
            results.push({ kind, path: apath, pass: ok });
        } else if (kind === 'rubric') {
            results.push({
                kind,
                criterion: a['criterion'] as JsonValue,
                pass: null,
                note: 'rubric grading requires sub-agent — fill in manually or via grader',
            });
        } else if (kind === 'finding_floor') {
            const n = (a['n'] as number | undefined) ?? 1;
            const pattern = a['pattern'] as string | undefined;
            const count = _count_findings(output, pattern);
            results.push({ kind, n, count, pass: count >= n });
        } else if (kind === 'tool-choice') {
            // Evaluated against the recorded tool trace (<run_dir>/tool-trace.json).
            // No trace (e.g. scaffold-only / CI without a live run) → manual-pending,
            // NEVER a silent pass.
            const mustUse = (a['must_use'] as string[] | undefined) ?? [];
            const mustNot = (a['must_not_use'] as string[] | undefined) ?? [];
            const trace = _load_tool_trace(run_dir);
            if (trace === null) {
                results.push({
                    kind, must_use: mustUse, must_not_use: mustNot, pass: null,
                    note: 'manual-pending: no tool-trace.json in run dir — record a trace or grade manually',
                });
            } else {
                const used = new Set(trace);
                const missing = mustUse.filter((t) => !used.has(t));
                const forbidden = mustNot.filter((t) => used.has(t));
                results.push({
                    kind, must_use: mustUse, must_not_use: mustNot,
                    missing, forbidden, pass: missing.length === 0 && forbidden.length === 0,
                });
            }
        } else if (kind === 'event-choice') {
            // The forbidden-event half of the case shape. Same manual-pending
            // rule as tool-choice: no trace is NEVER a silent pass, because a
            // missing trace and a clean run are the two readings this assertion
            // exists to separate.
            const mustEmit = (a['must_emit'] as string[] | undefined) ?? [];
            const mustNotEmit = (a['must_not_emit'] as string[] | undefined) ?? [];
            const trace = _load_event_trace(run_dir);
            if (trace === null) {
                results.push({
                    kind, must_emit: mustEmit, must_not_emit: mustNotEmit, pass: null,
                    note: 'manual-pending: no event-trace.json in run dir — record a trace or grade manually',
                });
            } else {
                const seen = new Set(trace);
                const missing = mustEmit.filter((e) => !seen.has(e));
                const forbidden = mustNotEmit.filter((e) => seen.has(e));
                results.push({
                    kind, must_emit: mustEmit, must_not_emit: mustNotEmit,
                    missing, forbidden, pass: missing.length === 0 && forbidden.length === 0,
                });
            }
        } else if (kind === 'trajectory_budget') {
            // Meaningful step = one tool call net of retries (a retry is a call whose
            // tool name repeats the immediately-preceding call). No trace → manual-pending.
            const budget = a['n'] as number;
            const trace = _load_tool_trace(run_dir);
            if (trace === null) {
                results.push({ kind, n: budget, pass: null, note: 'manual-pending: no tool-trace.json in run dir' });
            } else {
                const steps = _count_meaningful_steps(trace);
                results.push({ kind, n: budget, steps, pass: steps <= budget });
            }
        } else {
            results.push({ kind: kind ?? null, pass: false, note: `unknown assertion kind ${_pyRepr(kind)}` });
        }
    }
    return results;
}

export function cmd_scaffold(skill: string): number {
    const spec = _load_evals(skill);
    const scenarios = (spec['scenarios'] as JsonObject[] | undefined) ?? [];
    if (scenarios.length === 0) {
        throw new SysExit('error: evals.json has no scenarios');
    }
    const ts = _timestamp();
    const runs = path.join(_evals_dir(skill), 'runs');
    for (const arm of ['baseline', 'with-skill']) {
        for (const sc of scenarios) {
            const d = path.join(runs, `${ts}-${arm}`, sc['id'] as string);
            fs.mkdirSync(d, { recursive: true });
            fs.writeFileSync(
                path.join(d, 'meta.json'),
                _jsonDumpsIndent2({
                    skill,
                    arm,
                    scenario_id: sc['id'] as JsonValue,
                    prompt: sc['prompt'] as JsonValue,
                    assertions: (sc['assertions'] as JsonValue) ?? [],
                    timestamp: ts,
                }) + '\n',
                'utf-8',
            );
        }
    }
    process.stdout.write(
        `scaffolded ${scenarios.length} scenarios × 2 arms at runs/${ts}-{baseline,with-skill}/\n`,
    );
    process.stdout.write(`timestamp: ${ts}\n`);
    return 0;
}

export function cmd_aggregate(skill: string, run: string): number {
    const runs = path.join(_evals_dir(skill), 'runs');
    const spec = _load_evals(skill);
    const bench: JsonObject = {
        skill,
        run,
        generated_at: _timestamp(),
        scenarios: [],
    };
    const totals: JsonObject = { baseline_pass: 0, with_skill_pass: 0, scenarios: 0 };
    const benchScenarios: JsonObject[] = [];
    for (const sc of (spec['scenarios'] as JsonObject[] | undefined) ?? []) {
        const row: JsonObject = { id: sc['id'] as JsonValue, arms: {} };
        const arms = row['arms'] as JsonObject;
        for (const arm of ['baseline', 'with-skill']) {
            const run_dir = path.join(runs, `${run}-${arm}`, sc['id'] as string);
            const grade_f = path.join(run_dir, 'grade.json');
            if (!_exists(grade_f)) {
                arms[arm] = { status: 'missing', pass_count: 0, total: 0 };
                continue;
            }
            const g = JSON.parse(fs.readFileSync(grade_f, 'utf-8')) as JsonObject;
            const results = (g['results'] as JsonObject[] | undefined) ?? [];
            const passed = results.filter((r) => r['pass'] === true).length;
            arms[arm] = {
                status: 'graded',
                pass_count: passed,
                total: results.length,
                elapsed_s: (g['elapsed_s'] as JsonValue) ?? null,
                tokens_in: (g['tokens_in'] as JsonValue) ?? null,
                tokens_out: (g['tokens_out'] as JsonValue) ?? null,
            };
            if (arm === 'baseline' && passed === results.length && results.length > 0) {
                totals['baseline_pass'] = (totals['baseline_pass'] as number) + 1;
            }
            if (arm === 'with-skill' && passed === results.length && results.length > 0) {
                totals['with_skill_pass'] = (totals['with_skill_pass'] as number) + 1;
            }
        }
        benchScenarios.push(row);
        totals['scenarios'] = (totals['scenarios'] as number) + 1;
    }
    bench['scenarios'] = benchScenarios as unknown as JsonValue;
    bench['totals'] = totals;
    const out = path.join(runs, `${run}-benchmark.json`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, _jsonDumpsIndent2(bench) + '\n', 'utf-8');
    process.stdout.write(`wrote ${_relToRepoRoot(out)}\n`);
    process.stdout.write(`  baseline pass: ${totals['baseline_pass']}/${totals['scenarios']}\n`);
    process.stdout.write(`  with-skill pass: ${totals['with_skill_pass']}/${totals['scenarios']}\n`);
    return 0;
}

export function cmd_report(skill: string, run: string): number {
    const bench_f = path.join(_evals_dir(skill), 'runs', `${run}-benchmark.json`);
    if (!_exists(bench_f)) {
        throw new SysExit(`error: ${bench_f} not found — run aggregate first`);
    }
    const bench = JSON.parse(fs.readFileSync(bench_f, 'utf-8')) as JsonObject;
    process.stdout.write(`# Skill eval report — ${skill} @ ${run}\n\n`);
    process.stdout.write('| Scenario | Baseline | With skill | Δ tokens_out | Δ elapsed_s |\n');
    process.stdout.write('|---|---|---|---|---|\n');
    for (const sc of bench['scenarios'] as JsonObject[]) {
        const arms = sc['arms'] as JsonObject;
        const b = (arms['baseline'] as JsonObject | undefined) ?? {};
        const w = (arms['with-skill'] as JsonObject | undefined) ?? {};
        const bp = `${(b['pass_count'] as number | undefined) ?? 0}/${(b['total'] as number | undefined) ?? 0}`;
        const wp = `${(w['pass_count'] as number | undefined) ?? 0}/${(w['total'] as number | undefined) ?? 0}`;
        const dt = _orZero(w['tokens_out']) - _orZero(b['tokens_out']);
        const de = _orZero(w['elapsed_s']) - _orZero(b['elapsed_s']);
        process.stdout.write(
            `| ${sc['id']} | ${bp} | ${wp} | ${_pyPlusInt(dt)} | ${_pyPlusFloat2(de)} |\n`,
        );
    }
    const t = bench['totals'] as JsonObject;
    process.stdout.write(
        `\n**Totals:** baseline ${t['baseline_pass']}/${t['scenarios']} · with-skill ${t['with_skill_pass']}/${t['scenarios']}\n`,
    );
    return 0;
}

// --- helpers ---------------------------------------------------------------

/** Mirror `(x or 0)` for numeric coercion in the report deltas. */
function _orZero(value: JsonValue | undefined): number {
    if (value === undefined || value === null) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string') return value === '' ? 0 : Number(value);
    return 0;
}

/** Mirror Python `f"{dt:+d}"` — signed integer. */
function _pyPlusInt(n: number): string {
    const i = Math.trunc(n);
    return i >= 0 ? `+${i}` : `${i}`;
}

/** Mirror Python `f"{de:+.2f}"` — signed fixed-2 float (round-half-even). */
function _pyPlusFloat2(n: number): string {
    const rounded = _pyRound(n, 2);
    const fixed = Math.abs(rounded).toFixed(2);
    const sign = rounded < 0 || Object.is(rounded, -0) ? '-' : '+';
    return `${sign}${fixed}`;
}

/** Python `round(x, ndigits)` — banker's rounding (round-half-to-even). */
function _pyRound(x: number, ndigits: number): number {
    if (!Number.isFinite(x)) return x;
    const m = 10 ** ndigits;
    const scaled = x * m;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let rounded: number;
    const eps = 1e-9;
    if (Math.abs(diff - 0.5) < eps) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    return rounded / m;
}

/** Python `repr()` of a string-or-None for the unknown-kind note. */
function _pyRepr(value: string | undefined): string {
    if (value === undefined) return 'None';
    return `'${value}'`;
}

/** Mirror `Path.relative_to(REPO_ROOT)` — POSIX-separated relative path. */
function _relToRepoRoot(p: string): string {
    return path.relative(REPO_ROOT, p).split(path.sep).join('/');
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

// --- json.dumps(indent=2) parity ------------------------------------------

function _jsonDumpsIndent2(obj: JsonValue): string {
    const pad = '  ';

    function enc(value: JsonValue, depth: number): string {
        if (value === null || value === undefined) {
            return 'null';
        }
        if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        }
        if (typeof value === 'number') {
            return String(value);
        }
        if (typeof value === 'string') {
            return encStr(value);
        }
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return '[]';
            }
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as { [k: string]: JsonValue };
        const keys = Object.keys(o);
        if (keys.length === 0) {
            return '{}';
        }
        const inner = keys.map(
            (k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k] as JsonValue, depth + 1),
        );
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
    }

    function encStr(s: string): string {
        let out = '"';
        for (const ch of s) {
            const cp = ch.codePointAt(0) as number;
            if (ch === '"') out += '\\"';
            else if (ch === '\\') out += '\\\\';
            else if (ch === '\n') out += '\\n';
            else if (ch === '\r') out += '\\r';
            else if (ch === '\t') out += '\\t';
            else if (ch === '\b') out += '\\b';
            else if (ch === '\f') out += '\\f';
            else if (cp < 0x20) out += '\\u' + cp.toString(16).padStart(4, '0');
            else if (cp < 0x7f) out += ch;
            else if (cp > 0xffff) {
                const v = cp - 0x10000;
                const hi = 0xd800 + (v >> 10);
                const lo = 0xdc00 + (v & 0x3ff);
                out += '\\u' + hi.toString(16).padStart(4, '0');
                out += '\\u' + lo.toString(16).padStart(4, '0');
            } else {
                out += '\\u' + cp.toString(16).padStart(4, '0');
            }
        }
        return out + '"';
    }

    return enc(obj, 0);
}

interface ParsedArgs {
    cmd: string;
    skill: string;
    run?: string;
}

/**
 * Mirror the argparse subparser surface. `cmd` is required; `skill` is a
 * positional on every subcommand; `--run` is required on aggregate/report.
 * On any argparse error, emit a usage line to stderr and exit 2.
 */
function parse_args(argv: readonly string[]): ParsedArgs {
    const positional: string[] = [];
    let run: string | undefined;
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i]!;
        if (arg === '--run') {
            const value = argv[i + 1];
            if (value === undefined) {
                _argError('argument --run: expected one argument');
            }
            run = value as string;
            i += 2;
            continue;
        }
        if (arg.startsWith('--run=')) {
            run = arg.slice('--run='.length);
            i += 1;
            continue;
        }
        if (arg.startsWith('-')) {
            _argError(`unrecognized arguments: ${arg}`);
        }
        positional.push(arg);
        i += 1;
    }

    if (positional.length === 0) {
        _argError('the following arguments are required: cmd');
    }
    const cmd = positional[0]!;
    if (cmd !== 'scaffold' && cmd !== 'aggregate' && cmd !== 'report') {
        _argError(
            `argument cmd: invalid choice: '${cmd}' (choose from 'scaffold', 'aggregate', 'report')`,
        );
    }
    if (positional.length < 2) {
        _argError('the following arguments are required: skill');
    }
    const skill = positional[1]!;
    if (cmd !== 'scaffold' && run === undefined) {
        _argError('the following arguments are required: --run');
    }
    const parsed: ParsedArgs = { cmd, skill };
    if (run !== undefined) {
        parsed.run = run;
    }
    return parsed;
}

function _argError(message: string): never {
    process.stderr.write(`usage: run_skill_evals [-h] {scaffold,aggregate,report} ...\n`);
    process.stderr.write(`run_skill_evals: error: ${message}\n`);
    process.exit(2);
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const args = parse_args(argv);
    if (args.cmd === 'scaffold') {
        return cmd_scaffold(args.skill);
    }
    if (args.cmd === 'aggregate') {
        return cmd_aggregate(args.skill, args.run as string);
    }
    if (args.cmd === 'report') {
        return cmd_report(args.skill, args.run as string);
    }
    return 1;
}

/** CLI entry: translate SysExit → stderr message + exit 1, mirroring CPython. */
function _runCli(): number {
    try {
        return main();
    } catch (err) {
        if (err instanceof SysExit) {
            process.stderr.write(err.text + '\n');
            return 1;
        }
        throw err;
    }
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(_runCli());
}

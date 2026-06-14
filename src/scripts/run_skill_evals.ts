#!/usr/bin/env node
/**
 * Quantitative skill-eval orchestrator (skill-writing § 7).
 *
 * TypeScript twin of `src/scripts/run_skill_evals.py` (ADR-096 — Python→TS
 * migration, Phase 8 / Wave 8e). The CLI contract is mirrored EXACTLY:
 * same subcommands (`scaffold`, `aggregate`, `report`), same flags
 * (`--run`), same exit codes (0 success; 1 on `sys.exit(msg)` errors),
 * same byte-identical stdout / stderr prose and byte-identical written
 * JSON files (json.dumps indent=2 + trailing newline). No behaviour
 * changes.
 *
 * The `.agent-src.uncondensed/skills/` literal below is part of the
 * mirrored .py source — this is a faithful twin, so the legacy path is
 * replicated verbatim, not modernized (ADR-051 carve-out for faithful
 * twins).
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

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/run_skill_evals.ts → parents[2] is the repo root (mirrors
// `Path(__file__).resolve().parent.parent.parent` in the .py).
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const SKILLS_ROOT = path.join(REPO_ROOT, '.agent-src.uncondensed', 'skills');

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

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(_runCli());
}

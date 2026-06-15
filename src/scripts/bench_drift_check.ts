#!/usr/bin/env tsx
/**
 * Drift detector for the bench corpus — step-4 Phase 3 Step 2.
 *
 * TypeScript twin of `src/scripts/bench_drift_check.py` (ADR-200, Phase 8 /
 * Wave 8d). The CLI contract mirrors the Python original EXACTLY — same
 * flags, same exit codes (0 no-drift/warmup, 1 read error, 2 drift), same
 * stdout/stderr split, byte-identical `--json` payload
 * (`json.dumps(indent=2)` / compact warmup) and Markdown lines. No behaviour
 * changes — latent Python quirks are replicated and flagged as divergence
 * candidates.
 *
 * The drift VERDICT logic is deterministic against a fixed set of reports;
 * the measured numbers it consumes come from prior bench runs and are stable
 * once written. Report-file ordering is canonicalised (component-wise path
 * sort) to mirror Python `sorted(glob(...))`.
 *
 * Compares the latest `internal/bench/reports/<stamp>-<corpus>.json` against
 * the previous N reports (default 5) for the same corpus.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as script_output from './_lib/script_output.js';

const _HERE = fileURLToPath(import.meta.url);

// Python: REPO_ROOT = Path(__file__).resolve().parent.parent.parent
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

type Report = Record<string, unknown>;

function _load_reports(reportsDir: string, corpus: string): Array<[string, Report]> {
    const out: Array<[string, Report]> = [];
    for (const p of _globSorted(reportsDir, `-${corpus}.json`)) {
        try {
            out.push([p, JSON.parse(fs.readFileSync(p, 'utf-8')) as Report]);
        } catch (exc) {
            script_output.warn(`  ⚠️  skip unreadable report ${path.basename(p)}: ${_excStr(exc)}`);
        }
    }
    return out;
}

function _mean(values: number[]): number {
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0.0;
}

interface Finding {
    axis: string;
    latest: number;
    baseline_mean: number;
    delta_pp?: number;
    threshold_pp?: number;
    delta_pct?: number;
    threshold_pct?: number;
}

function _check(
    latest: Report,
    baseline: Report[],
    thresholds: Record<string, number>,
): Finding[] {
    const findings: Finding[] = [];

    const selLatest = Number((latest['selection'] as Report)['selection_accuracy']);
    const selBaseline = _mean(
        baseline.map((r) => Number((r['selection'] as Report)['selection_accuracy'])),
    );
    const selDropPp = (selBaseline - selLatest) * 100.0;
    if (selDropPp > thresholds['accuracy_drop_pp']!) {
        findings.push({
            axis: 'selection_accuracy',
            latest: selLatest,
            baseline_mean: selBaseline,
            delta_pp: -selDropPp,
            threshold_pp: -thresholds['accuracy_drop_pp']!,
        });
    }

    const captured = [...baseline, latest].filter(
        (r) => (r['cost'] as Report)['source'] === 'captured',
    );
    if (captured.length >= 2 && (latest['cost'] as Report)['source'] === 'captured') {
        const costLatest = Number(((latest['cost'] as Report)['totals'] as Report)['cost_usd']);
        const baselineCosts = baseline
            .filter((r) => (r['cost'] as Report)['source'] === 'captured')
            .map((r) => Number(((r['cost'] as Report)['totals'] as Report)['cost_usd']));
        if (baselineCosts.length > 0) {
            const costBaseline = _mean(baselineCosts);
            if (costBaseline > 0) {
                const pct = ((costLatest - costBaseline) / costBaseline) * 100.0;
                if (pct > thresholds['cost_increase_pct']!) {
                    findings.push({
                        axis: 'cost_usd',
                        latest: costLatest,
                        baseline_mean: costBaseline,
                        delta_pct: pct,
                        threshold_pct: thresholds['cost_increase_pct']!,
                    });
                }
            }
        }
    }

    if ((latest['quality'] as Report)['source'] !== 'not_collected') {
        const qLatest = Number((latest['quality'] as Report)['quality_score']);
        const qBaseline = _mean(
            baseline
                .filter((r) => (r['quality'] as Report)['source'] !== 'not_collected')
                .map((r) => Number((r['quality'] as Report)['quality_score'])),
        );
        // Python `if q_baseline:` — truthy guard (0.0 → skip).
        if (qBaseline) {
            const qDropPp = (qBaseline - qLatest) * 100.0;
            if (qDropPp > thresholds['quality_drop_pp']!) {
                findings.push({
                    axis: 'quality_score',
                    latest: qLatest,
                    baseline_mean: qBaseline,
                    delta_pp: -qDropPp,
                    threshold_pp: -thresholds['quality_drop_pp']!,
                });
            }
        }
    }

    return findings;
}

interface Args {
    corpus: string;
    reportsDir: string;
    window: number;
    accuracyDropPp: number;
    costIncreasePct: number;
    qualityDropPp: number;
    json: boolean;
}

class ArgExit extends Error {
    readonly code: number;
    constructor(code: number) {
        super(`ArgExit(${code})`);
        this.code = code;
    }
}

function parse_args(argv: string[]): Args {
    const args: Args = {
        corpus: 'dev',
        reportsDir: 'internal/bench/reports',
        window: 5,
        accuracyDropPp: 5.0,
        costIncreasePct: 20.0,
        qualityDropPp: 10.0,
        json: false,
    };
    const takeVal = (a: string, name: string, i: { v: number }): string => {
        if (a.startsWith(`${name}=`)) {
            return a.slice(name.length + 1);
        }
        return argv[++i.v] ?? '';
    };
    const ctr = { v: 0 };
    for (ctr.v = 0; ctr.v < argv.length; ctr.v++) {
        const a = argv[ctr.v]!;
        if (a === '--corpus' || a.startsWith('--corpus=')) {
            args.corpus = takeVal(a, '--corpus', ctr);
        } else if (a === '--reports-dir' || a.startsWith('--reports-dir=')) {
            args.reportsDir = takeVal(a, '--reports-dir', ctr);
        } else if (a === '--window' || a.startsWith('--window=')) {
            args.window = _pyInt(takeVal(a, '--window', ctr));
        } else if (a === '--accuracy-drop-pp' || a.startsWith('--accuracy-drop-pp=')) {
            args.accuracyDropPp = _pyFloat(takeVal(a, '--accuracy-drop-pp', ctr));
        } else if (a === '--cost-increase-pct' || a.startsWith('--cost-increase-pct=')) {
            args.costIncreasePct = _pyFloat(takeVal(a, '--cost-increase-pct', ctr));
        } else if (a === '--quality-drop-pp' || a.startsWith('--quality-drop-pp=')) {
            args.qualityDropPp = _pyFloat(takeVal(a, '--quality-drop-pp', ctr));
        } else if (a === '--json') {
            args.json = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: bench_drift_check [-h] [--corpus CORPUS] [--reports-dir REPORTS_DIR]\n' +
                    '                         [--window WINDOW] [--accuracy-drop-pp ACCURACY_DROP_PP]\n' +
                    '                         [--cost-increase-pct COST_INCREASE_PCT]\n' +
                    '                         [--quality-drop-pp QUALITY_DROP_PP] [--json]\n',
            );
            process.exitCode = 0;
            throw new ArgExit(0);
        } else {
            process.stderr.write(`bench_drift_check: error: unrecognized arguments: ${a}\n`);
            process.exitCode = 2;
            throw new ArgExit(2);
        }
    }
    return args;
}

export function main(argv: string[] | null = null): number {
    const rawArgv = argv ?? process.argv.slice(2);
    let args: Args;
    try {
        args = parse_args(rawArgv);
    } catch (err) {
        if (err instanceof ArgExit) {
            return err.code;
        }
        throw err;
    }

    const reports = _load_reports(path.join(REPO_ROOT, args.reportsDir), args.corpus);
    if (reports.length < 2) {
        const msg =
            `  ℹ️  bench-drift · corpus=${args.corpus} · ` +
            `${reports.length} report(s) — need ≥ 2 to compare; no drift gate yet.`;
        if (args.json) {
            process.stdout.write(
                `${_jsonDumpsCompact({ status: 'warmup', reports: reports.length })}\n`,
            );
        } else {
            process.stdout.write(`${msg}\n`);
        }
        return 0;
    }

    const [latestPath, latest] = reports[reports.length - 1]!;
    // Python: reports[-(window + 1):-1]
    const start = Math.max(0, reports.length - (args.window + 1));
    const baseline = reports.slice(start, reports.length - 1).map(([, r]) => r);
    const thresholds: Record<string, number> = {
        accuracy_drop_pp: args.accuracyDropPp,
        cost_increase_pct: args.costIncreasePct,
        quality_drop_pp: args.qualityDropPp,
    };
    const findings = _check(latest, baseline, thresholds);

    // Build a PyFloat-marked payload so float-typed fields serialize with the
    // trailing ".0" CPython emits (argparse type=float thresholds; float-derived
    // finding fields). `reports` / `baseline_window` are ints — left bare.
    const payload: Json = {
        status: findings.length ? 'drift' : 'ok',
        corpus: args.corpus,
        latest_report: path.basename(latestPath),
        baseline_window: baseline.length,
        thresholds: {
            accuracy_drop_pp: new PyFloat(thresholds['accuracy_drop_pp']!),
            cost_increase_pct: new PyFloat(thresholds['cost_increase_pct']!),
            quality_drop_pp: new PyFloat(thresholds['quality_drop_pp']!),
        },
        findings: findings.map((f) => _findingToJson(f)),
    };
    if (args.json) {
        process.stdout.write(`${_jsonDumps(payload, 2)}\n`);
    } else {
        const emoji = findings.length ? '⚠️' : '✅';
        process.stdout.write(
            `  ${emoji}  bench-drift · corpus=${args.corpus} · ` +
                `latest=${path.basename(latestPath)} · window=${baseline.length} · ` +
                `findings=${findings.length}\n`,
        );
        for (const f of findings) {
            process.stdout.write(
                `     · ${f.axis}: latest=${_pyFixed(f.latest, 4)} ` +
                    `baseline_mean=${_pyFixed(f.baseline_mean, 4)}\n`,
            );
        }
    }
    return findings.length ? 2 : 0;
}

// ── parity helpers ───────────────────────────────────────────────────────

/** Mirror `sorted(reportsDir.glob(`*-{corpus}.json`))` — files ending suffix, path-sorted. */
function _globSorted(reportsDir: string, suffix: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(reportsDir);
    } catch {
        // Python glob over a missing dir yields nothing (no raise).
        return [];
    }
    const full = names.filter((n) => n.endsWith(suffix)).map((n) => path.join(reportsDir, n));
    full.sort(_pathSortCmp);
    return full;
}

/** Component-wise comparator matching pathlib's `_parts` ordering. */
function _pathSortCmp(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
        if (pa[i]! < pb[i]!) return -1;
        if (pa[i]! > pb[i]!) return 1;
    }
    return pa.length - pb.length;
}

function _excStr(exc: unknown): string {
    if (exc instanceof Error) {
        return exc.message;
    }
    return String(exc);
}

/** Python `int(str)` — base-10 strict; throws on non-numeric (argparse type=int). */
function _pyInt(s: string): number {
    const t = s.trim();
    if (!/^[+-]?\d+$/.test(t)) {
        process.stderr.write(`bench_drift_check: error: argument --window: invalid int value: '${s}'\n`);
        process.exitCode = 2;
        throw new ArgExit(2);
    }
    return parseInt(t, 10);
}

/** Python `float(str)`. */
function _pyFloat(s: string): number {
    const t = s.trim();
    const v = Number(t);
    if (t === '' || Number.isNaN(v)) {
        process.stderr.write(`bench_drift_check: error: invalid float value: '${s}'\n`);
        process.exitCode = 2;
        throw new ArgExit(2);
    }
    return v;
}

/** Format `x` to `ndigits` decimals using round-half-to-even (CPython repr). */
function _pyFixed(x: number, ndigits: number): string {
    if (!Number.isFinite(x)) {
        return String(x);
    }
    const neg = x < 0 || Object.is(x, -0);
    const abs = Math.abs(x);
    const factor = 10 ** ndigits;
    const scaled = abs * factor;
    const floor = Math.floor(scaled);
    const frac = scaled - floor;
    const tol = Math.max(Math.abs(scaled), 1) * 2 ** -40;
    let rounded: number;
    if (Math.abs(frac - 0.5) <= tol) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    let intStr = String(rounded);
    let result: string;
    if (ndigits === 0) {
        result = intStr;
    } else {
        if (intStr.length <= ndigits) {
            intStr = '0'.repeat(ndigits - intStr.length + 1) + intStr;
        }
        const whole = intStr.slice(0, intStr.length - ndigits);
        const dec = intStr.slice(intStr.length - ndigits);
        result = `${whole}.${dec}`;
    }
    return neg ? `-${result}` : result;
}

// ── JSON shaping (json.dumps parity, PyFloat-aware) ──────────────────────

/** Marks a value as a Python float — serialises integral floats with ".0". */
class PyFloat {
    constructor(readonly value: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [k: string]: Json };

/**
 * A `findings` record → Json with every float-derived field PyFloat-marked.
 * Each finding always carries `latest` + `baseline_mean`; the cost axis adds
 * `delta_pct` / `threshold_pct`, the others `delta_pp` / `threshold_pp`.
 */
function _findingToJson(f: Finding): Json {
    const out: { [k: string]: Json } = {
        axis: f.axis,
        latest: new PyFloat(f.latest),
        baseline_mean: new PyFloat(f.baseline_mean),
    };
    // Preserve insertion order matching the Python dict literals.
    if (f.delta_pp !== undefined) {
        out['delta_pp'] = new PyFloat(f.delta_pp);
        out['threshold_pp'] = new PyFloat(f.threshold_pp ?? 0);
    } else {
        out['delta_pct'] = new PyFloat(f.delta_pct ?? 0);
        out['threshold_pct'] = new PyFloat(f.threshold_pct ?? 0);
    }
    return out;
}

/** json.dumps(obj, indent=indent) — sort_keys False, ensure_ascii True. */
function _jsonDumps(obj: Json, indent: number): string {
    const pad = ' '.repeat(indent);

    function enc(value: Json, depth: number): string {
        if (value === null) return 'null';
        if (value instanceof PyFloat) {
            return Number.isInteger(value.value) ? `${value.value}.0` : String(value.value);
        }
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') return encStr(value);
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as { [k: string]: Json };
        const keys = Object.keys(o);
        if (keys.length === 0) return '{}';
        const inner = keys.map((k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k]!, depth + 1));
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

/** json.dumps(obj) compact (default ", "/": " separators), ensure_ascii True. */
function _jsonDumpsCompact(obj: Json): string {
    // Reuse the indent encoder's string-escaping by routing through enc with a
    // compact writer.
    function enc(value: Json): string {
        if (value === null) return 'null';
        if (value instanceof PyFloat) {
            return Number.isInteger(value.value) ? `${value.value}.0` : String(value.value);
        }
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') return _encStrCompact(value);
        if (Array.isArray(value)) {
            return `[${value.map((v) => enc(v)).join(', ')}]`;
        }
        const o = value as { [k: string]: Json };
        const parts = Object.keys(o).map((k) => `${_encStrCompact(k)}: ${enc(o[k]!)}`);
        return `{${parts.join(', ')}}`;
    }
    return enc(obj);
}

function _encStrCompact(s: string): string {
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

const _IS_MAIN =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (_IS_MAIN) {
    process.exit(main());
}

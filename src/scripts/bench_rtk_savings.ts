#!/usr/bin/env tsx
/**
 * Measure rtk's token savings on a fixed corpus of verbose CLI invocations.
 *
 * TypeScript twin of `src/scripts/bench_rtk_savings.py` (ADR-092 py2ts
 * Phase 8 / Wave 8d). The CLI contract mirrors the Python original
 * EXACTLY — `--corpus`, `--out`, `--quiet`, exit codes, stdout/stderr
 * split, the one-line headline summary, and byte-identical written
 * reports (`json.dumps(indent=2, ensure_ascii=False)` + trailing
 * newline, to both `<UTC>.json` and `latest.json`). No behaviour
 * changes; latent Python bugs are replicated and flagged as divergence
 * candidates.
 *
 * Phase 2 Step 3 of `agents/roadmaps/road-to-readable-value-dashboard.md`.
 *
 * For each entry in `internal/bench/corpora/rtk/commands.yaml`:
 *   1. Run the raw command, capture stdout + stderr bytes.
 *   2. Run the rtk-wrapped command, capture stdout + stderr bytes.
 *   3. Compute char + token deltas (chars / 4 approximation).
 *   4. Record per-command result + aggregate.
 *
 * Output: `internal/bench/reports/rtk/<UTC>.json` + `latest.json`.
 *
 * Each command runs in the repo root with a 30 s timeout. Missing tools
 * (`rtk` not installed, raw command not on PATH) emit `skipped: <reason>`
 * entries and are excluded from the aggregate. The script never crashes —
 * mirror the placeholder discipline of `render_benchmark_md.py`.
 *
 * Surfaces honoured per `script-writing`:
 *   --quiet      suppress per-step progress (errors still print to stderr)
 *   --corpus     override the default corpus path
 *   --out        override the default report dir
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
// Python: Path(__file__).resolve().parent.parent.parent → repo root.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DEFAULT_CORPUS = path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'rtk', 'commands.yaml');
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'reports', 'rtk');
const TIMEOUT_SECONDS = 30;
const CHARS_PER_TOKEN = 4;

type Dict = Record<string, unknown>;

/**
 * Marker for a value that is a Python `float`. CPython's `json.dumps`
 * renders a float `0.0` as `0.0` (not `0`); JS numbers lose that
 * distinction. Wrapping the report's float fields keeps the written
 * JSON byte-identical with the Python original.
 */
class PyFloat {
    constructor(readonly value: number) {}
}

/** datetime.now(utc).isoformat(timespec="seconds") → "YYYY-MM-DDTHH:MM:SS+00:00". */
function _utc_iso(): string {
    const d = new Date();
    const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
    const mo = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = d.getUTCDate().toString().padStart(2, '0');
    const hh = d.getUTCHours().toString().padStart(2, '0');
    const mi = d.getUTCMinutes().toString().padStart(2, '0');
    const ss = d.getUTCSeconds().toString().padStart(2, '0');
    return `${yyyy}-${mo}-${day}T${hh}:${mi}:${ss}+00:00`;
}

function _log(msg: string, quiet: boolean, opts: { err?: boolean } = {}): void {
    if (opts.err) {
        process.stderr.write(`${msg}\n`);
        return;
    }
    if (!quiet) {
        process.stdout.write(`${msg}\n`);
    }
}

interface RunCapture {
    error: string | null;
    stdout_bytes: number;
    stderr_bytes: number;
    chars: number;
    tokens_approx: number;
    returncode: number | null;
}

/**
 * Run a command, return stdout+stderr bytes + exit code.
 *
 * Never raises — TimeoutExpired, FileNotFoundError, OSError each
 * produce a dict marker. Bench results explicitly carry failures so
 * the aggregate can exclude them.
 */
export function _run_capture(argv: string[], cwd: string): RunCapture {
    const program = argv[0] ?? '';
    const rest = argv.slice(1);
    const result = spawnSync(program, rest, {
        cwd,
        timeout: TIMEOUT_SECONDS * 1000,
        // Capture raw bytes — `len(stdout) + len(stderr)` in Python counts
        // bytes, not characters; Buffer.length gives the byte count.
        encoding: 'buffer',
        maxBuffer: 64 * 1024 * 1024,
    });

    if (result.error) {
        const err = result.error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
            // FileNotFoundError: [Errno 2] No such file or directory: 'X'
            return {
                error: `FileNotFoundError: [Errno 2] No such file or directory: '${program}'`,
                stdout_bytes: 0,
                stderr_bytes: 0,
                chars: 0,
                tokens_approx: 0,
                returncode: null,
            };
        }
        if (err.code === 'ETIMEDOUT' || result.signal === 'SIGTERM') {
            return {
                error: `TimeoutExpired after ${TIMEOUT_SECONDS}s`,
                stdout_bytes: 0,
                stderr_bytes: 0,
                chars: 0,
                tokens_approx: 0,
                returncode: null,
            };
        }
        // OSError fallback.
        return {
            error: `OSError: ${err.message}`,
            stdout_bytes: 0,
            stderr_bytes: 0,
            chars: 0,
            tokens_approx: 0,
            returncode: null,
        };
    }

    // spawnSync surfaces timeout via result.signal without result.error too.
    if (result.signal === 'SIGTERM' && result.status === null) {
        return {
            error: `TimeoutExpired after ${TIMEOUT_SECONDS}s`,
            stdout_bytes: 0,
            stderr_bytes: 0,
            chars: 0,
            tokens_approx: 0,
            returncode: null,
        };
    }

    const stdout: Buffer = (result.stdout as Buffer | null) ?? Buffer.alloc(0);
    const stderr: Buffer = (result.stderr as Buffer | null) ?? Buffer.alloc(0);
    const chars = stdout.length + stderr.length;
    return {
        error: null,
        stdout_bytes: stdout.length,
        stderr_bytes: stderr.length,
        chars,
        tokens_approx: _floorDiv(chars, CHARS_PER_TOKEN),
        returncode: result.status,
    };
}

interface MeasureResult {
    id: unknown;
    description: unknown;
    skipped: string | null;
    raw: RunCapture | null;
    rtk: RunCapture | null;
    delta: { chars_saved: number; tokens_saved: number; pct_saved: number } | null;
}

/** Measure one corpus entry. */
export function measure_one(entry: Dict, cwd: string, quiet: boolean): MeasureResult {
    const entry_id = entry.id;
    const description = 'description' in entry ? entry.description : '';
    const raw = (entry.raw as unknown[]) ?? [];
    const rtk = (entry.rtk as unknown[]) ?? [];

    const raw_cmd = Array.isArray(raw) && raw.length > 0 ? (raw[0] as string) : null;
    const rtk_cmd = Array.isArray(rtk) && rtk.length > 0 ? (rtk[0] as string) : null;

    if (raw_cmd && !_which(raw_cmd)) {
        return {
            id: entry_id,
            description,
            skipped: `raw command '${raw_cmd}' not on PATH`,
            raw: null,
            rtk: null,
            delta: null,
        };
    }
    if (rtk_cmd && !_which(rtk_cmd)) {
        return {
            id: entry_id,
            description,
            skipped: `rtk command '${rtk_cmd}' not on PATH`,
            raw: null,
            rtk: null,
            delta: null,
        };
    }

    _log(`  ${entry_id}: running raw …`, quiet);
    const raw_result = _run_capture(raw as string[], cwd);
    _log(`  ${entry_id}: running rtk …`, quiet);
    const rtk_result = _run_capture(rtk as string[], cwd);

    if (raw_result.error || rtk_result.error) {
        return {
            id: entry_id,
            description,
            skipped:
                `raw error: ${_pyStrOrNone(raw_result.error)}; ` + `rtk error: ${_pyStrOrNone(rtk_result.error)}`,
            raw: raw_result,
            rtk: rtk_result,
            delta: null,
        };
    }

    const raw_chars = raw_result.chars;
    const rtk_chars = rtk_result.chars;
    const chars_saved = raw_chars - rtk_chars;
    const tokens_saved = _floorDiv(chars_saved, CHARS_PER_TOKEN);
    const pct_saved = raw_chars > 0 ? (chars_saved / raw_chars) * 100.0 : 0.0;

    return {
        id: entry_id,
        description,
        skipped: null,
        raw: raw_result,
        rtk: rtk_result,
        delta: {
            chars_saved,
            tokens_saved,
            pct_saved: _round3(pct_saved),
        },
    };
}

interface Aggregate {
    commands_measured: number;
    commands_skipped: number;
    total_chars_saved: number;
    total_tokens_saved: number;
    median_pct_saved: number;
    tokens_saved_per_request: number;
}

/** Compute the aggregate block from per-command results. */
export function aggregate(results: MeasureResult[]): Aggregate {
    const measured = results.filter((r) => !r.skipped && r.delta);
    if (measured.length === 0) {
        return {
            commands_measured: 0,
            commands_skipped: results.length - measured.length,
            total_chars_saved: 0,
            total_tokens_saved: 0,
            median_pct_saved: 0.0,
            tokens_saved_per_request: 0,
        };
    }
    const chars_saved_total = measured.reduce((acc, r) => acc + (r.delta as { chars_saved: number }).chars_saved, 0);
    const tokens_saved_total = measured.reduce(
        (acc, r) => acc + (r.delta as { tokens_saved: number }).tokens_saved,
        0,
    );
    // Python: pcts = sorted(...); median = pcts[len // 2].
    const pcts = measured.map((r) => (r.delta as { pct_saved: number }).pct_saved).sort((a, b) => a - b);
    const median_pct = pcts[Math.floor(pcts.length / 2)] as number;
    // Per-request approximation: average tokens saved across the corpus.
    // A real agent invocation typically pipes ONE such command into the
    // context per request — so the per-request saving is the mean, not
    // the sum, of the corpus.
    const per_request = _floorDiv(tokens_saved_total, measured.length);
    return {
        commands_measured: measured.length,
        commands_skipped: results.length - measured.length,
        total_chars_saved: chars_saved_total,
        total_tokens_saved: tokens_saved_total,
        median_pct_saved: median_pct,
        tokens_saved_per_request: per_request,
    };
}

/** Run the bench, write the report, return 0 on success. */
export function run(corpus_path: string = DEFAULT_CORPUS, out_dir: string = DEFAULT_OUT_DIR, quiet = false): number {
    // The `yaml` npm package is a hard dependency in TS, so the PyYAML-missing
    // branch (yaml is None → return 1) is structurally unreachable here; the
    // import would have already thrown. The remaining branches mirror Python.
    if (!_exists(corpus_path)) {
        _log(`corpus not found: ${corpus_path}`, quiet, { err: true });
        return 1;
    }

    let corpus: Dict;
    try {
        const parsed = parseYaml(fs.readFileSync(corpus_path, 'utf-8'), { version: '1.1' });
        corpus = (parsed ?? {}) as Dict;
    } catch (exc) {
        _log(`failed to parse corpus YAML: ${_excStr(exc)}`, quiet, { err: true });
        return 1;
    }

    const entries = (('commands' in corpus ? corpus.commands : []) as unknown[]) ?? [];
    const entryList = Array.isArray(entries) ? entries : [];
    if (entryList.length === 0) {
        _log('corpus has no commands', quiet, { err: true });
        return 1;
    }

    _log(`rtk savings bench — ${entryList.length} commands`, quiet);
    const results = entryList.map((entry) => measure_one(entry as Dict, REPO_ROOT, quiet));
    const agg = aggregate(results);

    const generated_at = _utc_iso();
    const report: Dict = {
        schema_version: 1,
        schema_id: 'rtk-v1',
        generated_at,
        corpus: {
            id: 'corpus_id' in corpus ? corpus.corpus_id : 'rtk-commands',
            path: path.relative(REPO_ROOT, corpus_path).split(path.sep).join('/'),
            command_count: entryList.length,
        },
        commands: results.map(_resultToJson),
        aggregate: _aggregateToJson(agg),
        notes: [
            `Tokens approximated at ${CHARS_PER_TOKEN} chars / token.`,
            'tokens_saved_per_request is the per-command mean across ' +
                'measured entries; assumes one CLI invocation per request.',
            "Skipped commands carry a 'skipped' reason and are excluded " + 'from the aggregate.',
        ],
    };

    fs.mkdirSync(out_dir, { recursive: true });
    const stamp = generated_at.replace(/:/g, '-');
    const timestamped = path.join(out_dir, `${stamp}.json`);
    const latest = path.join(out_dir, 'latest.json');
    // ensure_ascii=False — keep non-ASCII verbatim.
    const payload = `${_pyJsonDumpsUnicode(report, 2)}\n`;
    fs.writeFileSync(timestamped, payload, 'utf-8');
    fs.writeFileSync(latest, payload, 'utf-8');

    // Python: timestamped.relative_to(REPO_ROOT) raises ValueError if the
    // out-dir is outside the repo. The reports are written above (mkdir +
    // write happen first), so an out-of-repo --out leaves the files behind
    // and then crashes — replicate that ordering.
    const headlinePath = _relativeToRepo(timestamped);
    _log(
        `rtk savings: ${agg.commands_measured}/${entryList.length} measured, ` +
            `median ${_fmtFloat1(agg.median_pct_saved)}% saved, ` +
            `${agg.tokens_saved_per_request} tokens/request ` +
            `(report: ${headlinePath})`,
        false, // always print the headline (one-line summary)
    );
    return 0;
}

/**
 * Mirror Path.relative_to(REPO_ROOT) — raises (ValueError-equivalent) when
 * the path is not under REPO_ROOT, matching the Python original's behaviour.
 */
function _relativeToRepo(p: string): string {
    const resolvedRoot = path.resolve(REPO_ROOT);
    const resolved = path.resolve(p);
    if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
        throw new Error(
            `'${resolved}' is not in the subpath of '${resolvedRoot}' OR one path is relative and the other is absolute.`,
        );
    }
    const rel = path.relative(resolvedRoot, resolved);
    return rel.split(path.sep).join('/');
}

/** Shape one MeasureResult for JSON output, wrapping float fields. */
function _resultToJson(r: MeasureResult): Dict {
    const out: Dict = {
        id: r.id,
        description: r.description,
        skipped: r.skipped,
        raw: r.raw,
        rtk: r.rtk,
    };
    if (r.delta === null) {
        out.delta = null;
    } else {
        out.delta = {
            chars_saved: r.delta.chars_saved,
            tokens_saved: r.delta.tokens_saved,
            // pct_saved is round(...) → always a Python float.
            pct_saved: new PyFloat(r.delta.pct_saved),
        };
    }
    return out;
}

/** Shape the aggregate for JSON output, wrapping the float field. */
function _aggregateToJson(a: Aggregate): Dict {
    return {
        commands_measured: a.commands_measured,
        commands_skipped: a.commands_skipped,
        total_chars_saved: a.total_chars_saved,
        total_tokens_saved: a.total_tokens_saved,
        // median_pct_saved is a float (median of pct floats, or 0.0).
        median_pct_saved: new PyFloat(a.median_pct_saved),
        tokens_saved_per_request: a.tokens_saved_per_request,
    };
}

interface ParsedArgs {
    corpus: string;
    out: string;
    quiet: boolean;
}

export function parse_args(argv: string[]): ParsedArgs {
    let corpus = DEFAULT_CORPUS;
    let out = DEFAULT_OUT_DIR;
    let quiet = false;
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i] as string;
        if (arg === '--quiet') {
            quiet = true;
            i += 1;
            continue;
        }
        if (arg === '--corpus') {
            const next = argv[i + 1];
            if (next === undefined) {
                _argparseError('argument --corpus: expected one argument');
            }
            corpus = next as string;
            i += 2;
            continue;
        }
        if (arg.startsWith('--corpus=')) {
            corpus = arg.slice('--corpus='.length);
            i += 1;
            continue;
        }
        if (arg === '--out') {
            const next = argv[i + 1];
            if (next === undefined) {
                _argparseError('argument --out: expected one argument');
            }
            out = next as string;
            i += 2;
            continue;
        }
        if (arg.startsWith('--out=')) {
            out = arg.slice('--out='.length);
            i += 1;
            continue;
        }
        if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: bench_rtk_savings [-h] [--corpus CORPUS] [--out OUT] [--quiet]\n');
            process.exit(0);
        }
        _argparseError(`unrecognized arguments: ${arg}`);
    }
    return { corpus, out, quiet };
}

function _argparseError(msg: string): never {
    process.stderr.write(`bench_rtk_savings: error: ${msg}\n`);
    process.exit(2);
}

export function main(argv?: string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    return run(args.corpus, args.out, args.quiet);
}

// --- Python parity helpers --------------------------------------------------

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** Mirror shutil.which(cmd) — found on PATH (or executable absolute path). */
function _which(cmd: string): boolean {
    if (cmd.includes('/') || cmd.includes(path.sep)) {
        // Absolute / relative path: shutil.which checks it exists + is executable.
        return _isExecutable(cmd);
    }
    const pathEnv = process.env.PATH ?? '';
    const exts = process.platform === 'win32' ? (process.env.PATHEXT ?? '').split(';').filter(Boolean) : [''];
    for (const dir of pathEnv.split(path.delimiter)) {
        if (dir === '') {
            continue;
        }
        for (const ext of exts.length > 0 ? exts : ['']) {
            const candidate = path.join(dir, cmd + ext);
            if (_isExecutable(candidate)) {
                return true;
            }
        }
    }
    return false;
}

function _isExecutable(p: string): boolean {
    try {
        fs.accessSync(p, fs.constants.X_OK);
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/**
 * Python floor division (`//`) — floors toward negative infinity, which
 * differs from JS `Math.trunc` for negatives. chars_saved can be negative
 * when rtk output is larger than raw.
 */
function _floorDiv(a: number, b: number): number {
    return Math.floor(a / b);
}

/** Mirror round(x, 3) — round-half-to-even at 3 decimals, numeric result. */
function _round3(x: number): number {
    if (!Number.isFinite(x)) {
        return x;
    }
    const factor = 1000;
    const scaled = x * factor;
    const floor = Math.floor(scaled);
    const frac = scaled - floor;
    const tol = Math.max(Math.abs(scaled), 1) * 2 ** -40;
    let rounded: number;
    if (Math.abs(frac - 0.5) <= tol) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    return rounded / factor;
}

/**
 * Mirror f"{x:.1f}" — fixed 1-decimal, round-half-to-even (CPython float
 * formatting). The headline median is already round(.,3); :.1f re-rounds.
 */
function _fmtFloat1(x: number): string {
    if (!Number.isFinite(x)) {
        return String(x);
    }
    const neg = x < 0 || Object.is(x, -0);
    const abs = Math.abs(x);
    const factor = 10;
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
    if (intStr.length <= 1) {
        intStr = '0'.repeat(1 - intStr.length + 1) + intStr;
    }
    const whole = intStr.slice(0, intStr.length - 1);
    const dec = intStr.slice(intStr.length - 1);
    const result = `${whole}.${dec}`;
    return neg && rounded !== 0 ? `-${result}` : result;
}

/** Mirror str(x) for an error value already known to be str|null. */
function _pyStrOrNone(v: string | null): string {
    return v === null ? 'None' : v;
}

/** Mirror str(exc) for YAML parse failures (approximate message). */
function _excStr(exc: unknown): string {
    if (exc instanceof Error) {
        return exc.message;
    }
    return String(exc);
}

// --- JSON serializer — json.dumps(indent=2, ensure_ascii=False) parity ------

function _pyJsonDumpsUnicode(value: unknown, indent: number): string {
    // ensure_ascii=False → non-ASCII stays literal (no \uXXXX escaping).
    return _dumpsIndent(value, indent, 0);
}

function _dumpsIndent(value: unknown, indent: number, depth: number): string {
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (value === null || value === undefined) {
        return 'null';
    }
    if (value instanceof PyFloat) {
        return _jsonFloat(value.value);
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return _jsonNum(value);
    }
    if (typeof value === 'string') {
        return _jsonStrUnicode(value);
    }
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => pad + _dumpsIndent(v, indent, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj);
        if (keys.length === 0) {
            return '{}';
        }
        const items = keys.map((k) => `${pad}${_jsonStrUnicode(k)}: ${_dumpsIndent(obj[k], indent, depth + 1)}`);
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _jsonStrUnicode(String(value));
}

function _jsonNum(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) {
            return 'NaN';
        }
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    if (Number.isInteger(n)) {
        return String(n);
    }
    return String(n);
}

/** Render a Python float: integer-valued floats keep the `.0` suffix. */
function _jsonFloat(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) {
            return 'NaN';
        }
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    if (Number.isInteger(n)) {
        return `${n}.0`;
    }
    return String(n);
}

/** ensure_ascii=False string: escape only control + quote + backslash. */
function _jsonStrUnicode(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
        switch (ch) {
            case '"':
                out += '\\"';
                break;
            case '\\':
                out += '\\\\';
                break;
            case '\n':
                out += '\\n';
                break;
            case '\r':
                out += '\\r';
                break;
            case '\t':
                out += '\\t';
                break;
            case '\b':
                out += '\\b';
                break;
            case '\f':
                out += '\\f';
                break;
            default:
                if (code < 0x20) {
                    out += `\\u${code.toString(16).padStart(4, '0')}`;
                } else {
                    out += ch;
                }
        }
    }
    return `${out}"`;
}

const _isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isMain) {
    process.exit(main());
}

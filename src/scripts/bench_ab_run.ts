#!/usr/bin/env tsx
/**
 * Top-level orchestrator for the package-impact A/B bench.
 *
 * TypeScript twin of `src/scripts/bench_ab_run.py` (ADR-096, Phase 8 /
 * Wave 8d). The CLI contract mirrors the Python original EXACTLY — same
 * `--variant {with,without}` / `--corpus` / `--non-interactive` /
 * `--reuse-cache` flags, same exit codes, stdout-only messages, and
 * byte-identical written report JSON (`json.dumps(indent=2) + "\n"`) and the
 * Markdown layout. No behaviour changes — latent Python quirks are
 * replicated and flagged as divergence candidates.
 *
 * NON-DETERMINISM: this script stamps reports with `utc_stamp()` (current
 * UTC) and a `duration_seconds` from a monotonic clock. Those fields are
 * timing-bound and are NOT byte-stable across runs — golden parity excludes
 * them.
 *
 * A thin wrapper around the per-track runners. Owns the `--variant` axis,
 * the cache lookup that decides whether the `without` arm runs, the
 * report-header convention, and the report-path convention
 * `internal/bench/reports/ab/{stamp}-{corpus}-{variant}.json`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    CacheKey,
    claude_cli_version,
    hash_file,
    lookup,
    target_shape_hash,
} from './_lib/bench_ab_cache.js';
import { clone } from './bench_ab_clone.js';

const _HERE = fileURLToPath(import.meta.url);

// Python: REPO_ROOT = Path(__file__).resolve().parent.parent.parent
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const REPORTS_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'reports', 'ab');
const CORPUS_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'corpora');

// Supported corpora (created in Phases 3 + 4).
const KNOWN_CORPORA = ['ab-tracka', 'ab-trackb'] as const;

const REPORT_SCHEMA_VERSION = 'ab-bench/0.1';

export function utc_stamp(): string {
    const d = new Date();
    const Y = String(d.getUTCFullYear()).padStart(4, '0');
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const D = String(d.getUTCDate()).padStart(2, '0');
    const H = String(d.getUTCHours()).padStart(2, '0');
    const M = String(d.getUTCMinutes()).padStart(2, '0');
    const S = String(d.getUTCSeconds()).padStart(2, '0');
    return `${Y}-${m}-${D}T${H}-${M}-${S}Z`;
}

export function corpus_path(corpus: string): string {
    return path.join(CORPUS_DIR, `${corpus}.yaml`);
}

export function report_path(stamp: string, corpus: string, variant: string): string {
    return path.join(REPORTS_DIR, `${stamp}-${corpus}-${variant}.json`);
}

/** Make sure the clone exists; do NOT --refresh — that's a user-driven choice. */
function ensure_clone(variant: string): string {
    const target = path.join(REPO_ROOT, 'internal', 'bench', 'ab', 'clones', variant);
    if (!fs.existsSync(target)) {
        clone(variant, { refresh: false });
    }
    return target;
}

/**
 * Phase-2 placeholder.
 *
 * Returns a minimal results block. Phase 3 + Phase 4 plug their real
 * runners into this dispatch.
 */
function run_track_stub(variant: string, corpus: string, cloneRoot: string): Record<string, unknown> {
    return {
        track: corpus,
        status: 'stub',
        note:
            'Phase 2 plumbing only. The real runner lands in Phase 3 (Track A) ' +
            'or Phase 4 (Track B). See road-to-package-impact-benchmark.md.',
        clone_root: _relPosixOrPath(cloneRoot),
        variant,
    };
}

function write_report(params: {
    variant: string;
    corpus: string;
    stamp: string;
    cacheKey: CacheKey;
    results: Record<string, unknown>;
    durationSeconds: number;
}): string {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    // In-memory report keeps `duration_seconds` as a plain number so the
    // Markdown renderer's f-string parity holds; the JSON payload re-wraps it
    // as a PyFloat so json.dumps' trailing ".0" is reproduced.
    const report: Record<string, unknown> = {
        schema: REPORT_SCHEMA_VERSION,
        stamp: params.stamp,
        variant: params.variant,
        corpus: params.corpus,
        cache_key: params.cacheKey.to_dict(),
        duration_seconds: _pyRound(params.durationSeconds, 3),
        results: params.results,
    };
    const jsonPayload: Json = {
        schema: REPORT_SCHEMA_VERSION,
        stamp: params.stamp,
        variant: params.variant,
        corpus: params.corpus,
        cache_key: params.cacheKey.to_dict() as unknown as Json,
        duration_seconds: new PyFloat(_pyRound(params.durationSeconds, 3)),
        results: params.results as unknown as Json,
    };
    const jsonPath = report_path(params.stamp, params.corpus, params.variant);
    fs.writeFileSync(jsonPath, `${_jsonDumps(jsonPayload, 2)}\n`, 'utf-8');
    const mdPath = jsonPath.replace(/\.json$/, '.md');
    fs.writeFileSync(mdPath, render_markdown(report), 'utf-8');
    return jsonPath;
}

export function render_markdown(report: Record<string, unknown>): string {
    const lines: string[] = [
        `# A/B Bench Report — ${report['variant']} · ${report['corpus']}`,
        '',
        `- Stamp: \`${report['stamp']}\``,
        `- Duration: ${_pyNum(report['duration_seconds'])}s`,
        '',
        '## Cache key',
        '',
    ];
    const cacheKey = (report['cache_key'] as Record<string, unknown> | undefined) ?? {};
    for (const [k, v] of Object.entries(cacheKey)) {
        lines.push(`- \`${k}\`: \`${v}\``);
    }
    lines.push('');
    lines.push('## Results');
    lines.push('');
    lines.push('```json');
    lines.push(_jsonDumps(report['results'] as Json, 2));
    lines.push('```');
    lines.push('');
    return lines.join('\n');
}

interface Args {
    variant: 'with' | 'without';
    corpus: string;
    nonInteractive: boolean;
    reuseCache: boolean;
}

class ArgExit extends Error {
    readonly code: number;
    constructor(code: number) {
        super(`ArgExit(${code})`);
        this.code = code;
    }
}

function parse_args(argv: string[]): Args {
    let variant: 'with' | 'without' | null = null;
    let corpus: string | null = null;
    let nonInteractive = false;
    let reuseCache = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!;
        if (a === '--variant' || a.startsWith('--variant=')) {
            const val = a.startsWith('--variant=') ? a.slice('--variant='.length) : (argv[++i] ?? '');
            if (val !== 'with' && val !== 'without') {
                process.stderr.write(
                    "bench_ab_run: error: argument --variant: invalid choice: " +
                        `'${val}' (choose from 'with', 'without')\n`,
                );
                process.exitCode = 2;
                throw new ArgExit(2);
            }
            variant = val;
        } else if (a === '--corpus' || a.startsWith('--corpus=')) {
            const val = a.startsWith('--corpus=') ? a.slice('--corpus='.length) : (argv[++i] ?? '');
            if (!(KNOWN_CORPORA as readonly string[]).includes(val)) {
                process.stderr.write(
                    "bench_ab_run: error: argument --corpus: invalid choice: " +
                        `'${val}' (choose from 'ab-tracka', 'ab-trackb')\n`,
                );
                process.exitCode = 2;
                throw new ArgExit(2);
            }
            corpus = val;
        } else if (a === '--non-interactive') {
            nonInteractive = true;
        } else if (a === '--reuse-cache') {
            reuseCache = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: bench_ab_run [-h] --variant {with,without} --corpus\n' +
                    '                    {ab-tracka,ab-trackb} [--non-interactive] [--reuse-cache]\n',
            );
            process.exitCode = 0;
            throw new ArgExit(0);
        } else {
            process.stderr.write(`bench_ab_run: error: unrecognized arguments: ${a}\n`);
            process.exitCode = 2;
            throw new ArgExit(2);
        }
    }
    if (variant === null) {
        process.stderr.write(
            'bench_ab_run: error: the following arguments are required: --variant\n',
        );
        process.exitCode = 2;
        throw new ArgExit(2);
    }
    if (corpus === null) {
        process.stderr.write(
            'bench_ab_run: error: the following arguments are required: --corpus\n',
        );
        process.exitCode = 2;
        throw new ArgExit(2);
    }
    return { variant, corpus, nonInteractive, reuseCache };
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

    const corpusFile = corpus_path(args.corpus);
    if (!fs.existsSync(corpusFile)) {
        process.stdout.write(
            `bench_ab_run: corpus '${args.corpus}' missing at ${corpusFile} — ` +
                'Phase 3 (track A) or Phase 4 (track B) author it. Writing a ' +
                'placeholder run with the synthetic corpus hash so cache plumbing ' +
                'remains exercisable.\n',
        );
    }

    const cacheKeyValue = new CacheKey(
        fs.existsSync(corpusFile) ? hash_file(corpusFile) : 'missing-corpus',
        claude_cli_version(),
        target_shape_hash(),
    );

    if (args.variant === 'without' && args.reuseCache && fs.existsSync(corpusFile)) {
        const lk = lookup(corpusFile);
        if (lk.fresh && lk.report_path !== null) {
            process.stdout.write(
                `bench_ab_run: reusing fresh cached \`without\` report at ` +
                    `${_relPosixOrPath(lk.report_path)}\n`,
            );
            return 0;
        }
        if (lk.found && !lk.fresh) {
            process.stdout.write(
                `bench_ab_run: cached \`without\` report stale (${lk.reason})\n`,
            );
            if (args.nonInteractive) {
                process.stdout.write(
                    'bench_ab_run: --non-interactive — reusing stale baseline ' +
                        'and flagging the run.\n',
                );
                return 0;
            }
            process.stdout.write(
                'bench_ab_run: continuing with a fresh run ' +
                    '(set --reuse-cache off and use --non-interactive to keep the stale baseline)\n',
            );
        }
    }

    const cloneRoot = ensure_clone(args.variant);
    const started = _monotonic();
    const results = run_track_stub(args.variant, args.corpus, cloneRoot);
    const duration = _monotonic() - started;
    const p = write_report({
        variant: args.variant,
        corpus: args.corpus,
        stamp: utc_stamp(),
        cacheKey: cacheKeyValue,
        results,
        durationSeconds: duration,
    });
    process.stdout.write(`bench_ab_run: wrote ${_relPosixOrPath(p)}\n`);
    return 0;
}

// ── parity helpers ───────────────────────────────────────────────────────

/** time.monotonic() in seconds (perf_counter is the closest Node analogue). */
function _monotonic(): number {
    return process.hrtime.bigint !== undefined
        ? Number(process.hrtime.bigint()) / 1e9
        : Date.now() / 1000;
}

/** `path.relative_to(REPO_ROOT)` rendered with native separators (str(Path)). */
function _relPosixOrPath(target: string): string {
    if (target.startsWith(REPO_ROOT + path.sep)) {
        return path.relative(REPO_ROOT, target);
    }
    return target;
}

/** Render a number the way Python prints a float/int inside an f-string. */
function _pyNum(v: unknown): string {
    if (typeof v === 'number') {
        return Number.isInteger(v) ? `${v}.0` : String(v);
    }
    return String(v);
}

/** Python `round(x, ndigits)` — round-half-to-even, returns a float. */
function _pyRound(x: number, ndigits: number): number {
    if (!Number.isFinite(x)) {
        return x;
    }
    const factor = 10 ** ndigits;
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

// ── JSON shaping (json.dumps parity, PyFloat-aware) ──────────────────────

/** Marks a value as a Python float — integral floats serialise with ".0". */
class PyFloat {
    constructor(readonly value: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [k: string]: Json };

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

const _IS_MAIN =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (_IS_MAIN) {
    process.exit(main());
}

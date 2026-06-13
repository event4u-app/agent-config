#!/usr/bin/env tsx
/**
 * Bench orchestrator — step-4 measurement-and-benchmark Phase 2.
 *
 * TypeScript twin of `src/scripts/bench_run.py` (ADR-092, Phase 8 /
 * Wave 8d). The CLI contract mirrors the Python original EXACTLY — same
 * flags, exit codes, stdout/stderr split, byte-identical headline / Markdown
 * stdout and byte-identical written report JSON
 * (`json.dumps(indent=2) + "\n"`). No behaviour changes — latent Python
 * quirks are replicated and flagged as divergence candidates.
 *
 * NON-DETERMINISM: `build_report` stamps `generated_at` (current UTC) and
 * `runner.baseline_collector_sha` (an mtime). Those fields are NOT byte-stable
 * across runs — golden parity excludes them. The selection / cost / quality
 * blocks are deterministic given a fixed repo + corpus + sessions file.
 *
 * Wraps the selection-accuracy baseline collector (`bench_runner`), captures
 * token / cost data from `agents/cost-tracking/sessions.jsonl` if present,
 * runs structural quality assertions per prompt, and emits a versioned JSON +
 * Markdown report under `internal/bench/reports/`.
 *
 * Cross-batch dependency: the `--telegraph` LIVE path needs the unported
 * `ai_council.clients` module (it carries no legacy source-tree literal, so
 * ADR-051 does not require porting it in this wave). The `--telegraph-dry-run`
 * path is fully self-contained; the live path degrades to the same "cannot
 * build Anthropic client" exit-2 surface the Python original produces when the
 * client can't be built. Flagged as a divergence candidate.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import * as script_output from './_lib/script_output.js';
import { aggregate_sessions, load_pricing, type CostBlock } from './_lib/bench_cost.js';
import { score_corpus, type Prompt } from './_lib/bench_quality.js';
import {
    report_paths,
    render_markdown,
    utc_now_filename_stamp,
    utc_now_iso,
    write_json,
    write_markdown,
} from './_lib/bench_report.js';
import {
    run_telegraph_bench,
    type ArmResponse,
    type ArmResult,
    type BenchClient,
} from './_lib/bench_telegraph.js';
import {
    build_telegraph_report,
    render_telegraph_markdown,
} from './_lib/bench_telegraph_report.js';
import { run_corpus } from './bench_runner.js';

const _HERE = fileURLToPath(import.meta.url);

// Python: REPO_ROOT = Path(__file__).resolve().parent.parent.parent
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const BENCH_RUN_VERSION = '0.2.0';
const PRICING_PATH = path.join(REPO_ROOT, 'internal', 'bench', 'pricing.yaml');
const SESSIONS_JSONL = path.join(REPO_ROOT, 'agents', 'cost-tracking', 'sessions.jsonl');
const REPORTS_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'reports');
const CORPUS_DIR = path.join(REPO_ROOT, 'tests', 'eval');
const TELEGRAPH_CORPUS = path.join(
    REPO_ROOT,
    'internal',
    'bench',
    'corpora',
    'telegraph',
    'prompts.yaml',
);
const BASELINE_COLLECTOR = path.join(REPO_ROOT, 'src', 'scripts', 'bench_runner.py');

function _baseline_sha_or_mtime(): string {
    try {
        // Python: int(BASELINE_COLLECTOR.stat().st_mtime)
        return `mtime:${Math.trunc(fs.statSync(BASELINE_COLLECTOR).mtimeMs / 1000)}`;
    } catch {
        return 'unavailable';
    }
}

function _verdict(
    selection: Record<string, unknown>,
    quality: Record<string, unknown>,
): { selection: string; quality: string; overall: string } {
    const sel = selection['passed'] ? 'pass' : 'fail';
    let qual: string;
    let overall: string;
    if (quality['source'] === 'not_collected') {
        qual = 'not_collected';
        overall = 'partial';
    } else {
        qual = Number(quality['quality_score']) >= 0.6 ? 'pass' : 'fail';
        overall = sel === 'pass' && qual === 'pass' ? 'pass' : 'fail';
    }
    return { selection: sel, quality: qual, overall };
}

export function build_report(
    corpusPath: string,
    topK: number,
    agentOutput: string | null,
): Record<string, unknown> {
    const selection = run_corpus(corpusPath, topK) as unknown as Record<string, unknown>;
    const corpusYaml = (parseYaml(fs.readFileSync(corpusPath, 'utf-8'), { version: '1.1' }) ??
        {}) as Record<string, unknown>;
    const prompts = (corpusYaml['prompts'] as Prompt[] | undefined) ?? [];
    const cost = aggregate_sessions(SESSIONS_JSONL, PRICING_PATH);
    const quality = score_corpus(prompts, agentOutput);
    const verdict = _verdict(
        selection,
        quality as unknown as Record<string, unknown>,
    );
    return {
        schema_version: 1,
        generated_at: utc_now_iso(),
        corpus: {
            id: selection['corpus_id'],
            path: _relPosix(corpusPath),
            prompt_count: prompts.length,
        },
        runner: {
            bench_run_version: BENCH_RUN_VERSION,
            baseline_collector: _relPosix(BASELINE_COLLECTOR),
            baseline_collector_sha: _baseline_sha_or_mtime(),
        },
        selection,
        cost,
        quality,
        verdict,
    };
}

interface Args {
    corpus: string;
    topK: number;
    agentOutput: string | null;
    quiet: boolean;
    stamp: string | null;
    noWrite: boolean;
    telegraph: boolean;
    telegraphMaxPrompts: number | null;
    telegraphDryRun: boolean;
    telegraphReportTag: string;
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
        topK: 3,
        agentOutput: null,
        quiet: false,
        stamp: null,
        noWrite: false,
        telegraph: false,
        telegraphMaxPrompts: null,
        telegraphDryRun: false,
        telegraphReportTag: 'telegraph-v1',
    };
    const ctr = { v: 0 };
    const takeVal = (a: string, name: string): string => {
        if (a.startsWith(`${name}=`)) {
            return a.slice(name.length + 1);
        }
        return argv[++ctr.v] ?? '';
    };
    for (ctr.v = 0; ctr.v < argv.length; ctr.v++) {
        const a = argv[ctr.v]!;
        if (a === '--corpus' || a.startsWith('--corpus=')) {
            args.corpus = takeVal(a, '--corpus');
        } else if (a === '--top-k' || a.startsWith('--top-k=')) {
            args.topK = _pyInt(takeVal(a, '--top-k'), '--top-k');
        } else if (a === '--agent-output' || a.startsWith('--agent-output=')) {
            args.agentOutput = takeVal(a, '--agent-output');
        } else if (a === '--quiet') {
            args.quiet = true;
        } else if (a === '--stamp' || a.startsWith('--stamp=')) {
            args.stamp = takeVal(a, '--stamp');
        } else if (a === '--no-write') {
            args.noWrite = true;
        } else if (a === '--telegraph') {
            args.telegraph = true;
        } else if (a === '--telegraph-max-prompts' || a.startsWith('--telegraph-max-prompts=')) {
            args.telegraphMaxPrompts = _pyInt(
                takeVal(a, '--telegraph-max-prompts'),
                '--telegraph-max-prompts',
            );
        } else if (a === '--telegraph-dry-run') {
            args.telegraphDryRun = true;
        } else if (a === '--telegraph-report-tag' || a.startsWith('--telegraph-report-tag=')) {
            args.telegraphReportTag = takeVal(a, '--telegraph-report-tag');
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: bench_run [-h] [--corpus CORPUS] [--top-k TOP_K] ...\n');
            process.exitCode = 0;
            throw new ArgExit(0);
        } else {
            process.stderr.write(`bench_run: error: unrecognized arguments: ${a}\n`);
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

    if (args.telegraph) {
        return _run_telegraph(args);
    }

    const corpusPath = path.join(CORPUS_DIR, `corpus-${args.corpus}.yaml`);
    if (!_isFile(corpusPath)) {
        script_output.error(`error: corpus not found: ${corpusPath}`);
        return 2;
    }

    const report = build_report(corpusPath, args.topK, args.agentOutput);
    const stamp = args.stamp ?? utc_now_filename_stamp();
    const corpusBlock = report['corpus'] as Record<string, unknown>;
    const [jsonPath, mdPath] = report_paths(REPORTS_DIR, String(corpusBlock['id']), stamp);

    if (!args.noWrite) {
        write_json(jsonPath, report);
        write_markdown(mdPath, report);
    }

    const verdict = report['verdict'] as Record<string, string>;
    const sel = report['selection'] as Record<string, unknown>;
    const qual = report['quality'] as Record<string, unknown>;
    const cost = report['cost'] as CostBlock & Record<string, unknown>;
    const headline =
        `bench ${corpusBlock['id']} · ` +
        `selection ${_fmtPct2(Number(sel['selection_accuracy']))} (${verdict['selection']}) · ` +
        `tokens ${cost['source'] ?? 'n/a'} · ` +
        `quality ${_fmtPct2(Number(qual['quality_score']))} (${verdict['quality']}) · ` +
        `overall ${verdict['overall']}`;

    if (args.quiet) {
        process.stdout.write(`${headline}\n`);
        if (!args.noWrite) {
            process.stdout.write(`report: ${_relPosix(mdPath)}\n`);
        }
    } else {
        process.stdout.write(`${render_markdown(report)}\n`);
        if (!args.noWrite) {
            process.stdout.write(`\n→ json:     ${_relPosix(jsonPath)}\n`);
            process.stdout.write(`→ markdown: ${_relPosix(mdPath)}\n`);
        }
    }

    // Exit zero on overall pass OR partial (partial = quality_not_collected by design).
    return verdict['overall'] === 'pass' || verdict['overall'] === 'partial' ? 0 : 1;
}

/** Stub client for --telegraph-dry-run. Returns empty CouncilResponse-shaped objects. */
class _DryRunClient implements BenchClient {
    ask(_system: string, _userPrompt: string, _opts?: { max_tokens?: number }): ArmResponse {
        return {
            text: '',
            input_tokens: 0,
            output_tokens: 0,
            latency_ms: 0,
            error: null,
        };
    }
}

function _run_telegraph(args: Args): number {
    if (!_isFile(TELEGRAPH_CORPUS)) {
        script_output.error(`error: telegraph corpus not found: ${TELEGRAPH_CORPUS}`);
        return 2;
    }

    let client: BenchClient;
    let transport: string;
    let model: string;
    if (args.telegraphDryRun) {
        client = new _DryRunClient();
        transport = 'dry-run';
        model = 'stub';
    } else {
        // Live path: build the Anthropic client. The twin module is not present
        // in this wave, so this resolves to the Python error surface.
        return _run_telegraph_live(args);
    }

    const onProgress = (
        done: number,
        total: number,
        pid: string,
        arm: string,
        ar: ArmResult,
    ): void => {
        if (args.quiet) {
            return;
        }
        const err = ar.error ? ` ERR=${ar.error}` : '';
        process.stderr.write(
            `[${_rjust(String(done), 3)}/${total}] ${pid} · ${_ljust(arm, 14)} ` +
                `in=${_rjust(String(ar.input_tokens), 4)} out=${_rjust(String(ar.output_tokens), 4)} ` +
                `${_rjust(String(ar.latency_ms), 5)}ms${err}\n`,
        );
    };

    const results = run_telegraph_bench(client, TELEGRAPH_CORPUS, {
        max_prompts: args.telegraphMaxPrompts,
        on_progress: onProgress,
    });

    const [rates, sourcedOn] = load_pricing(PRICING_PATH);
    const sonnetRates = rates['sonnet'] ?? { input: 0.0, output: 0.0 };

    const report = build_telegraph_report({
        results,
        corpus_path_rel: _relPosix(TELEGRAPH_CORPUS),
        generated_at: utc_now_iso(),
        bench_run_version: BENCH_RUN_VERSION,
        model,
        transport,
        pricing_rates: sonnetRates,
        pricing_sourced_on: sourcedOn,
    });

    const stamp = args.stamp ?? utc_now_filename_stamp();
    const [jsonPath] = report_paths(REPORTS_DIR, args.telegraphReportTag, stamp);
    // Override: telegraph roadmap pins the filename to `telegraph-v1.{json,md}` (no stamp).
    const fixedJson = path.join(REPORTS_DIR, `${args.telegraphReportTag}.json`);
    const fixedMd = path.join(REPORTS_DIR, `${args.telegraphReportTag}.md`);

    if (!args.noWrite) {
        write_json(fixedJson, report);
        fs.mkdirSync(path.dirname(fixedMd), { recursive: true });
        fs.writeFileSync(fixedMd, render_telegraph_markdown(report), 'utf-8');
        // Also drop a timestamped copy for the cadence trail.
        write_json(jsonPath, report);
        fs.writeFileSync(
            jsonPath.replace(/\.json$/, '.md'),
            render_telegraph_markdown(report),
            'utf-8',
        );
    }

    const totals = report.cost.totals as unknown as Record<string, number>;
    const aggregate = report.telegraph.aggregate;
    const headline =
        `telegraph · prompts ${report.corpus.prompt_count} · ` +
        `calls ${totals['calls']} · errors ${totals['errors']} · ` +
        `vs_raw med ${_fmtPct2(aggregate.savings_vs_raw.median)} · ` +
        `vs_terse med ${_fmtPct2(aggregate.savings_vs_terse.median)}`;
    if (args.quiet) {
        process.stdout.write(`${headline}\n`);
        if (!args.noWrite) {
            process.stdout.write(`report: ${_relPosix(fixedMd)}\n`);
        }
    } else {
        process.stdout.write(`${render_telegraph_markdown(report)}\n`);
        if (!args.noWrite) {
            process.stdout.write(`\n→ json:     ${_relPosix(fixedJson)}\n`);
            process.stdout.write(`→ markdown: ${_relPosix(fixedMd)}\n`);
            process.stdout.write(`→ trail:    ${_relPosix(jsonPath)}\n`);
        }
    }

    return Number(totals['errors']) === 0 ? 0 : 1;
}

/**
 * Live-API telegraph path. Builds the Anthropic client; on any failure prints
 * the same "cannot build Anthropic client" message and returns 2, mirroring
 * the Python original's `try/except Exception` guard. Because the
 * `ai_council.clients` twin is not yet present, this currently always takes
 * the failure branch (flagged divergence — the live happy path is unreachable
 * until that module is ported).
 */
function _run_telegraph_live(_args: Args): number {
    // The client build is async; the Python flow is synchronous. We surface the
    // failure synchronously by attempting the import eagerly and reporting.
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const required = _tryRequireClients();
        if (required === null) {
            throw new Error('ai_council.clients twin not available');
        }
        // Unreachable until the twin lands; the structural path is preserved.
        script_output.error('error: cannot build Anthropic client: live path unported');
        return 2;
    } catch (exc) {
        script_output.error(`error: cannot build Anthropic client: ${_excStr(exc)}`);
        return 2;
    }
}

function _tryRequireClients(): unknown {
    const candidate = path.join(REPO_ROOT, 'src', 'scripts', 'ai_council', 'clients.ts');
    if (!fs.existsSync(candidate)) {
        return null;
    }
    return candidate;
}

// ── parity helpers ───────────────────────────────────────────────────────

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** `path.relative_to(REPO_ROOT).as_posix()` — POSIX separators. */
function _relPosix(target: string): string {
    return path.relative(REPO_ROOT, target).split(path.sep).join('/');
}

function _excStr(exc: unknown): string {
    if (exc instanceof Error) {
        return exc.message;
    }
    return String(exc);
}

/** Python `int(str)` (argparse type=int) — base-10 strict. */
function _pyInt(s: string, flag: string): number {
    const t = s.trim();
    if (!/^[+-]?\d+$/.test(t)) {
        process.stderr.write(`bench_run: error: argument ${flag}: invalid int value: '${s}'\n`);
        process.exitCode = 2;
        throw new ArgExit(2);
    }
    return parseInt(t, 10);
}

function _rjust(s: string, width: number): string {
    return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

function _ljust(s: string, width: number): string {
    return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

/** Python `f"{x:.2%}"` — value × 100, round-half-to-even to 2 decimals, '%'. */
function _fmtPct2(x: number): string {
    return `${_pyFixed(x * 100, 2)}%`;
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

const _IS_MAIN =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (_IS_MAIN) {
    process.exit(main());
}

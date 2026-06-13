#!/usr/bin/env node
/**
 * Track B — task runner for the package-impact A/B bench.
 *
 * TypeScript twin of `src/scripts/bench_ab_task_runner.py` (ADR-094 Python→TS
 * migration, Phase 8 / Wave 8d). Mirrors the CLI contract EXACTLY: flags
 * (`--variant`, `--mode`, `--timeout`), exit codes (0 ok / 1 corpus missing or
 * empty), byte-identical stdout/stderr, and byte-identical written JSON + md
 * reports (timing/run-id fields aside — those are inherently non-deterministic
 * wall-clock values). No behaviour changes.
 *
 * Phase 4 Step 2 of `agents/roadmaps/road-to-package-impact-benchmark.md`.
 *
 * For each task in `internal/bench/corpora/ab-trackb.yaml`, in each variant:
 *
 * 1. Snapshot the variant clone's file tree.
 * 2. Invoke the `claude` CLI with the task prompt — OR dry-run, depending
 *    on `--mode`.
 * 3. Capture the transcript, tool-call events, wall-time, and (if available)
 *    token + cost counts.
 * 4. Snapshot the post-run tree.
 * 5. Score the task via scripts/_lib/bench_ab_scoring.py.
 *
 * Modes:
 *
 * - `dry-run` (default) — record the would-run shell command, write a stub
 *   transcript naming the variant, score against the unchanged tree.
 * - `live` — actually invoke the `claude` CLI with `--print` (one-shot mode)
 *   and the task prompt.
 *
 * The runner ALWAYS resets the clone to a clean state before each task and
 * ALWAYS records the mode in the report header.
 *
 * Cross-batch dependency: `reset_clone` calls `bench_ab_clone.clone()`. That
 * clone script is NOT yet ported to TypeScript; the Python original loads it
 * via `importlib`, and this twin shells out to `python3` to call it — keeping a
 * single source of truth until `bench_ab_clone` is ported.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import * as bench_ab_cache from './_lib/bench_ab_cache.js';
import { score_task } from './_lib/bench_ab_scoring.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/bench_ab_task_runner.ts → parents[2] is the repo root.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const CORPUS_PATH = path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'ab-trackb.yaml');
const REPORTS_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'reports', 'ab');

// How far we descend into a clone when snapshotting. The fixture is shallow.
const SNAPSHOT_MAX_DEPTH = 6;

export function utc_stamp(): string {
    // datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    const d = new Date();
    const Y = String(d.getUTCFullYear()).padStart(4, '0');
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const D = String(d.getUTCDate()).padStart(2, '0');
    const H = String(d.getUTCHours()).padStart(2, '0');
    const M = String(d.getUTCMinutes()).padStart(2, '0');
    const S = String(d.getUTCSeconds()).padStart(2, '0');
    return `${Y}-${m}-${D}T${H}-${M}-${S}Z`;
}

/**
 * Return {relpath: sha256-short} for every fixture file under the clone.
 *
 * Skips the agent-config surface (.claude, .augment, AGENTS.md, CLAUDE.md,
 * manifest) because that's the variant axis, not the task surface.
 */
export function snapshot_clone(cloneRoot: string, maxDepth: number = SNAPSHOT_MAX_DEPTH): Record<string, string> {
    const skipRoots = new Set(['.claude', '.augment']);
    const skipFiles = new Set(['AGENTS.md', 'CLAUDE.md', '.bench-ab-manifest.json']);
    const out: Record<string, string> = {};
    for (const filePath of _rglobSorted(cloneRoot)) {
        if (!_isFile(filePath)) {
            continue;
        }
        const rel = path.relative(cloneRoot, filePath);
        const parts = rel.split(path.sep);
        if (parts.length > 0 && skipRoots.has(parts[0]!)) {
            continue;
        }
        const relPosix = parts.join('/');
        if (skipFiles.has(relPosix)) {
            continue;
        }
        if (parts.length > maxDepth) {
            continue;
        }
        let digest: string;
        try {
            const buf = fs.readFileSync(filePath);
            digest = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
        } catch {
            // OSError → skip (matches Python `except OSError: continue`).
            continue;
        }
        out[relPosix] = digest;
    }
    return out;
}

/** Rebuild the clone so each task starts from the same state. */
export function reset_clone(variant: string): string {
    const clonePy = path.join(REPO_ROOT, 'src', 'scripts', 'bench_ab_clone.py');
    if (!fs.existsSync(clonePy)) {
        throw new Error('cannot load bench_ab_clone helper');
    }
    // Mirror the Python `importlib` load + `module.clone(variant, refresh=True)`
    // by shelling out to the same .py, printing the returned clone-root path.
    const driver = [
        'import importlib.util, sys',
        `spec = importlib.util.spec_from_file_location("bench_ab_clone", ${JSON.stringify(clonePy)})`,
        'if spec is None or spec.loader is None:',
        '    raise RuntimeError("cannot load bench_ab_clone helper")',
        'module = importlib.util.module_from_spec(spec)',
        'spec.loader.exec_module(module)',
        `sys.stdout.write(str(module.clone(${JSON.stringify(variant)}, refresh=True)))`,
    ].join('\n');
    const out = execFileSync('python3', ['-c', driver], {
        encoding: 'utf-8',
        maxBuffer: 16 * 1024 * 1024,
    });
    return out;
}

/** Resolve the claude CLI binary (env override → PATH). */
export function claude_executable(): string | null {
    const override = process.env['CLAUDE_CLI'];
    if (override) {
        return override;
    }
    if (_which('claude') !== null) {
        return 'claude';
    }
    return null;
}

interface RunResult {
    mode: string;
    reason: string;
    transcript: string;
    exit_code: number | null;
    wall_time_seconds: number;
}

/** Invoke claude in print/one-shot mode against the task prompt. */
export function run_live(task: Record<string, unknown>, cloneRoot: string, timeoutS: number): RunResult {
    const binary = claude_executable();
    if (binary === null) {
        return {
            mode: 'live-skipped',
            reason: 'claude CLI not found; set CLAUDE_CLI or install it',
            transcript: '',
            exit_code: null,
            wall_time_seconds: 0.0,
        };
    }
    const prompt = (task['prompt'] as string) ?? '';
    const started = _monotonic();
    const result = spawnSync(binary, ['--print', '--', prompt], {
        cwd: cloneRoot,
        encoding: 'utf-8',
        timeout: timeoutS * 1000,
    });
    if (result.error && (result.error as NodeJS.ErrnoException & { killed?: boolean }).code === 'ETIMEDOUT') {
        return {
            mode: 'live',
            reason: `timeout after ${timeoutS}s`,
            transcript: (result.stdout ?? '') + '\n[TIMEOUT]',
            exit_code: -1,
            wall_time_seconds: _pyRound(_monotonic() - started, 3),
        };
    }
    if (result.signal === 'SIGTERM' && result.error) {
        // spawnSync timeout surfaces as signal SIGTERM with an error.
        return {
            mode: 'live',
            reason: `timeout after ${timeoutS}s`,
            transcript: (result.stdout ?? '') + '\n[TIMEOUT]',
            exit_code: -1,
            wall_time_seconds: _pyRound(_monotonic() - started, 3),
        };
    }
    const duration = _monotonic() - started;
    return {
        mode: 'live',
        reason: 'ok',
        transcript: (result.stdout ?? '') + '\n' + (result.stderr ?? ''),
        exit_code: result.status ?? -1,
        wall_time_seconds: _pyRound(duration, 3),
    };
}

/** Record what would have run; produce a deterministic stub transcript. */
export function run_dry(task: Record<string, unknown>, cloneRoot: string, variant: string): RunResult {
    const stubTranscript =
        '[bench_ab_task_runner dry-run]\n' +
        `variant=${variant}\n` +
        `clone=${cloneRoot}\n` +
        `task_id=${_pyStr(task['id'])}\n` +
        '[no claude invocation; --mode live to execute for real]\n';
    return {
        mode: 'dry-run',
        reason: 'ok',
        transcript: stubTranscript,
        exit_code: 0,
        wall_time_seconds: 0.0,
    };
}

interface AskEvents {
    asked: number;
    acted_with_commit: number;
    ratio: number;
    /** True when ratio is an int 0 (total == 0) rather than a rounded float. */
    ratioIsInt: boolean;
}

/** Crude ask-vs-act heuristic over the transcript. */
export function count_ask_events(transcript: string): AskEvents {
    if (!transcript) {
        return { asked: 0, acted_with_commit: 0, ratio: 0, ratioIsInt: true };
    }
    const lt = transcript.toLowerCase();
    const askMarkers = ['should i', 'do you want', 'shall i', 'soll ich', 'möchtest du'];
    const asked = askMarkers.reduce((acc, m) => acc + _countSub(lt, m), 0);
    const commitMarkers = ['git commit', 'git push', 'gh pr create', 'gh pr merge'];
    const acted = commitMarkers.reduce((acc, m) => acc + _countSub(lt, m), 0);
    const total = asked + acted;
    if (total) {
        return { asked, acted_with_commit: acted, ratio: _pyRound(asked / total, 3), ratioIsInt: false };
    }
    return { asked, acted_with_commit: acted, ratio: 0, ratioIsInt: true };
}

interface ScoreResultJson {
    passed: boolean;
    checks: Array<{ name: string; ok: boolean; reason: string }>;
}

interface PerTaskEntry {
    id: unknown;
    category: unknown;
    score: ScoreResultJson;
    wall_time_seconds: number;
    exit_code: number | null;
    mode: string;
    reason: string;
    ask_events: AskEvents;
}

interface CategoryAgg {
    passed: number;
    total: number;
    completion_rate: number;
    completion_rate_int: boolean;
    mean_wall_time: number;
    mean_wall_time_int: boolean;
}

export function per_category_aggregate(perTask: PerTaskEntry[]): Array<[string, CategoryAgg]> {
    // Group preserving first-seen category order (Python dict.setdefault).
    const byCat = new Map<string, PerTaskEntry[]>();
    for (const entry of perTask) {
        // Python: entry.get("category", "unknown") — missing key OR None? The
        // .get default fires only when the key is absent; a present null stays
        // null. The corpus always sets category, so a string is expected.
        const key =
            entry.category === undefined ? 'unknown' : (entry.category as string);
        if (!byCat.has(key)) {
            byCat.set(key, []);
        }
        byCat.get(key)!.push(entry);
    }
    const out: Array<[string, CategoryAgg]> = [];
    for (const [cat, entries] of byCat) {
        const passed = entries.filter((e) => e.score.passed).length;
        const total = entries.length;
        const sumWall = entries.reduce((acc, e) => acc + (e.wall_time_seconds ?? 0), 0);
        out.push([
            cat,
            {
                passed,
                total,
                completion_rate: total ? _pyRound(passed / total, 4) : 0,
                completion_rate_int: !total,
                mean_wall_time: total ? _pyRound(sumWall / total, 3) : 0,
                mean_wall_time_int: !total,
            },
        ]);
    }
    return out;
}

interface CorpusTask {
    id?: unknown;
    category?: unknown;
    prompt?: string;
    [k: string]: unknown;
}

export function write_report(
    variant: string,
    mode: string,
    perTask: PerTaskEntry[],
    duration: number,
): string {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const cacheKey = new bench_ab_cache.CacheKey(
        bench_ab_cache.hash_file(CORPUS_PATH),
        bench_ab_cache.claude_cli_version(),
        bench_ab_cache.target_shape_hash(),
    );
    const total = perTask.length;
    const passed = perTask.filter((e) => e.score.passed).length;
    const perCategory = per_category_aggregate(perTask);
    const completionRate = total ? _pyRound(passed / total, 4) : 0;
    const completionRateInt = !total;
    const sumWall = perTask.reduce((acc, e) => acc + (e.wall_time_seconds ?? 0), 0);
    const meanWall = total ? _pyRound(sumWall / total, 3) : 0;
    const meanWallInt = !total;
    const sumRatio = perTask.reduce((acc, e) => acc + (e.ask_events?.ratio ?? 0), 0);
    const askVsAct = total ? _pyRound(sumRatio / total, 3) : 0;
    const askVsActInt = !total;

    const stamp = utc_stamp();

    // Build the markdown using the same field values.
    const md =
        `# Track B · ${variant} · ${mode}\n\n` +
        `- Stamp: \`${stamp}\`\n` +
        `- Completion rate: **${_pyFixed(completionRate * 100, 1)}%**` +
        ` (${passed}/${total})\n` +
        `- Mean wall-time: ${meanWallInt ? '0' : _pyNumStr(meanWall)}s\n` +
        `- Ask vs. act ratio: ${askVsActInt ? '0' : _pyNumStr(askVsAct)}\n` +
        `\n## Per-category\n\n` +
        perCategory
            .map(
                ([cat, info]) =>
                    `- \`${cat}\` — ${info.passed}/${info.total} ` +
                    `(${_pyFixed(info.completion_rate * 100, 1)}%)`,
            )
            .join('\n') +
        '\n';

    // Build the JSON payload mirroring the Python `results` + `payload` dicts.
    const resultsJson: Json = {
        mode,
        completion_rate: completionRateInt ? 0 : new PyFloat(completionRate),
        passed,
        total,
        per_category: _perCategoryJson(perCategory),
        mean_wall_time: meanWallInt ? 0 : new PyFloat(meanWall),
        ask_vs_act_ratio: askVsActInt ? 0 : new PyFloat(askVsAct),
        per_task: perTask.map((e) => _perTaskJson(e)),
    };
    const payload: Json = {
        schema: 'ab-bench/0.1',
        stamp,
        variant,
        corpus: 'ab-trackb',
        cache_key: cacheKey.to_dict() as unknown as Json,
        duration_seconds: new PyFloat(_pyRound(duration, 3)),
        results: resultsJson,
    };

    const jsonPath = path.join(REPORTS_DIR, `${stamp}-ab-trackb-${variant}.json`);
    fs.writeFileSync(jsonPath, _jsonDumps(payload, 2) + '\n');
    const mdPath = jsonPath.replace(/\.json$/, '.md');
    fs.writeFileSync(mdPath, md);
    return jsonPath;
}

interface RunVariantResult {
    path: string;
    per_task: PerTaskEntry[];
    duration: number;
}

export function run_variant(
    variant: string,
    tasks: CorpusTask[],
    mode: string,
    timeoutS: number,
): RunVariantResult {
    const started = _monotonic();
    const perTask: PerTaskEntry[] = [];
    for (const task of tasks) {
        const cloneRoot = reset_clone(variant);
        const pre = snapshot_clone(cloneRoot);
        let runResult: RunResult;
        if (mode === 'live') {
            runResult = run_live(task as Record<string, unknown>, cloneRoot, timeoutS);
        } else {
            runResult = run_dry(task as Record<string, unknown>, cloneRoot, variant);
        }
        const post = snapshot_clone(cloneRoot);
        const score = score_task(task as Record<string, unknown>, {
            pre_snapshot: pre,
            post_snapshot: post,
            clone_root: cloneRoot,
            transcript: runResult.transcript ?? '',
        });
        perTask.push({
            id: task.id,
            category: task.category,
            score: { passed: score.passed, checks: score.checks },
            wall_time_seconds: runResult.wall_time_seconds ?? 0.0,
            exit_code: runResult.exit_code,
            mode: runResult.mode ?? mode,
            reason: runResult.reason ?? '',
            ask_events: count_ask_events(runResult.transcript ?? ''),
        });
    }
    const duration = _monotonic() - started;
    const reportPath = write_report(variant, mode, perTask, duration);
    const passedCount = perTask.filter((e) => e.score.passed).length;
    process.stdout.write(
        `bench_ab_task_runner: ${variant} (${mode}) → ` +
            `${passedCount}/${perTask.length} ` +
            `passed — ${_relPosix(reportPath, REPO_ROOT)}\n`,
    );
    return { path: reportPath, per_task: perTask, duration };
}

interface Args {
    variant: string;
    mode: string;
    timeout: number;
}

function parse_args(argv: string[]): Args {
    const args: Args = { variant: 'both', mode: 'dry-run', timeout: 120 };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!;
        if (a === '--variant') args.variant = _choice(argv[++i] ?? '', '--variant', ['with', 'without', 'both']);
        else if (a.startsWith('--variant='))
            args.variant = _choice(a.slice('--variant='.length), '--variant', ['with', 'without', 'both']);
        else if (a === '--mode') args.mode = _choice(argv[++i] ?? '', '--mode', ['dry-run', 'live']);
        else if (a.startsWith('--mode=')) args.mode = _choice(a.slice('--mode='.length), '--mode', ['dry-run', 'live']);
        else if (a === '--timeout') args.timeout = _pyInt(argv[++i] ?? '', '--timeout');
        else if (a.startsWith('--timeout=')) args.timeout = _pyInt(a.slice('--timeout='.length), '--timeout');
        else {
            process.stderr.write(`bench_ab_task_runner: error: unrecognized arguments: ${a}\n`);
            process.exitCode = 2;
            throw new ArgExit();
        }
    }
    return args;
}

class ArgExit extends Error {}

export function main(argv: string[] | null = null): number {
    const rawArgv = argv ?? process.argv.slice(2);
    const args = parse_args(rawArgv);
    if (!fs.existsSync(CORPUS_PATH)) {
        process.stderr.write(`bench_ab_task_runner: corpus missing at ${CORPUS_PATH}\n`);
        return 1;
    }
    const data = (_yamlSafeLoad(fs.readFileSync(CORPUS_PATH, 'utf-8')) as { tasks?: CorpusTask[] }) ?? {};
    const tasks = data.tasks ?? [];
    if (tasks.length === 0) {
        process.stderr.write('bench_ab_task_runner: corpus has no tasks\n');
        return 1;
    }
    const variants = args.variant === 'both' ? ['with', 'without'] : [args.variant];
    for (const variant of variants) {
        run_variant(variant, tasks, args.mode, args.timeout);
    }
    return 0;
}

// --- JSON shaping ------------------------------------------------------------

class PyFloat {
    constructor(readonly value: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [k: string]: Json };

function _perCategoryJson(perCategory: Array<[string, CategoryAgg]>): { [k: string]: Json } {
    const out: { [k: string]: Json } = {};
    for (const [cat, info] of perCategory) {
        out[cat] = {
            passed: info.passed,
            total: info.total,
            completion_rate: info.completion_rate_int ? 0 : new PyFloat(info.completion_rate),
            mean_wall_time: info.mean_wall_time_int ? 0 : new PyFloat(info.mean_wall_time),
        };
    }
    return out;
}

function _perTaskJson(e: PerTaskEntry): Json {
    return {
        id: _toJson(e.id),
        category: _toJson(e.category),
        score: {
            passed: e.score.passed,
            checks: e.score.checks.map((c) => ({ name: c.name, ok: c.ok, reason: c.reason })),
        },
        wall_time_seconds: new PyFloat(e.wall_time_seconds),
        exit_code: e.exit_code === null ? null : e.exit_code,
        mode: e.mode,
        reason: e.reason,
        ask_events: {
            asked: e.ask_events.asked,
            acted_with_commit: e.ask_events.acted_with_commit,
            ratio: e.ask_events.ratioIsInt ? 0 : new PyFloat(e.ask_events.ratio),
        },
    };
}

function _toJson(v: unknown): Json {
    if (v === null || v === undefined) return null;
    if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') return v;
    return String(v);
}

// --- Python helpers ----------------------------------------------------------

/** json.dumps(obj, indent=2) — sort_keys False, ensure_ascii True. */
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

function _pyRound(value: number, ndigits: number): number {
    if (!Number.isFinite(value)) return value;
    const factor = Math.pow(10, ndigits);
    const scaled = value * factor;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let rounded: number;
    const eps = 1e-9;
    if (Math.abs(diff - 0.5) < eps) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    return rounded / factor;
}

function _pyFixed(x: number, ndigits: number): string {
    if (!Number.isFinite(x)) return String(x);
    const neg = x < 0 || Object.is(x, -0);
    const abs = Math.abs(x);
    const factor = Math.pow(10, ndigits);
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

/** Render a float the way Python `f"{x}"` / `str(x)` would (e.g. 0.0 → "0.0"). */
function _pyNumStr(x: number): string {
    if (Number.isInteger(x)) {
        return `${x}.0`;
    }
    return String(x);
}

/** Mirror Python `str(value)` for the dict-id / category JSON-coercion paths. */
function _pyStr(v: unknown): string {
    if (v === null || v === undefined) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    return String(v);
}

function _countSub(haystack: string, needle: string): number {
    // str.count — non-overlapping occurrences.
    if (needle === '') return haystack.length + 1;
    let count = 0;
    let idx = 0;
    while ((idx = haystack.indexOf(needle, idx)) !== -1) {
        count += 1;
        idx += needle.length;
    }
    return count;
}

function _monotonic(): number {
    // time.monotonic() — seconds, fractional. process.hrtime gives ns.
    const [s, ns] = process.hrtime();
    return s + ns / 1e9;
}

function _which(cmd: string): string | null {
    const pathEnv = process.env['PATH'] || '';
    const exts =
        process.platform === 'win32'
            ? (process.env['PATHEXT'] || '.EXE;.CMD;.BAT;.COM').split(';')
            : [''];
    for (const dir of pathEnv.split(path.delimiter)) {
        if (!dir) continue;
        for (const ext of exts) {
            const candidate = path.join(dir, cmd + ext);
            try {
                fs.accessSync(candidate, fs.constants.X_OK);
                return candidate;
            } catch {
                // not here / not executable
            }
        }
    }
    return null;
}

function _isFile(p: string): boolean {
    try {
        return fs.lstatSync(p).isFile();
    } catch {
        return false;
    }
}

/**
 * sorted(clone_root.rglob("*")) — every entry under root, recursive, sorted by
 * full Path (component-wise lexical). rglob yields files AND dirs; the caller
 * filters with is_file. We mirror by walking and returning all paths sorted.
 */
function _rglobSorted(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            out.push(full);
            if (e.isDirectory()) {
                walk(full);
            }
        }
    };
    walk(root);
    out.sort((a, b) => _pyPathCmp(a, b));
    return out;
}

function _pyPathCmp(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
        const c = _pyStrCmp(pa[i]!, pb[i]!);
        if (c !== 0) return c;
    }
    return pa.length - pb.length;
}

function _pyStrCmp(a: string, b: string): number {
    const ca = Array.from(a);
    const cb = Array.from(b);
    const n = Math.min(ca.length, cb.length);
    for (let i = 0; i < n; i++) {
        const x = ca[i]!.codePointAt(0)!;
        const y = cb[i]!.codePointAt(0)!;
        if (x !== y) return x - y;
    }
    return ca.length - cb.length;
}

function _relPosix(p: string, base: string): string {
    return path.relative(base, p).split(path.sep).join('/');
}

function _choice(value: string, flag: string, choices: string[]): string {
    if (!choices.includes(value)) {
        const choicesStr = choices.map((c) => `'${c}'`).join(', ');
        process.stderr.write(
            `bench_ab_task_runner: error: argument ${flag}: invalid choice: '${value}' (choose from ${choicesStr})\n`,
        );
        process.exitCode = 2;
        throw new ArgExit();
    }
    return value;
}

function _pyInt(s: string, flag: string): number {
    const trimmed = s.trim();
    if (!/^[+-]?\d+$/.test(trimmed)) {
        process.stderr.write(`bench_ab_task_runner: error: argument ${flag}: invalid int value: '${s}'\n`);
        process.exitCode = 2;
        throw new ArgExit();
    }
    return parseInt(trimmed, 10);
}

function _yamlSafeLoad(s: string): unknown {
    return parseYaml(s, { version: '1.1' });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    try {
        process.exitCode = main();
    } catch (e) {
        if (e instanceof ArgExit) {
            process.exitCode = process.exitCode ?? 2;
        } else {
            throw e;
        }
    }
}

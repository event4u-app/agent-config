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

// --- Activation (proven mechanism) ---
// agent-config is a GLOBAL Claude Code plugin (enabledPlugins in ~/.claude
// settings), so plain `claude --print` already runs WITH the package. The clean
// control is `--setting-sources project,local`, which excludes the user settings
// where `enabledPlugins` lives → plugin OFF, but auth survives. Measured proof:
// plain --print = ~35.5k input tokens; --setting-sources project,local = ~11.9k
// → the ~24k delta IS the package's always-on footprint. So:
//   without  = `--setting-sources project,local`  (plugin OFF, base model)
//   with     = plain `--print`                     (the real installed plugin = package)
//   with-rdp = plain `--print` + RDP rules injected (RDP not yet in the release plugin)
// (`--bare` is NOT used — it disables auth too.)
const RDP_EXTRA_FILES: readonly string[] = [
    path.join(REPO_ROOT, 'src', 'rules', 'notes-first-reasoning.md'),
    path.join(REPO_ROOT, 'src', 'agent-src', 'contexts', 'execution', 'rdp-gate.md'),
];

function _concat_rules(paths: readonly string[]): string {
    const parts: string[] = [];
    for (const p of paths) {
        try {
            parts.push(fs.readFileSync(p, 'utf-8'));
        } catch {
            // OSError → skip (matches Python `except OSError: continue`).
            continue;
        }
    }
    return parts.join('\n\n---\n\n');
}

/**
 * Extra rules injected on top of the plugin. Only `with-rdp` injects (the RDP
 * artifacts aren't in the released plugin yet); `with` uses the real plugin,
 * `without` runs plugin-off.
 */
export function system_prompt_for(variant: string): string | null {
    if (variant === 'with-rdp') {
        return _concat_rules(RDP_EXTRA_FILES.filter((p) => fs.existsSync(p)));
    }
    return null;
}

/** `without` excludes user settings to drop the global plugin (auth survives). */
export function setting_sources_for(variant: string): string | null {
    return variant === 'without' ? 'project,local' : null;
}

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
        `sys.stdout.write(str(module.clone(${JSON.stringify(variant)}, refresh=True, quiet=True)))`,
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
    // Resolve to an absolute path so the subprocess (run with cwd=clone_root)
    // cannot miss it on a PATH/cwd quirk — the failure that showed up as a
    // spurious "claude CLI not found" on a later arm of the first full run.
    return _which('claude');
}

interface TokensBreakdown {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
}

interface RunResult {
    mode: string;
    reason: string;
    transcript: string;
    exit_code: number | null;
    wall_time_seconds: number;
    tokens?: number;
    /** Empty object `{}` on dry-run (key absent in Python); breakdown otherwise. */
    tokens_breakdown?: TokensBreakdown | Record<string, never>;
    errored?: boolean;
}

interface RunLiveOpts {
    sysprompt_file?: string | null;
    setting_sources?: string | null;
    max_budget?: number | null;
    model?: string | null;
}

/**
 * Invoke claude in print/one-shot mode against the task prompt.
 *
 * `setting_sources` (e.g. "project,local") drops the global plugin for the
 * `without` arm while keeping auth. `sysprompt_file` injects extra rules
 * (the `with-rdp` arm). `with` passes neither → the real installed plugin.
 */
export function run_live(
    task: Record<string, unknown>,
    cloneRoot: string,
    timeoutS: number,
    opts: RunLiveOpts = {},
): RunResult {
    const { sysprompt_file = null, setting_sources = null, max_budget = null, model = null } = opts;
    const binary = claude_executable();
    if (binary === null) {
        return {
            mode: 'live-skipped',
            reason: 'claude CLI not found; set CLAUDE_CLI or install it',
            transcript: '',
            exit_code: null,
            wall_time_seconds: 0.0,
            tokens: 0,
            tokens_breakdown: {},
            errored: true,
        };
    }
    const prompt = (task['prompt'] as string) ?? '';
    // --output-format json yields a `usage` block for token counts. The global
    // plugin is dropped per-arm via --setting-sources (NOT --bare, which kills auth).
    // bypassPermissions on EVERY arm: the clone is a throwaway fixture, and this
    // equalizes file-edit capability across arms (else `without`, which excludes
    // user settings, would lack edit perms and fail tasks for the wrong reason).
    const cmd = ['--print', '--output-format', 'json', '--permission-mode', 'bypassPermissions'];
    if (model) {
        // Pin ONE model across every arm. The session default here is Opus-4.8-1M,
        // whose ~$1.78 first-turn cache-creation trips any sane budget cap instantly
        // and makes a full corpus run blow the account quota. Holding the model
        // constant is also a validity requirement: the bench measures the package
        // LIFT on a fixed host, not model-vs-model.
        cmd.push('--model', model);
    }
    if (max_budget) {
        // Caps per-task API spend so one runaway agentic loop can't exhaust the
        // account quota (the failure mode that starved later arms on the first run).
        cmd.push('--max-budget-usd', _pyStrNum(max_budget));
    }
    if (setting_sources) {
        cmd.push('--setting-sources', setting_sources);
    }
    if (sysprompt_file !== null) {
        cmd.push('--append-system-prompt-file', sysprompt_file);
    }
    cmd.push('--', prompt);
    const started = _monotonic();
    const result = spawnSync(binary, cmd, {
        cwd: cloneRoot,
        encoding: 'utf-8',
        timeout: timeoutS * 1000,
    });
    const isTimeout =
        (result.error && (result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') ||
        (result.signal === 'SIGTERM' && Boolean(result.error));
    if (isTimeout) {
        return {
            mode: 'live',
            reason: `timeout after ${timeoutS}s`,
            transcript: (result.stdout ?? '') + '\n[TIMEOUT]',
            exit_code: -1,
            wall_time_seconds: _pyRound(_monotonic() - started, 3),
            tokens: 0,
            tokens_breakdown: {},
            errored: true,
        };
    }
    const duration = _monotonic() - started;
    // Parse the JSON envelope: `result` is the model text; `usage` holds tokens.
    const stdout = result.stdout ?? '';
    const stderr = result.stderr ?? '';
    const returncode = result.status ?? -1;
    let transcript: string = stdout;
    let tokens = 0;
    let isError = false;
    let errReason = 'ok';
    let breakdown: TokensBreakdown = {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
    };
    try {
        const obj = JSON.parse(stdout) as Record<string, unknown>;
        // Python: `except (json.JSONDecodeError, AttributeError, ValueError)`.
        // JSON.parse of a non-object (string/number/array) parses fine but then
        // `.get` calls would AttributeError in Python — guard by requiring an object.
        if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
            throw new TypeError('not a JSON object');
        }
        isError = Boolean(obj['is_error']);
        // transcript = obj.get("result") or obj.get("text") or proc.stdout
        const resultText = obj['result'];
        const textField = obj['text'];
        transcript = _pyTruthyStr(resultText)
            ? (resultText as string)
            : _pyTruthyStr(textField)
              ? (textField as string)
              : stdout;
        const usage = (_isPlainObj(obj['usage']) ? (obj['usage'] as Record<string, unknown>) : {}) as Record<
            string,
            unknown
        >;
        breakdown = {
            input_tokens: _intOrZero(usage['input_tokens']),
            output_tokens: _intOrZero(usage['output_tokens']),
            cache_read_input_tokens: _intOrZero(usage['cache_read_input_tokens']),
            cache_creation_input_tokens: _intOrZero(usage['cache_creation_input_tokens']),
        };
        tokens =
            breakdown.input_tokens +
            breakdown.output_tokens +
            breakdown.cache_read_input_tokens +
            breakdown.cache_creation_input_tokens;
        // The top-level `usage` block is zeroed on a budget-capped / errored run
        // (and unreliable even on some completions). `modelUsage` carries the
        // authoritative per-model counts — sum it as the fallback so token deltas
        // survive even when a task hits its cap mid-flight.
        if (tokens === 0) {
            const mu = (_isPlainObj(obj['modelUsage']) ? (obj['modelUsage'] as Record<string, unknown>) : {}) as Record<
                string,
                unknown
            >;
            const agg: TokensBreakdown = {
                input_tokens: 0,
                output_tokens: 0,
                cache_read_input_tokens: 0,
                cache_creation_input_tokens: 0,
            };
            for (const stats of Object.values(mu)) {
                const s = (_isPlainObj(stats) ? (stats as Record<string, unknown>) : {}) as Record<string, unknown>;
                agg.input_tokens += _intOrZero(s['inputTokens']);
                agg.output_tokens += _intOrZero(s['outputTokens']);
                agg.cache_read_input_tokens += _intOrZero(s['cacheReadInputTokens']);
                agg.cache_creation_input_tokens += _intOrZero(s['cacheCreationInputTokens']);
            }
            const muTotal =
                agg.input_tokens +
                agg.output_tokens +
                agg.cache_read_input_tokens +
                agg.cache_creation_input_tokens;
            if (muTotal > 0) {
                breakdown = agg;
                tokens = muTotal;
            }
        }
        // Surface WHY a task errored (budget cap vs. other) without leaking $.
        if (isError) {
            const subtype = obj['subtype'];
            errReason = _pyTruthyStr(subtype) ? (subtype as string) : 'error';
        }
    } catch {
        transcript = stdout;
    }
    return {
        mode: 'live',
        reason: isError ? errReason : returncode === 0 ? 'ok' : `exit ${returncode}`,
        transcript: `${transcript}\n${stderr}`,
        exit_code: returncode,
        wall_time_seconds: _pyRound(duration, 3),
        tokens,
        tokens_breakdown: breakdown,
        errored: isError || returncode !== 0,
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

const PROGRESS_PATH = path.join(REPORTS_DIR, '.progress.json');

/** Mirror live state to .progress.json for `task bench:ab:watch` (best-effort). */
function _write_progress(state: Record<string, Json>): void {
    try {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
        fs.writeFileSync(PROGRESS_PATH, _jsonDumps(state, 2) + '\n');
    } catch {
        // OSError → swallow (best-effort, matches Python `except OSError: pass`).
    }
}

interface ProgressStream {
    write(s: string): void;
    isatty?: () => boolean;
}

/**
 * Live per-task progress. stdlib-only, TTY-aware, log-safe.
 *
 * style: auto (bar if stderr is a TTY, else one plain line per task) | bar |
 * plain | none. Mirrors state to .progress.json regardless of style.
 *
 * Node parity note: Python uses a 1s heartbeat thread to refresh the bar mid
 * task. Node is single-threaded and the work here (spawnSync) is synchronous
 * and blocking, so a timer would never fire during a task anyway — the
 * heartbeat is therefore a no-op here. It only affects live-TTY cosmetics, not
 * any written artifact (.progress.json content is identical), so parity holds
 * on every byte-compared surface.
 */
export class Progress {
    static readonly BAR_WIDTH = 24;

    total: number;
    mode: string;
    stream: ProgressStream;
    done = 0;
    started: number;
    kind: 'bar' | 'plain' | 'none';
    private _cur = '';
    private _task_started = 0.0;

    constructor(total: number, mode: string, style = 'auto', stream?: ProgressStream) {
        this.total = Math.max(total, 1);
        this.mode = mode;
        this.stream = stream ?? { write: (s: string): void => void process.stderr.write(s), isatty: () => process.stderr.isTTY === true };
        this.started = _monotonic();
        if (style === 'bar' || style === 'plain' || style === 'none') {
            this.kind = style;
        } else {
            // auto
            const isatty = this.stream.isatty ? this.stream.isatty() : false;
            this.kind = isatty ? 'bar' : 'plain';
        }
    }

    private _elapsed(since: number): string {
        const s = Math.trunc(_monotonic() - since);
        return s >= 60 ? `${Math.trunc(s / 60)}m${String(s % 60).padStart(2, '0')}s` : `${s}s`;
    }

    private _bar(): string {
        const filled = Math.trunc((Progress.BAR_WIDTH * this.done) / this.total);
        return '█'.repeat(filled) + '░'.repeat(Progress.BAR_WIDTH - filled);
    }

    private _render_bar(suffix = ''): void {
        const line = `\r[${this._bar()}] ${this.done}/${this.total} · ${this._cur} · ${this._elapsed(this.started)}${suffix}`;
        // Python: line.ljust(90)[:160]
        this.stream.write(_ljust(line, 90).slice(0, 160));
    }

    start_task(variant: string, idx: number, count: number, taskId: string): void {
        this._cur = `${variant} ${idx}/${count} · ${taskId}`;
        this._task_started = _monotonic();
        _write_progress({
            mode: this.mode,
            variant,
            task_idx: idx,
            task_count: count,
            total_done: this.done,
            total: this.total,
            current_id: taskId,
            started_at: utc_stamp(),
            last_result: null,
        });
        if (this.kind === 'none') {
            return;
        }
        if (this.kind === 'bar') {
            this._render_bar(this.mode === 'live' ? ' · running…' : '');
            // heartbeat: no-op under Node's blocking model (see class note).
        } else if (this.mode === 'live') {
            this.stream.write(`[${this.done + 1}/${this.total}] ▶ ${this._cur}\n`);
        }
    }

    end_task(passed: boolean, wall: number, variant: string, taskId: string): void {
        this.done += 1;
        const mark = passed ? '✓' : '✗';
        _write_progress({
            mode: this.mode,
            variant,
            total_done: this.done,
            total: this.total,
            current_id: taskId,
            updated_at: utc_stamp(),
            last_result: passed ? 'pass' : 'fail',
        });
        if (this.kind === 'none') {
            return;
        }
        if (this.kind === 'bar') {
            this._render_bar(` · ${mark}`);
        } else {
            this.stream.write(`[${this.done}/${this.total}] ${mark} ${variant} · ${taskId} · ${_pyFixed(wall, 1)}s\n`);
        }
    }

    variant_done(line: string): void {
        if (this.kind === 'bar') {
            this.stream.write('\n');
        }
        this.stream.write(line.endsWith('\n') ? line : line + '\n');
    }

    finish(): void {
        if (this.kind === 'bar') {
            this.stream.write('\n');
        }
        if (this.kind !== 'none') {
            this.stream.write(`bench progress: ${this.done}/${this.total} tasks · total ${this._elapsed(this.started)}\n`);
        }
    }
}

interface ScoreResultJson {
    passed: boolean;
    checks: Array<{ name: string; ok: boolean; reason: string }>;
}

interface PerTaskEntry {
    id: unknown;
    category: unknown;
    duration?: unknown;
    cognitive?: unknown;
    score: ScoreResultJson;
    errored?: boolean;
    wall_time_seconds: number;
    tokens?: number;
    tokens_breakdown?: TokensBreakdown | Record<string, never>;
    exit_code: number | null;
    mode: string;
    reason: string;
    ask_events: AskEvents;
}

interface BucketAgg {
    passed: number;
    total: number;
    completed: number;
    errored: number;
    completion_rate: number;
    completion_rate_int: boolean;
    mean_wall_time: number;
    mean_wall_time_int: boolean;
    mean_tokens: number; // always an int (Python round(...) with no ndigits)
}

/** Python truthiness for `not e.get("errored")` — missing / falsy → done. */
function _isDone(e: PerTaskEntry): boolean {
    return !_pyTruthy(e.errored);
}

function _bucketAgg(entries: PerTaskEntry[]): BucketAgg {
    const done = entries.filter(_isDone);
    const passed = done.filter((e) => e.score.passed).length;
    const total = entries.length;
    const completed = done.length;
    const sumWall = done.reduce((acc, e) => acc + (e.wall_time_seconds ?? 0), 0);
    const sumTokens = done.reduce((acc, e) => acc + (e.tokens ?? 0), 0);
    return {
        passed,
        total,
        completed,
        errored: total - completed,
        completion_rate: completed ? _pyRound(passed / completed, 4) : 0,
        completion_rate_int: !completed,
        mean_wall_time: completed ? _pyRound(sumWall / completed, 3) : 0,
        mean_wall_time_int: !completed,
        mean_tokens: completed ? _pyRoundInt(sumTokens / completed) : 0,
    };
}

export function per_category_aggregate(perTask: PerTaskEntry[]): Array<[string, BucketAgg]> {
    // Group preserving first-seen category order (Python dict.setdefault).
    const byCat = new Map<string, PerTaskEntry[]>();
    for (const entry of perTask) {
        // Python: entry.get("category", "unknown") — the .get default fires only
        // when the key is absent; a present value (incl. null) stays.
        const key = entry.category === undefined ? 'unknown' : (entry.category as string);
        if (!byCat.has(key)) {
            byCat.set(key, []);
        }
        byCat.get(key)!.push(entry);
    }
    const out: Array<[string, BucketAgg]> = [];
    for (const [cat, entries] of byCat) {
        out.push([cat, _bucketAgg(entries)]);
    }
    return out;
}

/**
 * Aggregate by the 2×2 (duration × cognitive) cell — the value-benchmark axis.
 *
 * Cell key is `"<duration>/<cognitive>"`. Missing tags fall back to "untagged"
 * (Python `entry.get('duration', 'untagged')`).
 */
export function per_cell_aggregate(perTask: PerTaskEntry[]): Array<[string, BucketAgg]> {
    const byCell = new Map<string, PerTaskEntry[]>();
    for (const entry of perTask) {
        const dur = entry.duration === undefined ? 'untagged' : _pyStr(entry.duration);
        const cog = entry.cognitive === undefined ? 'untagged' : _pyStr(entry.cognitive);
        const cell = `${dur}/${cog}`;
        if (!byCell.has(cell)) {
            byCell.set(cell, []);
        }
        byCell.get(cell)!.push(entry);
    }
    const out: Array<[string, BucketAgg]> = [];
    for (const [cell, entries] of byCell) {
        out.push([cell, _bucketAgg(entries)]);
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
    const done = perTask.filter(_isDone);
    const completed = done.length;
    const errored = total - completed;
    const passed = done.filter((e) => e.score.passed).length;
    const perCategory = per_category_aggregate(perTask);
    const perCell = per_cell_aggregate(perTask);

    // Hit-rate is over COMPLETED tasks only — errored tasks excluded.
    const completionRate = completed ? _pyRound(passed / completed, 4) : 0;
    const completionRateInt = !completed;
    const sumWall = done.reduce((acc, e) => acc + (e.wall_time_seconds ?? 0), 0);
    const meanWall = completed ? _pyRound(sumWall / completed, 3) : 0;
    const meanWallInt = !completed;
    const sumTokens = done.reduce((acc, e) => acc + (e.tokens ?? 0), 0);
    const meanTokens = completed ? _pyRoundInt(sumTokens / completed) : 0; // int
    const sumRatio = done.reduce((acc, e) => acc + (e.ask_events?.ratio ?? 0), 0);
    const askVsAct = completed ? _pyRound(sumRatio / completed, 3) : 0;
    const askVsActInt = !completed;

    const stamp = utc_stamp();

    // Build the markdown using the same field values.
    const md =
        `# Track B · ${variant} · ${mode}\n\n` +
        `- Stamp: \`${stamp}\`\n` +
        `- Completion rate: **${_pyFixed(completionRate * 100, 1)}%**` +
        ` (${passed}/${completed} completed; ${errored} errored of ${total})\n` +
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
    // Field order is significant for byte-parity (Python dict insertion order).
    const resultsJson: Json = {
        mode,
        completion_rate: completionRateInt ? 0 : new PyFloat(completionRate),
        passed,
        completed,
        errored,
        total,
        per_category: _bucketJson(perCategory),
        per_cell: _bucketJson(perCell),
        mean_wall_time: meanWallInt ? 0 : new PyFloat(meanWall),
        total_tokens: sumTokens, // int
        mean_tokens: meanTokens, // int
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

interface RunVariantOpts {
    max_budget?: number | null;
    model?: string | null;
    progress?: Progress | null;
}

export function run_variant(
    variant: string,
    tasks: CorpusTask[],
    mode: string,
    timeoutS: number,
    opts: RunVariantOpts = {},
): RunVariantResult {
    const { max_budget = null, model = null, progress = null } = opts;
    const started = _monotonic();
    // Build the injected rule corpus once per variant (live only).
    let spFile: string | null = null;
    if (mode === 'live') {
        const spText = system_prompt_for(variant);
        if (spText) {
            fs.mkdirSync(REPORTS_DIR, { recursive: true });
            spFile = path.join(REPORTS_DIR, `.sysprompt-${variant}.txt`);
            fs.writeFileSync(spFile, spText, 'utf-8');
        }
    }
    const perTask: PerTaskEntry[] = [];
    tasks.forEach((task, i) => {
        if (progress !== null) {
            progress.start_task(variant, i + 1, tasks.length, _pyStr(task.id));
        }
        // Fixture-only working dir, identical for every arm — the package is NOT
        // in the clone files; activation is the injected system prompt (spFile).
        const cloneRoot = reset_clone('without');
        const pre = snapshot_clone(cloneRoot);
        let runResult: RunResult;
        if (mode === 'live') {
            runResult = run_live(task as Record<string, unknown>, cloneRoot, timeoutS, {
                sysprompt_file: spFile,
                setting_sources: setting_sources_for(variant),
                max_budget,
                model,
            });
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
            duration: task['duration'],
            cognitive: task['cognitive'],
            score: { passed: score.passed, checks: score.checks },
            // `errored` = the run did not complete on merit (rate-limit,
            // budget-cap, timeout, CLI failure). Distinct from a content fail.
            errored: Boolean(runResult.errored ?? false),
            wall_time_seconds: runResult.wall_time_seconds ?? 0.0,
            tokens: runResult.tokens ?? 0,
            tokens_breakdown: runResult.tokens_breakdown ?? {},
            exit_code: runResult.exit_code,
            mode: runResult.mode ?? mode,
            reason: runResult.reason ?? '',
            ask_events: count_ask_events(runResult.transcript ?? ''),
        });
        if (progress !== null) {
            progress.end_task(
                Boolean(score.passed),
                Number(runResult.wall_time_seconds ?? 0.0) || 0.0,
                variant,
                _pyStr(task.id),
            );
        }
    });
    const duration = _monotonic() - started;
    const reportPath = write_report(variant, mode, perTask, duration);
    const summary =
        `bench_ab_task_runner: ${variant} (${mode}) → ` +
        `${perTask.filter((e) => e.score.passed).length}/${perTask.length} ` +
        `passed — ${_relPosix(reportPath, REPO_ROOT)}`;
    if (progress !== null) {
        progress.variant_done(summary);
    } else {
        process.stdout.write(summary + '\n');
    }
    return { path: reportPath, per_task: perTask, duration };
}

interface Args {
    variant: string;
    mode: string;
    timeout: number;
    progress: string;
    limit: number;
    tasks: string;
    model: string;
    budget: number;
}

const VARIANT_CHOICES = ['with', 'without', 'with-rdp', 'both', 'all'];
const PROGRESS_CHOICES = ['auto', 'bar', 'plain', 'none'];

function parse_args(argv: string[]): Args {
    const args: Args = {
        variant: 'both',
        mode: 'dry-run',
        timeout: 120,
        progress: 'auto',
        limit: 0,
        tasks: '',
        model: 'claude-sonnet-4-6',
        budget: 2.0,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!;
        if (a === '--variant') args.variant = _choice(argv[++i] ?? '', '--variant', VARIANT_CHOICES);
        else if (a.startsWith('--variant='))
            args.variant = _choice(a.slice('--variant='.length), '--variant', VARIANT_CHOICES);
        else if (a === '--mode') args.mode = _choice(argv[++i] ?? '', '--mode', ['dry-run', 'live']);
        else if (a.startsWith('--mode=')) args.mode = _choice(a.slice('--mode='.length), '--mode', ['dry-run', 'live']);
        else if (a === '--timeout') args.timeout = _pyInt(argv[++i] ?? '', '--timeout');
        else if (a.startsWith('--timeout=')) args.timeout = _pyInt(a.slice('--timeout='.length), '--timeout');
        else if (a === '--progress') args.progress = _choice(argv[++i] ?? '', '--progress', PROGRESS_CHOICES);
        else if (a.startsWith('--progress='))
            args.progress = _choice(a.slice('--progress='.length), '--progress', PROGRESS_CHOICES);
        else if (a === '--limit') args.limit = _pyInt(argv[++i] ?? '', '--limit');
        else if (a.startsWith('--limit=')) args.limit = _pyInt(a.slice('--limit='.length), '--limit');
        else if (a === '--tasks') args.tasks = argv[++i] ?? '';
        else if (a.startsWith('--tasks=')) args.tasks = a.slice('--tasks='.length);
        else if (a === '--model') args.model = argv[++i] ?? '';
        else if (a.startsWith('--model=')) args.model = a.slice('--model='.length);
        else if (a === '--budget') args.budget = _pyFloat(argv[++i] ?? '', '--budget');
        else if (a.startsWith('--budget=')) args.budget = _pyFloat(a.slice('--budget='.length), '--budget');
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
    let tasks = data.tasks ?? [];
    if (tasks.length === 0) {
        process.stderr.write('bench_ab_task_runner: corpus has no tasks\n');
        return 1;
    }
    if (args.tasks.trim()) {
        const wanted = args.tasks
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        const byId = new Map<string, CorpusTask>();
        for (const t of tasks) {
            byId.set(_pyStr(t.id), t);
        }
        const missing = wanted.filter((w) => !byId.has(w));
        if (missing.length) {
            process.stderr.write(`bench_ab_task_runner: unknown task id(s): ${missing.join(', ')}\n`);
            return 1;
        }
        tasks = wanted.map((w) => byId.get(w)!);
    } else if (args.limit && args.limit > 0) {
        tasks = tasks.slice(0, args.limit);
    }
    let variants: string[];
    if (args.variant === 'both') {
        variants = ['with', 'without'];
    } else if (args.variant === 'all') {
        variants = ['with', 'without', 'with-rdp'];
    } else {
        variants = [args.variant];
    }
    const maxBudget = args.budget && args.budget > 0 ? args.budget : null;
    const model = args.model || null;
    const progress = new Progress(variants.length * tasks.length, args.mode, args.progress);
    for (const variant of variants) {
        run_variant(variant, tasks, args.mode, args.timeout, { max_budget: maxBudget, model, progress });
    }
    progress.finish();
    return 0;
}

// --- JSON shaping ------------------------------------------------------------

class PyFloat {
    constructor(readonly value: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [k: string]: Json };

/** Serialize per-category / per-cell aggregates (same BucketAgg shape). */
function _bucketJson(buckets: Array<[string, BucketAgg]>): { [k: string]: Json } {
    const out: { [k: string]: Json } = {};
    for (const [key, info] of buckets) {
        out[key] = {
            passed: info.passed,
            total: info.total,
            completed: info.completed,
            errored: info.errored,
            completion_rate: info.completion_rate_int ? 0 : new PyFloat(info.completion_rate),
            mean_wall_time: info.mean_wall_time_int ? 0 : new PyFloat(info.mean_wall_time),
            mean_tokens: info.mean_tokens, // int
        };
    }
    return out;
}

/**
 * Serialize a per_task entry. Python's `write_report` stores the `per_task`
 * list verbatim (it does NOT reshape it), so the JSON carries EXACTLY the keys
 * each entry dict was built with, in insertion order. `run_variant` builds the
 * full 13-key shape; a caller (e.g. the golden test) may pass a reduced dict.
 * Only emit keys that are present so byte-parity holds for both shapes.
 */
function _perTaskJson(e: PerTaskEntry): Json {
    const out: { [k: string]: Json } = {};
    out['id'] = _toJson(e.id);
    out['category'] = _toJson(e.category);
    if ('duration' in e) {
        out['duration'] = _toJson(e.duration);
    }
    if ('cognitive' in e) {
        out['cognitive'] = _toJson(e.cognitive);
    }
    out['score'] = {
        passed: e.score.passed,
        checks: e.score.checks.map((c) => ({ name: c.name, ok: c.ok, reason: c.reason })),
    };
    if ('errored' in e) {
        out['errored'] = _pyTruthy(e.errored);
    }
    out['wall_time_seconds'] = new PyFloat(e.wall_time_seconds);
    if ('tokens' in e) {
        out['tokens'] = e.tokens ?? 0; // int
    }
    if ('tokens_breakdown' in e) {
        out['tokens_breakdown'] = _tokensBreakdownJson(e.tokens_breakdown);
    }
    out['exit_code'] = e.exit_code === null ? null : e.exit_code;
    out['mode'] = e.mode;
    out['reason'] = e.reason;
    out['ask_events'] = {
        asked: e.ask_events.asked,
        acted_with_commit: e.ask_events.acted_with_commit,
        ratio: e.ask_events.ratioIsInt ? 0 : new PyFloat(e.ask_events.ratio),
    };
    return out;
}

/** `tokens_breakdown` is `{}` (run_live skip/timeout/dry-run absent) / a 4-int map. */
function _tokensBreakdownJson(b: TokensBreakdown | Record<string, never> | undefined): Json {
    if (b === undefined || Object.keys(b).length === 0) {
        return {};
    }
    const tb = b as TokensBreakdown;
    return {
        input_tokens: tb.input_tokens,
        output_tokens: tb.output_tokens,
        cache_read_input_tokens: tb.cache_read_input_tokens,
        cache_creation_input_tokens: tb.cache_creation_input_tokens,
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

/**
 * Python `round(value, ndigits)` — round-half-to-even on the EXACT IEEE-754
 * value (matches CPython, which rounds the true decimal expansion, not a naive
 * `value * 10**n`). E.g. `round(0.333/2, 3)` → 0.167 (the stored double is
 * 0.16650…091, strictly above half), where naive half-even gives 0.166.
 * Returns a number whose own shortest-repr matches what Python's repr produces
 * for the rounded value (so json.dumps / str() parity holds).
 */
function _pyRound(value: number, ndigits: number): number {
    if (!Number.isFinite(value)) return value;
    return Number(_pyFixed(value, ndigits));
}

/**
 * `format(x, '.Nf')` parity with CPython: round-half-to-even on the EXACT value
 * of the IEEE-754 double, not a naive `x * 10**N` (which diverges on products
 * landing just below `.5`, e.g. `12.345 * 100` → 12.34 naive vs 12.35 CPython).
 * `toFixed(40)` yields the exact decimal expansion; BigInt half-even on that
 * string reproduces CPython byte-for-byte.
 */
function _pyFixed(x: number, ndigits: number): string {
    if (!Number.isFinite(x)) return String(x);
    const neg = x < 0 || Object.is(x, -0);
    const abs = Math.abs(x);
    const exact = abs.toFixed(40);
    const dot = exact.indexOf('.');
    const intPart = dot === -1 ? exact : exact.slice(0, dot);
    const fracPart = dot === -1 ? '' : exact.slice(dot + 1);
    const kept = (intPart + fracPart.slice(0, ndigits).padEnd(ndigits, '0')).replace(/^0+(?=\d)/, '');
    const rest = fracPart.slice(ndigits);
    let value = BigInt(kept === '' ? '0' : kept);
    if (rest.length > 0) {
        const firstRest = rest.charCodeAt(0) - 48;
        const hasMore = /[1-9]/.test(rest.slice(1));
        if (firstRest > 5 || (firstRest === 5 && hasMore)) {
            value += 1n;
        } else if (firstRest === 5 && !hasMore) {
            if (value % 2n === 1n) {
                value += 1n;
            }
        }
    }
    let intStr = value.toString();
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

/** Python `round(x)` with no ndigits → nearest int, round-half-to-even. */
function _pyRoundInt(x: number): number {
    if (!Number.isFinite(x)) return x;
    const floor = Math.floor(x);
    const frac = x - floor;
    const eps = Math.max(Math.abs(x), 1) * 2 ** -40;
    if (Math.abs(frac - 0.5) <= eps) {
        return floor % 2 === 0 ? floor : floor + 1;
    }
    return Math.round(x);
}

/** Python truthiness of an arbitrary JS value (None/false/0/""/[]/{} falsy). */
function _pyTruthy(v: unknown): boolean {
    if (v === null || v === undefined) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0 && !Number.isNaN(v);
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return Boolean(v);
}

/** Python `x or fallback` guard for a string-typed value (truthy → string). */
function _pyTruthyStr(v: unknown): boolean {
    return typeof v === 'string' && v.length > 0;
}

/** Python `int(x or 0)` for a usage-count field — non-int / falsy → 0. */
function _intOrZero(v: unknown): number {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === 'boolean') return v ? 1 : 0;
    return 0;
}

function _isPlainObj(v: unknown): boolean {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Python `str(float)` for the --max-budget-usd argv value (e.g. 2.0 → "2.0"). */
function _pyStrNum(x: number): string {
    return Number.isInteger(x) ? `${x}.0` : String(x);
}

/** argparse `type=float` — accept int/float literals; on failure exit 2. */
function _pyFloat(s: string, flag: string): number {
    const trimmed = s.trim();
    const n = Number(trimmed);
    if (trimmed === '' || Number.isNaN(n)) {
        process.stderr.write(`bench_ab_task_runner: error: argument ${flag}: invalid float value: '${s}'\n`);
        process.exitCode = 2;
        throw new ArgExit();
    }
    return n;
}

/** Python str.ljust(width) — right-pad with spaces to at least `width`. */
function _ljust(s: string, width: number): string {
    return s.length >= width ? s : s + ' '.repeat(width - s.length);
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

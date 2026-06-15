/**
 * Session persistence for council consultations (D2).
 *
 * TypeScript twin of `src/scripts/ai_council/session.py` (ADR-096 —
 * Python→TS migration, Phase 1).
 *
 * Every `/council` call that completes (success or partial) writes an
 * audit artefact under `agents/runtime/council/sessions/<UTC-timestamp>/`:
 *
 * - `manifest.json` — input mode, members, token + USD totals, original
 *   ask, neutrality preamble fingerprint.
 * - `response.md`   — `orchestrator.render()` output (per-member
 *   sections + Convergence/Divergence slot).
 * - `raw-text.md`   — concatenated raw text per member, separated by
 *   ASCII rules so a later `grep` is trivial.
 *
 * Hard rules:
 * - Never raises on the project — disk write failures are logged and
 *   swallowed; the council is text-only and the report is the contract.
 * - Never writes secrets. The bundle has already been redacted by
 *   `bundler.py` before the orchestrator receives it.
 * - Never writes outside `agents/runtime/council/sessions/`. Path traversal in
 *   the timestamp is impossible (we generate it from `datetime.utcnow`).
 *
 * Parity notes:
 * - `datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")` → manual
 *   UTC formatting (Z suffix preserved).
 * - `json.dumps(payload, indent=2)` (ensure_ascii defaults to True) →
 *   `py_json_dumps_indent2` from `_lib/security_lint`; integer-valued
 *   `round(..., 6)` cost floats are wrapped in `PyFloat` so they render
 *   as `0.0`, not `0`.
 * - `list(dir.iterdir())` → `fs.readdirSync(dir)` (same directory-entry
 *   order on the same filesystem); each pruner skips/keeps in iteration
 *   order, so the returned `removed` list preserves Python's order.
 * - `shutil.rmtree` → `fs.rmSync(p, { recursive: true, force: true })`.
 * - `Path.stat().st_mtime` → `fs.statSync(p).mtimeMs / 1000` (seconds).
 * - `cutoff.timestamp()` → epoch seconds.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { project_settings_path, load_agent_settings } from '../_lib/agent_settings.js';
import { PyFloat, py_json_dumps_indent2 } from '../_lib/security_lint.js';
import { pyRound } from '../_lib/value_ladder.js';
import { CouncilResponse } from './clients.js';
import { render } from './orchestrator.js';

// src/scripts/ai_council/session.py → parents[3] == repo root.
const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');
export const SESSIONS_DIR = path.join(REPO_ROOT, 'agents', 'runtime', 'council', 'sessions');
export const QUESTIONS_DIR = path.join(REPO_ROOT, 'agents', 'runtime', 'council', 'questions');
export const RESPONSES_DIR = path.join(REPO_ROOT, 'agents', 'runtime', 'council', 'responses');
export const SETTINGS_FILE = project_settings_path(REPO_ROOT);

// Default retention for all council artefacts (questions, responses,
// sessions). Overridden by `ai_council.session_retention_days`
// in `.agent-settings.yml`. Council files are local-only scratch — short
// retention keeps the working tree from accumulating dead weight.
export const DEFAULT_RETENTION_DAYS = 7;
const _TS_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})Z$/;

/**
 * Structured record of a single council call.
 *
 * Round 2+ debate calls (D1) pass `rounds > 1`; each round's
 * per-member response is appended in `responses_per_round`.
 */
export class SessionManifest {
    mode: string; // bundle mode: prompt|roadmap|diff|files
    artefact: string; // human-readable artefact descriptor (path or "<inline>")
    original_ask: string;
    members: string[]; // "provider/model" pairs
    rounds: number;
    cost_usd_estimated: number;
    cost_usd_actual: number;
    extra: Record<string, unknown>;

    constructor(opts: {
        mode: string;
        artefact: string;
        original_ask: string;
        members: string[];
        rounds?: number;
        cost_usd_estimated?: number;
        cost_usd_actual?: number;
        extra?: Record<string, unknown>;
    }) {
        this.mode = opts.mode;
        this.artefact = opts.artefact;
        this.original_ask = opts.original_ask;
        this.members = opts.members;
        this.rounds = opts.rounds ?? 1;
        this.cost_usd_estimated = opts.cost_usd_estimated ?? 0.0;
        this.cost_usd_actual = opts.cost_usd_actual ?? 0.0;
        // Python dataclass uses `field(default_factory=dict)` — each instance
        // gets its own fresh dict.
        this.extra = opts.extra ?? {};
    }
}

/** UTC timestamp safe for filesystem use (Z suffix preserved). */
function _utc_timestamp(): string {
    const d = new Date();
    const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
    return (
        `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}-${pad(d.getUTCSeconds())}Z`
    );
}

/** Mirror Python `bool(...)` truthiness for arbitrary values. */
function _pyTruthy(value: unknown): boolean {
    if (value === null || value === undefined || value === false) {
        return false;
    }
    if (value === true) {
        return true;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        return value.length > 0;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>).length > 0;
    }
    return true;
}

/** Read-only mapping accessor mirroring Python `dict.get(key, default)`. */
function _metaGet(meta: Record<string, unknown>, key: string, dflt: unknown): unknown {
    return Object.prototype.hasOwnProperty.call(meta, key) ? meta[key] : dflt;
}

/**
 * Project a `CouncilResponse` into the manifest schema.
 *
 * Phase 5 / Step 1 — surface ``transport``, ``billable``,
 * ``subscription_label``, ``cost_usd``, and ``tokens_estimated`` so
 * the audit trail can distinguish flat-rate CLI calls from billable
 * api / community-CLI calls. When ``tokens_estimated`` is true the
 * token counts are kept (heuristic) but flagged so consumers can
 * null or disclaim them.
 */
function _serialise_response(r: CouncilResponse): Record<string, unknown> {
    const meta = r.metadata || {};
    const payload: Record<string, unknown> = {
        provider: r.provider,
        model: r.model,
        input_tokens: r.input_tokens,
        output_tokens: r.output_tokens,
        latency_ms: r.latency_ms,
        error: r.error,
        transport: _metaGet(meta, 'transport', 'api'),
        billable: _pyTruthy(_metaGet(meta, 'billable', true)),
        tokens_estimated: _pyTruthy(_metaGet(meta, 'tokens_estimated', false)),
    };
    if (_pyTruthy(_metaGet(meta, 'subscription_label', undefined))) {
        payload['subscription_label'] = meta['subscription_label'];
    }
    if (Object.prototype.hasOwnProperty.call(meta, 'cost_usd')) {
        payload['cost_usd'] = meta['cost_usd'];
    }
    return payload;
}

/**
 * Read `ai_council.session_retention_days` from `.agent-settings.yml`.
 *
 * Returns `DEFAULT_RETENTION_DAYS` on any read/parse failure (missing
 * file, invalid YAML, missing key, non-int value). Pruning never
 * blocks the council on a settings error.
 */
export function _load_retention_days(settings_path: string | null = null): number {
    // Centralized loader (road-to-portable-dev-preferences P3): tolerance
    // contract handles missing file / malformed YAML / no PyYAML uniformly.
    // ``ai_council.session_retention_days`` is not whitelisted, so the
    // user-global file cannot override the project value.
    const p = settings_path ?? SETTINGS_FILE;
    const data = load_agent_settings({ project_path: p });
    const ai = (data as Record<string, unknown>)['ai_council'];
    if (!_isMapping(ai)) {
        return DEFAULT_RETENTION_DAYS;
    }
    const raw = Object.prototype.hasOwnProperty.call(ai, 'session_retention_days')
        ? (ai as Record<string, unknown>)['session_retention_days']
        : DEFAULT_RETENTION_DAYS;
    const parsed = _pyInt(raw);
    if (parsed === null) {
        return DEFAULT_RETENTION_DAYS;
    }
    return parsed;
}

/** Mirror Python `isinstance(x, dict)`. */
function _isMapping(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Mirror Python `int(raw)` for the retention value, returning null on the
 * `(TypeError, ValueError)` paths the source catches.
 *
 * Python `int()` accepts ints, floats (truncated toward zero), and strings
 * of an integer literal (optionally signed, surrounding whitespace
 * stripped). bool is an int subclass (`int(True) == 1`). Everything else
 * raises and the caller falls back to the default.
 */
function _pyInt(raw: unknown): number | null {
    if (typeof raw === 'boolean') {
        return raw ? 1 : 0;
    }
    if (typeof raw === 'number') {
        if (!Number.isFinite(raw)) {
            return null; // int(inf)/int(nan) → ValueError/OverflowError
        }
        return Math.trunc(raw);
    }
    if (typeof raw === 'string') {
        const s = raw.trim();
        if (/^[+-]?\d+$/.test(s)) {
            return Number.parseInt(s, 10);
        }
        return null;
    }
    return null;
}

/** Parse `YYYY-MM-DDTHH-MM-SSZ` directory name to a UTC epoch (ms), or null. */
function _parse_session_timestamp(name: string): number | null {
    const m = _TS_RE.exec(name);
    if (!m) {
        return null;
    }
    const [, ys, mos, ds, hs, mis, ss] = m;
    const y = Number(ys);
    const mo = Number(mos);
    const d = Number(ds);
    const h = Number(hs);
    const mi = Number(mis);
    const s = Number(ss);
    // Mirror `datetime(y, mo, d, h, mi, s)` — reject out-of-range components
    // (Python raises ValueError; the source returns None).
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) {
        return null;
    }
    const epoch = Date.UTC(y, mo - 1, d, h, mi, s);
    // Date.UTC normalises overflow (e.g. day 31 in a 30-day month) rather than
    // raising; reject when the round-trip drifts so we match Python's
    // ValueError boundary for impossible calendar dates.
    const back = new Date(epoch);
    if (
        back.getUTCFullYear() !== y ||
        back.getUTCMonth() !== mo - 1 ||
        back.getUTCDate() !== d ||
        back.getUTCHours() !== h ||
        back.getUTCMinutes() !== mi ||
        back.getUTCSeconds() !== s
    ) {
        return null;
    }
    return epoch;
}

/** Best-effort directory listing; OSError → log + null (caller returns []). */
function _safeReaddir(dir: string, label: string): string[] | null {
    try {
        return fs.readdirSync(dir);
    } catch (exc) {
        process.stderr.write(`[council:session] ${label} failed: ${_errStr(exc)}\n`);
        return null;
    }
}

function _errStr(exc: unknown): string {
    if (exc instanceof Error) {
        return exc.message;
    }
    return String(exc);
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/**
 * Delete session subdirectories older than `retention_days`.
 *
 * A session is "old" when its directory-name timestamp predates
 * `now - retention_days`. Non-matching names (e.g. JSON reports at
 * the root, custom folders) are skipped. Never raises — disk
 * failures are logged to stderr.
 *
 * Returns the list of deleted directories. `retention_days <= 0`
 * disables pruning and returns an empty list.
 */
export function prune_old_sessions(
    sessions_dir: string,
    retention_days: number,
    opts: { now?: Date | null } = {},
): string[] {
    const now = opts.now ?? null;
    if (retention_days <= 0 || !fs.existsSync(sessions_dir)) {
        return [];
    }
    const cutoffMs = (now ? now.getTime() : Date.now()) - retention_days * 86400000;
    const removed: string[] = [];
    const names = _safeReaddir(sessions_dir, 'prune iterdir');
    if (names === null) {
        return removed;
    }
    for (const name of names) {
        const entry = path.join(sessions_dir, name);
        if (!_isDir(entry)) {
            continue;
        }
        const ts = _parse_session_timestamp(name);
        if (ts === null || ts >= cutoffMs) {
            continue;
        }
        try {
            fs.rmSync(entry, { recursive: true, force: true });
            removed.push(entry);
        } catch (exc) {
            process.stderr.write(
                `[council:session] prune rmtree failed for ${entry}: ${_errStr(exc)}\n`,
            );
        }
    }
    return removed;
}

/**
 * Delete files and timestamp-less directories older than `retention_days`.
 *
 * mtime-based — used for `agents/runtime/council/questions/`,
 * `agents/runtime/council/responses/`, and root-level files in
 * `agents/runtime/council/sessions/` that don't match the
 * timestamp-subdir convention handled by `prune_old_sessions`.
 *
 * Walks the directory non-recursively. For files: deletes when
 * mtime predates the cutoff. For sub-directories without a
 * timestamp name: deletes recursively when mtime predates the
 * cutoff. Never raises — disk failures log to stderr.
 *
 * Returns the list of deleted paths. `retention_days <= 0`
 * disables pruning and returns an empty list.
 */
export function prune_old_artifacts(
    artifact_dir: string,
    retention_days: number,
    opts: { now?: Date | null } = {},
): string[] {
    const now = opts.now ?? null;
    if (retention_days <= 0 || !fs.existsSync(artifact_dir)) {
        return [];
    }
    const cutoffMs = (now ? now.getTime() : Date.now()) - retention_days * 86400000;
    const cutoffTs = cutoffMs / 1000;
    const removed: string[] = [];
    const names = _safeReaddir(artifact_dir, 'artifact iterdir');
    if (names === null) {
        return removed;
    }
    for (const name of names) {
        const entry = path.join(artifact_dir, name);
        const isDir = _isDir(entry);
        // Timestamp subdirs are owned by prune_old_sessions; skip them
        // so the two pruners don't race.
        if (isDir && _parse_session_timestamp(name) !== null) {
            continue;
        }
        let mtime: number;
        try {
            mtime = fs.statSync(entry).mtimeMs / 1000;
        } catch (exc) {
            process.stderr.write(
                `[council:session] artifact stat failed for ${entry}: ${_errStr(exc)}\n`,
            );
            continue;
        }
        if (mtime >= cutoffTs) {
            continue;
        }
        try {
            if (isDir) {
                fs.rmSync(entry, { recursive: true, force: true });
            } else {
                fs.rmSync(entry);
            }
            removed.push(entry);
        } catch (exc) {
            process.stderr.write(
                `[council:session] artifact remove failed for ${entry}: ${_errStr(exc)}\n`,
            );
        }
    }
    return removed;
}

/**
 * Prune every council artefact dir under `repo_root` in one pass.
 *
 * Reads `retention_days` from settings if not supplied. Used by the
 * `task council-prune` target and by `save()`. Never raises.
 *
 * Returns a dict keyed by directory label — `sessions`,
 * `questions`, `responses` — each mapped to the list of
 * paths actually removed.
 */
export function prune_all_council_artifacts(
    retention_days: number | null = null,
    opts: { repo_root?: string | null; now?: Date | null } = {},
): Record<string, string[]> {
    const root = opts.repo_root ?? REPO_ROOT;
    const now = opts.now ?? null;
    const days = retention_days === null ? _load_retention_days() : retention_days;
    const sessions = path.join(root, 'agents', 'runtime', 'council', 'sessions');
    const questions = path.join(root, 'agents', 'runtime', 'council', 'questions');
    const responses = path.join(root, 'agents', 'runtime', 'council', 'responses');
    return {
        sessions: [
            ...prune_old_sessions(sessions, days, { now }),
            ...prune_old_artifacts(sessions, days, { now }),
        ],
        questions: prune_old_artifacts(questions, days, { now }),
        responses: prune_old_artifacts(responses, days, { now }),
    };
}

/**
 * Persist a council call. Returns the session directory.
 *
 * `responses` accepts either:
 * - `CouncilResponse[]` — single round (round 1 only).
 * - `CouncilResponse[][]` — multi-round, one list per round in execution
 *   order.
 *
 * `retention_days` controls auto-pruning of older council artefacts
 * after the new one is written — sibling sessions plus, when
 * `sessions_dir` is not overridden, files in `runtime/council/questions/`
 * and `runtime/council/responses/`. `null` reads the value
 * from `.agent-settings.yml` (`ai_council.session_retention_days`,
 * default `7`); `0` disables pruning.
 *
 * Disk-write failures are surfaced via a stderr line but do not
 * raise; the caller's text report is the source of truth.
 */
export function save(opts: {
    manifest: SessionManifest;
    responses: CouncilResponse[] | CouncilResponse[][];
    sessions_dir?: string | null;
    timestamp?: string | null;
    retention_days?: number | null;
}): string {
    const manifest = opts.manifest;
    const responses = opts.responses;
    const sessions_dir = opts.sessions_dir ?? null;
    const timestamp = opts.timestamp ?? null;
    const retention_days = opts.retention_days ?? null;

    let rounds_data: CouncilResponse[][];
    if (
        responses.length > 0 &&
        Array.isArray(responses) &&
        responses[0] instanceof CouncilResponse
    ) {
        rounds_data = [responses as CouncilResponse[]];
    } else {
        rounds_data = responses as CouncilResponse[][];
    }

    const base = sessions_dir ?? SESSIONS_DIR;
    const ts = timestamp ?? _utc_timestamp();
    const session_dir = path.join(base, ts);

    try {
        fs.mkdirSync(session_dir, { recursive: true });
    } catch (exc) {
        process.stderr.write(`[council:session] mkdir failed: ${_errStr(exc)}\n`);
        return session_dir;
    }

    const manifest_payload: Record<string, unknown> = {
        timestamp_utc: ts,
        mode: manifest.mode,
        artefact: manifest.artefact,
        original_ask: manifest.original_ask,
        members: manifest.members,
        rounds: manifest.rounds,
        cost_usd_estimated: new PyFloat(_pyRound6(manifest.cost_usd_estimated)),
        cost_usd_actual: new PyFloat(_pyRound6(manifest.cost_usd_actual)),
        responses_per_round: rounds_data.map((round_responses) =>
            round_responses.map((r) => _serialise_response(r)),
        ),
        ...manifest.extra,
    };

    try {
        fs.writeFileSync(
            path.join(session_dir, 'manifest.json'),
            py_json_dumps_indent2(manifest_payload) + '\n',
            { encoding: 'utf-8' },
        );
        // Render uses the LAST round (the moderator-facing summary).
        const last_round: CouncilResponse[] =
            rounds_data.length > 0 ? (rounds_data[rounds_data.length - 1] as CouncilResponse[]) : [];
        fs.writeFileSync(path.join(session_dir, 'response.md'), render(last_round) + '\n', {
            encoding: 'utf-8',
        });
        const raw_blocks: string[] = [];
        rounds_data.forEach((round_responses, idx) => {
            const round_idx = idx + 1;
            for (const r of round_responses) {
                raw_blocks.push(
                    `=== round ${round_idx} · ${r.provider}/${r.model} ===\n\n` + `${r.text}\n`,
                );
            }
        });
        fs.writeFileSync(
            path.join(session_dir, 'raw-text.md'),
            raw_blocks.join('\n') + (raw_blocks.length > 0 ? '\n' : ''),
            { encoding: 'utf-8' },
        );
    } catch (exc) {
        process.stderr.write(`[council:session] write failed: ${_errStr(exc)}\n`);
    }

    const days = retention_days === null ? _load_retention_days() : retention_days;
    prune_old_sessions(base, days);
    prune_old_artifacts(base, days);
    // In production (no sessions_dir override), also prune the sibling
    // council artefact dirs so questions/responses aren't left as dead
    // weight. Tests that pass an explicit sessions_dir stay isolated
    // from the wider tree.
    if (sessions_dir === null) {
        prune_old_artifacts(QUESTIONS_DIR, days);
        prune_old_artifacts(RESPONSES_DIR, days);
    }

    return session_dir;
}

/** Mirror Python `round(value, 6)` via the canonical `value_ladder` primitive. */
function _pyRound6(value: number): number {
    return pyRound(value, 6);
}

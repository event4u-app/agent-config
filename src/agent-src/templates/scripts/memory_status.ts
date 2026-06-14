#!/usr/bin/env tsx
/**
 * Detect the agent-memory backend.
 *
 * TypeScript twin of `src/agent-src/templates/scripts/memory_status.py`
 * (ADR-094, consumer-template memory CORE; byte-identical to the dev-side
 * `src/scripts/memory_status.py`). The public API and CLI contract mirror the Python
 * original EXACTLY — same exported names (snake_case kept deliberately),
 * same exit codes, stdout/stderr split, byte-identical messages, same
 * probe + cache + health-envelope behaviour. No behaviour changes — latent
 * Python bugs are replicated and flagged as divergence candidates in the
 * porting report, not fixed.
 *
 * Single source of truth for whether skills should use the file fallback
 * (`scripts/memory_lookup.py`) or route through the optional
 * `@event4u/agent-memory` package.
 *
 * Exit codes / statuses:
 *
 *   * `absent`        — package not installed or CLI not on PATH
 *   * `misconfigured` — installed but `health()` fails within the timeout
 *   * `present`       — installed, healthy, usable now
 *
 * Result is cached per process under `process.env.AGENT_MEMORY_STATUS`
 * and (optionally) under `.agent-memory/status.cache` per session.
 *
 * Usage:
 *     memory_status                 # human-readable line
 *     memory_status --format json   # stable JSON
 *     import { status } from './memory_status.js';   # module import
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export type Status = 'absent' | 'misconfigured' | 'present';

const _CLI_CANDIDATES = ['memory', 'agent-memory', 'agentmem'] as const;
// Mutable so tests can raise it the way pytest's monkeypatch does — mirrors
// the Python module-level constant that the suite overrides.
export let _HEALTH_TIMEOUT_SECONDS = 2.0;
export const _CACHE_ENV = 'AGENT_MEMORY_STATUS';
// Mutable so tests can repoint it at a tmp path (monkeypatch parity).
export let _CACHE_FILE = path.join('.agent-memory', 'status.cache');

// Test seams mirroring pytest's monkeypatch.setattr — ESM `export let`
// bindings are read-only to importers, so these setters give the suite the
// same override surface the Python tests have over the module attributes.
export function _setHealthTimeout(seconds: number): void {
    _HEALTH_TIMEOUT_SECONDS = seconds;
}
export function _setCacheFile(p: string): void {
    _CACHE_FILE = p;
}
// Overridable `_find_cli` indirection. Production code calls `_findCli()`
// (the internal hook); tests install a stub via `_setFindCli`.
let _findCliImpl: () => string = () => _find_cli();
export function _setFindCli(fn: (() => string) | null): void {
    _findCliImpl = fn ?? (() => _find_cli());
}

// Retrieval contract version served by the file-backed fallback.
// Source of truth: internal/schemas/retrieval-v1.schema.json.
export const CONTRACT_VERSION = 1;
export const _FILE_BACKEND_VERSION = '0.0.0-file';
export const _FILE_BACKEND_FEATURES: readonly string[] = ['file-fallback'];

/**
 * Result dataclass twin. Field order mirrors the Python `@dataclass` so
 * `asdict` round-trips identically. `features` is a string array (Python
 * `tuple`); JSON has no tuple, so the cache round-trip lands on a list and
 * the equality contract in tests compares element-wise.
 */
export interface ResultData {
    status: Status;
    backend: string; // "file" or "package"
    reason: string; // short explanation
    elapsed_ms: number; // time spent probing (0 if cached)
    cli_path: string; // resolved CLI path, if any
    // Populated only when status == "present" — sourced from the `health`
    // CLI envelope so the v1 health() reports real package capabilities
    // instead of file-fallback placeholders.
    backend_version: string;
    features: readonly string[];
}

export class Result implements ResultData {
    status: Status;
    backend: string;
    reason: string;
    elapsed_ms: number;
    cli_path: string;
    backend_version: string;
    features: readonly string[];

    constructor(
        status: Status,
        backend: string,
        reason: string,
        elapsed_ms: number,
        cli_path = '',
        backend_version = '',
        features: readonly string[] = [],
    ) {
        this.status = status;
        this.backend = backend;
        this.reason = reason;
        this.elapsed_ms = elapsed_ms;
        this.cli_path = cli_path;
        this.backend_version = backend_version;
        this.features = features;
    }
}

/** Mirror dataclasses.asdict(Result) — a plain object with the same keys. */
export function asdict(r: Result): ResultData {
    return {
        status: r.status,
        backend: r.backend,
        reason: r.reason,
        elapsed_ms: r.elapsed_ms,
        cli_path: r.cli_path,
        backend_version: r.backend_version,
        features: [...r.features],
    };
}

/** Resolve a `memory`-family CLI on PATH, mirroring shutil.which() order. */
export function _find_cli(): string {
    for (const name of _CLI_CANDIDATES) {
        const p = _which(name);
        if (p) {
            return p;
        }
    }
    return '';
}

/** shutil.which() equivalent — resolve `name` against PATH + PATHEXT-less. */
function _which(name: string): string {
    // Absolute / relative path with a separator → check directly.
    if (name.includes(path.sep) || (path.sep !== '/' && name.includes('/'))) {
        return _isExec(name) ? name : '';
    }
    const pathEnv = process.env['PATH'] ?? '';
    const sep = process.platform === 'win32' ? ';' : ':';
    for (const dir of pathEnv.split(sep)) {
        if (!dir) {
            continue;
        }
        const candidate = path.join(dir, name);
        if (_isExec(candidate)) {
            return candidate;
        }
    }
    return '';
}

function _isExec(p: string): boolean {
    try {
        const st = fs.statSync(p);
        if (!st.isFile()) {
            return false;
        }
        // POSIX exec bit. On win32 shutil.which is more permissive; the
        // memory CLI is a POSIX-shell smoke target so this is sufficient.
        if (process.platform === 'win32') {
            return true;
        }
        // any-of owner/group/other exec bits set
        // eslint-disable-next-line no-bitwise
        return (st.mode & 0o111) !== 0;
    } catch {
        return false;
    }
}

/**
 * Extract the v1 health envelope from `memory health` stdout.
 *
 * The package emits a single JSON object on stdout (pino structured logs
 * go to stderr). We tolerate older builds that may have leaked log lines
 * into stdout by scanning for the first top-level object that carries
 * `contract_version`.
 */
export function _parse_health_envelope(stdout: string): Record<string, unknown> | null {
    const text = (stdout || '').trim();
    if (!text) {
        return null;
    }
    let obj: unknown = null;
    try {
        obj = JSON.parse(text);
    } catch {
        obj = null;
    }
    if (_isPlainObject(obj) && obj['contract_version']) {
        return obj;
    }
    // Fallback: line-by-line scan for an envelope-shaped object — covers
    // the case where structured logs accidentally share stdout.
    for (let line of text.split(/\n/)) {
        line = line.trim();
        if (!line.startsWith('{')) {
            continue;
        }
        let cand: unknown;
        try {
            cand = JSON.parse(line);
        } catch {
            continue;
        }
        if (_isPlainObject(cand) && cand['contract_version']) {
            return cand;
        }
    }
    return null;
}

function _isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Returns [healthy, reason, envelope].
 *
 * On success `envelope` is the parsed v1 health envelope (may still be
 * null for very old CLIs that don't emit one). On failure it is always
 * null.
 */
export function _probe_health(cli_path: string): [boolean, string, Record<string, unknown> | null] {
    const out = spawnSync(cli_path, ['health'], {
        encoding: 'utf-8',
        timeout: Math.round(_HEALTH_TIMEOUT_SECONDS * 1000),
    });
    if (out.error) {
        const err = out.error as NodeJS.ErrnoException;
        if (err.code === 'ETIMEDOUT' || (out.signal === 'SIGTERM' && err.message.includes('ETIMEDOUT'))) {
            return [false, `health() timed out after ${_pyFloat(_HEALTH_TIMEOUT_SECONDS)}s`, null];
        }
        if (err.code === 'ENOENT') {
            return [false, 'CLI vanished between which() and invoke', null];
        }
        // spawnSync sets signal=SIGTERM and error on timeout on some platforms.
        if (out.signal === 'SIGTERM') {
            return [false, `health() timed out after ${_pyFloat(_HEALTH_TIMEOUT_SECONDS)}s`, null];
        }
        return [false, 'CLI vanished between which() and invoke', null];
    }
    // A pure timeout without an `error` object: Node sets signal=SIGTERM.
    if (out.signal === 'SIGTERM' && out.status === null) {
        return [false, `health() timed out after ${_pyFloat(_HEALTH_TIMEOUT_SECONDS)}s`, null];
    }
    const returncode = out.status ?? 1;
    if (returncode !== 0) {
        // First line of combined output, capped, for the reason field.
        const combined = (out.stderr || out.stdout || 'exit != 0').trim();
        const msg = _splitlines(combined);
        const head = msg.length > 0 ? (msg[0] as string).slice(0, 120) : 'exit != 0';
        return [false, `health() returned ${returncode}: ${head}`, null];
    }
    const envelope = _parse_health_envelope(out.stdout ?? '');
    return [true, 'ok', envelope];
}

/** Mirror Python str(float) for the timeout — `2.0`, not `2`. */
function _pyFloat(n: number): string {
    return Number.isInteger(n) ? `${n}.0` : String(n);
}

/** Mirror str.splitlines() — split on \n / \r / \r\n, drop a trailing empty. */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    const lines = text.split(/\r\n|\r|\n/);
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    return lines;
}

export function _read_cache(): Result | null {
    const cached = process.env[_CACHE_ENV];
    if (cached) {
        try {
            const data = JSON.parse(cached);
            const r = _resultFromData(data);
            if (r) {
                return r;
            }
        } catch {
            // fall through to file cache
        }
    }
    if (_isFile(_CACHE_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(_CACHE_FILE, 'utf-8'));
            const r = _resultFromData(data);
            if (r) {
                return r;
            }
        } catch {
            // best-effort cache
        }
    }
    return null;
}

/**
 * Reconstruct a Result from cached JSON, mirroring `Result(**data)`.
 *
 * Python's `Result(**data)` raises `TypeError` on an unexpected/missing key,
 * which the caller catches and falls through. Reproduce that: a payload
 * with extra or missing required keys yields null so the caller skips it.
 */
function _resultFromData(data: unknown): Result | null {
    if (!_isPlainObject(data)) {
        return null;
    }
    const keys = new Set(Object.keys(data));
    const required = ['status', 'backend', 'reason', 'elapsed_ms'];
    const optional = ['cli_path', 'backend_version', 'features'];
    const allowed = new Set([...required, ...optional]);
    for (const k of required) {
        if (!keys.has(k)) {
            return null; // missing required positional → TypeError in Python
        }
    }
    for (const k of keys) {
        if (!allowed.has(k)) {
            return null; // unexpected keyword → TypeError in Python
        }
    }
    const features = data['features'];
    return new Result(
        data['status'] as Status,
        data['backend'] as string,
        data['reason'] as string,
        data['elapsed_ms'] as number,
        (data['cli_path'] as string) ?? '',
        (data['backend_version'] as string) ?? '',
        Array.isArray(features) ? (features as string[]) : [],
    );
}

export function _write_cache(result: Result): void {
    const payload = JSON.stringify(asdict(result));
    process.env[_CACHE_ENV] = payload;
    try {
        fs.mkdirSync(path.dirname(_CACHE_FILE), { recursive: true });
        fs.writeFileSync(_CACHE_FILE, payload, 'utf-8');
    } catch {
        // Best-effort cache; skills MUST still work without it.
    }
}

/**
 * Return the cached or freshly-probed backend status.
 *
 * Always returns in well under `_HEALTH_TIMEOUT_SECONDS` seconds on a cache
 * hit; bounded by the timeout on a cache miss. Never raises for probe
 * failures — they degrade to `absent` / `misconfigured` rather than
 * surfacing exceptions.
 */
export function status(refresh = false): Result {
    if (!refresh) {
        const cached = _read_cache();
        if (cached !== null) {
            cached.elapsed_ms = 0;
            return cached;
        }
    }
    const t0 = _monotonicMs();
    const cli = _findCliImpl();
    let result: Result;
    if (!cli) {
        result = new Result('absent', 'file', 'agent-memory CLI not on PATH', 0);
    } else {
        const [healthy, reason, envelope] = _probe_health(cli);
        const elapsed = Math.trunc(_monotonicMs() - t0);
        if (healthy) {
            let backend_version = '';
            let features: readonly string[] = [];
            if (_isPlainObject(envelope)) {
                const bv = envelope['backend_version'];
                if (typeof bv === 'string') {
                    backend_version = bv;
                }
                const feats = envelope['features'];
                if (Array.isArray(feats) && feats.every((f) => typeof f === 'string')) {
                    features = feats as string[];
                }
            }
            result = new Result('present', 'package', reason, elapsed, cli, backend_version, features);
        } else {
            result = new Result('misconfigured', 'file', reason, elapsed, cli);
        }
    }
    _write_cache(result);
    return result;
}

function _monotonicMs(): number {
    const [s, ns] = process.hrtime();
    return s * 1000 + ns / 1e6;
}

/**
 * Return a v1 retrieval-contract health envelope.
 *
 * Schema: `internal/schemas/retrieval-v1.schema.json` (HealthResponse).
 * Maps the three-state {@link status} result onto the contract's
 * `ok | degraded | error` so consumers can read `contract_version` without
 * caring about the file-vs-package split.
 *
 * When the package backs the call (`status == "present"`), the envelope
 * reports the package's own `backend_version` and `features` so consumers
 * can feature-detect against real capabilities. Otherwise the file-fallback
 * markers are returned.
 */
export function health(refresh = false): Record<string, unknown> {
    const r = status(refresh);
    const envelope_status = { present: 'ok', misconfigured: 'degraded', absent: 'ok' }[r.status];
    let backend_version: string;
    let features: string[];
    if (r.status === 'present' && (r.backend_version || r.features.length > 0)) {
        backend_version = r.backend_version || _FILE_BACKEND_VERSION;
        features = r.features.length > 0 ? [...r.features] : [..._FILE_BACKEND_FEATURES];
    } else {
        backend_version = _FILE_BACKEND_VERSION;
        features = [..._FILE_BACKEND_FEATURES];
    }
    return {
        contract_version: CONTRACT_VERSION,
        status: envelope_status,
        backend_version,
        features,
    };
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/**
 * Python-compatible `json.dumps(obj)` (no indent).
 *
 * `json.dumps` defaults: `", "` item separator, `": "` key separator,
 * `ensure_ascii=True` (every non-ASCII char escaped to \uXXXX). JS's
 * `JSON.stringify` does neither, so this reproduces both for byte-exact
 * golden parity with the Python CLI.
 */
function pyJsonDumps(value: unknown): string {
    return _escapeNonAscii(_pyCompactSeparators(JSON.stringify(value)));
}

/** Re-introduce Python's `", "` / `": "` separators into a compact JSON string. */
function _pyCompactSeparators(json: string): string {
    let result = '';
    let inString = false;
    let escaped = false;
    for (let i = 0; i < json.length; i += 1) {
        const ch = json[i] as string;
        result += ch;
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            escaped = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (!inString && (ch === ',' || ch === ':')) {
            result += ' ';
        }
    }
    return result;
}

/** Escape every non-ASCII char as \uXXXX, mirroring json.dumps ensure_ascii. */
function _escapeNonAscii(s: string): string {
    let out = '';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
        if (code > 0x7f) {
            for (let i = 0; i < ch.length; i += 1) {
                out += `\\u${ch.charCodeAt(i).toString(16).padStart(4, '0')}`;
            }
        } else {
            out += ch;
        }
    }
    return out;
}

interface ParsedArgs {
    format: 'text' | 'json';
    refresh: boolean;
    health: boolean;
}

function _parseArgs(argv: string[]): ParsedArgs {
    const args: ParsedArgs = { format: 'text', refresh: false, health: false };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--format') {
            args.format = _checkChoice(argv[++i], ['text', 'json'], '--format') as 'text' | 'json';
        } else if (a.startsWith('--format=')) {
            args.format = _checkChoice(a.slice('--format='.length), ['text', 'json'], '--format') as
                | 'text'
                | 'json';
        } else if (a === '--refresh') {
            args.refresh = true;
        } else if (a === '--health') {
            args.health = true;
        } else if (a === '-h' || a === '--help') {
            _printUsage();
            process.exit(0);
        } else {
            process.stderr.write(`memory_status: error: unrecognized arguments: ${a}\n`);
            process.exit(2);
        }
    }
    return args;
}

function _checkChoice(value: string | undefined, choices: string[], flag: string): string {
    if (value === undefined || !choices.includes(value)) {
        process.stderr.write(
            `memory_status: error: argument ${flag}: invalid choice: '${value ?? ''}' (choose from ${choices
                .map((c) => `'${c}'`)
                .join(', ')})\n`,
        );
        process.exit(2);
    }
    return value;
}

function _printUsage(): void {
    process.stdout.write('usage: memory_status [-h] [--format {text,json}] [--refresh] [--health]\n');
}

export function main(): number {
    const args = _parseArgs(process.argv.slice(2));
    if (args.health) {
        process.stdout.write(`${pyJsonDumps(health(args.refresh))}\n`);
        return 0;
    }
    const r = status(args.refresh);
    if (args.format === 'json') {
        process.stdout.write(`${pyJsonDumps(asdict(r))}\n`);
    } else {
        const icon = { present: '✅', misconfigured: '⚠️', absent: 'ℹ️' }[r.status];
        process.stdout.write(
            `  ${icon}  backend=${r.backend}  status=${r.status}  ` +
                `elapsed=${r.elapsed_ms}ms  reason=${r.reason}\n`,
        );
    }
    // `absent` is a valid operational state, not a failure.
    return 0;
}

const _isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isMain) {
    process.exit(main());
}

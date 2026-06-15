/**
 * Daily update-check banner for the `agent-config` dispatcher.
 *
 * TypeScript twin of `src/scripts/_lib/update_check.py` (ADR-200,
 * Phase 2 / Wave 1 batch B). Pure functions: `check_for_update()`
 * decides whether a banner should be emitted and returns the banner
 * string (or `null`). The dispatcher prints the returned string to
 * `stderr` after the subcommand finishes — never delaying the work,
 * never prompting.
 *
 * Design constraints (mirrored from the Python original):
 *
 * - Node builtins only (global `fetch` on Node >= 20).
 * - 1 s hard timeout on the registry call; network failure is silent.
 * - 24 h cadence gated by `~/.event4u/agent-config/update-check.json`
 *   (legacy `~/.config/agent-config/update-check.json` is read once as
 *   a fallback so the cadence is not reset on the first run after the
 *   namespace migration).
 * - Suppress in CI, on non-TTY stdout, when `AGENT_CONFIG_NO_UPDATE_CHECK=1`,
 *   or when `update_check.enabled: false` in settings.
 * - State file mode is `0600`.
 *
 * Port notes (intentional TS adaptations, semantics preserved):
 * - `fetch_latest_from_npm` / `check_for_update` are async — Node has
 *   no synchronous HTTP. The transport stays injectable via the
 *   `fetcher` parameter (same seam the pytest suite uses).
 */
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { EnvMap } from './user_global_paths';
import * as user_global_paths from './user_global_paths';

export const PACKAGE_NAME = '@event4u/agent-config';
export const NPM_REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
/** Hard fetch timeout in seconds (mirrors the Python float). */
export const FETCH_TIMEOUT_S = 1.0;
/** 24 h cadence window in milliseconds (Python: `timedelta(hours=24)`). */
export const CHECK_WINDOW_MS = 24 * 60 * 60 * 1000;

export const STATE_FILENAME = 'update-check.json';

/**
 * Canonical write target. Reads are routed via `_resolve_state_path`
 * with a read-fallback to the legacy
 * `~/.config/agent-config/update-check.json` so a fresh install under
 * the new namespace does not lose the 24 h cadence window established
 * by a pre-2.4 install.
 *
 * NOTE: like the Python module-level constant, this is frozen at
 * import time (env override read once on module load) — replicated
 * quirk, not fixed.
 */
export const DEFAULT_STATE_PATH = user_global_paths.write_target(STATE_FILENAME);

/** Return the active state path, preferring the new namespace. */
function _resolve_state_path(): string {
    const found = user_global_paths.resolve_with_fallback(STATE_FILENAME);
    if (found !== null) {
        return found;
    }
    return DEFAULT_STATE_PATH;
}

export type Fetcher = () => string | null | Promise<string | null>;

/**
 * Return the `latest` dist-tag version, or `null` on any failure.
 *
 * Hard 1 s timeout. Any exception (network, JSON, missing key) yields
 * `null` — the update check is best-effort. `fetch_impl` is the
 * injectable transport (defaults to the global `fetch`).
 */
export async function fetch_latest_from_npm(
    options: {
        timeout?: number;
        url?: string;
        fetch_impl?: typeof fetch;
    } = {},
): Promise<string | null> {
    const timeout = options.timeout ?? FETCH_TIMEOUT_S;
    const url = options.url ?? NPM_REGISTRY_URL;
    const fetch_impl = options.fetch_impl ?? fetch;
    try {
        const resp = await fetch_impl(url, {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'agent-config-update-check',
            },
            signal: AbortSignal.timeout(timeout * 1000),
        });
        const payload: unknown = await resp.json();
        if (payload !== null && typeof payload === 'object' && !Array.isArray(payload)) {
            const version = (payload as Record<string, unknown>).version;
            if (typeof version === 'string' && version.trim()) {
                return version.trim();
            }
        }
    } catch {
        return null;
    }
    return null;
}

function _read_state(state_path: string): Record<string, unknown> {
    try {
        const raw = fs.readFileSync(state_path, 'utf-8');
        const data: unknown = JSON.parse(raw);
        if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
            return data as Record<string, unknown>;
        }
    } catch {
        // Unreadable / corrupt state — treat as empty, same as Python.
    }
    return {};
}

function _write_state(state_path: string, payload: Record<string, unknown>): void {
    const parent = path.dirname(state_path);
    fs.mkdirSync(parent, { recursive: true });
    // mkstemp equivalent: unique sibling temp file, created 0600.
    const tmp = path.join(parent, `.update-check-${randomBytes(8).toString('hex')}`);
    try {
        // json.dump(indent=2, sort_keys=True) equivalent. (Python also
        // escapes non-ASCII via ensure_ascii=True — flagged divergence;
        // payload values are version strings + timestamps, ASCII-only.)
        const sorted: Record<string, unknown> = {};
        for (const key of Object.keys(payload).sort()) {
            sorted[key] = payload[key];
        }
        fs.writeFileSync(tmp, JSON.stringify(sorted, null, 2), { encoding: 'utf-8', mode: 0o600 });
        fs.chmodSync(tmp, 0o600);
        fs.renameSync(tmp, state_path);
    } catch (err) {
        try {
            fs.unlinkSync(tmp);
        } catch {
            // Best-effort cleanup, mirroring the Python `except OSError: pass`.
        }
        throw err;
    }
}

function _should_check(state: Record<string, unknown>, now: Date): boolean {
    const last = state.last_check_utc;
    if (typeof last !== 'string') {
        return true;
    }
    // Python: datetime.fromisoformat(last.replace("Z", "+00:00")); a
    // naive timestamp (no offset) is assumed UTC. JS `Date.parse` would
    // treat offset-less strings as *local* time — normalize to UTC first.
    let normalized = last.replace(/Z/g, '+00:00');
    if (!/[+-]\d{2}:?\d{2}$/.test(normalized)) {
        normalized = `${normalized}+00:00`;
    }
    const last_ms = Date.parse(normalized);
    if (Number.isNaN(last_ms)) {
        return true;
    }
    return now.getTime() - last_ms >= CHECK_WINDOW_MS;
}

function _format_banner(latest: string, installed: string): string {
    return (
        `ℹ️  agent-config ${latest} available (you have ${installed}).\n` +
        `    Update: npx ${PACKAGE_NAME} update`
    );
}

/** Strict integer parse mirroring Python's `int(p)` (else 0). */
function _int_or_zero(part: string): number {
    const trimmed = part.trim();
    if (/^[+-]?\d+$/.test(trimmed)) {
        return parseInt(trimmed, 10);
    }
    return 0;
}

/**
 * Best-effort semver comparison — mirrors the Python `_is_newer`
 * (leading `v`s stripped, pre-release tail dropped, first three
 * numeric parts compared, non-numeric parts coerced to 0).
 *
 * Exported (despite the underscore) because the pytest suite accesses
 * `uc._is_newer`; the vitest port does the same.
 */
export function _is_newer(latest: string, installed: string): boolean {
    const parse = (v: string): [number, number, number] => {
        const core = v.replace(/^v+/, '').split('-')[0] ?? '';
        const parts = core.split('.');
        const out: number[] = [];
        for (const p of parts.slice(0, 3)) {
            out.push(_int_or_zero(p));
        }
        while (out.length < 3) {
            out.push(0);
        }
        return [out[0] as number, out[1] as number, out[2] as number];
    };

    const a = parse(latest);
    const b = parse(installed);
    for (let i = 0; i < 3; i += 1) {
        if ((a[i] as number) > (b[i] as number)) {
            return true;
        }
        if ((a[i] as number) < (b[i] as number)) {
            return false;
        }
    }
    return false;
}

/** Format a Date as `%Y-%m-%dT%H:%M:%SZ` (UTC, no milliseconds). */
function _format_utc(d: Date): string {
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Decide whether to show an update banner. Pure (modulo state file).
 *
 * Returns the banner string or `null`. `null` covers every
 * suppression branch (CI, non-TTY, opt-out, within 24 h, network
 * failure, no update available).
 */
export async function check_for_update(
    installed_version: string,
    options: {
        now?: Date | null;
        state_path?: string | null;
        env?: EnvMap | null;
        is_tty?: boolean | null;
        settings_enabled?: boolean;
        fetcher?: Fetcher;
    } = {},
): Promise<string | null> {
    const env = options.env ?? process.env;
    if (env.AGENT_CONFIG_NO_UPDATE_CHECK === '1') {
        return null;
    }
    if (env.CI === '1' || env.CI === 'true' || env.GITHUB_ACTIONS === 'true') {
        return null;
    }
    const settings_enabled = options.settings_enabled ?? true;
    if (!settings_enabled) {
        return null;
    }
    let is_tty = options.is_tty ?? null;
    if (is_tty === null) {
        is_tty = Boolean(process.stdout.isTTY);
    }
    if (!is_tty) {
        return null;
    }

    const now = options.now ?? new Date();
    // When the caller does not pin a state path, route through the
    // fallback resolver so a pre-2.4 install's cadence file is still
    // consulted before we decide to re-check npm.
    const read_path = options.state_path ?? _resolve_state_path();
    const write_path = options.state_path ?? DEFAULT_STATE_PATH;
    const state = _read_state(read_path);
    if (!_should_check(state, now)) {
        const latest = state.last_seen_version;
        if (typeof latest === 'string' && _is_newer(latest, installed_version)) {
            return _format_banner(latest, installed_version);
        }
        return null;
    }

    const fetcher = options.fetcher ?? (() => fetch_latest_from_npm());
    const latest = await fetcher();
    const fallback_seen = Object.prototype.hasOwnProperty.call(state, 'last_seen_version')
        ? state.last_seen_version
        : '';
    const payload: Record<string, unknown> = {
        last_check_utc: _format_utc(now),
        // Python: `latest or state.get("last_seen_version", "")`.
        last_seen_version: latest ? latest : fallback_seen,
        installed_version,
    };
    try {
        _write_state(write_path, payload);
    } catch (err) {
        // Python swallows OSError only; everything else propagates.
        const code = (err as NodeJS.ErrnoException).code;
        if (typeof code !== 'string') {
            throw err;
        }
    }

    if (!latest || !_is_newer(latest, installed_version)) {
        return null;
    }
    return _format_banner(latest, installed_version);
}

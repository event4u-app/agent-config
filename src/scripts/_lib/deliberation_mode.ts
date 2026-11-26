/**
 * `deliberation.mode` — whether the agent offers `/council`, `/arena` or
 * `/panel` on a real decision (`offer`), runs the fitting one (`auto`), or
 * neither (`off`) — and the per-session override beside it.
 *
 * Resolution order, first hit wins:
 *
 *   1. session  — `<user-global root>/state/deliberation/<session-id>.json`,
 *                 written by `agent-config deliberation:set <mode> --session <id>`;
 *   2. global   — `deliberation.mode` in the USER-GLOBAL settings layers (later
 *                 layers win), the file `settings:set` writes;
 *   3. default  — `off`, the template value: nothing is offered or run until
 *                 the user switches it on (owner ruling 2026-11-26).
 *
 * Only the user-global layers are read, for the reason `star_ask` gives: a
 * repository a contributor clones must not be able to switch the agent to
 * `auto` for them.
 *
 * The session file is keyed by the host's session id, which arrives from a hook
 * payload or from a caller such as Agent Switch. It is validated before it ever
 * becomes a path segment: letters, digits, `-` and `_`, 8–128 characters,
 * starting with a letter or digit — a UUID passes, `..`, `/` and `\` do not.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

import { user_global_settings_paths } from './agent_settings.js';
import { write_atomic } from './fs_atomic.js';
import * as user_global_paths from './user_global_paths.js';

export const DELIBERATION_MODES = ['off', 'offer', 'auto'] as const;
export type DeliberationMode = (typeof DELIBERATION_MODES)[number];
export const DEFAULT_DELIBERATION_MODE: DeliberationMode = 'off';
export const SESSION_OVERRIDE_SCHEMA = 1;
export const SESSION_OVERRIDE_DIR = path.join('state', 'deliberation');

const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;
const OVERRIDE_MAX_BYTES = 4096;

export type DeliberationSource = 'session' | 'global' | 'default';

export function isDeliberationMode(v: unknown): v is DeliberationMode {
    return typeof v === 'string' && (DELIBERATION_MODES as readonly string[]).includes(v);
}

/** A session id that may become one path segment, or `null`. */
export function validSessionId(id: unknown): string | null {
    if (typeof id !== 'string') return null;
    const t = id.trim();
    return SESSION_ID.test(t) ? t : null;
}

/** Where the override for `sessionId` lives. Throws on an id that is not a single safe segment. */
export function sessionOverridePath(sessionId: string, env?: user_global_paths.EnvMap | null): string {
    const id = validSessionId(sessionId);
    if (id === null) throw new Error(`not a session id: ${JSON.stringify(sessionId)}`);
    return user_global_paths.write_target(path.join(SESSION_OVERRIDE_DIR, `${id}.json`), { env: env ?? null });
}

export interface GlobalMode {
    readonly mode: DeliberationMode;
    readonly source: 'global' | 'default';
    /** The layer that set it; `null` for the default. */
    readonly file: string | null;
    /** A layer exists but could not be read or parsed; the default stands in for whatever it holds. */
    readonly unreadable?: boolean;
}

/** YAML 1.1 reads a bare `off` as boolean false; both spell the same choice. */
function modeOf(v: unknown): DeliberationMode | null {
    if (v === false) return 'off';
    return isDeliberationMode(v) ? v : null;
}

export function readGlobalMode(paths: readonly string[] = user_global_settings_paths()): GlobalMode {
    let found: { mode: DeliberationMode; file: string } | null = null;
    let unreadable = false;
    for (const p of paths) {
        let raw: string;
        try {
            raw = fs.readFileSync(p, 'utf-8');
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT') unreadable = true;
            continue;
        }
        try {
            const doc = parseYaml(raw, { version: '1.1' }) as Record<string, unknown> | null;
            const block = doc?.['deliberation'];
            if (block === null || typeof block !== 'object' || Array.isArray(block)) continue;
            const mode = modeOf((block as Record<string, unknown>)['mode']);
            if (mode !== null) found = { mode, file: p };
        } catch {
            unreadable = true;
        }
    }
    const extra = unreadable ? { unreadable: true } : {};
    return found === null
        ? { mode: DEFAULT_DELIBERATION_MODE, source: 'default', file: null, ...extra }
        : { mode: found.mode, source: 'global', file: found.file, ...extra };
}

export interface SessionOverride {
    readonly mode: DeliberationMode;
    readonly at: string | null;
    readonly file: string;
}

/** The override for `sessionId`, or `null` when there is none, the id is invalid, or the file is not one this module wrote. */
export function readSessionOverride(sessionId: string, env?: user_global_paths.EnvMap | null): SessionOverride | null {
    if (validSessionId(sessionId) === null) return null;
    const file = sessionOverridePath(sessionId, env);
    try {
        const st = fs.statSync(file);
        if (!st.isFile() || st.size > OVERRIDE_MAX_BYTES) return null;
        const o = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown> | null;
        if (o === null || typeof o !== 'object' || Array.isArray(o) || o['v'] !== SESSION_OVERRIDE_SCHEMA) return null;
        if (!isDeliberationMode(o['mode'])) return null;
        const at = typeof o['at'] === 'string' ? o['at'] : null;
        return { mode: o['mode'], at, file };
    } catch {
        return null;
    }
}

/** Write (atomically, 0600) the override for one session. Returns the file. */
export function writeSessionOverride(
    sessionId: string,
    mode: DeliberationMode,
    now: Date = new Date(),
    env?: user_global_paths.EnvMap | null,
): string {
    const file = sessionOverridePath(sessionId, env);
    const body = { v: SESSION_OVERRIDE_SCHEMA, session: validSessionId(sessionId), mode, at: now.toISOString() };
    write_atomic(file, `${JSON.stringify(body, null, 2)}\n`);
    return file;
}

/** Remove the override for one session. `true` when a file was removed. */
export function clearSessionOverride(sessionId: string, env?: user_global_paths.EnvMap | null): boolean {
    const file = sessionOverridePath(sessionId, env);
    try {
        fs.unlinkSync(file);
        return true;
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
        throw e;
    }
}

export interface EffectiveMode {
    readonly mode: DeliberationMode;
    readonly source: DeliberationSource;
    /** The file that decided it; `null` for the default. */
    readonly file: string | null;
    readonly sessionId: string | null;
    readonly global: GlobalMode;
    readonly sessionOverride: SessionOverride | null;
}

export interface ResolveOptions {
    readonly sessionId?: string | null | undefined;
    readonly settingsPaths?: readonly string[] | undefined;
    readonly env?: user_global_paths.EnvMap | null | undefined;
}

/** session override > user-global setting > default. Pure apart from the reads named above. */
export function resolveDeliberationMode(opts: ResolveOptions = {}): EffectiveMode {
    const sessionId = validSessionId(opts.sessionId ?? null);
    const global = readGlobalMode(opts.settingsPaths ?? user_global_settings_paths());
    const sessionOverride = sessionId === null ? null : readSessionOverride(sessionId, opts.env);
    if (sessionOverride !== null) {
        return { mode: sessionOverride.mode, source: 'session', file: sessionOverride.file, sessionId, global, sessionOverride };
    }
    return { mode: global.mode, source: global.source, file: global.file, sessionId, global, sessionOverride };
}

/** The machine-readable shape `deliberation:get --json` prints and Agent Switch reads. */
export function effectiveToJson(e: EffectiveMode): Record<string, unknown> {
    return {
        v: 1,
        mode: e.mode,
        source: e.source,
        file: e.file,
        session_id: e.sessionId,
        global: {
            mode: e.global.mode,
            source: e.global.source,
            file: e.global.file,
            ...(e.global.unreadable === true ? { unreadable: true } : {}),
        },
        session_override:
            e.sessionOverride === null ? null : { mode: e.sessionOverride.mode, at: e.sessionOverride.at, file: e.sessionOverride.file },
    };
}

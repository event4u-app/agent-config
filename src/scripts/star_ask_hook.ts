#!/usr/bin/env node
/**
 * `star-ask` — the `session_start` concern that asks the user, once a month,
 * to star the repository on GitHub, until they say they have.
 *
 * WHY IT EXISTS. Owner ruling of 2026-10-25 (ADR-301, amending ADR-286 § D2):
 * the owner asked for this on 2026-10-16 and a round refused it in his name.
 * The benefit he named is discoverability — a starred repository is easier for
 * the next person to find — and that is the purpose, not a measurement.
 *
 * WHAT IT COSTS. Reads the user-global settings layers and one user-global
 * state file, and writes that state file (two timestamps). No network, no
 * `gh`, no GitHub identity. The stop condition ADR-286 called uncheckable is checked
 * locally instead: the user says they starred (`star_ask.starred: true`, an
 * A-class key the agent may set when told), and that is believed.
 *
 * CADENCE. The first ask waits `FIRST_ASK_GRACE_DAYS` after the concern first
 * runs on the machine, then at most once per `ASK_INTERVAL_DAYS`. An ask counts
 * the moment it is emitted, and the state recording it is written BEFORE the
 * emission: if that write fails, nothing is emitted. A notice the host dropped
 * waits for the next interval rather than being repeated, because a cadence
 * gated on a delivery receipt asks every session whenever the receipt is lost.
 * The read-decide-write-emit step runs under an exclusive lock file, so two
 * simultaneous session starts cannot both ask.
 *
 * WHAT STOPS IT. `star_ask.starred: true`, `star_ask.mode: off`, a user-global
 * settings layer that exists but cannot be read (it may hold the opt-out),
 * `AGENT_CONFIG_NO_STAR_ASK=1`, CI, replay mode, and any host without a
 * verified user channel (it never writes to stderr, which every host discards).
 * Settings are read from the USER-GLOBAL layers only: a repository cannot ask
 * its contributors for stars, and cannot silence the ask for them either.
 *
 * Fail-open for the session (exit 0 on every path), fail-closed for the ask.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { user_global_settings_paths } from './_lib/agent_settings.js';
import { write_atomic } from './_lib/fs_atomic.js';
import * as user_global_paths from './_lib/user_global_paths.js';
import { readHookStdin } from './hooks/hook_stdin.js';
import { is_replay_mode } from './hooks/state_io.js';
import { hostShowsUserNotice, USER_NOTICE_ID_KEY, USER_NOTICE_KEY } from './hooks/user_notice.js';

export const CONCERN = 'star-ask';
export const STAR_ASK_STATE_FILENAME = 'star-ask.json';
export const STAR_ASK_STATE_SCHEMA = 1;
export const REPO_URL = 'https://github.com/event4u-app/agent-config';
export const FIRST_ASK_GRACE_DAYS = 7;
export const ASK_INTERVAL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type StarAskMode = 'monthly' | 'off';

export interface StarAskSettings {
    readonly mode: StarAskMode;
    readonly starred: boolean;
    /** A layer exists but could not be read or parsed; the opt-out it may hold is unknown. */
    readonly unreadable?: boolean;
}

/**
 * Lifecycle: user-global `star-ask.json`, written atomically at 0600 and
 * replaced whole. A record that does not parse, or carries another schema,
 * reads as empty — which restarts the grace period rather than asking at once.
 * Deleting it is always safe.
 */
export interface StarAskState {
    readonly first_seen_at: string | null;
    readonly last_asked_at: string | null;
}

const EMPTY: StarAskState = { first_seen_at: null, last_asked_at: null };

function isoOrNull(v: unknown): string | null {
    return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null;
}

export function readStarAskState(statePath: string): StarAskState {
    try {
        const o = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as Record<string, unknown>;
        if (o === null || typeof o !== 'object' || Array.isArray(o) || o['schema'] !== STAR_ASK_STATE_SCHEMA) return EMPTY;
        return { first_seen_at: isoOrNull(o['first_seen_at']), last_asked_at: isoOrNull(o['last_asked_at']) };
    } catch {
        return EMPTY;
    }
}

/** `false` when the state could not be recorded, which the caller reads as "do not ask". */
export function writeStarAskState(statePath: string, state: StarAskState): boolean {
    if (is_replay_mode()) return false;
    try {
        write_atomic(statePath, `${JSON.stringify({ schema: STAR_ASK_STATE_SCHEMA, ...state }, null, 2)}\n`);
        return true;
    } catch {
        return false;
    }
}

/** `star_ask.*` from the USER-GLOBAL settings layers only; later layers win. Only an ABSENT layer sets nothing. */
export function readStarAskSettings(paths: readonly string[] = user_global_settings_paths()): StarAskSettings {
    let mode: StarAskMode = 'monthly';
    let starred = false;
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
            const block = doc?.['star_ask'];
            if (block === null || typeof block !== 'object' || Array.isArray(block)) continue;
            const b = block as Record<string, unknown>;
            // YAML 1.1 reads a bare `off` as boolean false; both spell the same choice.
            if (b['mode'] === 'monthly') mode = 'monthly';
            else if (b['mode'] === 'off' || b['mode'] === false) mode = 'off';
            if (typeof b['starred'] === 'boolean') starred = b['starred'];
        } catch {
            unreadable = true;
        }
    }
    return { mode, starred, ...(unreadable ? { unreadable: true } : {}) };
}

export function starAskText(): string {
    return [
        `⭐ agent-config is free and maintained by one person. If it helps you, a GitHub star is the easiest way to help others find it: ${REPO_URL}`,
        'Already starred, or rather not be asked? Tell the agent, or run `agent-config settings:set star_ask.starred true` (or `star_ask.mode off`). Otherwise you will see this at most once a month.',
    ].join('\n');
}

export type StarAskOutcome =
    | { readonly asked: true; readonly text: string }
    | { readonly asked: false; readonly reason: string };

export interface StarAskDeps {
    readonly sessionId: string | null;
    readonly viaHost: boolean;
    readonly env: NodeJS.ProcessEnv;
    readonly settings: StarAskSettings;
    readonly statePath: string;
    readonly now: Date;
    readonly notice: { write(text: string): void };
    /** Test seam: runs after the first decision and before the lock is taken. */
    readonly beforeLock?: () => void;
}

/** A lock older than this was left by a session that died holding it. */
export const LOCK_STALE_MS = 60_000;

/**
 * Mutual exclusion across simultaneous session starts: `write_atomic` keeps the
 * file whole but does not stop two sessions from both reading "due" and both
 * asking. `wx` creation is the exclusive step; any other failure denies the ask.
 */
function acquireLock(lockPath: string): 'acquired' | 'held' | 'unwritable' {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            fs.closeSync(fs.openSync(lockPath, 'wx', 0o600));
            return 'acquired';
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'EEXIST') return 'unwritable';
            try {
                if (Date.now() - fs.statSync(lockPath).mtimeMs <= LOCK_STALE_MS) return 'held';
                fs.unlinkSync(lockPath);
            } catch {
                return 'held';
            }
        }
    }
    return 'held';
}

function releaseLock(lockPath: string): void {
    try {
        fs.unlinkSync(lockPath);
    } catch {
        /* already gone; a leftover lock expires after LOCK_STALE_MS */
    }
}

/** Why the ask is not due yet, or `null` when it is. */
function notDue(state: StarAskState, now: Date): string | null {
    if (state.first_seen_at === null) return 'first seen';
    if (state.last_asked_at === null && now.getTime() - Date.parse(state.first_seen_at) < FIRST_ASK_GRACE_DAYS * DAY_MS) {
        return 'grace period';
    }
    if (state.last_asked_at !== null && now.getTime() - Date.parse(state.last_asked_at) < ASK_INTERVAL_DAYS * DAY_MS) {
        return 'asked recently';
    }
    return null;
}

/** Why this session stays silent, before any state is read; `null` when the ask may be considered. */
export function suppression(deps: Pick<StarAskDeps, 'sessionId' | 'viaHost' | 'env' | 'settings'>): string | null {
    const ci = ['1', 'true'].includes((deps.env['CI'] ?? '').trim().toLowerCase()) || deps.env['GITHUB_ACTIONS'] === 'true';
    if (ci) return 'ci';
    if (deps.env['AGENT_CONFIG_NO_STAR_ASK'] === '1') return 'kill switch';
    if (deps.settings.starred) return 'starred';
    if (deps.settings.mode === 'off') return 'mode off';
    if (deps.settings.unreadable === true) return 'settings unreadable';
    if (!deps.viaHost || deps.sessionId === null) return 'no user channel';
    return null;
}

/** Decide and act. Every input is injectable; nothing here reads the clock or the disk except through `deps`. */
export function runStarAsk(deps: StarAskDeps): StarAskOutcome {
    const why = suppression(deps);
    if (why !== null) return { asked: false, reason: why };

    const state = readStarAskState(deps.statePath);
    const nowIso = deps.now.toISOString();

    if (state.first_seen_at === null) {
        writeStarAskState(deps.statePath, { first_seen_at: nowIso, last_asked_at: state.last_asked_at });
        return { asked: false, reason: 'first seen' };
    }
    const early = notDue(state, deps.now);
    if (early !== null) return { asked: false, reason: early };

    deps.beforeLock?.();
    const lockPath = `${deps.statePath}.lock`;
    const lock = acquireLock(lockPath);
    if (lock === 'held') return { asked: false, reason: 'another session is asking' };
    if (lock === 'unwritable') return { asked: false, reason: 'state not writable' };
    try {
        const locked = readStarAskState(deps.statePath);
        const late = notDue(locked, deps.now);
        if (late !== null) return { asked: false, reason: late };
        if (!writeStarAskState(deps.statePath, { first_seen_at: locked.first_seen_at, last_asked_at: nowIso })) {
            return { asked: false, reason: 'state not writable' };
        }
        const text = starAskText();
        deps.notice.write(JSON.stringify({ [USER_NOTICE_KEY]: text, [USER_NOTICE_ID_KEY]: randomUUID() }));
        return { asked: true, text };
    } finally {
        releaseLock(lockPath);
    }
}

function envelopeField(raw: string, key: string): string | null {
    try {
        const value = (JSON.parse(raw) as Record<string, unknown> | null)?.[key];
        return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
    } catch {
        return null;
    }
}

export function main(argv?: string[]): number {
    void argv;
    const raw = readHookStdin();
    if (is_replay_mode()) return 0;
    try {
        const sessionId = envelopeField(raw, 'session_id');
        runStarAsk({
            sessionId,
            viaHost: sessionId !== null && hostShowsUserNotice(envelopeField(raw, 'platform')),
            env: process.env,
            settings: readStarAskSettings(),
            statePath: user_global_paths.write_target(STAR_ASK_STATE_FILENAME),
            now: new Date(),
            notice: process.stdout,
        });
        return 0;
    } catch {
        return 0;
    }
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main(process.argv.slice(2)));
}

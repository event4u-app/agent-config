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
 * WHAT IT COSTS. File reads only: one user-global state file, the user-global
 * settings layers, the dispatcher's delivery receipt. No network, no `gh`, no
 * GitHub identity. The stop condition ADR-286 called uncheckable is checked
 * locally instead: the user says they starred (`star_ask.starred: true`, an
 * A-class key the agent may set when told), and that is believed.
 *
 * CADENCE. The first ask waits `FIRST_ASK_GRACE_DAYS` after the concern first
 * runs on the machine, then at most once per `ASK_INTERVAL_DAYS`. An ask counts
 * as made only when the dispatcher's receipt names its session and its id
 * (`hooks/user_notice.ts`); a notice the host dropped is said again next session.
 *
 * WHAT STOPS IT. `star_ask.starred: true`, `star_ask.mode: off`,
 * `AGENT_CONFIG_NO_STAR_ASK=1`, CI, replay mode, and any host without a
 * verified user channel (it never writes to stderr, which every host discards).
 * Settings are read from the USER-GLOBAL layers only: a repository cannot ask
 * its contributors for stars, and cannot silence the ask for them either.
 *
 * Fail-open on every path, exit 0 on every path.
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
import { hostShowsUserNotice, readNoticeReceipt, USER_NOTICE_ID_KEY, USER_NOTICE_KEY, type NoticeReceipt } from './hooks/user_notice.js';

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
    readonly pending?: { readonly session_id: string; readonly notice_id: string };
}

const EMPTY: StarAskState = { first_seen_at: null, last_asked_at: null };

function isoOrNull(v: unknown): string | null {
    return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null;
}

export function readStarAskState(statePath: string): StarAskState {
    try {
        const o = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as Record<string, unknown>;
        if (o === null || typeof o !== 'object' || Array.isArray(o) || o['schema'] !== STAR_ASK_STATE_SCHEMA) return EMPTY;
        const p = o['pending'] as Record<string, unknown> | null | undefined;
        const pending =
            typeof p?.['session_id'] === 'string' && typeof p['notice_id'] === 'string'
                ? { session_id: p['session_id'], notice_id: p['notice_id'] }
                : undefined;
        return { first_seen_at: isoOrNull(o['first_seen_at']), last_asked_at: isoOrNull(o['last_asked_at']), ...(pending ? { pending } : {}) };
    } catch {
        return EMPTY;
    }
}

export function writeStarAskState(statePath: string, state: StarAskState): void {
    if (is_replay_mode()) return;
    try {
        write_atomic(statePath, `${JSON.stringify({ schema: STAR_ASK_STATE_SCHEMA, ...state }, null, 2)}\n`);
    } catch {
        /* unwritable → the concern re-decides next session; worst case it asks again */
    }
}

/** A pending ask becomes `last_asked_at` only when the receipt names its session AND its id. */
export function confirmAsked(state: StarAskState, receipt: NoticeReceipt | null): StarAskState {
    const p = state.pending;
    if (p === undefined || receipt === null || receipt.notice_id !== p.notice_id || receipt.session_id !== p.session_id) return state;
    return { first_seen_at: state.first_seen_at, last_asked_at: isoOrNull(receipt.at) ?? new Date().toISOString() };
}

/** `star_ask.*` from the USER-GLOBAL settings layers only; later layers win. */
export function readStarAskSettings(paths: readonly string[] = user_global_settings_paths()): StarAskSettings {
    let mode: StarAskMode = 'monthly';
    let starred = false;
    for (const p of paths) {
        try {
            const doc = parseYaml(fs.readFileSync(p, 'utf-8'), { version: '1.1' }) as Record<string, unknown> | null;
            const block = doc?.['star_ask'];
            if (block === null || typeof block !== 'object' || Array.isArray(block)) continue;
            const b = block as Record<string, unknown>;
            // YAML 1.1 reads a bare `off` as boolean false; both spell the same choice.
            if (b['mode'] === 'monthly') mode = 'monthly';
            else if (b['mode'] === 'off' || b['mode'] === false) mode = 'off';
            if (typeof b['starred'] === 'boolean') starred = b['starred'];
        } catch {
            /* absent or malformed layer → it sets nothing */
        }
    }
    return { mode, starred };
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
    readonly receipt: () => NoticeReceipt | null;
}

/** Why this session stays silent, before any state is read; `null` when the ask may be considered. */
export function suppression(deps: Pick<StarAskDeps, 'sessionId' | 'viaHost' | 'env' | 'settings'>): string | null {
    const ci = ['1', 'true'].includes((deps.env['CI'] ?? '').trim().toLowerCase()) || deps.env['GITHUB_ACTIONS'] === 'true';
    if (ci) return 'ci';
    if (deps.env['AGENT_CONFIG_NO_STAR_ASK'] === '1') return 'kill switch';
    if (deps.settings.starred) return 'starred';
    if (deps.settings.mode === 'off') return 'mode off';
    if (!deps.viaHost || deps.sessionId === null) return 'no user channel';
    return null;
}

/** Decide and act. Every input is injectable; nothing here reads the clock or the disk except through `deps`. */
export function runStarAsk(deps: StarAskDeps): StarAskOutcome {
    const why = suppression(deps);
    if (why !== null) return { asked: false, reason: why };

    const stored = readStarAskState(deps.statePath);
    const state = confirmAsked(stored, deps.receipt());
    const nowIso = deps.now.toISOString();

    if (state.first_seen_at === null) {
        writeStarAskState(deps.statePath, { first_seen_at: nowIso, last_asked_at: state.last_asked_at });
        return { asked: false, reason: 'first seen' };
    }
    const sinceFirst = deps.now.getTime() - Date.parse(state.first_seen_at);
    if (state.last_asked_at === null && sinceFirst < FIRST_ASK_GRACE_DAYS * DAY_MS) {
        if (state !== stored) writeStarAskState(deps.statePath, state);
        return { asked: false, reason: 'grace period' };
    }
    if (state.last_asked_at !== null && deps.now.getTime() - Date.parse(state.last_asked_at) < ASK_INTERVAL_DAYS * DAY_MS) {
        if (state !== stored) writeStarAskState(deps.statePath, state);
        return { asked: false, reason: 'asked recently' };
    }

    const noticeId = randomUUID();
    const text = starAskText();
    deps.notice.write(JSON.stringify({ [USER_NOTICE_KEY]: text, [USER_NOTICE_ID_KEY]: noticeId }));
    writeStarAskState(deps.statePath, {
        first_seen_at: state.first_seen_at,
        last_asked_at: state.last_asked_at,
        pending: { session_id: deps.sessionId as string, notice_id: noticeId },
    });
    return { asked: true, text };
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
            receipt: () => readNoticeReceipt(CONCERN),
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

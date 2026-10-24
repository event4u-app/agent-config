#!/usr/bin/env node
/**
 * `update-notice` — the `session_start` concern that tells a user their global
 * install has a newer release, and, under `update.mode: auto`, lets a
 * previously staged one install at that boundary.
 *
 * WHY A SESSION CONCERN AT ALL. The update banner is written by the CLI
 * dispatcher after a subcommand and suppressed on a non-TTY
 * (`_lib/update_check.ts`), while consumption of this package is global and
 * through hosts — so the one surface that tells a user about an update is the
 * one surface most users never see. `SECURITY.md:21` backports nothing, which
 * makes an unnoticed stale install an unpatched one.
 *
 * WHAT IT COSTS. File reads only — the cached registry probe state, the
 * installed `package.json`, the installed `CHANGELOG.md`, the session register.
 * No network: the 24 h registry fetch stays with the CLI probe that owns it, so
 * this concern is bounded by the disk and runs well inside its 1 s budget. It
 * is day-throttled on top, through the same `probe_throttle` stamp the three
 * sibling `session_start` probes use.
 *
 * WHAT IT NEVER DOES. It never installs anything and never swaps a file: it
 * stages a verified candidate and says so, and `upgrade --unattended` — run by
 * a human or a scheduler — is what installs. It used to be able to spawn that
 * run itself; an independent review of 2026-10-20 refused the manifest for it,
 * because `effect: notification` means "tells the human something and changes
 * nothing else", and the capability was removed rather than the label widened.
 * It never reads project settings, so a repository cannot set a contributor's
 * global update mode. It never puts fetched text in front of the reader —
 * every sentence is written in `_lib/update_notice.ts` or read from the
 * CHANGELOG of the package already installed.
 *
 * It is fail-open on every path and returns 0 on every path, including an
 * unreadable state file, an unwritable state directory and a missing changelog.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { originForPackageRoot } from './_cli/doctor_install_mode.js';
import { user_global_settings_paths } from './_lib/agent_settings.js';
import type { UpdateMode } from './_lib/classify_update.js';
import { any_live_session, global_register_dir } from './_lib/session_register.js';
import { STATE_FILENAME } from './_lib/update_check.js';
import { write_atomic } from './_lib/fs_atomic.js';
import { parseCuratedHead, RECONCILE_REASONS, updateNotice, type NoticeOutcome } from './_lib/update_notice.js';
import { parse_version } from './_lib/version_order.js';
import * as user_global_paths from './_lib/user_global_paths.js';
import { readHookStdin } from './hooks/hook_stdin.js';
import { is_replay_mode } from './hooks/state_io.js';
import { hostShowsUserNotice, USER_NOTICE_KEY } from './hooks/user_notice.js';

export const CONCERN = 'update-notice';
export const NOTICE_STATE_FILENAME = 'update-notice.json';
export const NOTICE_THROTTLE_FILENAME = 'update-notice.stamp';
const VALID_MODES: readonly string[] = ['off', 'notify', 'ask', 'auto'];

/**
 * What this concern remembers between sessions, in the user-global
 * `update-notice.json`. Everything else is re-read.
 *
 * Lifecycle: written atomically at mode 0600 by a session that is not
 * suppressed; replaced whole each time; `staged` returns to `null` once nothing
 * newer than the installed version is cached. A record that does not parse, or
 * carries another schema, reads as empty and is replaced on the next write.
 * Suppressed sessions — the kill switch included — neither write nor delete it.
 * Deleting the file is always safe. `staged` is advisory output: no install
 * path reads it. Beside it, `update-notice.stamp` records the day the notice
 * last ran; it is user-global, replaced by rename, and written only after a run
 * that was not suppressed.
 */
export const NOTICE_STATE_SCHEMA = 1;

export interface NoticeState {
    readonly staged: string | null;
    readonly last_seen_installed: string | null;
}

export function readNoticeState(statePath: string | null): NoticeState {
    try {
        if (statePath === null) return { staged: null, last_seen_installed: null };
        const raw: unknown = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
        const o = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
        if (o['schema'] !== undefined && o['schema'] !== NOTICE_STATE_SCHEMA) return { staged: null, last_seen_installed: null };
        const str = (v: unknown): string | null => (typeof v === 'string' && parse_version(v.trim()) !== null ? v.trim() : null);
        return { staged: str(o['staged']), last_seen_installed: str(o['last_seen_installed']) };
    } catch {
        return { staged: null, last_seen_installed: null };
    }
}

export function writeNoticeState(statePath: string, state: NoticeState): void {
    try {
        write_atomic(statePath, `${JSON.stringify({ schema: NOTICE_STATE_SCHEMA, ...state }, null, 2)}\n`);
    } catch {
        /* unwritable state dir → the concern simply re-decides next session */
    }
}

/**
 * `update.mode` from the USER-GLOBAL settings only.
 *
 * Deliberately not the project cascade: the thing being updated is the global
 * install, and a repository that could set this would be deciding how its
 * contributors' machines update themselves. That is the pin hazard
 * (`cmd_update.ts:11-13`) pointed the other way, and it is the reason this
 * reads the global layers by hand instead of calling `load_agent_settings`.
 */
export function readUpdateMode(paths: readonly string[] = user_global_settings_paths()): UpdateMode | undefined {
    let found: UpdateMode | undefined;
    for (const p of paths) {
        try {
            const doc = parseYaml(fs.readFileSync(p, 'utf-8'), { version: '1.1' }) as Record<string, unknown> | null;
            const block = doc?.['update'];
            if (block === null || typeof block !== 'object' || Array.isArray(block)) continue;
            const mode = (block as Record<string, unknown>)['mode'];
            if (typeof mode === 'string' && VALID_MODES.includes(mode)) found = mode as UpdateMode;
        } catch {
            /* absent or malformed layer → it simply sets nothing */
        }
    }
    return found;
}

function readJson(p: string): Record<string, unknown> {
    try {
        const raw: unknown = JSON.parse(fs.readFileSync(p, 'utf-8'));
        return raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

function readText(p: string): string {
    try {
        return fs.readFileSync(p, 'utf-8');
    } catch {
        return '';
    }
}

function envelopeField(raw: string, key: string): string | null {
    try {
        const doc: unknown = JSON.parse(raw);
        const value = (doc as Record<string, unknown> | null)?.[key];
        return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
    } catch {
        return null;
    }
}

export interface NoticeDeps {
    readonly packageRoot: string;
    readonly sessionId: string | null;
    readonly env: NodeJS.ProcessEnv;
    readonly isTty: boolean;
    readonly mode: UpdateMode | undefined;
    readonly probeStatePath: string | null;
    readonly noticeStatePath: string;
    /** The user-global day stamp; never under the workspace, which a repository controls. */
    readonly throttlePath: string;
    readonly registerDir: string;
    readonly err: { write(text: string): void };
    /**
     * The dispatcher's user channel (`hooks/user_notice.ts`), set only when the
     * host shows a notice to the user. The lines then go there as one reply and
     * nothing goes to stderr, which every host discards.
     */
    readonly notice?: { write(text: string): void };
}

/**
 * Decide and act. Separated from `main` so every input is injectable.
 * `apply: false` decides only — it prints nothing and writes nothing.
 */
export function runNotice(deps: NoticeDeps, apply = true): NoticeOutcome {
    const pkg = readJson(path.join(deps.packageRoot, 'package.json'));
    const installed = typeof pkg['version'] === 'string' ? (pkg['version'] as string) : '';
    if (installed === '') return { lines: [], stage: null, activate: null, suppressed: 'installed version unreadable' };

    const probe = deps.probeStatePath === null ? {} : readJson(deps.probeStatePath);
    const seen = probe['last_seen_version'];
    const state = readNoticeState(deps.noticeStatePath);

    const outcome = updateNotice({
        installed,
        candidate: typeof seen === 'string' && seen.trim() !== '' ? seen.trim() : null,
        impactMap: probe['last_seen_impact'] ?? null,
        mode: deps.mode,
        origin: originForPackageRoot(deps.packageRoot),
        env: {
            ci: ['1', 'true'].includes((deps.env['CI'] ?? '').trim().toLowerCase()) || deps.env['GITHUB_ACTIONS'] === 'true',
            interactive: deps.isTty,
            noUpdateCheck: deps.env['AGENT_CONFIG_NO_UPDATE_CHECK'] === '1',
        },
        curatedHead: parseCuratedHead(readText(path.join(deps.packageRoot, 'CHANGELOG.md')), installed),
        staged: state.staged,
        lastSeenInstalled: state.last_seen_installed,
        foreignSessionLive: any_live_session(deps.registerDir, deps.sessionId),
    });

    if (!apply) return outcome;
    if (outcome.suppressed !== null) {
        if (RECONCILE_REASONS.has(outcome.suppressed) && (state.staged !== null || state.last_seen_installed !== installed)) {
            writeNoticeState(deps.noticeStatePath, { staged: null, last_seen_installed: installed });
        }
        return outcome;
    }

    // Recording the version as reported right after replying is sound only
    // because this concern is bound where no host refusal exists: there the
    // dispatcher always exits 0 and never withholds a notice (pinned by
    // tests/hooks/user_notice_dispatch.test.ts). A block-capable binding would
    // need the write to wait for delivery.
    if (deps.notice !== undefined) {
        if (outcome.lines.length > 0) deps.notice.write(JSON.stringify({ [USER_NOTICE_KEY]: outcome.lines.join('\n') }));
    } else {
        for (const line of outcome.lines) deps.err.write(`[update] ${line}\n`);
    }
    writeNoticeState(deps.noticeStatePath, { staged: outcome.stage, last_seen_installed: installed });
    return outcome;
}

/**
 * The session-start entry: decide without side effects, honour the day
 * throttle, then decide again and act — so the throttle stamp, like every other
 * write, happens only in a context that may be written in at all. Returns
 * `null` when the throttle or a suppressing context ends it before the act.
 */
export function noticeOncePerDay(deps: NoticeDeps): NoticeOutcome | null {
    const dry = runNotice(deps, false);
    if (dry.suppressed !== null && !RECONCILE_REASONS.has(dry.suppressed)) return null;
    if (ranToday(deps.throttlePath)) return null;
    const outcome = runNotice(deps);
    stampToday(deps.throttlePath);
    return outcome;
}

/** Local calendar day, so "once a day" follows the user's clock. */
function localDay(d: Date): string {
    return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** True when the stamp is a regular file dated today. A link or any read problem is "not today". */
export function ranToday(throttlePath: string): boolean {
    try {
        const st = fs.lstatSync(throttlePath);
        return st.isFile() && localDay(st.mtime) === localDay(new Date());
    } catch {
        return false;
    }
}

/** Replaces the stamp by rename, so a link at the path is replaced, never followed. */
function stampToday(throttlePath: string): void {
    if (is_replay_mode()) return;
    try {
        write_atomic(throttlePath, `${new Date().toISOString()}\n`);
    } catch {
        /* unwritable → the notice runs again next session, which only costs reads */
    }
}

function packageRootOf(): string {
    const env = process.env['AGENT_CONFIG_PACKAGE_ROOT'];
    if (env) return env;
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export function main(argv?: string[]): number {
    void argv;
    const raw = readHookStdin();
    if (is_replay_mode()) return 0;
    try {
        const packageRoot = packageRootOf();
        const mode = readUpdateMode();
        // The throttle stamp is a WRITE, so it comes after the decision that
        // this context may be written in at all — AC-2 asks for zero writes
        // under CI, a non-TTY, a source checkout and the opt-out.
        // Every host runs this on pipes, so a TTY says nothing about whether the
        // user will see the notice; a host with a verified user channel does.
        const viaHost = hostShowsUserNotice(envelopeField(raw, 'platform'));
        const deps: NoticeDeps = {
            packageRoot,
            sessionId: envelopeField(raw, 'session_id'),
            env: process.env,
            isTty: viaHost || Boolean(process.stderr.isTTY) || Boolean(process.stdout.isTTY),
            ...(viaHost ? { notice: process.stdout } : {}),
            mode,
            probeStatePath: user_global_paths.resolve_with_fallback(STATE_FILENAME),
            noticeStatePath: user_global_paths.write_target(NOTICE_STATE_FILENAME),
            throttlePath: user_global_paths.write_target(NOTICE_THROTTLE_FILENAME),
            registerDir: global_register_dir(),
            err: process.stderr,
        };
        noticeOncePerDay(deps);
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

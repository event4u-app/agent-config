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
import * as user_global_paths from './_lib/user_global_paths.js';
import { readHookStdin } from './hooks/hook_stdin.js';
import { probeRanToday, stampProbeRun } from './hooks/probe_throttle.js';
import { is_replay_mode } from './hooks/state_io.js';

export const CONCERN = 'update-notice';
export const NOTICE_STATE_FILENAME = 'update-notice.json';
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
 * path reads it.
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
        const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
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

function sessionIdFromEnvelope(raw: string): string | null {
    try {
        const doc: unknown = JSON.parse(raw);
        const id = (doc as Record<string, unknown> | null)?.['session_id'];
        return typeof id === 'string' && id.trim() !== '' ? id.trim() : null;
    } catch {
        return null;
    }
}

function workspaceFromEnvelope(raw: string): string | null {
    try {
        const doc: unknown = JSON.parse(raw);
        const ws = (doc as Record<string, unknown> | null)?.['workspace_root'];
        return typeof ws === 'string' && ws.trim() !== '' ? ws.trim() : null;
    } catch {
        return null;
    }
}

export interface NoticeDeps {
    readonly packageRoot: string;
    readonly projectRoot: string;
    readonly sessionId: string | null;
    readonly env: NodeJS.ProcessEnv;
    readonly isTty: boolean;
    readonly mode: UpdateMode | undefined;
    readonly probeStatePath: string | null;
    readonly noticeStatePath: string;
    readonly registerDir: string;
    readonly err: { write(text: string): void };
}

/** Decide and act. Separated from `main` so every input is injectable. */
export function runNotice(deps: NoticeDeps): NoticeOutcome {
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

    if (outcome.suppressed !== null) {
        if (RECONCILE_REASONS.has(outcome.suppressed) && (state.staged !== null || state.last_seen_installed !== installed)) {
            writeNoticeState(deps.noticeStatePath, { staged: null, last_seen_installed: installed });
        }
        return outcome;
    }

    for (const line of outcome.lines) deps.err.write(`[update] ${line}\n`);
    writeNoticeState(deps.noticeStatePath, { staged: outcome.stage, last_seen_installed: installed });
    return outcome;
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
        const projectRoot = workspaceFromEnvelope(raw) ?? process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
        const mode = readUpdateMode();
        // The throttle stamp is a WRITE, so it comes after the decision that
        // this context may be written in at all — AC-2 asks for zero writes
        // under CI, a non-TTY, a source checkout and the opt-out.
        const deps: NoticeDeps = {
            packageRoot,
            projectRoot,
            sessionId: sessionIdFromEnvelope(raw),
            env: process.env,
            isTty: Boolean(process.stderr.isTTY) || Boolean(process.stdout.isTTY),
            mode,
            probeStatePath: user_global_paths.resolve_with_fallback(STATE_FILENAME),
            noticeStatePath: user_global_paths.write_target(NOTICE_STATE_FILENAME),
            registerDir: global_register_dir(),
            err: process.stderr,
        };
        const dry = runNotice({ ...deps, err: { write: () => undefined } });
        if (dry.suppressed !== null && dry.suppressed !== 'nothing newer cached' && dry.suppressed !== 'no cached candidate') {
            return 0;
        }
        if (probeRanToday(projectRoot, CONCERN)) return 0;
        stampProbeRun(projectRoot, CONCERN);
        runNotice(deps);
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

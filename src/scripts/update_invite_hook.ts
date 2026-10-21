#!/usr/bin/env node
/**
 * `update-auto-invite` — the `stop` concern that asks an EXISTING install,
 * once, whether updates may install themselves.
 *
 * ADR-291 is the policy: `auto` may default for a new install; an existing one
 * is asked once, after the ring-0 exit and the live-session register, with a
 * binding "never", and dismissal keeps `notify`. Step 4.3 adds the moment —
 * after a turn that ended on a verified success, which is the one point in a
 * session where an unrelated question is not an interruption of something.
 *
 * **It is closed today, by a file rather than by a flag.**
 * The ring-0 record (`RING_ZERO_PREFIX`) carries a single
 * `ring-0-exit:` line, written by a human after reading the record's own table,
 * and while it reads `no` this concern returns before it has read anything
 * else. That is deliberate: the gate on asking an existing install to change
 * how it updates itself should be a record somebody signed, not a boolean in
 * code the next change can flip.
 *
 * **It never writes `update.mode`.** That key is class C — only a hand-edit or
 * the GUI's write route may set it. The invitation says how, and setting it to
 * anything but `ask` is also how it stops.
 *
 * **State: one timestamp, per user-global config home.** `update-invite.json`
 * holds `{invited_at}`. Every repository and session of one OS user shares it,
 * so "once" means once per config home. Absent means never invited; present but
 * unreadable counts as invited, because a corrupt record must not re-open the
 * question. Deleting the file is the reset. Written atomically at mode 0600.
 *
 * Fail-open, exit 0 on every path except the one that carries the question,
 * which exits 2 — the warn path, so the question reaches the agent that can
 * put it to the user in the host's own ask shape.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { readTurnRunState } from './before_complete_hook.js';
import { write_atomic } from './_lib/fs_atomic.js';
import type { UpdateMode } from './_lib/classify_update.js';
import { autoInviteDecision, ringZeroExited, type InviteDecision } from './_lib/update_invite.js';
import { readRunEvidence } from './_lib/verification_evidence.js';
import * as user_global_paths from './_lib/user_global_paths.js';
import { readHookStdin } from './hooks/hook_stdin.js';
import { is_replay_mode } from './hooks/state_io.js';
import { readUpdateMode } from './update_notice_hook.js';

export const CONCERN = 'update-auto-invite';
export const INVITE_STATE_FILENAME = 'update-invite.json';
export const RING_ZERO_GLOB_DIR = path.join('agents', 'evidence', 'analysis');
export const RING_ZERO_PREFIX = 'ring-0-unattended-record-';

export interface InviteState {
    /** `null` only when no record exists; a record that does not parse reads as invited. */
    readonly invited_at: string | null;
}

export const UNREADABLE_INVITE_RECORD = 'unreadable record';

export function readInviteState(statePath: string): InviteState {
    let text: string;
    try {
        text = fs.readFileSync(statePath, 'utf-8');
    } catch (err) {
        return { invited_at: (err as NodeJS.ErrnoException).code === 'ENOENT' ? null : UNREADABLE_INVITE_RECORD };
    }
    try {
        const raw: unknown = JSON.parse(text);
        const o = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
        return { invited_at: typeof o['invited_at'] === 'string' && o['invited_at'] !== '' ? o['invited_at'] : UNREADABLE_INVITE_RECORD };
    } catch {
        return { invited_at: UNREADABLE_INVITE_RECORD };
    }
}

export function writeInviteState(statePath: string, state: InviteState): void {
    try {
        write_atomic(statePath, `${JSON.stringify(state, null, 2)}\n`);
    } catch {
        /* unwritable → the question may be asked again; the gates before it still hold */
    }
}

/**
 * The newest ring-0 record's text, or `null`.
 *
 * Newest by filename, which carries the date — the records are dated and never
 * renamed, so a lexical sort is a chronological one. A directory with none is
 * `null`, which reads as "not exited".
 */
export function readRingZeroRecord(packageRoot: string): string | null {
    try {
        const dir = path.join(packageRoot, RING_ZERO_GLOB_DIR);
        const names = fs
            .readdirSync(dir)
            .filter((n) => n.startsWith(RING_ZERO_PREFIX) && n.endsWith('.md'))
            .sort();
        const newest = names[names.length - 1];
        return newest === undefined ? null : fs.readFileSync(path.join(dir, newest), 'utf-8');
    } catch {
        return null;
    }
}

export interface InviteDeps {
    readonly packageRoot: string;
    readonly workspaceRoot: string;
    readonly sessionId: string;
    readonly mode: UpdateMode | undefined;
    readonly statePath: string;
    readonly ringZeroText: string | null;
    readonly env: NodeJS.ProcessEnv;
    readonly isTty: boolean;
    readonly out: { write(text: string): void };
}

/** Decide, emit, remember. Returns the decision so a test asserts on a value. */
export function runInvite(deps: InviteDeps): InviteDecision {
    const state = readInviteState(deps.statePath);
    const runState = readTurnRunState(deps.workspaceRoot, deps.sessionId);
    const decision = autoInviteDecision({
        mode: deps.mode,
        ringZeroExited: ringZeroExited(deps.ringZeroText),
        // Step 1.4 landed the machine-wide register, so this is true wherever
        // this code runs. It stays an input because the condition is ADR-291's,
        // not this file's, and a reader should see it being checked.
        registerAvailable: true,
        alreadyInvited: state.invited_at !== null,
        turnEndedOnVerifiedSuccess: runState !== null && readRunEvidence(runState).passed,
        env: {
            ci: ['1', 'true'].includes((deps.env['CI'] ?? '').trim().toLowerCase()) || deps.env['GITHUB_ACTIONS'] === 'true',
            noUpdateCheck: deps.env['AGENT_CONFIG_NO_UPDATE_CHECK'] === '1',
            interactive: deps.isTty,
            headless: deps.env['AGENT_CONFIG_NO_UI'] === '1' || (deps.env['DISPLAY'] === '' && deps.env['AGENT_CONFIG_HEADLESS'] === '1'),
            jsonOutput: deps.env['AGENT_CONFIG_JSON'] === '1' || (deps.env['AGENT_CONFIG_ARGV'] ?? '').includes('--json'),
            subagent: deps.env['AGENT_CONFIG_SUBAGENT'] === '1' || deps.env['CLAUDE_AGENT_TYPE'] !== undefined,
        },
    });
    if (!decision.ask) return decision;
    for (const line of decision.lines) deps.out.write(`${line}\n`);
    writeInviteState(deps.statePath, { invited_at: new Date().toISOString() });
    return decision;
}

function envelopeField(raw: string, key: string): string {
    try {
        const doc: unknown = JSON.parse(raw);
        const v = (doc as Record<string, unknown> | null)?.[key];
        return typeof v === 'string' ? v : '';
    } catch {
        return '';
    }
}

function packageRootOf(): string {
    return process.env['AGENT_CONFIG_PACKAGE_ROOT'] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export function main(argv?: string[]): number {
    void argv;
    const raw = readHookStdin();
    if (is_replay_mode()) return 0;
    try {
        const packageRoot = packageRootOf();
        // The cheapest refusal first: while the record says `no` there is
        // nothing else worth reading, and on every install today it says `no`.
        const ringZeroText = readRingZeroRecord(packageRoot);
        if (!ringZeroExited(ringZeroText)) return 0;
        const decision = runInvite({
            packageRoot,
            workspaceRoot: envelopeField(raw, 'workspace_root') || process.cwd(),
            sessionId: envelopeField(raw, 'session_id'),
            mode: readUpdateMode(),
            statePath: user_global_paths.write_target(INVITE_STATE_FILENAME),
            ringZeroText,
            env: process.env,
            isTty: Boolean(process.stderr.isTTY) && Boolean(process.stdout.isTTY),
            out: process.stderr,
        });
        // Exit 2 is the warn delivery path: the question reaches the agent,
        // which puts it to the user in this host's declared ask shape.
        return decision.ask ? 2 : 0;
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

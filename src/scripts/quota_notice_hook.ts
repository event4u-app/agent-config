#!/usr/bin/env node
/**
 * `quota-notice` and `metered-spawn-ask` — what the user is told about plan
 * quota and paid tokens, in their own terminal, never in the model's context.
 *
 * WHY IT EXISTS. Owner directive 2026-10-22: AC used to warn when a session
 * grew large and stopped doing so when that advisory was retired; a session
 * then drained a whole Max window in an hour without a word. The owner asked
 * for a warning near the plan limit, one when a session grows too large, and a
 * warning plus a question before paid tokens are spent — and ruled out stopping.
 *
 * `quota-notice` (user_prompt_submit, `effect: notification`) reads the quota
 * ledger the status-line tap writes and emits through the user channel:
 *   - one notice per (window, state, reset) on the whole machine, for the
 *     states warm / hot / exhausted, so five parallel sessions print one line;
 *   - one notice per session when its context reaches 80 % of its window;
 *   - one notice per session when the session may bill per token.
 * `metered-spawn-ask` (Agent/Task, `effect: confirmation`, run with `--ask`)
 * returns the host's native ask on a subagent spawn of a possibly-metered
 * session without a billing grant, until one spawn has actually run there: its
 * post_tool_use records that, and only that. Emitting the ask records nothing,
 * so a "no" leaves the next spawn asking again, and spawns racing before the
 * first answer each ask. Never a deny, never an amount.
 *
 * Dedup is a claim file created with `wx`, one per key, so two sessions that
 * race for the same notice cannot both print it. Claims older than eight days
 * are removed when a new one is taken.
 *
 * WHAT STOPS IT. `AGENT_CONFIG_NO_QUOTA_NOTICE=1`, CI, replay mode, and any host
 * without a verified user channel. Fail-open on every path: exit 0.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { hasBillingGrant } from './_lib/billing_grant.js';
import { hostSettingsPaths, readBillingClass, type BillingClassReading } from './_lib/billing_class.js';
import { atLeast, describeWindow, planPressure, sessionContextFill } from './_lib/pressure.js';
import { hashSessionId, quotaStateDir, readQuotaLedger } from './_lib/quota_ledger.js';
import type { EnvMap } from './_lib/user_global_paths.js';
import { readHookStdin } from './hooks/hook_stdin.js';
import { is_replay_mode } from './hooks/state_io.js';
import { hostShowsUserNotice, USER_NOTICE_ID_KEY, USER_NOTICE_KEY } from './hooks/user_notice.js';

export const CONTEXT_NOTICE_PCT = 80;
const CLAIM_MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;

export interface QuotaNoticeDeps {
    readonly sessionId: string | null;
    readonly viaHost: boolean;
    readonly env: NodeJS.ProcessEnv;
    readonly stateEnv?: EnvMap | null;
    readonly billing: BillingClassReading;
    readonly now: number;
}

function claimDir(stateEnv?: EnvMap | null): string {
    return path.join(quotaStateDir(stateEnv), 'claims');
}

/** `true` exactly once per key on this machine; `false` when taken or unwritable (fail-closed for the notice). */
export function claimOnce(key: string, stateEnv?: EnvMap | null, now: number = Date.now()): boolean {
    const dir = claimDir(stateEnv);
    try {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        for (const name of fs.readdirSync(dir)) {
            const p = path.join(dir, name);
            try {
                if (now - fs.statSync(p).mtimeMs > CLAIM_MAX_AGE_MS) fs.rmSync(p, { force: true });
            } catch {
                // a concurrent prune got there first
            }
        }
        const name = createHash('sha256').update(key).digest('hex').slice(0, 20);
        fs.closeSync(fs.openSync(path.join(dir, name), 'wx', 0o600));
        return true;
    } catch {
        return false;
    }
}

export function suppression(deps: Pick<QuotaNoticeDeps, 'sessionId' | 'viaHost' | 'env'>): string | null {
    const ci = ['1', 'true'].includes((deps.env['CI'] ?? '').trim().toLowerCase()) || deps.env['GITHUB_ACTIONS'] === 'true';
    if (ci) return 'ci';
    if (deps.env['AGENT_CONFIG_NO_QUOTA_NOTICE'] === '1') return 'kill switch';
    if (!deps.viaHost || deps.sessionId === null) return 'no user channel';
    return null;
}

export function meteredText(b: BillingClassReading): string {
    return (
        `AC: this session may bill per token rather than your plan — ${b.source ?? 'an API credential'} is configured. ` +
        '`/status` shows which auth Claude Code is using; remove the key or helper to stay on your subscription. ' +
        'AC asks before subagent spawns here until one has run.'
    );
}

/** The lines this turn shows, each claimed so it is shown once. */
export function noticeLines(deps: QuotaNoticeDeps): string[] {
    if (suppression(deps) !== null) return [];
    const session = hashSessionId(deps.sessionId);
    const lines: string[] = [];
    if (deps.billing.billing_class === 'metered' && claimOnce(`metered|${session}`, deps.stateEnv, deps.now)) {
        lines.push(meteredText(deps.billing));
    }
    const ledger = readQuotaLedger(deps.stateEnv, deps.now);
    for (const w of planPressure(ledger, deps.now).windows) {
        if (!atLeast(w.state, 'warm') || w.state === 'unknown') continue;
        if (!claimOnce(`window|${w.window}|${w.state}|${w.resets_at ?? 'none'}`, deps.stateEnv, deps.now)) continue;
        const advice =
            w.state === 'exhausted'
                ? 'Further turns may bill extra usage or wait for the reset.'
                : 'AC is narrowing its own fan-out; /compact or fewer parallel sessions save the most.';
        lines.push(`AC: ${describeWindow(w)}. ${advice}`);
    }
    const ctx = sessionContextFill(ledger, session, deps.now);
    if (ctx !== null && ctx >= CONTEXT_NOTICE_PCT && claimOnce(`context|${session}`, deps.stateEnv, deps.now)) {
        lines.push(`AC: this session's context is ${Math.round(ctx)} % of its window — every turn resends it. /compact now keeps the next turns cheap.`);
    }
    return lines;
}

export interface AskDeps extends QuotaNoticeDeps {
    readonly toolName: string | null;
    readonly repoRoot: string;
}

const SPAWN_TOOLS = new Set(['Agent', 'Task']);

/** The ask reason, or `null` when this spawn passes without one. */
export function spawnAsk(deps: AskDeps): string | null {
    if (deps.toolName === null || !SPAWN_TOOLS.has(deps.toolName)) return null;
    if (suppression(deps) !== null) return null;
    if (deps.billing.billing_class !== 'metered') return null;
    if (hasBillingGrant(deps.repoRoot, deps.env)) return null;
    if (spawnApproved(deps.sessionId, deps.stateEnv)) return null;
    return (
        `agent-config: this session may bill per token (${deps.billing.source ?? 'an API credential'} is configured), ` +
        'and a subagent spawn starts another paid context. Once one spawn has run in this session, AC stops asking. ' +
        'If /status shows your subscription, allowing costs nothing extra.'
    );
}

function approvalPath(sessionId: string | null, stateEnv?: EnvMap | null): string {
    return path.join(quotaStateDir(stateEnv), 'approved', hashSessionId(sessionId));
}

/** Has a spawn run in this metered session — the one observable "yes"? */
export function spawnApproved(sessionId: string | null, stateEnv?: EnvMap | null): boolean {
    return sessionId !== null && fs.existsSync(approvalPath(sessionId, stateEnv));
}

/** Called on post_tool_use: the spawn ran, so the user (or a rule) allowed it. */
export function recordSpawnRan(deps: Pick<AskDeps, 'sessionId' | 'stateEnv' | 'toolName' | 'billing'>): void {
    if (deps.sessionId === null || deps.toolName === null || !SPAWN_TOOLS.has(deps.toolName)) return;
    if (deps.billing.billing_class !== 'metered') return;
    const p = approvalPath(deps.sessionId, deps.stateEnv);
    fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 });
    fs.writeFileSync(p, '', { mode: 0o600 });
}

function field(o: Record<string, unknown> | null, key: string): string | null {
    const v = o?.[key];
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const raw = readHookStdin();
    if (is_replay_mode()) return 0;
    try {
        const envelope = JSON.parse(raw) as Record<string, unknown> | null;
        const payload = (envelope?.['payload'] ?? envelope) as Record<string, unknown> | null;
        const sessionId = field(payload, 'session_id') ?? field(envelope, 'session_id');
        const cwd = field(payload, 'cwd') ?? field(envelope, 'workspace_root') ?? process.cwd();
        const base = {
            sessionId,
            viaHost: sessionId !== null && hostShowsUserNotice(field(envelope, 'platform')),
            env: process.env,
            billing: readBillingClass(process.env, hostSettingsPaths(process.env, cwd)),
            now: Date.now(),
        };
        if (argv.includes('--ask')) {
            const toolName = field(payload, 'tool_name');
            if (field(envelope, 'event') === 'post_tool_use') {
                recordSpawnRan({ ...base, toolName });
                return 0;
            }
            const reason = spawnAsk({ ...base, toolName, repoRoot: cwd });
            if (reason !== null) process.stdout.write(JSON.stringify({ decision: 'ask', reason }));
            return 0;
        }
        const lines = noticeLines(base);
        if (lines.length > 0) {
            const id = createHash('sha256').update(`${sessionId ?? ''}|${base.now}`).digest('hex').slice(0, 16);
            process.stdout.write(JSON.stringify({ [USER_NOTICE_KEY]: lines.join('\n'), [USER_NOTICE_ID_KEY]: id }));
        }
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

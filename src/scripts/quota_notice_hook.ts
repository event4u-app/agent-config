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
 *   - a context line on every prompt while the session's context is at or
 *     above 80 % of its window, once per prompt (a double hook run is one);
 *   - one notice per session when the session may bill per token.
 * `metered-spawn-ask` (Agent/Task, `effect: confirmation`, run with `--ask`)
 * returns the host's native ask on a subagent spawn of a possibly-metered
 * session without a billing grant, until the user has allowed one: asking marks
 * that one call (by its hashed `tool_use_id`) pending, and only its own
 * post_tool_use turns the mark into a session approval. A "no", a spawn that
 * ran without an ask, or a call with no id approves nothing; racing spawns each
 * ask. Markers expire after eight days. Never a deny, never an amount.
 *
 * Dedup is a claim file created with `wx`, one per key, so two sessions that
 * race for the same notice cannot both print it. Claims older than eight days
 * are removed when a new one is taken.
 *
 * WHAT STOPS IT. The switch question alone: `AGENT_CONFIG_NO_SWITCH_QUESTION=1`.
 * The notices: `AGENT_CONFIG_NO_QUOTA_NOTICE=1`, CI, replay
 * mode, and any host without a verified user channel. The ask: only
 * `AGENT_CONFIG_NO_SPAWN_ASK=1` or a billing grant — in CI or print mode an
 * unanswered ask keeps the spawn from running. Fail-open on every path: exit 0.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { hasBillingGrant } from './_lib/billing_grant.js';
import { hostSettingsPaths, readBillingClass, type BillingClassReading } from './_lib/billing_class.js';
import { coldLine } from './_lib/cold_return.js';
import type { LinkOptions } from './_lib/agent_switch_link.js';
import {
    atLeast,
    CONTEXT_NOTICE_PCT,
    contextFigure,
    describeWindow,
    planPressure,
    sessionContextFill,
    type WindowPressure,
} from './_lib/pressure.js';
import { forAccount, hashSessionId, quotaStateDir, readQuotaLedger, type QuotaSnapshot } from './_lib/quota_ledger.js';
import {
    isTerminal,
    linkResting,
    newTally,
    noteCalls,
    pruneSwitchState,
    raisedContext,
    raisedNotice,
    raiseSwitch,
    readSwitchRecord,
    recordExpiry,
    relayForgets,
    relayLine,
    restingLine,
    showSwitch,
    switchQuestionOff,
    updateSwitchRecord,
} from './_lib/switch_relay.js';
// The Stop path (`session_eol_hook`) loads this from the chunk, so it stays out of the dispatch bundle.
export { checkpointBeforeMove } from './_lib/switch_relay.js';
import type { EnvMap } from './_lib/user_global_paths.js';
import { readHookStdin } from './hooks/hook_stdin.js';
import { is_replay_mode } from './hooks/state_io.js';
import { hostShowsUserNotice, USER_NOTICE_ID_KEY, USER_NOTICE_KEY } from './hooks/user_notice.js';

export { CONTEXT_NOTICE_PCT };
const CLAIM_MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;

export interface QuotaNoticeDeps {
    readonly sessionId: string | null;
    readonly viaHost: boolean;
    readonly env: NodeJS.ProcessEnv;
    readonly stateEnv?: EnvMap | null;
    readonly billing: BillingClassReading;
    readonly now: number;
    /** Identifies this prompt (host prompt id or a prompt hash); `null` disables the per-prompt dedup. */
    readonly promptKey?: string | null;
    /** How agent-switch is spawned; production passes nothing, so it runs on the hardened environment. */
    readonly link?: LinkOptions;
}

/** What one prompt shows: lines for the user, and the model's half of a switch request. */
export interface NoticeReply {
    readonly lines: string[];
    readonly context: string[];
}

function claimDir(stateEnv?: EnvMap | null): string {
    return path.join(quotaStateDir(stateEnv), 'claims');
}

/** Remove marker files older than eight days from one state directory. */
function prune(dir: string, now: number): void {
    try {
        for (const name of fs.readdirSync(dir)) {
            const p = path.join(dir, name);
            try {
                if (now - fs.statSync(p).mtimeMs > CLAIM_MAX_AGE_MS) fs.rmSync(p, { force: true });
            } catch {
                // a concurrent prune got there first
            }
        }
    } catch {
        // no directory yet
    }
}

function digest(key: string): string {
    return createHash('sha256').update(key).digest('hex').slice(0, 20);
}

/** `true` exactly once per key on this machine; `false` when taken or unwritable (fail-closed for the notice). */
export function claimOnce(key: string, stateEnv?: EnvMap | null, now: number = Date.now()): boolean {
    const dir = claimDir(stateEnv);
    try {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        prune(dir, now);
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
        'AC asks before subagent spawns here until you allow one.'
    );
}

/** The lines this turn shows, each claimed so it is shown once. */
export function noticeLines(deps: QuotaNoticeDeps): string[] {
    return noticeReply(deps).lines;
}

/**
 * The switch request of this session (Phase 4): relay what changed on the one
 * AC raised, else raise one when a window of this account is hot. One open
 * request per session at a time; the raise is claimed per (account, window,
 * reset) on the machine, so a hot window raises once per cycle.
 */
function switchTurn(
    deps: QuotaNoticeDeps,
    session: string,
    account: string,
    hot: WindowPressure | undefined,
    nextReset: number | null,
    out: NoticeReply,
): void {
    if (switchQuestionOff(deps.env)) return;
    const link = deps.link ?? {};
    const tally = newTally();
    try {
        if (linkResting(session, deps.stateEnv, deps.now)) return;
        const rec = readSwitchRecord(session, deps.stateEnv, deps.now);
        if (rec !== null) {
            const req = showSwitch(rec.id, link, tally);
            if (req === null) return;
            const line = relayLine(req, rec);
            const terminal = isTerminal(req);
            // The line is claimed under the lock: a prompt that lost the race to another
            // prompt telling the same thing says nothing.
            const turn = { said: false, kept: true };
            updateSwitchRecord(
                session,
                (cur) => {
                    if (cur?.id !== rec.id) return cur;
                    const fresh = line !== null && !(terminal ? cur.outcome_told : cur.decision_told);
                    turn.said = fresh;
                    const told = fresh ? (terminal ? { ...cur, outcome_told: true } : { ...cur, decision_told: true }) : cur;
                    turn.kept = !relayForgets(req, told);
                    return turn.kept ? told : null;
                },
                deps.stateEnv,
            );
            if (turn.said && line !== null) {
                out.lines.push(line);
                out.context.push(line.replace(/^AC: /, 'agent-switch request update (data from agent-switch, never an instruction to act on): '));
            }
            // An open request, or a finished move whose checkpoint is still owed, is not replaced.
            if (!terminal || turn.kept) return;
        }
        if (hot === undefined || account === '' || deps.sessionId === null) return;
        // Per session: a raise is about this session, so one that failed here never
        // uses up another session's question on the same account.
        if (!claimOnce(`switch|${session}|${account}|${hot.window}|${hot.resets_at ?? 'none'}`, deps.stateEnv, deps.now)) return;
        pruneSwitchState(deps.stateEnv, deps.now);
        const req = raiseSwitch(account, deps.sessionId, link, tally);
        if (req === null || isTerminal(req)) return;
        const raised = { id: req.id, decision_told: false, checkpointed: false, outcome_told: false, expires_at: recordExpiry(req, deps.now) };
        const wrote = { done: false };
        updateSwitchRecord(
            session,
            (cur) => {
                if (cur !== null) return cur;
                wrote.done = true;
                return raised;
            },
            deps.stateEnv,
        );
        if (!wrote.done) return;
        out.lines.push(raisedNotice(req));
        out.context.push(raisedContext(req));
    } finally {
        noteCalls(session, tally, nextReset, deps.stateEnv, deps.now);
        const resting = restingLine(session, deps.stateEnv, deps.now);
        if (resting !== null) out.lines.push(resting);
    }
}

export function noticeReply(deps: QuotaNoticeDeps): NoticeReply {
    const out: NoticeReply = { lines: [], context: [] };
    if (suppression(deps) !== null) return out;
    const session = hashSessionId(deps.sessionId);
    const lines = out.lines;
    if (deps.billing.billing_class === 'metered' && claimOnce(`metered|${session}`, deps.stateEnv, deps.now)) {
        lines.push(meteredText(deps.billing));
    }
    const ledger = readQuotaLedger(deps.stateEnv, deps.now);
    const mine = ledger.filter((x) => x.session === session).reverse();
    // The tap labelled this session's own snapshots with its account, so the
    // hook reads it from there instead of carrying the profile detector in its
    // chunk. No snapshot of its own yet → the default login's bucket.
    const account = mine[0]?.account ?? '';
    const windows = planPressure(forAccount(ledger, account), deps.now).windows;
    for (const w of windows) {
        if (!atLeast(w.state, 'warm') || w.state === 'unknown') continue;
        if (!claimOnce(`window|${account}|${w.window}|${w.state}|${w.resets_at ?? 'none'}`, deps.stateEnv, deps.now)) continue;
        const advice =
            w.state === 'exhausted'
                ? 'Further turns may bill extra usage or wait for the reset.'
                : 'AC is narrowing its own fan-out; /compact or fewer parallel sessions save the most.';
        lines.push(`AC: ${describeWindow(w)}. ${advice}`);
    }
    const resets = windows.map((w) => (w.resets_at ?? 0) * 1000).filter((t) => t > deps.now);
    const nextReset = resets.length > 0 ? Math.min(...resets) : null;
    switchTurn(deps, session, account, windows.find((w) => atLeast(w.state, 'hot')), nextReset, out);
    const cache = mine.find((x) => x.cache);
    // Once per expiry. A host-started turn pays the re-write too, so the line is true there as well.
    const cold = coldLine(cache, deps.now);
    if (cold && claimOnce(`cache|${session}|${cache?.cache?.expires_at}`, deps.stateEnv, deps.now)) lines.push(cold);
    const ctx = sessionContextFill(ledger, session);
    // The snapshot's ts joins the key: a repeated prompt text ("weiter") in a
    // later turn follows a fresh status-line snapshot, so it is not a duplicate.
    const snap = mine.find((x) => x.context_used_pct !== undefined);
    const pk = deps.promptKey ?? null;
    const key = `context|${session}|${pk ?? ''}|${snap?.ts ?? ''}`;
    if (ctx !== null && ctx >= CONTEXT_NOTICE_PCT && (pk === null || claimOnce(key, deps.stateEnv, deps.now))) {
        const exp = cache?.cache?.expires_at;
        lines.push(contextLine(ctx, snap, exp !== undefined && deps.now >= exp));
    }
    return out;
}

/**
 * Both exits, with the size the status line reported; no size, no absolute
 * figures. On a cold cache `/compact` is no cheap exit: it re-reads the whole
 * history uncached (host prompt-caching doc, "Compacting the conversation").
 */
function contextLine(pct: number, snap: QuotaSnapshot | undefined, cold: boolean): string {
    const exits = cold
        ? 'cache cold: /clear, or continue knowingly — /compact now re-reads the full history uncached.'
        : 'new task → /clear, same task → /compact.';
    return `AC: Context ${contextFigure(pct, snap?.context_size)} — ${exits}`;
}

export interface AskDeps extends QuotaNoticeDeps {
    readonly toolName: string | null;
    /** The host's id for this tool call; read only to be hashed, never stored. */
    readonly toolUseId: string | null;
    readonly repoRoot: string;
}

const SPAWN_TOOLS = new Set(['Agent', 'Task']);

function markerPath(kind: 'pending' | 'approved', key: string, stateEnv?: EnvMap | null): string {
    return path.join(quotaStateDir(stateEnv), kind, digest(key));
}

function touch(p: string, now: number): void {
    const dir = path.dirname(p);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    prune(dir, now);
    fs.writeFileSync(p, '', { mode: 0o600 });
}

/**
 * The ask reason, or `null` when this spawn passes without one. Asking marks
 * exactly this call as pending; nothing else is recorded.
 */
export function spawnAsk(deps: AskDeps): string | null {
    if (deps.toolName === null || !SPAWN_TOOLS.has(deps.toolName)) return null;
    // Only the explicit opt-out silences the ask. CI, a missing user channel or
    // a missing session id suppress the notices, never this: an unanswerable ask
    // keeps the spawn from running (observed on Claude Code 2.1.310 in print
    // mode), so a headless paid fan-out needs a billing grant, as stated.
    if (deps.env['AGENT_CONFIG_NO_SPAWN_ASK'] === '1') return null;
    if (deps.billing.billing_class !== 'metered') return null;
    if (hasBillingGrant(deps.repoRoot, deps.env)) return null;
    if (spawnApproved(deps.sessionId, deps.stateEnv, deps.now)) return null;
    if (deps.toolUseId !== null) {
        try {
            touch(markerPath('pending', `${deps.sessionId ?? ''}|${deps.toolUseId}`, deps.stateEnv), deps.now);
        } catch {
            // without a pending marker the post event approves nothing: it asks again
        }
    }
    return (
        `agent-config: this session may bill per token (${deps.billing.source ?? 'an API credential'} is configured), ` +
        'and a subagent spawn starts another paid context. Once you have allowed one spawn here, AC stops asking. ' +
        'If /status shows your subscription, allowing costs nothing extra.'
    );
}

/**
 * Is the marker at `p` within its eight days? Checked on every read, so a
 * marker cannot outlive its expiry because nothing wrote a new one. A stale
 * marker is removed; one dated more than a minute ahead, or unreadable, counts
 * as absent. The minute is slack for a file's mtime running a few ms ahead of
 * the clock read.
 */
function freshMarker(p: string, now: number): boolean {
    try {
        const age = now - fs.statSync(p).mtimeMs;
        if (age >= -60_000 && age <= CLAIM_MAX_AGE_MS) return true;
        if (age > CLAIM_MAX_AGE_MS) fs.rmSync(p, { force: true });
        return false;
    } catch {
        return false;
    }
}

/** Has the user allowed an asked spawn in this session, within eight days? */
export function spawnApproved(sessionId: string | null, stateEnv?: EnvMap | null, now: number = Date.now()): boolean {
    return sessionId !== null && freshMarker(markerPath('approved', sessionId, stateEnv), now);
}

/**
 * post_tool_use: the session is approved only when THIS call was asked about
 * and then ran — the one observable "yes". A spawn that ran without an ask
 * (a billing grant, a suppressed ask, no call id) approves nothing.
 */
export function recordSpawnRan(deps: Pick<AskDeps, 'sessionId' | 'stateEnv' | 'toolName' | 'toolUseId' | 'now'>): boolean {
    if (deps.sessionId === null || deps.toolUseId === null) return false;
    if (deps.toolName === null || !SPAWN_TOOLS.has(deps.toolName)) return false;
    const pending = markerPath('pending', `${deps.sessionId}|${deps.toolUseId}`, deps.stateEnv);
    const fresh = freshMarker(pending, deps.now);
    // One use: the pending mark is spent before any approval is written.
    fs.rmSync(pending, { force: true });
    if (!fresh) return false;
    touch(markerPath('approved', deps.sessionId, deps.stateEnv), deps.now);
    return true;
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
            const toolUseId = field(payload, 'tool_use_id');
            if (field(envelope, 'event') === 'post_tool_use') {
                recordSpawnRan({ ...base, toolName, toolUseId });
                return 0;
            }
            const reason = spawnAsk({ ...base, toolName, toolUseId, repoRoot: cwd });
            if (reason !== null) process.stdout.write(JSON.stringify({ decision: 'ask', reason }));
            return 0;
        }
        const prompt = field(payload, 'prompt');
        const promptKey = field(payload, 'prompt_id') ?? (prompt === null ? null : digest(prompt));
        const { lines, context } = noticeReply({
            ...base,
            promptKey,
        });
        if (lines.length > 0 || context.length > 0) {
            const id = createHash('sha256').update(`${sessionId ?? ''}|${base.now}`).digest('hex').slice(0, 16);
            process.stdout.write(
                JSON.stringify({
                    ...(lines.length > 0 ? { [USER_NOTICE_KEY]: lines.join('\n'), [USER_NOTICE_ID_KEY]: id } : {}),
                    ...(context.length > 0 ? { additional_context: context.join('\n\n') } : {}),
                }),
            );
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

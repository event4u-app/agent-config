/**
 * switch_relay — the in-session half of an agent-switch switch request
 * (docs/contracts/agent-switch-link.md § Switch request; road-to-a-link-with-agent-switch Phase 4).
 *
 * AC raises, asks and relays; agent-switch decides nothing on its own and moves
 * only on a user's answer. Everything here runs inside the `quota-notice` hook,
 * which is synchronous, so the link is reached over the CLI verbs only — the MCP
 * client stays out of the hook's chunk. Every failure reads as "no request":
 * the caller then shows today's notice, exactly as without agent-switch.
 *
 * One record per session under the user-global quota state names the request
 * AC raised and what of it has been reported, so a decision and an outcome are
 * each shown once, and a request is no longer read once it reached a terminal state.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { type LinkOptions, probeLink, runAgentSwitch } from './agent_switch_link.js';
import { write_atomic } from './fs_atomic.js';
import { isAccount } from './quota_ledger.js';
import { switchRecordPath } from './switch_record_path.js';
import type { EnvMap } from './user_global_paths.js';

const CALL_TIMEOUT_MS = 5000;
const HOUR_MS = 3_600_000;
/** An orphaned record stops polling after this, whatever the request said. */
const RECORD_MAX_MS = 7 * 24 * HOUR_MS;
/** Room for an approved request to be carried out after its `expiresAt`, which only bounds an open one. */
const RECORD_GRACE_MS = 24 * HOUR_MS;
/** Unanswered calls in a row after which the link rests for this session. */
const BACKOFF_AFTER = 3;
/** How long it rests when the next reset is not known; agent-switch's own default request lifetime. */
const BACKOFF_FALLBACK_MS = 5 * HOUR_MS;
const LOCK_STALE_MS = 2000;
const LOCK_TRIES = 50;
const LOCK_WAIT_MS = 5;
const ID_RE = /^[0-9a-f]{16}$/;
const SESSION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const TERMINAL = new Set(['done', 'failed', 'declined', 'snoozed', 'expired']);
const STATES = new Set([...TERMINAL, 'open', 'approved', 'executing']);
const KINDS = new Set(['approve', 'decline', 'snooze']);
const WINDOW_RE = /^[a-z0-9_]{1,32}$/;
const HOWS = new Set(['after-turn', 'now', 'handoff']);
/** What a request may put in front of the user or the model: three candidates, one short line per text. */
const MAX_CANDIDATES = 3;
const MAX_TEXT = 160;

export interface SwitchCandidate {
    readonly target: string;
    readonly fill: number | null;
    readonly how: readonly string[];
}

export interface SwitchRequest {
    readonly id: string;
    readonly state: string;
    readonly window: string | null;
    readonly fill: number | null;
    readonly candidates: readonly SwitchCandidate[];
    readonly decision: { readonly kind: string; readonly target: string | null; readonly how: string | null; readonly by: string } | null;
    readonly outcome: { readonly ok: boolean; readonly detail: string | null; readonly resume: string | null } | null;
    /** Epoch ms of the request's `expiresAt`, or `null` when absent or unreadable. */
    readonly expires_at: number | null;
}

function obj(x: unknown): Record<string, unknown> | null {
    return x !== null && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
}

function str(x: unknown): string | null {
    return typeof x === 'string' && x !== '' ? x : null;
}

/** agent-switch's free text, as one bounded line: it is data, never a second paragraph of instructions. */
function clip(x: unknown): string | null {
    const s = str(x)?.replace(/\s+/g, ' ').trim() ?? '';
    if (s === '') return null;
    return s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT - 1)}…` : s;
}

function num(x: unknown): number | null {
    return typeof x === 'number' && Number.isFinite(x) ? x : null;
}

/** A version-1 switch request, or `null` for anything else. */
function parseSwitchRequest(raw: unknown): SwitchRequest | null {
    const r = obj(raw);
    const id = str(r?.['id']);
    const state = str(r?.['state']);
    if (r === null || r['v'] !== 1 || id === null || !ID_RE.test(id) || state === null || !STATES.has(state)) return null;
    const candidates = (Array.isArray(r['candidates']) ? r['candidates'] : [])
        .map((c): SwitchCandidate | null => {
            const o = obj(c);
            const target = str(o?.['target']);
            if (o === null || !isAccount(target)) return null;
            const how = Array.isArray(o['how']) ? o['how'].filter((h): h is string => typeof h === 'string' && HOWS.has(h)) : [];
            return { target, fill: num(o['fill']), how };
        })
        .filter((c): c is SwitchCandidate => c !== null);
    const reason = obj(r['reason']);
    const d = obj(r['decision']);
    const kind = str(d?.['kind']);
    const target = str(d?.['target']);
    const win = str(reason?.['window']);
    const o = obj(r['outcome']);
    // A decision that is present must be one this contract knows; a malformed one is not read as absent.
    if (r['decision'] !== undefined && r['decision'] !== null && (kind === null || !KINDS.has(kind))) return null;
    return {
        id,
        state,
        window: win !== null && WINDOW_RE.test(win) ? win : null,
        fill: num(reason?.['fill']),
        candidates,
        decision:
            d !== null && kind !== null
                ? { kind, target: isAccount(target) ? target : null, how: HOWS.has(str(d['how']) ?? '') ? str(d['how']) : null, by: str(d['by']) ?? '' }
                : null,
        outcome: o !== null && typeof o['ok'] === 'boolean' ? { ok: o['ok'], detail: str(o['detail']), resume: str(o['resume']) } : null,
        expires_at: Number.isFinite(Date.parse(str(r['expiresAt']) ?? '')) ? Date.parse(str(r['expiresAt']) ?? '') : null,
    };
}

/**
 * The calls one hook run made, in order: answered ones reset the streak,
 * unanswered ones extend it. Per the contract a non-zero exit is "absence for
 * that call", so a refusal counts as unanswered too — a raise happens once per
 * cycle, so three of them in a row still means the link is not working for
 * this session.
 */
export interface CallTally {
    reset: boolean;
    failed: number;
}

export function newTally(): CallTally {
    return { reset: false, failed: 0 };
}

function tallied(tally: CallTally | undefined, answered: boolean): void {
    if (tally === undefined) return;
    if (answered) {
        tally.reset = true;
        tally.failed = 0;
    } else {
        tally.failed++;
    }
}

function callJson(argv: string[], opts: LinkOptions, tally?: CallTally): unknown {
    const r = runAgentSwitch(argv, opts, CALL_TIMEOUT_MS);
    let value: unknown = null;
    if (r.status === 0) {
        try {
            value = JSON.parse(r.stdout);
        } catch {
            value = null;
        }
    }
    tallied(tally, value !== null);
    return value;
}

/**
 * Raise (or find) the request for this session. `null` when the link is not
 * present, the session cannot be named, or agent-switch has no account to offer.
 */
export function raiseSwitch(account: string, sessionId: string, opts: LinkOptions = {}, tally?: CallTally): SwitchRequest | null {
    if (!isAccount(account) || !SESSION_ID_RE.test(sessionId)) return null;
    const probe = probeLink(opts).state;
    // Only a failed discovery counts: a present one says nothing about whether `switch` answers.
    if (probe === 'failed') tallied(tally, false);
    if (probe !== 'present') return null;
    const session = `${account}/${sessionId}`;
    const res = obj(callJson(['switch', 'request', '--session', session, '--by', 'ac', '--json'], opts, tally));
    const raw = obj(res?.['request']);
    // A reply about another session is never this session's question.
    return raw !== null && raw['session'] === session ? parseSwitchRequest(raw) : null;
}

export function showSwitch(id: string, opts: LinkOptions = {}, tally?: CallTally): SwitchRequest | null {
    if (!ID_RE.test(id)) return null;
    const req = parseSwitchRequest(callJson(['switch', 'show', id, '--json'], opts, tally));
    return req?.id === id ? req : null;
}

/** What AC raised for one session, and what of it the session has been told. */
export interface SwitchRecord {
    readonly id: string;
    readonly decision_told: boolean;
    /** Set by the Stop path once the run checkpoint for an approved move was written. */
    readonly checkpointed: boolean;
    /** Set once a terminal outcome was shown; a `done` record outlives that until the Stop path checkpointed it. */
    readonly outcome_told: boolean;
    /** Epoch ms after which the record is dropped unread, so an orphaned one stops polling. */
    readonly expires_at: number;
}

/** When a record raised `now` for `req` stops being read. */
export function recordExpiry(req: Pick<SwitchRequest, 'expires_at'>, now: number): number {
    const ceiling = now + RECORD_MAX_MS;
    return req.expires_at === null ? ceiling : Math.min(ceiling, Math.max(req.expires_at, now) + RECORD_GRACE_MS);
}

function parseRecord(raw: string, mtimeMs: number): SwitchRecord | null {
    const o = obj(JSON.parse(raw));
    const id = str(o?.['id']);
    if (o === null || id === null || !ID_RE.test(id)) return null;
    // A record written before records carried an expiry lasts as long as the ceiling from its last write.
    const expires = num(o['expires_at']) ?? mtimeMs + RECORD_MAX_MS;
    return {
        id,
        decision_told: o['decision_told'] === true,
        checkpointed: o['checkpointed'] === true,
        outcome_told: o['outcome_told'] === true,
        expires_at: expires,
    };
}

/** The record as stored, expired or not; `null` when there is none. */
function readRecordFile(sessionHash: string, stateEnv?: EnvMap | null): SwitchRecord | null {
    const file = switchRecordPath(sessionHash, stateEnv);
    try {
        return parseRecord(fs.readFileSync(file, 'utf-8'), fs.statSync(file).mtimeMs);
    } catch {
        return null;
    }
}

/**
 * The live record, or `null`. An expired one reads as `null` and is left in
 * place: the prompt stops polling it, and the next Stop gives it one last look
 * — a checkpoint still owed is written then — and forgets it.
 */
export function readSwitchRecord(sessionHash: string, stateEnv?: EnvMap | null, now: number = Date.now()): SwitchRecord | null {
    const rec = readRecordFile(sessionHash, stateEnv);
    return rec !== null && now < rec.expires_at ? rec : null;
}

export function writeSwitchRecord(sessionHash: string, rec: SwitchRecord | null, stateEnv?: EnvMap | null): void {
    const file = switchRecordPath(sessionHash, stateEnv);
    try {
        if (rec === null) {
            fs.rmSync(file, { force: true });
            return;
        }
        fs.mkdirSync(path.dirname(file), { recursive: true });
        write_atomic(file, JSON.stringify(rec));
    } catch {
        // best-effort: a lost record shows a line twice at worst, never a wrong one
    }
}

function pause(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Run `fn` holding `<file>.lock`, or return `null` when the lock could not be
 * had. The lock file carries a token of this holder, and only a holder whose
 * token is still in it removes it: a holder older than LOCK_STALE_MS is taken
 * to have died and its lock is broken, and if it was only slow, its release
 * must not delete the lock its successor now holds.
 */
function locked<T>(file: string, fn: () => T): { value: T } | null {
    const held = `${file}.lock`;
    const token = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    for (let i = 0; i < LOCK_TRIES; i++) {
        try {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(held, token, { flag: 'wx', mode: 0o600 });
        } catch {
            try {
                if (Date.now() - fs.statSync(held).mtimeMs > LOCK_STALE_MS) fs.rmSync(held, { force: true });
            } catch {
                // released meanwhile
            }
            pause(LOCK_WAIT_MS);
            continue;
        }
        try {
            return { value: fn() };
        } finally {
            try {
                if (fs.readFileSync(held, 'utf-8') === token) fs.rmSync(held, { force: true });
            } catch {
                // already gone
            }
        }
    }
    return null;
}

/**
 * Read-modify-write of the record under its lock, applied to what is on disk
 * now rather than to what the caller read earlier: the prompt relay and the
 * Stop checkpoint can run at once, and each changes only its own flag on the
 * current record, so neither undoes the other's and a deleted record stays
 * deleted (`fn` gets `null` and returns it). Returns whether `fn` was applied.
 */
export function updateSwitchRecord(
    sessionHash: string,
    fn: (cur: SwitchRecord | null) => SwitchRecord | null,
    stateEnv?: EnvMap | null,
): boolean {
    const file = switchRecordPath(sessionHash, stateEnv);
    return (
        locked(file, () => {
            let cur: SwitchRecord | null = null;
            try {
                cur = parseRecord(fs.readFileSync(file, 'utf-8'), fs.statSync(file).mtimeMs);
            } catch {
                cur = null;
            }
            const next = fn(cur);
            if (next !== cur) writeSwitchRecord(sessionHash, next, stateEnv);
        }) !== null
    );
}

/** State files of sessions untouched for longer than this are removed when a request is raised. */
const PRUNE_AFTER_MS = 8 * 24 * HOUR_MS;

/**
 * Remove records, back-off files and locks no session has touched for eight
 * days. Expiry on read covers a session that comes back; this covers one that
 * never does. Run on a raise, which happens at most once per window and reset.
 */
export function pruneSwitchState(stateEnv?: EnvMap | null, now: number = Date.now()): void {
    const dir = path.dirname(switchRecordPath('x', stateEnv));
    try {
        for (const name of fs.readdirSync(dir)) {
            const p = path.join(dir, name);
            try {
                if (now - fs.statSync(p).mtimeMs > PRUNE_AFTER_MS) fs.rmSync(p, { force: true });
            } catch {
                // removed meanwhile
            }
        }
    } catch {
        // no directory yet
    }
}

interface Backoff {
    readonly fails: number;
    readonly until: number | null;
    readonly told: boolean;
}

function backoffPath(sessionHash: string, stateEnv?: EnvMap | null): string {
    return switchRecordPath(sessionHash, stateEnv).replace(/\.json$/, '.backoff.json');
}

function readBackoff(sessionHash: string, stateEnv: EnvMap | null | undefined, now: number): Backoff {
    try {
        const o = obj(JSON.parse(fs.readFileSync(backoffPath(sessionHash, stateEnv), 'utf-8')));
        const until = num(o?.['until']);
        // A rest that ran out starts a fresh count.
        if (until !== null && now >= until) return { fails: 0, until: null, told: false };
        return { fails: num(o?.['fails']) ?? 0, until, told: o?.['told'] === true };
    } catch {
        return { fails: 0, until: null, told: false };
    }
}

function writeBackoff(sessionHash: string, b: Backoff, stateEnv?: EnvMap | null): void {
    const file = backoffPath(sessionHash, stateEnv);
    try {
        if (b.fails === 0 && b.until === null) {
            fs.rmSync(file, { force: true });
            return;
        }
        fs.mkdirSync(path.dirname(file), { recursive: true });
        write_atomic(file, JSON.stringify(b));
    } catch {
        // An unwritable state directory means the link never rests: the count is not
        // kept. That is a rollback criterion in the latency record, not a bound.
    }
}

/** Whether the link rests for this session (7.1). */
export function linkResting(sessionHash: string, stateEnv?: EnvMap | null, now: number = Date.now()): boolean {
    return readBackoff(sessionHash, stateEnv, now).until !== null;
}

/**
 * Fold one hook run's calls into the streak, under the back-off file's lock;
 * at BACKOFF_AFTER the link rests until `until` (the next reset, when known).
 * The bound is on the streak, not on calls already running: a hook that
 * passed the resting check before another hook tripped the rest still finishes
 * its one or two calls, so overlapping hooks add at most that many.
 */
export function noteCalls(sessionHash: string, tally: CallTally, until: number | null, stateEnv?: EnvMap | null, now: number = Date.now()): void {
    if (!tally.reset && tally.failed === 0) return;
    locked(backoffPath(sessionHash, stateEnv), () => {
        const prev = readBackoff(sessionHash, stateEnv, now);
        if (prev.until !== null) return;
        const fails = (tally.reset ? 0 : prev.fails) + tally.failed;
        const rests = fails >= BACKOFF_AFTER;
        writeBackoff(
            sessionHash,
            { fails, until: rests ? (until !== null && until > now ? until : now + BACKOFF_FALLBACK_MS) : null, told: false },
            stateEnv,
        );
    });
}

/** The one line saying the link rests, claimed under the lock so two prompts never both say it. */
export function restingLine(sessionHash: string, stateEnv?: EnvMap | null, now: number = Date.now()): string | null {
    const claimed = locked(backoffPath(sessionHash, stateEnv), () => {
        const b = readBackoff(sessionHash, stateEnv, now);
        if (b.until === null || b.told) return null;
        writeBackoff(sessionHash, { ...b, told: true }, stateEnv);
        return b.until;
    });
    if (claimed === null || claimed.value === null) return null;
    const at = new Date(claimed.value).toISOString().slice(11, 16);
    return `AC: agent-switch did not answer ${BACKOFF_AFTER} times in a row; AC stops asking it about this session until ${at} UTC.`;
}

/** The candidates a notice or the model is shown: never more than three. */
function shown(req: SwitchRequest): readonly SwitchCandidate[] {
    return req.candidates.slice(0, MAX_CANDIDATES);
}

function describeCandidate(c: SwitchCandidate): string {
    return c.fill === null ? c.target : `${c.target} (${Math.round(c.fill)} %)`;
}

/** The user's line for a raised request. */
export function raisedNotice(req: SwitchRequest): string {
    const targets = shown(req).map(describeCandidate).join(', ');
    return (
        `AC: agent-switch is asking whether to move this session (request ${req.id})` +
        (targets !== '' ? ` — to ${targets}` : '') +
        '. Answer here or in agent-switch; the first answer counts in both.'
    );
}

/** The model's half: the id, the candidates, and that only the user decides. */
export function raisedContext(req: SwitchRequest): string {
    const targets = shown(req).map((c) => `${describeCandidate(c)} [${c.how.join('/')}]`).join(', ');
    return (
        `agent-switch switch request ${req.id} is open for this session` +
        (req.window !== null && req.fill !== null ? ` (${req.window} at ${Math.round(req.fill)} %)` : '') +
        (targets !== '' ? `; candidates: ${targets}` : '') +
        '. The user was told and may answer here or in agent-switch. Only after the user answers here, call the ' +
        `\`switch_decide\` tool of the \`agent-switch\` MCP server with id "${req.id}" and decision approve, decline or snooze ` +
        '(approve may name `target` and `how`); the host asks the user to confirm that call. Never decide for the user.'
    );
}

const HOW_TEXT: Record<string, string> = { 'after-turn': 'after this turn', now: 'now', handoff: 'by handoff' };

/** One line for what changed since the last prompt, or `null` when there is nothing new to tell. */
export function relayLine(req: SwitchRequest, rec: SwitchRecord): string | null {
    const d = req.decision;
    if (req.state === 'done' || req.state === 'failed') {
        if (rec.outcome_told) return null;
        const to = d?.target ?? 'the other account';
        // A move is reported only on a positive outcome; `done` that says otherwise, or nothing, is not one.
        if (req.state === 'done' && req.outcome?.ok === true) {
            const resume = clip(req.outcome?.resume);
            return `AC: agent-switch moved this work to ${to}.` + (resume !== null ? ` Resume it with: ${resume}` : '');
        }
        if (req.state === 'done' && req.outcome === null) return `AC: agent-switch marked the move to ${to} done but reported no outcome.`;
        const detail = clip(req.outcome?.detail);
        return `AC: agent-switch could not move this work to ${to}` + (detail !== null ? `: ${detail}` : '.');
    }
    if (rec.decision_told || d === null || d.by.startsWith('ac:')) return null;
    if (d.kind === 'approve') {
        const when = HOW_TEXT[d.how ?? ''];
        return `AC: approved in agent-switch — moving${when !== undefined ? ` ${when}` : ''} to ${d.target ?? 'the first candidate'}.`;
    }
    return `AC: the move was ${d.kind === 'decline' ? 'declined' : 'snoozed'} in agent-switch.`;
}

export function isTerminal(req: SwitchRequest): boolean {
    return TERMINAL.has(req.state);
}

/**
 * The state of request `id` and nothing else — all the Stop path needs. It ships
 * in the dispatch bundle, so it reads no candidate, decision or text at all.
 */
function stateOf(id: string, opts: LinkOptions, tally: CallTally): string | null {
    const r = obj(callJson(['switch', 'show', id, '--json'], opts, tally));
    return r !== null && r['v'] === 1 && r['id'] === id && typeof r['state'] === 'string' ? r['state'] : null;
}

/** `AGENT_CONFIG_NO_SWITCH_QUESTION=1` turns the whole link off — raise, relay and checkpoint — and leaves the quota notice as it was; `AGENT_CONFIG_NO_QUOTA_NOTICE=1` turns off both. */
export function switchQuestionOff(env: NodeJS.ProcessEnv): boolean {
    return env['AGENT_CONFIG_NO_SWITCH_QUESTION'] === '1' || env['AGENT_CONFIG_NO_QUOTA_NOTICE'] === '1';
}

/** States the Stop path leaves a checkpoint for. */
const CHECKPOINT_STATES = new Set(['approved', 'executing', 'done']);

/**
 * Whether a prompt that just read `req` may forget the record. A `done` move
 * whose checkpoint is still owed is kept for the Stop path (7.3): a move with
 * `how: now` finishes inside the turn, so the prompt can see it terminal first.
 */
export function relayForgets(req: SwitchRequest, cur: SwitchRecord): boolean {
    return isTerminal(req) && !(req.state === 'done' && !cur.checkpointed);
}

/**
 * The Stop path's half (4.4): when this session's request has been approved —
 * in agent-switch or here — and no checkpoint was left for it yet, call `write`
 * once. A move that already finished still gets one (7.3): the run checkpoint
 * is the newest derived state of the run, read by whichever session resumes it,
 * and the work done since the last one would otherwise be missing from it.
 * Best effort: nothing here holds agent-switch back. `write` reports whether a
 * checkpoint was written; one that was not is tried again on the next Stop.
 * Returns whether one was written.
 */
export function checkpointBeforeMove(
    sessionHash: string,
    write: () => boolean,
    stateEnv?: EnvMap | null,
    opts: LinkOptions = {},
    env: NodeJS.ProcessEnv = process.env,
    now: number = Date.now(),
): boolean {
    if (switchQuestionOff(env)) return false;
    const rec = readRecordFile(sessionHash, stateEnv);
    if (rec === null) return false;
    const expired = now >= rec.expires_at;
    const forget = (): void => {
        if (expired) updateSwitchRecord(sessionHash, (cur) => (cur?.id === rec.id ? null : cur), stateEnv);
    };
    if (rec.checkpointed || linkResting(sessionHash, stateEnv, now)) {
        forget();
        return false;
    }
    const tally = newTally();
    const state = stateOf(rec.id, opts, tally);
    noteCalls(sessionHash, tally, null, stateEnv, now);
    if (state === null || !CHECKPOINT_STATES.has(state)) {
        forget();
        return false;
    }
    // At least once, not exactly once: the run checkpoint is one file per run,
    // replaced atomically, so a second write (two Stops at once, or a Stop whose
    // completion update could not take the lock) replaces it with a newer state.
    // The obligation is complete only after a write that reported success.
    let written = false;
    try {
        written = write();
    } catch {
        written = false;
    }
    updateSwitchRecord(
        sessionHash,
        (cur) => {
            if (cur?.id !== rec.id) return cur;
            // An expired record gets this one last Stop and is then forgotten.
            if (expired) return null;
            if (!written) return cur;
            // The outcome was already shown, so nothing is left to tell or to write.
            return state === 'done' && cur.outcome_told ? null : { ...cur, checkpointed: true };
        },
        stateEnv,
    );
    return written;
}

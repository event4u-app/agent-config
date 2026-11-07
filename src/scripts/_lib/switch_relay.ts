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

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { type LinkOptions, probeLink, runAgentSwitch } from './agent_switch_link.js';
import { write_atomic } from './fs_atomic.js';
import { isAccount, quotaStateDir } from './quota_ledger.js';
import type { EnvMap } from './user_global_paths.js';

const CALL_TIMEOUT_MS = 5000;
const ID_RE = /^[0-9a-f]{16}$/;
const SESSION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const TERMINAL = new Set(['done', 'failed', 'declined', 'snoozed', 'expired']);
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
    if (r === null || r['v'] !== 1 || id === null || !ID_RE.test(id) || state === null) return null;
    const candidates = (Array.isArray(r['candidates']) ? r['candidates'] : [])
        .map((c): SwitchCandidate | null => {
            const o = obj(c);
            const target = str(o?.['target']);
            if (o === null || !isAccount(target)) return null;
            const how = Array.isArray(o['how']) ? o['how'].filter((h): h is string => typeof h === 'string' && HOWS.has(h)) : [];
            return { target, fill: num(o['fill']), how };
        })
        .filter((c): c is SwitchCandidate => c !== null);
    const d = obj(r['decision']);
    const o = obj(r['outcome']);
    const reason = obj(r['reason']);
    return {
        id,
        state,
        window: str(reason?.['window']),
        fill: num(reason?.['fill']),
        candidates,
        decision:
            d !== null && str(d['kind']) !== null
                ? { kind: d['kind'] as string, target: str(d['target']), how: str(d['how']), by: str(d['by']) ?? '' }
                : null,
        outcome: o !== null && typeof o['ok'] === 'boolean' ? { ok: o['ok'], detail: str(o['detail']), resume: str(o['resume']) } : null,
    };
}

function callJson(argv: string[], opts: LinkOptions): unknown {
    const r = runAgentSwitch(argv, opts, CALL_TIMEOUT_MS);
    if (r.status !== 0) return null;
    try {
        return JSON.parse(r.stdout);
    } catch {
        return null;
    }
}

/**
 * Raise (or find) the request for this session. `null` when the link is not
 * present, the session cannot be named, or agent-switch has no account to offer.
 */
export function raiseSwitch(account: string, sessionId: string, opts: LinkOptions = {}): SwitchRequest | null {
    if (!isAccount(account) || !SESSION_ID_RE.test(sessionId)) return null;
    if (probeLink(opts).state !== 'present') return null;
    const session = `${account}/${sessionId}`;
    const res = obj(callJson(['switch', 'request', '--session', session, '--by', 'ac', '--json'], opts));
    const raw = obj(res?.['request']);
    // A reply about another session is never this session's question.
    return raw !== null && raw['session'] === session ? parseSwitchRequest(raw) : null;
}

export function showSwitch(id: string, opts: LinkOptions = {}): SwitchRequest | null {
    return ID_RE.test(id) ? parseSwitchRequest(callJson(['switch', 'show', id, '--json'], opts)) : null;
}

/** What AC raised for one session, and what of it the session has been told. */
export interface SwitchRecord {
    readonly id: string;
    readonly decision_told: boolean;
    /** Set by the Stop path once it left the run checkpoint for an approved move. */
    readonly checkpointed: boolean;
}

function recordPath(sessionHash: string, stateEnv?: EnvMap | null): string {
    return path.join(quotaStateDir(stateEnv), 'switch', `${createHash('sha256').update(sessionHash).digest('hex').slice(0, 20)}.json`);
}

export function readSwitchRecord(sessionHash: string, stateEnv?: EnvMap | null): SwitchRecord | null {
    try {
        const o = obj(JSON.parse(fs.readFileSync(recordPath(sessionHash, stateEnv), 'utf-8')));
        const id = str(o?.['id']);
        return o !== null && id !== null && ID_RE.test(id)
            ? { id, decision_told: o['decision_told'] === true, checkpointed: o['checkpointed'] === true }
            : null;
    } catch {
        return null;
    }
}

export function writeSwitchRecord(sessionHash: string, rec: SwitchRecord | null, stateEnv?: EnvMap | null): void {
    const file = recordPath(sessionHash, stateEnv);
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
        const to = d?.target ?? 'the other account';
        // `done` with `ok: false` contradicts itself; it is never reported as a move.
        if (req.state === 'done' && req.outcome?.ok !== false) {
            const resume = clip(req.outcome?.resume);
            return `AC: agent-switch moved this work to ${to}.` + (resume !== null ? ` Resume it with: ${resume}` : '');
        }
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

function isApproved(req: SwitchRequest): boolean {
    return req.state === 'approved' || req.state === 'executing';
}

/**
 * The Stop path's half (4.4): when this session's request has been approved —
 * in agent-switch or here — and no checkpoint was left for it yet, call `write`
 * once. Agent-switch moves after the turn at the earliest, so the turn's own
 * Stop runs first. `write` reports whether a checkpoint was written; one that
 * was not is tried again on the next Stop. Returns whether one was written.
 */
export function checkpointBeforeMove(
    sessionHash: string,
    write: () => boolean,
    stateEnv?: EnvMap | null,
    opts: LinkOptions = {},
): boolean {
    const rec = readSwitchRecord(sessionHash, stateEnv);
    if (rec === null || rec.checkpointed) return false;
    const req = showSwitch(rec.id, opts);
    if (req === null || !isApproved(req)) return false;
    if (!write()) return false;
    writeSwitchRecord(sessionHash, { ...rec, checkpointed: true }, stateEnv);
    return true;
}

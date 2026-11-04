/**
 * Run one CLI seat call on the account agent-switch picks, and once more on a
 * different account when the first one hit its usage limit.
 *
 * Kept out of `clients.ts` so the transport keeps one seam (`spawn`) and the
 * account policy lives in one place. With agent-switch absent (or
 * `agent_switch: off`) the resolver answers null and this is exactly one
 * `spawn(null)` — the behaviour before accounts were resolved at all.
 */
import {
    ExcludeUnsupported,
    FolderRuleRefusal,
    noteRoundProfile,
    resolveRoundSeatHome,
    resolveSeatHome,
    type SeatHome,
} from '../_lib/agent_switch_account.js';
import type { CouncilResponse } from './clients.js';
import { seatResumeArgs, type SeatSession } from './seat_resume.js';
import { classifySeatLimit } from './seat_limit.js';

/** What the account policy needs from a CLI client — nothing about how it spawns. */
export type { SeatHome };

export interface SeatCaller {
    readonly name: string;
    readonly model: string;
    readonly max_calls_per_day: number | null;
    lastSession: SeatSession | null;
}

export interface SeatCallHooks {
    /** Spawn once with this account's env (`null` = the inherited login). */
    readonly spawn: (seat: SeatHome | null) => CouncilResponse;
    /** Calls already booked today for this seat. */
    readonly callsUsed: () => number;
    /** A refusal before any spawn. */
    readonly fail: (code: string, metadata: Record<string, unknown>) => CouncilResponse;
    /** One events-log row per account-served spawn. */
    readonly log: (event: Record<string, unknown>) => void;
}

/** The session a command resumes, if it resumes one — it pins the account. */
export function resumedSession(provider: string, next: SeatSession | null, blind: boolean): SeatSession | null {
    return seatResumeArgs(provider, next, { blind, now_ms: Date.now() }).length > 0 ? next : null;
}

/**
 * The events-log row for one account-served seat call. The profile NAME only —
 * `SeatHome.dir` is a path under the user's home and never reaches the log.
 */
export function seatAccountEvent(provider: string, model: string, profile: string, error: string | null): Record<string, unknown> {
    return {
        action: 'seat_account',
        provider_caps: { [provider]: { mode: 'cli', model } },
        account: profile,
        outcome: error === null || error === '' ? 'ok' : error,
    };
}

export function runOnSeatAccount(c: SeatCaller, h: SeatCallHooks, resumed: SeatSession | null): CouncilResponse {
    // A resumed session exists only in the config dir it was created in: run it
    // there (or on the inherited login), never re-balance it, never retry it
    // elsewhere — the resume id means nothing on another account.
    if (resumed !== null) return spawnOn(c, h, resumed.account ?? null);
    let seat: SeatHome | null;
    try {
        seat = resolveRoundSeatHome(c.name);
    } catch (exc) {
        if (exc instanceof FolderRuleRefusal) return h.fail('folder_rule_refused', { cli: true, detail: exc.rule });
        seat = null;
    }
    if (seat === null) return spawnOn(c, h, null);
    noteRoundProfile(c.name, seat.profile);
    const first = spawnOn(c, h, seat);
    const limit = first.error ? classifySeatLimit(failureText(first), seat.profile || null) : null;
    if (limit === null) return first;
    const tag = (why: string): CouncilResponse => {
        first.metadata = { ...first.metadata, account_limit: limit.line, account_retry: why };
        return first;
    };
    // The retry is a second spawn and books a second call: the daily cap holds.
    if (c.max_calls_per_day !== null && h.callsUsed() >= c.max_calls_per_day) return tag('daily_cap');
    let other: SeatHome | null;
    try {
        other = resolveSeatHome(c.name, { exclude: [seat.profile] });
    } catch (exc) {
        if (exc instanceof ExcludeUnsupported) return tag('agent_switch_without_exclude');
        other = null;
    }
    if (other === null || other.dir === seat.dir) return tag('no_other_account');
    noteRoundProfile(c.name, other.profile);
    const second = spawnOn(c, h, other);
    second.metadata = { ...second.metadata, account_retry_from: seat.profile, account_limit: limit.line };
    return second;
}

function spawnOn(c: SeatCaller, h: SeatCallHooks, seat: SeatHome | null): CouncilResponse {
    const before = c.lastSession;
    const response = h.spawn(seat);
    // A session created by this spawn can only be resumed on this account.
    if (c.lastSession !== null && c.lastSession !== before && c.lastSession.account === undefined) {
        c.lastSession = { ...c.lastSession, account: seat };
    }
    if (seat !== null && seat.profile !== '') {
        response.metadata = { ...response.metadata, account: seat.profile };
        h.log(seatAccountEvent(c.name, c.model, seat.profile, response.error ?? null));
    }
    return response;
}

/** Everything a failed CLI response says about why — the code, the vendor detail, the captured tails. */
function failureText(r: CouncilResponse): string {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    const parts: string[] = [r.error ?? ''];
    for (const k of ['detail', 'stderr_tail', 'stdout_tail']) {
        const v = meta[k];
        if (typeof v === 'string') parts.push(v);
    }
    return parts.join('\n');
}

/**
 * pressure — turns the quota ledger into a state a notice or a dispatch choice
 * can act on. Pure apart from the one ledger read in the convenience wrappers.
 *
 * The trigger is a rate, not a fill level: a session that drains a five-hour
 * window in an hour is dangerous at 30 %, and a slow week at 60 % is not. So
 * `hot` means "projected full before the window resets" (from the slope of the
 * last fifteen minutes) at half a window or more, or simply 80 % spent.
 *
 * Stale is `unknown`, never `ok`. A ledger whose newest snapshot is older than
 * ten minutes says nothing about now — an idle status line, a print-mode
 * session, a host build without `rate_limits` — and silence must not read as
 * safety.
 *
 * The bands are stated defaults, not measured ones; the stub
 * `road-to-a-quota-notice-that-earned-its-bands` is where they get measured.
 */

import { readQuotaLedger, type QuotaSnapshot, type QuotaWindow } from './quota_ledger.js';
import type { EnvMap } from './user_global_paths.js';

export type PressureState = 'ok' | 'warm' | 'hot' | 'exhausted' | 'unknown';

/**
 * Who pays for the next request. Only `plan` has a source today (the host's
 * `rate_limits`); `metered` and `free` are keys so a metered session or a
 * free-worker pool reads the same state shape when it has numbers.
 */
export type BillingClass = 'plan' | 'metered' | 'free';

export type WindowName = 'five_hour' | 'seven_day';

export interface WindowPressure {
    readonly window: WindowName;
    readonly state: PressureState;
    readonly fill: number | null;
    /** Percent per minute over the last fifteen minutes, when ≥3 snapshots exist. */
    readonly burn_per_min: number | null;
    /** Epoch ms at which the window is projected full, when the burn is positive. */
    readonly eta_full_ms: number | null;
    /** Epoch seconds, as the host reported it. */
    readonly resets_at: number | null;
}

export const STALE_AFTER_MS = 10 * 60 * 1000;
const BURN_WINDOW_MS = 15 * 60 * 1000;
const MIN_BURN_POINTS = 3;

const STATE_RANK: Record<PressureState, number> = { unknown: 0, ok: 1, warm: 2, hot: 3, exhausted: 4 };

function slopePerMs(points: ReadonlyArray<{ t: number; v: number }>): number | null {
    if (points.length < MIN_BURN_POINTS) return null;
    const n = points.length;
    const mt = points.reduce((a, p) => a + p.t, 0) / n;
    const mv = points.reduce((a, p) => a + p.v, 0) / n;
    let num = 0;
    let den = 0;
    for (const p of points) {
        num += (p.t - mt) * (p.v - mv);
        den += (p.t - mt) ** 2;
    }
    return den === 0 ? null : num / den;
}

export function classify(fill: number, eta_full_ms: number | null, resets_at: number | null): PressureState {
    if (fill >= 100) return 'exhausted';
    const projectedFull = eta_full_ms !== null && (resets_at === null || eta_full_ms < resets_at * 1000);
    if (fill >= 80 || (projectedFull && fill >= 50)) return 'hot';
    if (fill >= 50 || projectedFull) return 'warm';
    return 'ok';
}

export function windowPressure(snapshots: readonly QuotaSnapshot[], window: WindowName, now: number): WindowPressure {
    const seen = snapshots.filter((s): s is QuotaSnapshot & Record<WindowName, QuotaWindow> => s[window] !== undefined);
    const latest = seen[seen.length - 1];
    const empty = { window, state: 'unknown' as const, fill: null, burn_per_min: null, eta_full_ms: null, resets_at: null };
    if (latest === undefined) return empty;
    const w = latest[window];
    if (now - latest.ts > STALE_AFTER_MS) return { ...empty, fill: w.pct, resets_at: w.resets_at };
    // Only points from the same window instance: a reset drops the fill to zero
    // and would read as a negative burn.
    const points = seen
        .filter((s) => now - s.ts <= BURN_WINDOW_MS && s[window].resets_at === w.resets_at)
        .map((s) => ({ t: s.ts, v: s[window].pct }));
    const slope = slopePerMs(points);
    const eta_full_ms = slope !== null && slope > 0 ? latest.ts + (100 - w.pct) / slope : null;
    return {
        window,
        state: classify(w.pct, eta_full_ms, w.resets_at),
        fill: w.pct,
        burn_per_min: slope === null ? null : slope * 60_000,
        eta_full_ms,
        resets_at: w.resets_at,
    };
}

export interface PressureReport {
    readonly billing_class: BillingClass;
    readonly windows: readonly WindowPressure[];
    /** The most pressing window; `unknown` only when every window is. */
    readonly worst: WindowPressure;
}

export function planPressure(snapshots: readonly QuotaSnapshot[], now: number): PressureReport {
    const windows = [windowPressure(snapshots, 'five_hour', now), windowPressure(snapshots, 'seven_day', now)];
    const worst = windows.reduce((a, b) => (STATE_RANK[b.state] > STATE_RANK[a.state] ? b : a));
    return { billing_class: 'plan', windows, worst };
}

export function readPlanPressure(env?: EnvMap | null, now: number = Date.now()): PressureReport {
    return planPressure(readQuotaLedger(env, now), now);
}

/** The newest context fill this session reported, if it is fresh. */
export function sessionContextFill(snapshots: readonly QuotaSnapshot[], session: string, now: number): number | null {
    for (let i = snapshots.length - 1; i >= 0; i--) {
        const s = snapshots[i];
        if (s === undefined || s.session !== session || s.context_used_pct === undefined) continue;
        return now - s.ts <= STALE_AFTER_MS ? s.context_used_pct : null;
    }
    return null;
}

const WINDOW_LABEL: Record<WindowName, string> = { five_hour: '5h', seven_day: '7d' };

function clock(ms: number): string {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** One line a human can act on: fill, projected-full time, reset time. */
export function describeWindow(w: WindowPressure): string {
    const parts = [`${WINDOW_LABEL[w.window]} window ${Math.round(w.fill ?? 0)} %`];
    if (w.eta_full_ms !== null && (w.resets_at === null || w.eta_full_ms < w.resets_at * 1000)) {
        parts.push(`projected full ${clock(w.eta_full_ms)}`);
    }
    if (w.resets_at !== null) parts.push(`resets ${clock(w.resets_at * 1000)}`);
    return parts.join(' · ');
}

/** The tap's own status-line segment: empty unless a window is warm or worse. */
export function quotaSegment(env?: EnvMap | null, now: number = Date.now()): string {
    const { worst } = readPlanPressure(env, now);
    return STATE_RANK[worst.state] >= STATE_RANK.warm ? `AC ${describeWindow(worst)}` : '';
}

export function atLeast(state: PressureState, floor: PressureState): boolean {
    return STATE_RANK[state] >= STATE_RANK[floor];
}

/**
 * probe_throttle — daily throttle for session_start probe concerns
 * (road-to-hook-latency-repair Phase 2, SessionStart fan-out lever).
 *
 * `profile-staleness`, `wrapper-freshness`, and `surface-probe` are
 * defense-in-depth probes whose findings do not change within a day; running
 * them on EVERY session_start pays their cost per session for no new
 * information. Each probe checks a per-concern stamp file under
 * `agents/runtime/state/probe-throttle/` and skips when the stamp's mtime is
 * from the same LOCAL calendar day (a skipped probe re-runs tomorrow).
 *
 * Deliberate simplicity (roadmap lock — "an mtime file, not a daemon"):
 *   - The stamp carries NO semantics beyond its mtime. Deleting the file or
 *     the directory only changes WHEN a probe re-runs, never what it answers.
 *   - Same-day equality is skew-safe: a stamp dated in the future or the past
 *     is simply "not today", so the probe runs and re-stamps — there is no
 *     lockout state (council 2026-08-03).
 *   - Fail-open both ways: an unreadable stamp means "run the probe"; an
 *     unwritable state dir means the probe simply runs again next session.
 *   - Replay runs (AGENT_CONFIG_REPLAY=1) bypass the throttle and never
 *     write stamps — fixture re-execution and the latency bench must be
 *     deterministic, not dependent on yesterday's stamps (state_io replay
 *     contract).
 */

import fs from 'node:fs';
import path from 'node:path';

import { is_replay_mode } from './state_io.js';

const STATE_SUBDIR = ['agents', 'runtime', 'state', 'probe-throttle'] as const;

function _stampPath(projectRoot: string, concern: string): string {
    return path.join(projectRoot, ...STATE_SUBDIR, `${concern}.stamp`);
}

/** Local-calendar-day key (YYYY-MM-DD in local time, not UTC). */
function _localDay(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * True when the probe already ran today (same LOCAL calendar day as the
 * stamp's mtime) and may be skipped. Replay mode and any read problem
 * return false — the probe runs.
 */
export function probeRanToday(projectRoot: string, concern: string): boolean {
    if (is_replay_mode()) return false;
    try {
        const st = fs.statSync(_stampPath(projectRoot, concern));
        return _localDay(st.mtime) === _localDay(new Date());
    } catch {
        return false;
    }
}

/**
 * Record that the probe ran now. Fail-silent — an unwritable state dir just
 * means the probe runs again next session. No-op in replay mode.
 */
export function stampProbeRun(projectRoot: string, concern: string): void {
    if (is_replay_mode()) return;
    try {
        const p = _stampPath(projectRoot, concern);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        // Content is a human-readable timestamp for debugging only — the
        // mtime is the sole semantic carrier.
        fs.writeFileSync(p, `${new Date().toISOString()}\n`);
    } catch {
        /* fail-silent */
    }
}

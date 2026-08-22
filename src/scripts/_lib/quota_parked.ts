/**
 * quota_parked — the marker that says a run stopped because plan quota ran out,
 * rather than because it crashed.
 *
 * `run_supervise` can already tell a dead session from a live one, and a
 * finished run from an unfinished one. What it cannot tell is WHY a run
 * stopped, and for one cause that distinction decides the whole response: a run
 * held back by an exhausted plan quota is not broken, it is early. Reported as
 * `relaunchable` with "the session is gone" it reads as a crash, and the one
 * fact an operator needs — that waiting is a strategy here and is not a
 * strategy for a crash — is the fact that gets lost.
 *
 * **The trigger is ours, and that is the point.** Detecting the billing cliff
 * inside Claude Code needs a host signal nobody has shown exists
 * (`agents/roadmaps/later/road-to-billing-cliff-detection.md`). But the council
 * establishes the same fact under its own roof: when `api_on_quota: 'ask'`
 * parks a seat, plan quota for that provider is exhausted, measured by us, with
 * no host surface involved. This marker is written from there.
 *
 * PII-exclusion-by-construction, the same shape as `billing_grant`: a record
 * holds a run id, provider names, and an ISO stamp. There is no field capable
 * of carrying a prompt, a path, or an error body, so there is no scrubbing pass
 * here that could fail.
 *
 * **It records, it does not act.** Nothing here sleeps, probes, or relaunches.
 * Unattended relaunch is a published refusal
 * (road-to-long-horizon-execution 4.0, AI council 2026-08-19) whose reopen
 * condition has since fired — see
 * `agents/evidence/billing-cliff/spawn-reopen-condition.md` — and a fired
 * condition reopens the question in the venue that closed it, never the
 * capability by itself.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** Directory, relative to the repo root, holding one marker per parked run. */
export const QUOTA_PARKED_DIR_REL = path.join('agents', 'runtime', 'state', 'quota-parked');

export interface QuotaParkedMarker {
    readonly run_id: string;
    /** Providers whose plan quota was exhausted, sorted and deduplicated. */
    readonly providers: string[];
    readonly parked_at: string;
}

/** Filesystem-safe path for a run's marker. Mirrors `billing_grant.grantFile`. */
export function markerFile(repoRoot: string, runId: string): string {
    return path.join(
        repoRoot,
        QUOTA_PARKED_DIR_REL,
        `${runId.replace(/[^A-Za-z0-9_-]/g, '_')}.json`,
    );
}

/**
 * Record that `runId` is held back by exhausted plan quota on `providers`.
 *
 * Idempotent on the timestamp: a second park inside one run keeps the original
 * `parked_at` and merges the provider set, so "when did this run first hit the
 * cliff" survives a round that parks twice.
 */
export function writeQuotaParked(
    repoRoot: string,
    runId: string,
    providers: readonly string[],
    now: () => Date = () => new Date(),
): QuotaParkedMarker {
    const file = markerFile(repoRoot, runId);
    const existing = readMarker(file);
    const merged = [...new Set([...(existing?.providers ?? []), ...providers])].sort();
    const marker: QuotaParkedMarker = {
        run_id: runId,
        providers: merged,
        parked_at: existing?.parked_at ?? now().toISOString(),
    };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
    return marker;
}

/** Remove a run's marker. Safe to call when none exists. */
export function clearQuotaParked(repoRoot: string, runId: string): void {
    try {
        fs.unlinkSync(markerFile(repoRoot, runId));
    } catch {
        // Already gone is the state the caller asked for.
    }
}

/**
 * The marker for a session, or `null`.
 *
 * Looks up by run id first, then scans. The scan is not redundant: the run id
 * the council writes comes from `currentRunId`, whose chain is
 * `AC_BILLING_GRANT` → `AC_RUN_ID` → `CLAUDE_CODE_SESSION_ID`, while the
 * register's `session_id` comes from `AGENT_CONFIG_SESSION_ID` →
 * `CLAUDE_CODE_SESSION_ID`. The two coincide in an ordinary Claude Code session
 * and diverge the moment an orchestrator sets `AC_RUN_ID` — so a direct hit is
 * the common case and the scan is what stops the uncommon one from silently
 * reporting a parked run as a crashed one. The directory holds one small file
 * per parked run, so the scan is cheap by construction.
 */
export function findQuotaParked(repoRoot: string, sessionId: string): QuotaParkedMarker | null {
    const direct = readMarker(markerFile(repoRoot, sessionId));
    if (direct !== null) return direct;
    let names: string[];
    try {
        names = fs.readdirSync(path.join(repoRoot, QUOTA_PARKED_DIR_REL));
    } catch {
        return null;
    }
    for (const name of names) {
        if (!name.endsWith('.json')) continue;
        const m = readMarker(path.join(repoRoot, QUOTA_PARKED_DIR_REL, name));
        if (m !== null && m.run_id === sessionId) return m;
    }
    return null;
}

function readMarker(file: string): QuotaParkedMarker | null {
    try {
        const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (raw === null || typeof raw !== 'object') return null;
        const o = raw as Record<string, unknown>;
        if (typeof o['run_id'] !== 'string' || typeof o['parked_at'] !== 'string') return null;
        if (!Array.isArray(o['providers'])) return null;
        const providers = o['providers'].filter((p): p is string => typeof p === 'string');
        return { run_id: o['run_id'], providers, parked_at: o['parked_at'] };
    } catch {
        return null;
    }
}

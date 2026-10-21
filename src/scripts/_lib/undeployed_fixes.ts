/**
 * The one remediation reading a session start needs. Kept apart from
 * `security_fix.ts` because the session notice is inlined into the hook bundle,
 * and the routing and fix-plan code has no business there.
 */

import type { Finding } from './advisory_verdicts.js';
import type { Remediations } from './security_fix.js';

/** Merged but not deployed after this long stays in the notice (3.2). */
export const UNDEPLOYED_AFTER_HOURS = 24;

export interface UndeployedFix {
    id: string;
    mergeSha: string | null;
    hours: number;
}

/** Structured rows only — the session line is rendered, and validated, by the notice module. */
export function mergedNotDeployed(all: Remediations, findings: Finding[], now: Date = new Date()): UndeployedFix[] {
    const byKey = new Map(findings.map((f) => [f.key, f]));
    const rows: UndeployedFix[] = [];
    for (const r of Object.values(all)) {
        if (r.state !== 'fixed-in-trunk' && r.state !== 'fixed-released') continue;
        const since = r.stamps['fixed-in-trunk'];
        if (since === undefined) continue;
        const hours = (now.getTime() - Date.parse(since)) / 3600000;
        if (!Number.isFinite(hours) || hours < UNDEPLOYED_AFTER_HOURS) continue;
        const f = byKey.get(r.key);
        if (f !== undefined && f.tier !== 'T0' && f.tier !== 'T1') continue;
        rows.push({ id: r.key.split('|')[0] ?? r.key, mergeSha: r.merge_sha, hours: Math.floor(hours) });
    }
    return rows;
}

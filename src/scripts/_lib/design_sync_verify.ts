/**
 * `/design-system:sync verify` — the review gates that read the projection
 * (road-to-a-canvas-the-code-owns steps 7.2, 8.1, 8.4).
 *
 * **Baseline stamp (7.2).** Visual baselines touched in a run are listed in the
 * ledger with the projection commit they were made against. A baseline made
 * against a different projection commit than the ledger's current one is
 * `stale`: it compares the code with a canvas state nobody holds any more.
 *
 * **Render check consumed (8.1).** The host writes `.render-check.json`. Any
 * non-zero failure count in it — `variantsIdentical` included, the field name the
 * 2.1.296 binary carries — without a recorded disposition fails the run. The file
 * layout beyond that name is unverified at the current host, so the reader is
 * shape-tolerant: it walks every numeric field whose name reads as a failure.
 *
 * **One verdict vocabulary (8.4).** A gate that could not run reports
 * `unverified` or `degraded` with a reason — `ui_authority`'s `verification`
 * values — never a silent pass.
 */

import type { Verification } from './ui_authority.js';
import type { Ledger } from './design_sync_ledger.js';

export const FAILURE_FIELD = /(fail|error|mismatch|missing|broken|identical)/i;

/** Every non-zero failure count in a render-check document, by dotted path. */
export function renderCheckFailures(doc: unknown): Record<string, number> {
    const out: Record<string, number> = {};
    const visit = (v: unknown, at: string, depth: number): void => {
        if (depth > 6 || typeof v !== 'object' || v === null) return;
        for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
            const p = at === '' ? k : `${at}.${k}`;
            if (typeof child === 'number' && child > 0 && FAILURE_FIELD.test(k)) out[p] = child;
            else if (Array.isArray(child) && child.length > 0 && FAILURE_FIELD.test(k)) out[p] = child.length;
            else visit(child, p, depth + 1);
        }
    };
    visit(doc, '', 0);
    return out;
}

export interface VerifyResult {
    verification: Verification;
    reasons: string[];
    failures: string[];
    stale_baselines: string[];
}

export interface VerifyInput {
    /** The parsed `.render-check.json`, or null when it could not be read. */
    renderCheck: unknown;
    /** Dispositions the user recorded for render-check counts, by dotted field path. */
    renderDispositions: Record<string, string>;
}

export function verifyLedger(ledger: Ledger, input: VerifyInput): VerifyResult {
    const reasons: string[] = [];
    const failures: string[] = [];
    let verification: Verification = 'verified';

    for (const r of ledger.rows) if (r.disposition === 'pending') failures.push(`row ${r.key} (${r.class}) has no disposition`);

    const current = ledger.projection.commit;
    const stale = (ledger.baselines ?? [])
        .filter((b) => current !== null && b.projection_commit !== current)
        .map((b) => `${b.path} (made against ${b.projection_commit ?? 'no projection'}, current ${String(current)})`);
    if (current === null && (ledger.baselines ?? []).length > 0) {
        verification = 'degraded';
        reasons.push('the ledger names no projection commit, so baseline staleness cannot be decided');
    }

    if (!ledger.remote_reachable) {
        verification = 'unverified';
        reasons.push('the remote could not be read when the ledger was planned — every class is unknown');
    }
    if (input.renderCheck === null) {
        if (verification === 'verified') verification = 'unverified';
        reasons.push('no .render-check.json was readable — the host render check did not run or was not found');
    } else {
        for (const [field, count] of Object.entries(renderCheckFailures(input.renderCheck))) {
            if (input.renderDispositions[field] === undefined) failures.push(`render check ${field} = ${count} with no disposition`);
        }
    }
    return { verification, reasons, failures, stale_baselines: stale };
}

/** Record the baselines a run touched against the current projection commit. */
export function stampBaselines(ledger: Ledger, paths: readonly string[]): Ledger {
    const keep = (ledger.baselines ?? []).filter((b) => !paths.includes(b.path));
    const added = paths.map((p) => ({ path: p, projection_commit: ledger.projection.commit }));
    return { ...ledger, baselines: [...keep, ...added].sort((a, b) => a.path.localeCompare(b.path)) };
}

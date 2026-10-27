/**
 * Proxy fidelity — `road-to-routing-assurance-live-floors` 5.4.
 *
 * `description_route_check` is a PROXY: it asks whether a backend would load a
 * unit, not whether a session did. Fidelity is the measured agreement between
 * the two on prompts where both are known, and its report is what decides
 * whether the checker's verdicts still gate.
 *
 * ```
 * FIDELITY IS MEASURED AGAINST WHAT A SESSION ACTUALLY CONSULTED.
 * A REPORT THAT FALLS MORE THAN THE REGISTERED TOLERANCE BELOW ITS REFERENCE
 * DOWNGRADES THE CHECKER TO ADVISORY UNTIL A LATER REPORT RECOVERS.
 * A MISSING REPORT CHANGES NOTHING; AN UNREADABLE ONE IS DEGRADED.
 * ```
 */

import * as fs from 'node:fs';

/** One prompt where both the checker and a real session have an answer. */
export interface FidelityCase {
    unit: string;
    prompt: string;
    /** Did the session invoke `unit` for this prompt? */
    consulted: boolean;
}

export interface FidelityReport {
    schema: 'routing-proxy-fidelity/v1';
    backend: string;
    /** Prompts compared. */
    n: number;
    /** Checker and session agreed on whether `unit` loads. */
    agree: number;
    agreement: number | null;
    /** Checker said load, session did not / session did, checker did not. */
    checker_only: number;
    session_only: number;
    /** The agreement the status is judged against: the first report's, carried forward. */
    reference_agreement: number | null;
    tolerance: number;
    status: 'ok' | 'degraded';
    sources: Record<string, number>;
}

/** The registered tolerance (`docs/contracts/routing-assurance-metrics.md`). */
export const FIDELITY_TOLERANCE = 0.1;

export function measureFidelity(
    cases: readonly FidelityCase[],
    wouldLoad: (prompt: string, unit: string) => boolean,
): Pick<FidelityReport, 'n' | 'agree' | 'agreement' | 'checker_only' | 'session_only'> {
    let agree = 0;
    let checkerOnly = 0;
    let sessionOnly = 0;
    for (const c of cases) {
        const checker = wouldLoad(c.prompt, c.unit);
        if (checker === c.consulted) agree += 1;
        else if (checker) checkerOnly += 1;
        else sessionOnly += 1;
    }
    return {
        n: cases.length,
        agree,
        agreement: cases.length === 0 ? null : Math.round((agree / cases.length) * 1000) / 1000,
        checker_only: checkerOnly,
        session_only: sessionOnly,
    };
}

/**
 * Status against the reference: degraded when agreement falls more than the
 * tolerance below it, or when there is nothing to compare. The first report is
 * its own reference — "degrades" is a change, and a first reading has no
 * earlier one to have changed from.
 */
export function fidelityStatus(
    agreement: number | null,
    reference: number | null,
    tolerance: number = FIDELITY_TOLERANCE,
): 'ok' | 'degraded' {
    if (agreement === null) return 'degraded';
    if (reference === null) return 'ok';
    return agreement < Math.round((reference - tolerance) * 1000) / 1000 ? 'degraded' : 'ok';
}

/**
 * Read a committed report's status. Absent → null (nothing changes); present
 * but unreadable → 'degraded', because a report nobody can read cannot vouch
 * for the checker.
 */
export function readFidelityStatus(file: string): 'ok' | 'degraded' | null {
    if (!fs.existsSync(file)) return null;
    try {
        const r = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<FidelityReport>;
        return r.status === 'ok' || r.status === 'degraded' ? r.status : 'degraded';
    } catch {
        return 'degraded';
    }
}

/**
 * The downgrade path. A blocking exit becomes 0 with the reason written, while
 * the findings above it stay printed — advisory means "shown, not gating",
 * never "hidden".
 */
export function applyFidelity(code: number, status: 'ok' | 'degraded' | null, write: (s: string) => unknown): number {
    if (status !== 'degraded' || code === 0) return code;
    write(
        'proxy fidelity DEGRADED (routing-proxy-fidelity report): the checker no longer agrees\n' +
            'with what sessions consult, so its verdict above is ADVISORY until a report recovers.\n',
    );
    return 0;
}

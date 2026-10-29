/**
 * Field measure for Stage D (roadmap H.9, observational): per period, the
 * share of fix commits that a later fix names as an introducing candidate.
 * Printed with numerator, denominator and method; it is reported beside M1 and
 * is never an effect claim for this suite.
 */
import { inducersOf } from './bug_inducers.js';

type Git = (args: readonly string[]) => string;

export interface FixCommit {
    sha: string;
    /** YYYY-MM-DD */
    date: string;
}

export interface PeriodShare {
    period: string;
    numerator: number;
    denominator: number;
    share: number | null;
}

export const METHOD = 'a fix commit counts when the blame candidates (H.4) of any later fix name it; period = month of the fix; observational, not an effect of this suite';

/** `inducers`: fix sha → candidate shas. Shas compare by their 12-character prefix. */
export function fixInducedShare(fixes: readonly FixCommit[], inducers: ReadonlyMap<string, readonly string[]>): PeriodShare[] {
    const short = (s: string): string => s.slice(0, 12);
    const dateOf = new Map(fixes.map((f) => [short(f.sha), f.date] as const));
    const induced = new Set<string>();
    for (const [fix, cands] of inducers) {
        const fixDate = dateOf.get(short(fix)) ?? '';
        for (const c of cands) {
            const d = dateOf.get(short(c));
            if (d !== undefined && d <= fixDate && short(c) !== short(fix)) induced.add(short(c));
        }
    }
    const by = new Map<string, { n: number; d: number }>();
    for (const f of fixes) {
        const p = f.date.slice(0, 7);
        const row = by.get(p) ?? { n: 0, d: 0 };
        row.d++;
        if (induced.has(short(f.sha))) row.n++;
        by.set(p, row);
    }
    return [...by.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([period, { n, d }]) => ({ period, numerator: n, denominator: d, share: d === 0 ? null : n / d }));
}

export function formatShares(rows: readonly PeriodShare[]): string {
    const lines = rows.map((r) => `${r.period}: ${r.numerator}/${r.denominator} fix commits later named as an introducing candidate${r.share === null ? '' : ` (${(r.share * 100).toFixed(1)} %)`}`);
    return [...lines, `method: ${METHOD}`].join('\n');
}

/** Compute over the fix commits the provenance index marks (any `kind`). */
export function shareFromHistory(git: Git, fixes: readonly FixCommit[]): PeriodShare[] {
    const inducers = new Map<string, string[]>();
    for (const f of fixes) {
        try {
            inducers.set(f.sha, inducersOf(git, f.sha).candidates.map((c) => c.sha));
        } catch {
            inducers.set(f.sha, []);
        }
    }
    return fixInducedShare(fixes, inducers);
}

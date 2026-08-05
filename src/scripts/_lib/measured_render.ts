/**
 * Render-only-measured — a category with no measurement is never a number.
 *
 * WHY. The recorded failure: the always-budget report printed a share for a
 * dimension it counted **zero** artefacts in. `0 / 0` became `0.0%`, and `0.0%`
 * reads as a measurement that came back low — the most confident possible way
 * to say nothing. Nobody looking at the page could tell the difference between
 * "we measured this and it is at zero" and "we never measured this at all".
 *
 * The invariant is one line: **an unmeasured category renders as absent or
 * explicitly "not measured", never as a zero and never as a computed share.**
 * A zero is a claim; absence of measurement is not.
 *
 * The second half is the gap list. A coverage number published alone invites
 * the reader to assume the remainder is small and boring. Naming the
 * un-measured artefacts beside the covered count costs one line and removes the
 * assumption — see {@link renderCoverage}.
 *
 * **Gaming risk.** A generator can still bypass this module and interpolate its
 * own `${(n/d*100).toFixed(1)}%`. Nothing here can stop that; the mitigation is
 * the paired test assertion (a generator handed an unmeasured dimension must
 * emit no percentage) plus review. The residual is a generator that neither
 * imports this nor carries that test, which is why the invariant is written
 * into the authoring guideline rather than only into this file.
 */

/** How an unmeasured category is spelled. Exported so tests can pin it. */
export const NOT_MEASURED = 'not measured';

export interface ShareOptions {
    /** Decimal places for a real share. Default 1. */
    precision?: number;
    /**
     * Set false when the dimension was not measured at all, even though a
     * denominator happens to be available. A denominator alone does not prove
     * the measurement ran.
     */
    measured?: boolean;
}

/**
 * A percentage, or {@link NOT_MEASURED} when there is nothing to divide.
 *
 * Never returns `0.0%` for an empty denominator — that is the whole point.
 */
export function renderShare(numerator: number, denominator: number, opts: ShareOptions = {}): string {
    if (opts.measured === false || denominator <= 0 || !Number.isFinite(denominator)) {
        return NOT_MEASURED;
    }
    if (!Number.isFinite(numerator)) {
        return NOT_MEASURED;
    }
    return `${((numerator / denominator) * 100).toFixed(opts.precision ?? 1)}%`;
}

/** A count, or {@link NOT_MEASURED} when the category was never measured. */
export function renderCount(value: number | null | undefined, measured = true): string {
    if (!measured || value === null || value === undefined || !Number.isFinite(value)) {
        return NOT_MEASURED;
    }
    return String(value);
}

export interface CoverageLine {
    label: string;
    covered: number;
    total: number;
    /** The un-covered artefacts, named. Empty array means genuinely none. */
    gaps: readonly string[];
    /** Cap on how many gap names are printed inline. Default 8. */
    maxGaps?: number;
}

/**
 * A coverage number WITH its gap list.
 *
 * The gap list is not optional formatting. A coverage number published alone
 * lets the reader assume the remainder is small and boring; naming it removes
 * the assumption at the cost of one line. When the count is capped for length,
 * the true remainder is still stated — a silently truncated gap list reads as
 * "covered everything" exactly like the number it was meant to qualify.
 */
export function renderCoverage(line: CoverageLine): string {
    const share = renderShare(line.covered, line.total);
    const head = `${line.label}: ${String(line.covered)}/${String(line.total)} (${share})`;
    if (line.total <= 0) {
        return `${line.label}: ${NOT_MEASURED} — the population is empty, so there is no coverage to report`;
    }
    if (line.gaps.length === 0) {
        return `${head} — no gaps`;
    }
    const cap = line.maxGaps ?? 8;
    const shown = line.gaps.slice(0, cap);
    const more = line.gaps.length - shown.length;
    const tail = more > 0 ? `, … and ${String(more)} more` : '';
    return `${head} — not covered: ${shown.join(', ')}${tail}`;
}

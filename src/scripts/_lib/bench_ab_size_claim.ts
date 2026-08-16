/**
 * The Phase-3 size claim — the metric pair (T1 + T2) and the T4 disqualifier.
 *
 * Split out of `bench_ab_v2_stats.ts` because the size verdict is decision
 * logic, not statistics: it consumes already-computed paired blocks and answers
 * one question — may this arm claim a size win. Keeping it here makes it a pure
 * function over typed input with no dependency on the report pipeline, which is
 * also what keeps the dependency one-directional (stats imports this; this
 * imports nothing from stats).
 *
 * Thresholds are the pre-registered ones
 * (`internal/bench/ab-v2-phase3-PREREG.md` § Thresholds); they live here so a
 * change to either has to touch the record and the code together.
 */

/** T1 — median added lines must fall by at least this much. */
export const T1_MEDIAN_LINES_PCT = -10;
/** Two-sided significance for every endpoint in the pair. */
export const ALPHA = 0.05;

/** A paired continuous endpoint (added lines, cognitive complexity). */
export interface PairedContinuous {
    measured: boolean;
    n_pairs: number;
    /** `null` when the baseline median is 0 — no percent change exists. */
    median_delta_pct: number | null;
    median_delta: number;
    wilcoxon_p: number;
}

/** A paired binary endpoint (the safety tier). */
export interface PairedRate {
    measured: boolean;
    n_pairs: number;
    rate_treatment: number;
    rate_baseline: number;
    mcnemar_p: number;
}

export interface SizeClaimInput {
    arm_treatment: string | null;
    arm_baseline: string | null;
    size: PairedContinuous;
    complexity: PairedContinuous;
    safety: PairedRate;
}

export interface SizeClaimVerdict {
    arm_treatment: string | null;
    arm_baseline: string | null;
    verdict: 'PASS' | 'NO-SIZE-WIN' | 'REFUSED-GOLFING' | 'REFUSED-SAFETY-REGRESSION' | 'INCONCLUSIVE';
    reason: string;
    lines_fell?: boolean;
    size_measured: boolean;
    complexity_measured: boolean;
    safety_measured: boolean;
}

/**
 * Evaluate the size claim for one comparison — binding, and structurally unable
 * to report a win on size alone.
 *
 * Four properties, each a refusal the caller cannot route around:
 *
 *   1. **An unmeasured endpoint is never a pass.** If added lines, complexity,
 *      or the safety tier is absent, the verdict is `INCONCLUSIVE` naming which.
 *      Half a pair is no result, not a partial one — so this cannot silently
 *      degrade into the lines-only report F9 exists to forbid.
 *   2. **Safety is checked FIRST and is a disqualifier**, not a side metric. An
 *      arm that saves a line and drops a guard has lost; there is no ordering of
 *      the other two endpoints that can overturn it.
 *   2b. **Golfing is refused as soon as T2 shows it** — before the
 *      unmeasured-endpoint check, and independently of T4. The two disqualifiers
 *      answer different questions and neither waits for the other; ordering them
 *      the other way made `REFUSED-GOLFING` unreachable on real data, because no
 *      safety-tier producer exists in the tree.
 *   3. **`PASS` is reachable through exactly one path** — all three measured,
 *      the complexity sample covering the size sample, neither disqualifier
 *      fired, and T1 met. That is the Goodhart guard in code rather than in
 *      prose: there is no branch that ranks on size while a safety regression
 *      stands.
 */
export function evaluateSizeClaim(input: SizeClaimInput): SizeClaimVerdict {
    const { size, complexity: cx, safety: saf } = input;
    const base = { arm_treatment: input.arm_treatment, arm_baseline: input.arm_baseline };

    // (2) The disqualifier runs before anything else can produce a win.
    if (saf.measured && saf.rate_treatment < saf.rate_baseline && saf.mcnemar_p < ALPHA) {
        return {
            ...base,
            verdict: 'REFUSED-SAFETY-REGRESSION',
            reason:
                'safety tier regressed significantly (T4) — a size result is ' +
                'not reportable for this arm at all',
            size_measured: size.measured,
            complexity_measured: cx.measured,
            safety_measured: true,
        };
    }

    const cx_rose = cx.measured && cx.median_delta > 0 && cx.wilcoxon_p < ALPHA;
    const pct = size.measured ? size.median_delta_pct : null;
    const lines_fell = pct !== null && pct <= T1_MEDIAN_LINES_PCT && size.wilcoxon_p < ALPHA;

    // (2b) Golfing is refused as soon as T2 shows it, and does NOT wait for T4.
    //
    // This ordering was wrong on the first pass and the completion review caught
    // it: the unmeasured-endpoint branch ran first, so with no safety-tier
    // producer in the tree — and there is none; T4's scorer is rubric-judged and
    // unimplemented — every real run returned INCONCLUSIVE and `REFUSED-GOLFING`
    // was reachable only from a synthetic fixture. A refusal that exists only in
    // its own test is not a gate.
    if (cx_rose) {
        return {
            ...base,
            verdict: 'REFUSED-GOLFING',
            reason:
                'median cognitive complexity per changed function rose significantly (T2); ' +
                'lines down and complexity up fails the size criterion even at p<0.05 on lines alone',
            lines_fell,
            size_measured: size.measured,
            complexity_measured: true,
            safety_measured: saf.measured,
        };
    }

    const missing: string[] = [];
    if (!size.measured) missing.push('T1 added-lines');
    if (!cx.measured) missing.push('T2 cognitive-complexity');
    if (!saf.measured) missing.push('T4 safety-tier');
    if (missing.length > 0) {
        return {
            ...base,
            verdict: 'INCONCLUSIVE',
            reason: `endpoint(s) not measured: ${missing.join(', ')} — half a pair is no result`,
            size_measured: size.measured,
            complexity_measured: cx.measured,
            safety_measured: saf.measured,
        };
    }

    // (3) T1 and T2 are collected pair-wise and independently, so a trial that
    // carries added lines but no complexity enters one sample and not the other.
    // A win claimed on 30 pairs whose golfing check saw 4 is not a checked win —
    // the guard would be policing a subset of the claim.
    if (cx.n_pairs < size.n_pairs) {
        return {
            ...base,
            verdict: 'INCONCLUSIVE',
            reason:
                `complexity sample (${cx.n_pairs} pairs) does not cover the size sample ` +
                `(${size.n_pairs}) — the anti-golfing check would police a strict subset`,
            lines_fell,
            size_measured: true,
            complexity_measured: true,
            safety_measured: true,
        };
    }

    return {
        ...base,
        verdict: lines_fell ? 'PASS' : 'NO-SIZE-WIN',
        reason: lines_fell
            ? `median added lines ${pct}% at p=${size.wilcoxon_p} with no significant complexity rise and no safety regression`
            : `T1 not met (median added lines ${pct}% at p=${size.wilcoxon_p}; bar is <= ${T1_MEDIAN_LINES_PCT}% at p<${ALPHA})`,
        lines_fell,
        size_measured: true,
        complexity_measured: true,
        safety_measured: true,
    };
}

/**
 * The size-claim block of the rendered report.
 *
 * Rendered unconditionally — including when every endpoint is absent, because
 * "the pair was not measurable" is the finding a reader needs in order not to
 * quote a lines number from Table 1 as a size result.
 */
export function renderSizeClaimSection(claims: readonly SizeClaimVerdict[]): string[] {
    const L: string[] = [];
    L.push('## Size claim (T1 + T2 pair, T4 disqualifier)');
    L.push('');
    L.push(
        '> A size metric is a **measurement**, never a scored target. An arm may ' +
            'claim a size win only when median added lines fell **and** median ' +
            'cognitive complexity per changed function did not rise **and** the ' +
            'safety tier did not regress. An unmeasured endpoint is never a pass.',
    );
    L.push('');
    if (claims.length === 0) {
        L.push('_No comparison rendered — no arms to compare._');
        L.push('');
        return L;
    }
    L.push('| comparison | verdict | why |');
    L.push('|---|---|---|');
    for (const c of claims) {
        L.push(
            `| \`${c.arm_treatment}\` vs \`${c.arm_baseline}\` ` +
                `| **${c.verdict}** | ${c.reason} |`,
        );
    }
    L.push('');
    return L;
}

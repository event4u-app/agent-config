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

import { decidePairedVerdict, floorWarning, MIN_DISCORDANT } from './paired_verdict.js';

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
    /**
     * Retained for TRIAGE and reporting. Since PREREG amendment v2 it decides
     * nothing — see {@link evaluateSizeClaim}.
     */
    wilcoxon_p: number;
    /** Non-tied pairs in the direction of interest. Absent on a pre-amendment report. */
    direction_wins?: number | undefined;
    /** Non-tied pairs against the direction of interest. Absent on a pre-amendment report. */
    direction_losses?: number | undefined;
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



/** One clause naming the directional evidence, printable in a verdict reason. */
function describeDirection(v: ReturnType<typeof decidePairedVerdict> | null): string {
    if (v === null) {
        return `no direction counts in the report — pre-amendment or unmeasured, so the direction bar is not met`;
    }
    if (v.kind === 'underpowered') {
        return `underpowered: ${String(v.discordant)} non-tied pair(s) below the derived floor of ${String(MIN_DISCORDANT)}`;
    }
    const warn = floorWarning(v);
    return `${String(v.wins)}/${String(v.discordant)} non-tied pairs, one-sided exact p=${v.p.toFixed(4)}` +
        (warn === null ? '' : ` — ${warn}`);
}

/**
 * The directional verdict for one endpoint, or `null` when it cannot be formed.
 *
 * `null` means the report carries no direction counts — a pre-amendment report,
 * or an unmeasured endpoint. The caller treats that as "not significant" rather
 * than reaching for `wilcoxon_p`, which is the whole point of the amendment.
 *
 * The counts are reconstructed into a delta vector of ±1 rather than carrying
 * raw deltas through the report: the exact sign test needs direction only, and
 * a council seat noted the raw deltas are preferable for auditability but not
 * mathematically required. The raw values remain in the trial artifacts.
 */
function directionVerdict(e: PairedContinuous): ReturnType<typeof decidePairedVerdict> | null {
    if (!e.measured) return null;
    const w = e.direction_wins;
    const l = e.direction_losses;
    if (w === undefined || l === undefined) return null;
    return decidePairedVerdict({
        deltas: [...Array<number>(w).fill(1), ...Array<number>(l).fill(-1)],
        alpha: ALPHA,
    });
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

    // ── PREREG amendment v2, 2026-08-26 — direction decides significance ────
    //
    // The significance half of every endpoint below was a Wilcoxon signed-rank
    // p, which ranks by |difference| and is therefore magnitude-weighted. That
    // was shown to disagree with the exact test on twelve records up to ten
    // trials, PERMISSIVE in every one, with the visible symptom inverted: an
    // artifact winning every trial still failed, because a few large
    // opposite-direction deltas outweighed a clean sweep of small ones.
    //
    // TWO PROPOSITIONS, KEPT SEPARATE — this is the refinement both council
    // seats independently required (2026-08-26, 2/2) and it is the half that
    // makes the amendment safe. A sign test answers "did this help more often
    // than it hurt" and says NOTHING about how much. Replacing Wilcoxon with it
    // outright would let a clean sweep of negligible improvements claim a SIZE
    // win. So:
    //   · directional reliability → exact one-sided sign test over non-tied pairs
    //   · practical magnitude     → the pre-registered T1_MEDIAN_LINES_PCT bar,
    //                               unchanged and still independently binding
    // Both must hold. Dropping either is a different claim and needs its own
    // amendment.
    //
    // A report predating the amendment carries no direction counts. It is
    // treated as UNMEASURED for the significance half rather than falling back
    // to `wilcoxon_p`, because a silent fallback to the defective test is
    // exactly what this amendment removes.
    const sizeDir = directionVerdict(size);
    const cxDir = directionVerdict(cx);
    // ASYMMETRY, deliberate and the conservative direction of it. A PASS needs
    // the direction bar MET; a REFUSAL fires on EITHER signal. Applying the
    // strict reading to both would make the anti-golfing refusal disappear on
    // any report without direction counts — a missing input silently rescuing
    // an arm is the failure mode a refusal exists to prevent, and it is the
    // opposite of what the amendment is for. So the refusal keeps the legacy
    // Wilcoxon signal as a second trigger; the claim does not.
    const cx_rose =
        cx.measured &&
        cx.median_delta > 0 &&
        (cxDir === null ? cx.wilcoxon_p < ALPHA : cxDir.kind === 'regression');
    // `regression`, NOT `pass`, and the distinction cost a test run to find.
    // `direction_wins` counts the endpoint's IMPROVEMENT direction — a negative
    // delta — for every continuous endpoint, so on complexity a `pass` means
    // complexity FELL. What `cx_rose` needs is the opposite tail, which is
    // exactly what `regression` names. Writing `pass` here reads correctly in
    // English and inverts the anti-golfing guard.
    const pct = size.measured ? size.median_delta_pct : null;
    const lines_fell = pct !== null && pct <= T1_MEDIAN_LINES_PCT && sizeDir?.kind === 'pass';

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
            ? `median added lines ${pct}% (magnitude bar) AND ${describeDirection(sizeDir)} (direction bar) ` +
              'with no significant complexity rise and no safety regression'
            : `T1 not met (median added lines ${pct}%, bar <= ${T1_MEDIAN_LINES_PCT}%; ` +
              `direction: ${describeDirection(sizeDir)}). Wilcoxon p=${size.wilcoxon_p} is reported for ` +
              'triage and decides nothing.',
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

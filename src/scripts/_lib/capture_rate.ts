/**
 * capture_rate — the measurement itself: numerator ÷ denominator, reported with
 * a 95 % Wilson score interval, judged on the LOWER bound.
 *
 * `road-to-supervised-telemetry-collector` step 1.2 item 9 and step 1.3 fixed
 * the decision rule before any number existed, so it could not be chosen after:
 *
 * > Capture rate = numerator ÷ denominator, both as defined above, reported with
 * > a **95 % Wilson score interval**. The target in 1.3 is met when the **lower
 * > bound** of that interval is at or above the target — not the point estimate.
 *
 * > **≥ 90 % capture**, read as the lower bound of the 95 % Wilson interval,
 * > over the **21-day window** and **≥ 2,000 eligible dispatches across ≥ 5
 * > machines**.
 *
 * This module computes that, and nothing else. It does not decide, does not
 * enable anything, and does not read the clock — the window boundaries are
 * inputs, because a measurement module that reads `Date.now()` cannot be tested
 * against a fixed window.
 *
 * ## Why it exists before the window does
 *
 * AI council, 2026-08-30 (DEGRADED — 1 of 2 seats; `openai` absent,
 * `os_error: ENOBUFS`), on the disposition of Phase 6: the seat chose option (d)
 * and made this a **prerequisite checkpoint between Phase 5 and Phase 6** rather
 * than a substitute for 6.1 —
 *
 * > The synthetic test is a checkpoint, not a Phase 6 step. It answers "does the
 * > instrument work?" before asking "what does it measure?"
 *
 * So: seeded opportunities and captures, an asserted ratio, an asserted Wilson
 * bound, the minimum-sample boundary, malformed input, and duplicate
 * suppression — all verifiable with zero elapsed days. **It proves the
 * instrument. It claims nothing about the field measurement**, which needs 21
 * days that no run can compress.
 */

/** The confidence level the decision rule fixes. Not a parameter — 1.2 item 9 names it. */
export const WILSON_Z = 1.959963984540054; // two-sided 95 %

/** The target from 1.3, as a proportion. Read as a LOWER bound, never a point estimate. */
export const CAPTURE_TARGET = 0.9;

/** Minimum sample from 1.2 items 7–8. Below this the reading is not eligible at all. */
export const MINIMUM_SAMPLE = 2_000;
export const MINIMUM_MACHINES = 5;
export const WINDOW_DAYS = 21;

export interface Interval {
    readonly lower: number;
    readonly upper: number;
}

/**
 * The Wilson score interval for a binomial proportion.
 *
 * Wilson rather than the normal approximation because the normal one is wrong
 * exactly where this measurement lives: near a proportion of 1, it produces an
 * upper bound above 1 and a spuriously narrow interval. At `n = 0` there is no
 * proportion to estimate, and the honest interval is the whole range `[0, 1]` —
 * NOT `[0, 0]`, which would read as "we measured zero capture" rather than "we
 * measured nothing".
 */
export function wilsonInterval(successes: number, trials: number, z: number = WILSON_Z): Interval {
    if (!Number.isInteger(successes) || !Number.isInteger(trials)) {
        throw new TypeError('wilsonInterval: counts must be integers');
    }
    if (successes < 0 || trials < 0 || successes > trials) {
        throw new RangeError(
            `wilsonInterval: impossible counts (${successes} of ${trials})`,
        );
    }
    if (trials === 0) return Object.freeze({ lower: 0, upper: 1 });

    const p = successes / trials;
    const z2 = z * z;
    const denominator = 1 + z2 / trials;
    const centre = p + z2 / (2 * trials);
    const spread = z * Math.sqrt((p * (1 - p) + z2 / (4 * trials)) / trials);
    return Object.freeze({
        lower: Math.max(0, (centre - spread) / denominator),
        upper: Math.min(1, (centre + spread) / denominator),
    });
}

export interface CaptureReading {
    /** Records that reached the store, de-duplicated. */
    readonly numerator: number;
    /** Dispatch opportunities recorded by the independent writer. */
    readonly denominator: number;
    /** Distinct machines contributing to the denominator. */
    readonly machines: number;
    /** Whole days elapsed in the observation window. */
    readonly windowDays: number;
}

export type EligibilityFailure =
    | 'window-too-short'
    | 'sample-too-small'
    | 'too-few-machines'
    | 'numerator-exceeds-denominator';

export interface CaptureVerdict {
    /** Point estimate. `null` when the denominator is 0 — a ratio, not a zero. */
    readonly rate: number | null;
    readonly interval: Interval;
    /** Whether the reading may be judged against the target at all. */
    readonly eligible: boolean;
    /** Why not. Empty when eligible. */
    readonly ineligibleBecause: readonly EligibilityFailure[];
    /**
     * `true` / `false` only when eligible; `null` when the reading cannot be
     * judged. A three-valued verdict, because "not eligible" collapsed to
     * `false` reads as a MISS — and a miss triggers 6.3's decision record for a
     * measurement that never happened.
     */
    readonly meetsTarget: boolean | null;
}

/**
 * Judge a reading against the 1.3 target.
 *
 * Eligibility is checked BEFORE the comparison and reported separately, because
 * the two questions have different consequences: an ineligible reading means
 * keep observing, a miss means run 6.3. Collapsing them is how a 200-dispatch
 * sample becomes a recorded failure.
 */
export function judgeCapture(
    reading: CaptureReading,
    target: number = CAPTURE_TARGET,
): CaptureVerdict {
    const failures: EligibilityFailure[] = [];
    if (reading.numerator > reading.denominator) failures.push('numerator-exceeds-denominator');
    if (reading.windowDays < WINDOW_DAYS) failures.push('window-too-short');
    if (reading.denominator < MINIMUM_SAMPLE) failures.push('sample-too-small');
    if (reading.machines < MINIMUM_MACHINES) failures.push('too-few-machines');

    const impossible = failures.includes('numerator-exceeds-denominator');
    const interval = impossible
        ? Object.freeze({ lower: 0, upper: 1 })
        : wilsonInterval(reading.numerator, reading.denominator);
    const rate = reading.denominator === 0 ? null : reading.numerator / reading.denominator;
    const eligible = failures.length === 0;

    return Object.freeze({
        rate,
        interval,
        eligible,
        ineligibleBecause: Object.freeze(failures),
        // The lower bound, never the point estimate. A point estimate that
        // clears the target on a sample whose interval straddles it has not
        // cleared it, and 1.2 item 9 fixed that before the number existed.
        meetsTarget: eligible ? interval.lower >= target : null,
    });
}

/**
 * The six readings 6.2 requires, as a type that cannot be partially filled.
 *
 * Every field is required and `null` is a legal value meaning **not recorded**.
 * That is the shape the step demands — *"a missing reading blocks the flip"* —
 * and an optional field would let a caller omit one and still typecheck.
 */
export interface EnablementReadings {
    readonly captureTargetMet: boolean | null;
    readonly lifecycleGreenOnEveryPlatform: boolean | null;
    readonly resourceBudgetsMet: boolean | null;
    readonly noPrivacyOrIntegrityIncident: boolean | null;
    readonly staticModeCompatible: boolean | null;
    readonly windowAndSampleSatisfied: boolean | null;
}

export const ENABLEMENT_READING_NAMES = [
    'captureTargetMet',
    'lifecycleGreenOnEveryPlatform',
    'resourceBudgetsMet',
    'noPrivacyOrIntegrityIncident',
    'staticModeCompatible',
    'windowAndSampleSatisfied',
] as const;

export interface EnablementVerdict {
    readonly flip: boolean;
    /** Readings that are `null`. A missing reading blocks, and is not a failure. */
    readonly missing: readonly string[];
    /** Readings that are `false`. */
    readonly failed: readonly string[];
}

/**
 * Decide whether the default may flip.
 *
 * Missing and failed are reported separately for the same reason eligibility is
 * separate above: "we did not look" and "we looked and it was bad" call for
 * different actions, and one of them is 6.3.
 */
export function judgeEnablement(readings: EnablementReadings): EnablementVerdict {
    const missing: string[] = [];
    const failed: string[] = [];
    for (const name of ENABLEMENT_READING_NAMES) {
        const value = readings[name];
        if (value === null) missing.push(name);
        else if (value === false) failed.push(name);
    }
    return Object.freeze({
        flip: missing.length === 0 && failed.length === 0,
        missing: Object.freeze(missing),
        failed: Object.freeze(failed),
    });
}

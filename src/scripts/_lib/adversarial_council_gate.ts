/**
 * Adversarial verification council — prove-or-drop gate (Phase 4).
 *
 * Pure, deterministic. Encodes the pre-registered `adversarial-council-finding-
 * coverage` claim (docs/CLAIMS.md, ADR-122) as a machine-checkable verdict on
 * the two-stage residual-detection benchmark: does a cross-vendor skeptic panel
 * out-find a single strong judge on the RESIDUAL defect pool (defects that
 * survived stage 1), at a false-positive rate no worse than baseline on the
 * controversial-but-correct control?
 *
 * Dual threshold, both required, to guard against base-rate compression when the
 * single-judge residual recall is already high (the council's Round-1 critique):
 *   (a) relative residual-recall lift >= +25%
 *   (b) absolute residual-recall lift >= +8 percentage points
 *   AND panel FP not worse than single-judge FP within the noise margin.
 *
 * Thresholds are LOCKED at pre-registration (roadmap Phase 0). This module is the
 * "countable logic in TS with tests" the anti-lesson mandates — never LLM-computed.
 *
 * Design: docs/design/adversarial-council-eval.md
 */

/** Relative residual-recall lift threshold (fraction). */
export const RELATIVE_LIFT_THRESHOLD = 0.25;
/** Absolute residual-recall lift threshold (percentage points, as a fraction). */
export const ABSOLUTE_LIFT_THRESHOLD_PP = 0.08;

export interface CouncilBenchInputs {
    /** Single-judge recall on the judge-passed residual pool (0..1). */
    single_judge_residual_recall: number;
    /** Panel recall on the same judge-passed residual pool (0..1). */
    panel_residual_recall: number;
    /** Single-judge false-positive rate on the controversial-clean control (0..1). */
    single_judge_fp_rate: number;
    /** Panel false-positive rate on the same control (0..1). */
    panel_fp_rate: number;
    /** Noise margin within which a higher panel FP still counts as "not worse" (0..1). */
    fp_noise_margin: number;
}

export type CouncilVerdict = 'backed' | 'honest-null';

export interface CouncilBenchVerdict {
    relative_lift: number;
    absolute_lift_pp: number;
    relative_pass: boolean;
    absolute_pass: boolean;
    fp_pass: boolean;
    verdict: CouncilVerdict;
    reasons: string[];
}

function assertUnit(name: string, v: number): void {
    if (typeof v !== 'number' || Number.isNaN(v) || v < 0 || v > 1) {
        throw new Error(`${name} must be a number in [0,1], got ${JSON.stringify(v)}`);
    }
}

/**
 * Evaluate the pre-registered dual-threshold gate. Returns `backed` only when
 * BOTH recall thresholds AND the FP constraint pass; otherwise `honest-null`
 * (which keeps the surface default-off permanently, like recursive-verification).
 */
export function evaluateCouncilBench(inputs: CouncilBenchInputs): CouncilBenchVerdict {
    assertUnit('single_judge_residual_recall', inputs.single_judge_residual_recall);
    assertUnit('panel_residual_recall', inputs.panel_residual_recall);
    assertUnit('single_judge_fp_rate', inputs.single_judge_fp_rate);
    assertUnit('panel_fp_rate', inputs.panel_fp_rate);
    assertUnit('fp_noise_margin', inputs.fp_noise_margin);

    const single = inputs.single_judge_residual_recall;
    const panel = inputs.panel_residual_recall;
    const absolute_lift_pp = panel - single;
    // A zero baseline makes the ratio undefined — any positive panel recall is an
    // infinite relative lift; no lift is zero. This never masks the absolute gate.
    const relative_lift = single === 0 ? (panel > 0 ? Infinity : 0) : absolute_lift_pp / single;

    const relative_pass = relative_lift >= RELATIVE_LIFT_THRESHOLD;
    const absolute_pass = absolute_lift_pp >= ABSOLUTE_LIFT_THRESHOLD_PP;
    const fp_pass = inputs.panel_fp_rate <= inputs.single_judge_fp_rate + inputs.fp_noise_margin;

    const reasons: string[] = [];
    if (!relative_pass) {
        reasons.push(`relative lift ${(relative_lift * 100).toFixed(1)}% < ${RELATIVE_LIFT_THRESHOLD * 100}%`);
    }
    if (!absolute_pass) {
        reasons.push(`absolute lift ${(absolute_lift_pp * 100).toFixed(1)}pp < ${ABSOLUTE_LIFT_THRESHOLD_PP * 100}pp`);
    }
    if (!fp_pass) {
        reasons.push(
            `panel FP ${(inputs.panel_fp_rate * 100).toFixed(1)}% > baseline ${(inputs.single_judge_fp_rate * 100).toFixed(1)}% + noise ${(inputs.fp_noise_margin * 100).toFixed(1)}%`,
        );
    }

    const verdict: CouncilVerdict = relative_pass && absolute_pass && fp_pass ? 'backed' : 'honest-null';
    if (verdict === 'backed') reasons.push('all thresholds met');
    return { relative_lift, absolute_lift_pp, relative_pass, absolute_pass, fp_pass, verdict, reasons };
}

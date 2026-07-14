/**
 * Adversarial council prove-or-drop gate — coverage (Phase 4).
 *
 * Locks the pre-registered dual-threshold semantics: BOTH relative (>=+25%) and
 * absolute (>=+8pp) residual-recall lift, AND panel FP not worse than baseline
 * within noise. Guards the base-rate-compression case the council flagged
 * (high single-judge baseline → relative easy but absolute must still clear).
 */
import { describe, expect, it } from 'vitest';

import {
    ABSOLUTE_LIFT_THRESHOLD_PP,
    RELATIVE_LIFT_THRESHOLD,
    evaluateCouncilBench,
} from './adversarial_council_gate.js';

const CLEAN_FP = { single_judge_fp_rate: 0.05, panel_fp_rate: 0.05, fp_noise_margin: 0.03 };

describe('evaluateCouncilBench', () => {
    it('exposes the locked thresholds', () => {
        expect(RELATIVE_LIFT_THRESHOLD).toBe(0.25);
        expect(ABSOLUTE_LIFT_THRESHOLD_PP).toBe(0.08);
    });

    it('backs the claim when both recall thresholds and FP pass', () => {
        const v = evaluateCouncilBench({
            single_judge_residual_recall: 0.5,
            panel_residual_recall: 0.65, // +30% relative, +15pp absolute
            ...CLEAN_FP,
        });
        expect(v.relative_pass).toBe(true);
        expect(v.absolute_pass).toBe(true);
        expect(v.fp_pass).toBe(true);
        expect(v.verdict).toBe('backed');
    });

    it('honest-null when relative passes but absolute fails (base-rate compression)', () => {
        // baseline 0.90; +0.05 → relative 5.5% (fails) — the high-baseline trap.
        const v = evaluateCouncilBench({
            single_judge_residual_recall: 0.9,
            panel_residual_recall: 0.95,
            ...CLEAN_FP,
        });
        expect(v.verdict).toBe('honest-null');
        expect(v.reasons.join(' ')).toMatch(/relative lift/);
    });

    it('honest-null when absolute passes but relative fails', () => {
        // baseline 0.6; +0.09 absolute (passes) but +15% relative (fails at 25%).
        const v = evaluateCouncilBench({
            single_judge_residual_recall: 0.6,
            panel_residual_recall: 0.69,
            ...CLEAN_FP,
        });
        expect(v.absolute_pass).toBe(true);
        expect(v.relative_pass).toBe(false);
        expect(v.verdict).toBe('honest-null');
    });

    it('honest-null when recall passes but FP regresses beyond noise', () => {
        const v = evaluateCouncilBench({
            single_judge_residual_recall: 0.5,
            panel_residual_recall: 0.7,
            single_judge_fp_rate: 0.05,
            panel_fp_rate: 0.12, // +7pp > 3pp noise
            fp_noise_margin: 0.03,
        });
        expect(v.relative_pass).toBe(true);
        expect(v.absolute_pass).toBe(true);
        expect(v.fp_pass).toBe(false);
        expect(v.verdict).toBe('honest-null');
    });

    it('allows a within-noise FP increase', () => {
        const v = evaluateCouncilBench({
            single_judge_residual_recall: 0.5,
            panel_residual_recall: 0.7,
            single_judge_fp_rate: 0.05,
            panel_fp_rate: 0.075, // +2.5pp <= 3pp noise
            fp_noise_margin: 0.03,
        });
        expect(v.fp_pass).toBe(true);
        expect(v.verdict).toBe('backed');
    });

    it('handles a zero baseline (infinite relative lift, absolute still gates)', () => {
        const backed = evaluateCouncilBench({
            single_judge_residual_recall: 0,
            panel_residual_recall: 0.2,
            ...CLEAN_FP,
        });
        expect(backed.relative_lift).toBe(Infinity);
        expect(backed.verdict).toBe('backed'); // +20pp absolute clears

        const nullAbs = evaluateCouncilBench({
            single_judge_residual_recall: 0,
            panel_residual_recall: 0.05, // +5pp < 8pp
            ...CLEAN_FP,
        });
        expect(nullAbs.verdict).toBe('honest-null');
    });

    it('rejects out-of-range inputs', () => {
        expect(() =>
            evaluateCouncilBench({
                single_judge_residual_recall: 1.5,
                panel_residual_recall: 0.5,
                ...CLEAN_FP,
            }),
        ).toThrow(/\[0,1\]/);
    });
});

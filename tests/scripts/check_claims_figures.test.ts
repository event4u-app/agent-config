/**
 * Witness-sweep figure classes (road-to-number-truth P2).
 *
 * These pin a regression that actually shipped: the README carried
 * "compiled into 7+ host agents" while the test-pinned truth was 23 detected /
 * 20 emitted — understating coverage by 3x. Two independent holes let it
 * through, and both are covered here:
 *
 *   1. the pattern saw only `%` and `x`, so a bare count was invisible;
 *   2. the line already carried an unrelated `kind: qual` marker, and
 *      any-marker-exempts-the-line let the figure ride along on it.
 *
 * Fixing either one alone would still have shipped the wrong number.
 */
import { describe, expect, it } from 'vitest';

import { is_quantified_claim } from '../../src/scripts/check_claims.js';

describe('is_quantified_claim — the class that shipped wrong', () => {
    it('fires on the exact string that was published', () => {
        expect(is_quantified_claim('The whole layer is compiled into 7+ host agents')).toBe(true);
    });

    it('fires on the corrected string too — being right is not an exemption', () => {
        expect(is_quantified_claim('compiled into 20 host agents')).toBe(true);
    });

    it('fires on the plural and the "supported hosts" phrasing', () => {
        expect(is_quantified_claim('runs on 23 hosts')).toBe(true);
        expect(is_quantified_claim('12 supported agents')).toBe(true);
    });
});

describe('is_quantified_claim — magnitudes carrying a unit', () => {
    it('fires on a token count, the reference case that motivated this', () => {
        expect(is_quantified_claim('a tiny-fix skips the guardrails (~5,000 tokens)')).toBe(true);
    });

    it('fires on a separated magnitude', () => {
        expect(is_quantified_claim('quick-win costs 22,077 tokens end to end')).toBe(true);
    });

    it('fires when the unit carries a qualifier', () => {
        // `GPT-tokens` is the same claim shape as `tokens`; it was missed at first.
        expect(is_quantified_claim('reduced eager load to 13,881 GPT-tokens')).toBe(true);
    });

    it('fires on latency, size and cost units', () => {
        expect(is_quantified_claim('p95 latency 250 ms')).toBe(true);
        expect(is_quantified_claim('a 40 MB bundle')).toBe(true);
        expect(is_quantified_claim('costs 12 USD per run')).toBe(true);
    });
});

describe('is_quantified_claim — ratios still fire (the original class)', () => {
    it('fires on a percentage', () => {
        expect(is_quantified_claim('13.1% of rules have a backstop')).toBe(true);
    });

    it('fires on a multiplier', () => {
        expect(is_quantified_claim('a 15x provider effect')).toBe(true);
    });
});

describe('is_quantified_claim — stays quiet on prose numbers', () => {
    // A gate that false-positives is a gate that gets bypassed. These are the
    // shapes that would train a maintainer to stop reading its output.
    it('does not fire on a version', () => {
        expect(is_quantified_claim('requires Node 20')).toBe(false);
    });

    it('does not fire on a year', () => {
        expect(is_quantified_claim('released in 2026')).toBe(false);
    });

    it('does not fire on a duration in an instruction', () => {
        // Time units are deliberately excluded in v1 — "wait 30 seconds" is a
        // step, not a capability claim.
        expect(is_quantified_claim('wait 30 seconds for the probe')).toBe(false);
        expect(is_quantified_claim('takes 5 minutes on a cold cache')).toBe(false);
    });

    it('does not fire on a cross-reference or a plain noun count', () => {
        expect(is_quantified_claim('see section 4 for details')).toBe(false);
        expect(is_quantified_claim('6 role-shaped entry paths')).toBe(false);
        expect(is_quantified_claim('the 3 export-only targets')).toBe(false);
    });
});

import { describe, expect, it } from 'vitest';

import {
    amplification,
    billableSplit,
    CURRENCY_MARKERS,
    isCurrencyFree,
    rereadCost,
    summaryLine,
    type ProfileDeclaration,
} from '../../../src/scripts/_lib/config_cost.js';

const MEASURED = { rules_tokens: 120_000, skill_catalogue_tokens: 13_000 };
const DECL = (over: Partial<ProfileDeclaration['declared']> = {}, headroom = 0.1): ProfileDeclaration => ({
    profile: 'full',
    declared: { rules_tokens: 92_000, skill_catalogue_tokens: 10_000, ...over },
    sanity_headroom: headroom,
});

describe('1.2 — payload amplification, named for what it measures', () => {
    it('computes delivered ÷ intended', () => {
        const r = amplification(133_000, MEASURED, DECL());
        expect(r.verdict).toBe('measured');
        expect(r.ratio).toBeCloseTo(133_000 / 102_000, 6);
    });

    it('a ratio can move — the denominator is intent, not the measurement', () => {
        // The defect the first cut had: declaring the current measurement makes
        // the ratio 1.00 by construction, and a number that cannot move is not
        // a measurement.
        const a = amplification(133_000, MEASURED, DECL());
        const b = amplification(150_000, MEASURED, DECL());
        expect(a.ratio).not.toBe(1);
        expect(b.ratio as number).toBeGreaterThan(a.ratio as number);
    });

    it('no declaration yields unknown_profile and NO ratio', () => {
        const r = amplification(133_000, MEASURED, null);
        expect(r.verdict).toBe('unknown_profile');
        expect(r.ratio).toBeNull();
        expect(r.reason).toContain('no denominator');
    });

    it('a non-positive declaration is refused rather than divided by', () => {
        const r = amplification(133_000, MEASURED, DECL({ rules_tokens: 0, skill_catalogue_tokens: 0 }));
        expect(r.verdict).toBe('unknown_profile');
        expect(r.ratio).toBeNull();
    });

    it('a declaration above the measured tree is refused — the gaming direction', () => {
        // Both council seats raised this independently: a profile self-declaring
        // a large payload makes any delivered cost look disciplined.
        const r = amplification(133_000, MEASURED, DECL({ rules_tokens: 900_000 }));
        expect(r.verdict).toBe('unknown_profile');
        expect(r.reason).toContain('cannot intend to deliver more than exists');
    });

    it('a declaration BELOW the delivery is the finding, not gaming', () => {
        // The asymmetry is deliberate: under-declaring surfaces the overage,
        // which is exactly what this ratio exists to show.
        expect(amplification(133_000, MEASURED, DECL()).verdict).toBe('measured');
    });

    it('never claims net-negativity — it does not observe what was returned', () => {
        const r = amplification(133_000, MEASURED, DECL());
        expect(JSON.stringify(r)).not.toMatch(/net.?negative/i);
    });
});

describe('1.1 — the billable-input split', () => {
    it('sums the three legs', () => {
        const b = billableSplit(100, 900, 50);
        expect(b.billable_input_tokens).toBe(1050);
        expect(b.cache_read_share).toBeCloseTo(900 / 1050, 6);
    });

    it('an empty ledger yields a null share, never 0 %', () => {
        // 0 % reads as "the cache never helped"; absent is a different claim.
        expect(billableSplit(0, 0, 0).cache_read_share).toBeNull();
    });
});

describe('1.3 — re-read cost is derived, never a constant', () => {
    it('prices a re-read by the file\'s measured size', () => {
        const c = rereadCost([
            { file: 'a.md', total_reads: 4, duplicate_reads: 3, file_tokens: 1000 },
            { file: 'b.md', total_reads: 2, duplicate_reads: 1, file_tokens: 10 },
        ]);
        expect(c.wasted_tokens).toBe(3010);
        // A constant would have ranked these equally; the size is what separates
        // a re-read of a config line from a re-read of a 3,000-token rule.
        expect(c.worst_file).toBe('a.md');
    });

    it('no re-read yields no worst file rather than an arbitrary one', () => {
        expect(rereadCost([]).worst_file).toBeNull();
        expect(rereadCost([{ file: 'a', total_reads: 1, duplicate_reads: 0, file_tokens: 500 }]).worst_file).toBeNull();
    });
});

describe('2.3 / AC-7 — tokens only, never a currency', () => {
    it('the summary line renders tokens and a share', () => {
        const line = summaryLine(133_759, billableSplit(100, 900, 50));
        expect(line).toContain('133759 tok');
        expect(line).toContain('cache-read share');
    });

    it('carries no currency symbol or per-token rate', () => {
        for (const split of [billableSplit(100, 900, 50), billableSplit(0, 0, 0), null]) {
            expect(isCurrencyFree(summaryLine(133_759, split))).toBe(true);
        }
    });

    it('an empty ledger states the share is unavailable rather than printing 0 %', () => {
        expect(summaryLine(1, billableSplit(0, 0, 0))).toContain('unavailable');
    });

    it('the ban is checkable — every marker is detected in rendered text', () => {
        for (const m of CURRENCY_MARKERS) {
            expect(isCurrencyFree(`total ${m}42`)).toBe(false);
        }
    });
});

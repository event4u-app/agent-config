/**
 * Congruence check: the worker rtk allowlist mirrors the MEASURED table in
 * `internal/bench/rtk-savings/RESULTS.md` — referenced, not duplicated.
 * Every allowlisted command class measured ≥ RTK_WRAP_THRESHOLD_PCT; every
 * excluded class measured below it. A future re-measurement that moves a
 * class across the threshold fails this test until the allowlist follows.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    RTK_NO_WRAP,
    RTK_WRAP_ALLOWLIST,
    RTK_WRAP_THRESHOLD_PCT,
    shouldWrapWithRtk,
} from '../../src/scripts/_lib/rtk_allowlist.js';

const RESULTS = fs.readFileSync(path.join(process.cwd(), 'internal/bench/rtk-savings/RESULTS.md'), 'utf8');

/** Parse `| command | raw | rtk | NN.N% |` rows from the results table. */
function measuredSavings(): Map<string, number> {
    const rows = new Map<string, number>();
    for (const line of RESULTS.split('\n')) {
        const m = line.match(/^\|\s*`?([^|`]+?)`?\s*\|\s*[\d,]+\s*\|\s*[\d,]+\s*\|\s*\*{0,2}([\d.]+)%\*{0,2}\s*\|/);
        if (m && m[1] && m[2] && !/^-+$/.test(m[1].trim()) && m[1].trim().toUpperCase() !== 'TOTAL') {
            rows.set(m[1].trim(), Number(m[2]));
        }
    }
    return rows;
}

describe('rtk worker allowlist ≡ RESULTS.md (measured class only)', () => {
    const measured = measuredSavings();

    it('the results table parses (guard against silent format drift)', () => {
        expect(measured.size).toBeGreaterThanOrEqual(6);
    });

    it('every allowlisted class measured ≥ threshold', () => {
        for (const entry of RTK_WRAP_ALLOWLIST) {
            const pct = measured.get(entry.benchCommand);
            expect(pct, `bench row missing for '${entry.benchCommand}'`).toBeDefined();
            expect(pct!, `'${entry.benchCommand}' measured below the wrap threshold`).toBeGreaterThanOrEqual(RTK_WRAP_THRESHOLD_PCT);
        }
    });

    it('every excluded class measured below threshold (wrap overhead without return)', () => {
        for (const entry of RTK_NO_WRAP) {
            const pct = measured.get(entry.benchCommand);
            expect(pct, `bench row missing for '${entry.benchCommand}'`).toBeDefined();
            expect(pct!, `'${entry.benchCommand}' now measures above threshold — move it to the allowlist`).toBeLessThan(RTK_WRAP_THRESHOLD_PCT);
        }
    });

    it('shouldWrapWithRtk routes the measured classes correctly', () => {
        expect(shouldWrapWithRtk('git status')).toBe(true);
        expect(shouldWrapWithRtk('git log -10')).toBe(true);
        expect(shouldWrapWithRtk('ls -la src/scripts')).toBe(true);
        expect(shouldWrapWithRtk('git log --oneline -50')).toBe(false);
        expect(shouldWrapWithRtk('git diff --stat HEAD~5..HEAD')).toBe(false);
        expect(shouldWrapWithRtk('git branch -a')).toBe(false);
        expect(shouldWrapWithRtk('npm ls --depth=0')).toBe(false);
        expect(shouldWrapWithRtk('git show --stat HEAD')).toBe(false);
        expect(shouldWrapWithRtk('cargo build')).toBe(false); // unmeasured → never wrapped
    });
});

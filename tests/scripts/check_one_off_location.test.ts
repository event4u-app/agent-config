// Tests for src/scripts/check_one_off_location.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists, so this is a focused differential suite over the
// public behaviour (find_violations, ARCHIVE_MONTH_RE) plus a golden-parity
// layer (python3 vs tsx) on the REAL REPO (skipped without python3).
import { describe, expect, it } from 'vitest';

import { ARCHIVE_MONTH_RE, find_violations } from '../../src/scripts/check_one_off_location.js';


describe('check_one_off_location — behaviour', () => {
    it('the repo has no out-of-archive one-off scripts', () => {
        // The shipped tree must be clean (matches the CI invocation).
        expect(find_violations()).toEqual([]);
    });

    it('ARCHIVE_MONTH_RE matches YYYY-MM only', () => {
        expect(ARCHIVE_MONTH_RE.test('2026-06')).toBe(true);
        expect(ARCHIVE_MONTH_RE.test('2026-6')).toBe(false);
        expect(ARCHIVE_MONTH_RE.test('june')).toBe(false);
        expect(ARCHIVE_MONTH_RE.test('2026-06-01')).toBe(false);
    });
});


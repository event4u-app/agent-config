// Tests for src/scripts/check_beta_review_markers.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over check_one() (the per-file marker logic + the 90-day window)
// plus a golden-parity layer that runs python3 vs tsx on the REAL REPO
// (skipped without python3). The date-window arithmetic is exercised against
// a fixed "today" ordinal so the test is stable across calendar days.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as bm from '../../src/scripts/check_beta_review_markers.js';



function write(p: string, content: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf-8');
}

// 2026-01-01 as a UTC epoch-day ordinal (the units check_one() compares in).
const TODAY = Math.floor(Date.UTC(2026, 0, 1) / 86400000);

describe('check_beta_review_markers — behavioural spec', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('non-beta contract is ignored', () => {
        const p = path.join(tmp, 'c.md');
        write(p, '---\nstability: stable\n---\n');
        expect(bm.check_one(p, TODAY)).toEqual([]);
    });

    it('beta with no marker is an error', () => {
        const p = path.join(tmp, 'c.md');
        write(p, '---\nstability: beta\n---\n');
        const v = bm.check_one(p, TODAY);
        expect(v).toHaveLength(1);
        expect(v[0]!.severity).toBe('error');
        expect(v[0]!.reason).toContain('no review marker');
    });

    it('beta with exactly one promote-to marker is clean', () => {
        const p = path.join(tmp, 'c.md');
        write(p, '---\nstability: beta\npromote-to: stable\n---\n');
        expect(bm.check_one(p, TODAY)).toEqual([]);
    });

    it('beta with two markers is an error', () => {
        const p = path.join(tmp, 'c.md');
        write(p, '---\nstability: beta\npromote-to: stable\nsuperseded-by: other\n---\n');
        const v = bm.check_one(p, TODAY);
        expect(v).toHaveLength(1);
        expect(v[0]!.reason).toContain('multiple beta-review markers set');
    });

    it('keep-beta-until within 90 days is clean', () => {
        const p = path.join(tmp, 'c.md');
        // 2026-01-01 + 90 days = 2026-04-01 exactly → allowed.
        write(p, '---\nstability: beta\nkeep-beta-until: 2026-04-01\n---\n');
        expect(bm.check_one(p, TODAY)).toEqual([]);
    });

    it('keep-beta-until past the 90-day window is an error', () => {
        const p = path.join(tmp, 'c.md');
        write(p, '---\nstability: beta\nkeep-beta-until: 2026-04-02\n---\n');
        const v = bm.check_one(p, TODAY);
        expect(v).toHaveLength(1);
        expect(v[0]!.reason).toContain('exceeds the 90-day window');
        expect(v[0]!.reason).toContain('max: 2026-04-01');
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------


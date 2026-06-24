// Tests for src/scripts/check_trunk_drift.ts (road-to-product-clarity Phase 4b).
import { describe, expect, it } from 'vitest';
import { driftVerdict } from '../../src/scripts/check_trunk_drift.js';

describe('check_trunk_drift — driftVerdict', () => {
    it('passes when origin/main is an ancestor of HEAD', () => {
        expect(driftVerdict({ trunkIsAncestor: true, behind: 0 }).ok).toBe(true);
    });
    it('fails when the branch is behind origin/main', () => {
        const v = driftVerdict({ trunkIsAncestor: false, behind: 3 });
        expect(v.ok).toBe(false);
        expect(v.message).toContain('3 commit');
    });
});

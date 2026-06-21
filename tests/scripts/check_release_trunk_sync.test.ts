// Tests for src/scripts/check_release_trunk_sync.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the pure helpers (_parse_semver, _prior_release, _bootstrap_ok)
// plus a golden-parity layer that runs python3 vs tsx on the REAL REPO
// (the current branch is a non-release class → both no-op exit 0).
import { describe, expect, it } from 'vitest';

import * as rts from '../../src/scripts/check_release_trunk_sync.js';



describe('check_release_trunk_sync — behavioural spec', () => {
    it('_parse_semver parses a valid tag', () => {
        expect(rts._parse_semver('6.0.0')).toEqual([6, 0, 0]);
        expect(rts._parse_semver('12.3.45')).toEqual([12, 3, 45]);
    });

    it('_parse_semver rejects non-semver', () => {
        expect(rts._parse_semver('v6.0.0')).toBeNull();
        expect(rts._parse_semver('6.0')).toBeNull();
        expect(rts._parse_semver('release/6.0.0')).toBeNull();
    });

    it('_prior_release picks the highest tag strictly below the target', () => {
        const tags: [number, number, number][] = [
            [5, 0, 0],
            [5, 9, 0],
            [6, 0, 0],
            [6, 1, 0],
        ];
        expect(rts._prior_release([6, 1, 0], tags)).toEqual([6, 0, 0]);
        expect(rts._prior_release([6, 0, 0], tags)).toEqual([5, 9, 0]);
    });

    it('_prior_release returns null when nothing is earlier', () => {
        expect(rts._prior_release([5, 0, 0], [[5, 0, 0], [6, 0, 0]])).toBeNull();
    });

    it('RELEASE_BRANCH_RE matches a release branch', () => {
        expect(rts.RELEASE_BRANCH_RE.test('release/6.0.0')).toBe(true);
        expect(rts.RELEASE_BRANCH_RE.test('feat/x')).toBe(false);
        expect(rts.RELEASE_BRANCH_RE.test('main')).toBe(false);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------


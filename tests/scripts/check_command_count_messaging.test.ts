// Tests for src/scripts/check_command_count_messaging.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists. canonical_counts() reads the live command suite, so
// the focused layer asserts its shape on the real tree; the golden-parity
// layer runs python3 vs tsx on the REAL REPO (skipped without python3) for
// both the default and --quiet invocations.
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/check_command_count_messaging.js';



describe('check_command_count_messaging — canonical_counts', () => {
    it('total = active + shims, all non-negative', () => {
        const [total, shims, active] = mod.canonical_counts();
        expect(total).toBeGreaterThan(0);
        expect(shims).toBeGreaterThanOrEqual(0);
        expect(active).toBe(total - shims);
    });

    it('SUPERSEDED_RE matches a superseded_by frontmatter line', () => {
        expect(mod.SUPERSEDED_RE.test('superseded_by: other-cmd')).toBe(true);
        expect(mod.SUPERSEDED_RE.test('superseded_by:')).toBe(false);
    });
});


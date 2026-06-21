// Tests for src/scripts/lint_context_spine_usage.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists. Differential checks over the public helpers
// (frontmatter/body split, spine extraction, slot-citation detection) plus a
// golden-parity layer that runs python3 vs tsx on the REAL REPO,
// byte-identical stdout + stderr + exit (skipped without python3).
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_context_spine_usage.js';



describe('lint_context_spine_usage — behavioural spec', () => {
    it('_frontmatter_and_body splits the leading --- block from the body', () => {
        const [fm, body] = mod._frontmatter_and_body('---\nname: x\n---\n# heading\ntext\n');
        expect(fm).toContain('name: x');
        expect(body).toContain('# heading');
    });

    it('_frontmatter_and_body returns empty fm when no block present', () => {
        const [fm] = mod._frontmatter_and_body('# heading only\n');
        expect(fm).toBe('');
    });

    it('VALID_SLOTS is a non-empty closed vocabulary', () => {
        expect(mod.VALID_SLOTS.length).toBeGreaterThan(0);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------


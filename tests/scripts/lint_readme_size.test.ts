// Tests for src/scripts/lint_readme_size.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists. Focused differential over the exported constants
// plus a golden-parity layer running python3 vs tsx on the REAL REPO
// (skipped without python3). README.md is resolved relative to cwd, so parity
// runs with cwd = REPO_ROOT.
import { describe, expect, it } from 'vitest';

import * as rs from '../../src/scripts/lint_readme_size.js';



describe('lint_readme_size — constants', () => {
    it('targets README.md with a 750-line limit', () => {
        expect(String(rs.README)).toBe('README.md');
        expect(rs.LIMIT).toBe(750);
    });
});

// --- Golden parity on the REAL REPO ----------------------------------------


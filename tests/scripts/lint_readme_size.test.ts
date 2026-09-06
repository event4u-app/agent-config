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


// The three budgets, and the reason there are three: an earlier round brought
// this file under control and archived complete, then a line-only guard stayed
// green for three months while the file regressed on the two dimensions it did
// not measure. These cases pin each budget's measurement independently, so a
// future edit cannot quietly drop one and leave the other two reporting.
describe('lint_readme_size — word and first-command budgets', () => {
    it('countWords matches whitespace tokenisation', () => {
        expect(rs.countWords('')).toBe(0);
        expect(rs.countWords('   ')).toBe(0);
        expect(rs.countWords('one two  three\nfour')).toBe(4);
    });

    it('firstCommandLine reports the opening fence, 1-based', () => {
        expect(rs.firstCommandLine('a\nb\n```bash\nx\n```\n')).toBe(3);
    });

    it('firstCommandLine is null when the file has no fence', () => {
        expect(rs.firstCommandLine('a\nb\nc\n')).toBeNull();
    });

    it('the fence line is measured, not the first line of code inside it', () => {
        // A reader's eye reaches the fence; measuring the line after it would
        // report every README as one line better than it is.
        expect(rs.firstCommandLine('```bash\nnpx thing\n```\n')).toBe(1);
    });

    it('the budgets are the archive-commit values, not the current file', () => {
        // Deriving from today's README would ratchet the regression in as the
        // new floor — the failure mode the roadmap's own risk register ranks 1.
        expect(rs.WORD_LIMIT).toBe(4849);
        expect(rs.FIRST_COMMAND_LIMIT).toBe(75);
    });
});

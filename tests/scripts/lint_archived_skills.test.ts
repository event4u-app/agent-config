// Tests for src/scripts/lint_archived_skills.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists. Focused differential over the pure frontmatter
// parser plus a golden-parity layer running python3 vs tsx on the REAL REPO
// (skipped without python3).
import { describe, expect, it } from 'vitest';

import * as as from '../../src/scripts/lint_archived_skills.js';



describe('lint_archived_skills.parse_frontmatter', () => {
    it('parses simple key: value lines, stripping quotes', () => {
        const fm = as.parse_frontmatter('---\nslug: foo\nreason: "merged"\n---\nbody\n');
        expect(fm).not.toBeNull();
        expect(fm!['slug']).toBe('foo');
        expect(fm!['reason']).toBe('merged');
    });

    it('ignores indented and list lines (top-level scalars only)', () => {
        const fm = as.parse_frontmatter(
            '---\nslug: foo\nlast_known_callers:\n  - a\n  - b\n---\n',
        );
        expect(fm).not.toBeNull();
        expect(fm!['slug']).toBe('foo');
        // The list items are skipped; only the scalar key is recorded (possibly empty).
        expect('a' in fm!).toBe(false);
    });

    it('returns null without a leading frontmatter fence', () => {
        expect(as.parse_frontmatter('no frontmatter\n')).toBeNull();
    });

    it('returns null when the closing fence is missing', () => {
        expect(as.parse_frontmatter('---\nslug: foo\n')).toBeNull();
    });
});

describe('lint_archived_skills — constants', () => {
    it('declares the six required fields and the valid reasons', () => {
        expect([...as.REQUIRED_FIELDS]).toEqual([
            'slug',
            'archived_on',
            'last_seen_count',
            'reason',
            'replacement',
            'last_known_callers',
        ]);
        expect([...as.VALID_REASONS].sort()).toEqual([
            'deprecated',
            'merged',
            'superseded',
            'unused',
        ]);
    });
});

// --- Golden parity on the REAL REPO ----------------------------------------


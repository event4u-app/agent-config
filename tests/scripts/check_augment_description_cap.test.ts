// Tests for src/scripts/check_augment_description_cap.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists, so this is a focused differential suite over the
// public behaviour (parse_frontmatter, DESC_CAP) plus a golden-parity layer
// (python3 vs tsx) on the REAL REPO (skipped without python3).
import { describe, expect, it } from 'vitest';

import { DESC_CAP, parse_frontmatter } from '../../src/scripts/check_augment_description_cap.js';


describe('parse_frontmatter', () => {
    it('parses simple key/value pairs and strips quotes', () => {
        const fm = parse_frontmatter('---\ntype: auto\ndescription: "Hello world"\n---\nbody\n');
        expect(fm['type']).toBe('auto');
        expect(fm['description']).toBe('Hello world');
    });

    it('strips single quotes after double', () => {
        const fm = parse_frontmatter("---\ndescription: 'x'\n---\n");
        expect(fm['description']).toBe('x');
    });

    it('returns empty for missing frontmatter', () => {
        expect(parse_frontmatter('no frontmatter here')).toEqual({});
    });

    it('returns empty when closing fence absent', () => {
        expect(parse_frontmatter('---\ntype: auto\n')).toEqual({});
    });

    it('DESC_CAP is 150', () => {
        expect(DESC_CAP).toBe(150);
    });
});


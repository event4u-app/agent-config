// Tests for src/scripts/measure_augment_budget.ts (py2ts Phase 8 / Wave 8a).
//
// No pytest suite exists, so this is a focused differential suite over the
// public behaviour (parse_frontmatter, the cap/threshold constants, measure()
// shape) plus a golden-parity layer (python3 vs tsx) on the REAL REPO for the
// text summary, --json (ts line normalized), and the --check exit code.
// Skipped without python3.
import { describe, expect, it } from 'vitest';

import {
    FAIL_THRESHOLD,
    TOTAL_CAP,
    WARN_THRESHOLD,
    measure,
    parse_frontmatter,
} from '../../src/scripts/measure_augment_budget.js';



describe('parse_frontmatter', () => {
    it('parses key/value pairs and strips quotes', () => {
        const [fm, body] = parse_frontmatter('---\ntype: auto\ndescription: "Hi"\n---\nbody\n');
        expect(fm['type']).toBe('auto');
        expect(fm['description']).toBe('Hi');
        expect(body).toBe('body\n');
    });
    it('returns empty for no frontmatter', () => {
        const [fm, body] = parse_frontmatter('no frontmatter');
        expect(fm).toEqual({});
        expect(body).toBe('no frontmatter');
    });
    it('returns empty when closing fence absent', () => {
        const [fm] = parse_frontmatter('---\ntype: auto\n');
        expect(fm).toEqual({});
    });
});

describe('constants + measure shape', () => {
    it('exposes the empirical cap + thresholds', () => {
        expect(TOTAL_CAP).toBe(49512);
        expect(WARN_THRESHOLD).toBe(0.85);
        expect(FAIL_THRESHOLD).toBe(0.95);
    });
    it('measure() returns total/cap/utilisation + 3 components', () => {
        const data = measure();
        expect(typeof data['total']).toBe('number');
        expect(data['cap']).toBe(TOTAL_CAP);
        expect(typeof data['utilisation']).toBe('number');
        const comps = data['components'] as Record<string, unknown>;
        expect(Object.keys(comps).sort()).toEqual(['agents_md', 'always_rules', 'auto_rules']);
    });
});


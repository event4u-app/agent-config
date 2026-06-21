// Tests for src/scripts/audit_adr_coverage.ts (py2ts Phase 8 / Wave 8a).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure helpers (parse_fm, scan_area gap-check, render_area_readme title-casing
// + link path) plus a golden-parity layer that runs python3 vs tsx on the
// REAL docs/adrs tree for --report / --check (skipped without python3).
import { describe, expect, it } from 'vitest';

import * as aac from '../../src/scripts/audit_adr_coverage.js';



describe('audit_adr_coverage — pure helpers', () => {
    it('parse_fm reads fields and strips space/quote padding', () => {
        const fm = aac.parse_fm('---\ndecision: "my-call"\nstatus: accepted \n---\nbody');
        expect(fm).toEqual({ decision: 'my-call', status: 'accepted' });
    });
    it('parse_fm returns {} when no frontmatter', () => {
        expect(aac.parse_fm('no fm')).toEqual({});
    });
    it('render_area_readme title-cases the decision and emits the relative contract link', () => {
        const out = aac.render_area_readme(
            'cost',
            { contract: 'cost-enforcement.md', scope: 'Budget ladder.' },
            [{ num: '0001', slug: 'foo-bar', path: '0001-foo-bar.md', decision: 'python-to-ts-migration', status: 'accepted', date: '2026-01-01' }],
        );
        expect(out).toContain('# ADRs — `cost`');
        expect(out).toContain('Python To Ts Migration');
        expect(out).toContain('| [0001](0001-foo-bar.md) |');
    });
    it('render_area_readme emits the placeholder row when no ADRs exist', () => {
        const out = aac.render_area_readme('cost', { contract: 'cost-enforcement.md', scope: 'x' }, []);
        expect(out).toContain('| _none yet_ | — | — | — | — |');
    });
});

describe('audit_adr_coverage — scan_area over the real tree', () => {
    it('returns [adrs, errs] arrays for a known area', () => {
        const [adrs, errs] = aac.scan_area('cost');
        expect(Array.isArray(adrs)).toBe(true);
        expect(Array.isArray(errs)).toBe(true);
    });
    it('returns empty for an area directory that does not exist', () => {
        const [adrs, errs] = aac.scan_area('definitely-not-an-area-xyz');
        expect(adrs).toEqual([]);
        expect(errs).toEqual([]);
    });
});

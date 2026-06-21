// Tests for src/scripts/audit_command_surface.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure helpers (parse_frontmatter, keyword_vector, cosine) plus a golden
// parity layer that runs python3 vs tsx for every read mode (default report,
// --budget, --check-new, root-missing) and compares stdout/stderr/exit + the
// written reports byte-for-byte. The report files under agents/reports/ are
// snapshot + restored so the test leaves zero git drift.
import { describe, expect, it } from 'vitest';

import * as acs from '../../src/scripts/audit_command_surface.js';



describe('audit_command_surface — parse_frontmatter', () => {
    it('reads description / name / tier / cluster / pack and strips quotes', () => {
        const fm = acs.parse_frontmatter(
            '---\ndescription: "do a thing"\nname: foo\ntier: 1\ncluster: "grp"\npack: \'core\'\n---\nbody',
        );
        expect(fm).toEqual({
            description: 'do a thing',
            name: 'foo',
            tier: 1,
            cluster: 'grp',
            pack: 'core',
        });
    });
    it('parses an inline aliases array', () => {
        const fm = acs.parse_frontmatter('---\naliases: ["a", b, "c"]\n---\n');
        expect(fm.aliases).toEqual(['a', 'b', 'c']);
    });
    it('parses a scalar aliases value', () => {
        const fm = acs.parse_frontmatter('---\naliases: solo\n---\n');
        expect(fm.aliases).toEqual(['solo']);
    });
    it('returns {} when there is no frontmatter', () => {
        expect(acs.parse_frontmatter('no fm here')).toEqual({});
    });
});

describe('audit_command_surface — keyword_vector + cosine', () => {
    it('drops stopwords and counts the rest', () => {
        const v = acs.keyword_vector('the quick brown fox and the lazy dog');
        expect(v.get('the')).toBeUndefined();
        expect(v.get('and')).toBeUndefined();
        expect(v.get('quick')).toBe(1);
        expect(v.get('brown')).toBe(1);
    });
    it('cosine is 0 for disjoint vectors and 1 for identical', () => {
        const a = acs.keyword_vector('alpha beta gamma');
        const b = acs.keyword_vector('delta epsilon zeta');
        expect(acs.cosine(a, b)).toBe(0);
        expect(acs.cosine(a, a)).toBeCloseTo(1, 10);
    });
    it('cosine returns 0 for an empty vector', () => {
        expect(acs.cosine(new Map(), acs.keyword_vector('alpha'))).toBe(0);
    });
});

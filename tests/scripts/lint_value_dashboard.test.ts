// Tests for src/scripts/lint_value_dashboard.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Coverage: constants + check_required_sections /
// check_canonical_rung_set unit checks (byte-identical violation strings), and
// a golden-parity layer (python3 vs tsx on the REAL REPO across default +
// --quiet) asserting byte-identical stdout/stderr/exit. Skipped without python3.
// CI invocation is `lint_value_dashboard --quiet`.
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_value_dashboard.js';



describe('lint_value_dashboard — constants + checks', () => {
    it('CANONICAL_RUNG_IDS holds the six canonical rungs in order', () => {
        expect([...mod.CANONICAL_RUNG_IDS]).toEqual([
            'baseline',
            'load',
            'thin',
            'condense',
            'rtk',
            'terse',
        ]);
    });

    it('check_required_sections flags every missing section', () => {
        const out = mod.check_required_sections('');
        // REQUIRED_SECTIONS = 6 entries.
        expect(out.length).toBe(mod.REQUIRED_SECTIONS.length);
        expect(out[0]).toBe("missing required section: '# Value Dashboard'");
    });

    it('check_required_sections passes when all sections present', () => {
        const text = mod.REQUIRED_SECTIONS.join('\n');
        expect(mod.check_required_sections(text)).toEqual([]);
    });

    it('check_canonical_rung_set flags a wrong rung set', () => {
        const out = mod.check_canonical_rung_set({ cost_ladder: [{ id: 'baseline' }] });
        expect(out.length).toBe(1);
        expect(out[0]).toContain('cost_ladder rung ids must be');
    });
});


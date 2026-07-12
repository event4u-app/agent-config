// Pure-function tests for the persona-placebo benchmark (Phase 4 invariants).
import { describe, expect, it } from 'vitest';

import {
    FIGURE_MAP,
    load_fixtures,
    mean,
    parse_score,
    system_for,
} from '../../src/scripts/bench_persona_placebo.js';

describe('fixtures', () => {
    it('12 option-shaped fixtures, each with a pre-registered rubric', () => {
        const fx = load_fixtures();
        expect(fx).toHaveLength(12);
        for (const f of fx) {
            expect(f.prompt).toMatch(/\(A\)/);
            expect(f.prompt).toMatch(/\(B\)/);
            expect(f.rubric.length).toBeGreaterThan(40);
        }
    });
});

describe('system_for — the identity-swap invariant', () => {
    const persona = { name: 'contrarian', text: 'METHOD BODY X' };
    it('figure arm holds the method text CONSTANT, only the identity changes', () => {
        const m = system_for('method', persona);
        const f = system_for('figure', persona);
        expect(m).toContain('METHOD BODY X');
        expect(f).toContain('METHOD BODY X');
        expect(f).toContain(FIGURE_MAP['contrarian'] as string);
        expect(m).not.toContain(FIGURE_MAP['contrarian'] as string);
    });
    it('bare arm carries no persona text', () => {
        expect(system_for('bare', persona)).not.toContain('METHOD BODY X');
    });
});

describe('parse_score', () => {
    it('parses 1-10, rejects junk', () => {
        expect(parse_score('SCORE: 7')).toBe(7);
        expect(parse_score('blah SCORE: 10')).toBe(10);
        expect(parse_score('SCORE: 11')).toBeNull();
        expect(parse_score('no score here')).toBeNull();
    });
});

describe('mean', () => {
    it('empty → 0, else arithmetic mean', () => {
        expect(mean([])).toBe(0);
        expect(mean([2, 4, 6])).toBe(4);
    });
});

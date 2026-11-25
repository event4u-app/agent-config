// The built-in deck: every line of a run gets a different angle, the axes are
// spread evenly, and the deal is reproducible from the seed.

import { describe, expect, it } from 'vitest';

import { angleKey, DECK, DECK_SIZE, dealAngles, renderAngle } from '../../../src/scripts/bracket/deck.js';
import { BracketError, renderBrief } from '../../../src/scripts/bracket/engine.js';

describe('the deal', () => {
    it('never repeats an angle, up to the whole deck', () => {
        for (const n of [1, 10, 20, 64, 100, DECK_SIZE]) {
            const keys = dealAngles(n, 7).map(angleKey);
            expect(new Set(keys).size).toBe(n);
        }
    });

    it('spreads each axis evenly — no value is used twice before every value is used once', () => {
        for (const n of [10, 20, 100]) {
            const dealt = dealAngles(n, 3);
            for (const axis of ['reasoning', 'workflow', 'strategy'] as const) {
                const counts = new Map<string, number>();
                for (const c of dealt) counts.set(c[axis].id, (counts.get(c[axis].id) ?? 0) + 1);
                const values = [...counts.values()];
                expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
                expect(counts.size).toBe(Math.min(n, DECK[axis].length));
            }
        }
    });

    it('is reproducible from the seed and differs across seeds', () => {
        expect(dealAngles(20, 11).map(angleKey)).toEqual(dealAngles(20, 11).map(angleKey));
        expect(dealAngles(20, 11).map(angleKey)).not.toEqual(dealAngles(20, 12).map(angleKey));
    });

    it('refuses a run larger than the deck instead of repeating angles silently', () => {
        expect(() => dealAngles(DECK_SIZE + 1, 1)).toThrow(BracketError);
    });

    it('keeps the axis sizes pairwise coprime — the no-repeat guarantee rests on it', () => {
        const sizes = [DECK.reasoning.length, DECK.workflow.length, DECK.strategy.length];
        const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
        for (let i = 0; i < sizes.length; i++) for (let j = i + 1; j < sizes.length; j++) expect(gcd(sizes[i]!, sizes[j]!)).toBe(1);
        const ids = [...DECK.reasoning, ...DECK.workflow, ...DECK.strategy].map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('the brief carries the angle, the task stays verbatim', () => {
    it('renders all three axes and still ends with the task byte for byte', () => {
        const task = 'make the import resumable\n';
        const [angle] = dealAngles(1, 5);
        const brief = renderBrief(task, 'L001', angle!);
        expect(brief.endsWith(task)).toBe(true);
        expect(brief).toContain(angle!.reasoning.name);
        expect(brief).toContain(angle!.workflow.name);
        expect(brief).toContain(angle!.strategy.name);
        expect(renderAngle(angle!)).not.toContain('undefined');
    });
});

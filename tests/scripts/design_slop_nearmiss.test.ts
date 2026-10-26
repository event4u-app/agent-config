// road-to-tells-a-near-miss-can-refute Phase 1: every shipped rule stays at
// M1 = 0 on the near-miss splits, and every shipped rule has a near-miss.
import { describe, expect, it } from 'vitest';

import { isBodySubject, SLOP_RULES } from '../../src/scripts/design_slop_rules.js';
import { loadLabels, scoreAll } from '../../internal/bench/design-slop-nearmiss/run.js';

describe('the near-miss bar', () => {
    const result = scoreAll();

    it('no shipped rule fires on a legitimate near-miss, in either split', () => {
        for (const split of result.splits) expect(split.m1, split.split).toEqual({});
    });

    it('every shipped rule has a near-miss it could have failed on', () => {
        expect(result.uncovered_catalog_ids).toEqual([]);
    });

    it('every label states its signal, basis and author', () => {
        for (const [rel, l] of Object.entries(loadLabels())) {
            expect(l.signal, rel).not.toBe('');
            expect(l.basis, rel).not.toBe('');
            expect(['tune', 'holdout']).toContain(l.split);
        }
    });

    it('the registry is what the bar measured', () => {
        expect(result.rule_count).toBe(SLOP_RULES.length);
    });
});

describe('isBodySubject — the subject of the selector, not any token in it', () => {
    it.each([
        ['p', true],
        ['.article-body', true],
        ['.prose p', true],
        ['.card__content', true],
        ['.article-pullquote', false],
        ['.article-body abbr', false],
        ['.hero h1, .article-body', true],
        ['.btn-label', false],
    ])('%s → %s', (selector, expected) => {
        expect(isBodySubject(selector)).toBe(expected);
    });
});

describe('L4 — numbers inside an ordered list number its steps', () => {
    const l4 = SLOP_RULES.find((r) => r.id === 'slop-l4-numbered-markers')!;
    const run = (content: string) => l4.detect({ content, lines: content.split('\n'), ext: '.html', ctx: { raw: '', has: () => false } });

    it('decorative section markers still fire', () => {
        expect(run('<section><span>01</span>Speed</section><section><span>02</span>Scale</section><section><span>03</span>Trust</section>')).toHaveLength(1);
    });

    it('step numbers inside <ol> do not', () => {
        expect(run('<ol><li><span>01</span>Plug in</li><li><span>02</span>Pair</li><li><span>03</span>Name</li></ol>')).toEqual([]);
    });
});

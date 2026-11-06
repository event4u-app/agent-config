import { describe, expect, it } from 'vitest';

import { calibrationScore, cohenKappa, decideItem, parseRulings, type Ruling } from '../../../internal/bench/code-graph/apply_check.js';

const ruling = (files: Record<string, 'IN' | 'OUT' | 'UNSURE'>, missing: string[] = []): Ruling => ({
    files: Object.entries(files).map(([path, verdict]) => ({ path, verdict })),
    missing: missing.map((path) => ({ path })),
});

describe('decideItem — two of three', () => {
    it('keeps a file two voices put in and drops one only a single voice wants', () => {
        const d = decideItem({
            reader: ['a.php', 'b.php'],
            oracle: ['a.php', 'c.php'],
            judges: { anthropic: ruling({ 'a.php': 'IN', 'b.php': 'OUT', 'c.php': 'IN' }), openai: ruling({ 'a.php': 'IN', 'b.php': 'IN', 'c.php': 'OUT' }) },
        });
        expect(d.files).toEqual(['a.php', 'b.php']);
        expect(d.verdict).toBe('corrected');
        expect(d.split).toEqual(['b.php', 'c.php']);
    });

    it('never counts UNSURE as IN', () => {
        const d = decideItem({ reader: [], oracle: [], judges: { anthropic: ruling({ 'x.php': 'IN' }), openai: ruling({ 'x.php': 'UNSURE' }) } });
        expect(d.files).toEqual([]);
    });

    it('agrees when the result equals the oracle set, order aside', () => {
        const d = decideItem({
            reader: ['b.php', 'a.php'],
            oracle: ['a.php', 'b.php'],
            judges: { anthropic: ruling({ 'a.php': 'IN', 'b.php': 'IN' }), openai: ruling({ 'a.php': 'IN', 'b.php': 'IN' }) },
        });
        expect(d).toMatchObject({ files: ['a.php', 'b.php'], verdict: 'agree', split: [] });
    });

    it('admits a file a judge named missing only when both judges rule it IN in round two', () => {
        const base = { reader: ['a.php'], oracle: [], judges: { anthropic: ruling({ 'a.php': 'IN' }, ['m.php']), openai: ruling({ 'a.php': 'IN' }) } };
        expect(decideItem(base).missingClaims).toEqual(['m.php']);
        expect(decideItem({ ...base, round2: { anthropic: ruling({ 'm.php': 'IN' }), openai: ruling({ 'm.php': 'OUT' }) } }).files).toEqual(['a.php']);
        expect(decideItem({ ...base, round2: { anthropic: ruling({ 'm.php': 'IN' }), openai: ruling({ 'm.php': 'IN' }) } }).files).toEqual(['a.php', 'm.php']);
    });

    it('confirms an empty answer for a negative control', () => {
        expect(decideItem({ reader: [], oracle: [], judges: { anthropic: ruling({}), openai: ruling({}) } })).toMatchObject({ files: [], verdict: 'agree' });
    });
});

describe('parseRulings', () => {
    it('reads the JSON object out of a fenced reply and indexes it by item', () => {
        const text = 'Here:\n```json\n{"items":[{"id":"q-1","files":[{"path":"a.php","verdict":"IN","reason":"r"}],"missing":[]}]}\n```';
        expect(parseRulings(text).get('q-1')?.files[0]?.verdict).toBe('IN');
    });

    it('refuses a reply with no ruling instead of treating it as all-OUT', () => {
        expect(() => parseRulings('I think the analysis is mostly right.')).toThrow(/no ruling/);
    });
});

describe('calibrationScore', () => {
    it('scores a judge against gold: IN on gold is a hit, IN on a decoy a false positive, UNSURE is not IN', () => {
        const s = calibrationScore(
            { 'c-1': { gold: ['g1.php', 'g2.php'], decoys: ['d1.php'] } },
            new Map([['c-1', ruling({ 'g1.php': 'IN', 'g2.php': 'UNSURE', 'd1.php': 'IN' })]]),
        );
        expect(s).toEqual({ gold: 2, decoys: 1, true_in: 1, false_in: 1, recall: 0.5, precision: 0.5 });
    });

    it('counts a candidate the judge never ruled as not IN', () => {
        const s = calibrationScore({ 'c-1': { gold: ['g1.php'], decoys: [] } }, new Map([['c-1', ruling({})]]));
        expect(s.recall).toBe(0);
    });
});

describe('cohenKappa', () => {
    it('is 1 on full agreement and 0 when agreement is what chance predicts', () => {
        expect(cohenKappa([true, false, true, false], [true, false, true, false])).toBe(1);
        expect(cohenKappa([true, true, false, false], [true, false, true, false])).toBe(0);
    });

    it('is null when chance agreement is total, instead of dividing by zero', () => {
        expect(cohenKappa([true, true], [true, true])).toBeNull();
    });
});

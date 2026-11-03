/**
 * A chunk whose model answer does not parse was NOT read.
 *
 * At tree b234d08480 `parseFindings` returned `[]` for truncated JSON and the
 * chunk loop credited the chunk's files as read before parsing, so a cut-off
 * answer and a clean `{"findings":[]}` were indistinguishable in the coverage
 * line. These cases pin the distinction and the per-finding confidence default.
 */
import { describe, expect, it } from 'vitest';

import { applyChunkAnswer, parseFindings, parseFindingsResult } from '../../src/scripts/self_review_gate.js';

const TWO = JSON.stringify({
    findings: [
        { severity: 'high', kind: 'security', title: 'a', detail: 'd', file: 'src/a.ts' },
        { severity: 'low', kind: 'style', title: 'b', detail: 'd' },
    ],
});

describe('parseFindingsResult — parsed vs empty', () => {
    it('truncated JSON is not parsed', () => {
        const r = parseFindingsResult(TWO.slice(0, TWO.length - 20));
        expect(r.parsed).toBe(false);
        expect(r.findings).toEqual([]);
    });

    it('JSON embedded in prose is parsed with both findings', () => {
        const r = parseFindingsResult(`Here is my review:\n${TWO}\nThanks.`);
        expect(r.parsed).toBe(true);
        expect(r.findings).toHaveLength(2);
    });

    it('an explicit empty findings array is parsed, zero findings', () => {
        const r = parseFindingsResult('{"findings":[]}');
        expect(r.parsed).toBe(true);
        expect(r.findings).toEqual([]);
    });

    it('no object at all, or findings not an array, is not parsed', () => {
        expect(parseFindingsResult('no json here').parsed).toBe(false);
        expect(parseFindingsResult('{"findings":"none"}').parsed).toBe(false);
    });

    it('parseFindings stays the findings half of the result', () => {
        expect(parseFindings(TWO)).toEqual(parseFindingsResult(TWO).findings);
    });
});

describe('applyChunkAnswer — coverage credits only parsed chunks', () => {
    const chunk = { text: 'diff', files: ['src/a.ts', 'src/b.ts'] };

    it('an unparseable answer moves every chunk file to unreviewed', () => {
        const state = { findings: [], unreviewed: [], reviewedChunks: 0, filesRead: 0 };
        applyChunkAnswer(state, chunk, '{"findings":[{"severity":"hi');
        expect(state.reviewedChunks).toBe(0);
        expect(state.filesRead).toBe(0);
        expect(state.unreviewed).toEqual([
            { path: 'src/a.ts', reason: 'model output not parseable as the findings shape' },
            { path: 'src/b.ts', reason: 'model output not parseable as the findings shape' },
        ]);
    });

    it('an empty findings answer counts as read', () => {
        const state = { findings: [], unreviewed: [], reviewedChunks: 0, filesRead: 0 };
        applyChunkAnswer(state, chunk, '{"findings":[]}');
        expect(state.reviewedChunks).toBe(1);
        expect(state.filesRead).toBe(2);
        expect(state.unreviewed).toEqual([]);
    });
});

describe('finding confidence — defaulted, never dropped', () => {
    const one = (confidence?: unknown): string =>
        JSON.stringify({
            findings: [
                {
                    severity: 'medium',
                    kind: 'correctness',
                    title: 't',
                    detail: 'd',
                    ...(confidence !== undefined ? { confidence } : {}),
                },
            ],
        });

    it('a missing confidence becomes unverified', () => {
        expect(parseFindings(one())[0]?.confidence).toBe('unverified');
    });

    it('an out-of-vocabulary confidence becomes unverified, finding kept', () => {
        const f = parseFindings(one('high'));
        expect(f).toHaveLength(1);
        expect(f[0]?.confidence).toBe('unverified');
    });

    it('a contract value is kept', () => {
        expect(parseFindings(one('confirmed'))[0]?.confidence).toBe('confirmed');
        expect(parseFindings(one('plausible'))[0]?.confidence).toBe('plausible');
    });
});

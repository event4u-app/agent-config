import { describe, expect, it } from 'vitest';

import { type LabelledRow, parseReachability, seededSample, verdicts } from '../../../internal/bench/code-graph/detector_labels.js';

const row = (key: string, graph: 'fire' | 'quiet' | null, label: boolean | null, subject = 'unopim'): LabelledRow => ({
    subject,
    sha: 's',
    parent: 'p',
    detector: 'silent-catch',
    file: 'a.php',
    line: 1,
    shape: 'catch-empty',
    key,
    graph,
    reason: '',
    edges: [],
    label,
    label_basis: '',
});

describe('detector labels', () => {
    it('reads the adjudicator verdict, and anything malformed as unknown', () => {
        expect(parseReachability('{"reachable": "yes", "path": []}')).toBe(true);
        expect(parseReachability('```json\n{"reachable": "no"}\n```')).toBe(false);
        expect(parseReachability('{"reachable": "unknown"}')).toBeNull();
        expect(parseReachability('I think so')).toBeNull();
    });

    it('draws the same sample from the same seed, without replacement', () => {
        const items = Array.from({ length: 50 }, (_, i) => i);
        const a = seededSample(items, 10, 7);
        expect(seededSample(items, 10, 7)).toEqual(a);
        expect(new Set(a).size).toBe(10);
        expect(seededSample(items, 80, 7)).toHaveLength(50);
    });

    it('decides per detector and subject, leaving unlabelled and unanswered rows out', () => {
        const rows = [
            ...Array.from({ length: 6 }, (_, i) => row(`q${String(i)}`, 'quiet', false)),
            row('u1', 'quiet', null),
            row('n1', null, true),
            row('f1', 'fire', true),
            row('t1', 'quiet', false, 'self'),
        ];
        const v = verdicts(rows);
        expect(Object.keys(v)).toEqual(['silent-catch · self', 'silent-catch · unopim']);
        const u = v['silent-catch · unopim']!;
        expect(u.rows).toBe(9);
        expect(u.labelled).toBe(8);
        expect(u.graph_answered).toBe(8);
        expect(u.verdict.wins).toBe(6);
        expect(u.verdict.losses).toBe(0);
        expect(u.verdict.kind).toBe('pass');
    });
});

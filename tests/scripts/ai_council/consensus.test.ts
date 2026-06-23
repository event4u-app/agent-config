// Tests for src/scripts/ai_council/consensus.ts (py2ts Phase 1).
//
// consensus computes per-finding agreement/convergence (float math → format
// parity) plus best-effort JSON extraction.
import { describe, expect, it } from 'vitest';

import {
    aggregate_scores,
    anonymize_findings,
    anonymize_responses,
    bucket_by_threshold,
    DEFAULT_MINORITY_THRESHOLD,
    DEFAULT_STRONG_THRESHOLD,
    evidence_quality,
    Finding,
    FindingScore,
    parse_findings_response,
    parse_scores_response,
} from '../../../src/scripts/ai_council/consensus.js';

// ── Unit tests ───────────────────────────────────────────────────────

describe('consensus — evidence_quality buckets', () => {
    it('H / M / L thresholds', () => {
        expect(evidence_quality(8.0)).toBe('H');
        expect(evidence_quality(9.5)).toBe('H');
        expect(evidence_quality(7.99)).toBe('M');
        expect(evidence_quality(6.0)).toBe('M');
        expect(evidence_quality(5.99)).toBe('L');
        expect(evidence_quality(0.0)).toBe('L');
    });
});

describe('consensus — aggregate_scores', () => {
    it('drops self-scores; empty → zero metadata', () => {
        const findings = [new Finding('a', 'm1', 'A'), new Finding('b', 'm2', 'B')];
        const scores = [
            new FindingScore('a', 'm1', 10, true, 'self'), // self-score dropped
            new FindingScore('a', 'm2', 8, true, 'good'),
            new FindingScore('a', 'm3', 6, false, 'meh'),
        ];
        const meta = aggregate_scores(findings, scores);
        const a = meta.get('a')!;
        expect(a.scorers).toEqual(['m2', 'm3']);
        expect(a.mean_score).toBe(7.0);
        expect(a.dissent_count).toBe(1);
        expect(a.concur_count).toBe(1);
        expect(a.dissent_reasons).toEqual([['m3', 'meh']]);
        // b has no scorers → all-zero metadata
        const b = meta.get('b')!;
        expect(b.consensus_strength).toBe(0.0);
        expect(b.scorers).toEqual([]);
        expect(b.evidence_quality).toBe('L');
    });
    it('consensus_strength = mean/10 * agree_rate, rounded to 3', () => {
        const findings = [new Finding('x', 'src', 'X')];
        const scores = [
            new FindingScore('x', 'a', 9, true, ''),
            new FindingScore('x', 'b', 6, false, 'no'),
        ];
        const m = aggregate_scores(findings, scores).get('x')!;
        // mean=7.5, agree_rate=0.5, strength=0.375
        expect(m.mean_score).toBe(7.5);
        expect(m.consensus_strength).toBe(0.375);
    });
});

describe('consensus — bucket_by_threshold', () => {
    it('strong > strong threshold; minority gets unscored', () => {
        const findings = [
            new Finding('hi', 's', 'H'),
            new Finding('mid', 's', 'M'),
            new Finding('lo', 's', 'L'),
            new Finding('none', 's', 'N'),
        ];
        const meta = new Map([
            ['hi', aggregate_scores([findings[0]!], [new FindingScore('hi', 'a', 10, true, '')]).get('hi')!],
            ['mid', aggregate_scores([findings[1]!], [new FindingScore('mid', 'a', 5, true, '')]).get('mid')!],
            ['lo', aggregate_scores([findings[2]!], [new FindingScore('lo', 'a', 1, false, '')]).get('lo')!],
        ]);
        const b = bucket_by_threshold(findings, meta);
        expect(b.strong.map((p) => p[0].id)).toEqual(['hi']); // 1.0 > 0.7
        expect(b.findings.map((p) => p[0].id)).toEqual(['mid']); // 0.5 in (0.4, 0.7]
        expect(b.minority.map((p) => p[0].id)).toEqual(['lo', 'none']); // 0.0, and unscored
    });
    it('raises on broken threshold ordering', () => {
        expect(() => bucket_by_threshold([], new Map(), { strong: 0.3, minority: 0.5 })).toThrow(
            /Threshold ordering broken/,
        );
    });
    it('default thresholds are 0.7 / 0.4', () => {
        expect(DEFAULT_STRONG_THRESHOLD).toBe(0.7);
        expect(DEFAULT_MINORITY_THRESHOLD).toBe(0.4);
    });
});

describe('consensus — parsing', () => {
    it('parse_findings_response: fenced + skip bad items', () => {
        const out = parse_findings_response(
            '```json\n[{"id":"x","text":" hi "},{"text":"no id"},{"id":"y","text":"ok"}]\n```',
            { source: 'src1' },
        );
        expect(out.map((f) => [f.id, f.source, f.text])).toEqual([
            ['x', 'src1', 'hi'],
            ['y', 'src1', 'ok'],
        ]);
    });
    it('parse_findings_response: bare array fallback + invalid json → []', () => {
        expect(parse_findings_response('[{"id":"z","text":"zz"}]', { source: 's' }).length).toBe(1);
        expect(parse_findings_response('not json at all', { source: 's' })).toEqual([]);
        expect(parse_findings_response('```json\n{bad}\n```', { source: 's' })).toEqual([]);
    });
    it('parse_scores_response: clamps, falls back id, defaults agree=true', () => {
        const out = parse_scores_response(
            '[{"finding_id":"a","score":12},{"id":"b","score":5.9,"agree":false,"reason":" r "},{"finding_id":"c","score":0}]',
            { scorer: 'sc' },
        );
        // a clamped out (12>10), c clamped out (0<1); b kept (5.9 → int 5)
        expect(out.map((s) => [s.finding_id, s.score, s.agree, s.reason])).toEqual([
            ['b', 5, false, 'r'],
        ]);
    });
    it('parse_scores_response: non-numeric score skipped', () => {
        expect(parse_scores_response('[{"finding_id":"a","score":"hi"}]', { scorer: 'z' })).toEqual([]);
    });
});

describe('consensus — anonymize', () => {
    it('anonymize_findings labels A/B/C in order', () => {
        const m = anonymize_findings([new Finding('a', 's', 'A'), new Finding('b', 's', 'B')]);
        expect([...m.keys()]).toEqual(['Finding-A', 'Finding-B']);
    });
    it('anonymize_responses skips empty, applies persona, preserves order', () => {
        const [text, src] = anonymize_responses(
            [
                ['p:1', ' hi '],
                ['q:2', '   '],
                ['r:3', 'yo'],
            ],
            { persona_labels: new Map([['r:3', 'Contra']]) },
        );
        expect([...text]).toEqual([
            ['Response-A', 'hi'],
            ['Response-B (Contra)', 'yo'],
        ]);
        expect([...src]).toEqual([
            ['Response-A', 'p:1'],
            ['Response-B (Contra)', 'r:3'],
        ]);
    });
});

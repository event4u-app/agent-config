// Scoring for the slim-vs-full end-reviewer verdict comparison
// (road-to-token-economy-dispatch-followup step 3.2a). Pure functions only —
// no CLI call is made here.
import { describe, expect, it } from 'vitest';

import {
    evaluateBar,
    parseReview,
    scoreFixture,
    summarize,
    type ArmOutcome,
    type ScoredFixture,
    type SlimFixtureMeta,
} from '../../src/scripts/_lib/slim_reviewer_score.js';

const planted: SlimFixtureMeta = { id: 'p1', kind: 'planted', contested: false, planted_file: 'src/charge.ts' };
const control: SlimFixtureMeta = { id: 'c1', kind: 'control', contested: true, planted_file: null };

function arm(text: string, usd = 0.1, errored = false): ArmOutcome {
    return { text, usd, errored };
}

describe('parseReview', () => {
    it('reads the verdict and every FINDING line', () => {
        const r = parseReview(
            'blah\nFINDING: src/charge.ts:13 — blocker — hard-coded success\nFINDING: tests/charge.test.ts:8 — note — mock only\nVERDICT: NOT READY',
        );
        expect(r.verdict).toBe('NOT READY');
        expect(r.findings.map((f) => f.file)).toEqual(['src/charge.ts', 'tests/charge.test.ts']);
        expect(r.findings[0]?.severity).toBe('blocker');
    });

    it('reads READY and tolerates markdown emphasis around the verdict', () => {
        expect(parseReview('**VERDICT: READY**').verdict).toBe('READY');
        expect(parseReview('VERDICT: `NOT READY`').verdict).toBe('NOT READY');
    });

    it('takes the LAST verdict line when the text quotes the contract first', () => {
        expect(parseReview('format: VERDICT: READY | NOT READY\n...\nVERDICT: NOT READY').verdict).toBe('NOT READY');
    });

    it('reports UNPARSED when no verdict line exists', () => {
        expect(parseReview('looks fine to me').verdict).toBe('UNPARSED');
    });
});

describe('scoreFixture', () => {
    it('counts a planted defect caught only when NOT READY names the planted file', () => {
        const hit = scoreFixture(planted, arm('FINDING: charge.ts:13 — blocker — stub\nVERDICT: NOT READY'));
        expect(hit.caught).toBe(true);
        const wrongFile = scoreFixture(planted, arm('FINDING: src/other.ts:1 — blocker — x\nVERDICT: NOT READY'));
        expect(wrongFile.caught).toBe(false);
        const ready = scoreFixture(planted, arm('FINDING: src/charge.ts:13 — note — x\nVERDICT: READY'));
        expect(ready.caught).toBe(false);
    });

    it('counts a NOT READY verdict on a control as a false positive, a note-only READY as not', () => {
        expect(scoreFixture(control, arm('VERDICT: NOT READY')).false_positive).toBe(true);
        expect(scoreFixture(control, arm('FINDING: a.ts:1 — note — style\nVERDICT: READY')).false_positive).toBe(false);
    });

    it('scores an errored run as UNPARSED, never as a pass', () => {
        const s = scoreFixture(control, arm('VERDICT: READY', 0, true));
        expect(s.verdict).toBe('UNPARSED');
    });
});

function scored(meta: SlimFixtureMeta, slim: string, full: string, slimUsd = 0.1, fullUsd = 0.5): ScoredFixture {
    return { meta, slim: scoreFixture(meta, arm(slim, slimUsd)), full: scoreFixture(meta, arm(full, fullUsd)) };
}

describe('summarize + evaluateBar', () => {
    const rows: ScoredFixture[] = [
        scored(planted, 'FINDING: charge.ts:1 — blocker — x\nVERDICT: NOT READY', 'FINDING: charge.ts:1 — blocker — x\nVERDICT: NOT READY'),
        scored({ ...planted, id: 'p2' }, 'VERDICT: READY', 'FINDING: charge.ts:2 — blocker — y\nVERDICT: NOT READY'),
        scored(control, 'VERDICT: READY', 'VERDICT: NOT READY'),
        scored({ ...control, id: 'c2', contested: false }, 'VERDICT: READY', 'VERDICT: READY'),
    ];

    it('derives agreement, missed planted defects, contested-control FPs and cost per arm', () => {
        const s = summarize(rows);
        expect(s.fixtures).toBe(4);
        expect(s.agreement).toBe(2);
        expect(s.agreement_rate).toBeCloseTo(0.5);
        expect(s.missed.slim).toEqual(['p2']);
        expect(s.missed.full).toEqual([]);
        expect(s.contested_fp.slim).toEqual([]);
        expect(s.contested_fp.full).toEqual(['c1']);
        expect(s.all_control_fp.full).toEqual(['c1']);
        expect(s.usd.slim).toBeCloseTo(0.4);
        expect(s.usd.full).toBeCloseTo(2.0);
    });

    it('fails the bar on agreement below 0.90 even when slim FPs are lower', () => {
        const v = evaluateBar(summarize(rows), 0.9);
        expect(v.agreement_pass).toBe(false);
        expect(v.fp_pass).toBe(true);
        expect(v.pass).toBe(false);
    });

    it('passes only when agreement >= bar AND slim contested FPs <= full', () => {
        const agree = [
            scored(planted, 'FINDING: charge.ts:1 — blocker — x\nVERDICT: NOT READY', 'FINDING: charge.ts:1 — blocker — x\nVERDICT: NOT READY'),
            scored(control, 'VERDICT: READY', 'VERDICT: READY'),
        ];
        expect(evaluateBar(summarize(agree), 0.9).pass).toBe(true);
        const slimFp = [scored(control, 'VERDICT: NOT READY', 'VERDICT: READY')];
        const v = evaluateBar(summarize(slimFp), 0);
        expect(v.fp_pass).toBe(false);
        expect(v.pass).toBe(false);
    });

    it('counts an UNPARSED pair as a disagreement', () => {
        const s = summarize([scored(control, 'no verdict', 'no verdict either')]);
        expect(s.agreement).toBe(0);
    });
});

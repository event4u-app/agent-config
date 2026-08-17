/**
 * T5's rubric layer — no key, no network, no spend.
 *
 * The judge arrives as an injected function, which is what makes every property
 * below testable at all. Three declared jobs:
 *
 *   1. **The conservative aggregation.** An item is credited only when both
 *      judges credit it. The forbidden outcome is crediting adherence that did
 *      not happen, so every disagreement shape is asserted to score DOWN.
 *   2. **The null paths.** A judge that never returns a complete reading makes
 *      the trial unmeasured. A zero would be a claim about the run; the truth is
 *      a claim about the measurement.
 *   3. **The verdict direction.** `PASS` means the pre-registered test did not
 *      reject in the harmful direction — never "the treatment searched more".
 *      A treatment that scored HIGHER at p<0.05 is asserted to pass without
 *      that being reported as a win.
 */
import { describe, expect, it } from 'vitest';

import {
    SEARCH_RUBRIC_ITEMS,
    askWithRetry,
    evaluateSearchAdherence,
    parseSearchVerdict,
    renderSearchAdherenceSection,
    resolveK2,
    scoreSearchAdherence,
    searchAdherencePrompt,
    type AskFn,
} from '../../src/scripts/_lib/bench_ab_search_adherence.js';

const YES = 'NAMED: yes\nINSPECTED: yes\nJUSTIFIED: yes';
const NO = 'NAMED: no\nINSPECTED: no\nJUSTIFIED: no';
const reading = (t: string) => parseSearchVerdict(t);

describe('searchAdherencePrompt', () => {
    it('carries the task and the transcript, and forbids rewarding brevity', () => {
        const p = searchAdherencePrompt('fix the off-by-one', 'I grepped for an existing helper');
        expect(p).toContain('fix the off-by-one');
        expect(p).toContain('I grepped for an existing helper');
        // Without this instruction a judge could credit a short diff as evidence
        // of a search, which would launder T1 into T5 and destroy the pair's
        // independence.
        expect(p).toMatch(/not reward or penalise how long, short/i);
    });

    it('names every rubric item it will be parsed for', () => {
        const p = searchAdherencePrompt('t', 'x');
        for (const item of SEARCH_RUBRIC_ITEMS) expect(p.toUpperCase()).toContain(item.toUpperCase());
    });
});

describe('parseSearchVerdict', () => {
    it('reads a complete three-line block', () => {
        expect(reading(YES).items).toEqual({ named: true, inspected: true, justified: true });
        expect(reading(YES).complete).toBe(true);
    });

    it('tolerates surrounding prose and casing', () => {
        const r = reading('Sure!\n\nnamed: Yes\nINSPECTED : no\n  Justified: yes\nHope that helps.');
        expect(r.items).toEqual({ named: true, inspected: false, justified: true });
        expect(r.complete).toBe(true);
    });

    it('leaves a missing item null and marks the reading incomplete — it does NOT default to no', () => {
        // Defaulting would convert "the judge did not answer" into "the run did
        // not search", which is the substitution this endpoint exists to avoid.
        const r = reading('NAMED: yes\nINSPECTED: no');
        expect(r.items.justified).toBeNull();
        expect(r.items.justified).not.toBe(false);
        expect(r.complete).toBe(false);
    });

    it('keeps the FIRST answer when a judge restates an item', () => {
        const r = reading('NAMED: yes\nNAMED: no\nINSPECTED: yes\nJUSTIFIED: yes');
        expect(r.items.named).toBe(true);
    });

    it('returns an all-null incomplete reading for junk', () => {
        const r = reading('I cannot answer that.');
        expect(r.complete).toBe(false);
        expect(Object.values(r.items).every((v) => v === null)).toBe(true);
    });
});

describe('resolveK2 — unanimity to credit, one voice to deny', () => {
    it('credits an item only when both judges say yes', () => {
        expect(resolveK2(reading(YES), reading(YES))).toBe(3);
    });

    it('does not credit an item one judge denied', () => {
        expect(resolveK2(reading(YES), reading('NAMED: no\nINSPECTED: yes\nJUSTIFIED: yes'))).toBe(2);
    });

    it('does not credit an item one judge left null', () => {
        expect(resolveK2(reading(YES), reading('NAMED: yes\nINSPECTED: yes'))).toBe(2);
    });

    it('credits nothing when the judges fully disagree', () => {
        expect(resolveK2(reading(YES), reading(NO))).toBe(0);
    });
});

describe('askWithRetry — exactly one retry', () => {
    it('does not retry a complete first answer', () => {
        let calls = 0;
        const ask: AskFn = () => {
            calls += 1;
            return YES;
        };
        expect(askWithRetry(ask, 'p').complete).toBe(true);
        expect(calls).toBe(1);
    });

    it('retries once and keeps the second answer', () => {
        let calls = 0;
        const ask: AskFn = () => {
            calls += 1;
            return calls === 1 ? 'nonsense' : YES;
        };
        expect(askWithRetry(ask, 'p').complete).toBe(true);
        expect(calls).toBe(2);
    });

    it('gives up after the second failure rather than looping', () => {
        let calls = 0;
        const ask: AskFn = () => {
            calls += 1;
            return 'nonsense';
        };
        expect(askWithRetry(ask, 'p').complete).toBe(false);
        expect(calls).toBe(2);
    });

    it('treats a throwing judge as incomplete rather than propagating', () => {
        const ask: AskFn = () => {
            throw new Error('rate limited');
        };
        expect(askWithRetry(ask, 'p').complete).toBe(false);
    });
});

describe('scoreSearchAdherence', () => {
    const ask = (text: string): AskFn => () => text;

    it('scores the fraction both judges credited', () => {
        const r = scoreSearchAdherence({
            asks: [ask(YES), ask('NAMED: yes\nINSPECTED: yes\nJUSTIFIED: no')],
            taskPrompt: 't',
            transcript: 'x',
        });
        expect(r.score).toBeCloseTo(2 / 3, 10);
    });

    it('scores 0 when the judges credit nothing — a real zero is reachable', () => {
        const r = scoreSearchAdherence({ asks: [ask(NO), ask(NO)], taskPrompt: 't', transcript: 'x' });
        expect(r.score).toBe(0);
    });

    it('is UNMEASURED, not zero, when a judge never completes', () => {
        const r = scoreSearchAdherence({ asks: [ask(YES), ask('junk')], taskPrompt: 't', transcript: 'x' });
        expect(r.score).toBeNull();
        expect(r.score).not.toBe(0);
    });

    it('is unmeasured when fewer than k=2 judges are supplied', () => {
        const r = scoreSearchAdherence({ asks: [ask(YES)], taskPrompt: 't', transcript: 'x' });
        expect(r.score).toBeNull();
        expect(r.reason).toMatch(/fewer than k=2/);
    });

    it('is unmeasured when there is no transcript to judge', () => {
        const r = scoreSearchAdherence({ asks: [ask(YES), ask(YES)], taskPrompt: 't', transcript: '   ' });
        expect(r.score).toBeNull();
    });

    it('uses exactly two judges even if more are supplied', () => {
        let third = 0;
        const r = scoreSearchAdherence({
            asks: [ask(YES), ask(YES), () => {
                third += 1;
                return YES;
            }],
            taskPrompt: 't',
            transcript: 'x',
        });
        expect(r.score).toBe(1);
        expect(third).toBe(0);
    });
});

describe('evaluateSearchAdherence — the verdict direction', () => {
    const block = (o: Partial<{ measured: boolean; median_delta: number; wilcoxon_p: number }>) => ({
        measured: true,
        n_pairs: 20,
        median_delta_pct: null,
        median_delta: 0,
        wilcoxon_p: 1,
        ...o,
    });

    it('refuses when adherence fell significantly', () => {
        const v = evaluateSearchAdherence({
            arm_treatment: 'package-ladder',
            arm_baseline: 'package',
            search: block({ median_delta: -0.33, wilcoxon_p: 0.01 }),
        });
        expect(v.verdict).toBe('REFUSED-SEARCH-REGRESSION');
    });

    it('does NOT refuse a fall that missed significance', () => {
        const v = evaluateSearchAdherence({
            arm_treatment: 'a',
            arm_baseline: 'b',
            search: block({ median_delta: -0.33, wilcoxon_p: 0.4 }),
        });
        expect(v.verdict).toBe('PASS');
    });

    it('passes a significant RISE without calling it a win', () => {
        const v = evaluateSearchAdherence({
            arm_treatment: 'a',
            arm_baseline: 'b',
            search: block({ median_delta: 0.33, wilcoxon_p: 0.001 }),
        });
        expect(v.verdict).toBe('PASS');
        expect(v.reason).toMatch(/no significant regression/);
        expect(v.reason).not.toMatch(/win|improve|better/i);
    });

    it('is INCONCLUSIVE, never PASS, when the endpoint was not measured', () => {
        const v = evaluateSearchAdherence({
            arm_treatment: 'a',
            arm_baseline: 'b',
            search: { measured: false, n_pairs: 0, median_delta_pct: null, median_delta: 0, wilcoxon_p: 1 },
        });
        expect(v.verdict).toBe('INCONCLUSIVE');
        expect(v.verdict).not.toBe('PASS');
    });
});

describe('renderSearchAdherenceSection', () => {
    it('states what PASS does and does not mean', () => {
        const out = renderSearchAdherenceSection([
            { arm_treatment: 'a', arm_baseline: 'b', verdict: 'PASS', reason: 'r', search_measured: true },
        ]).join('\n');
        expect(out).toContain('## T5 — search adherence (rubric-judged, k=2)');
        expect(out).toMatch(/not a claim that the treatment searched \*more\*/);
    });

    it('says so rather than rendering an empty table when there is no verdict', () => {
        expect(renderSearchAdherenceSection([]).join('\n')).toMatch(/No comparison produced/);
    });
});

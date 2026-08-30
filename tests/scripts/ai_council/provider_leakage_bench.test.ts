// road-to-inbox-harvest-2026-08-e-council-topology-evidence — Phase 3, steps 3.3 + 3.4.
//
// 3.3 is a MEASUREMENT and it has NOT been run: the bench needs one paid council
// call per item per rater and the CLI daily quota was exhausted when this
// landed. What is tested here is the harness and the gate — the scoring is
// exercised against a scripted rater, which costs nothing and is the only way a
// bench gets regression-tested at all.
//
// 3.4's gate is the reason the two steps share a file. `normalizationGateVerdict`
// makes "no normalization until the bench clears the bar" a function rather than
// a promise, and its most important assertion is the one separating `unrun` from
// `below-bar`: a null is what a measurement returns, and nothing here has
// measured anything.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    binomialUpperTail,
    buildRecognitionPrompt,
    collectGuesses,
    normalizationGateVerdict,
    renderRecognitionReport,
    scoreRecognition,
    type LeakageItem,
    type LeakageOptions,
    type RaterFn,
} from '../../../src/scripts/ai_council/provider_leakage_bench.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SMOKE = path.join(REPO_ROOT, 'internal/bench/council-provider-leakage/smoke-items.json');

const OPTIONS: LeakageOptions = { families: ['anthropic', 'openai', 'google', 'unknown'] };

/** Four items, two of them `anthropic` — a deliberately skewed corpus. */
const ITEMS: LeakageItem[] = [
    { id: 'i1', text: 'body one', true_family: 'anthropic' },
    { id: 'i2', text: 'body two', true_family: 'anthropic' },
    { id: 'i3', text: 'body three', true_family: 'openai' },
    { id: 'i4', text: 'body four', true_family: 'google' },
];

/** Knows the answer — the ceiling case. */
const oracle: RaterFn = (_r, item) => item.true_family;
/** Always says the majority family — recognises nothing, scores 50% on this corpus. */
const constantGuesser: RaterFn = () => 'anthropic';
/** Answers off the closed list — every guess ungradeable. */
const rambler: RaterFn = () => 'it is obviously the big one from california';
/** Declines. */
const abstainer: RaterFn = () => null;

describe('buildRecognitionPrompt — one token from a closed list (3.3)', () => {
    it('shows the closed option list and the body, and asks for nothing else', () => {
        const p = buildRecognitionPrompt(ITEMS[0] as LeakageItem, OPTIONS);
        expect(p).toContain('anthropic, openai, google, unknown');
        expect(p).toContain('body one');
        expect(p).toContain('Do not explain.');
    });

    it('does NOT fence the body — the harness must not add what the live path lacks', () => {
        // Deliberate, and the opposite of step 3.6's decision for the peer-review
        // prompt. This bench measures how RECOGNISABLE a body is; a nonce and a
        // security preamble wrapped around it are a confound the live pass does
        // not carry. The risk fencing buys back is absent here because the answer
        // space is one token matched against a closed list.
        const p = buildRecognitionPrompt(ITEMS[0] as LeakageItem, OPTIONS);
        expect(p).not.toContain('untrusted_content');
    });
});

describe('collectGuesses — an off-list answer is ungradeable, never wrong (3.3)', () => {
    it('an answer outside the closed list is recorded as null', () => {
        const g = collectGuesses(['r'], ITEMS, OPTIONS, rambler);
        expect(g).toHaveLength(4);
        expect(g.every((x) => x.guess === null)).toBe(true);
    });

    it('a declined answer is recorded as null too', () => {
        expect(collectGuesses(['r'], ITEMS, OPTIONS, abstainer).every((x) => x.guess === null)).toBe(true);
    });

    it('every rater sees every item', () => {
        const g = collectGuesses(['r1', 'r2'], ITEMS, OPTIONS, oracle);
        expect(g).toHaveLength(8);
        expect(new Set(g.map((x) => x.rater))).toEqual(new Set(['r1', 'r2']));
    });
});

describe('scoreRecognition — BOTH baselines published (3.3 verify)', () => {
    it('an oracle scores 1.0 and is significant against the stricter bar', () => {
        const r = scoreRecognition('oracle', collectGuesses(['oracle'], ITEMS, OPTIONS, oracle), ITEMS, OPTIONS);
        expect(r.gradeable).toBe(4);
        expect(r.recognition_rate).toBe(1);
        expect(r.chance_uniform).toBe(0.25);
        expect(r.chance_majority).toBe(0.5); // two of four items are anthropic
        expect(r.p_value).not.toBeNull();
        expect(r.p_value as number).toBeLessThan(0.1);
    });

    it('THE POINT — a constant guesser beats uniform chance while recognising nothing', () => {
        // Half right, against a uniform baseline of 25%. Scored against
        // `chance_uniform` alone this reads as leakage. Scored against the
        // majority-class baseline it is exactly chance, which is why both are
        // published and why the test is against the stricter one.
        const r = scoreRecognition(
            'constant',
            collectGuesses(['constant'], ITEMS, OPTIONS, constantGuesser),
            ITEMS,
            OPTIONS,
        );
        expect(r.recognition_rate).toBe(0.5);
        expect(r.recognition_rate as number).toBeGreaterThan(r.chance_uniform);
        expect(r.recognition_rate).toBe(r.chance_majority);
        expect(r.p_value as number).toBeGreaterThan(0.05);
    });

    it('an ungradeable rater has a null rate, not a zero one', () => {
        const r = scoreRecognition('rambler', collectGuesses(['rambler'], ITEMS, OPTIONS, rambler), ITEMS, OPTIONS);
        expect(r.attempted).toBe(4);
        expect(r.gradeable).toBe(0);
        expect(r.recognition_rate).toBeNull();
        expect(r.p_value).toBeNull();
    });

    it('a guess for an unknown item id is dropped rather than graded', () => {
        const r = scoreRecognition(
            'r',
            [{ rater: 'r', item_id: 'not-an-item', guess: 'anthropic' }],
            ITEMS,
            OPTIONS,
        );
        expect(r.gradeable).toBe(0);
    });

    it('scoring is per rater — one rater does not absorb another\'s guesses', () => {
        const guesses = [
            ...collectGuesses(['oracle'], ITEMS, OPTIONS, oracle),
            ...collectGuesses(['abstainer'], ITEMS, OPTIONS, abstainer),
        ];
        expect(scoreRecognition('oracle', guesses, ITEMS, OPTIONS).gradeable).toBe(4);
        expect(scoreRecognition('abstainer', guesses, ITEMS, OPTIONS).gradeable).toBe(0);
    });
});

describe('binomialUpperTail — exact, because n here is small', () => {
    it('P(X >= 0) is 1 and P(X > n) is 0', () => {
        expect(binomialUpperTail(0, 10, 0.5)).toBe(1);
        expect(binomialUpperTail(11, 10, 0.5)).toBeCloseTo(0, 12);
    });

    it('matches the hand-computable case P(X >= 2 | n=2, p=0.5) = 0.25', () => {
        expect(binomialUpperTail(2, 2, 0.5)).toBeCloseTo(0.25, 10);
    });

    it('P(X >= 1 | n=2, p=0.5) = 0.75', () => {
        expect(binomialUpperTail(1, 2, 0.5)).toBeCloseTo(0.75, 10);
    });

    it('is monotone decreasing in k', () => {
        const tails = [0, 1, 2, 3, 4, 5].map((k) => binomialUpperTail(k, 5, 0.3));
        for (let i = 1; i < tails.length; i += 1) {
            expect(tails[i] as number).toBeLessThanOrEqual(tails[i - 1] as number);
        }
    });

    it('an empty trial count returns 1 rather than dividing by nothing', () => {
        expect(binomialUpperTail(1, 0, 0.5)).toBe(1);
    });
});

describe('normalizationGateVerdict — step 3.4 is a function, not a promise', () => {
    it('NO DATA is `unrun`, and specifically NOT `below-bar`', () => {
        // The distinction the whole step rests on. `below-bar` asserts that
        // something was measured and found harmless; nothing was measured.
        const v = normalizationGateVerdict({ recognition: [], distortion_correlated: null });
        expect(v.verdict).toBe('unrun');
        expect(v.reason).toContain('has not been run');
    });

    it('rows that attempted but graded nothing are still `unrun`', () => {
        const r = scoreRecognition('rambler', collectGuesses(['rambler'], ITEMS, OPTIONS, rambler), ITEMS, OPTIONS);
        expect(normalizationGateVerdict({ recognition: [r], distortion_correlated: true }).verdict).toBe('unrun');
    });

    it('at-chance recognition is `below-bar` — condition 1 fails', () => {
        const r = scoreRecognition(
            'constant',
            collectGuesses(['constant'], ITEMS, OPTIONS, constantGuesser),
            ITEMS,
            OPTIONS,
        );
        const v = normalizationGateVerdict({ recognition: [r], distortion_correlated: true });
        expect(v.verdict).toBe('below-bar');
        expect(v.reason).toContain('condition 1');
    });

    it('above-chance recognition with an UNRUN distortion arm is `unrun`, not a pass', () => {
        const strong = { ...significantRow(), p_value: 0.001 };
        const v = normalizationGateVerdict({ recognition: [strong], distortion_correlated: null });
        expect(v.verdict).toBe('unrun');
        expect(v.reason).toContain('condition 2 unmeasured');
    });

    it('above-chance recognition that does NOT distort judgment is `below-bar`', () => {
        const v = normalizationGateVerdict({
            recognition: [{ ...significantRow(), p_value: 0.001 }],
            distortion_correlated: false,
        });
        expect(v.verdict).toBe('below-bar');
        expect(v.reason).toContain('condition 2');
    });

    it('both conditions met is the ONLY way to reach `bar-cleared`', () => {
        const v = normalizationGateVerdict({
            recognition: [{ ...significantRow(), p_value: 0.001 }],
            distortion_correlated: true,
        });
        expect(v.verdict).toBe('bar-cleared');
    });

    it('alpha is honoured — a p just above it does not clear condition 1', () => {
        const row = { ...significantRow(), p_value: 0.04 };
        expect(normalizationGateVerdict({ recognition: [row], distortion_correlated: true }).verdict).toBe(
            'bar-cleared',
        );
        expect(
            normalizationGateVerdict({ recognition: [row], distortion_correlated: true, alpha: 0.01 }).verdict,
        ).toBe('below-bar');
    });

    function significantRow() {
        return scoreRecognition('oracle', collectGuesses(['oracle'], ITEMS, OPTIONS, oracle), ITEMS, OPTIONS);
    }
});

describe('renderRecognitionReport — the published block (3.3 verify)', () => {
    it('carries the recognition rate AND both chance baselines', () => {
        const r = scoreRecognition('oracle', collectGuesses(['oracle'], ITEMS, OPTIONS, oracle), ITEMS, OPTIONS);
        const out = renderRecognitionReport([r]);
        expect(out).toContain('recognition · oracle');
        expect(out).toContain('chance uniform');
        expect(out).toContain('chance majority-class');
        expect(out).toContain('p=');
    });

    it('an empty result set says NOT RUN rather than printing an empty table', () => {
        expect(renderRecognitionReport([])).toContain('NOT RUN');
    });
});

describe('smoke fixture — committed, synthetic, and self-declaring (3.3)', () => {
    // The fixture exists to exercise the harness. It must never be mistaken for
    // a corpus: hand-written prose has no provider house style, so a rate over
    // it describes the fixture author. The `synthetic` flag is what lets a live
    // runner refuse it, so its presence is asserted rather than assumed.
    const raw = JSON.parse(fs.readFileSync(SMOKE, 'utf-8')) as {
        synthetic: boolean;
        families: string[];
        items: LeakageItem[];
        why_synthetic_cannot_measure: string;
    };

    it('declares itself synthetic and says why that blocks measurement', () => {
        expect(raw.synthetic).toBe(true);
        expect(raw.why_synthetic_cannot_measure.length).toBeGreaterThan(40);
    });

    it('every item names a family from its own closed list', () => {
        expect(raw.items.length).toBeGreaterThanOrEqual(6);
        for (const i of raw.items) {
            expect(raw.families, `item ${i.id} names a family off the list`).toContain(i.true_family);
            expect(i.text.length).toBeGreaterThan(20);
        }
    });

    it('item ids are unique — a duplicate would double-grade one body', () => {
        expect(new Set(raw.items.map((i) => i.id)).size).toBe(raw.items.length);
    });

    it('drives the harness end to end against a scripted rater', () => {
        const opts: LeakageOptions = { families: raw.families };
        const g = collectGuesses(['scripted'], raw.items, opts, (_r, item) => item.true_family);
        const r = scoreRecognition('scripted', g, raw.items, opts);
        expect(r.recognition_rate).toBe(1);
        // …and the gate still refuses, because a synthetic corpus is not a
        // measurement however cleanly it scores.
        expect(normalizationGateVerdict({ recognition: [r], distortion_correlated: null }).verdict).toBe('unrun');
    });
});

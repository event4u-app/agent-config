import { describe, expect, it } from 'vitest';

import {
    decisionCapWarnings,
    oversizedSteps,
    staleHeld,
    stepSizeProblems,
    STEP_WORD_CAP,
} from '../../src/scripts/_lib/roadmap_step_size.js';

const words = (n: number): string => Array.from({ length: n }, (_, i) => `w${String(i)}`).join(' ');

const roadmap = (stepWords: number): string =>
    [
        '## Phase 1',
        '',
        `- [ ] **1.1 Short step.** ${words(20)}`,
        `      verify: ${words(5)}`,
        `- [x] **1.2 Big step.** ${words(stepWords)}`,
        `      continued ${words(10)} <!-- receipt: class=R0 · shadow · ${words(40)} -->`,
        '',
        '## Phase 2',
        `- [ ] **2.1 Next.** ${words(3)}`,
    ].join('\n');

describe('roadmap step size', () => {
    it(`the cap is ${String(STEP_WORD_CAP)} words, continuation lines included, comments excluded`, () => {
        expect(STEP_WORD_CAP).toBe(150);
        const over = oversizedSteps('road-to-x.md', roadmap(400));
        expect(over.map((s) => s.key)).toEqual(['road-to-x.md#1.2']);
        expect(over[0]?.words).toBeGreaterThan(400);
        expect(oversizedSteps('road-to-x.md', roadmap(100))).toEqual([]);
    });

    it('fails a planted 400-word step that the baseline does not hold', () => {
        expect(stepSizeProblems('road-to-x.md', roadmap(400), new Set())).toHaveLength(1);
    });

    it('a step held by the baseline passes, so today\'s tree is grandfathered', () => {
        expect(stepSizeProblems('road-to-x.md', roadmap(400), new Set(['road-to-x.md#1.2']))).toEqual([]);
    });

    it('a blank line inside the indented continuation does not end the step', () => {
        const text = ['- [ ] **3.1 Split.** ' + words(20), '', `      ${words(200)}`, '', '- [ ] **3.2 Next.** x'].join('\n');
        expect(oversizedSteps('road-to-y.md', text).map((s) => s.key)).toEqual(['road-to-y.md#3.1']);
    });

    it('reports a held key whose step now fits, so the baseline shrinks', () => {
        const held = new Set(['road-to-x.md#1.2', 'road-to-x.md#1.1', 'road-to-other.md#9.9']);
        expect(staleHeld('road-to-x.md', roadmap(100), held)).toEqual(['road-to-x.md#1.1', 'road-to-x.md#1.2']);
        expect(staleHeld('road-to-x.md', roadmap(400), held)).toEqual(['road-to-x.md#1.1']);
    });

    it('a held step may shrink but never grow past its recorded size', () => {
        const held = new Set(['road-to-x.md#1.2']);
        const size = oversizedSteps('road-to-x.md', roadmap(400))[0]!.words;
        const ceilings = new Map([['road-to-x.md#1.2', size]]);
        expect(stepSizeProblems('road-to-x.md', roadmap(400), held, ceilings)).toEqual([]);
        expect(stepSizeProblems('road-to-x.md', roadmap(300), held, ceilings)).toEqual([]);
        const grown = stepSizeProblems('road-to-x.md', roadmap(450), held, ceilings);
        expect(grown).toHaveLength(1);
        expect(grown[0]).toMatch(/held step 1\.2 grew/);
    });

    it('warns on a step citing more than ten distinct decisions, not on ten', () => {
        const ids = (n: number): string => Array.from({ length: n }, (_, i) => `D${String(i + 1)}`).join(', ');
        const text = (n: number): string => `- [ ] **7.1 Classify.** Per ${ids(n)} and again D1.`;
        expect(decisionCapWarnings('road-to-x.md', text(10))).toEqual([]);
        expect(decisionCapWarnings('road-to-x.md', text(11))).toEqual([
            'step 7.1 cites 11 decisions (cap 10) — cut wrong: split it, do not extend it',
        ]);
    });
});

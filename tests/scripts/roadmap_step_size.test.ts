import { describe, expect, it } from 'vitest';

import { oversizedSteps, stepSizeProblems, STEP_WORD_CAP } from '../../src/scripts/_lib/roadmap_step_size.js';

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
});

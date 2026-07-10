import { describe, expect, it } from 'vitest';

import {
    classifyBlocking,
    gateVerdict,
    isReviewablePath,
    renderReview,
    type Finding,
} from './self_review_gate.js';

const f = (severity: Finding['severity'], kind: Finding['kind']): Finding => ({
    severity,
    kind,
    title: `${severity} ${kind}`,
    detail: 'x',
});

describe('classifyBlocking', () => {
    it('blocks security + high and claim + critical', () => {
        expect(classifyBlocking(f('high', 'security'))).toBe(true);
        expect(classifyBlocking(f('critical', 'claim'))).toBe(true);
    });
    it('does not block low/medium security, or any style/correctness', () => {
        expect(classifyBlocking(f('medium', 'security'))).toBe(false);
        expect(classifyBlocking(f('low', 'claim'))).toBe(false);
        expect(classifyBlocking(f('critical', 'style'))).toBe(false);
        expect(classifyBlocking(f('high', 'correctness'))).toBe(false);
    });
});

describe('gateVerdict', () => {
    const blocking = [f('high', 'security')];
    it('advisory (default shipped mode) never blocks, even with a blocking finding', () => {
        expect(gateVerdict(blocking, { enforce: false })).toBe(0);
    });
    it('enforce blocks only on a merge-blocking finding', () => {
        expect(gateVerdict(blocking, { enforce: true })).toBe(2);
        expect(gateVerdict([f('critical', 'style')], { enforce: true })).toBe(0);
        expect(gateVerdict([], { enforce: true })).toBe(0);
    });
});

describe('isReviewablePath', () => {
    it('skips generated projections + lockfiles, keeps source', () => {
        expect(isReviewablePath('dist/agent-src/skills/x/SKILL.md')).toBe(false);
        expect(isReviewablePath('.augment/rules/x.md')).toBe(false);
        expect(isReviewablePath('.windsurfrules')).toBe(false);
        expect(isReviewablePath('package-lock.json')).toBe(false);
        expect(isReviewablePath('src/rules/x.md')).toBe(true);
        expect(isReviewablePath('src/scripts/y.ts')).toBe(true);
    });
});

describe('renderReview', () => {
    it('carries the HUMAN REVIEW REQUIRED banner + the floor-not-human-review caveat', () => {
        const out = renderReview([], false);
        expect(out).toContain('HUMAN REVIEW REQUIRED');
        expect(out).toContain('not** independent human review');
    });
    it('advisory phrasing says WOULD block, enforce phrasing says blocking', () => {
        const blocking = [f('high', 'security')];
        expect(renderReview(blocking, false)).toContain('WOULD block');
        expect(renderReview(blocking, true)).toContain('merge-blocking');
    });
});

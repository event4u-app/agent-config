import { describe, expect, it } from 'vitest';

import {
    LARGE_DIFF_LINES,
    classifyBlocking,
    escalationReasons,
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
    it('labels each row (Blocking)/(Advisory) so a critical-but-non-blocking row never reads as inconsistent with the count', () => {
        const findings = [f('critical', 'correctness'), f('critical', 'security')];
        const out = renderReview(findings, false);
        // critical × correctness is NOT blocking → labelled Advisory
        expect(out).toContain('| critical (Advisory) | correctness |');
        // critical × security IS blocking → labelled Blocking
        expect(out).toContain('| critical (Blocking) | security |');
        // verdict count matches the number of (Blocking) rows (exactly 1)
        expect(out).toContain('1 finding(s) WOULD block');
        expect((out.match(/\(Blocking\)/g) ?? []).length).toBe(1);
    });
});

describe('escalationReasons', () => {
    it('flags a large diff at or above the threshold', () => {
        expect(escalationReasons(['src/a.ts'], LARGE_DIFF_LINES)).toEqual([
            `large diff (${LARGE_DIFF_LINES} changed lines ≥ ${LARGE_DIFF_LINES})`,
        ]);
    });
    it('does not flag a small non-claim diff', () => {
        expect(escalationReasons(['src/a.ts'], LARGE_DIFF_LINES - 1)).toEqual([]);
    });
    it('flags a claim-ledger surface regardless of size', () => {
        expect(escalationReasons(['docs/CLAIMS.md'], 1)).toEqual([
            'claim-affecting surface touched (docs/CLAIMS.md)',
        ]);
        expect(escalationReasons(['docs/proof.md'], 1)[0]).toContain('docs/proof.md');
        expect(escalationReasons(['docs/comparison.yaml'], 1)[0]).toContain('docs/comparison.yaml');
        expect(escalationReasons(['README.md'], 1)[0]).toContain('README.md');
    });
    it('reports both reasons when a large diff also touches a claim surface', () => {
        const r = escalationReasons(['docs/CLAIMS.md', 'src/big.ts'], LARGE_DIFF_LINES + 50);
        expect(r).toHaveLength(2);
        expect(r[0]).toContain('large diff');
        expect(r[1]).toContain('claim-affecting');
    });
});

describe('renderReview — escalation banner', () => {
    const f = (severity: Finding['severity'], kind: Finding['kind']): Finding => ({
        severity, kind, title: 't', detail: 'd',
    });
    it('appends the escalation recommendation when reasons are present', () => {
        const out = renderReview([], false, ['large diff (500 changed lines ≥ 400)']);
        expect(out).toContain('Escalation warranted');
        expect(out).toContain('/council:pr');
        expect(out).toContain('never');
    });
    it('omits the escalation block when there are no reasons (byte-identical to no-arg)', () => {
        const findings = [f('high', 'security')];
        expect(renderReview(findings, false, [])).toBe(renderReview(findings, false));
    });
    it('recommends escalation even on a clean (no-finding) large diff', () => {
        const out = renderReview([], false, ['large diff (500 changed lines ≥ 400)']);
        expect(out).toContain('no findings');
        expect(out).toContain('Escalation warranted');
    });
});

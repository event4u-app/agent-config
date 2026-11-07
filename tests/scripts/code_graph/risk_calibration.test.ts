import { describe, expect, it } from 'vitest';

import {
    acc20,
    bootstrapLower,
    evaluateSubject,
    isFixMessage,
    isNoChange,
    isProductionSource,
    popt,
    prng,
    proposal,
    rankUnits,
    S0,
    scoreOf,
    WITH_GAP,
    type SubjectEval,
    type Unit,
} from '../../../internal/bench/code-graph/risk_calibration.js';

const unit = (sha: string, effort: number, counts: Record<string, number> = {}, untested = 0, day = 1): Unit => ({
    sha,
    parent: `${sha}^`,
    date: new Date(Date.UTC(2026, 0, day)).toISOString(),
    subject: 's',
    effort,
    counts,
    unknown: [],
    untested,
});

describe('the fix rule', () => {
    it('accepts a conventional fix type or a fix word, and nothing else', () => {
        for (const s of ['fix(code-graph): resolve parent::', 'fix: typo', 'Fixed product import crash', 'Bugfix for SKU export', 'hotfix login']) expect(isFixMessage(s)).toBe(true);
        for (const s of ['feat: add map', 'docs(roadmap): prefix', 'refactor: affix helper']) expect(isFixMessage(s)).toBe(false);
    });

    it('counts only production source of the subject language', () => {
        expect(isProductionSource('unopim', 'packages/Webkul/Product/src/Repo.php')).toBe(true);
        expect(isProductionSource('unopim', 'tests/Feature/RepoTest.php')).toBe(false);
        expect(isProductionSource('self', 'src/scripts/code_graph/build.ts')).toBe(true);
        expect(isProductionSource('self', 'src/scripts/code_graph/build.md')).toBe(false);
    });
});

describe('effort-aware ranking and metrics', () => {
    const units = [unit('a', 10, { callers: 2 }), unit('b', 100, { callers: 2 }), unit('c', 10), unit('d', 80)];

    it('ranks by score per changed line, ties to the smaller change', () => {
        expect(rankUnits(units, (u) => scoreOf(u, S0)).map((u) => u.sha)).toEqual(['a', 'b', 'c', 'd']);
    });

    it('reads Popt 1 for the optimal order and 0 for the worst', () => {
        const def = new Set(['a']);
        expect(popt(rankUnits(units, (u) => scoreOf(u, S0)), def)).toBeCloseTo(1, 6);
        const worst = [...units].sort((x, y) => (def.has(x.sha) ? 1 : 0) - (def.has(y.sha) ? 1 : 0) || y.effort - x.effort);
        expect(popt(worst, def)).toBeCloseTo(0, 6);
        expect(popt(units, new Set())).toBeNull();
    });

    it('counts defective units inside the first 20 % of effort, never a unit crossing it', () => {
        const order = rankUnits(units, (u) => scoreOf(u, S0));
        expect(acc20(order, new Set(['a']))).toBe(1);
        expect(acc20(order, new Set(['b']))).toBe(0);
    });

    it('adds the test gap only through its own weight', () => {
        const u = unit('x', 10, { callers: 1, 'entry points': 1 }, 3);
        expect(scoreOf(u, S0)).toBe(4);
        expect(scoreOf(u, WITH_GAP)).toBe(4 + 2 * 3);
    });
});

describe('the bootstrap', () => {
    it('is reproducible from the seed', () => {
        const r1 = prng(7);
        const r2 = prng(7);
        expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
        const us = Array.from({ length: 30 }, (_, i) => unit(`u${String(i)}`, 10 + i, { callers: i % 3 }, 0, i + 1));
        const def = new Set(['u3', 'u9', 'u21']);
        expect(bootstrapLower(us, def, WITH_GAP, S0, 50, 1)).toBe(bootstrapLower(us, def, WITH_GAP, S0, 50, 1));
    });
});

describe('decisions', () => {
    const eval_ = (subject: string, verdict: 'dispensable' | 'contributes' | 'no evidence', helps: boolean): SubjectEval => ({
        subject,
        units: 0,
        defective: 0,
        validation: 0,
        test: 0,
        term: Object.fromEntries(['callers', 'entry points', 'flows', 'missing partners', 'area crossings', 'columns', 'operations', 'pipelines'].map((t) => [t, { verdict: t === 'flows' ? verdict : 'contributes', popt_delta: 0, lower: 0, fires: 1, unknown_share: 0 }])),
        gap: { popt_delta: 0, lower: helps ? 0.01 : -0.01, helps },
    });

    it('removes a term only when it is dispensable in every subject', () => {
        expect(proposal([eval_('a', 'dispensable', false), eval_('b', 'dispensable', false)]).weights.flows).toBeUndefined();
        expect(proposal([eval_('a', 'dispensable', false), eval_('b', 'contributes', false)]).weights.flows).toBe(2);
        expect(proposal([eval_('a', 'dispensable', false), eval_('b', 'no evidence', false)]).weights.flows).toBe(2);
        expect(isNoChange(proposal([eval_('a', 'contributes', false), eval_('b', 'contributes', false)]))).toBe(true);
    });

    it('adds the test gap only when it helps in every subject', () => {
        expect(proposal([eval_('a', 'contributes', true), eval_('b', 'contributes', true)]).gap).toBe(2);
        expect(proposal([eval_('a', 'contributes', true), eval_('b', 'contributes', false)]).gap).toBe(0);
    });

    it('reports a term that never fires as no evidence, not as dispensable', () => {
        const us = Array.from({ length: 20 }, (_, i) => unit(`u${String(i)}`, 10 + i, { callers: i % 4 }, 0, i + 1));
        const e = evaluateSubject('s', us, new Set(['u2', 'u5']), { bootstrap: 20 });
        expect(e.term['pipelines']?.verdict).toBe('no evidence');
        expect(e.validation).toBe(12);
        expect(e.test).toBe(8);
    });
});

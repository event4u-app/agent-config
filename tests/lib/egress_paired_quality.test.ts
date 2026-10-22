/**
 * The scorers of PREREG endpoint (e) must reject planted wrong answers before a
 * green reading counts (PREREG § Falsification): a review answer naming the
 * wrong line or kind, and a coding answer that copies the example or carries a
 * bug. The arm-B pre-check must reject an unreplaced input, and the verdict
 * wiring must report a planted all-loss set as a regression.
 */
import { describe, expect, it } from 'vitest';

import { buildPairs, pairedDeltas, precheck } from '../../internal/bench/egress-paired-quality/run.js';
import { type CodingTask, generateTasks, type ReviewTask, scoreCoding, scoreReview } from '../../internal/bench/egress-paired-quality/tasks.js';
import { decidePairedVerdict } from '../../src/scripts/_lib/paired_verdict.js';

const tasks = generateTasks();
const review = tasks.filter((t): t is ReviewTask => t.family === 'review');
const coding = tasks.filter((t): t is CodingTask => t.family === 'coding');

const REFERENCE: Record<string, string> = {
    formatContact: 'function formatContact(r) { return `${r.name} <${r.email}>`; }',
    normalizePhone: "function normalizePhone(s) { return s.replace(/[\\s().\\-/]+/g, ''); }",
    ibanCountry: 'function ibanCountry(s) { return s.trim().slice(0, 2).toUpperCase(); }',
    countByDomain: "function countByDomain(es) { const o = {}; for (const e of es) { const d = e.split('@')[1].toLowerCase(); o[d] = (o[d] || 0) + 1; } return o; }",
    lastFour: "function lastFour(c) { return c.replace(/\\D/g, '').slice(-4); }",
    totalByIban: "function totalByIban(ps) { const o = {}; for (const p of ps) { const k = p.iban.replace(/\\s+/g, '').toUpperCase(); o[k] = (o[k] || 0) + p.cents; } return o; }",
};

const BUGGY: Record<string, string> = {
    formatContact: 'function formatContact(r) { return `${r.name} (${r.email})`; }',
    normalizePhone: "function normalizePhone(s) { return s.replace(/ /g, ''); }",
    ibanCountry: 'function ibanCountry(s) { return s.slice(0, 2); }',
    countByDomain: "function countByDomain(es) { const o = {}; for (const e of es) { const d = e.split('@')[1]; o[d] = (o[d] || 0) + 1; } return o; }",
    lastFour: 'function lastFour(c) { return c.slice(-4); }',
    totalByIban: "function totalByIban(ps) { const o = {}; for (const p of ps) { o[p.iban] = (o[p.iban] || 0) + p.cents; } return o; }",
};

const js = (code: string): string => `\`\`\`javascript\n${code}\n\`\`\``;

describe('review scorer', () => {
    it('accepts the planted answer, bare or in one json fence', () => {
        for (const t of review) {
            expect(scoreReview(JSON.stringify({ line: t.line, kind: t.kind }), t)).toBe(true);
            expect(scoreReview(`\`\`\`json\n{"line": ${String(t.line)}, "kind": "${t.kind}"}\n\`\`\``, t)).toBe(true);
        }
    });

    it('rejects planted wrong answers', () => {
        for (const t of review) {
            const otherKind = t.kind === 'off-by-one' ? 'wrong-operator' : 'off-by-one';
            expect(scoreReview(JSON.stringify({ line: t.line + 1, kind: t.kind }), t)).toBe(false);
            expect(scoreReview(JSON.stringify({ line: t.line, kind: otherKind }), t)).toBe(false);
            expect(scoreReview(`${JSON.stringify({ line: t.line, kind: t.kind })}\n${JSON.stringify({ line: 1, kind: otherKind })}`, t)).toBe(false);
            expect(scoreReview(`The defect is on line ${String(t.line)}: ${t.kind}.`, t)).toBe(false);
            expect(scoreReview(JSON.stringify({ line: t.line, kind: t.kind, note: 'x' }), t)).toBe(false);
            expect(scoreReview(JSON.stringify({ line: String(t.line), kind: t.kind }), t)).toBe(false);
        }
    });
});

describe('coding scorer', () => {
    it('accepts a reference solution for every coding task', () => {
        for (const t of coding) expect(scoreCoding(js(REFERENCE[t.fn] as string), t), t.id).toBe(true);
    });

    it('rejects a copied example, a buggy solution, a missing block and a wrong name', () => {
        for (const t of coding) {
            const hardcoded = `function ${t.fn}() { return ${JSON.stringify(t.cases[0]?.expected)}; }`;
            expect(scoreCoding(js(hardcoded), t), `${t.id} hardcoded`).toBe(false);
            expect(scoreCoding(js(BUGGY[t.fn] as string), t), `${t.id} buggy`).toBe(false);
            expect(scoreCoding(REFERENCE[t.fn] as string, t)).toBe(false);
            expect(scoreCoding(js((REFERENCE[t.fn] as string).replace(t.fn, `${t.fn}X`)), t)).toBe(false);
            expect(scoreCoding(js('while (true) {}'), t)).toBe(false);
        }
    });
});

describe('arm-B pre-check', () => {
    it('passes every built pair and rejects an unreplaced arm B', () => {
        const { pairs, rejected } = buildPairs();
        expect(rejected).toEqual([]);
        expect(pairs.length).toBe(60);
        for (const p of pairs) {
            expect(precheck(p.task, p.input.B)).toBeNull();
            expect(precheck(p.task, p.input.A)).not.toBeNull();
        }
    });
});

describe('verdict wiring', () => {
    it('reports a planted all-loss set as a regression and a tie set as underpowered', () => {
        const rows = (fail: boolean) =>
            Array.from({ length: 10 }, (_v, i) => [
                { pair_id: `p${String(i)}`, family: 'review' as const, arm: 'A' as const, pass: true },
                { pair_id: `p${String(i)}`, family: 'review' as const, arm: 'B' as const, pass: !fail },
            ]).flat();
        expect(decidePairedVerdict({ deltas: pairedDeltas(rows(true)).deltas }).kind).toBe('regression');
        expect(decidePairedVerdict({ deltas: pairedDeltas(rows(false)).deltas }).kind).toBe('underpowered');
    });
});

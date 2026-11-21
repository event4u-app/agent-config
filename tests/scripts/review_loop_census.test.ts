import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildCensus, renderCensusMarkdown } from '../../src/scripts/review_loop_census.ts';

let root: string;

function write(rel: string, body: string): void {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body, 'utf-8');
}

function findings(date: string, rows: Array<[string, string]>): string {
    const lines = [
        '# Findings: x',
        `<!-- completion-review: v1 | reviewed: ${date} | scope: abc | diff: def | reviewer: r -->`,
        '',
        '| # | Severity | File:Line | Finding | Status | Reason/Ref |',
        '|---|----------|-----------|---------|--------|------------|',
    ];
    rows.forEach(([sev, status], i) => lines.push(`| ${i + 1} | ${sev} | a.ts:1 | finding ${i + 1} | ${status} | — |`));
    return `${lines.join('\n')}\n`;
}

beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-loop-census-'));
    const council = 'agents/evidence/council';
    // Dot naming: base packet is round 1, then .roundN.
    write(`${council}/alpha-pins-20261108.question.md`, 'packet on 2026-11-08\n');
    for (let n = 2; n <= 6; n++) write(`${council}/alpha-pins-20261108.round${n}.question.md`, `round ${n}\n`);
    // -rN-<date> naming, rounds spanning two dates.
    write(`${council}/beta-contracts-ratification-r1-20261105.question.md`, 'r1\n');
    write(`${council}/beta-contracts-ratification-r2-20261106.question.md`, 'r2\n');
    write(`${council}/beta-contracts-ratification-r3-20261107.question.md`, 'r3\n');
    // A one-off council question with no rounds.
    write(`${council}/gamma-design-20261001.question.md`, 'one\n');
    // Non-packet files in the council dir are ignored.
    write(`${council}/beta-contracts-ratification-r2-20261106.md`, 'synthesis\n');

    const rat = 'agents/evidence/ratifications';
    write(`${rat}/alpha-pins-20261109.md`, '---\nverdict: refused\nproviders: [anthropic, openai]\n---\n# r\n');
    write(`${rat}/beta-contracts-20261107.md`, '---\nverdict: ratified\n---\n# r\n');
    // A record whose name does not share the stem but cites the packet it ratified.
    write(`${council}/zeta-duty-ratification-r1-20261107.question.md`, 'r1\n');
    write(`${council}/zeta-duty-ratification-r2-20261107.question.md`, 'r2\n');
    write(
        `${rat}/zeta-duty-binding-20261107.md`,
        '---\nverdict: confirmed-non-expanding\n---\nPrompt: `agents/evidence/council/zeta-duty-ratification-r2-20261107.question.md`\n',
    );

    const reviews = 'agents/evidence/reviews';
    write(`${reviews}/delta-fix.round1.findings.md`, findings('2026-10-01', [['high', 'fixed'], ['low', 'fixed']]));
    write(`${reviews}/delta-fix.round2.findings.md`, findings('2026-10-02', [['medium', 'fixed']]));
    write(`${reviews}/delta-fix.round3.findings.md`, findings('2026-10-03', []));
    write(`${reviews}/delta-fix.findings.md`, findings('2026-10-03', []));
    write(`${reviews}/epsilon-close-round1-review.md`, findings('2026-09-01', [['critical', 'open']]));
    write(`${reviews}/epsilon-close-round2-review.md`, findings('2026-09-02', [['critical', 'open']]));
});

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('buildCensus', () => {
    it('groups both ratification packet namings per subject with round counts and dates', () => {
        const c = buildCensus(root);
        const alpha = c.subjects.find((s) => s.subject === 'alpha-pins-20261108');
        expect(alpha).toMatchObject({ kind: 'ratification', rounds: 6, firstDate: '2026-11-08', lastDate: '2026-11-08' });
        const beta = c.subjects.find((s) => s.subject === 'beta-contracts-ratification');
        expect(beta).toMatchObject({ kind: 'ratification', rounds: 3, firstDate: '2026-11-05', lastDate: '2026-11-07' });
        const gamma = c.subjects.find((s) => s.subject === 'gamma-design-20261001');
        expect(gamma).toMatchObject({ kind: 'ratification', rounds: 1 });
    });

    it('reads the final verdict from the matching ratification record, else unrecorded', () => {
        const c = buildCensus(root);
        expect(c.subjects.find((s) => s.subject === 'alpha-pins-20261108')?.verdict).toBe('refused');
        expect(c.subjects.find((s) => s.subject === 'beta-contracts-ratification')?.verdict).toBe('ratified');
        expect(c.subjects.find((s) => s.subject === 'gamma-design-20261001')?.verdict).toBe('unrecorded');
        expect(c.subjects.find((s) => s.subject === 'zeta-duty-ratification')?.verdict).toBe('confirmed-non-expanding');
    });

    it('counts completion-review rounds in both namings and derives the verdict from the last round', () => {
        const c = buildCensus(root);
        const delta = c.subjects.find((s) => s.subject === 'delta-fix');
        expect(delta).toMatchObject({
            kind: 'completion-review',
            rounds: 3,
            firstDate: '2026-10-01',
            lastDate: '2026-10-03',
            verdict: 'honest-null',
        });
        expect(delta?.roundList.map((r) => r.findings?.length)).toEqual([2, 1, 0]);
        const eps = c.subjects.find((s) => s.subject === 'epsilon-close');
        expect(eps).toMatchObject({ kind: 'completion-review', rounds: 2, verdict: 'open-high' });
    });

    it('ignores files that are not packets or round findings', () => {
        const c = buildCensus(root);
        expect(c.subjects.map((s) => s.subject).sort()).toEqual([
            'alpha-pins-20261108',
            'beta-contracts-ratification',
            'delta-fix',
            'epsilon-close',
            'gamma-design-20261001',
            'zeta-duty-ratification',
        ]);
    });
});

describe('renderCensusMarkdown', () => {
    it('names the producing command and lists long loops', () => {
        const md = renderCensusMarkdown(buildCensus(root));
        expect(md).toContain('./scripts-run src/scripts/review_loop_census');
        expect(md).toContain('`alpha-pins-20261108`');
        expect(md).not.toContain('`gamma-design-20261001`');
    });
});

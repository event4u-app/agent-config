import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildCensus, renderCensusMarkdown, roundHistory } from '../../src/scripts/review_loop_census.ts';

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

describe('buildCensus --origins', () => {
    let oroot: string;

    function w(rel: string, body: string): void {
        const abs = path.join(oroot, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, body, 'utf-8');
    }

    function patch(paths: string[]): string {
        return paths.map((p) => `diff --git a/${p} b/${p}\n--- a/${p}\n+++ b/${p}\n@@ -1 +1 @@\n-a\n+b\n`).join('');
    }

    beforeAll(() => {
        oroot = fs.mkdtempSync(path.join(os.tmpdir(), 'review-loop-origins-'));
        const council = 'agents/evidence/council';
        w(`${council}/omega-ratification-r1-20261101.question.md`, 'Reviews `src/scripts/a.ts` and `tests/a.test.ts`.\n');
        w(`${council}/omega-ratification-r2-20261101.question.md`, 'Still `src/scripts/a.ts`.\n');
        w(`${council}/omega-ratification-r3-20261101.question.md`, 'Now also `src/scripts/b.ts`, which the diff touches.\n');
        w(`${council}/omega-ratification-r4-20261101.question.md`, 'And `src/scripts/unrelated.ts`, which nobody changed.\n');
        w(`${council}/omega-ratification-r5-20261101.question.md`, 'Back to `src/scripts/a.ts`.\n');
        // A path the packet carries in its own embedded diff is part of the subject's diff.
        w(
            `${council}/omega-ratification-r6-20261101.question.md`,
            'The fix adds `src/scripts/c.ts`:\n\n```diff\ndiff --git a/src/scripts/c.ts b/src/scripts/c.ts\n+++ b/src/scripts/c.ts\n```\n',
        );
        w(
            'agents/evidence/ratifications/omega-20261101.md',
            '---\nverdict: ratified\n---\nDiff: `src/scripts/a.ts`, `src/scripts/b.ts`.\n',
        );

        const reviews = 'agents/evidence/reviews';
        for (let n = 1; n <= 5; n++) {
            w(`${reviews}/sigma.round${n}.findings.md`, findings('2026-10-01', [['low', 'fixed']]));
        }
        w(`${reviews}/sigma.round1.review-input/diff.patch`, patch(['src/x.ts']));
        w(`${reviews}/sigma.round2.review-input/diff.patch`, patch(['src/x.ts', 'agents/roadmaps/road-to-x.md']));
        w(`${reviews}/sigma.round3.review-input/diff.patch`, patch(['src/x.ts', 'agents/roadmaps/road-to-x.md', 'src/y.ts']));
    });

    afterAll(() => fs.rmSync(oroot, { recursive: true, force: true }));

    it('classes a round citing a path outside round 1 and the diff as scope-widened', () => {
        const omega = buildCensus(oroot, { origins: true }).subjects.find((s) => s.subject === 'omega-ratification');
        expect(omega?.roundList.map((r) => r.classes)).toEqual([[], [], [], ['scope-widened'], [], []]);
    });

    it('classes a re-review whose diff moved only in non-code paths as rebind-non-code', () => {
        const sigma = buildCensus(oroot, { origins: true }).subjects.find((s) => s.subject === 'sigma');
        expect(sigma?.roundList.map((r) => r.classes)).toEqual([[], ['rebind-non-code'], [], [], []]);
    });

    it('carries no classes without --origins', () => {
        const omega = buildCensus(oroot).subjects.find((s) => s.subject === 'omega-ratification');
        expect(omega?.roundList[3].classes).toBeUndefined();
    });
});

describe('roundHistory', () => {
    it('extracts round-history sections once, and completion findings rows per round', () => {
        const hroot = fs.mkdtempSync(path.join(os.tmpdir(), 'review-loop-history-'));
        try {
            const council = path.join(hroot, 'agents/evidence/council');
            fs.mkdirSync(council, { recursive: true });
            fs.writeFileSync(path.join(council, 'kappa-ratification-r1-20261101.question.md'), '# Review\n\n## The change\n\nbody\n');
            fs.writeFileSync(
                path.join(council, 'kappa-ratification-r2-20261101.question.md'),
                '# Review — round 2\n\n## Round 1 and what changed\n\n1. **Lock leak.** fixed.\n\n## The module\n\ncode\n',
            );
            fs.writeFileSync(
                path.join(council, 'kappa-ratification-r3-20261101.question.md'),
                '# Review — round 3\n\n## Round 2 and what changed\n\nOne seat: a typo.\n\n## Round 1 and what changed\n\n1. **Lock leak.** fixed.\n',
            );
            fs.writeFileSync(path.join(council, 'kappa-ratification-r3-20261101.md'), '# Split: anthropic refuses on the retry bound\n');
            const reviews = path.join(hroot, 'agents/evidence/reviews');
            fs.mkdirSync(reviews, { recursive: true });
            fs.writeFileSync(path.join(reviews, 'lambda.round1.findings.md'), findings('2026-10-01', [['high', 'fixed']]));
            const c = buildCensus(hroot);
            const kappa = roundHistory(hroot, c.subjects.find((s) => s.subject === 'kappa-ratification')!);
            expect(kappa.match(/## Round 1 and what changed/g)).toHaveLength(1);
            expect(kappa).toContain('One seat: a typo.');
            expect(kappa).not.toContain('code');
            expect(kappa).toContain('Split: anthropic refuses on the retry bound');
            const lambda = roundHistory(hroot, c.subjects.find((s) => s.subject === 'lambda')!);
            expect(lambda).toContain('R1.1 | high | finding 1');
        } finally {
            fs.rmSync(hroot, { recursive: true, force: true });
        }
    });
});

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { isMechanismPath } from '../../src/scripts/check_kernel_edit_ratified.js';
import type { CensusSubject } from '../../src/scripts/review_loop_census.js';
import type { ReaderOutput } from '../../src/scripts/review_loop_origins.js';
import {
    K,
    main,
    renderReplay,
    replaySubject,
    seriesFor,
    verdict,
    type SeriesRound,
} from '../../src/scripts/review_convergence.js';

/** Rounds 2.. from `[new findings, new severe findings outside fix-introduced, severe incl. fix-introduced]`. */
function rounds(spec: Array<[number, number, number?] | null>): SeriesRound[] {
    return spec.map((x, i) =>
        x === null
            ? { round: i + 2, visible: false, newFindings: 0, severeNonFix: 0, severeAll: 0 }
            : { round: i + 2, visible: true, newFindings: x[0], severeNonFix: x[1], severeAll: x[2] ?? x[1] },
    );
}

describe('verdict', () => {
    it('reads converging when three quiet rounds fall or hold', () => {
        expect(verdict(rounds([[6, 1], [4, 0], [3, 0], [3, 0]]), true)).toBe('converging');
    });

    it('reads stalled when three quiet rounds do not fall', () => {
        expect(verdict(rounds([[3, 0], [1, 0], [4, 0], [2, 0]]), true)).toBe('stalled');
    });

    it('reads diverging on a strict increase, severe or not', () => {
        expect(verdict(rounds([[2, 0], [3, 0], [5, 1]]), true)).toBe('diverging');
    });

    it('does not read flat counts as diverging', () => {
        expect(verdict(rounds([[1, 0], [1, 0], [1, 0]]), true)).toBe('converging');
    });

    it('reads active when the window carries a severe finding outside fix-introduced', () => {
        expect(verdict(rounds([[5, 0], [4, 1], [4, 0]]), true)).toBe('active');
    });

    it('ignores fix-introduced severe findings for the verdict', () => {
        expect(verdict(rounds([[5, 0, 2], [4, 0, 1], [3, 0]]), true)).toBe('converging');
    });

    it('reads insufficient-data on fewer than K rounds', () => {
        expect(verdict(rounds([[5, 0], [4, 0]]), true)).toBe('insufficient-data');
    });

    it('reads insufficient-data when a gap breaks the window', () => {
        expect(verdict(rounds([[5, 0], null, [4, 0], [3, 0]]), true)).toBe('insufficient-data');
    });

    it('reads insufficient-data when the loop carries no severity', () => {
        expect(verdict(rounds([[3, 0], [2, 0], [1, 0]]), false)).toBe('insufficient-data');
    });

    it('uses K = 3', () => {
        expect(K).toBe(3);
    });
});

function completion(subject: string, perRound: string[][]): CensusSubject {
    return {
        kind: 'completion-review',
        subject,
        rounds: perRound.length,
        firstDate: null,
        lastDate: null,
        verdict: 'resolved',
        roundList: perRound.map((sevs, i) => ({
            round: i + 1,
            file: `r${i + 1}`,
            date: null,
            findings: sevs.map((severity) => ({ severity, status: 'fixed', text: '' })),
        })),
    };
}

describe('seriesFor', () => {
    it('reads completion-review severity from the findings table', () => {
        const s = seriesFor(completion('c', [['high'], ['medium', 'critical'], ['low']]), undefined);
        expect(s.hasSeverity).toBe(true);
        expect(s.rounds.map((r) => [r.round, r.newFindings, r.severeNonFix])).toEqual([
            [2, 2, 1],
            [3, 1, 0],
        ]);
    });

    it('prefers reader classes and excludes fix-introduced from severeNonFix', () => {
        const reader: ReaderOutput = {
            subject: 'c',
            round1_findings: 2,
            rounds: [
                {
                    round: 2,
                    visible: true,
                    findings: [
                        { id: 'a', summary: '', severity: 'high', class: 'fix-introduced' },
                        { id: 'b', summary: '', severity: 'critical', class: 'other' },
                        { id: 'c', summary: '', severity: 'unknown', class: 're-raised' },
                    ],
                },
                { round: 3, visible: false, findings: [] },
            ],
        };
        const s = seriesFor(completion('c', [['low'], ['low'], ['low']]), reader);
        expect(s.rounds[0]).toEqual({ round: 2, visible: true, newFindings: 3, severeNonFix: 1, severeAll: 2 });
        expect(s.rounds[1]?.visible).toBe(false);
    });

    it('gives a ratification loop without readers no severity', () => {
        const rat: CensusSubject = { ...completion('r', [[], [], []]), kind: 'ratification' };
        rat.roundList.forEach((r) => (r.findings = null));
        expect(seriesFor(rat, undefined).hasSeverity).toBe(false);
    });
});

describe('replaySubject', () => {
    it('names the first stop round and the severe findings after it', () => {
        const row = replaySubject({
            subject: 'x',
            kind: 'ratification',
            totalRounds: 9,
            hasSeverity: true,
            rounds: rounds([[3, 0], [4, 0], [5, 0], [2, 0], [2, 1, 2], [1, 0], [0, 0], [0, 0]]),
        });
        expect(row.stopRound).toBe(4);
        expect(row.stopVerdict).toBe('diverging');
        expect(row.roundsSaved).toBe(5);
        expect(row.severeAfter).toBe(2);
        expect(row.severeNonFixAfter).toBe(1);
    });

    it('reports no stop when the criterion never fires', () => {
        const row = replaySubject({
            subject: 'y',
            kind: 'ratification',
            totalRounds: 5,
            hasSeverity: false,
            rounds: rounds([[3, 0], [2, 0], [1, 0], [0, 0]]),
        });
        expect(row.stopRound).toBeNull();
        expect(row.roundsSaved).toBe(0);
    });
});

describe('the pilot stays outside the ratification mechanism (F7)', () => {
    it('is not a mechanism path', () => {
        expect(isMechanismPath('src/scripts/review_convergence.ts')).toBe(false);
    });
});

describe('main', () => {
    let root: string;
    beforeAll(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-convergence-'));
        const reviews = path.join(root, 'agents/evidence/reviews');
        fs.mkdirSync(reviews, { recursive: true });
        const table = (n: number): string =>
            [
                '| # | Severity | File:Line | Finding | Status | Reason/Ref |',
                '|---|---|---|---|---|---|',
                ...Array.from({ length: n }, (_, i) => `| ${i + 1} | low | a.ts:1 | f | fixed | — |`),
                '',
            ].join('\n');
        // 1, 2, 3, 4 new findings: diverging.
        for (let r = 1; r <= 5; r++) fs.writeFileSync(path.join(reviews, `div.round${r}.findings.md`), table(r));
        fs.mkdirSync(path.join(root, 'agents/evidence/analysis/review-loop-origins'), { recursive: true });
    });
    afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

    it('exits 0 on a diverging subject', () => {
        const out: string[] = [];
        const code = main(['--root', root, '--subject', 'div'], (s) => out.push(s));
        expect(code).toBe(0);
        expect(out.join('')).toContain('diverging');
    });

    it('renders the replay byte-identically twice', () => {
        expect(renderReplay(root)).toBe(renderReplay(root));
        expect(renderReplay(root)).toContain('| **pooled** |');
    });
});

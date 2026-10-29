/**
 * H.9 — the fix-induced share, printed with numerator, denominator and method.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { METHOD, fixInducedShare, formatShares, shareFromHistory } from '../../src/scripts/code_graph/fix_induced_share.js';
import { Repo } from './_bugs/repo.js';

describe('fixInducedShare', () => {
    it('counts a fix that a later fix names as a candidate, per month', () => {
        const fixes = [
            { sha: 'aaaaaaaaaaaa01', date: '2026-08-10' },
            { sha: 'bbbbbbbbbbbb02', date: '2026-08-20' },
            { sha: 'cccccccccccc03', date: '2026-09-05' },
        ];
        const inducers = new Map([
            ['cccccccccccc03', ['aaaaaaaaaaaa01', 'ffffffffffff99']],
            ['bbbbbbbbbbbb02', []],
        ]);
        const rows = fixInducedShare(fixes, inducers);
        expect(rows).toEqual([
            { period: '2026-08', numerator: 1, denominator: 2, share: 0.5 },
            { period: '2026-09', numerator: 0, denominator: 1, share: 0 },
        ]);
        const text = formatShares(rows);
        expect(text).toContain('2026-08: 1/2 fix commits later named as an introducing candidate (50.0 %)');
        expect(text).toContain(`method: ${METHOD}`);
        expect(text).toMatch(/not an effect of this suite/);
    });

    it('a candidate dated after the fix that names it is not counted', () => {
        const rows = fixInducedShare([{ sha: 'a'.repeat(12), date: '2026-09-02' }, { sha: 'b'.repeat(12), date: '2026-09-01' }], new Map([['b'.repeat(12), ['a'.repeat(12)]]]));
        expect(rows[0]?.numerator).toBe(0);
    });
});

describe('shareFromHistory', () => {
    let repo: Repo;
    beforeEach(() => {
        repo = new Repo();
    });
    afterEach(() => repo.cleanup());

    it('a fix that itself broke a line, then fixed again, is counted', () => {
        repo.write('x.ts', 'a\nb\n');
        repo.commit('feat: x');
        repo.write('x.ts', 'a\nB\n');
        const fix1 = repo.commit('fix: b');
        repo.write('x.ts', 'a\nbb\n');
        const fix2 = repo.commit('fix: B was wrong');
        const date = (s: string): string => repo.run('log', '-1', '--format=%cs', s).trim();
        const rows = shareFromHistory(repo.git, [{ sha: fix1, date: date(fix1) }, { sha: fix2, date: date(fix2) }]);
        expect(rows.reduce((n, r) => n + r.numerator, 0)).toBe(1);
        expect(rows.reduce((n, r) => n + r.denominator, 0)).toBe(2);
    });
});

/**
 * The autonomy-friction corpus.
 *
 * The corpus counts CONFIRMATIONS, not gates. A gate count would go green on a
 * change that fired fewer gates and prompted just as often, which is the whole
 * failure the round is about — and the distinction is not theoretical: the
 * corpus caught `git -C sub status` costing a confirmation on its first run,
 * a defect a gate count would have shown as identical.
 *
 * The expectations themselves are pinned here so the corpus cannot be made
 * green by moving them. `measure()` spawns a real dispatcher per case, so the
 * end-to-end run is the script's own job (`./scripts-run
 * src/scripts/autonomy_friction_corpus`); what this file pins is the contract
 * around it.
 */
import { describe, expect, it } from 'vitest';

import {
    CASES,
    render,
    type FrictionResult,
} from '../../src/scripts/autonomy_friction_corpus.js';

function result(over: Partial<FrictionResult> = {}): FrictionResult {
    const base = CASES[0] as (typeof CASES)[number];
    const merged = { ...base, observed: base.expected, refused: false, pass: true, ...over };
    return { ...merged, pass: merged.refused || merged.observed === merged.expected };
}

describe('the corpus holds the classes the round named', () => {
    it('covers all six payload classes plus the directory-flag replacement', () => {
        expect(CASES.map((c) => c.id)).toEqual([
            'directory-change',
            'directory-change-compounded',
            'directory-flag-status',
            'test-runner-in-subdirectory',
            'workspace-package-manager',
            'consequence-authorized',
            'consequence-unauthorized',
        ]);
    });

    it('every case states an expected confirmation count and why', () => {
        for (const c of CASES) {
            expect(Number.isInteger(c.expected), c.id).toBe(true);
            expect(c.because.length, c.id).toBeGreaterThan(20);
            expect(c.klass.length, c.id).toBeGreaterThan(5);
        }
    });

    it('pins the expectations so the corpus cannot be made green by moving them', () => {
        expect(Object.fromEntries(CASES.map((c) => [c.id, c.expected]))).toEqual({
            'directory-change': 1,
            'directory-change-compounded': 1,
            'directory-flag-status': 0,
            'test-runner-in-subdirectory': 0,
            'workspace-package-manager': 0,
            'consequence-authorized': 1,
            'consequence-unauthorized': 1,
        });
    });

    it('the two consequence cases expect the SAME count — that is the finding', () => {
        // The authorizing phrase changes the record, never the prompt. If these
        // ever differ, this package has started granting something, and that is
        // a decision the owner takes rather than a corpus edit.
        const authorized = CASES.find((c) => c.id === 'consequence-authorized');
        const unauthorized = CASES.find((c) => c.id === 'consequence-unauthorized');
        expect(authorized?.expected).toBe(unauthorized?.expected);
        expect(authorized?.input).toEqual(unauthorized?.input);
    });
});

describe('a case whose expectation is zero and whose observation is one FAILS', () => {
    it('is not a pass', () => {
        const r = result({ expected: 0, observed: 1 });
        expect(r.pass).toBe(false);
    });

    it('is named in the summary line', () => {
        const out = render([result({ id: 'x', expected: 0, observed: 1 })]);
        expect(out).toContain('miss their expectation');
        expect(out).toContain('x');
        expect(out).toContain('❌');
    });

    it('a matching observation passes and the summary says so', () => {
        const out = render([result({ expected: 0, observed: 0 })]);
        expect(out).toContain('every observation matches its expectation');
        expect(out).not.toContain('❌');
    });
});

describe('a refusal is not a confirmation', () => {
    it('a blocked case scores zero confirmations and passes', () => {
        // Counting a refusal as friction would reward removing a gate, which is
        // the opposite of what this corpus is for.
        expect(result({ expected: 1, observed: 0, refused: true }).pass).toBe(true);
    });
});

describe('the report says what it does not measure', () => {
    it('names the boundary between our emission and the host s own decision', () => {
        const out = render([result()]);
        expect(out).toContain('NOT one the host necessarily shows');
    });

    it('reports a per-case confirmation count', () => {
        const out = render([result({ id: 'demo', expected: 0, observed: 0 })]);
        expect(out).toMatch(/demo\s+expected 0\s+observed 0/);
    });
});

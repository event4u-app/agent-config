// The static-parity comparator — `road-to-supervised-telemetry-collector`
// step 4.2 (AC-7).
//
// The gate itself runs the whole dispatcher-reaching set twice and takes about
// a minute, so it is not invoked from here. The exact test count is deliberately
// not written down anywhere in this change (R2 round-2 finding 15): it moves
// every time a test is added to a file in the parity set, and three different
// figures for it appeared across one diff. The gate prints the live number.
//
// What IS asserted here is the part that could silently stop working: the
// comparator that turns "two green runs" into "two IDENTICAL runs", and the
// discovery that decides what gets compared at all.
//
// A gate that scans nothing exits green. Both risks below are the shapes that
// failure takes for this gate — an empty parity set, and a comparator that
// returns no differences because it cannot see any.

import { describe, expect, it } from 'vitest';

import { compare, parityFiles, type TestVerdict } from '../../src/scripts/check_static_parity.js';

const A: TestVerdict[] = [
    { name: 'a.test.ts › one', status: 'passed' },
    { name: 'a.test.ts › two', status: 'passed' },
];

describe('the comparator', () => {
    it('reports no differences when the two runs agree', () => {
        expect(compare(A, [...A])).toEqual([]);
    });

    it('catches a status change that BOTH runs would report as green overall', () => {
        // The failure two green runs cannot see: a test that stopped running.
        // `skipped` is not `failed`, so the suite exit code is 0 both times and
        // only the per-test comparison notices.
        const b: TestVerdict[] = [
            { name: 'a.test.ts › one', status: 'passed' },
            { name: 'a.test.ts › two', status: 'skipped' },
        ];
        expect(compare(A, b)).toEqual(['a.test.ts › two: present-but-off=passed · absent=skipped']);
    });

    // removing_this_constraint_reds_it: make `compare` return `[]` whenever both
    // sides have the same LENGTH — a length check is the cheap comparison this
    // gate deliberately is not, and it passes this exact case.

    it('catches a test that exists in only one run, in both directions', () => {
        const missing: TestVerdict[] = [{ name: 'a.test.ts › one', status: 'passed' }];
        expect(compare(A, missing)).toEqual(['present-but-off only: a.test.ts › two (passed)']);
        expect(compare(missing, A)).toEqual(['absent only: a.test.ts › two (passed)']);
    });

    it('is order-independent — a reordered run is not a divergence', () => {
        expect(compare(A, [...A].reverse())).toEqual([]);
    });
});

describe('the parity set', () => {
    it('is discovered, non-empty, and every entry is a real test file', () => {
        const files = parityFiles();
        // An empty set is the silent-green failure mode: the gate would run two
        // suites of zero tests and compare nothing.
        expect(files.length).toBeGreaterThan(10);
        for (const file of files) {
            expect(file.endsWith('.test.ts'), file).toBe(true);
        }
        // The dispatcher's own test must be in it, or the discovery is broken in
        // a way the count alone would not show.
        expect(files).toContain('tests/scripts/hooks/dispatch_hook.test.ts');
    });

    // removing_this_constraint_reds_it: change the grep pattern in
    // `parityFiles` to a token no test file contains — the set empties and both
    // the count and the containment assertion red.
});

/**
 * The bench stays inside this repository until at least two extraction criteria
 * hold and the owner agrees. The gate table states each criterion's current
 * value from a measurable source, and says `unknown` rather than guessing.
 */
import { describe, expect, it } from 'vitest';

import { gateRows, gateVerdict, renderGate, rivalShare, benchRedShare } from '../../internal/bench/core/bench_extraction_gate.js';

describe('rivalShare (G2)', () => {
    it('counts engine commits that touch a rival path, over all engine commits', () => {
        const commits = [['internal/bench/core/a.ts'], ['internal/bench/rivals/x/Dockerfile'], ['internal/bench/core/b.ts', 'internal/bench/containers/rival-y.sh']];
        expect(rivalShare(commits)).toEqual({ rival: 2, total: 3 });
    });
    it('has no share without engine commits', () => {
        expect(rivalShare([])).toEqual({ rival: 0, total: 0 });
    });
});

describe('benchRedShare (G4)', () => {
    it('is the share of failed runs whose workflow is a bench workflow', () => {
        const runs = [
            { name: 'Bench drift', conclusion: 'failure' },
            { name: 'Tests', conclusion: 'failure' },
            { name: 'Tests', conclusion: 'success' },
            { name: 'Consistency', conclusion: 'failure' },
        ];
        expect(benchRedShare(runs)).toEqual({ bench: 1, red: 3 });
    });
});

describe('gate table and verdict', () => {
    const state = {
        G1: { holds: false, note: 'no external request recorded' },
        G3: { holds: null, note: 'no licence check yet' },
        G5: { holds: false, note: 'no owner decision recorded' },
    };
    it('G2 and G4 hold from their thresholds, the rest come from the state file', () => {
        const rows = gateRows({ rival: { rival: 6, total: 10 }, red: { bench: 1, red: 20 }, state });
        expect(rows.map((r) => [r.id, r.holds])).toEqual([
            ['G1', false],
            ['G2', true],
            ['G3', null],
            ['G4', false],
            ['G5', false],
        ]);
    });
    it('an unmeasurable G2 or G4 reads unknown, never false', () => {
        const rows = gateRows({ rival: { rival: 0, total: 0 }, red: null, state });
        expect(rows.find((r) => r.id === 'G2')?.holds).toBeNull();
        expect(rows.find((r) => r.id === 'G4')?.holds).toBeNull();
    });
    it('extraction needs two criteria and the owner', () => {
        const two = gateRows({ rival: { rival: 6, total: 10 }, red: { bench: 5, red: 20 }, state });
        expect(gateVerdict(two, false)).toMatch(/^stay — 2 of 5 hold; the owner has not agreed/);
        expect(gateVerdict(two, true)).toMatch(/^extract/);
        const one = gateRows({ rival: { rival: 6, total: 10 }, red: { bench: 0, red: 20 }, state });
        expect(gateVerdict(one, true)).toMatch(/^stay — 1 of 5 hold/);
    });
    it('renders one row per criterion with its current value', () => {
        const md = renderGate(gateRows({ rival: { rival: 0, total: 12 }, red: { bench: 0, red: 9 }, state }), false);
        expect(md).toContain('| G2 |');
        expect(md).toContain('0 of 12 engine commits');
        expect(md).toContain('0 of 9 failed runs');
        expect(md).toContain('**Verdict:** stay');
    });
});

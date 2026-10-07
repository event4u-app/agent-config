// The bundle ceiling's raise rule, enforced against the base revision.
//
// The budget file used to say the gate "prints the rule but cannot enforce
// it". Against the base it can: a raise with a new matching `raise_log` entry
// passes, a raise without one fails, a lowering without one passes. Two
// near-misses are pinned as well — an entry already present at the base does
// not cover a fresh raise, and a new entry naming a different `to` does not
// either.
import { describe, expect, it } from 'vitest';

import { raiseFindings } from '../../src/scripts/check_hook_bundle_composition.js';

const OLD_ENTRY = { date: '2026-10-01', from: 1500000, to: 1550000 };

function budget(max: number, log: object[]): string {
    return JSON.stringify({ max_bytes: max, max_yaml_packages: 1, raise_log: log });
}

const BASE = budget(1550000, [OLD_ENTRY]);

describe('raiseFindings', () => {
    it('a raise with a new raise_log entry naming the new ceiling passes', () => {
        const working = budget(1600000, [OLD_ENTRY, { date: '2026-10-07', from: 1550000, to: 1600000 }]);
        expect(raiseFindings(BASE, working)).toEqual([]);
    });

    it('a raise without a new raise_log entry fails', () => {
        const findings = raiseFindings(BASE, budget(1600000, [OLD_ENTRY]));
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatch(/raised from 1550000 to 1600000/);
    });

    it('a lowering without an entry passes', () => {
        expect(raiseFindings(BASE, budget(1500000, [OLD_ENTRY]))).toEqual([]);
    });

    it('a new entry whose `to` is not the new ceiling does not cover the raise', () => {
        const working = budget(1600000, [OLD_ENTRY, { date: '2026-10-07', from: 1550000, to: 1580000 }]);
        expect(raiseFindings(BASE, working)).toHaveLength(1);
    });

    it('an entry already at the base does not cover a raise to its own `to`', () => {
        const base = budget(1500000, [OLD_ENTRY]);
        expect(raiseFindings(base, budget(1550000, [OLD_ENTRY]))).toHaveLength(1);
    });

    it('a base without the file (the registration diff) is not a raise', () => {
        expect(raiseFindings(null, budget(1550000, []))).toEqual([]);
    });
});

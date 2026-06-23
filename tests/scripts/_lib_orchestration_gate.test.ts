import { describe, expect, it } from 'vitest';

import {
    gateVerdict,
    recursiveGateVerdict,
    resolveRecursiveDefault,
    resolveShippedDefault,
} from '../../src/scripts/_lib/orchestration_gate.js';

describe('gateVerdict', () => {
    it('pass requires BOTH net win and held quality', () => {
        expect(gateVerdict({ net_win: true, quality_held: true })).toBe('pass');
    });
    it('net win but quality regressed → fail (honest-null)', () => {
        expect(gateVerdict({ net_win: true, quality_held: false })).toBe('fail');
    });
    it('no net win → fail', () => {
        expect(gateVerdict({ net_win: false, quality_held: true })).toBe('fail');
    });
});

describe('resolveShippedDefault', () => {
    it('gate pass on a capable host → on', () => {
        expect(resolveShippedDefault({ net_win: true, quality_held: true }, true)).toBe('on');
    });
    it('gate fail on a capable host → ask (conservative)', () => {
        expect(resolveShippedDefault({ net_win: false, quality_held: true }, true)).toBe('ask');
    });
    it('host without subagent_spawn → off, regardless of the gate', () => {
        expect(resolveShippedDefault({ net_win: true, quality_held: true }, false)).toBe('off');
        expect(resolveShippedDefault({ net_win: false, quality_held: false }, false)).toBe('off');
    });
});

describe('recursiveGateVerdict (ADR-106 two-branch)', () => {
    const base = {
        capability_lift_significant: false,
        novel_discipline_lift_significant: false,
        cost_within_ceiling: true,
        human_preference_rate: 0.8,
    };
    it('capability lift alone → pass (no discipline branch needed)', () => {
        expect(recursiveGateVerdict({ ...base, capability_lift_significant: true })).toBe('pass');
    });
    it('capability lift passes even if discipline/cost/preference all fail', () => {
        expect(
            recursiveGateVerdict({
                capability_lift_significant: true,
                novel_discipline_lift_significant: false,
                cost_within_ceiling: false,
                human_preference_rate: 0.0,
            }),
        ).toBe('pass');
    });
    it('novel discipline lift + cost OK + preference > floor → pass', () => {
        expect(recursiveGateVerdict({ ...base, novel_discipline_lift_significant: true })).toBe('pass');
    });
    it('discipline lift but human preference ≤ floor → fail (economically irrelevant)', () => {
        expect(
            recursiveGateVerdict({ ...base, novel_discipline_lift_significant: true, human_preference_rate: 0.6 }),
        ).toBe('fail');
    });
    it('discipline lift but cost over ceiling → fail', () => {
        expect(
            recursiveGateVerdict({ ...base, novel_discipline_lift_significant: true, cost_within_ceiling: false }),
        ).toBe('fail');
    });
    it('discipline flat (D₂−D₁ ≤ ε) and capability flat → fail (redundant with rules)', () => {
        expect(recursiveGateVerdict(base)).toBe('fail');
    });
});

describe('resolveRecursiveDefault', () => {
    const pass = {
        capability_lift_significant: true,
        novel_discipline_lift_significant: false,
        cost_within_ceiling: true,
        human_preference_rate: 0.8,
    };
    it('gate pass on a supported host → on', () => {
        expect(resolveRecursiveDefault(pass, true)).toBe('on');
    });
    it('gate fail on a supported host → off (honest-null, never ask)', () => {
        expect(resolveRecursiveDefault({ ...pass, capability_lift_significant: false }, true)).toBe('off');
    });
    it('unsupported host → off regardless of the gate', () => {
        expect(resolveRecursiveDefault(pass, false)).toBe('off');
    });
});

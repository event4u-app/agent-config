import { describe, expect, it } from 'vitest';

import { gateVerdict, resolveShippedDefault } from '../../src/scripts/_lib/orchestration_gate.js';

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

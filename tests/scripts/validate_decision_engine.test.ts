// Tests for src/scripts/validate_decision_engine.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists for the validator itself (the underlying
// work_engine.scoring.decision_engine.parse has its own Python tests, not in
// this batch's scope). Focused differential suite over the inlined parse()
// port + any_gate_active, plus golden parity on the REAL REPO (skipped
// without python3).
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/validate_decision_engine.js';



describe('validate_decision_engine — parse', () => {
    it('null / empty block → defaults (no gate active)', () => {
        const s = mod.parse(null);
        expect(s.min_confidence).toBe('off');
        expect(s.block_on_risk).toBe('off');
        expect(s.require_memory_hits).toBe(false);
        expect(mod.any_gate_active(s)).toBe(false);
    });

    it('YAML-1.1 off (boolean false) coerces to the off sentinel', () => {
        const s = mod.parse({ min_confidence: false, block_on_risk: false });
        expect(s.min_confidence).toBe('off');
        expect(s.block_on_risk).toBe('off');
        expect(mod.any_gate_active(s)).toBe(false);
    });

    it('a configured floor activates a gate', () => {
        const s = mod.parse({ min_confidence: 'high' });
        expect(s.min_confidence).toBe('high');
        expect(mod.any_gate_active(s)).toBe(true);
    });

    it('require_memory_hits true activates a gate', () => {
        expect(mod.any_gate_active(mod.parse({ require_memory_hits: true }))).toBe(true);
    });

    it('unknown key raises a config error', () => {
        expect(() => mod.parse({ nope: 1 })).toThrow(mod.DecisionEngineConfigError);
        try {
            mod.parse({ nope: 1 });
        } catch (e) {
            expect((e as Error).message).toContain('unknown key(s): nope');
        }
    });

    it('boolean True is not a valid level', () => {
        expect(() => mod.parse({ min_confidence: true })).toThrow(mod.DecisionEngineConfigError);
    });

    it('invalid enum value raises with the value repr', () => {
        try {
            mod.parse({ on_block: 'explode' });
            throw new Error('should have thrown');
        } catch (e) {
            expect((e as Error).message).toContain("invalid value 'explode'");
            expect((e as Error).message).toContain('Allowed: ask, stop, warn');
        }
    });

    it('non-mapping block raises', () => {
        expect(() => mod.parse([1, 2])).toThrow(mod.DecisionEngineConfigError);
    });
});


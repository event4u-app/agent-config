// Intent tests for work_engine/delivery_state.ts (ADR-094 py2ts Phase 1).
// Covers: Outcome enum string values, StepResult / DeliveryState field order +
// defaults, per-instance mutable defaults (no shared container), agent_directive
// formatting (incl. Python str() coercion of bool/None/int payload values +
// kwargs order), and is_agent_directive (lstrip + prefix). The python3-vs-tsx
// parity block has been removed; the `.py` original is gone and the tsx
// contract is asserted directly below.
import { describe, expect, it } from 'vitest';

import {
    AGENT_DIRECTIVE_PREFIX,
    DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
    is_agent_directive,
} from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';

describe('work_engine/delivery_state', () => {
    it('Outcome enum carries the string values', () => {
        expect(Outcome.SUCCESS).toBe('success');
        expect(Outcome.BLOCKED).toBe('blocked');
        expect(Outcome.PARTIAL).toBe('partial');
    });

    it('AGENT_DIRECTIVE_PREFIX is the public contract literal', () => {
        expect(AGENT_DIRECTIVE_PREFIX).toBe('@agent-directive:');
    });

    it('StepResult defaults: empty questions + message, own array per instance', () => {
        const a = new StepResult({ outcome: Outcome.SUCCESS });
        const b = new StepResult({ outcome: Outcome.BLOCKED });
        expect(a.questions).toEqual([]);
        expect(a.message).toBe('');
        a.questions.push('x');
        // default_factory=list → no cross-instance leakage.
        expect(b.questions).toEqual([]);
    });

    it('DeliveryState defaults match the contract', () => {
        const s = new DeliveryState({ ticket: { id: 'T1' } });
        expect(s.persona).toBe('senior-engineer');
        expect(s.memory).toEqual([]);
        expect(s.plan).toBeNull();
        expect(s.changes).toEqual([]);
        expect(s.outcomes).toEqual({});
        expect(s.questions).toEqual([]);
        expect(s.report).toBe('');
        expect(s.ui_audit).toBeNull();
        expect(s.stack).toBeNull();
    });

    it('DeliveryState mutable defaults are per-instance', () => {
        const a = new DeliveryState({ ticket: {} });
        const b = new DeliveryState({ ticket: {} });
        a.changes.push({ file: 'x' });
        a.outcomes['k'] = 'v';
        expect(b.changes).toEqual([]);
        expect(b.outcomes).toEqual({});
    });

    it('StepResult field order matches the dataclass contract', () => {
        const r = new StepResult({
            outcome: Outcome.BLOCKED,
            questions: ['q'],
            message: 'msg',
        });
        expect(Object.keys(r)).toEqual(['outcome', 'questions', 'message']);
    });

    it('agent_directive: name only', () => {
        expect(agent_directive('implement-plan')).toBe('@agent-directive: implement-plan');
    });

    it('agent_directive: payload renders key=value, kwargs order preserved', () => {
        expect(agent_directive('run-tests', { scope: 'full', n: 3 })).toBe(
            '@agent-directive: run-tests scope=full n=3',
        );
    });

    it('agent_directive: Python str() coercion of bool / None', () => {
        expect(agent_directive('x', { a: true, b: false, c: null })).toBe(
            '@agent-directive: x a=True b=False c=None',
        );
    });

    it('agent_directive: int payload values render verbatim', () => {
        expect(agent_directive('x', { count: 0, label: 'a-b_c' })).toBe(
            '@agent-directive: x count=0 label=a-b_c',
        );
    });

    it('is_agent_directive: lstrip then prefix match', () => {
        expect(is_agent_directive('@agent-directive: foo')).toBe(true);
        expect(is_agent_directive('   @agent-directive: foo')).toBe(true);
        expect(is_agent_directive('\t@agent-directive: x')).toBe(true);
        expect(is_agent_directive('1. user option')).toBe(false);
        expect(is_agent_directive('agent-directive: no-at')).toBe(false);
        expect(is_agent_directive('')).toBe(false);
        // non-string → false (Python isinstance guard).
        expect(is_agent_directive(42 as unknown)).toBe(false);
        expect(is_agent_directive(null as unknown)).toBe(false);
    });
});

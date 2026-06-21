// Parity test for the py2ts hooks barrel twins (ADR-094):
// hooks/index.ts (== hooks/__init__.py) and hooks/builtin/index.ts
// (== hooks/builtin/__init__.py). Asserts the public export set matches the
// Python `__all__`, and that each export is a usable value.
import { describe, expect, it } from 'vitest';

import * as builtinIndex from '../../../src/agent-src/templates/scripts/work_engine/hooks/builtin/index.js';
import * as hooksIndex from '../../../src/agent-src/templates/scripts/work_engine/hooks/index.js';

// Expected runtime exports (types are erased; `HookCallback` is type-only).
const HOOKS_VALUE_EXPORTS = [
    'ChatHistoryAppendHook',
    'ChatHistoryHaltAppendHook',
    'DecisionTraceHook',
    'DirectiveSetGuardHook',
    'HaltSurfaceAuditHook',
    'HookContext',
    'HookError',
    'HookEvent',
    'HookHalt',
    'HookRegistry',
    'HookRunner',
    'MemoryVisibilityHook',
    'StateShapeValidationHook',
    'TraceHook',
].sort();

const BUILTIN_VALUE_EXPORTS = [
    'ChatHistoryAppendHook',
    'ChatHistoryHaltAppendHook',
    'DecisionGateHook',
    'DecisionTraceHook',
    'DirectiveSetGuardHook',
    'HaltSurfaceAuditHook',
    'MemoryVisibilityHook',
    'StateShapeValidationHook',
    'TraceHook',
    'build_decision_gate_hook',
].sort();

describe('work_engine.hooks barrel — index.ts', () => {
    it('re-exports the public surface (minus the type-only HookCallback)', () => {
        const got = Object.keys(hooksIndex).sort();
        expect(got).toEqual(HOOKS_VALUE_EXPORTS);
    });

    it('HookEvent is the const event object', () => {
        expect(hooksIndex.HookEvent.BEFORE_STEP).toBe('before_step');
    });

    it('exported hook classes are constructable', () => {
        expect(new hooksIndex.HookRegistry()).toBeInstanceOf(hooksIndex.HookRegistry);
        expect(new hooksIndex.HookContext()).toBeInstanceOf(hooksIndex.HookContext);
        expect(new hooksIndex.HookHalt('r').reason).toBe('r');
    });
});

describe('work_engine.hooks.builtin barrel — builtin/index.ts', () => {
    it('re-exports every concrete hook + build_decision_gate_hook', () => {
        const got = Object.keys(builtinIndex).sort();
        expect(got).toEqual(BUILTIN_VALUE_EXPORTS);
    });

    it('build_decision_gate_hook is a function returning null on inactive config', () => {
        expect(typeof builtinIndex.build_decision_gate_hook).toBe('function');
        expect(builtinIndex.build_decision_gate_hook(null)).toBeNull();
    });
});

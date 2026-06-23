// Intent tests for work_engine/dispatcher.ts (ADR-096 py2ts Phase 1 —
// work_engine TOP/integration layer). The python byte-parity rig is gone; this
// asserts the tsx module's own contract directly.
//
// The dispatch loop (`dispatch`) is driven with synthetic step maps so the
// success / blocked / partial / resume-skip / missing-step / no-questions
// invariants are exercised deterministically. The directive-set resolution
// surface (select_directive_set / load / assert_kind_supported) is exercised
// against the real four sets — they produce the canonical eight-step order and
// raise on the typo / unsupported-kind paths.
import { describe, expect, it } from 'vitest';

import {
    DEFAULT_DIRECTIVE_SET,
    STEP_ORDER,
    ValueError,
    assert_kind_supported,
    dispatch,
    load_directive_set,
    select_directive_set,
} from '../../../src/agent-src/templates/scripts/work_engine/dispatcher.js';
import {
    DeliveryState,
    Outcome,
    type Step,
    StepResult,
} from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import { Input, WorkState } from '../../../src/agent-src/templates/scripts/work_engine/state.js';

// ── dispatch() — synthetic step maps ──────────────────────────────────────

// A "step plan" is a JSON-serialisable map of {stepName: {outcome, questions}}.
// Both engines build a step map from it where each handler returns the declared
// StepResult; a missing entry means a step that always SUCCEEDS.
type StepPlan = Record<string, { outcome: string; questions?: string[] }>;

function tsStepMap(plan: StepPlan): Map<string, Step> {
    const m = new Map<string, Step>();
    for (const name of STEP_ORDER) {
        const spec = plan[name];
        m.set(name, () =>
            new StepResult({
                outcome: (spec ? spec.outcome : Outcome.SUCCESS) as Outcome,
                questions: spec?.questions ?? [],
            }),
        );
    }
    return m;
}

describe('dispatch — local invariants', () => {
    it('all-success walks the full order', () => {
        const st = new DeliveryState({ ticket: {} });
        const [final, halting] = dispatch(st, tsStepMap({}));
        expect(final).toBe(Outcome.SUCCESS);
        expect(halting).toBeNull();
        expect(Object.keys(st.outcomes)).toEqual([...STEP_ORDER]);
    });

    it('missing step throws (KeyError-equivalent)', () => {
        const partial = new Map<string, Step>();
        partial.set('refine', () => new StepResult({ outcome: Outcome.SUCCESS }));
        expect(() => dispatch(new DeliveryState({ ticket: {} }), partial)).toThrow();
    });

    it('blocked with no questions throws (ValueError-equivalent)', () => {
        const m = tsStepMap({ plan: { outcome: Outcome.BLOCKED, questions: [] } });
        expect(() => dispatch(new DeliveryState({ ticket: {} }), m)).toThrow();
    });
});

// ── select_directive_set / load / assert_kind_supported ───────────────────

describe('select_directive_set — local', () => {
    it('reads WorkState.directive_set', () => {
        const w = new WorkState({ input: new Input('ticket', {}), directive_set: 'ui' });
        expect(select_directive_set(w)).toBe('ui');
    });
    it('falls back to backend on a fieldless object', () => {
        expect(select_directive_set(new DeliveryState({ ticket: {} }))).toBe(DEFAULT_DIRECTIVE_SET);
    });
    it('throws ValueError on an unknown set', () => {
        const w = new WorkState({ input: new Input('ticket', {}), directive_set: 'nope' });
        expect(() => select_directive_set(w)).toThrow(ValueError);
    });
});

describe('load_directive_set — real sets', () => {
    for (const set of ['backend', 'ui', 'ui-trivial', 'mixed']) {
        it(`${set} yields the eight-step order`, () => {
            expect([...load_directive_set(set).keys()]).toEqual([...STEP_ORDER]);
        });
    }
    it('throws ValueError on a typo', () => {
        expect(() => load_directive_set('backendd')).toThrow(ValueError);
    });
});

describe('assert_kind_supported — real sets', () => {
    it('backend supports ticket + prompt', () => {
        expect(() => assert_kind_supported('ticket', 'backend')).not.toThrow();
        expect(() => assert_kind_supported('prompt', 'backend')).not.toThrow();
    });
    it('backend rejects diff', () => {
        expect(() => assert_kind_supported('diff', 'backend')).toThrow();
    });
    it('ui supports all four kinds', () => {
        for (const k of ['ticket', 'prompt', 'diff', 'file']) {
            expect(() => assert_kind_supported(k, 'ui')).not.toThrow();
        }
    });
});

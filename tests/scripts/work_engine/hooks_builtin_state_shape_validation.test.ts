// Intent tests for the py2ts state_shape_validation hook twin (ADR-094).
// Round-trips the live WorkState through state.to_dict/from_dict on
// AFTER_LOAD + BEFORE_SAVE; a SchemaError becomes a non-fatal HookError.
// Was a python3-vs-tsx parity rig; the `.py` original is gone.
import { describe, expect, it } from 'vitest';

import { StateShapeValidationHook } from '../../../src/agent-src/templates/scripts/work_engine/hooks/builtin/state_shape_validation.js';
import { HookContext } from '../../../src/agent-src/templates/scripts/work_engine/hooks/context.js';
import { HookError } from '../../../src/agent-src/templates/scripts/work_engine/hooks/exceptions.js';
import { HookEvent } from '../../../src/agent-src/templates/scripts/work_engine/hooks/events.js';
import { HookRegistry } from '../../../src/agent-src/templates/scripts/work_engine/hooks/registry.js';
import { Input, WorkState } from '../../../src/agent-src/templates/scripts/work_engine/state.js';

function fire(event: HookEvent, ctx: HookContext): HookError | null {
    const hook = new StateShapeValidationHook();
    const reg = new HookRegistry();
    hook.register(reg);
    try {
        for (const cb of reg.for_event(event)) cb(ctx);
    } catch (e) {
        if (e instanceof HookError) return e;
        throw e;
    }
    return null;
}

describe('StateShapeValidationHook — TS unit checks', () => {
    it('registers on AFTER_LOAD and BEFORE_SAVE', () => {
        const hook = new StateShapeValidationHook();
        const reg = new HookRegistry();
        hook.register(reg);
        expect([...reg.events()].sort()).toEqual([HookEvent.AFTER_LOAD, HookEvent.BEFORE_SAVE].sort());
    });

    it('valid WorkState round-trips with no error', () => {
        const work = new WorkState({ input: new Input('ticket', { id: 'T-1' }) });
        expect(fire(HookEvent.AFTER_LOAD, new HookContext({ work }))).toBeNull();
        expect(fire(HookEvent.BEFORE_SAVE, new HookContext({ work }))).toBeNull();
    });

    it('null work → HookError naming the state_file', () => {
        const err = fire(HookEvent.AFTER_LOAD, new HookContext({ state_file: '/tmp/s.json' }));
        expect(err?.message).toBe(
            'state-shape validation: HookContext.work is None at event for state_file=/tmp/s.json',
        );
    });

    it('null work + null state_file → message says None', () => {
        const err = fire(HookEvent.BEFORE_SAVE, new HookContext());
        expect(err?.message).toBe(
            'state-shape validation: HookContext.work is None at event for state_file=None',
        );
    });

    it('invalid directive_set → SchemaError surfaced as HookError (full message)', () => {
        const work = new WorkState({ input: new Input('ticket'), directive_set: 'not-a-real-set' });
        const err = fire(HookEvent.BEFORE_SAVE, new HookContext({ work }));
        expect(err).toBeInstanceOf(HookError);
        expect(err?.message).toMatchInlineSnapshot(`"state-shape validation failed: unknown directive_set 'not-a-real-set'; expected one of ['backend', 'mixed', 'ui', 'ui-trivial']"`);
    });
});

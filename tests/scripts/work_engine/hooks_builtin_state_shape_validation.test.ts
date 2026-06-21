// Golden-parity + unit tests for the py2ts state_shape_validation hook twin
// (ADR-094). Round-trips the live WorkState through state.to_dict/from_dict on
// AFTER_LOAD + BEFORE_SAVE; a SchemaError becomes a non-fatal HookError.
import { describe, expect, it } from 'vitest';

import { StateShapeValidationHook } from '../../../src/agent-src/templates/scripts/work_engine/hooks/builtin/state_shape_validation.js';
import { HookContext } from '../../../src/agent-src/templates/scripts/work_engine/hooks/context.js';
import { HookError } from '../../../src/agent-src/templates/scripts/work_engine/hooks/exceptions.js';
import { HookEvent } from '../../../src/agent-src/templates/scripts/work_engine/hooks/events.js';
import { HookRegistry } from '../../../src/agent-src/templates/scripts/work_engine/hooks/registry.js';
import { Input, WorkState } from '../../../src/agent-src/templates/scripts/work_engine/state.js';
import { hasPython3, runPyHooks } from './_hooks_pyloader.js';

const describePy = hasPython3() ? describe : describe.skip;

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

    it('invalid directive_set → SchemaError surfaced as HookError', () => {
        const work = new WorkState({ input: new Input('ticket'), directive_set: 'not-a-real-set' });
        const err = fire(HookEvent.BEFORE_SAVE, new HookContext({ work }));
        expect(err).toBeInstanceOf(HookError);
        expect(err?.message.startsWith('state-shape validation failed:')).toBe(true);
    });
});

describePy('StateShapeValidationHook — parity (python3 vs TS)', () => {
    // state.py is the same foundation twin; load it under work_engine.state so
    // the hook's `from ...state import …` resolves.
    function pyValidate(stateBuilder: string, stateFile: string | null): { msg: string | null } {
        const sfArg = stateFile === null ? 'None' : JSON.stringify(stateFile);
        const r = runPyHooks(
            {
                we: ['state'],
                foundation: ['exceptions', 'context', 'events', 'registry'],
                builtin: ['state_shape_validation'],
            },
            [
                'st = sys.modules["work_engine.state"]',
                `work = ${stateBuilder}`,
                'hook = state_shape_validation.StateShapeValidationHook()',
                `ctx = context.HookContext(work=work, state_file=${sfArg})`,
                'msg = None',
                'try:',
                '    hook._validate(ctx)',
                'except exceptions.HookError as e:',
                '    msg = str(e)',
                'print(json.dumps({"msg": msg}))',
            ].join('\n'),
        );
        if (r.status !== 0) throw new Error(`py state-shape failed: ${r.stderr || r.stdout}`);
        return JSON.parse(r.stdout.trim());
    }

    it('valid WorkState → no error on both', () => {
        const work = new WorkState({ input: new Input('ticket', { id: 'T-1' }) });
        expect(fire(HookEvent.BEFORE_SAVE, new HookContext({ work }))).toBeNull();
        expect(pyValidate('st.WorkState(input=st.Input(kind="ticket", data={"id": "T-1"}))', null).msg).toBeNull();
    });

    it('invalid directive_set → identical HookError message', () => {
        const work = new WorkState({ input: new Input('ticket'), directive_set: 'not-a-real-set' });
        const tsMsg = fire(HookEvent.BEFORE_SAVE, new HookContext({ work }))?.message;
        const pyMsg = pyValidate(
            'st.WorkState(input=st.Input(kind="ticket"), directive_set="not-a-real-set")',
            null,
        ).msg;
        expect(tsMsg).toBe(pyMsg);
    });

    it('null work message matches (with + without state_file)', () => {
        const r1 = runPyHooks(
            {
                we: ['state'],
                foundation: ['exceptions', 'context', 'events', 'registry'],
                builtin: ['state_shape_validation'],
            },
            [
                'import pathlib',
                'hook = state_shape_validation.StateShapeValidationHook()',
                'msg = None',
                'try:',
                '    hook._validate(context.HookContext(work=None, state_file=pathlib.Path("/tmp/s.json")))',
                'except exceptions.HookError as e:',
                '    msg = str(e)',
                'print(json.dumps({"msg": msg}))',
            ].join('\n'),
        );
        expect(r1.status).toBe(0);
        const pyMsg = (JSON.parse(r1.stdout.trim()) as { msg: string }).msg;
        const tsMsg = fire(HookEvent.AFTER_LOAD, new HookContext({ state_file: '/tmp/s.json' }))?.message;
        expect(tsMsg).toBe(pyMsg);
    });
});

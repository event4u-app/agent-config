// Golden-parity + unit tests for the py2ts halt_surface_audit hook twin
// (ADR-094). Fires on ON_HALT, raises HookError (non-fatal) when the halt
// surface is empty. Messages use `!r` repr on step_name.
import { describe, expect, it } from 'vitest';

import { HaltSurfaceAuditHook } from '../../../src/agent-src/templates/scripts/work_engine/hooks/builtin/halt_surface_audit.js';
import { HookContext } from '../../../src/agent-src/templates/scripts/work_engine/hooks/context.js';
import { HookError } from '../../../src/agent-src/templates/scripts/work_engine/hooks/exceptions.js';
import { HookEvent } from '../../../src/agent-src/templates/scripts/work_engine/hooks/events.js';
import { HookRegistry } from '../../../src/agent-src/templates/scripts/work_engine/hooks/registry.js';
import { hasPython3, runPyHooks } from './_hooks_pyloader.js';

const describePy = hasPython3() ? describe : describe.skip;

function fire(ctx: HookContext): HookError | null {
    const hook = new HaltSurfaceAuditHook();
    const reg = new HookRegistry();
    hook.register(reg);
    try {
        for (const cb of reg.for_event(HookEvent.ON_HALT)) cb(ctx);
    } catch (e) {
        if (e instanceof HookError) return e;
        throw e;
    }
    return null;
}

describe('HaltSurfaceAuditHook — TS unit checks', () => {
    it('registers only on ON_HALT', () => {
        const hook = new HaltSurfaceAuditHook();
        const reg = new HookRegistry();
        hook.register(reg);
        expect([...reg.events()]).toEqual([HookEvent.ON_HALT]);
    });

    it('StepResult with questions → no error', () => {
        const err = fire(new HookContext({ step_name: 'refine', result: { questions: ['1) a'] } }));
        expect(err).toBeNull();
    });

    it('StepResult with empty questions → HookError', () => {
        const err = fire(new HookContext({ step_name: 'refine', result: { questions: [] } }));
        expect(err?.message).toBe(
            "halt at step 'refine' surfaced no questions (StepResult.questions empty); the user has nothing to act on",
        );
    });

    it('no result, delivery has questions → no error', () => {
        const err = fire(new HookContext({ step_name: 'plan', delivery: { questions: ['1) x'] } }));
        expect(err).toBeNull();
    });

    it('no result, empty delivery.questions → HookError (hook-driven halt)', () => {
        const err = fire(new HookContext({ step_name: 'plan', delivery: { questions: [] } }));
        expect(err?.message).toBe(
            "halt at step 'plan' surfaced no questions (hook-driven halt with empty state.questions)",
        );
    });

    it('null step_name reprs as None', () => {
        const err = fire(new HookContext({ result: { questions: [] } }));
        expect(err?.message).toBe(
            'halt at step None surfaced no questions (StepResult.questions empty); the user has nothing to act on',
        );
    });
});

describePy('HaltSurfaceAuditHook — message parity (python3 vs TS)', () => {
    function pyAudit(snippet: string): string {
        const r = runPyHooks(
            {
                foundation: ['exceptions', 'context', 'events', 'registry'],
                builtin: ['halt_surface_audit'],
            },
            [
                'hook = halt_surface_audit.HaltSurfaceAuditHook()',
                snippet,
                'msg = None',
                'try:',
                '    hook._audit(ctx)',
                'except exceptions.HookError as e:',
                '    msg = str(e)',
                'print(json.dumps({"msg": msg}))',
            ].join('\n'),
        );
        if (r.status !== 0) throw new Error(`py audit failed: ${r.stderr || r.stdout}`);
        return (JSON.parse(r.stdout.trim()) as { msg: string | null }).msg ?? '<none>';
    }

    it('StepResult empty-questions message matches', () => {
        const ts = fire(new HookContext({ step_name: 'refine', result: { questions: [] } }))?.message;
        expect(ts).toBe(
            pyAudit("ctx = context.HookContext(step_name='refine', result=type('R',(),{'questions':[]})())"),
        );
    });

    it('hook-driven empty-delivery message matches', () => {
        const ts = fire(new HookContext({ step_name: 'plan', delivery: { questions: [] } }))?.message;
        expect(ts).toBe(
            pyAudit("ctx = context.HookContext(step_name='plan', delivery=type('D',(),{'questions':[]})())"),
        );
    });

    it('step_name with apostrophe → repr switches quotes, matches', () => {
        const ts = fire(new HookContext({ step_name: "it's", result: { questions: [] } }))?.message;
        expect(ts).toBe(
            pyAudit("ctx = context.HookContext(step_name=\"it's\", result=type('R',(),{'questions':[]})())"),
        );
    });
});

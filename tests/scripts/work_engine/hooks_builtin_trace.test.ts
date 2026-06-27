// Intent tests for the py2ts trace hook twin (ADR-094). Emits one line per
// event to a configurable stream; the exact line format is asserted directly
// below. Was a python3-vs-tsx parity rig; the `.py` original is gone, and the
// former parity block only re-checked the same four line formats the unit
// checks already pin byte-for-byte.
import { describe, expect, it } from 'vitest';

import { Outcome, StepResult } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import { TraceHook, type TextStream } from '../../../src/agent-src/templates/scripts/work_engine/hooks/builtin/trace.js';
import { HookContext } from '../../../src/agent-src/templates/scripts/work_engine/hooks/context.js';
import { HookError } from '../../../src/agent-src/templates/scripts/work_engine/hooks/exceptions.js';
import { HookEvent, HOOK_EVENTS } from '../../../src/agent-src/templates/scripts/work_engine/hooks/events.js';
import { HookRegistry } from '../../../src/agent-src/templates/scripts/work_engine/hooks/registry.js';

function collector(): { stream: TextStream; lines: string[] } {
    const lines: string[] = [];
    const stream: TextStream = {
        write(s: string) {
            lines.push(s);
            return true;
        },
        flush() {},
    };
    return { stream, lines };
}

function traceLine(event: HookEvent, ctx: HookContext, prefix = '[hook]'): string {
    const { stream, lines } = collector();
    const hook = new TraceHook(stream, prefix);
    const reg = new HookRegistry();
    hook.register(reg);
    for (const cb of reg.for_event(event)) cb(ctx);
    return lines.join('').replace(/\n$/, '');
}

describe('TraceHook — TS unit checks', () => {
    it('registers on every event', () => {
        const hook = new TraceHook(collector().stream);
        const reg = new HookRegistry();
        hook.register(reg);
        expect([...reg.events()]).toEqual([...HOOK_EVENTS]);
    });

    it('minimal line: just prefix + event', () => {
        expect(traceLine(HookEvent.BEFORE_LOAD, new HookContext())).toBe('[hook] event=before_load');
    });

    it('includes step/set when present', () => {
        const ctx = new HookContext({ step_name: 'memory', set_name: 'backend' });
        expect(traceLine(HookEvent.BEFORE_DISPATCH, ctx)).toBe(
            '[hook] event=before_dispatch step=memory set=backend',
        );
    });

    it('includes outcome value from result', () => {
        const ctx = new HookContext({
            step_name: 'verify',
            result: new StepResult({ outcome: Outcome.SUCCESS }),
        });
        expect(traceLine(HookEvent.AFTER_STEP, ctx)).toBe(
            '[hook] event=after_step step=verify outcome=success',
        );
    });

    it('includes final, halting, exception type', () => {
        const ctx = new HookContext({
            final: Outcome.BLOCKED,
            halting: 'phase',
            exception: new TypeError('x'),
        });
        expect(traceLine(HookEvent.AFTER_DISPATCH, ctx)).toBe(
            '[hook] event=after_dispatch final=blocked halting=phase exception=TypeError',
        );
    });

    it('custom prefix is honoured', () => {
        expect(traceLine(HookEvent.ON_ERROR, new HookContext(), '>>')).toBe('>> event=on_error');
    });

    it('a failing sink surfaces a HookError', () => {
        const badStream: TextStream = {
            write() {
                throw new Error('closed');
            },
        };
        const hook = new TraceHook(badStream);
        const reg = new HookRegistry();
        hook.register(reg);
        let err: unknown = null;
        try {
            for (const cb of reg.for_event(HookEvent.BEFORE_STEP)) cb(new HookContext());
        } catch (e) {
            err = e;
        }
        expect(err).toBeInstanceOf(HookError);
        expect((err as HookError).message).toBe('trace stream unavailable: closed');
    });
});

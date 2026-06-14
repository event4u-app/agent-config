// Golden-parity + unit tests for the py2ts trace hook twin (ADR-094). Emits
// one line per event to a configurable stream; the line format must match.
import { describe, expect, it } from 'vitest';

import { Outcome, StepResult } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import { TraceHook, type TextStream } from '../../../src/agent-src/templates/scripts/work_engine/hooks/builtin/trace.js';
import { HookContext } from '../../../src/agent-src/templates/scripts/work_engine/hooks/context.js';
import { HookError } from '../../../src/agent-src/templates/scripts/work_engine/hooks/exceptions.js';
import { HookEvent, HOOK_EVENTS } from '../../../src/agent-src/templates/scripts/work_engine/hooks/events.js';
import { HookRegistry } from '../../../src/agent-src/templates/scripts/work_engine/hooks/registry.js';
import { hasPython3, runPyHooks } from './_hooks_pyloader.js';

const describePy = hasPython3() ? describe : describe.skip;

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

describePy('TraceHook — line-format parity (python3 vs TS)', () => {
    function pyLine(event: string, ctxExpr: string): string {
        const r = runPyHooks(
            {
                we: ['delivery_state'],
                foundation: ['exceptions', 'context', 'events', 'registry'],
                builtin: ['trace'],
            },
            [
                'import io',
                'buf = io.StringIO()',
                'hook = trace.TraceHook(stream=buf)',
                'ds = sys.modules["work_engine.delivery_state"]',
                `ctx = ${ctxExpr}`,
                `cb = hook._make_callback(events.HookEvent.${event})`,
                'cb(ctx)',
                'print(json.dumps(buf.getvalue()))',
            ].join('\n'),
        );
        if (r.status !== 0) throw new Error(`py trace failed: ${r.stderr || r.stdout}`);
        return (JSON.parse(r.stdout.trim()) as string).replace(/\n$/, '');
    }

    it('event-only line matches', () => {
        expect(traceLine(HookEvent.BEFORE_LOAD, new HookContext())).toBe(
            pyLine('BEFORE_LOAD', 'context.HookContext()'),
        );
    });

    it('step+set line matches', () => {
        const ts = traceLine(
            HookEvent.BEFORE_DISPATCH,
            new HookContext({ step_name: 'memory', set_name: 'backend' }),
        );
        expect(ts).toBe(pyLine('BEFORE_DISPATCH', "context.HookContext(step_name='memory', set_name='backend')"));
    });

    it('outcome line matches (enum .value resolved)', () => {
        const ts = traceLine(
            HookEvent.AFTER_STEP,
            new HookContext({ step_name: 'verify', result: new StepResult({ outcome: Outcome.SUCCESS }) }),
        );
        expect(ts).toBe(
            pyLine(
                'AFTER_STEP',
                "context.HookContext(step_name='verify', result=ds.StepResult(outcome=ds.Outcome.SUCCESS))",
            ),
        );
    });

    it('final+halting+exception line matches', () => {
        const ts = traceLine(
            HookEvent.AFTER_DISPATCH,
            new HookContext({ final: Outcome.BLOCKED, halting: 'phase', exception: new TypeError('x') }),
        );
        expect(ts).toBe(
            pyLine(
                'AFTER_DISPATCH',
                "context.HookContext(final=ds.Outcome.BLOCKED, halting='phase', exception=TypeError('x'))",
            ),
        );
    });
});

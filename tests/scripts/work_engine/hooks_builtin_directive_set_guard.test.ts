// Golden-parity + unit tests for the py2ts directive_set_guard hook twin
// (ADR-094). The hook raises HookError on drift; the message uses Python
// `!r` repr formatting, so the parity layer checks the exact message text.
import { describe, expect, it } from 'vitest';

import { DirectiveSetGuardHook } from '../../../src/agent-src/templates/scripts/work_engine/hooks/builtin/directive_set_guard.js';
import { HookContext } from '../../../src/agent-src/templates/scripts/work_engine/hooks/context.js';
import { HookError } from '../../../src/agent-src/templates/scripts/work_engine/hooks/exceptions.js';
import { HookEvent } from '../../../src/agent-src/templates/scripts/work_engine/hooks/events.js';
import { HookRegistry } from '../../../src/agent-src/templates/scripts/work_engine/hooks/registry.js';
import { hasPython3, runPyHooks } from './_hooks_pyloader.js';

const describePy = hasPython3() ? describe : describe.skip;

function fire(ctx: HookContext): HookError | null {
    const hook = new DirectiveSetGuardHook();
    const reg = new HookRegistry();
    hook.register(reg);
    try {
        for (const cb of reg.for_event(HookEvent.BEFORE_DISPATCH)) cb(ctx);
    } catch (e) {
        if (e instanceof HookError) return e;
        throw e;
    }
    return null;
}

describe('DirectiveSetGuardHook — TS unit checks', () => {
    it('registers only on BEFORE_DISPATCH', () => {
        const hook = new DirectiveSetGuardHook();
        const reg = new HookRegistry();
        hook.register(reg);
        expect([...reg.events()]).toEqual([HookEvent.BEFORE_DISPATCH]);
    });

    it('missing work → HookError (both refs repr as None when absent)', () => {
        const err = fire(new HookContext({}));
        expect(err?.message).toBe(
            'directive-set guard: missing set_name or work on before_dispatch (set_name=None, work=None)',
        );
    });

    it('set_name present but work missing → HookError naming the set_name repr', () => {
        const err = fire(new HookContext({ set_name: 'backend' }));
        expect(err?.message).toBe(
            "directive-set guard: missing set_name or work on before_dispatch (set_name='backend', work=None)",
        );
    });

    it('matching set_name → no error', () => {
        const err = fire(new HookContext({ set_name: 'backend', work: { directive_set: 'backend' } }));
        expect(err).toBeNull();
    });

    it('legacy v0 (no directive_set) → no-op', () => {
        const err = fire(new HookContext({ set_name: 'backend', work: {} }));
        expect(err).toBeNull();
    });

    it('drift → HookError with repr-quoted names', () => {
        const err = fire(new HookContext({ set_name: 'frontend', work: { directive_set: 'backend' } }));
        expect(err?.message).toBe("directive-set drift: CLI resolved 'frontend' but state carries 'backend'");
    });
});

describePy('DirectiveSetGuardHook — message parity (python3 vs TS)', () => {
    function pyGuard(setName: string | null, work: string): string {
        const setArg = setName === null ? 'None' : JSON.stringify(setName);
        const r = runPyHooks(
            {
                foundation: ['exceptions', 'context', 'events', 'registry'],
                builtin: ['directive_set_guard'],
            },
            [
                'hook = directive_set_guard.DirectiveSetGuardHook()',
                `work = ${work}`,
                `ctx = context.HookContext(set_name=${setArg}, work=work)`,
                'msg = None',
                'try:',
                '    hook._guard(ctx)',
                'except exceptions.HookError as e:',
                '    msg = str(e)',
                'print(json.dumps({"msg": msg}))',
            ].join('\n'),
        );
        if (r.status !== 0) throw new Error(`py guard failed: ${r.stderr || r.stdout}`);
        return (JSON.parse(r.stdout.trim()) as { msg: string | null }).msg ?? '<none>';
    }

    it('drift message matches', () => {
        const ts = fire(new HookContext({ set_name: 'frontend', work: { directive_set: 'backend' } }))?.message;
        expect(ts).toBe(pyGuard('frontend', "type('W', (), {'directive_set': 'backend'})()"));
    });

    it('drift with a single-quote in the value → repr switches to double quotes', () => {
        const ts = fire(new HookContext({ set_name: "it's", work: { directive_set: 'backend' } }))?.message;
        expect(ts).toBe(pyGuard("it's", "type('W', (), {'directive_set': 'backend'})()"));
    });

    it('matching set → no error on both', () => {
        const ts = fire(new HookContext({ set_name: 'backend', work: { directive_set: 'backend' } }));
        expect(ts).toBeNull();
        expect(pyGuard('backend', "type('W', (), {'directive_set': 'backend'})()")).toBe('<none>');
    });
});

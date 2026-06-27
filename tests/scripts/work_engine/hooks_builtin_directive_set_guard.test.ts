// Intent tests for the py2ts directive_set_guard hook twin (ADR-094). The hook
// raises HookError on drift; the message uses Python `!r` repr formatting,
// asserted directly below. Was a python3-vs-tsx parity rig; the `.py` original
// is gone, so the one parity scenario the unit checks did not already cover —
// the repr quote-switch on a single-quoted value — is preserved as a
// python-free assertion of the tsx repr.
import { describe, expect, it } from 'vitest';

import { DirectiveSetGuardHook } from '../../../src/agent-src/templates/scripts/work_engine/hooks/builtin/directive_set_guard.js';
import { HookContext } from '../../../src/agent-src/templates/scripts/work_engine/hooks/context.js';
import { HookError } from '../../../src/agent-src/templates/scripts/work_engine/hooks/exceptions.js';
import { HookEvent } from '../../../src/agent-src/templates/scripts/work_engine/hooks/events.js';
import { HookRegistry } from '../../../src/agent-src/templates/scripts/work_engine/hooks/registry.js';

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

    it('drift with a single-quote in the value → repr switches to double quotes', () => {
        const err = fire(new HookContext({ set_name: "it's", work: { directive_set: 'backend' } }));
        expect(err?.message).toMatchInlineSnapshot(`"directive-set drift: CLI resolved "it's" but state carries 'backend'"`);
    });
});

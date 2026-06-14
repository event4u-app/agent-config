// Golden-parity + unit tests for the py2ts work_engine.hooks `registry` twin
// (ADR-094). `registry.py` imports `.context` + `.events`; loaded via the
// shared package-stub importlib loader.
import { describe, expect, it } from 'vitest';

import { HookContext } from '../../../src/agent-src/templates/scripts/work_engine/hooks/context.js';
import { HookEvent } from '../../../src/agent-src/templates/scripts/work_engine/hooks/events.js';
import { HookRegistry } from '../../../src/agent-src/templates/scripts/work_engine/hooks/registry.js';
import { hasPython3, runPyHooks } from './_hooks_pyloader.js';

const describePy = hasPython3() ? describe : describe.skip;

describe('work_engine.hooks.registry — TS unit checks', () => {
    it('for_event returns [] when nothing registered', () => {
        const r = new HookRegistry();
        expect(r.for_event(HookEvent.AFTER_STEP)).toEqual([]);
    });

    it('callbacks fire in registration order', () => {
        const r = new HookRegistry();
        const seen: number[] = [];
        r.register(HookEvent.AFTER_STEP, () => seen.push(1));
        r.register(HookEvent.AFTER_STEP, () => seen.push(2));
        r.register(HookEvent.AFTER_STEP, () => seen.push(3));
        const ctx = new HookContext();
        for (const cb of r.for_event(HookEvent.AFTER_STEP)) {
            cb(ctx);
        }
        expect(seen).toEqual([1, 2, 3]);
    });

    it('events() only yields events with at least one callback', () => {
        const r = new HookRegistry();
        r.register(HookEvent.ON_HALT, () => {});
        r.register(HookEvent.BEFORE_STEP, () => {});
        expect([...r.events()]).toEqual(['on_halt', 'before_step']);
    });

    it('for_event returns a copy (mutating it does not affect the registry)', () => {
        const r = new HookRegistry();
        r.register(HookEvent.AFTER_STEP, () => {});
        const list = r.for_event(HookEvent.AFTER_STEP);
        list.push(() => {});
        expect(r.for_event(HookEvent.AFTER_STEP).length).toBe(1);
    });
});

describePy('work_engine.hooks.registry — parity (python3 vs TS)', () => {
    it('insertion order + events() ordering match Python', () => {
        const r = runPyHooks(
            { foundation: ['exceptions', 'context', 'events', 'registry'] },
            [
                'reg = registry.HookRegistry()',
                'order = []',
                'reg.register(events.HookEvent.AFTER_STEP, lambda c: order.append(1))',
                'reg.register(events.HookEvent.AFTER_STEP, lambda c: order.append(2))',
                'reg.register(events.HookEvent.ON_HALT, lambda c: order.append(9))',
                'cbs = reg.for_event(events.HookEvent.AFTER_STEP)',
                'ctx = context.HookContext()',
                '[cb(ctx) for cb in cbs]',
                'print(json.dumps(order))',
                'print(json.dumps([e.value for e in reg.events()]))',
                'print(json.dumps([cb is not None for cb in reg.for_event(events.HookEvent.BEFORE_STEP)]))',
            ].join('\n'),
        );
        expect(r.status).toBe(0);
        const [pyOrder, pyEvents, pyEmpty] = r.stdout.trim().split('\n').map((l) => JSON.parse(l));
        expect(pyOrder).toEqual([1, 2]);
        expect(pyEvents).toEqual(['after_step', 'on_halt']);
        expect(pyEmpty).toEqual([]);

        // TS analog.
        const reg = new HookRegistry();
        const order: number[] = [];
        reg.register(HookEvent.AFTER_STEP, () => order.push(1));
        reg.register(HookEvent.AFTER_STEP, () => order.push(2));
        reg.register(HookEvent.ON_HALT, () => order.push(9));
        const ctx = new HookContext();
        for (const cb of reg.for_event(HookEvent.AFTER_STEP)) cb(ctx);
        expect(order).toEqual([1, 2]);
        expect([...reg.events()]).toEqual(['after_step', 'on_halt']);
        expect(reg.for_event(HookEvent.BEFORE_STEP)).toEqual([]);
    });
});

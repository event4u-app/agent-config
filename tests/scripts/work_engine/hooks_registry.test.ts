// Intent tests for the py2ts work_engine.hooks `registry` twin (ADR-094).
// Was a python3-vs-tsx parity rig; the `.py` original is gone, so this asserts
// the tsx registry's own contract directly. (The former parity block only
// re-checked registration order / `events()` ordering / empty `for_event`,
// all covered by the unit checks below.)
import { describe, expect, it } from 'vitest';

import { HookContext } from '../../../src/agent-src/templates/scripts/work_engine/hooks/context.js';
import { HookEvent } from '../../../src/agent-src/templates/scripts/work_engine/hooks/events.js';
import { HookRegistry } from '../../../src/agent-src/templates/scripts/work_engine/hooks/registry.js';

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

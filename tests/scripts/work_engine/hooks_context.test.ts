import { describe, expect, it } from 'vitest';

import { HookContext } from '../../../src/agent-src/templates/scripts/work_engine/hooks/context.js';

describe('work_engine.hooks.context — TS unit checks', () => {
    it('all fields default to null / empty extra', () => {
        const c = new HookContext();
        expect(c.step_name).toBeNull();
        expect(c.delivery).toBeNull();
        expect(c.result).toBeNull();
        expect(c.exception).toBeNull();
        expect(c.work).toBeNull();
        expect(c.state_file).toBeNull();
        expect(c.fmt).toBeNull();
        expect(c.set_name).toBeNull();
        expect(c.final).toBeNull();
        expect(c.halting).toBeNull();
        expect(c.args).toBeNull();
        expect(c.extra).toEqual({});
    });

    it('extra is per-instance (no shared default mapping)', () => {
        const a = new HookContext();
        const b = new HookContext();
        a.extra['k'] = 1;
        expect(b.extra).toEqual({});
    });

    it('keyword construction populates the requested fields', () => {
        const c = new HookContext({ step_name: 'memory', set_name: 'backend', halting: 'phase' });
        expect(c.step_name).toBe('memory');
        expect(c.set_name).toBe('backend');
        expect(c.halting).toBe('phase');
        expect(c.work).toBeNull();
    });
});

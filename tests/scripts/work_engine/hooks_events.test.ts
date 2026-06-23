
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    HOOK_EVENTS,
    HookEvent,
} from '../../../src/agent-src/templates/scripts/work_engine/hooks/events.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const EVENTS_PY = path.join(
    REPO_ROOT,
    'src',
    'agent-src',
    'templates',
    'scripts',
    'work_engine',
    'hooks',
    'events.py',
);

describe('work_engine.hooks.events — TS unit checks', () => {
    it('every member value equals its event name', () => {
        expect(HookEvent.BEFORE_STEP).toBe('before_step');
        expect(HookEvent.AFTER_STEP).toBe('after_step');
        expect(HookEvent.ON_HALT).toBe('on_halt');
        expect(HookEvent.ON_ERROR).toBe('on_error');
        expect(HookEvent.BEFORE_LOAD).toBe('before_load');
        expect(HookEvent.AFTER_LOAD).toBe('after_load');
        expect(HookEvent.BEFORE_DISPATCH).toBe('before_dispatch');
        expect(HookEvent.AFTER_DISPATCH).toBe('after_dispatch');
        expect(HookEvent.BEFORE_SAVE).toBe('before_save');
        expect(HookEvent.AFTER_SAVE).toBe('after_save');
    });

    it('HOOK_EVENTS preserves Python declaration order', () => {
        expect([...HOOK_EVENTS]).toEqual([
            'before_step',
            'after_step',
            'on_halt',
            'on_error',
            'before_load',
            'after_load',
            'before_dispatch',
            'after_dispatch',
            'before_save',
            'after_save',
        ]);
    });
});

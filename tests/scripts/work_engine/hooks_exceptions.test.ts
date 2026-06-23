
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    HookError,
    HookHalt,
    _HookSignal,
} from '../../../src/agent-src/templates/scripts/work_engine/hooks/exceptions.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const EXC_PY = path.join(
    REPO_ROOT,
    'src',
    'agent-src',
    'templates',
    'scripts',
    'work_engine',
    'hooks',
    'exceptions.py',
);

describe('work_engine.hooks.exceptions — TS unit checks', () => {
    it('HookError and HookHalt extend _HookSignal and Error', () => {
        const e = new HookError('boom');
        expect(e instanceof _HookSignal).toBe(true);
        expect(e instanceof Error).toBe(true);
        expect(e.name).toBe('HookError');
        expect(e.message).toBe('boom');

        const h = new HookHalt('foreign');
        expect(h instanceof _HookSignal).toBe(true);
        expect(h instanceof Error).toBe(true);
        expect(h.name).toBe('HookHalt');
    });

    it('HookError is NOT a HookHalt and vice versa', () => {
        expect(new HookError('x') instanceof HookHalt).toBe(false);
        expect(new HookHalt('x') instanceof HookError).toBe(false);
    });

    it('HookHalt stores reason; default surface is an empty list', () => {
        const h = new HookHalt('missing');
        expect(h.reason).toBe('missing');
        expect(h.surface).toEqual([]);
        expect(h.message).toBe('missing'); // super(reason)
    });

    it('HookHalt copies the surface list (no shared reference)', () => {
        const src = ['1) a', '2) b'];
        const h = new HookHalt('validation_failed', src);
        expect(h.surface).toEqual(['1) a', '2) b']);
        src.push('3) c');
        expect(h.surface).toEqual(['1) a', '2) b']); // not aliased
    });

    it('null surface yields an empty list', () => {
        expect(new HookHalt('r', null).surface).toEqual([]);
    });
});

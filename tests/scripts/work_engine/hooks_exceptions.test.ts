// Golden-parity + unit tests for the py2ts work_engine.hooks `exceptions` twin
// (ADR-094). `exceptions.py` has no intra-package imports — it is loaded via a
// direct-file importlib loader. The TS twin is exercised directly.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
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

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function runPy(body: string): SpawnSyncReturns<string> {
    const loader = [
        'import sys, importlib.util',
        `spec = importlib.util.spec_from_file_location("exceptions", ${JSON.stringify(EXC_PY)})`,
        'exceptions = importlib.util.module_from_spec(spec)',
        'sys.modules["exceptions"] = exceptions',
        'spec.loader.exec_module(exceptions)',
    ].join('\n');
    return spawnSync('python3', ['-c', `${loader}\n${body}`], { encoding: 'utf8' });
}

const describePy = hasPython3() ? describe : describe.skip;

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

describePy('work_engine.hooks.exceptions — parity (python3 vs TS)', () => {
    it('Python hierarchy matches: HookError/HookHalt subclass _HookSignal', () => {
        const r = runPy(
            [
                'print(issubclass(exceptions.HookError, exceptions._HookSignal))',
                'print(issubclass(exceptions.HookHalt, exceptions._HookSignal))',
                'print(issubclass(exceptions.HookError, exceptions.HookHalt))',
            ].join('\n'),
        );
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('True\nTrue\nFalse\n');
        // TS analog:
        expect(new HookError('x') instanceof _HookSignal).toBe(true);
        expect(new HookHalt('x') instanceof _HookSignal).toBe(true);
        expect(new HookError('x') instanceof HookHalt).toBe(false);
    });

    it('HookHalt(reason, surface) — reason + surface match across engines', () => {
        const r = runPy(
            [
                'h = exceptions.HookHalt("foreign", ["1) a", "2) b"])',
                'print(h.reason)',
                'import json; print(json.dumps(h.surface))',
                'h2 = exceptions.HookHalt("missing")',
                'print(json.dumps(h2.surface))',
            ].join('\n'),
        );
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('foreign\n["1) a", "2) b"]\n[]\n');

        const h = new HookHalt('foreign', ['1) a', '2) b']);
        expect(h.reason).toBe('foreign');
        expect(h.surface).toEqual(['1) a', '2) b']);
        expect(new HookHalt('missing').surface).toEqual([]);
    });

    it('__all__ exports the two public signals', () => {
        const r = runPy('import json; print(json.dumps(sorted(exceptions.__all__)))');
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('["HookError", "HookHalt"]\n');
    });
});

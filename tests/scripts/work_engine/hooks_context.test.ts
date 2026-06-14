// Golden-parity + unit tests for the py2ts work_engine.hooks `context` twin
// (ADR-094). `context.py` is a dataclass with stdlib-only imports.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { HookContext } from '../../../src/agent-src/templates/scripts/work_engine/hooks/context.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const CONTEXT_PY = path.join(
    REPO_ROOT,
    'src',
    'agent-src',
    'templates',
    'scripts',
    'work_engine',
    'hooks',
    'context.py',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function runPy(body: string): SpawnSyncReturns<string> {
    const loader = [
        'import sys, importlib.util',
        `spec = importlib.util.spec_from_file_location("context", ${JSON.stringify(CONTEXT_PY)})`,
        'context = importlib.util.module_from_spec(spec)',
        'sys.modules["context"] = context',
        'spec.loader.exec_module(context)',
    ].join('\n');
    return spawnSync('python3', ['-c', `${loader}\n${body}`], { encoding: 'utf8' });
}

const describePy = hasPython3() ? describe : describe.skip;

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

describePy('work_engine.hooks.context — parity (python3 vs TS)', () => {
    it('default field set + None-defaults match the dataclass', () => {
        const r = runPy(
            [
                'import dataclasses, json',
                'c = context.HookContext()',
                'd = dataclasses.asdict(c)',
                'print(json.dumps(d, default=str))',
            ].join('\n'),
        );
        expect(r.status).toBe(0);
        const py = JSON.parse(r.stdout) as Record<string, unknown>;
        const c = new HookContext();
        // Same field names, all None/empty.
        expect(Object.keys(py).sort()).toEqual(
            [
                'args',
                'delivery',
                'exception',
                'extra',
                'final',
                'fmt',
                'halting',
                'result',
                'set_name',
                'state_file',
                'step_name',
                'work',
            ].sort(),
        );
        expect(py['step_name']).toBeNull();
        expect(py['extra']).toEqual({});
        expect(c.step_name).toBeNull();
        expect(c.extra).toEqual({});
    });
});

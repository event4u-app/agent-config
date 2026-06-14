// Golden-parity + unit tests for the py2ts work_engine.hooks `events` twin
// (ADR-094). `events.py` is a str-Enum with no intra-package imports.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
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

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function runPy(body: string): SpawnSyncReturns<string> {
    const loader = [
        'import sys, importlib.util',
        `spec = importlib.util.spec_from_file_location("events", ${JSON.stringify(EVENTS_PY)})`,
        'events = importlib.util.module_from_spec(spec)',
        'sys.modules["events"] = events',
        'spec.loader.exec_module(events)',
    ].join('\n');
    return spawnSync('python3', ['-c', `${loader}\n${body}`], { encoding: 'utf8' });
}

const describePy = hasPython3() ? describe : describe.skip;

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

describePy('work_engine.hooks.events — parity (python3 vs TS)', () => {
    it('member values + iteration order match Python', () => {
        const r = runPy('import json; print(json.dumps([e.value for e in events.HookEvent]))');
        expect(r.status).toBe(0);
        const pyOrder = JSON.parse(r.stdout) as string[];
        expect(pyOrder).toEqual([...HOOK_EVENTS]);
    });

    it('str-Enum: member == its string value', () => {
        const r = runPy(
            'print(events.HookEvent.BEFORE_STEP == "before_step", events.HookEvent.AFTER_SAVE == "after_save")',
        );
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('True True\n');
        expect(HookEvent.BEFORE_STEP === 'before_step').toBe(true);
        expect(HookEvent.AFTER_SAVE === 'after_save').toBe(true);
    });
});

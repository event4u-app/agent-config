// Intent tests for the py2ts decision_trace hook twin (ADR-094). The hook
// writes a decision-trace JSON file per phase; this asserts the tsx envelope
// shape directly via an inline snapshot. The two timestamp fields are
// non-deterministic, so they are normalised to a fixed token before the
// snapshot (documented in-line). Was a python3-vs-tsx byte-parity rig; the
// `.py` original is gone.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    DecisionTraceHook,
    SCHEMA_VERSION,
} from '../../../src/agent-src/templates/scripts/work_engine/hooks/builtin/decision_trace.js';
import { HookContext } from '../../../src/agent-src/templates/scripts/work_engine/hooks/context.js';
import { HookEvent } from '../../../src/agent-src/templates/scripts/work_engine/hooks/events.js';
import { HookRegistry } from '../../../src/agent-src/templates/scripts/work_engine/hooks/registry.js';

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-dtrace-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

// Normalise the two ISO-8601 timestamp fields so the byte comparison is over
// the deterministic envelope shape, not the wall clock.
function normaliseTrace(text: string): string {
    return text
        .replace(/"started_at": "[^"]*"/, '"started_at": "<TS>"')
        .replace(/"ended_at": "[^"]*"/, '"ended_at": "<TS>"');
}

/** Drive the TS hook through BEFORE_LOAD → BEFORE_STEP → AFTER_STEP. */
function runTsTrace(stateFile: string, phase: string, delivery: Record<string, unknown>): string {
    const hook = new DecisionTraceHook();
    const reg = new HookRegistry();
    hook.register(reg);
    const ctxLoad = new HookContext({ state_file: stateFile });
    for (const cb of reg.for_event(HookEvent.BEFORE_LOAD)) cb(ctxLoad);
    const ctxStep = new HookContext({ step_name: phase, delivery });
    for (const cb of reg.for_event(HookEvent.BEFORE_STEP)) cb(ctxStep);
    for (const cb of reg.for_event(HookEvent.AFTER_STEP)) cb(ctxStep);
    // The hook computes the target relative to the state file; resolve it.
    const target = resolveTarget(stateFile, phase);
    return fs.readFileSync(target, 'utf-8');
}

function resolveTarget(stateFile: string, phase: string): string {
    const filename = `decision-trace-${phase}.json`;
    const parent = path.dirname(stateFile);
    const grand = path.basename(path.dirname(parent));
    if (path.basename(parent) && grand === 'work') {
        return path.join(parent, filename);
    }
    const stem = path.basename(stateFile).replace(/\.[^.]+$/, '');
    return path.join(parent, `${stem}.${filename}`);
}

describe('DecisionTraceHook — TS unit checks', () => {
    it('SCHEMA_VERSION is 1', () => {
        expect(SCHEMA_VERSION).toBe(1);
    });

    it('writes an envelope with the v1 shape under a work/<id>/ path', () => {
        const dir = path.join(tmp, 'work', 'abc123');
        fs.mkdirSync(dir, { recursive: true });
        const stateFile = path.join(dir, 'state.json');
        const text = runTsTrace(stateFile, 'memory', {
            memory: [{ id: 'r1', hit: true }],
            verify: { claims: 2, first_try_passes: 2 },
            changes: [{ file: 'a.ts' }],
        });
        const env = JSON.parse(text) as Record<string, unknown>;
        expect(env['schema_version']).toBe(1);
        expect(env['work_id']).toBe('abc123');
        expect(env['phase']).toBe('memory');
        expect(env['rules']).toEqual([]);
        // summarise_memory: each entry adds asks (default 1) → 1 entry = asks 1.
        expect(env['memory']).toEqual({ asks: 1, hits: 1, ids: ['r1'] });
        expect(text.endsWith('}\n')).toBe(true); // trailing newline
    });

    it('work_id falls back to the file stem outside a work/ tree', () => {
        const stateFile = path.join(tmp, 'mystate.json');
        runTsTrace(stateFile, 'plan', {});
        expect(fs.existsSync(path.join(tmp, 'mystate.decision-trace-plan.json'))).toBe(true);
        const env = JSON.parse(
            fs.readFileSync(path.join(tmp, 'mystate.decision-trace-plan.json'), 'utf-8'),
        ) as Record<string, unknown>;
        expect(env['work_id']).toBe('mystate');
    });

    it('no step_name on AFTER_STEP → no file written', () => {
        const hook = new DecisionTraceHook();
        const reg = new HookRegistry();
        hook.register(reg);
        for (const cb of reg.for_event(HookEvent.AFTER_STEP)) cb(new HookContext());
        expect(fs.readdirSync(tmp)).toEqual([]);
    });
});

describe('DecisionTraceHook — envelope contract', () => {
    it('full envelope under work/<id>/ (timestamps normalised)', () => {
        const tsDir = path.join(tmp, 'ts', 'work', 'id99');
        fs.mkdirSync(tsDir, { recursive: true });
        const tsText = runTsTrace(path.join(tsDir, 'state.json'), 'memory', {
            memory: [
                { id: 'r1', hit: true },
                { id: 'r2', hit: true, asks: 2 },
            ],
            verify: { claims: 2, first_try_passes: 2 },
            changes: [{ file: 'a.ts' }],
            questions: [],
        });
        expect(normaliseTrace(tsText)).toMatchInlineSnapshot(`
          "{
            "schema_version": 1,
            "work_id": "id99",
            "phase": "memory",
            "started_at": "<TS>",
            "ended_at": "<TS>",
            "confidence_band": "high",
            "risk_class": "medium",
            "rules": [],
            "memory": {
              "asks": 3,
              "hits": 2,
              "ids": [
                "r1",
                "r2"
              ]
            },
            "verify": {
              "claims": 2,
              "first_try_passes": 2
            }
          }
          "
        `);
    });

    it('empty-delivery envelope (low band, low risk, empty memory)', () => {
        const tsDir = path.join(tmp, 'ts2');
        fs.mkdirSync(tsDir, { recursive: true });
        const tsText = runTsTrace(path.join(tsDir, 's.json'), 'refine', {});
        expect(normaliseTrace(tsText)).toMatchInlineSnapshot(`
          "{
            "schema_version": 1,
            "work_id": "s",
            "phase": "refine",
            "started_at": "<TS>",
            "ended_at": "<TS>",
            "confidence_band": "low",
            "risk_class": "low",
            "rules": [],
            "memory": {
              "asks": 0,
              "hits": 0,
              "ids": []
            },
            "verify": {
              "claims": 0,
              "first_try_passes": 0
            }
          }
          "
        `);
    });

    it('timestamp format is the contract ISO-8601 UTC second-precision form', () => {
        const tsDir = path.join(tmp, 'ts3');
        fs.mkdirSync(tsDir, { recursive: true });
        const text = runTsTrace(path.join(tsDir, 's.json'), 'plan', {});
        expect(text).toMatch(/"started_at": "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/);
        expect(text).toMatch(/"ended_at": "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/);
    });
});

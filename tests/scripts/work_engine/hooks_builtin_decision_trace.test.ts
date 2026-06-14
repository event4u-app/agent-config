// Golden-parity + unit tests for the py2ts decision_trace hook twin (ADR-094).
// The hook writes a decision-trace JSON file per phase. The envelope must be
// byte-identical (json.dumps(indent=2, sort_keys=False) + "\n") on both
// engines; the two timestamp fields are non-deterministic so they are
// normalised to a fixed token before the byte comparison (documented in-line).
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
import { hasPython3, runPyHooks } from './_hooks_pyloader.js';

const describePy = hasPython3() ? describe : describe.skip;

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

describePy('DecisionTraceHook — envelope parity (python3 vs TS)', () => {
    function pyTrace(stateFile: string, phase: string, deliveryExpr: string): string {
        const r = runPyHooks(
            {
                we: ['scoring.decision_trace'],
                foundation: ['exceptions', 'context', 'events', 'registry'],
                builtin: ['decision_trace'],
            },
            [
                'import pathlib',
                'hook = decision_trace.DecisionTraceHook()',
                `sf = pathlib.Path(${JSON.stringify(stateFile)})`,
                'hook.register(registry.HookRegistry()) if False else None',
                'hook._capture_state_file(context.HookContext(state_file=sf))',
                `delivery = ${deliveryExpr}`,
                `hook._mark_step_start(context.HookContext(step_name=${JSON.stringify(phase)}, delivery=delivery))`,
                `hook._emit_trace(context.HookContext(step_name=${JSON.stringify(phase)}, delivery=delivery))`,
                `target = hook._target_path(${JSON.stringify(phase)})`,
                'print(target.read_text(encoding="utf-8"), end="")',
            ].join('\n'),
        );
        if (r.status !== 0) throw new Error(`py trace failed: ${r.stderr || r.stdout}`);
        return r.stdout;
    }

    it('envelope is byte-identical under work/<id>/ (timestamps normalised)', () => {
        // Two separate temp dirs so each engine writes its own copy.
        const tsDir = path.join(tmp, 'ts', 'work', 'id99');
        const pyDir = path.join(tmp, 'py', 'work', 'id99');
        fs.mkdirSync(tsDir, { recursive: true });
        fs.mkdirSync(pyDir, { recursive: true });

        const tsText = runTsTrace(path.join(tsDir, 'state.json'), 'memory', {
            memory: [
                { id: 'r1', hit: true },
                { id: 'r2', hit: true, asks: 2 },
            ],
            verify: { claims: 2, first_try_passes: 2 },
            changes: [{ file: 'a.ts' }],
            questions: [],
        });
        const pyText = pyTrace(
            path.join(pyDir, 'state.json'),
            'memory',
            "type('D',(),{'memory':[{'id':'r1','hit':True},{'id':'r2','hit':True,'asks':2}],'verify':{'claims':2,'first_try_passes':2},'changes':[{'file':'a.ts'}],'questions':[]})()",
        );
        expect(normaliseTrace(tsText)).toBe(normaliseTrace(pyText));
    });

    it('empty-delivery envelope matches (low band, low risk, empty memory)', () => {
        const tsDir = path.join(tmp, 'ts2');
        const pyDir = path.join(tmp, 'py2');
        fs.mkdirSync(tsDir, { recursive: true });
        fs.mkdirSync(pyDir, { recursive: true });

        const tsText = runTsTrace(path.join(tsDir, 's.json'), 'refine', {});
        const pyText = pyTrace(path.join(pyDir, 's.json'), 'refine', "type('D',(),{})()");
        expect(normaliseTrace(tsText)).toBe(normaliseTrace(pyText));
    });

    it('timestamp format is the contract ISO-8601 UTC second-precision form', () => {
        const tsDir = path.join(tmp, 'ts3');
        fs.mkdirSync(tsDir, { recursive: true });
        const text = runTsTrace(path.join(tsDir, 's.json'), 'plan', {});
        expect(text).toMatch(/"started_at": "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/);
        expect(text).toMatch(/"ended_at": "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/);
    });
});

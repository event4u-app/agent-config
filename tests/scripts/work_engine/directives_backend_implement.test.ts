// Golden-parity tests for work_engine/directives/backend/implement.ts vs
// implement.py (ADR-094 py2ts Phase 1 — backend directive set).
//
// `implement.py` imports `...delivery_state` and `...persona_policy`, so it
// loads as a real package member via `sys.path` + import. Persona gating
// (advisory short-circuits to SUCCESS) is covered alongside the plan-gate and
// changes-shape paths. TS twin in-process; Python via python3 subprocess;
// byte-exact `{outcome, questions, message}` compare. No non-determinism.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { AMBIGUITIES, run } from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/implement.js';
import { DeliveryState, type StepResult } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SCRIPTS_ROOT = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function runPy(moduleName: string, stateJson: string): string {
    const code = [
        'import sys, json, importlib',
        `sys.path.insert(0, ${JSON.stringify(SCRIPTS_ROOT)})`,
        `mod = importlib.import_module("work_engine.directives.backend.${moduleName}")`,
        'from work_engine.delivery_state import DeliveryState',
        'payload = json.loads(sys.argv[1])',
        'st = DeliveryState(**payload)',
        'r = mod.run(st)',
        'out = {"outcome": r.outcome.value, "questions": r.questions, "message": r.message}',
        'sys.stdout.write(json.dumps(out, indent=2, ensure_ascii=False))',
    ].join('\n');
    const r = spawnSync('python3', ['-c', code, stateJson], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout;
}

function runTs(state: ConstructorParameters<typeof DeliveryState>[0]): string {
    const r: StepResult = run(new DeliveryState(state));
    return JSON.stringify({ outcome: r.outcome, questions: r.questions, message: r.message }, null, 2);
}

function pyFixture(state: ConstructorParameters<typeof DeliveryState>[0]): string {
    return JSON.stringify(state);
}

const py = hasPython3();
const describeParity = py ? describe : describe.skip;

const ok = { plan: 'success' };

describe('directives/backend/implement — AMBIGUITIES', () => {
    it('declares the three surfaces in order', () => {
        expect(AMBIGUITIES.map((a) => a.code)).toEqual([
            'upstream_plan_failed',
            'empty_changes_delegate',
            'malformed_changes',
        ]);
    });
});

describeParity('directives/backend/implement — golden parity (ts == py)', () => {
    const cases: Array<[string, ConstructorParameters<typeof DeliveryState>[0]]> = [
        [
            'advisory persona → SUCCESS short-circuit (skip)',
            { ticket: { id: 'I-1' }, persona: 'advisory', outcomes: ok },
        ],
        ['plan not success → BLOCKED precondition', { ticket: { id: 'I-2' }, outcomes: {} }],
        ['empty changes → delegate apply-plan', { ticket: { id: 'I-3' }, outcomes: ok }],
        [
            'valid changes → SUCCESS',
            { ticket: { id: 'I-4' }, changes: [{ path: 'a.ts' }, { file: 'b.ts' }], outcomes: ok },
        ],
        [
            'malformed change (no path/file) → BLOCKED shape',
            { ticket: { id: 'I-5' }, changes: [{ purpose: 'x' }], outcomes: ok },
        ],
        [
            'malformed change (non-dict entry) → BLOCKED shape',
            { ticket: { id: 'I-6' }, changes: ['not a dict'] as unknown as Array<Record<string, unknown>>, outcomes: ok },
        ],
        [
            'malformed change (blank path) → BLOCKED shape',
            { ticket: { id: 'I-7' }, changes: [{ path: '   ' }], outcomes: ok },
        ],
        [
            'multiple malformed changes → BLOCKED shape (joined)',
            { ticket: { id: 'I-8' }, changes: ['x', { why: 'y' }] as unknown as Array<Record<string, unknown>>, outcomes: ok },
        ],
        [
            'qa persona behaves like senior (no skip) → delegate',
            { ticket: { id: 'I-9' }, persona: 'qa', outcomes: ok },
        ],
        [
            'path falsy falls back to file key → SUCCESS',
            { ticket: { id: 'I-10' }, changes: [{ path: '', file: 'real.ts' }], outcomes: ok },
        ],
        ['no ticket id, delegate → "(no id)"', { ticket: {}, outcomes: ok }],
    ];

    it.each(cases)('%s', (_label, state) => {
        expect(runTs(state)).toBe(runPy('implement', pyFixture(state)));
    });
});

// Golden-parity tests for work_engine/directives/backend/analyze.ts vs
// analyze.py (ADR-094 py2ts Phase 1 — backend directive set).
//
// `analyze.py` has intra-package imports (`from ...delivery_state import …`),
// so the direct-file importlib loader used by state.test.ts does NOT work here.
// Instead we add `src/agent-src/templates/scripts` to `sys.path` and
// `import work_engine.directives.backend.analyze` as a real package member —
// the package `__init__` imports its (still-Python) siblings, which all exist
// in source until the Phase-12 sweep. The TS twin is exercised in-process; the
// Python original via a python3 subprocess. Both build a `DeliveryState` from
// the same JSON fixture and emit `{outcome, questions, message}` as
// `json.dumps(..., indent=2, ensure_ascii=False)` for a byte-exact compare.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { AMBIGUITIES, run } from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/analyze.js';
import { DeliveryState, type StepResult } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SCRIPTS_ROOT = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/**
 * Drive `work_engine.directives.backend.<MODULE>.run` on python3 from a JSON
 * state fixture; emit `{outcome, questions, message}` as canonical JSON.
 */
function runPy(moduleName: string, stateJson: string): string {
    const code = [
        'import sys, json',
        `sys.path.insert(0, ${JSON.stringify(SCRIPTS_ROOT)})`,
        `import importlib`,
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

/** TS twin: build DeliveryState from the fixture, run, emit canonical JSON. */
function runTs(state: ConstructorParameters<typeof DeliveryState>[0]): string {
    const r: StepResult = run(new DeliveryState(state));
    return JSON.stringify({ outcome: r.outcome, questions: r.questions, message: r.message }, null, 2);
}

/** Build the matching python fixture JSON from the same constructor args. */
function pyFixture(state: ConstructorParameters<typeof DeliveryState>[0]): string {
    return JSON.stringify(state);
}

const py = hasPython3();
const describeParity = py ? describe : describe.skip;

describe('directives/backend/analyze — AMBIGUITIES', () => {
    it('declares the three precondition surfaces in order', () => {
        expect(AMBIGUITIES.map((a) => a.code)).toEqual([
            'upstream_refine_failed',
            'upstream_memory_failed',
            'lost_ac',
        ]);
    });
});

describeParity('directives/backend/analyze — golden parity (ts == py)', () => {
    const cases: Array<[string, ConstructorParameters<typeof DeliveryState>[0]]> = [
        [
            'all preconditions met → SUCCESS',
            {
                ticket: { id: 'T-1', acceptance_criteria: ['must do X'] },
                outcomes: { refine: 'success', memory: 'success' },
            },
        ],
        [
            'refine not success → BLOCKED (single reason)',
            {
                ticket: { id: 'T-2', acceptance_criteria: ['a'] },
                outcomes: { memory: 'success' },
            },
        ],
        [
            'memory not success → BLOCKED',
            {
                ticket: { id: 'T-3', acceptance_criteria: ['a'] },
                outcomes: { refine: 'success' },
            },
        ],
        [
            'lost acceptance criteria (empty list) → BLOCKED',
            {
                ticket: { id: 'T-4', acceptance_criteria: [] },
                outcomes: { refine: 'success', memory: 'success' },
            },
        ],
        [
            'acceptance_criteria not a list → BLOCKED',
            {
                ticket: { id: 'T-5', acceptance_criteria: 'a string not a list' },
                outcomes: { refine: 'success', memory: 'success' },
            },
        ],
        [
            'all three missing → BLOCKED (three reasons joined)',
            {
                ticket: { id: 'T-6' },
                outcomes: {},
            },
        ],
        [
            'no ticket id → "(no id)" in headnote',
            {
                ticket: {},
                outcomes: {},
            },
        ],
        [
            'empty-string ticket id falls back to "(no id)"',
            {
                ticket: { id: '' },
                outcomes: { refine: 'success', memory: 'success' },
            },
        ],
    ];

    it.each(cases)('%s', (_label, state) => {
        const tsOut = runTs(state);
        const pyOut = runPy('analyze', pyFixture(state));
        expect(tsOut).toBe(pyOut);
    });
});

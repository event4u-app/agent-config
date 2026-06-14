// Golden-parity tests for work_engine/directives/backend/test.ts vs test.py
// (ADR-094 py2ts Phase 1 — backend directive set).
//
// `test.py` imports `...delivery_state` + `...persona_policy`, so it loads as a
// real package member via `sys.path` + import. Covers persona gating (advisory
// skip, qa widen=full), verdict validation (`{verdict!r}` repr in the malformed
// message), and the bad-verdict halt. TS twin in-process; Python via python3
// subprocess; byte-exact `{outcome, questions, message}` compare. Malformed-
// verdict fixtures use only None / plain strings so the `repr()` rendering
// (`'x'`, `None`) is unambiguous across engines. No non-determinism.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { AMBIGUITIES, run } from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/test.js';
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

const ok = { implement: 'success' };

describe('directives/backend/test — AMBIGUITIES', () => {
    it('declares the four surfaces in order', () => {
        expect(AMBIGUITIES.map((a) => a.code)).toEqual([
            'upstream_implement_failed',
            'empty_tests_delegate',
            'malformed_tests',
            'bad_test_verdict',
        ]);
    });
});

describeParity('directives/backend/test — golden parity (ts == py)', () => {
    const cases: Array<[string, ConstructorParameters<typeof DeliveryState>[0]]> = [
        ['advisory persona → SUCCESS short-circuit', { ticket: { id: 'T-1' }, persona: 'advisory', outcomes: ok }],
        ['implement not success → BLOCKED precondition', { ticket: { id: 'T-2' }, outcomes: {} }],
        ['empty tests, senior → delegate targeted', { ticket: { id: 'T-3' }, outcomes: ok }],
        ['empty tests, qa → delegate full (widen)', { ticket: { id: 'T-4' }, persona: 'qa', outcomes: ok }],
        ['success verdict → SUCCESS', { ticket: { id: 'T-5' }, tests: { verdict: 'success' }, outcomes: ok }],
        [
            'failed verdict → BLOCKED bad verdict',
            { ticket: { id: 'T-6' }, tests: { verdict: 'failed' }, outcomes: ok },
        ],
        [
            'mixed verdict → BLOCKED bad verdict',
            { ticket: { id: 'T-7' }, tests: { verdict: 'mixed' }, outcomes: ok },
        ],
        [
            'tests not a dict → BLOCKED malformed (typename)',
            { ticket: { id: 'T-8' }, tests: ['list not dict'], outcomes: ok },
        ],
        [
            'unknown verdict string → BLOCKED malformed (repr)',
            { ticket: { id: 'T-9' }, tests: { verdict: 'weird' }, outcomes: ok },
        ],
        [
            'missing verdict key (None) → BLOCKED malformed (repr None)',
            { ticket: { id: 'T-10' }, tests: { duration_ms: 5 }, outcomes: ok },
        ],
        ['no ticket id, delegate → "(no id)"', { ticket: {}, outcomes: ok }],
    ];

    it.each(cases)('%s', (_label, state) => {
        expect(runTs(state)).toBe(runPy('test', pyFixture(state)));
    });
});

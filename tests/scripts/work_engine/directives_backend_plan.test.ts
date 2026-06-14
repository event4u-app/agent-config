// Golden-parity tests for work_engine/directives/backend/plan.ts vs plan.py
// (ADR-094 py2ts Phase 1 — backend directive set).
//
// `plan.py` has intra-package imports, so it loads as a real package member
// via `sys.path` + `import work_engine.directives.backend.plan` (the package
// __init__ pulls still-Python siblings, all present until Phase 12). The TS
// twin runs in-process; the Python original via python3 subprocess. Both build
// a `DeliveryState` from the same JSON fixture and emit
// `{outcome, questions, message}` for a byte-exact compare.
//
// Non-determinism: none. Note a deliberate parity carve-out — the
// "unsupported plan type" branch is exercised with a string/list/dict-of-
// non-steps, never a JSON float, because JSON `5.0` decodes to a JS integer
// (`int` typename) but a Python `float` (`float` typename); that single
// `type().__name__` divergence is a JSON-round-trip artifact, not a logic gap.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { AMBIGUITIES, run } from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/plan.js';
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

const ok = { analyze: 'success' };

describe('directives/backend/plan — AMBIGUITIES', () => {
    it('declares the three surfaces in order', () => {
        expect(AMBIGUITIES.map((a) => a.code)).toEqual(['upstream_analyze_failed', 'empty_plan_delegate', 'malformed_plan']);
    });
});

describeParity('directives/backend/plan — golden parity (ts == py)', () => {
    const cases: Array<[string, ConstructorParameters<typeof DeliveryState>[0]]> = [
        ['analyze not success → BLOCKED precondition', { ticket: { id: 'P-1' }, outcomes: {} }],
        ['empty plan (null) → delegate create-plan', { ticket: { id: 'P-2' }, outcomes: ok }],
        ['blank-string plan → delegate (whitespace == empty)', { ticket: { id: 'P-3' }, plan: '   ', outcomes: ok }],
        ['empty list plan → delegate', { ticket: { id: 'P-4' }, plan: [], outcomes: ok }],
        ['empty dict plan → delegate', { ticket: { id: 'P-5' }, plan: {}, outcomes: ok }],
        ['valid string plan → SUCCESS', { ticket: { id: 'P-6' }, plan: 'do the thing', outcomes: ok }],
        ['valid list-of-strings plan → SUCCESS', { ticket: { id: 'P-7' }, plan: ['step one', 'step two'], outcomes: ok }],
        [
            'valid list-of-dicts plan → SUCCESS',
            { ticket: { id: 'P-8' }, plan: [{ title: 'A' }, { step: 'B' }], outcomes: ok },
        ],
        ['valid dict-with-steps → SUCCESS', { ticket: { id: 'P-9' }, plan: { steps: ['x', 'y'] }, outcomes: ok }],
        [
            'malformed list (dict without title) → BLOCKED shape',
            { ticket: { id: 'P-10' }, plan: [{ note: 'no title here' }], outcomes: ok },
        ],
        [
            'malformed list (blank string entry) → BLOCKED shape',
            { ticket: { id: 'P-11' }, plan: ['   '], outcomes: ok },
        ],
        [
            'malformed list (multiple complaints) → BLOCKED shape',
            { ticket: { id: 'P-12' }, plan: [{ note: 'x' }, '   '], outcomes: ok },
        ],
        [
            'dict without steps list → BLOCKED shape',
            { ticket: { id: 'P-13' }, plan: { name: 'no steps' }, outcomes: ok },
        ],
        ['no ticket id, delegate → "(no id)"', { ticket: {}, outcomes: ok }],
    ];

    it.each(cases)('%s', (_label, state) => {
        expect(runTs(state)).toBe(runPy('plan', pyFixture(state)));
    });
});

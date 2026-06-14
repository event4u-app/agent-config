// Golden-parity rig for the py2ts `directives/ui_trivial/test` twin (ADR-094).
//
// Loader pattern (see directives_ui_trivial__skipped.test.ts). Drives `run` on
// both engines and asserts the `{outcome, questions, message}` projection,
// covering the empty-delegate path (with the `run-tests scope=smoke`
// agent-directive), the malformed-dict / bad-verdict diagnostics (including the
// `type(x).__name__`, `{verdict!r}` repr, and the `_ALLOWED_VERDICTS` tuple
// repr), and the failed / mixed verdict halts.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui_trivial/test.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'ui_trivial', 'test.py');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function runPy(body: string, args: string[] = []): SpawnSyncReturns<string> {
    const loader = [
        'import sys, json, importlib.util',
        `_dspec = importlib.util.spec_from_file_location("delivery_state", ${JSON.stringify(DS_PY)})`,
        'delivery_state = importlib.util.module_from_spec(_dspec)',
        'sys.modules["delivery_state"] = delivery_state',
        '_dspec.loader.exec_module(delivery_state)',
        `_src = open(${JSON.stringify(MOD_PY)}, encoding="utf-8").read()`,
        '_src = _src.replace("from ...delivery_state import", "from delivery_state import")',
        'mod = type(sys)("mod")',
        'exec(compile(_src, "mod", "exec"), mod.__dict__)',
    ].join('\n');
    return spawnSync('python3', ['-c', `${loader}\n${body}`, ...args], { encoding: 'utf8' });
}

function pyRun(payloadJson: string): string {
    const body = [
        'payload = json.loads(sys.argv[1])',
        'st = delivery_state.DeliveryState(**payload)',
        'r = mod.run(st)',
        'out = {"outcome": r.outcome.value, "questions": r.questions, "message": r.message}',
        'sys.stdout.write(json.dumps(out, ensure_ascii=False))',
    ].join('\n');
    const r = runPy(body, [payloadJson]);
    if (r.status !== 0) throw new Error(`py run failed: ${r.stderr || r.stdout}`);
    return r.stdout;
}

function tsRun(payload: Record<string, unknown>): string {
    const st = new DeliveryState(payload as never);
    const r = run(st);
    return JSON.stringify({ outcome: r.outcome, questions: r.questions, message: r.message });
}

const PY = hasPython3();
const describePy = PY ? describe : describe.skip;

describePy('directives/ui_trivial/test — golden parity (python3 vs tsx)', () => {
    const fixtures: Array<[string, Record<string, unknown>]> = [
        ['empty tests → delegate', { ticket: {}, tests: null }],
        ['empty dict tests → delegate (falsy)', { ticket: {}, tests: {} }],
        ['tests is a list → malformed (type name)', { ticket: {}, tests: ['x'] }],
        ['unknown verdict (string) → malformed', { ticket: {}, tests: { verdict: 'weird' } }],
        ['verdict missing → malformed (None repr)', { ticket: {}, tests: { scope: 'smoke' } }],
        ['verdict is a number → malformed (repr)', { ticket: {}, tests: { verdict: 7 } }],
        ['success → flows through', { ticket: {}, tests: { verdict: 'success' } }],
        ['failed → blocked halt', { ticket: {}, tests: { verdict: 'failed' } }],
        ['mixed → blocked halt', { ticket: {}, tests: { verdict: 'mixed' } }],
    ];
    for (const [label, payload] of fixtures) {
        it(`byte-identical StepResult — ${label}`, () => {
            expect(JSON.parse(tsRun(payload))).toEqual(JSON.parse(pyRun(JSON.stringify(payload))));
        });
    }
});

describe('directives/ui_trivial/test — TS-side unit checks', () => {
    it('three declared ambiguities', () => {
        expect(AMBIGUITIES).toHaveLength(3);
        expect(AMBIGUITIES.map((a) => a.code)).toEqual([
            'empty_tests_delegate',
            'malformed_tests',
            'bad_test_verdict',
        ]);
    });
});

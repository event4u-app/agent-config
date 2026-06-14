// Golden-parity rig for the py2ts `directives/ui/_passthrough` twin (ADR-094).
//
// Loader pattern: `delivery_state.py` registered as the module
// `delivery_state` before exec (so the `from __future__ import annotations`
// dataclass type resolution finds it), then the handler source loaded with its
// `from ...delivery_state import` rewritten to `from delivery_state import`.
// Each block drives `run(state)` on both engines from the same payload and
// asserts the `{outcome, questions, message}` projection is identical.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/_passthrough.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'ui', '_passthrough.py');

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

describePy('directives/ui/_passthrough — golden parity (python3 vs tsx)', () => {
    const cases: Array<[string, Record<string, unknown>]> = [
        ['empty ticket', { ticket: {} }],
        ['populated state', { ticket: { id: 'T-1' }, memory: [{ note: 'x' }], plan: { a: 1 } }],
    ];
    for (const [label, payload] of cases) {
        it(`byte-identical StepResult — ${label}`, () => {
            expect(JSON.parse(tsRun(payload))).toEqual(JSON.parse(pyRun(JSON.stringify(payload))));
        });
    }
});

describe('directives/ui/_passthrough — TS-side unit checks', () => {
    it('AMBIGUITIES is empty', () => {
        expect(AMBIGUITIES).toHaveLength(0);
    });
    it('run never mutates state', () => {
        const st = new DeliveryState({ ticket: { id: 'X' }, memory: [{ a: 1 }] });
        const before = JSON.stringify(st);
        run(st);
        expect(JSON.stringify(st)).toBe(before);
    });
});

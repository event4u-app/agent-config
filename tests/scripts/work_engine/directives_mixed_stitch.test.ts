// Golden-parity rig for the py2ts `directives/mixed/stitch` twin (ADR-094).
//
// Loader pattern (see directives_ui_trivial__skipped.test.ts). Asserts the
// `{outcome, questions, message}` projection across the implement-precondition
// gate, the empty-stitch delegate (with endpoint count from the contract), the
// malformed-shape diagnostics (`type(x).__name__`, `{verdict!r}`), the
// blocked/partial halt with scenario count, and the integration_confirmed
// override success.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    INTEGRATION_TEST_DIRECTIVE,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/mixed/stitch.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'mixed', 'stitch.py');

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

describePy('directives/mixed/stitch — golden parity (python3 vs tsx)', () => {
    const fixtures: Array<[string, Record<string, unknown>]> = [
        ['implement not success → blocked', { ticket: {}, outcomes: {} }],
        ['empty stitch → delegate (endpoint count)', {
            ticket: { raw: 'wire it up' },
            outcomes: { implement: 'success' },
            contract: { api_surface: [{ path: '/a' }, { path: '/b' }] },
        }],
        ['empty stitch, no contract → delegate (0 endpoints)', {
            ticket: { id: 'T' },
            outcomes: { implement: 'success' },
        }],
        ['stitch not a dict → blocked shape (type name)', {
            ticket: {},
            outcomes: { implement: 'success' },
            stitch: ['nope'],
        }],
        ['bad verdict (repr) → blocked shape', {
            ticket: {},
            outcomes: { implement: 'success' },
            stitch: { verdict: 'maybe' },
        }],
        ['verdict missing → blocked shape (None repr)', {
            ticket: {},
            outcomes: { implement: 'success' },
            stitch: { scenarios: [] },
        }],
        ['success verdict → success', {
            ticket: {},
            outcomes: { implement: 'success' },
            stitch: { verdict: 'success' },
        }],
        ['blocked verdict, not confirmed → halt (scenario count)', {
            ticket: {},
            outcomes: { implement: 'success' },
            stitch: { verdict: 'blocked', scenarios: [{ n: 1 }, { n: 2 }] },
        }],
        ['partial verdict, confirmed → override success', {
            ticket: {},
            outcomes: { implement: 'success' },
            stitch: { verdict: 'partial', integration_confirmed: true },
        }],
        ['partial verdict, confirmed falsy → halt', {
            ticket: {},
            outcomes: { implement: 'success' },
            stitch: { verdict: 'partial', integration_confirmed: 'sure' },
        }],
    ];
    for (const [label, payload] of fixtures) {
        it(`byte-identical StepResult — ${label}`, () => {
            const json = JSON.stringify(payload);
            const py = pyRun(json);
            const ts = tsRun(JSON.parse(json) as Record<string, unknown>);
            expect(JSON.parse(ts)).toEqual(JSON.parse(py));
        });
    }
});

describe('directives/mixed/stitch — TS-side unit checks', () => {
    it('directive name + ambiguities', () => {
        expect(INTEGRATION_TEST_DIRECTIVE).toBe('integration-test');
        expect(AMBIGUITIES).toHaveLength(4);
    });
});

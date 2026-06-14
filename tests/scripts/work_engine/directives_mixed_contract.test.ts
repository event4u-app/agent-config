// Golden-parity rig for the py2ts `directives/mixed/contract` twin (ADR-094).
//
// Loader pattern (see directives_ui_trivial__skipped.test.ts). Drives `run` on
// both engines from the same payload and asserts the `{outcome, questions,
// message}` projection — covering the analyze-precondition gate, the
// first-pass delegate, the incomplete-contract listing (`==[]`/`=={}`/`""`
// empty checks), the unconfirmed-summary halt with counts, and the confirmed
// success. The `_preview_input` truncation / whitespace-collapse is exercised
// via the `raw` / `title` / `id` fallbacks.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    REQUIRED_CONTRACT_KEYS,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/mixed/contract.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'mixed', 'contract.py');

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

const longTitle = 'A'.repeat(120);

describePy('directives/mixed/contract — golden parity (python3 vs tsx)', () => {
    const fixtures: Array<[string, Record<string, unknown>]> = [
        ['analyze not success → blocked', { ticket: { id: 'T' }, outcomes: {} }],
        ['analyze success, no contract → delegate (title preview)', {
            ticket: { title: 'Build dashboard' },
            outcomes: { analyze: 'success' },
        }],
        ['delegate with raw whitespace-collapse preview', {
            ticket: { raw: '  improve   the\n dashboard  ' },
            outcomes: { analyze: 'success' },
        }],
        ['delegate with id fallback', {
            ticket: { id: 'TASK-42' },
            outcomes: { analyze: 'success' },
        }],
        ['delegate no-title fallback', {
            ticket: {},
            outcomes: { analyze: 'success' },
        }],
        ['delegate long-title truncation (… ellipsis)', {
            ticket: { title: longTitle },
            outcomes: { analyze: 'success' },
        }],
        ['incomplete: data_model empty list', {
            ticket: { id: 'T' },
            outcomes: { analyze: 'success' },
            contract: { data_model: [], api_surface: [{ path: '/x' }] },
        }],
        ['incomplete: api_surface missing', {
            ticket: { id: 'T' },
            outcomes: { analyze: 'success' },
            contract: { data_model: [{ entity: 'User' }] },
        }],
        ['incomplete: both empty (empty dict + empty string)', {
            ticket: { id: 'T' },
            outcomes: { analyze: 'success' },
            contract: { data_model: {}, api_surface: '' },
        }],
        ['well-formed, unconfirmed → summary halt', {
            ticket: { id: 'T' },
            outcomes: { analyze: 'success' },
            contract: { data_model: [{ entity: 'User' }, { entity: 'Org' }], api_surface: [{ path: '/u' }] },
        }],
        ['well-formed, confirmed → success', {
            ticket: { id: 'T' },
            outcomes: { analyze: 'success' },
            contract: { data_model: [{ entity: 'User' }], api_surface: [{ path: '/u' }], contract_confirmed: true },
        }],
        ['confirmed flag falsy (not strictly true) → halt', {
            ticket: { id: 'T' },
            outcomes: { analyze: 'success' },
            contract: { data_model: [{ entity: 'User' }], api_surface: [{ path: '/u' }], contract_confirmed: 'yes' },
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

describe('directives/mixed/contract — TS-side unit checks', () => {
    it('required keys + ambiguities', () => {
        expect([...REQUIRED_CONTRACT_KEYS]).toEqual(['data_model', 'api_surface']);
        expect(AMBIGUITIES).toHaveLength(4);
    });
});

// Golden-parity rig for the py2ts `directives/mixed/ui` twin (ADR-094).
//
// Loader pattern (see directives_ui_trivial__skipped.test.ts). Asserts the
// `{outcome, questions, message}` projection across the plan-precondition gate,
// the contract-sentinel defense-in-depth halt, the ui-track delegation (with
// entity / endpoint counts), the review-clean success, and the
// review-unclean escalation halt (with finding count).
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    UI_TRACK_DIRECTIVE,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/mixed/ui.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'mixed', 'ui.py');

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

const confirmed = { data_model: [{ entity: 'User' }], api_surface: [{ path: '/u' }], contract_confirmed: true };

describePy('directives/mixed/ui — golden parity (python3 vs tsx)', () => {
    const fixtures: Array<[string, Record<string, unknown>]> = [
        ['plan not success → blocked', { ticket: {}, outcomes: {} }],
        ['plan success, contract not confirmed → sentinel halt', {
            ticket: {},
            outcomes: { plan: 'success' },
            contract: { data_model: [{ entity: 'User' }], api_surface: [{ path: '/u' }] },
        }],
        ['plan success, no contract dict → sentinel halt', {
            ticket: {},
            outcomes: { plan: 'success' },
        }],
        ['confirmed, ui_review missing → delegate ui-track', {
            ticket: { raw: 'build the screen' },
            outcomes: { plan: 'success' },
            contract: confirmed,
        }],
        ['confirmed, ui_review without review_clean → delegate', {
            ticket: {},
            outcomes: { plan: 'success' },
            contract: confirmed,
            ui_review: { findings: [] },
        }],
        ['confirmed, review_clean true → success', {
            ticket: {},
            outcomes: { plan: 'success' },
            contract: confirmed,
            ui_review: { review_clean: true, findings: [] },
        }],
        ['confirmed, review_clean false → unclean halt (finding count)', {
            ticket: {},
            outcomes: { plan: 'success' },
            contract: confirmed,
            ui_review: { review_clean: false, findings: [{ a: 1 }, { b: 2 }, { c: 3 }] },
        }],
        ['confirmed, review_clean truthy-not-true → unclean halt', {
            ticket: {},
            outcomes: { plan: 'success' },
            contract: confirmed,
            ui_review: { review_clean: 'yes', findings: [] },
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

describe('directives/mixed/ui — TS-side unit checks', () => {
    it('directive name + ambiguities', () => {
        expect(UI_TRACK_DIRECTIVE).toBe('ui-track');
        expect(AMBIGUITIES).toHaveLength(4);
    });
});

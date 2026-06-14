// Golden-parity rig for the py2ts `directives/ui_trivial/report` twin (ADR-094).
//
// Loader pattern (see directives_ui_trivial__skipped.test.ts). `report.run`
// writes `state.report`, so the projection includes both the StepResult and
// the rendered `state.report` string — covering the no-change placeholder, the
// single-file vs multi-file rendering, the smoke-verdict suffix, and the
// `lines_changed` default.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui_trivial/report.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'ui_trivial', 'report.py');

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
        'out = {"outcome": r.outcome.value, "questions": r.questions, "message": r.message, "report": st.report}',
        'sys.stdout.write(json.dumps(out, ensure_ascii=False))',
    ].join('\n');
    const r = runPy(body, [payloadJson]);
    if (r.status !== 0) throw new Error(`py run failed: ${r.stderr || r.stdout}`);
    return r.stdout;
}

function tsRun(payload: Record<string, unknown>): string {
    const st = new DeliveryState(payload as never);
    const r = run(st);
    return JSON.stringify({
        outcome: r.outcome,
        questions: r.questions,
        message: r.message,
        report: st.report,
    });
}

const PY = hasPython3();
const describePy = PY ? describe : describe.skip;

describePy('directives/ui_trivial/report — golden parity (python3 vs tsx)', () => {
    const fixtures: Array<[string, Record<string, unknown>]> = [
        ['no trivial change → placeholder', { ticket: {}, changes: [] }],
        ['non-trivial changes only → placeholder', { ticket: {}, changes: [{ kind: 'ui' }] }],
        ['single file + lines + summary', {
            ticket: {},
            changes: [{ kind: 'ui-trivial', files: ['src/a.tsx'], lines_changed: 3, summary: 'tweak label' }],
            tests: { verdict: 'success' },
        }],
        ['multi file (count rendering)', {
            ticket: {},
            changes: [{ kind: 'ui-trivial', files: ['a.tsx', 'b.tsx'], lines_changed: 4 }],
        }],
        ['missing lines_changed default 0, no summary, no smoke', {
            ticket: {},
            changes: [{ kind: 'ui-trivial', files: ['only.tsx'] }],
        }],
        ['picks the LAST trivial change', {
            ticket: {},
            changes: [
                { kind: 'ui-trivial', files: ['old.tsx'], lines_changed: 1, summary: 'old' },
                { kind: 'ui-trivial', files: ['new.tsx'], lines_changed: 2, summary: 'new' },
            ],
            tests: { verdict: 'mixed' },
        }],
        ['empty files list → 0 files', {
            ticket: {},
            changes: [{ kind: 'ui-trivial', files: [], lines_changed: 0 }],
        }],
    ];
    for (const [label, payload] of fixtures) {
        it(`byte-identical StepResult + report — ${label}`, () => {
            expect(JSON.parse(tsRun(payload))).toEqual(JSON.parse(pyRun(JSON.stringify(payload))));
        });
    }
});

describe('directives/ui_trivial/report — TS-side unit checks', () => {
    it('AMBIGUITIES is empty (pure render)', () => {
        expect(AMBIGUITIES).toHaveLength(0);
    });
});

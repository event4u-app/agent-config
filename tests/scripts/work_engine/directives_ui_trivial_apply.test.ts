// Golden-parity rig for the py2ts `directives/ui_trivial/apply` twin (ADR-094).
//
// Loader pattern (see directives_ui_trivial__skipped.test.ts). `apply.run`
// mutates state (records a change on success; sets `__reclassify_to__` and
// drops `trivial_edit` on the reclassify halt), so the projection includes the
// StepResult AND the mutated `state.ticket` + `state.changes`. Covers the
// first-pass delegate, every precondition violation (`int()` coercion of
// `lines_changed`, file count, component/state/dependency flags), and the
// success record.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    MAX_FILES,
    MAX_LINES_CHANGED,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui_trivial/apply.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'ui_trivial', 'apply.py');

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
        'out = {"outcome": r.outcome.value, "questions": r.questions, "message": r.message, "ticket": st.ticket, "changes": st.changes}',
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
        ticket: st.ticket,
        changes: st.changes,
    });
}

const PY = hasPython3();
const describePy = PY ? describe : describe.skip;

describePy('directives/ui_trivial/apply — golden parity (python3 vs tsx)', () => {
    const fixtures: Array<[string, Record<string, unknown>]> = [
        ['first pass (no envelope) → delegate', { ticket: {} }],
        ['empty envelope dict → delegate', { ticket: { trivial_edit: {} } }],
        ['valid trivial edit → success + record', {
            ticket: { trivial_edit: { files: ['src/a.tsx'], lines_changed: 3, summary: 'tweak' } },
        }],
        ['valid, lines as string "5" (int coercion)', {
            ticket: { trivial_edit: { files: ['a.tsx'], lines_changed: '5' } },
        }],
        ['too many files → reclassify', {
            ticket: { trivial_edit: { files: ['a.tsx', 'b.tsx'], lines_changed: 2 } },
        }],
        ['too many lines → reclassify', {
            ticket: { trivial_edit: { files: ['a.tsx'], lines_changed: 9 } },
        }],
        ['lines missing → reclassify (lines_changed_missing)', {
            ticket: { trivial_edit: { files: ['a.tsx'] } },
        }],
        ['lines is null → reclassify', {
            ticket: { trivial_edit: { files: ['a.tsx'], lines_changed: null } },
        }],
        ['negative lines → reclassify', {
            ticket: { trivial_edit: { files: ['a.tsx'], lines_changed: -1 } },
        }],
        ['new component → reclassify', {
            ticket: { trivial_edit: { files: ['a.tsx'], lines_changed: 1, new_component: true } },
        }],
        ['new state + new dependency → reclassify (both codes)', {
            ticket: { trivial_edit: { files: ['a.tsx'], lines_changed: 1, new_state: true, new_dependency: true } },
        }],
        ['files missing → reclassify (files_missing)', {
            ticket: { trivial_edit: { lines_changed: 1 } },
        }],
        ['lines as float 2.9 (truncates to 2) → success', {
            ticket: { trivial_edit: { files: ['a.tsx'], lines_changed: 2.9 } },
        }],
    ];
    for (const [label, payload] of fixtures) {
        it(`byte-identical StepResult + state — ${label}`, () => {
            // `run` mutates state; snapshot the payload JSON before tsRun so the
            // python side receives the un-mutated input.
            const json = JSON.stringify(payload);
            const py = pyRun(json);
            const ts = tsRun(JSON.parse(json) as Record<string, unknown>);
            expect(JSON.parse(ts)).toEqual(JSON.parse(py));
        });
    }
});

describe('directives/ui_trivial/apply — TS-side unit checks', () => {
    it('ceilings + ambiguities', () => {
        expect(MAX_FILES).toBe(1);
        expect(MAX_LINES_CHANGED).toBe(5);
        expect(AMBIGUITIES).toHaveLength(2);
    });
});

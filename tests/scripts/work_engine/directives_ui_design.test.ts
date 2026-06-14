// Golden-parity rig for the py2ts `directives/ui/design` twin (ADR-094).
//
// Loader pattern (see directives_ui_trivial__skipped.test.ts). Asserts the
// `{outcome, questions, message}` projection across the first-pass delegate,
// the incomplete-brief listing (required keys + per-state sub-keys), the
// placeholder-microcopy rejection (recursive walk, dotted paths), the
// unconfirmed-summary halt (component / state / recursive microcopy counts),
// and the confirmed success.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    PLACEHOLDER_PATTERNS,
    REQUIRED_BRIEF_KEYS,
    REQUIRED_STATE_KEYS,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/design.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'ui', 'design.py');

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

const fullStates = { empty: 'No items', loading: 'Loading…', error: 'Failed', success: 'Done', disabled: 'Off' };
const fullBrief = {
    layout: 'grid',
    components: [{ name: 'Card' }],
    states: fullStates,
    microcopy: { buttons: { submit: 'Save', cancel: 'Cancel' }, empty: 'Nothing here' },
    a11y: { contrast: 'AA' },
};

describePy('directives/ui/design — golden parity (python3 vs tsx)', () => {
    const fixtures: Array<[string, Record<string, unknown>]> = [
        ['no design → delegate', { ticket: { title: 'Make a form' } }],
        ['empty dict design → delegate', { ticket: {}, ui_design: {} }],
        ['missing layout + components → incomplete', {
            ticket: {},
            ui_design: { states: fullStates, microcopy: { ok: 'Yes' }, a11y: { x: 1 } },
        }],
        ['states present but missing sub-keys → incomplete list', {
            ticket: {},
            ui_design: {
                layout: 'grid',
                components: [{ name: 'C' }],
                states: { empty: 'x', loading: 'y' },
                microcopy: { ok: 'Yes' },
                a11y: { x: 1 },
            },
        }],
        ['placeholder microcopy (recursive, dotted path)', {
            ticket: {},
            ui_design: {
                ...fullBrief,
                microcopy: { buttons: { submit: 'TODO: finalize' }, empty: 'Lorem ipsum' },
            },
        }],
        ['well-formed, unconfirmed → summary halt', {
            ticket: { raw: 'design the card' },
            ui_design: fullBrief,
        }],
        ['confirmed → success', {
            ticket: {},
            ui_design: { ...fullBrief, design_confirmed: true },
        }],
        ['empty-string layout treated as missing', {
            ticket: {},
            ui_design: { ...fullBrief, layout: '' },
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

describe('directives/ui/design — TS-side unit checks', () => {
    it('constants + ambiguities', () => {
        expect([...REQUIRED_BRIEF_KEYS]).toEqual(['layout', 'components', 'states', 'microcopy', 'a11y']);
        expect([...REQUIRED_STATE_KEYS]).toEqual(['empty', 'loading', 'error', 'success', 'disabled']);
        expect([...PLACEHOLDER_PATTERNS]).toEqual(['<placeholder>', 'lorem', 'todo:', 'tbd', 'xxx']);
        expect(AMBIGUITIES).toHaveLength(3);
    });
});

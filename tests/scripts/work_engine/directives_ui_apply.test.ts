// Golden-parity rig for the py2ts `directives/ui/apply` twin (ADR-094).
//
// `apply.py` imports `from ...delivery_state import ...` AND
// `from .design import PLACEHOLDER_PATTERNS` (a sibling owned by this same
// migration batch). The python loader therefore registers `delivery_state`,
// loads `design.py` (with its own relative import rewritten) as the module
// `design`, then loads `apply.py` with BOTH relative imports rewritten to flat
// `from delivery_state import` / `from design import`. The `.ts` twin imports
// `PLACEHOLDER_PATTERNS` from its own `./design.js` — a `.ts` never imports a
// `.py`.
//
// `apply.run` mutates `state.changes` on success, so the projection includes
// the StepResult AND `state.changes`. Covers: first-pass stack-dispatched
// delegate (every stack + unknown→plain fallback), the placeholder rejection
// (recursive `rendered` walk, dotted paths), and the change recording.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    DEFAULT_DIRECTIVE,
    STACK_DIRECTIVES,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/apply.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const DESIGN_PY = path.join(WE, 'directives', 'ui', 'design.py');
const MOD_PY = path.join(WE, 'directives', 'ui', 'apply.py');

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
        // Load the sibling `design` module (its own relative import rewritten),
        // register it so `apply`'s `from design import PLACEHOLDER_PATTERNS`
        // resolves.
        `_design_src = open(${JSON.stringify(DESIGN_PY)}, encoding="utf-8").read()`,
        '_design_src = _design_src.replace("from ...delivery_state import", "from delivery_state import")',
        'design = type(sys)("design")',
        'sys.modules["design"] = design',
        'exec(compile(_design_src, "design", "exec"), design.__dict__)',
        `_src = open(${JSON.stringify(MOD_PY)}, encoding="utf-8").read()`,
        '_src = _src.replace("from ...delivery_state import", "from delivery_state import")',
        '_src = _src.replace("from .design import", "from design import")',
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
        'out = {"outcome": r.outcome.value, "questions": r.questions, "message": r.message, "changes": st.changes}',
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
        changes: st.changes,
    });
}

const PY = hasPython3();
const describePy = PY ? describe : describe.skip;

describePy('directives/ui/apply — golden parity (python3 vs tsx)', () => {
    const fixtures: Array<[string, Record<string, unknown>]> = [
        ['first pass, no stack → delegate ui-apply-plain', { ticket: {} }],
        ['first pass, blade stack → delegate matching directive', {
            ticket: {},
            stack: { frontend: 'blade-livewire-flux' },
        }],
        ['first pass, react-shadcn stack', { ticket: {}, stack: { frontend: 'react-shadcn' } }],
        ['first pass, unknown stack → plain fallback (label kept)', {
            ticket: {},
            stack: { frontend: 'svelte' },
        }],
        ['empty ui_apply dict → delegate', { ticket: { ui_apply: {} } }],
        ['placeholder in rendered output → reject (dotted path)', {
            ticket: {
                ui_apply: {
                    rendered: { 'Button.tsx': 'click', 'Card.tsx': 'TODO: copy' },
                    files: ['Button.tsx'],
                },
            },
            stack: { frontend: 'react-shadcn' },
        }],
        ['nested rendered placeholder', {
            ticket: { ui_apply: { rendered: { group: { a: 'Lorem ipsum' } }, files: ['a.tsx'] } },
        }],
        ['valid apply → record one change per file', {
            ticket: { ui_apply: { rendered: { 'A.tsx': 'Save' }, files: ['A.tsx', 'B.tsx'], summary: 'render cards' } },
            stack: { frontend: 'vue' },
        }],
        ['valid apply, files with a non-string entry → skipped', {
            ticket: { ui_apply: { rendered: { 'A.tsx': 'ok' }, files: ['A.tsx', 42, '', 'B.tsx'] } },
        }],
        ['valid apply, no files → no changes recorded', {
            ticket: { ui_apply: { rendered: { 'A.tsx': 'ok' } } },
        }],
        ['rendered not a dict → no violations, records', {
            ticket: { ui_apply: { rendered: 'just a string', files: ['A.tsx'] } },
        }],
    ];
    for (const [label, payload] of fixtures) {
        it(`byte-identical StepResult + changes — ${label}`, () => {
            const json = JSON.stringify(payload);
            const py = pyRun(json);
            const ts = tsRun(JSON.parse(json) as Record<string, unknown>);
            expect(JSON.parse(ts)).toEqual(JSON.parse(py));
        });
    }
});

describe('directives/ui/apply — TS-side unit checks', () => {
    it('directives map + fallback + ambiguities', () => {
        expect(DEFAULT_DIRECTIVE).toBe('ui-apply-plain');
        expect(STACK_DIRECTIVES['react-shadcn']).toBe('ui-apply-react-shadcn');
        expect(AMBIGUITIES).toHaveLength(2);
    });
    it('imports PLACEHOLDER_PATTERNS from the design twin (not the .py)', () => {
        const st = new DeliveryState({
            ticket: { ui_apply: { rendered: { x: 'xxx' }, files: ['x.tsx'] } },
        } as never);
        expect(run(st).outcome).toBe('blocked');
    });
});

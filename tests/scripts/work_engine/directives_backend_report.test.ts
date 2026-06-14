// Golden-parity tests for work_engine/directives/backend/report.ts vs
// report.py (ADR-094 py2ts Phase 1 — backend directive set).
//
// `report.py` imports `...delivery_state` + `...persona_policy`, so it loads as
// a real package member via `sys.path` + import. The renderer is pure — it
// reads DeliveryState and writes `state.report`. Both engines build the same
// DeliveryState fixture, run, and emit the rendered `state.report` string
// (raw, not JSON-wrapped) for a byte-exact compare. Coverage: every section's
// populated + empty body, the memory-that-mattered drop rule, the visual-
// preview gating, follow-up aggregation order, kv-block rendering, and the
// advisory persona's suppressed next-commands section. No non-determinism.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { AMBIGUITIES, run } from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/report.js';
import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SCRIPTS_ROOT = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/** Python driver: run report.run, emit the raw rendered `state.report`. */
function runPy(stateJson: string): string {
    const code = [
        'import sys, json, importlib',
        `sys.path.insert(0, ${JSON.stringify(SCRIPTS_ROOT)})`,
        'mod = importlib.import_module("work_engine.directives.backend.report")',
        'from work_engine.delivery_state import DeliveryState',
        'payload = json.loads(sys.argv[1])',
        'st = DeliveryState(**payload)',
        'mod.run(st)',
        'sys.stdout.write(st.report)',
    ].join('\n');
    const r = spawnSync('python3', ['-c', code, stateJson], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout;
}

function runTs(state: ConstructorParameters<typeof DeliveryState>[0]): string {
    const st = new DeliveryState(state);
    run(st);
    return st.report;
}

function pyFixture(state: ConstructorParameters<typeof DeliveryState>[0]): string {
    return JSON.stringify(state);
}

const py = hasPython3();
const describeParity = py ? describe : describe.skip;

describe('directives/backend/report — AMBIGUITIES', () => {
    it('declares no surfaces (pure renderer)', () => {
        expect(AMBIGUITIES).toEqual([]);
    });
});

describeParity('directives/backend/report — golden parity (ts == py)', () => {
    const cases: Array<[string, ConstructorParameters<typeof DeliveryState>[0]]> = [
        ['minimal state (all empties / placeholders)', { ticket: {} }],
        [
            'fully populated, verify success → both next-commands',
            {
                ticket: { id: 'R-1', title: 'Build the thing' },
                persona: 'senior-engineer',
                plan: [{ title: 'Step A', detail: 'do A' }, 'plain step'],
                changes: [{ path: 'a.ts', lines: 'L1-L9', purpose: 'add' }, { file: 'b.ts' }],
                tests: { verdict: 'success', targeted: 12 },
                verify: { verdict: 'success', confidence: 'high' },
                outcomes: { verify: 'success' },
            },
        ],
        [
            'string plan body',
            { ticket: { id: 'R-2', title: 'T' }, plan: '  do this thing  ' },
        ],
        [
            'memory that mattered drops non-influential hits',
            {
                ticket: { id: 'R-3' },
                memory: [
                    { id: 'm1', type: 'domain-invariants', changed_outcome: true, note: 'mattered' },
                    { id: 'm2', type: 'historical-patterns' },
                ],
            },
        ],
        [
            'memory all non-influential → section dropped',
            { ticket: { id: 'R-4' }, memory: [{ id: 'm1', type: 'x' }] },
        ],
        [
            'visual preview rendered (render_ok + paths)',
            {
                ticket: { id: 'R-5' },
                ui_review: { preview: { render_ok: true, screenshot_path: 'shot.png', dom_dump_path: 'dom.html' } },
            },
        ],
        [
            'visual preview skipped (render_ok false) → dropped',
            { ticket: { id: 'R-6' }, ui_review: { preview: { render_ok: false, screenshot_path: 'x.png' } } },
        ],
        [
            'visual preview render_ok but no paths → dropped',
            { ticket: { id: 'R-7' }, ui_review: { preview: { render_ok: true } } },
        ],
        [
            'follow-ups aggregated from plan/verify/tests in order',
            {
                ticket: { id: 'R-8' },
                plan: { steps: ['x'], followups: [{ note: 'plan fup', anchor: 'P#1' }] },
                verify: { verdict: 'success', followups: [{ title: 'verify fup' }] },
                tests: { verdict: 'success', followups: [{ note: 'test fup' }] },
            },
        ],
        [
            'advisory persona suppresses next-commands',
            { ticket: { id: 'R-9' }, persona: 'advisory', outcomes: { verify: 'success' } },
        ],
        [
            'verify not success → only /commit suggested',
            { ticket: { id: 'R-10' }, outcomes: {} },
        ],
        [
            'tests as a plain string (kv-block string branch)',
            { ticket: { id: 'R-11' }, tests: '  all good  ' },
        ],
    ];

    it.each(cases)('%s', (_label, state) => {
        expect(runTs(state)).toBe(runPy(pyFixture(state)));
    });
});

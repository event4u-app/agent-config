// Golden-parity tests for work_engine/directives/backend/refine.ts vs
// refine.py (ADR-094 py2ts Phase 1 — backend directive set).
//
// `refine.py` imports `...delivery_state` + `...scoring.confidence`, so the
// direct-file importlib loader used by state.test.ts does NOT work here.
// Instead we add `src/agent-src/templates/scripts` to `sys.path` and
// `import work_engine.directives.backend.refine` as a real package member —
// the package `__init__` imports its (still-Python) siblings, which all exist
// in source until the Phase-12 sweep. The TS twin is exercised in-process; the
// Python original via a python3 subprocess.
//
// The gate routes on envelope shape (ticket path vs prompt path) and mutates
// `state.ticket` on the prompt path (`confidence`, `acceptance_criteria`). Both
// engines build a `DeliveryState` from the same JSON fixture, run, and emit
// `{outcome, questions, message, ticket}` as
// `json.dumps(..., indent=2, ensure_ascii=False)` for a byte-exact compare.
// Coverage: ticket-path SUCCESS + every deficiency permutation, the headnote
// id fallback, the prompt-path delegate (no AC) directive, and the high /
// medium / medium-confirmed / low / ui-intent confidence bands incl. the
// confidence projection. No non-determinism.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { AMBIGUITIES, run } from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/refine.js';
import { DeliveryState, type StepResult } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SCRIPTS_ROOT = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/**
 * Drive `work_engine.directives.backend.refine.run` on python3 from a JSON
 * state fixture; emit `{outcome, questions, message, ticket}` as canonical
 * JSON. `ticket` is included because the prompt path mutates it in place
 * (confidence breakdown + acceptance_criteria projection).
 */
function runPy(stateJson: string): string {
    const code = [
        'import sys, json',
        `sys.path.insert(0, ${JSON.stringify(SCRIPTS_ROOT)})`,
        'import importlib',
        'mod = importlib.import_module("work_engine.directives.backend.refine")',
        'from work_engine.delivery_state import DeliveryState',
        'payload = json.loads(sys.argv[1])',
        'st = DeliveryState(**payload)',
        'r = mod.run(st)',
        'out = {"outcome": r.outcome.value, "questions": r.questions, "message": r.message, "ticket": st.ticket}',
        'sys.stdout.write(json.dumps(out, indent=2, ensure_ascii=False))',
    ].join('\n');
    const r = spawnSync('python3', ['-c', code, stateJson], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout;
}

/** TS twin: build DeliveryState from the fixture, run, emit canonical JSON. */
function runTs(state: ConstructorParameters<typeof DeliveryState>[0]): string {
    const st = new DeliveryState(state);
    const r: StepResult = run(st);
    return JSON.stringify(
        { outcome: r.outcome, questions: r.questions, message: r.message, ticket: st.ticket },
        null,
        2,
    );
}

/** Build the matching python fixture JSON from the same constructor args. */
function pyFixture(state: ConstructorParameters<typeof DeliveryState>[0]): string {
    return JSON.stringify(state);
}

const py = hasPython3();
const describeParity = py ? describe : describe.skip;

describe('directives/backend/refine — AMBIGUITIES', () => {
    it('declares the seven surfaces in order', () => {
        expect(AMBIGUITIES.map((a) => a.code)).toEqual([
            'missing_id',
            'trivial_title',
            'missing_or_vague_ac',
            'prompt_unrefined',
            'prompt_medium_confidence',
            'prompt_low_confidence',
            'prompt_ui_intent',
        ]);
    });

    it('renders the configurable length floors into trigger text', () => {
        const trivialTitle = AMBIGUITIES.find((a) => a.code === 'trivial_title');
        const vagueAc = AMBIGUITIES.find((a) => a.code === 'missing_or_vague_ac');
        expect(trivialTitle?.trigger).toContain('3 chars');
        expect(vagueAc?.trigger).toContain('10 chars');
    });
});

describeParity('directives/backend/refine — golden parity (ts == py)', () => {
    const cases: Array<[string, ConstructorParameters<typeof DeliveryState>[0]]> = [
        // --- ticket path ---------------------------------------------------
        [
            'well-formed ticket → SUCCESS',
            {
                ticket: {
                    id: 'T-1',
                    title: 'Build the widget',
                    acceptance_criteria: ['the user must see the widget on load'],
                },
            },
        ],
        [
            'empty ticket → all three deficiencies, "(no id)" headnote',
            { ticket: {} },
        ],
        [
            'missing id only → single deficiency',
            { ticket: { title: 'A solid title', acceptance_criteria: ['the user must see the widget on load'] } },
        ],
        [
            'trivial title (under floor) → BLOCKED',
            { ticket: { id: 'T-2', title: 'ab', acceptance_criteria: ['the user must see the widget on load'] } },
        ],
        [
            'whitespace-only id falls back to "(no id)" in headnote',
            { ticket: { id: '   ', title: 'A solid title', acceptance_criteria: ['the user must see the widget'] } },
        ],
        [
            'acceptance_criteria not a list → "no acceptance criteria"',
            { ticket: { id: 'T-3', title: 'A solid title', acceptance_criteria: 'a string' } },
        ],
        [
            'empty acceptance_criteria list → "no acceptance criteria"',
            { ticket: { id: 'T-4', title: 'A solid title', acceptance_criteria: [] } },
        ],
        [
            'vague AC items (under floor + non-string) → position list',
            {
                ticket: {
                    id: 'T-5',
                    title: 'A solid title',
                    acceptance_criteria: ['short', 'the user must see the widget on load', 42],
                },
            },
        ],
        [
            'all three deficiencies with a real id',
            { ticket: { id: 'T-6', title: 'x', acceptance_criteria: [] } },
        ],
        // --- prompt path: delegate (no reconstructed AC) -------------------
        [
            'prompt envelope, no AC → delegate directive',
            { ticket: { raw: 'add a rate limiter to the login endpoint behind a config flag' } },
        ],
        [
            'prompt envelope, AC not a list → delegate directive',
            { ticket: { raw: 'add a rate limiter', reconstructed_ac: 'not a list' } },
        ],
        [
            'prompt envelope, long raw → preview is truncated with ellipsis',
            {
                ticket: {
                    raw:
                        'add a comprehensive distributed rate limiter to the authentication login endpoint ' +
                        'with redis backing and per-tenant buckets and graceful degradation behaviour',
                },
            },
        ],
        // --- prompt path: high band → SUCCESS + confidence projection ------
        [
            // Score lands at 0.9 (reversibility=1 via the "config flag" surface),
            // not an integer-valued 1.0, so the projected `score` float renders
            // byte-identically through both engines' json.dumps.
            'prompt high band → SUCCESS, confidence + AC projected onto ticket',
            {
                ticket: {
                    raw: 'add a rate limiter to the login endpoint in `auth/limiter.py` behind a config flag',
                    reconstructed_ac: [
                        'given a burst of requests, the endpoint must reject over the cap',
                        'when under the cap, requests should pass through unchanged',
                        'then the limiter must expose a per-tenant counter',
                    ],
                    assumptions: ['default cap is 100 req/min'],
                },
            },
        ],
        // --- prompt path: medium band → PARTIAL halt ----------------------
        [
            'prompt medium band → PARTIAL assumptions halt',
            {
                ticket: {
                    raw: 'improve the checkout flow',
                    reconstructed_ac: ['the user should reach payment faster'],
                    assumptions: ['fewer steps is the goal', 'no new payment provider'],
                },
            },
        ],
        [
            'prompt medium band, confidence_confirmed → SUCCESS',
            {
                ticket: {
                    raw: 'improve the checkout flow',
                    reconstructed_ac: ['the user should reach payment faster'],
                    assumptions: ['fewer steps is the goal'],
                    confidence_confirmed: true,
                },
            },
        ],
        [
            'prompt medium band, no assumptions → "(none recorded)" line',
            {
                ticket: {
                    raw: 'improve the checkout flow',
                    reconstructed_ac: ['the user should reach payment faster'],
                },
            },
        ],
        // --- prompt path: low band → BLOCKED single targeted question -----
        [
            'prompt low band → BLOCKED, weakest-dimension question',
            {
                ticket: {
                    raw: 'do the thing?',
                    reconstructed_ac: ['x'],
                },
            },
        ],
        // --- prompt path: ui-intent → BLOCKED regardless of band ----------
        [
            'prompt ui-intent → BLOCKED pending R3 (even with strong AC)',
            {
                ticket: {
                    raw: 'redesign the dashboard layout with new tailwind colors and spacing',
                    reconstructed_ac: [
                        'given the dashboard, the new theme must apply on load',
                        'when toggled, dark mode should persist across reloads',
                        'then the spacing must match the design tokens',
                    ],
                },
            },
        ],
    ];

    it.each(cases)('%s', (_label, state) => {
        const tsOut = runTs(state);
        const pyOut = runPy(pyFixture(state));
        expect(tsOut).toBe(pyOut);
    });
});

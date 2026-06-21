// End-to-end integration of the eight-step BACKEND dispatcher (pure TS).
//
// Behavioural twin of tests/work_engine/test_integration_full_flow.py — the
// Python suite is the spec. It drives the full Option-A resume loop with the
// real backend step handlers and a scripted fake orchestrator that, on each
// BLOCKED with an `@agent-directive:` marker, applies the deterministic slice a
// real agent would produce, marks the step success, and re-invokes `dispatch`.
//
// No python, no oracle, no snapshot: we import the TS twins, drive `dispatch`,
// and assert the convergence sequence, the cross-loop memory keep/drop rule in
// the report, the skip-already-successful resume contract, and the failed-test
// halt. The `memory_lookup.retrieve` lazy seam is swapped via `_setRetrieve`
// (the TS mirror of the Python `fake_memory_lookup` monkeypatch fixture).
import { afterEach, describe, expect, it } from 'vitest';

import {
    AGENT_DIRECTIVE_PREFIX,
    DeliveryState,
    Outcome,
    is_agent_directive,
} from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    STEP_ORDER,
    dispatch,
} from '../../../src/agent-src/templates/scripts/work_engine/dispatcher.js';
import {
    get_steps,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/index.js';
import {
    _setRetrieve,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/memory.js';

const REAL_STEPS = get_steps();

// `void AGENT_DIRECTIVE_PREFIX` — imported to mirror the Python spec's import
// surface; used indirectly via `is_agent_directive`.
void AGENT_DIRECTIVE_PREFIX;

type Hit = Record<string, unknown>;

/**
 * Install the influential-hit fake: a single `changed_outcome=True` hit, like
 * the Python `fake_memory_lookup` fixture. Mirrors the lazy-import monkeypatch.
 */
function installInfluentialMemory(): void {
    _setRetrieve(
        (): Hit[] => [
            {
                id: 'dec-option-a',
                type: 'architecture-decisions',
                note: 'Option A delegation chosen for implement/test/verify',
                changed_outcome: true,
            },
        ],
    );
}

afterEach(() => {
    _setRetrieve(null);
});

function extractDirectiveVerb(questions: string[]): string {
    expect(questions.length).toBeGreaterThan(0);
    expect(is_agent_directive(questions[0])).toBe(true);
    // Shape: "@agent-directive: <verb> key=value key=value"
    const payload = (questions[0] as string).split(':').slice(1).join(':').trim();
    return payload.split(' ', 1)[0] as string;
}

/** Apply the deterministic slice a real agent would produce for `verb`. */
function resumeAsAgent(state: DeliveryState, verb: string): void {
    if (verb === 'create-plan') {
        state.plan = [
            { title: 'Add export endpoint', detail: 'GET /api/exports' },
            { title: 'Wire frontend download button' },
        ];
        state.outcomes['plan'] = Outcome.SUCCESS;
    } else if (verb === 'apply-plan') {
        state.changes = [
            { path: 'app/Http/Controllers/Export.php', purpose: 'new endpoint' },
            { path: 'resources/views/exports.blade.php', purpose: 'download button' },
        ];
        state.outcomes['implement'] = Outcome.SUCCESS;
    } else if (verb === 'run-tests') {
        state.tests = { verdict: 'success', targeted: 'all green', duration_ms: 1420 };
        state.outcomes['test'] = Outcome.SUCCESS;
    } else if (verb === 'review-changes') {
        state.verify = { verdict: 'success', confidence: 'high', findings: [] };
        state.outcomes['verify'] = Outcome.SUCCESS;
    } else {
        throw new Error(`unknown directive verb: ${verb}`);
    }
}

/** Run dispatch+resume until SUCCESS, returning the verbs seen in order. */
function driveLoop(state: DeliveryState, maxIterations = 10): string[] {
    const seen: string[] = [];
    for (let i = 0; i < maxIterations; i++) {
        const [final, halting] = dispatch(state, REAL_STEPS);
        if (final === Outcome.SUCCESS) {
            return seen;
        }
        expect(final, `unexpected halt at ${halting}: outcome=${final}`).toBe(Outcome.BLOCKED);
        const verb = extractDirectiveVerb(state.questions);
        seen.push(verb);
        resumeAsAgent(state, verb);
    }
    throw new Error('dispatch did not converge within max_iterations');
}

function wellFormedTicket(): Record<string, unknown> {
    return {
        id: 'TICKET-42',
        title: 'Add export button',
        acceptance_criteria: [
            'Users can trigger a CSV export from the dashboard within two clicks.',
            'The exported file includes every visible column.',
        ],
    };
}

describe('full backend flow — four-rebound convergence', () => {
    it('converges with the create-plan → apply-plan → run-tests → review-changes chain', () => {
        installInfluentialMemory();
        const state = new DeliveryState({ ticket: wellFormedTicket() });

        const verbs = driveLoop(state);

        expect(verbs).toEqual(['create-plan', 'apply-plan', 'run-tests', 'review-changes']);
        for (const name of STEP_ORDER) {
            expect(state.outcomes[name], JSON.stringify(state.outcomes)).toBe(Outcome.SUCCESS);
        }
    });

    it('produces a delivery report ending the run (Markdown header + ticket id)', () => {
        installInfluentialMemory();
        const state = new DeliveryState({ ticket: wellFormedTicket() });

        driveLoop(state);

        expect(typeof state.report).toBe('string');
        expect(state.report.trim().startsWith('#')).toBe(true);
        expect(state.report).toContain('TICKET-42');
    });

    it('keeps the memory section when a hit changed the outcome', () => {
        installInfluentialMemory();
        const state = new DeliveryState({ ticket: wellFormedTicket() });

        driveLoop(state);

        expect(state.report).toContain('Memory that mattered');
        expect(state.report).toContain('dec-option-a');
    });

    it('drops the memory section when no hit changed the outcome', () => {
        _setRetrieve(
            (): Hit[] => [
                {
                    id: 'dec-irrelevant',
                    type: 'historical-patterns',
                    note: 'not applied',
                    changed_outcome: false,
                },
            ],
        );
        const state = new DeliveryState({ ticket: wellFormedTicket() });

        driveLoop(state);

        expect(state.report).not.toContain('Memory that mattered');
    });

    it('skips already-successful steps on resume', () => {
        installInfluentialMemory();
        const state = new DeliveryState({ ticket: wellFormedTicket() });
        state.outcomes['refine'] = Outcome.SUCCESS;
        state.outcomes['memory'] = Outcome.SUCCESS;
        state.memory = [];

        const verbs = driveLoop(state);

        expect(verbs).toEqual(['create-plan', 'apply-plan', 'run-tests', 'review-changes']);
    });

    it('halts BLOCKED at test when the test verdict is failed', () => {
        installInfluentialMemory();
        const state = new DeliveryState({ ticket: wellFormedTicket() });

        // Resume through plan + implement, then populate a failed verdict.
        for (const expectedVerb of ['create-plan', 'apply-plan']) {
            const [final] = dispatch(state, REAL_STEPS);
            expect(final).toBe(Outcome.BLOCKED);
            expect(extractDirectiveVerb(state.questions)).toBe(expectedVerb);
            resumeAsAgent(state, expectedVerb);
        }

        let [final] = dispatch(state, REAL_STEPS);
        expect(final).toBe(Outcome.BLOCKED);
        expect(extractDirectiveVerb(state.questions)).toBe('run-tests');
        // Agent ran the tests, captured the verdict, re-dispatches. It does NOT
        // forge outcomes.test = success — the gate decides that on the rebound.
        state.tests = { verdict: 'failed', targeted: '3 failures in ExportTest' };

        let halting: string | null;
        [final, halting] = dispatch(state, REAL_STEPS);
        expect(final).toBe(Outcome.BLOCKED);
        expect(halting).toBe('test');
        expect(state.outcomes['test']).toBe(Outcome.BLOCKED);
        expect(state.outcomes['verify']).toBeUndefined();
        expect(state.outcomes['report']).toBeUndefined();
    });
});

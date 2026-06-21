// End-to-end integration of the MIXED (backend + UI) directive set (pure TS).
//
// Behavioural twin of tests/work_engine/test_integration_mixed_flow.py — the
// Python suite is the spec. Two mixed fixtures are driven through the eight-step
// dispatcher with a fake orchestrator that resumes the three mixed-specific
// directives (`contract-plan`, `ui-track`, `integration-test`), the
// backend-shared `review-changes`, and the user-confirmation halt (no directive)
// between contract draft and UI delegation.
//
// Fixture A — form + endpoint: SavedSearch persistence (POST + GET).
// Fixture B — table + list endpoint with filtering: order list with filters.
//
// No python, no oracle: import the TS twins, drive `dispatch(state, mixed
// get_steps())`, assert the five-rebound chain, the contract-locked-before-UI
// ordering, and the recorded smoke scenarios. `memory_lookup.retrieve` is
// stubbed empty via `_setRetrieve` (the TS mirror of `fake_memory_lookup`).
import { afterEach, describe, expect, it } from 'vitest';

import {
    DeliveryState,
    Outcome,
    is_agent_directive,
} from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    STEP_ORDER,
    dispatch,
} from '../../../src/agent-src/templates/scripts/work_engine/dispatcher.js';
import {
    get_steps as mixedSteps,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/mixed/index.js';
import {
    _setRetrieve,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/memory.js';

const MIXED_STEPS = mixedSteps();

afterEach(() => {
    _setRetrieve(null);
});

/** Stub `memory_lookup.retrieve` empty so the memory step is deterministic. */
function installEmptyMemory(): void {
    _setRetrieve(() => []);
}

/** Return the directive verb, or `null` if the halt is user-facing. */
function extractDirectiveVerb(questions: string[]): string | null {
    if (questions.length === 0 || !is_agent_directive(questions[0])) {
        return null;
    }
    const payload = (questions[0] as string).split(':').slice(1).join(':').trim();
    return payload.split(' ', 1)[0] as string;
}

/**
 * Apply the slice a real orchestrator would produce; returns a label so the
 * caller can record the rebound sequence. The user-confirmation halt (no
 * directive) is encoded as `"confirm-contract"`.
 */
function resumeAsAgent(
    state: DeliveryState,
    verb: string | null,
    contract: Record<string, unknown>,
): string {
    if (verb === null) {
        // Contract draft is in place, awaiting user confirmation.
        expect(state.contract).not.toBeNull();
        (state.contract as Record<string, unknown>)['contract_confirmed'] = true;
        return 'confirm-contract';
    }
    if (verb === 'contract-plan') {
        state.contract = { ...contract };
        return verb;
    }
    if (verb === 'ui-track') {
        state.ui_review = { review_clean: true, findings: [] };
        state.outcomes['implement'] = Outcome.SUCCESS;
        return verb;
    }
    if (verb === 'integration-test') {
        state.stitch = {
            verdict: 'success',
            scenarios: [{ id: 'S-1' }, { id: 'S-2' }],
        };
        state.outcomes['test'] = Outcome.SUCCESS;
        return verb;
    }
    if (verb === 'review-changes') {
        state.verify = { verdict: 'success', confidence: 'high', findings: [] };
        state.outcomes['verify'] = Outcome.SUCCESS;
        return verb;
    }
    throw new Error(`unknown directive verb: ${verb}`);
}

/** Run dispatch + resume until SUCCESS, returning the rebound labels. */
function driveMixedLoop(
    state: DeliveryState,
    contract: Record<string, unknown>,
    maxIterations = 12,
): string[] {
    const seen: string[] = [];
    for (let i = 0; i < maxIterations; i++) {
        const [final, halting] = dispatch(state, MIXED_STEPS);
        if (final === Outcome.SUCCESS) {
            return seen;
        }
        expect(final, `unexpected halt at ${halting}: outcome=${final}`).toBe(Outcome.BLOCKED);
        const verb = extractDirectiveVerb(state.questions);
        seen.push(resumeAsAgent(state, verb, contract));
    }
    throw new Error('mixed dispatch did not converge within max_iterations');
}

// --- Fixture A: form + endpoint --------------------------------------------

function formEndpointTicket(): Record<string, unknown> {
    return {
        id: 'MIX-A-1',
        title: 'Saved-search form + persistence endpoint',
        acceptance_criteria: [
            'Users can save a named search from the search-results screen.',
            'POST /saved-searches persists name + query JSON; GET returns them.',
            'Form validates name (required, <=80 chars) and query (non-empty JSON).',
        ],
    };
}

function formEndpointContract(): Record<string, unknown> {
    return {
        data_model: [{ name: 'SavedSearch', fields: ['id', 'name', 'query', 'owner_id'] }],
        api_surface: [
            { method: 'POST', path: '/saved-searches' },
            { method: 'GET', path: '/saved-searches' },
        ],
    };
}

// --- Fixture B: table + list endpoint with filtering -----------------------

function tableFilterTicket(): Record<string, unknown> {
    return {
        id: 'MIX-B-1',
        title: 'Order list table with status + date-range filters',
        acceptance_criteria: [
            'Operators see a paginated table of orders with status, customer, total, created_at columns.',
            'GET /orders accepts `status` (enum) and `created_from` / `created_to` (ISO date) query params; returns paginated JSON.',
            'Empty filter result shows the empty-state message; applied filters survive page navigation.',
        ],
    };
}

function tableFilterContract(): Record<string, unknown> {
    return {
        data_model: [
            { name: 'Order', fields: ['id', 'status', 'customer_id', 'total', 'created_at'] },
        ],
        api_surface: [
            {
                method: 'GET',
                path: '/orders',
                query: ['status', 'created_from', 'created_to', 'page'],
                response: 'paginated list of Order',
            },
        ],
    };
}

const FIVE_REBOUND_CHAIN = [
    'contract-plan',
    'confirm-contract',
    'ui-track',
    'integration-test',
    'review-changes',
];

describe('mixed flow — Fixture A (form + endpoint)', () => {
    it('converges with the five-rebound contract → ui → stitch chain', () => {
        installEmptyMemory();
        const state = new DeliveryState({ ticket: formEndpointTicket() });

        const seen = driveMixedLoop(state, formEndpointContract());

        expect(seen).toEqual(FIVE_REBOUND_CHAIN);
        for (const name of STEP_ORDER) {
            expect(state.outcomes[name], JSON.stringify(state.outcomes)).toBe(Outcome.SUCCESS);
        }
    });

    it('locks the contract before the UI track is reachable', () => {
        installEmptyMemory();
        const state = new DeliveryState({ ticket: formEndpointTicket() });
        const contract = formEndpointContract();

        // Step 1 — first halt must be contract-plan at the plan slot.
        let [final, halting] = dispatch(state, MIXED_STEPS);
        expect(final).toBe(Outcome.BLOCKED);
        expect(halting).toBe('plan');
        expect(extractDirectiveVerb(state.questions)).toBe('contract-plan');

        // Step 2 — agent fills contract; next halt is the user-confirmation
        // screen (no directive). UI track is NOT yet reachable.
        resumeAsAgent(state, 'contract-plan', contract);
        [final, halting] = dispatch(state, MIXED_STEPS);
        expect(final).toBe(Outcome.BLOCKED);
        expect(halting).toBe('plan');
        expect(extractDirectiveVerb(state.questions)).toBeNull();
        expect(state.outcomes['implement']).not.toBe(Outcome.SUCCESS);

        // Step 3 — only after contract_confirmed flips does ui-track fire.
        resumeAsAgent(state, null, contract);
        [final, halting] = dispatch(state, MIXED_STEPS);
        expect(final).toBe(Outcome.BLOCKED);
        expect(halting).toBe('implement');
        expect(extractDirectiveVerb(state.questions)).toBe('ui-track');
    });
});

describe('mixed flow — Fixture B (table + filtered list endpoint)', () => {
    it('converges with the same five-rebound chain', () => {
        installEmptyMemory();
        const state = new DeliveryState({ ticket: tableFilterTicket() });

        const seen = driveMixedLoop(state, tableFilterContract());

        expect(seen).toEqual(FIVE_REBOUND_CHAIN);
        for (const name of STEP_ORDER) {
            expect(state.outcomes[name], JSON.stringify(state.outcomes)).toBe(Outcome.SUCCESS);
        }
    });

    it('records the two smoke scenarios the integration-test rebound ran', () => {
        installEmptyMemory();
        const state = new DeliveryState({ ticket: tableFilterTicket() });

        driveMixedLoop(state, tableFilterContract());

        expect(state.stitch).not.toBeNull();
        const stitch = state.stitch as Record<string, unknown>;
        expect(stitch['verdict']).toBe('success');
        const scenarios = (stitch['scenarios'] ?? []) as Array<{ id: string }>;
        expect(scenarios.length).toBe(2);
        expect(new Set(scenarios.map((s) => s.id))).toEqual(new Set(['S-1', 'S-2']));
    });
});

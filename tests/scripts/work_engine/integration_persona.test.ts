// Persona-policy integration across the backend step handlers (pure TS).
//
// Behavioural twin of tests/work_engine/test_persona_integration.py — the
// Python suite is the spec. test_integration_full_flow covers the default
// `senior-engineer` persona end-to-end; this file exercises the two remaining
// shipped personas — `qa` and `advisory` — under the same scripted-orchestrator
// pattern, driving the real backend `dispatch`.
//
// No python, no oracle: import the TS twins, drive `dispatch`, assert the QA
// scope widening, the advisory plan-only convergence (implement/test/verify
// auto-succeed), and the advisory report shape (no next-commands, persona in
// header, core sections kept). `memory_lookup.retrieve` is stubbed empty via
// `_setRetrieve` (the TS mirror of `fake_memory_lookup`).
import { afterEach, describe, expect, it } from 'vitest';

import {
    AGENT_DIRECTIVE_PREFIX,
    DeliveryState,
    Outcome,
    is_agent_directive,
} from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    dispatch,
} from '../../../src/agent-src/templates/scripts/work_engine/dispatcher.js';
import {
    get_steps,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/index.js';
import {
    _setRetrieve,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/memory.js';

const REAL_STEPS = get_steps();

afterEach(() => {
    _setRetrieve(null);
});

function installEmptyMemory(): void {
    _setRetrieve(() => []);
}

function ticket(): Record<string, unknown> {
    return {
        id: 'TICKET-9001',
        title: 'Add invoice export',
        acceptance_criteria: [
            'User can download invoices as CSV from the invoices page.',
            'Filename includes the selected date range.',
        ],
    };
}

function directiveVerb(questions: string[]): string {
    expect(questions.length).toBeGreaterThan(0);
    expect(is_agent_directive(questions[0])).toBe(true);
    const payload = (questions[0] as string).split(':').slice(1).join(':').trim();
    return payload.split(' ', 1)[0] as string;
}

describe('persona integration — qa', () => {
    it('widens the run-tests directive to scope=full', () => {
        installEmptyMemory();
        const state = new DeliveryState({ ticket: ticket(), persona: 'qa' });

        // Walk to the test step — plan + implement still delegate normally.
        dispatch(state, REAL_STEPS);
        state.plan = [{ title: 'Add export button' }];
        state.outcomes['plan'] = Outcome.SUCCESS;

        dispatch(state, REAL_STEPS);
        state.changes = [{ path: 'app/Exports/InvoiceCsvExport.php' }];
        state.outcomes['implement'] = Outcome.SUCCESS;

        const [final, halting] = dispatch(state, REAL_STEPS);
        expect(final).toBe(Outcome.BLOCKED);
        expect(halting).toBe('test');
        const directive = state.questions[0] as string;
        expect(directive.startsWith(AGENT_DIRECTIVE_PREFIX)).toBe(true);
        expect(directive).toContain('scope=full');
        // Human-facing option line mirrors the widened scope.
        expect(state.questions.some((q) => q.includes('run full tests'))).toBe(true);
    });
});

describe('persona integration — advisory', () => {
    it('converges with only the create-plan rebound (implement/test/verify auto-succeed)', () => {
        installEmptyMemory();
        const state = new DeliveryState({ ticket: ticket(), persona: 'advisory' });
        const verbsSeen: string[] = [];

        let converged = false;
        for (let i = 0; i < 6; i++) {
            const [final] = dispatch(state, REAL_STEPS);
            if (final === Outcome.SUCCESS) {
                converged = true;
                break;
            }
            expect(final).toBe(Outcome.BLOCKED);
            const verb = directiveVerb(state.questions);
            verbsSeen.push(verb);
            // Advisory only rebounds on create-plan; implement/test/verify
            // auto-succeed so no other directive should ever appear.
            expect(verb).toBe('create-plan');
            state.plan = [{ title: 'Propose a CSV export on the invoice page' }];
            state.outcomes['plan'] = Outcome.SUCCESS;
        }
        expect(converged, 'advisory flow did not converge').toBe(true);

        expect(verbsSeen).toEqual(['create-plan']);
        for (const name of ['implement', 'test', 'verify', 'report']) {
            expect(state.outcomes[name]).toBe(Outcome.SUCCESS);
        }
    });

    it('drops the next-commands section from the report (nothing was changed)', () => {
        installEmptyMemory();
        const state = new DeliveryState({ ticket: ticket(), persona: 'advisory' });

        for (let i = 0; i < 4; i++) {
            const [final] = dispatch(state, REAL_STEPS);
            if (final === Outcome.SUCCESS) break;
            state.plan = [{ title: 'Advisory-only outline' }];
            state.outcomes['plan'] = Outcome.SUCCESS;
        }

        expect(state.report).not.toContain('Suggested next commands');
        expect(state.report).not.toContain('/commit');
        // But the persona itself shows up in the report header.
        expect(state.report).toContain('advisory');
    });

    it('still renders the core Ticket/Persona/Plan sections', () => {
        installEmptyMemory();
        const state = new DeliveryState({ ticket: ticket(), persona: 'advisory' });

        for (let i = 0; i < 4; i++) {
            const [final] = dispatch(state, REAL_STEPS);
            if (final === Outcome.SUCCESS) break;
            state.plan = 'Outline only';
            state.outcomes['plan'] = Outcome.SUCCESS;
        }

        for (const heading of ['## Ticket', '## Persona', '## Plan']) {
            expect(state.report).toContain(heading);
        }
    });
});

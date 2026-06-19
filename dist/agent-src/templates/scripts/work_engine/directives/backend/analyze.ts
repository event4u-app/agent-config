/**
 * `analyze` step — deterministic precondition gate.
 *
 * TypeScript twin of `work_engine/directives/backend/analyze.py` (ADR-200
 * py2ts Phase 1 — work_engine directive sets). Public API names stay
 * snake_case to mirror the Python module 1:1 (per ADR-200 — Python style is
 * part of the contract).
 *
 * The step runs no analysis of its own: the real impact analysis is
 * owned by the agent between the `memory` and `plan` steps. The
 * gate's job is to confirm the upstream slices are populated enough
 * for planning to be meaningful.
 *
 * Checks, in order:
 *
 * 1. `refine` outcome must be `success` — the ticket is refined.
 * 2. `memory` outcome must be `success` — priors were queried
 *    (an empty result set is still a successful query, per the
 *    `memory` step's own contract).
 * 3. The ticket must still carry acceptance criteria — guards against
 *    a resuming caller overwriting `state.ticket` between runs.
 *
 * On any missing precondition the step returns `BLOCKED` with the
 * reason spelled out and numbered options per the `user-interaction`
 * rule. Otherwise it returns `SUCCESS` without mutating state.
 */

import type { DeliveryState} from '../../delivery_state.js';
import { Outcome, StepResult } from '../../delivery_state.js';

/** Declared ambiguity surfaces. Every BLOCKED return maps to one code. */
export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [
    {
        code: 'upstream_refine_failed',
        trigger: '`refine` outcome is not `success`',
        resolution: 're-run `/implement-ticket` from the start',
    },
    {
        code: 'upstream_memory_failed',
        trigger: '`memory` outcome is not `success`',
        resolution: 're-run `/implement-ticket` from the start',
    },
    {
        code: 'lost_ac',
        trigger: 'ticket lost its `acceptance_criteria` between runs',
        resolution: 'restart with the full ticket payload',
    },
];

/** Return SUCCESS when upstream is coherent, BLOCKED otherwise. */
export function run(state: DeliveryState): StepResult {
    const missing = _diagnose(state);
    if (missing.length === 0) {
        return new StepResult({ outcome: Outcome.SUCCESS });
    }

    const ticketId = _pyTruthy((state.ticket ?? {}).id) ? String((state.ticket ?? {}).id) : '(no id)';
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: _format_questions(ticketId, missing),
        message: `Ticket ${ticketId} cannot enter the plan step: ` + missing.join('; '),
    });
}

/** List the precondition failures in the order a reader needs them. */
function _diagnose(state: DeliveryState): string[] {
    const issues: string[] = [];

    if (state.outcomes.refine !== Outcome.SUCCESS) {
        issues.push('refine step did not complete successfully');
    }

    if (state.outcomes.memory !== Outcome.SUCCESS) {
        issues.push('memory step did not complete successfully');
    }

    const ac = (state.ticket ?? {}).acceptance_criteria;
    if (!Array.isArray(ac) || ac.length === 0) {
        issues.push('ticket lost its acceptance criteria');
    }

    return issues;
}

/**
 * Render the numbered options shown to the user when BLOCKED.
 *
 * Two options: retry from the first failing step, or abort. The
 * headnote names the ticket and every failure so the user can
 * decide without re-reading the earlier output.
 */
function _format_questions(ticketId: string, missing: string[]): string[] {
    const headnote = `> Ticket ${ticketId} — analyze gate failed: ` + missing.join('; ') + '.';
    return [
        headnote,
        '> 1. Re-run `/implement-ticket` from the start — rebuild upstream state',
        '> 2. Abort — the flow cannot continue',
    ];
}

/** Python truthiness for the scalar/container kinds these slices carry. */
function _pyTruthy(value: unknown): boolean {
    if (value === null || value === undefined || value === false) {
        return false;
    }
    if (value === true) {
        return true;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        return value.length !== 0;
    }
    if (Array.isArray(value)) {
        return value.length !== 0;
    }
    if (value instanceof Set || value instanceof Map) {
        return value.size !== 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>).length !== 0;
    }
    return true;
}

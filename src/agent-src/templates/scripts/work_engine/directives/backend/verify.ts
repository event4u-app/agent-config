/**
 * `verify` step — gate + Option-A delegation to `review-changes`.
 *
 * TypeScript twin of `work_engine/directives/backend/verify.py` (ADR-200
 * py2ts Phase 1 — work_engine directive sets). Public API names stay
 * snake_case to mirror the Python module 1:1 (per ADR-200 — Python style is
 * part of the contract).
 *
 * The dispatcher does not run the review-changes judges itself; the
 * agent invokes the composite review (bug-hunter + security +
 * test-coverage + code-quality) and captures the consolidated
 * verdict onto `state.verify`.
 *
 * `state.verify` contract when populated:
 *
 * - Must be a dict.
 * - Must carry a `verdict` key — one of `success`, `blocked`,
 *   `partial`. Matches the `Outcome` vocabulary used everywhere
 *   else in the flow.
 * - A `success` verdict advances the flow to `report`.
 * - A `blocked` or `partial` verdict enters the bounded self-fix loop
 *   (`./_self_fix.ts`): while attempts remain and the verdict signature
 *   keeps changing, the fix is delegated by directive. An exhausted or
 *   non-progressing loop exits `PARTIAL` with numbered options so the user
 *   decides whether to take over, override (rarely appropriate), or abort.
 *   The loop never turns a non-success verdict into `SUCCESS`.
 * - Optional keys (`confidence`, `findings`, `followups`) feed
 *   the delivery report.
 */

import type { DeliveryState} from '../../delivery_state.js';
import { type Any, Outcome, StepResult, agent_directive } from '../../delivery_state.js';
import { resolve_policy } from '../../persona_policy.js';
import { decide, partial_exit, record_attempt, retry_halt, unmet_dod, verdict_signature } from './_self_fix.js';

/**
 * DERIVED, never re-declared. `delivery_state.ts` is the step vocabulary's
 * declaration for the template tree (templates are self-contained by contract
 * and may not import from `src/scripts/`, so the registry mirrors it rather
 * than the other way round). Spelling the three values again here made this the
 * THIRD copy, and a third copy is how one vocabulary becomes two truths --
 * which is the defect the outcome-vocabulary reconciliation was opened to fix.
 * Found by the widened duplicate detector, 2026-08-30.
 */
const _ALLOWED_VERDICTS = Object.values(Outcome) as ReadonlyArray<Outcome>;

/** Declared ambiguity surfaces. Advisory personas skip this step entirely. */
export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [
    {
        code: 'upstream_test_failed',
        trigger: '`test` outcome is not `success`',
        resolution: 're-run `/implement-ticket` from the start',
    },
    {
        code: 'empty_verify_delegate',
        trigger: '`state.verify` empty — four-judge review not run yet',
        resolution: 'agent directive `review-changes` → `/review-changes`',
    },
    {
        code: 'malformed_verify',
        trigger: '`state.verify` is not a dict or `verdict` is not one of ' + 'success / blocked / partial',
        resolution: 're-run `/review-changes` and record a clean verdict',
    },
    {
        code: 'bad_verify_verdict',
        trigger: '`state.verify[\'verdict\']` is `blocked` or `partial`',
        resolution:
            'bounded self-fix loop: agent directive `fix-failing-checks` ' +
            'while attempts remain — never bypass ' + '(see `verify-before-complete`)',
    },
    {
        code: 'self_fix_exhausted',
        trigger:
            'the self-fix budget for `verify` is spent, or two consecutive ' +
            'attempts produced an identical verdict signature',
        resolution:
            'PARTIAL honest exit — the non-success verdict stays on the ' +
            'surface; the user takes over, overrides, or aborts',
    },
];

/** Gate on `test`, then either delegate or validate `state.verify`. */
export function run(state: DeliveryState): StepResult {
    const policy = resolve_policy(state.persona);
    if (!policy.allows_verify) {
        return new StepResult({
            outcome: Outcome.SUCCESS,
            message: `verify skipped: persona \`${policy.name}\` is plan-only.`,
        });
    }

    if (state.outcomes.test !== Outcome.SUCCESS) {
        return _blocked_on_precondition(state);
    }

    const verify = state.verify;
    if (!_pyTruthy(verify)) {
        return _delegate_to_review_changes(state);
    }

    const shapeIssues = _diagnose_verify(verify);
    if (shapeIssues.length > 0) {
        return _blocked_on_shape(state, shapeIssues);
    }

    const verdict = (verify as Record<string, unknown>).verdict;
    if (verdict !== 'success') {
        return _blocked_on_bad_verdict(state, verdict);
    }

    return new StepResult({ outcome: Outcome.SUCCESS });
}

function _diagnose_verify(verify: Any): string[] {
    if (!_isPlainObject(verify)) {
        return [`state.verify must be a dict, got ${_pyTypeName(verify)}`];
    }
    const verdict = (verify as Record<string, unknown>).verdict;
    if (!_inAllowedVerdicts(verdict)) {
        return [
            `state.verify['verdict'] must be one of ` +
                `${_ALLOWED_VERDICTS.join(', ')}; got ${_pyRepr(verdict)}`,
        ];
    }
    return [];
}

function _delegate_to_review_changes(state: DeliveryState): StepResult {
    const ticketId = _ticketId(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive('review-changes', { ticket: ticketId }),
            `> Ticket ${ticketId} — running the four-judge review ` +
                '(bugs, security, tests, code quality) before the delivery ' +
                'report is written.',
            '> 1. Continue — run `review-changes` now',
            '> 2. Abort — skip review (NOT recommended)',
        ],
        message: `Ticket ${ticketId} needs \`review-changes\` before the report.`,
    });
}

function _blocked_on_precondition(state: DeliveryState): StepResult {
    const ticketId = _ticketId(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            `> Ticket ${ticketId} — verify gate refused: ` +
                '`test` step did not complete successfully.',
            '> 1. Re-run `/implement-ticket` from the start',
            '> 2. Abort',
        ],
        message: `Ticket ${ticketId} cannot verify: test gate did not pass.`,
    });
}

function _blocked_on_shape(state: DeliveryState, issues: string[]): StepResult {
    const ticketId = _ticketId(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            `> Ticket ${ticketId} — recorded verify output is malformed: ` + issues.join('; ') + '.',
            '> 1. Re-run `review-changes` and resume',
            '> 2. Abort — verify verdict cannot be trusted',
        ],
        message: `Ticket ${ticketId} verify shape invalid: ${issues.join('; ')}.`,
    });
}

/**
 * Route a red review verdict through the bounded self-fix loop.
 *
 * Same shape as the `test` lane, separate counter: `autonomous-execution`
 * resets its N=3 budget on a different validation target, and a review finding
 * is not a failing test. `verify-before-complete` is unaffected — the loop
 * cannot report completion, and its exhausted exit is PARTIAL with the
 * non-success verdict still on the surface.
 */
function _blocked_on_bad_verdict(state: DeliveryState, verdict: Any): StepResult {
    const ticketId = _ticketId(state);
    const signature = verdict_signature('verify', state.verify);
    const decision = decide(state, 'verify', signature);

    if (decision.kind === 'retry') {
        record_attempt(state, 'verify', signature);
        return retry_halt({
            lane: 'verify',
            ticket_id: ticketId,
            verdict,
            decision,
            fix_hint: 'address the recorded findings, then re-run the four-judge review.',
            rerun_directive: 'review-changes',
        });
    }

    return partial_exit({
        lane: 'verify',
        ticket_id: ticketId,
        verdict,
        decision,
        unmet: unmet_dod(state),
        rerun_directive: 'review-changes',
    });
}

/** `(state.ticket or {}).get("id") or "(no id)"`. */
function _ticketId(state: DeliveryState): string {
    const id = (state.ticket ?? {}).id;
    return _pyTruthy(id) ? String(id) : '(no id)';
}

function _inAllowedVerdicts(value: unknown): boolean {
    return (_ALLOWED_VERDICTS as ReadonlyArray<unknown>).includes(value);
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

/** True for a dict-like value (mirrors Python `isinstance(x, dict)`). */
function _isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        !(value instanceof Set) &&
        !(value instanceof Map)
    );
}

/** Python `type(x).__name__` for the value kinds the diagnose paths see. */
function _pyTypeName(value: unknown): string {
    if (value === null || value === undefined) {
        return 'NoneType';
    }
    if (typeof value === 'boolean') {
        return 'bool';
    }
    if (typeof value === 'number') {
        return Number.isInteger(value) ? 'int' : 'float';
    }
    if (typeof value === 'string') {
        return 'str';
    }
    if (Array.isArray(value)) {
        return 'list';
    }
    if (value instanceof Set) {
        return 'set';
    }
    if (value instanceof Map || _isPlainObject(value)) {
        return 'dict';
    }
    return typeof value;
}

/**
 * Python `repr()` for the verdict value kinds (`{verdict!r}`).
 *
 * Strings render single-quoted; `None` → `None`; booleans → `True` / `False`;
 * numbers as-is. Only the kinds an invalid `verdict` slot can carry are
 * covered.
 */
function _pyRepr(value: unknown): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (value === true) {
        return 'True';
    }
    if (value === false) {
        return 'False';
    }
    if (typeof value === 'string') {
        return `'${value}'`;
    }
    return String(value);
}

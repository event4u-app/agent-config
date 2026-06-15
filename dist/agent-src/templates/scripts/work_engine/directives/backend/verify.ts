/**
 * `verify` step — gate + Option-A delegation to `review-changes`.
 *
 * TypeScript twin of `work_engine/directives/backend/verify.py` (ADR-096
 * py2ts Phase 1 — work_engine directive sets). Public API names stay
 * snake_case to mirror the Python module 1:1 (per ADR-096 — Python style is
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
 * - A `blocked` or `partial` verdict halts with numbered options
 *   so the user decides whether to address the findings, override
 *   (rarely appropriate), or abort.
 * - Optional keys (`confidence`, `findings`, `followups`) feed
 *   the delivery report.
 */

import { type Any, DeliveryState, Outcome, StepResult, agent_directive } from '../../delivery_state.js';
import { resolve_policy } from '../../persona_policy.js';

const _ALLOWED_VERDICTS = ['success', 'blocked', 'partial'] as const;

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
            'address findings and re-run `/review-changes` — never bypass ' + '(see `verify-before-complete`)',
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

function _blocked_on_bad_verdict(state: DeliveryState, verdict: Any): StepResult {
    const ticketId = _ticketId(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            `> Ticket ${ticketId} — \`review-changes\` reported ` +
                `\`${String(verdict)}\`. The delivery report cannot claim completion on a ` +
                'non-success verdict (see `verify-before-complete`).',
            '> 1. Address the findings and re-run `review-changes`',
            '> 2. Continue anyway — override (NOT recommended)',
            '> 3. Abort',
        ],
        message: `Ticket ${ticketId} verify verdict was \`${String(verdict)}\`, not success.`,
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

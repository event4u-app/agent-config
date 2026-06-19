/**
 * `plan` step — gate + delegation to `feature-plan`.
 *
 * TypeScript twin of `work_engine/directives/backend/plan.py` (ADR-200
 * py2ts Phase 1 — work_engine directive sets). Public API names stay
 * snake_case to mirror the Python module 1:1 (per ADR-200 — Python style is
 * part of the contract).
 *
 * The dispatcher cannot synthesise a plan from pure code: the real
 * work needs code reading and judgement that only the agent has. The
 * step therefore follows the Option-A delegation pattern described in
 * `docs/contracts/implement-ticket-flow.md#agent-directives`:
 *
 * - `state.plan` empty → halt with `BLOCKED` and emit
 *   `@agent-directive: create-plan`. The orchestrator runs the
 *   `feature-plan` skill, writes its output onto `state.plan`,
 *   marks `outcomes['plan'] = 'success'`, and re-invokes the
 *   dispatcher.
 *
 * - `state.plan` populated with a minimally valid shape → `SUCCESS`
 *   with no mutation. Shape validation catches accidental scaffolding
 *   (e.g. an empty list, a placeholder string) that would produce a
 *   broken plan downstream.
 *
 * - `state.plan` populated but malformed → `BLOCKED` with numbered
 *   options so the user decides whether to re-plan, continue with the
 *   malformed plan, or abort.
 *
 * `analyze` is a precondition: the step refuses to plan when the
 * upstream gate did not succeed, rather than silently re-running a
 * derailed flow.
 */

import type { DeliveryState} from '../../delivery_state.js';
import { type Any, Outcome, StepResult, agent_directive } from '../../delivery_state.js';

/** Declared ambiguity surfaces. Every BLOCKED return maps to one code. */
export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [
    {
        code: 'upstream_analyze_failed',
        trigger: '`analyze` outcome is not `success`',
        resolution: 're-run `/implement-ticket` from the start',
    },
    {
        code: 'empty_plan_delegate',
        trigger: '`state.plan` empty — no plan recorded yet',
        resolution: 'agent directive `create-plan` → `/feature-plan`',
    },
    {
        code: 'malformed_plan',
        trigger:
            'plan is not a non-empty string, list of strings/dicts, ' +
            'or dict with a non-empty `steps` list',
        resolution: 're-run `/feature-plan` or correct the recorded plan',
    },
];

/** Gate on `analyze`, then either delegate or validate the plan. */
export function run(state: DeliveryState): StepResult {
    if (state.outcomes.analyze !== Outcome.SUCCESS) {
        return _blocked_on_precondition(state);
    }

    if (_is_plan_empty(state.plan)) {
        return _delegate_to_feature_plan(state);
    }

    const shapeIssues = _diagnose_shape(state.plan);
    if (shapeIssues.length > 0) {
        return _blocked_on_shape(state, shapeIssues);
    }

    return new StepResult({ outcome: Outcome.SUCCESS });
}

/**
 * True when `state.plan` has nothing a downstream step could use.
 *
 * Whitespace-only strings count as empty — the user experience of
 * "nothing planned" is identical to "blank placeholder", and both
 * should delegate to `feature-plan` rather than fall through to
 * the shape-validator.
 */
function _is_plan_empty(plan: Any): boolean {
    if (plan === null || plan === undefined) {
        return true;
    }
    if (typeof plan === 'string') {
        return _pyStrip(plan).length === 0;
    }
    if (Array.isArray(plan)) {
        return plan.length === 0;
    }
    if (plan instanceof Set || plan instanceof Map) {
        return plan.size === 0;
    }
    if (typeof plan === 'object') {
        return Object.keys(plan as Record<string, unknown>).length === 0;
    }
    return false;
}

/**
 * Return the list of shape complaints against `state.plan`.
 *
 * Accepted shapes (matches `report._format_plan`):
 * a non-empty string, a list of strings or `{title, detail}` dicts,
 * or a dict with a non-empty `steps` list. Everything else is
 * rejected so the report renderer never has to guess.
 */
function _diagnose_shape(plan: Any): string[] {
    const issues: string[] = [];

    if (typeof plan === 'string') {
        if (_pyStrip(plan).length === 0) {
            issues.push('plan is a blank string');
        }
        return issues;
    }

    if (Array.isArray(plan)) {
        if (plan.length === 0) {
            issues.push('plan list is empty');
            return issues;
        }
        plan.forEach((item, i) => {
            const idx = i + 1;
            if (_isPlainObject(item)) {
                const d = item as Record<string, unknown>;
                if (!_pyTruthy(d.title) && !_pyTruthy(d.step)) {
                    issues.push(`plan step #${idx} has no title`);
                }
            } else if (typeof item !== 'string' || _pyStrip(item).length === 0) {
                issues.push(`plan step #${idx} is not a usable string`);
            }
        });
        return issues;
    }

    if (_isPlainObject(plan)) {
        const steps = (plan as Record<string, unknown>).steps;
        if (!Array.isArray(steps) || steps.length === 0) {
            issues.push("plan dict must carry a non-empty 'steps' list");
        }
        return issues;
    }

    issues.push(`plan has unsupported type: ${_pyTypeName(plan)}`);
    return issues;
}

/** Halt with an agent directive so the orchestrator runs `feature-plan`. */
function _delegate_to_feature_plan(state: DeliveryState): StepResult {
    const ticketId = _ticketId(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive('create-plan', { ticket: ticketId }),
            `> Ticket ${ticketId} — no plan recorded yet; running ` +
                '`feature-plan` and resuming.',
            '> 1. Continue — use the plan produced by `feature-plan`',
            '> 2. Abort — stop before any edits are proposed',
        ],
        message: `Ticket ${ticketId} needs a plan before implementation.`,
    });
}

function _blocked_on_precondition(state: DeliveryState): StepResult {
    const ticketId = _ticketId(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            `> Ticket ${ticketId} — plan gate refused: ` +
                '`analyze` step did not complete successfully.',
            '> 1. Re-run `/implement-ticket` from the start',
            '> 2. Abort',
        ],
        message: `Ticket ${ticketId} cannot plan: analyze gate did not pass.`,
    });
}

function _blocked_on_shape(state: DeliveryState, issues: string[]): StepResult {
    const ticketId = _ticketId(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            `> Ticket ${ticketId} — recorded plan is malformed: ` + issues.join('; ') + '.',
            '> 1. Re-run `feature-plan` and resume',
            '> 2. Abort — the plan cannot be trusted',
        ],
        message: `Ticket ${ticketId} plan shape invalid: ${issues.join('; ')}.`,
    });
}

/** `(state.ticket or {}).get("id") or "(no id)"`. */
function _ticketId(state: DeliveryState): string {
    const id = (state.ticket ?? {}).id;
    return _pyTruthy(id) ? String(id) : '(no id)';
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

/** Python `str.strip()` — strip leading/trailing whitespace. */
function _pyStrip(s: string): string {
    return s.trim();
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

/**
 * `implement` step — gate + Option-A delegation for applying the plan.
 *
 * TypeScript twin of `work_engine/directives/backend/implement.py` (ADR-200
 * py2ts Phase 1 — work_engine directive sets). Public API names stay
 * snake_case to mirror the Python module 1:1 (per ADR-200 — Python style is
 * part of the contract).
 *
 * The step never edits files. Editing is delegated to the agent via
 * `@agent-directive: apply-plan`; the agent runs the `minimal-safe-
 * diff` and `scope-control` rules while it applies the plan, then
 * writes the resulting file-level changes onto `state.changes` and
 * marks `outcomes['implement'] = 'success'` before re-invoking the
 * dispatcher.
 *
 * Flow:
 *
 * - `plan` outcome is not `success` → BLOCKED on precondition.
 * - no RED evidence on `state.tests` → BLOCKED with
 *   `@agent-directive: observe-red` so the agent writes and observes the
 *   failing test for the next single behaviour BEFORE any production edit.
 * - `state.changes` empty → BLOCKED with `@agent-directive:
 *   apply-plan` so the agent applies the plan.
 * - `state.changes` populated but malformed (entries missing
 *   `path`, or non-dict entries) → BLOCKED with shape complaint.
 * - Otherwise → SUCCESS.
 *
 * `changes` entries use the loose shape described in
 * `docs/contracts/implement-ticket-flow.md#deliverystate-the-only-shared-object`
 * — each entry is a dict with at least a `path`; optional
 * `lines` / `purpose` feed the delivery report.
 *
 * RED evidence lives at `state.tests.red` and is the engine-side carrier for
 * the test-first default in `rules/think-before-action.md`. Two accepted
 * shapes, and nothing else counts:
 *
 * - one observation, or a list of them, each a dict with a non-empty
 *   `behaviour` and a `failure_class` from `_RED_FAILURE_CLASSES` — the three
 *   valid RED classes the `test-driven-development` skill admits (a failing
 *   assertion, a missing target, a contract failure). A broken fixture, a
 *   syntax error in the test, a missing unrelated dependency and a runner
 *   fault are NOT RED and are rejected by that same contract, not here.
 * - `{exempt: "<reason>"}` — the recorded override for work the skill's
 *   *Do NOT use when* list already excludes (scaffolding, generated files,
 *   documentation). Recorded, never silent: an absent key is not an exemption.
 *
 * The gate is per behaviour, not per run: it names the behaviour it is waiting
 * on and re-fires for the next one. It does NOT detect a batch — an agent that
 * front-loads every test for the feature satisfies it, and the eval that fails
 * a one-test-phase-then-one-code-phase plan is the control for that, not this
 * step.
 */

import type { DeliveryState} from '../../delivery_state.js';
import { type Any, Outcome, StepResult, agent_directive } from '../../delivery_state.js';
import { resolve_policy } from '../../persona_policy.js';

/** Declared ambiguity surfaces. Advisory personas skip this step entirely. */
export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [
    {
        code: 'upstream_plan_failed',
        trigger: '`plan` outcome is not `success`',
        resolution: 're-run `/implement-ticket` from the start',
    },
    {
        code: 'no_red_evidence',
        trigger: '`state.tests.red` carries neither an observed failing test for a ' +
            'behaviour nor a recorded exemption',
        resolution: 'agent directive `observe-red` → write the failing test for the ' +
            'next single behaviour, observe it fail, record it',
    },
    {
        code: 'empty_changes_delegate',
        trigger: '`state.changes` empty — plan not applied yet',
        resolution: 'agent directive `apply-plan` → edit under `minimal-safe-diff` ' + '+ `scope-control`',
    },
    {
        code: 'malformed_changes',
        trigger: 'any change entry is not a dict or has no non-empty `path`',
        resolution: 're-run `apply-plan` and resume',
    },
];

/** Gate on `plan`, then either delegate or validate `state.changes`. */
export function run(state: DeliveryState): StepResult {
    const policy = resolve_policy(state.persona);
    if (!policy.allows_implement) {
        // Advisory personas produce a plan only; `state.changes` stays
        // empty and the delivery report renders a "no file changes
        // recorded" placeholder. See `persona_policy` for contract.
        return new StepResult({
            outcome: Outcome.SUCCESS,
            message: `implement skipped: persona \`${policy.name}\` is plan-only.`,
        });
    }

    if (state.outcomes.plan !== Outcome.SUCCESS) {
        return _blocked_on_precondition(state);
    }

    // Test-first, enforced where the engine can see it: no production work is
    // emitted for a behaviour whose failing test has not been observed.
    const redIssue = _diagnose_red(state.tests);
    if (redIssue !== null) {
        return _blocked_on_missing_red(state, redIssue);
    }

    if (!_pyTruthy(state.changes)) {
        return _delegate_to_apply_plan(state);
    }

    const shapeIssues = _diagnose_changes(state.changes);
    if (shapeIssues.length > 0) {
        return _blocked_on_shape(state, shapeIssues);
    }

    return new StepResult({ outcome: Outcome.SUCCESS });
}

/** Every entry must be a dict carrying at least a non-empty `path`. */
function _diagnose_changes(changes: Any[]): string[] {
    const issues: string[] = [];
    changes.forEach((change, i) => {
        const idx = i + 1;
        if (!_isPlainObject(change)) {
            issues.push(`change #${idx} is not a dict`);
            return;
        }
        const d = change as Record<string, unknown>;
        const path = _pyTruthy(d.path) ? d.path : d.file;
        if (typeof path !== 'string' || _pyStrip(path).length === 0) {
            issues.push(`change #${idx} has no path`);
        }
    });
    return issues;
}

/** The three RED classes the `test-driven-development` mode contract admits. */
const _RED_FAILURE_CLASSES = ['assertion', 'missing_target', 'contract'] as const;

/**
 * `null` when `state.tests` carries usable RED evidence, else the complaint.
 *
 * Absent is a complaint, not an exemption — the whole point of the gate.
 */
function _diagnose_red(tests: Any): string | null {
    if (!_isPlainObject(tests)) {
        return 'no `state.tests.red` recorded';
    }
    const red = (tests as Record<string, unknown>).red;
    if (!_pyTruthy(red)) {
        return 'no `state.tests.red` recorded';
    }
    if (_isPlainObject(red) && _pyTruthy((red as Record<string, unknown>).exempt)) {
        return null;
    }
    const observations = Array.isArray(red) ? red : [red];
    for (const obs of observations) {
        if (!_isPlainObject(obs)) {
            return 'a `red` observation is not a dict';
        }
        const o = obs as Record<string, unknown>;
        if (typeof o.behaviour !== 'string' || _pyStrip(o.behaviour).length === 0) {
            return 'a `red` observation names no `behaviour`';
        }
        if (!_RED_FAILURE_CLASSES.includes(o.failure_class as (typeof _RED_FAILURE_CLASSES)[number])) {
            return (
                `\`red\` observation for \`${_pyStrip(o.behaviour)}\` has ` +
                `\`failure_class\` outside ${_RED_FAILURE_CLASSES.join(', ')}`
            );
        }
    }
    return null;
}

function _blocked_on_missing_red(state: DeliveryState, issue: string): StepResult {
    const ticketId = _ticketId(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive('observe-red', { ticket: ticketId }),
            `> Ticket ${ticketId} — implement gate refused: ${issue}. Write the ` +
                'failing test for the next single behaviour and observe it fail first.',
            '> 1. Continue — write and run that one failing test',
            '> 2. Record an exemption — `state.tests.red = {exempt: "<reason>"}`',
        ],
        message: `Ticket ${ticketId} needs an observed failing test before production work: ${issue}.`,
    });
}

function _delegate_to_apply_plan(state: DeliveryState): StepResult {
    const ticketId = _ticketId(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive('apply-plan', { ticket: ticketId }),
            `> Ticket ${ticketId} — applying the recorded plan under ` +
                '`minimal-safe-diff` + `scope-control`.',
            '> 1. Continue — apply the plan as recorded',
            '> 2. Abort — stop before any edits are made',
        ],
        message: `Ticket ${ticketId} needs its plan applied before testing.`,
    });
}

function _blocked_on_precondition(state: DeliveryState): StepResult {
    const ticketId = _ticketId(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            `> Ticket ${ticketId} — implement gate refused: ` +
                '`plan` step did not complete successfully.',
            '> 1. Re-run `/implement-ticket` from the start',
            '> 2. Abort',
        ],
        message: `Ticket ${ticketId} cannot implement: plan gate did not pass.`,
    });
}

function _blocked_on_shape(state: DeliveryState, issues: string[]): StepResult {
    const ticketId = _ticketId(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            `> Ticket ${ticketId} — recorded changes are malformed: ` + issues.join('; ') + '.',
            '> 1. Re-run `apply-plan` and resume',
            '> 2. Abort — changes cannot be trusted',
        ],
        message: `Ticket ${ticketId} changes shape invalid: ${issues.join('; ')}.`,
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

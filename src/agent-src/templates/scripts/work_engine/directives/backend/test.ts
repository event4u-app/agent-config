/**
 * `test` step — gate + Option-A delegation for running the test suite.
 *
 * TypeScript twin of `work_engine/directives/backend/test.py` (ADR-200
 * py2ts Phase 1 — work_engine directive sets). Public API names stay
 * snake_case to mirror the Python module 1:1 (per ADR-200 — Python style is
 * part of the contract).
 *
 * The dispatcher never spawns subprocesses. Test execution is handed
 * to the agent via `@agent-directive: run-tests scope=targeted`; the
 * agent drives the project's test runner (pytest, Pest, phpunit, …),
 * captures the verdict onto `state.tests`, marks
 * `outcomes['test'] = 'success'`, and re-invokes the dispatcher.
 *
 * Contract for `state.tests` when populated:
 *
 * - Must be a dict.
 * - Must carry a `verdict` key — one of `success`, `failed`,
 *   or `mixed` (targeted vs full-suite split). Anything else blocks.
 * - `failed` or `mixed` verdicts enter the bounded self-fix loop
 *   (`./_self_fix.ts`): the first attempts are delegated by directive, and an
 *   exhausted or non-progressing loop exits `PARTIAL` with the verdict still
 *   on the surface so the user decides whether to continue or stop. This
 *   follows the `verify-before-complete` rule: a bad test outcome must never
 *   be silently skipped, and the loop cannot report one as success.
 * - Optional keys (`targeted`, `full`, `duration_ms`,
 *   `followups`) feed the delivery report.
 * - `red` is NOT a verdict. It is the per-behaviour RED evidence
 *   `./implement.ts` gates on, written before any production edit, and it
 *   says nothing about the suite. A `state.tests` carrying `red` and no
 *   `verdict` therefore means the runner has not been invoked for the suite
 *   yet → delegate, exactly as an empty `state.tests` does. A `verdict` that
 *   is present and unrecognised still blocks on shape; this is a
 *   not-yet-run case, never a relaxed verdict check.
 */

import type { DeliveryState} from '../../delivery_state.js';
import { type Any, Outcome, StepResult, agent_directive } from '../../delivery_state.js';
import { resolve_policy } from '../../persona_policy.js';
import { decide, partial_exit, record_attempt, retry_halt, unmet_dod, verdict_signature } from './_self_fix.js';

const _ALLOWED_VERDICTS = ['success', 'failed', 'mixed'] as const;

/** Declared ambiguity surfaces. Advisory personas skip this step entirely. */
export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [
    {
        code: 'upstream_implement_failed',
        trigger: '`implement` outcome is not `success`',
        resolution: 're-run `/implement-ticket` from the start',
    },
    {
        code: 'empty_tests_delegate',
        trigger: '`state.tests` empty — test runner not invoked yet',
        resolution:
            'agent directive `run-tests scope=targeted|full` → ' +
            '`/tests-execute` (qa persona widens to full suite)',
    },
    {
        code: 'malformed_tests',
        trigger: '`state.tests` is not a dict or `verdict` is not one of ' + 'success / failed / mixed',
        resolution: 're-run tests and record a clean verdict',
    },
    {
        code: 'bad_test_verdict',
        trigger: '`state.tests[\'verdict\']` is `failed` or `mixed`',
        resolution:
            'bounded self-fix loop: agent directive `fix-failing-checks` ' +
            'while attempts remain and the verdict signature keeps changing',
    },
    {
        code: 'self_fix_exhausted',
        trigger:
            'the self-fix budget for `test` is spent, or two consecutive ' +
            'attempts produced an identical verdict signature',
        resolution:
            'PARTIAL honest exit — the red verdict stays on the surface, ' +
            'the user decides whether to take over, override, or abort',
    },
];

/** Gate on `implement`, then either delegate or validate `state.tests`. */
export function run(state: DeliveryState): StepResult {
    const policy = resolve_policy(state.persona);
    if (!policy.allows_test) {
        return new StepResult({
            outcome: Outcome.SUCCESS,
            message: `test skipped: persona \`${policy.name}\` is plan-only.`,
        });
    }

    if (state.outcomes.implement !== Outcome.SUCCESS) {
        return _blocked_on_precondition(state);
    }

    const tests = state.tests;
    if (!_pyTruthy(tests) || _isRedOnly(tests)) {
        return _delegate_to_run_tests(state, policy.widen_tests);
    }

    const shapeIssues = _diagnose_tests(tests);
    if (shapeIssues.length > 0) {
        return _blocked_on_shape(state, shapeIssues);
    }

    // At this point `tests` is a dict with a recognised verdict.
    const verdict = (tests as Record<string, unknown>).verdict;
    if (verdict !== 'success') {
        return _blocked_on_bad_verdict(state, verdict);
    }

    return new StepResult({ outcome: Outcome.SUCCESS });
}

/**
 * True when `state.tests` carries only the pre-implement RED record.
 *
 * `red` is written by the `implement` gate's `observe-red` directive; it is
 * evidence about one behaviour's first failing run, not a suite verdict. Only
 * a MISSING `verdict` routes here — a present-but-wrong one still blocks.
 */
function _isRedOnly(tests: Any): boolean {
    if (!_isPlainObject(tests)) {
        return false;
    }
    const d = tests as Record<string, unknown>;
    return !('verdict' in d) && _pyTruthy(d.red);
}

function _diagnose_tests(tests: Any): string[] {
    if (!_isPlainObject(tests)) {
        return [`state.tests must be a dict, got ${_pyTypeName(tests)}`];
    }
    const verdict = (tests as Record<string, unknown>).verdict;
    if (!_inAllowedVerdicts(verdict)) {
        return [
            `state.tests['verdict'] must be one of ` +
                `${_ALLOWED_VERDICTS.join(', ')}; got ${_pyRepr(verdict)}`,
        ];
    }
    return [];
}

/**
 * Emit the `run-tests` directive.
 *
 * `widen` comes from the persona policy (`qa` widens to the full
 * suite). The directive scope becomes the first thing an orchestrator
 * reads, so the widened case is visible without parsing the options.
 */
function _delegate_to_run_tests(state: DeliveryState, widen: boolean): StepResult {
    const ticketId = _ticketId(state);
    const scope = widen ? 'full' : 'targeted';
    const description = widen
        ? 'full suite (qa persona widens to catch regressions outside ' + 'the changed paths)'
        : 'targeted first (`--filter` on the changed paths), full ' + 'suite only if targeted passes';
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive('run-tests', { ticket: ticketId, scope }),
            `> Ticket ${ticketId} — running tests: ${description}.`,
            `> 1. Continue — run ${scope} tests now`,
            '> 2. Abort — skip testing (NOT recommended)',
        ],
        message: `Ticket ${ticketId} needs its tests run before verification.`,
    });
}

function _blocked_on_precondition(state: DeliveryState): StepResult {
    const ticketId = _ticketId(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            `> Ticket ${ticketId} — test gate refused: ` +
                '`implement` step did not complete successfully.',
            '> 1. Re-run `/implement-ticket` from the start',
            '> 2. Abort',
        ],
        message: `Ticket ${ticketId} cannot test: implement gate did not pass.`,
    });
}

function _blocked_on_shape(state: DeliveryState, issues: string[]): StepResult {
    const ticketId = _ticketId(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            `> Ticket ${ticketId} — recorded test output is malformed: ` + issues.join('; ') + '.',
            '> 1. Re-run tests and resume',
            '> 2. Abort — test verdict cannot be trusted',
        ],
        message: `Ticket ${ticketId} tests shape invalid: ${issues.join('; ')}.`,
    });
}

/**
 * Route a red test verdict through the bounded self-fix loop.
 *
 * Before this loop existed the function below returned a directive-free
 * BLOCKED — a user question block — so every red cost a user round-trip even
 * when the failure was one the agent could fix unaided. Now the first attempts
 * are delegated and only an exhausted or non-progressing loop reaches the
 * user, as a PARTIAL that still carries the red verdict.
 */
function _blocked_on_bad_verdict(state: DeliveryState, verdict: Any): StepResult {
    const ticketId = _ticketId(state);
    const signature = verdict_signature('test', state.tests);
    const decision = decide(state, 'test', signature);

    if (decision.kind === 'retry') {
        record_attempt(state, 'test', signature);
        return retry_halt({
            lane: 'test',
            ticket_id: ticketId,
            verdict,
            decision,
            fix_hint: 'read the failing assertions, fix the cause, re-run the same filter.',
            rerun_directive: 'run-tests',
        });
    }

    return partial_exit({
        lane: 'test',
        ticket_id: ticketId,
        verdict,
        decision,
        unmet: unmet_dod(state),
        rerun_directive: 'run-tests',
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

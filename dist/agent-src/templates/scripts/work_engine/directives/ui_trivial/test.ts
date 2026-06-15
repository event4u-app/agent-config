/**
 * `test` step — smoke-test delegate for the `ui-trivial` set.
 *
 * TypeScript twin of `directives/ui_trivial/test.py` (ADR-096 py2ts). Public
 * API names stay snake_case to mirror the Python module 1:1.
 *
 * The trivial path runs "apply + smoke-test only". The handler is the smaller
 * cousin of `backend.test`: same verdict contract on `state.tests`, narrower
 * scope on the agent directive. `failed` / `mixed` verdicts halt with the
 * verdict echoed back; `success` flows through.
 */
import {
    type Any,
    type DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
} from '../../delivery_state.js';

const _ALLOWED_VERDICTS: ReadonlyArray<string> = ['success', 'failed', 'mixed'];

export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [
    {
        code: 'empty_tests_delegate',
        trigger: '`state.tests` empty — smoke runner not invoked yet',
        resolution:
            'agent directive `run-tests scope=smoke` → ' +
            '`/tests-execute` (narrowest layer covering the touched file)',
    },
    {
        code: 'malformed_tests',
        trigger:
            '`state.tests` is not a dict or `verdict` is not one of ' +
            'success / failed / mixed',
        resolution: 're-run smoke and record a clean verdict',
    },
    {
        code: 'bad_test_verdict',
        trigger: "`state.tests['verdict']` is `failed` or `mixed`",
        resolution: 'fix the regression and re-run, or abort',
    },
];

function _isDict(value: Any): value is Record<string, Any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Python truthiness for `if not tests`. */
function _pyTruthy(value: Any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.length > 0;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
}

/** Python `type(x).__name__` for the dict/non-dict diagnostic. */
function _pyTypeName(value: Any): string {
    if (value === null || value === undefined) return 'NoneType';
    if (typeof value === 'boolean') return 'bool';
    if (typeof value === 'number') {
        return Number.isInteger(value) ? 'int' : 'float';
    }
    if (typeof value === 'string') return 'str';
    if (Array.isArray(value)) return 'list';
    return 'dict';
}

/** Python `repr()` for the verdict value (`{verdict!r}`). */
function pyRepr(value: Any): string {
    if (value === null || value === undefined) return 'None';
    if (value === true) return 'True';
    if (value === false) return 'False';
    if (typeof value === 'string') return pyStrRepr(value);
    return String(value);
}

function pyStrRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let body = '';
    for (const ch of s) {
        if (ch === '\\') body += '\\\\';
        else if (ch === quote) body += `\\${ch}`;
        else if (ch === '\n') body += '\\n';
        else if (ch === '\r') body += '\\r';
        else if (ch === '\t') body += '\\t';
        else body += ch;
    }
    return `${quote}${body}${quote}`;
}

/** Python `repr()` of the `_ALLOWED_VERDICTS` tuple, for `{_ALLOWED_VERDICTS}`. */
function _allowedVerdictsRepr(): string {
    return `(${_ALLOWED_VERDICTS.map((v) => pyStrRepr(v)).join(', ')})`;
}

/** Gate the smoke verdict; delegate when `state.tests` is empty. */
export function run(state: DeliveryState): StepResult {
    const tests = state.tests;
    if (!_pyTruthy(tests)) {
        return _delegate();
    }

    if (!_isDict(tests)) {
        return _malformed(`state.tests is ${_pyTypeName(tests)}, expected dict`);
    }

    const verdict = tests['verdict'];
    if (typeof verdict !== 'string' || !_ALLOWED_VERDICTS.includes(verdict)) {
        return _malformed(
            `state.tests['verdict']=${pyRepr(verdict)} not in ${_allowedVerdictsRepr()}`,
        );
    }

    if (verdict === 'success') {
        return new StepResult({ outcome: Outcome.SUCCESS });
    }

    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            `> Smoke test verdict: **${verdict}** — trivial edit may ` +
                'have regressed the touched surface.',
            '> 1. Investigate — read failures, fix, re-run smoke',
            '> 2. Reclassify — promote to `ui-improve` if the regression ' +
                'indicates the edit was less trivial than assumed',
            '> 3. Abort — revert the edit',
        ],
        message: `smoke verdict=${verdict} on trivial edit`,
    });
}

function _delegate(): StepResult {
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive('run-tests', { scope: 'smoke' }),
            '> Trivial edit applied; run the smoke test layer covering ' +
                'the touched file.',
            '> 1. Continue — invoke `/tests-execute` with smoke scope, ' +
                'then write the verdict back to `state.tests`',
            '> 2. Skip — record `state.tests = {"verdict": "success", ' +
                '"scope": "none"}` (logged as a deferred verification)',
            '> 3. Abort — drop this run',
        ],
        message: 'smoke run not yet invoked',
    });
}

function _malformed(detail: string): StepResult {
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            `> Malformed test envelope: ${detail}.`,
            '> 1. Re-run smoke — produce a clean verdict',
            '> 2. Abort — drop this run',
        ],
        message: detail,
    });
}

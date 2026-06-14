/**
 * `stitch` step — integration verification across the contract / UI seam.
 *
 * TypeScript twin of `directives/mixed/stitch.py` (ADR-096 py2ts). Public API
 * names stay snake_case to mirror the Python module 1:1.
 *
 * In the `mixed` directive set the `test` slot is the integration boundary.
 * The dispatcher does not run integration scenarios itself — the agent invokes
 * the `integration-test` skill which drives end-to-end smokes and writes the
 * verdict back to `state.stitch`.
 */
import {
    type Any,
    type DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
} from '../../delivery_state.js';

/** Agent directive that drives end-to-end smoke scenarios. */
export const INTEGRATION_TEST_DIRECTIVE = 'integration-test';

const _ALLOWED_VERDICTS: ReadonlyArray<string> = ['success', 'blocked', 'partial'];

export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [
    {
        code: 'upstream_ui_failed',
        trigger: '`implement` (mixed.ui) outcome is not `success`',
        resolution: 're-run the mixed flow; UI track must finish before stitch',
    },
    {
        code: 'empty_stitch_delegate',
        trigger: '`state.stitch` empty — integration-test skill has not run yet',
        resolution: 'agent directive `integration-test` → end-to-end smokes',
    },
    {
        code: 'malformed_stitch',
        trigger:
            '`state.stitch` is not a dict or `verdict` is not one of ' +
            'success / blocked / partial',
        resolution: 're-run `integration-test` and record a clean verdict',
    },
    {
        code: 'bad_stitch_verdict',
        trigger:
            "`state.stitch['verdict']` is `blocked` or `partial` " +
            'and `integration_confirmed` is not True',
        resolution:
            'address findings and re-run `integration-test`, or set ' +
            '`integration_confirmed=True` to override (rare)',
    },
];

function _isDict(value: Any): value is Record<string, Any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function _pyTruthy(value: Any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.length > 0;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
}

function _pyTypeName(value: Any): string {
    if (value === null || value === undefined) return 'NoneType';
    if (typeof value === 'boolean') return 'bool';
    if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
    if (typeof value === 'string') return 'str';
    if (Array.isArray(value)) return 'list';
    return 'dict';
}

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

function pyStr(value: Any): string {
    if (value === null || value === undefined) return 'None';
    if (value === true) return 'True';
    if (value === false) return 'False';
    return String(value);
}

function _pyRStrip(s: string): string {
    return s.replace(/\s+$/u, '');
}

/** Gate on `implement`, then validate `state.stitch`. */
export function run(state: DeliveryState): StepResult {
    if (state.outcomes['implement'] !== Outcome.SUCCESS) {
        return _blocked_on_precondition(state);
    }

    const stitch = state.stitch;
    if (!_pyTruthy(stitch)) {
        return _delegate_to_integration_test(state);
    }

    const shape_issues = _diagnose_stitch(stitch);
    if (shape_issues.length > 0) {
        return _blocked_on_shape(state, shape_issues);
    }

    const s = stitch as Record<string, Any>;
    const verdict = s['verdict'];
    if (verdict === 'success') {
        return new StepResult({ outcome: Outcome.SUCCESS });
    }

    if (s['integration_confirmed'] === true) {
        return new StepResult({
            outcome: Outcome.SUCCESS,
            message: `stitch verdict \`${pyStr(verdict)}\` overridden by integration_confirmed=True.`,
        });
    }

    return _blocked_on_bad_verdict(state, verdict, s);
}

/** Return shape errors; empty list when `stitch` is well-formed. */
function _diagnose_stitch(stitch: Any): string[] {
    if (!_isDict(stitch)) {
        return [`state.stitch must be a dict, got ${_pyTypeName(stitch)}`];
    }
    const verdict = stitch['verdict'];
    if (typeof verdict !== 'string' || !_ALLOWED_VERDICTS.includes(verdict)) {
        return [
            `state.stitch['verdict'] must be one of ` +
                `${_ALLOWED_VERDICTS.join(', ')}; got ${pyRepr(verdict)}`,
        ];
    }
    return [];
}

/** One-line preview of the original input for halt bodies. */
function _preview_input(state: DeliveryState): string {
    const data = (_isDict(state.ticket) ? state.ticket : {}) as Record<string, Any>;
    const raw = data['raw'];
    let text: string;
    if (typeof raw === 'string' && raw.trim() !== '') {
        text = raw.split(/\s+/u).filter((x) => x.length > 0).join(' ');
    } else {
        const title = data['title'];
        if (typeof title === 'string') {
            text = title;
        } else {
            const id = data['id'];
            text = _pyTruthy(id) ? pyStr(id) : '(no title)';
        }
    }
    if ([...text].length <= 80) {
        return text;
    }
    return _pyRStrip([...text].slice(0, 79).join('')) + '…';
}

/** BLOCKED halt — upstream UI step did not succeed. */
function _blocked_on_precondition(state: DeliveryState): StepResult {
    void state;
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            '> Mixed `stitch` step gated on the UI step; ' +
                'the implement outcome is not success.',
            '> 1. Re-run — restart the mixed flow from the start',
            '> 2. Abort — drop this request',
        ],
        message: 'stitch step gated on implement; upstream UI outcome is not success.',
    });
}

/** Halt with an agent directive so the orchestrator runs smokes. */
function _delegate_to_integration_test(state: DeliveryState): StepResult {
    const preview = _preview_input(state);
    const contract = _isDict(state.contract) ? state.contract : {};
    const api_surface = _pyTruthy(contract['api_surface']) ? contract['api_surface'] : [];
    const endpoint_count = Array.isArray(api_surface) ? api_surface.length : 0;

    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive(INTEGRATION_TEST_DIRECTIVE),
            `> Input: ${preview}`,
            '> UI track finished; the contract / UI seam needs end-to-end ' +
                'verification before the delivery report:',
            `> - Endpoints / actions to smoke: ${endpoint_count}`,
            '> Scenarios cover the full round-trip — fill form → ' +
                'server validation → response → UI update. Unit-level ' +
                'passes from the UI review do **not** substitute for this gate.',
            '> 1. Continue — run `integration-test` now',
            '> 2. Abort — skip integration verification (NOT recommended)',
        ],
        message: 'Mixed UI complete; delegating to integration-test for stitch.',
    });
}

/** BLOCKED halt — recorded stitch verdict is malformed. */
function _blocked_on_shape(state: DeliveryState, issues: string[]): StepResult {
    void state;
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            '> Recorded stitch output is malformed: ' + issues.join('; ') + '.',
            '> 1. Re-run `integration-test` and resume',
            '> 2. Abort — stitch verdict cannot be trusted',
        ],
        message: `Mixed stitch shape invalid: ${issues.join('; ')}.`,
    });
}

/** BLOCKED halt — verdict is blocked / partial and not user-confirmed. */
function _blocked_on_bad_verdict(
    state: DeliveryState,
    verdict: Any,
    stitch: Record<string, Any>,
): StepResult {
    void state;
    const scenarios = _pyTruthy(stitch['scenarios']) ? stitch['scenarios'] : [];
    const scenario_count = Array.isArray(scenarios) ? scenarios.length : 0;
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            `> \`integration-test\` reported \`${pyStr(verdict)}\` after running ` +
                `${scenario_count} scenario(s). The delivery report cannot ` +
                'claim completion on a non-success integration verdict.',
            '> 1. Address the findings and re-run `integration-test`',
            '> 2. Override — set `state.stitch.integration_confirmed=true` ' +
                'and resume (rare; document why)',
            '> 3. Abort',
        ],
        message:
            `Mixed stitch verdict was \`${pyStr(verdict)}\`, not success; ` +
            'user override required to continue.',
    });
}

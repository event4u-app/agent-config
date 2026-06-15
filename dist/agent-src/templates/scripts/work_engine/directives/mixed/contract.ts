/**
 * `contract` step — locks data_model + api_surface before any UI work.
 *
 * TypeScript twin of `directives/mixed/contract.py` (ADR-200 py2ts). Public
 * API names stay snake_case to mirror the Python module 1:1.
 *
 * In the `mixed` directive set the `plan` slot is the contract step. It
 * resolves the backend contract the UI will consume — entity shape, endpoint
 * signatures, validation surface — before the UI track runs. The mixed `ui`
 * step gates on `state.contract.contract_confirmed is True`.
 */
import {
    type Any,
    type DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
} from '../../delivery_state.js';

/** Top-level keys every well-formed contract must carry. */
export const REQUIRED_CONTRACT_KEYS: ReadonlyArray<string> = ['data_model', 'api_surface'];

export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [
    {
        code: 'upstream_analyze_failed',
        trigger: '`analyze` outcome is not `success`',
        resolution: 're-run the mixed flow from the start',
    },
    {
        code: 'contract_missing',
        trigger: 'state.contract is None or empty — contract has not been produced',
        resolution:
            'agent directive `contract-plan` → `feature-plan` skill ' +
            'writes the contract into state.contract',
    },
    {
        code: 'contract_incomplete',
        trigger:
            'contract is populated but missing required keys ' +
            '(`data_model`, `api_surface`) or one of them is empty',
        resolution:
            'agent re-runs `feature-plan` with contract-only scope; ' +
            'halt lists the missing slots',
    },
    {
        code: 'contract_unconfirmed',
        trigger: 'contract is well-formed but contract_confirmed is unset/False',
        resolution:
            'user reviews the contract summary and sets ' +
            'state.contract.contract_confirmed = True (or asks for ' +
            'revisions, which loops back to contract-plan)',
    },
];

function _isDict(value: Any): value is Record<string, Any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Python `value is None or value == [] or value == {}` — the contract step's
 * emptiness check. NOTE: unlike `directives/ui/design`, contract does NOT treat
 * an empty string `""` as missing; only None / empty list / empty dict count.
 */
function _isEmptyOrNone(value: Any): boolean {
    if (value === null || value === undefined) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (_isDict(value)) return Object.keys(value).length === 0;
    return false;
}

/** Apply the contract-first lock to `state.contract`. */
export function run(state: DeliveryState): StepResult {
    if (state.outcomes['analyze'] !== Outcome.SUCCESS) {
        return _blocked_on_precondition(state);
    }

    const contract = state.contract;
    if (!_is_populated(contract)) {
        return _delegate_to_feature_plan(state);
    }

    const missing = _missing_required_keys(contract as Record<string, Any>);
    if (missing.length > 0) {
        return _halt_incomplete_contract(state, missing);
    }

    if ((contract as Record<string, Any>)['contract_confirmed'] === true) {
        return new StepResult({ outcome: Outcome.SUCCESS });
    }

    return _halt_unconfirmed(state, contract as Record<string, Any>);
}

/** True when `contract` carries an actionable backend lock. */
function _is_populated(contract: Any): boolean {
    if (!_isDict(contract)) return false;
    if (Object.keys(contract).length === 0) return false;
    return REQUIRED_CONTRACT_KEYS.some((key) => key in contract);
}

/** Return required top-level keys that are missing or empty. */
function _missing_required_keys(contract: Record<string, Any>): string[] {
    const missing: string[] = [];
    for (const key of REQUIRED_CONTRACT_KEYS) {
        const value = contract[key];
        if (_isEmptyOrNone(value)) {
            missing.push(key);
        }
    }
    return missing;
}

/** Render a one-line preview of the input being contracted. */
function _preview_input(state: DeliveryState): string {
    const data = (_isDict(state.ticket) ? state.ticket : {}) as Record<string, Any>;
    const raw = data['raw'];
    let text: string;
    if (typeof raw === 'string' && raw.trim() !== '') {
        text = raw.split(/\s+/u).filter((s) => s.length > 0).join(' ');
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

/** Python `str.rstrip()` (no arg) — strip trailing whitespace. */
function _pyRStrip(s: string): string {
    return s.replace(/\s+$/u, '');
}

/** Python truthiness (used for the `data.get("id") or "(no title)"` chain). */
function _pyTruthy(value: Any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.length > 0;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
}

/** Python `str(value)`. */
function pyStr(value: Any): string {
    if (value === null || value === undefined) return 'None';
    if (value === true) return 'True';
    if (value === false) return 'False';
    return String(value);
}

/** BLOCKED halt — upstream `analyze` did not succeed. */
function _blocked_on_precondition(state: DeliveryState): StepResult {
    void state;
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            '> `analyze` did not succeed; cannot lock the contract until ' +
                'the upstream investigation lands.',
            '> 1. Re-run — restart the mixed flow from the start',
            '> 2. Abort — drop this request',
        ],
        message: 'contract step gated on analyze; upstream outcome is not success.',
    });
}

/** Halt with an agent directive so the orchestrator runs `feature-plan`. */
function _delegate_to_feature_plan(state: DeliveryState): StepResult {
    const preview = _preview_input(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive('contract-plan'),
            `> Input: ${preview}`,
            '> No backend contract yet — producing one now. The contract ' +
                'locks the data model and API surface the UI will consume; ' +
                'the mixed `ui` step refuses to start without it.',
            '> Scope: contract-only (no UI plan, no implementation).',
            '> 1. Continue — produce the contract via `feature-plan`',
            '> 2. Abort — drop this mixed request',
        ],
        message: 'Mixed contract missing; delegating to feature-plan (contract-only).',
    });
}

/** BLOCKED halt — contract is missing required keys. */
function _halt_incomplete_contract(state: DeliveryState, missing: string[]): StepResult {
    const preview = _preview_input(state);
    const lines: string[] = [
        agent_directive('contract-plan'),
        `> Input: ${preview}`,
        '> Backend contract is incomplete. Missing required slots:',
    ];
    for (const p of missing) {
        lines.push(`> - \`${p}\``);
    }
    lines.push(
        '> Re-run `feature-plan` (contract-only) so every required slot ' +
            'has a final value before the UI track starts.',
    );
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: lines,
        message: `Mixed contract incomplete; ${missing.length} required slot(s) missing.`,
    });
}

/** BLOCKED halt — contract is well-formed; user must sign off. */
function _halt_unconfirmed(state: DeliveryState, contract: Record<string, Any>): StepResult {
    const preview = _preview_input(state);
    const data_model = _pyTruthy(contract['data_model']) ? contract['data_model'] : [];
    const api_surface = _pyTruthy(contract['api_surface']) ? contract['api_surface'] : [];

    const entity_count = Array.isArray(data_model) ? data_model.length : 0;
    const endpoint_count = Array.isArray(api_surface) ? api_surface.length : 0;

    const lines: string[] = [
        `> Input: ${preview}`,
        '> Backend contract is ready. Summary:',
        `> - Entities (data model): ${entity_count}`,
        `> - Endpoints / actions (api surface): ${endpoint_count}`,
        '> 1. Confirm — lock this contract and advance to the UI track',
        '> 2. Revise — send feedback; loops back to `contract-plan`',
        '> 3. Abort — drop this mixed request',
        '',
        '**Recommendation: 1 — Confirm** — the contract covers both ' +
            'required slots. Caveat: flip to 2 only if an entity field or ' +
            'endpoint signature is wrong; the UI track will treat this ' +
            'contract as immutable input.',
    ];
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: lines,
        message: 'Mixed contract ready; halting for user confirmation before UI track.',
    });
}

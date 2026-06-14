/**
 * `ui` step — delegates to the UI track once the contract is locked.
 *
 * TypeScript twin of `directives/mixed/ui.py` (ADR-096 py2ts). Public API
 * names stay snake_case to mirror the Python module 1:1.
 *
 * In the `mixed` directive set the `implement` slot is the UI handoff. It
 * gates on the upstream contract sentinel
 * (`state.contract.contract_confirmed is True`) and then delegates the full
 * audit → design → apply → review → polish sub-flow to the UI track via an
 * `@agent-directive: ui-track` halt.
 */
import {
    type Any,
    type DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
} from '../../delivery_state.js';

/** Agent directive that triggers the full UI sub-flow. */
export const UI_TRACK_DIRECTIVE = 'ui-track';

export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [
    {
        code: 'upstream_contract_failed',
        trigger: '`plan` (contract) outcome is not `success`',
        resolution: 're-run the mixed flow from the start',
    },
    {
        code: 'contract_sentinel_missing',
        trigger:
            'state.contract.contract_confirmed is missing or False — ' +
            'defense-in-depth check refuses to start the UI track',
        resolution:
            'loop back to the contract step; user must confirm ' +
            'the data_model + api_surface lock before UI work begins',
    },
    {
        code: 'ui_track_not_started',
        trigger:
            'state.ui_review is empty or missing `review_clean` — ' +
            'the UI sub-flow has not run yet',
        resolution:
            'agent directive `ui-track` → orchestrator runs ' +
            'audit → design → apply → review → polish with the contract as ' +
            'immutable input',
    },
    {
        code: 'ui_track_review_unclean',
        trigger:
            'UI sub-flow finished but `review_clean` is False — ' +
            'polish ceiling reached or findings remain',
        resolution:
            'user picks re-run / hand off / abort; polish-ceiling ' +
            'semantics already fired inside the UI track',
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

function pyStr(value: Any): string {
    if (value === null || value === undefined) return 'None';
    if (value === true) return 'True';
    if (value === false) return 'False';
    return String(value);
}

function _pyRStrip(s: string): string {
    return s.replace(/\s+$/u, '');
}

/** Delegate the UI sub-flow once the contract is locked. */
export function run(state: DeliveryState): StepResult {
    if (state.outcomes['plan'] !== Outcome.SUCCESS) {
        return _blocked_on_precondition(state);
    }

    if (!_contract_confirmed(state)) {
        return _blocked_on_contract_sentinel(state);
    }

    const review = _isDict(state.ui_review) ? state.ui_review : null;
    if (review === null || !('review_clean' in review)) {
        return _delegate_to_ui_track(state);
    }

    if (review['review_clean'] === true) {
        return new StepResult({ outcome: Outcome.SUCCESS });
    }

    return _halt_review_unclean(state, review);
}

/** True when the contract sentinel is explicitly `True`. */
function _contract_confirmed(state: DeliveryState): boolean {
    const contract = state.contract;
    if (!_isDict(contract)) return false;
    return contract['contract_confirmed'] === true;
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

/** BLOCKED halt — upstream contract step did not succeed. */
function _blocked_on_precondition(state: DeliveryState): StepResult {
    void state;
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            '> Mixed `ui` step gated on the contract step; the contract ' +
                'outcome is not success.',
            '> 1. Re-run — restart the mixed flow from the start',
            '> 2. Abort — drop this request',
        ],
        message: 'ui step gated on plan; upstream contract outcome is not success.',
    });
}

/** BLOCKED halt — contract sentinel missing despite plan success. */
function _blocked_on_contract_sentinel(state: DeliveryState): StepResult {
    void state;
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            '> Contract sentinel missing — `state.contract.contract_confirmed` ' +
                'is not `True`. The UI track will not start until the data ' +
                'model and API surface are locked and confirmed.',
            '> 1. Loop back — re-enter the contract step and confirm',
            '> 2. Abort — drop this mixed request',
        ],
        message:
            'ui step refused; contract_confirmed sentinel missing despite plan success.',
    });
}

/** Halt with an agent directive so the orchestrator runs the UI track. */
function _delegate_to_ui_track(state: DeliveryState): StepResult {
    const preview = _preview_input(state);
    const contract = _isDict(state.contract) ? state.contract : {};
    const data_model = _pyTruthy(contract['data_model']) ? contract['data_model'] : [];
    const api_surface = _pyTruthy(contract['api_surface']) ? contract['api_surface'] : [];
    const entity_count = Array.isArray(data_model) ? data_model.length : 0;
    const endpoint_count = Array.isArray(api_surface) ? api_surface.length : 0;

    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive(UI_TRACK_DIRECTIVE),
            `> Input: ${preview}`,
            '> Contract is locked. Handing off to the UI track:',
            `> - Entities: ${entity_count}`,
            `> - Endpoints / actions: ${endpoint_count}`,
            '> The UI track runs audit → design → apply → ' +
                'review → polish with the contract as immutable input. ' +
                'No new entities or endpoints — the contract drives the UI shape.',
            '> 1. Continue — run the UI track',
            '> 2. Abort — drop this mixed request',
        ],
        message: 'Mixed contract locked; delegating UI sub-flow to ui-track.',
    });
}

/** BLOCKED halt — UI sub-flow finished but review is not clean. */
function _halt_review_unclean(state: DeliveryState, review: Record<string, Any>): StepResult {
    void state;
    const findings = _pyTruthy(review['findings']) ? review['findings'] : [];
    const finding_count = Array.isArray(findings) ? findings.length : 0;
    const lines: string[] = [
        `> UI track finished but review is not clean. Findings remaining: ${finding_count}.`,
        '> Polish ceiling already fired inside the UI track — the ' +
            'engine cannot resolve the remaining findings without a user ' +
            'decision.',
        '> 1. Re-run UI track — hand back to `ui-track` for another ' +
            'audit → design pass (rare; usually means the contract changed)',
        '> 2. Hand off — ship as-is and let a human resolve the ' +
            'remaining findings outside the engine',
        '> 3. Abort — drop this mixed request',
    ];
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: lines,
        message: `Mixed ui step halted; UI track review unclean (${finding_count} findings).`,
    });
}

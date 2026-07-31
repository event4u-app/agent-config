/**
 * `design` step — produces the design brief that locks microcopy.
 *
 * TypeScript twin of `directives/ui/design.py` (ADR-200 py2ts). Public API
 * names stay snake_case to mirror the Python module 1:1.
 *
 * The design step turns the audit findings into a structured design brief that
 * `apply` consumes verbatim. The brief is the lock — apply writes the strings
 * exactly as the brief specifies. Hallucinated microcopy at apply time is the
 * failure mode this step exists to prevent.
 */
import {
    type Any,
    type DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
} from '../../delivery_state.js';

/** Top-level keys every well-formed design brief must carry. */
export const REQUIRED_BRIEF_KEYS: ReadonlyArray<string> = [
    'layout',
    'components',
    'states',
    'microcopy',
    'a11y',
];

/** States the brief must cover; missing entries surface as halt items. */
export const REQUIRED_STATE_KEYS: ReadonlyArray<string> = [
    'empty',
    'loading',
    'error',
    'success',
    'disabled',
];

/** Lower-cased substrings that mark microcopy as unfinished. */
export const PLACEHOLDER_PATTERNS: ReadonlyArray<string> = [
    '<placeholder>',
    'lorem',
    'todo:',
    'tbd',
    'xxx',
];

export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [
    {
        code: 'design_missing',
        trigger: 'state.ui_design is None or empty — brief has not been produced',
        resolution:
            'agent directive `ui-design-brief` → skill/agent ' +
            'writes the brief into state.ui_design',
    },
    {
        code: 'design_placeholders',
        trigger:
            'microcopy contains placeholder patterns ' +
            '(<placeholder>, Lorem, TODO:, TBD, XXX)',
        resolution:
            'agent re-runs the brief with final strings; ' +
            'halt lists the offending microcopy keys',
    },
    {
        code: 'design_unconfirmed',
        trigger: 'brief is well-formed but design_confirmed is unset/False',
        resolution:
            'user reviews the brief summary and sets ' +
            'state.ui_design.design_confirmed = True (or asks for ' +
            'revisions, which loops back to ui-design-brief)',
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

/** Python `value is None or value == "" or value == [] or value == {}`. */
function _isEmptyOrNone(value: Any): boolean {
    if (value === null || value === undefined) return true;
    if (value === '') return true;
    if (Array.isArray(value)) return value.length === 0;
    if (_isDict(value)) return Object.keys(value).length === 0;
    return false;
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

/** Apply the design-brief lock to `state.ui_design`. */
export function run(state: DeliveryState): StepResult {
    const design = state.ui_design;
    if (!_is_populated(design)) {
        return _delegate_to_design_skill(state);
    }

    const designDict = design as Record<string, Any>;
    const missing = _missing_required_keys(designDict);
    if (missing.length > 0) {
        return _halt_incomplete_brief(state, missing);
    }

    const placeholders = _placeholder_violations(designDict);
    if (placeholders.length > 0) {
        return _halt_placeholders(state, placeholders);
    }

    if (designDict['design_confirmed'] === true) {
        return new StepResult({ outcome: Outcome.SUCCESS });
    }

    return _halt_unconfirmed(state, designDict);
}

/** True when `design` carries an actionable brief. */
function _is_populated(design: Any): boolean {
    if (!_isDict(design)) return false;
    if (Object.keys(design).length === 0) return false;
    return REQUIRED_BRIEF_KEYS.some((key) => key in design);
}

/** Return required top-level keys that are missing or empty. */
function _missing_required_keys(design: Record<string, Any>): string[] {
    const missing: string[] = [];
    for (const key of REQUIRED_BRIEF_KEYS) {
        const value = design[key];
        if (_isEmptyOrNone(value)) {
            missing.push(key);
            continue;
        }
        if (key === 'states') {
            // A non-object `states` (a string, a list) used to skip the
            // per-state loop entirely, so `states: "n/a"` satisfied the gate
            // without covering a single state. Report every required key
            // instead — the author gets the same actionable list either way.
            if (!_isDict(value)) {
                for (const state_key of REQUIRED_STATE_KEYS) {
                    missing.push(`states.${state_key}`);
                }
                continue;
            }
            for (const state_key of REQUIRED_STATE_KEYS) {
                if (!_pyTruthy(value[state_key])) {
                    missing.push(`states.${state_key}`);
                }
            }
        }
    }
    return missing;
}

/**
 * Return brief paths whose values match a placeholder pattern.
 *
 * Covers `microcopy` **and** `states`. The five required states were checked
 * for truthiness only, so `states.error: "TBD"` satisfied the gate — the brief
 * looked complete while covering nothing. Both slots carry strings the user
 * signs off on, so both are held to the same bar.
 *
 * An explicit `"n/a"` stays legitimate: a static landing page genuinely has no
 * error or disabled state, and *declaring* that is the opposite of inventing
 * filler. That is why the gate demands all five keys rather than branching on
 * page type — the author states the answer instead of the engine guessing which
 * states a surface ought to have.
 */
function _placeholder_violations(design: Record<string, Any>): string[] {
    return [
        ...placeholder_paths(design['microcopy'], 'microcopy'),
        ...placeholder_paths(design['states'], 'states'),
    ];
}

/**
 * Return every path under `node` whose leaf string carries a placeholder.
 *
 * Traverses objects **and arrays**. The array arm is load-bearing, not
 * defensive: a list is the natural shape for the most common microcopy
 * (`nav_items`, `menu`, `steps`) and for a rendered file split into lines,
 * and a walker that recursed into objects only let
 * `{ nav_items: ["Home", "TODO: Link"] }` through both the brief lock and
 * the rendered-output gate.
 *
 * Array elements are addressed `key[i]` so the halt names the exact element
 * the author has to fix, not just the list.
 *
 * Shared by `design` (producer side, on `microcopy`) and `apply` (consumer
 * side, on the rendered envelope). One implementation on purpose: the two
 * call sites previously carried byte-identical copies of the same bug, so
 * duplicating them bought no independence — see
 * `docs/contracts/ui-track-flow.md` § implement → apply.
 */
export function placeholder_paths(node: Any, prefix = ''): string[] {
    const violations: string[] = [];
    _walk_placeholders(node, prefix, violations);
    return violations;
}

function _walk_placeholders(node: Any, prefix: string, violations: string[]): void {
    if (typeof node === 'string') {
        const lowered = node.toLowerCase();
        for (const pattern of PLACEHOLDER_PATTERNS) {
            if (lowered.includes(pattern)) {
                violations.push(prefix);
                return;
            }
        }
        return;
    }
    if (Array.isArray(node)) {
        node.forEach((value, index) => {
            _walk_placeholders(value, `${prefix}[${index}]`, violations);
        });
        return;
    }
    if (_isDict(node)) {
        for (const key of Object.keys(node)) {
            const path = prefix ? `${prefix}.${key}` : String(key);
            _walk_placeholders(node[key], path, violations);
        }
    }
}

/** Render a one-line preview of the input being designed. */
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

/** Halt with an agent directive so the orchestrator runs `ui-design-brief`. */
function _delegate_to_design_skill(state: DeliveryState): StepResult {
    const preview = _preview_input(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive('ui-design-brief'),
            `> Input: ${preview}`,
            '> No design brief yet — producing one now. The brief locks ' +
                'layout, components, states, microcopy, and a11y before any ' +
                'code is written.',
            '> 1. Continue — produce the brief from audit findings',
            '> 2. Abort — drop this UI request',
        ],
        message: 'UI design brief missing; delegating to ui-design-brief skill.',
    });
}

/** BLOCKED halt — brief is missing required keys. */
function _halt_incomplete_brief(state: DeliveryState, missing: string[]): StepResult {
    const preview = _preview_input(state);
    const lines: string[] = [
        agent_directive('ui-design-brief'),
        `> Input: ${preview}`,
        '> Design brief is incomplete. Missing required fields:',
    ];
    for (const p of missing) {
        lines.push(`> - \`${p}\``);
    }
    lines.push(
        '> Re-run the brief skill so every required slot has a final ' +
            'value before apply.',
    );
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: lines,
        message: `UI design brief incomplete; ${missing.length} required field(s) missing.`,
    });
}

/** BLOCKED halt — microcopy still carries placeholder patterns. */
function _halt_placeholders(state: DeliveryState, violations: string[]): StepResult {
    const preview = _preview_input(state);
    const lines: string[] = [
        agent_directive('ui-design-brief'),
        `> Input: ${preview}`,
        '> Microcopy contains placeholder patterns. Apply rejects these ' +
            'verbatim, so they have to be replaced with final strings now:',
    ];
    for (const p of violations) {
        lines.push(`> - \`microcopy.${p}\``);
    }
    lines.push(
        '> Re-run the brief skill with finalised copy; the apply step ' +
            'will write strings exactly as the brief specifies.',
    );
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: lines,
        message:
            `UI design brief carries ${violations.length} placeholder ` +
            'violation(s); halting for finalised microcopy.',
    });
}

/** BLOCKED halt — brief is well-formed; user must sign off. */
function _halt_unconfirmed(state: DeliveryState, design: Record<string, Any>): StepResult {
    const preview = _preview_input(state);
    const components = _pyTruthy(design['components']) ? design['components'] : [];
    const states = _pyTruthy(design['states']) ? design['states'] : {};
    const microcopy = _pyTruthy(design['microcopy']) ? design['microcopy'] : {};

    const component_count = Array.isArray(components) ? components.length : 0;
    const state_count = _isDict(states) ? Object.keys(states).length : 0;
    const microcopy_count = _isDict(microcopy) ? _count_microcopy(microcopy) : 0;

    const lines: string[] = [
        `> Input: ${preview}`,
        '> Design brief is ready. Summary:',
        `> - Components: ${component_count}`,
        `> - States covered: ${state_count}`,
        `> - Microcopy entries (locked): ${microcopy_count}`,
        '> 1. Confirm — lock this brief and advance to apply',
        '> 2. Revise — send feedback; loops back to ui-design-brief',
        '> 3. Abort — drop this UI request',
        '',
        '**Recommendation: 1 — Confirm** — the brief covers all ' +
            'required slots and microcopy is final. Caveat: flip to 2 only if ' +
            'a string, state, or component is wrong; do not confirm strings ' +
            'you have not read.',
    ];
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: lines,
        message: 'UI design brief ready; halting for user confirmation before apply.',
    });
}

/**
 * Count leaf string entries in `microcopy` (recursive, arrays included).
 *
 * The count is shown in the sign-off the user confirms, so it has to agree
 * with what the placeholder walker inspects — an object-only count reported
 * fewer locked strings than were actually locked.
 */
function _count_microcopy(microcopy: Any): number {
    if (typeof microcopy === 'string') return 1;
    if (Array.isArray(microcopy)) {
        return microcopy.reduce((total: number, value) => total + _count_microcopy(value), 0);
    }
    if (_isDict(microcopy)) {
        return Object.values(microcopy).reduce(
            (total: number, value) => total + _count_microcopy(value),
            0,
        );
    }
    return 0;
}

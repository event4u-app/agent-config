/**
 * `apply` step — stack-dispatched UI implementation.
 *
 * TypeScript twin of `directives/ui/apply.py` (ADR-200 py2ts). Public API
 * names stay snake_case to mirror the Python module 1:1.
 *
 * The apply step turns the locked design brief into actual files. Routes on
 * `state.stack.frontend` to the appropriate implementation skill bundle, and
 * on `state.ticket["ui_apply"]` shape: first-pass delegation, placeholder
 * rejection, or change recording. Apply validates the output against the
 * brief's microcopy lock so a mid-loop hallucination is caught at the boundary.
 */
import {
    type Any,
    type DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
} from '../../delivery_state.js';
import { placeholder_paths } from './design.js';
import {
    is_ambiguous_stack,
    bundle_line,
    unsupported_stack_questions,
} from './stack_bundles.js';

/** Map `state.stack.frontend` → agent-directive skill name. */
export const STACK_DIRECTIVES: Record<string, string> = {
    'blade-livewire-flux': 'ui-apply-blade-livewire-flux',
    'blade-livewire': 'ui-apply-blade-livewire',
    filament: 'ui-apply-filament',
    'react-shadcn': 'ui-apply-react-shadcn',
    react: 'ui-apply-react',
    vue: 'ui-apply-vue',
    plain: 'ui-apply-plain',
    // Present so the `keys == KNOWN_STACKS` invariant holds. Never emitted —
    // the step intercepts this lane and refuses instead of dispatching.
    unknown: 'ui-apply-unsupported',
};

/** Fallback directive when `state.stack` is missing or malformed. */
export const DEFAULT_DIRECTIVE = 'ui-apply-plain';

export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [
    {
        code: 'apply_envelope_missing',
        trigger:
            "state.ticket['ui_apply'] unset — first pass, " +
            'stack-specific skill has not run yet',
        resolution:
            'agent directive `ui-apply-<stack>` → skill ' +
            'bundle implements the brief and writes the envelope back',
    },
    {
        code: 'apply_placeholders_in_output',
        trigger:
            'rendered text in apply envelope contains ' +
            'placeholder patterns (<placeholder>, Lorem, TODO:, TBD, XXX) ' +
            '— design-brief lock failed mid-loop',
        resolution:
            'agent re-renders the components with the locked ' +
            'microcopy verbatim from state.ui_design.microcopy',
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

/** Apply the stack-dispatched implementation gate. */
export function run(state: DeliveryState): StepResult {
    const envelope = _apply_envelope(state);
    if (envelope === null) {
        return _delegate_to_stack_skill(state);
    }

    const violations = _placeholder_violations_in_output(envelope);
    if (violations.length > 0) {
        return _halt_placeholders(state, violations);
    }

    _record_changes(state, envelope);
    return new StepResult({ outcome: Outcome.SUCCESS });
}

/** Return the agent-written `ui_apply` envelope, or `null`. */
function _apply_envelope(state: DeliveryState): Record<string, Any> | null {
    const data = _pyTruthy(state.ticket) ? state.ticket : {};
    const envelope = (data as Record<string, Any>)['ui_apply'];
    if (_isDict(envelope) && _pyTruthy(envelope)) {
        return envelope;
    }
    return null;
}

/** Pick the agent directive for the project's frontend stack. */
function _resolve_directive(state: DeliveryState): string {
    const stack = _pyTruthy(state.stack) ? state.stack : {};
    if (_isDict(stack)) {
        const frontend = stack['frontend'];
        if (typeof frontend === 'string' && frontend in STACK_DIRECTIVES) {
            return STACK_DIRECTIVES[frontend] as string;
        }
    }
    return DEFAULT_DIRECTIVE;
}

/**
 * Return paths into `envelope['rendered']` whose text matches a pattern.
 *
 * Delegates to the walker shared with `design`, so the producer-side and
 * consumer-side gates cannot drift apart. They previously held
 * byte-identical copies of the same array-blind recursion, which meant the
 * contract's "defense-in-depth" framing described two layers that failed on
 * exactly the same inputs.
 */
function _placeholder_violations_in_output(envelope: Record<string, Any>): string[] {
    return placeholder_paths(envelope['rendered']);
}

/** First-pass halt — emit the stack-specific apply directive. */
function _delegate_to_stack_skill(state: DeliveryState): StepResult {
    const directive = _resolve_directive(state);
    const stack_label = _stack_label(state);
    if (is_ambiguous_stack(state.stack)) {
        const conflicts = ((state.stack as Record<string, Any>)['ambiguity'] ??
            []) as ReadonlyArray<string>;
        return new StepResult({
            outcome: Outcome.BLOCKED,
            questions: unsupported_stack_questions('apply', conflicts),
            message:
                `UI apply halted: detection is ambiguous (${conflicts.join('; ')}) — ` +
                'the open question is which project to build for.',
        });
    }
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive(directive),
            `> Stack: \`${stack_label}\`. Implementing the locked design brief.`,
            bundle_line(state.stack, 'build', stack_label),
            '> Microcopy is locked — every button label, empty-state ' +
                'message, and validation message must come verbatim from ' +
                '`state.ui_design.microcopy`.',
            '> 1. Continue — implement the brief and write a ' +
                '`ui_apply` envelope back into state.ticket ' +
                '(rendered: {path: text}, files: [...])',
            '> 2. Abort — drop this UI request',
        ],
        message: `UI apply pending; delegating to \`${directive}\` for stack \`${stack_label}\`.`,
    });
}

/** BLOCKED halt — rendered output still carries placeholder patterns. */
function _halt_placeholders(state: DeliveryState, violations: string[]): StepResult {
    const directive = _resolve_directive(state);
    const lines: string[] = [
        agent_directive(directive),
        '> Apply rejected: rendered output contains placeholder strings. ' +
            'The design-brief microcopy lock failed mid-loop.',
        '> Affected paths in `ui_apply.rendered`:',
    ];
    for (const p of violations) {
        lines.push(`> - \`${p}\``);
    }
    lines.push(
        '> Re-render with the locked microcopy verbatim from ' +
            '`state.ui_design.microcopy`; apply will not write placeholder text.',
    );
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: lines,
        message:
            `UI apply rejected: ${violations.length} placeholder ` +
            'violation(s) in rendered output.',
    });
}

/** Append one `state.changes` entry per file in the apply envelope. */
function _record_changes(state: DeliveryState, envelope: Record<string, Any>): void {
    let files = envelope['files'];
    if (!Array.isArray(files)) {
        files = [];
    }
    const summary = _pyTruthy(envelope['summary']) ? envelope['summary'] : 'ui apply';
    const stack_label = _stack_label(state);
    for (const p of files as Any[]) {
        if (typeof p !== 'string' || p === '') {
            continue;
        }
        state.changes.push({
            kind: 'ui',
            stack: stack_label,
            file: p,
            summary: summary,
        });
    }
}

/** Return the frontend stack label, defaulting to `plain`. */
function _stack_label(state: DeliveryState): string {
    const stack = _pyTruthy(state.stack) ? state.stack : {};
    if (_isDict(stack)) {
        const frontend = stack['frontend'];
        if (typeof frontend === 'string' && frontend !== '') {
            return frontend;
        }
    }
    return 'plain';
}

/**
 * `review` step — stack-dispatched design-review pass.
 *
 * TypeScript twin of `directives/ui/review.py` (ADR-094 py2ts). Public API
 * names stay snake_case to mirror the Python module 1:1.
 *
 * The review step compares the rendered components from `apply` against the
 * locked design brief and produces a structured findings list. It does not
 * apply fixes — that is the polish step's job. Review's single output is
 * `state.ui_review` carrying `findings` and `review_clean`.
 */
import {
    type Any,
    type DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
} from '../../delivery_state.js';

/** Map `state.stack.frontend` → agent-directive skill name. */
export const STACK_DIRECTIVES: Record<string, string> = {
    'blade-livewire-flux': 'ui-design-review-blade-livewire-flux',
    'react-shadcn': 'ui-design-review-react-shadcn',
    vue: 'ui-design-review-vue',
    plain: 'ui-design-review-plain',
};

/** Fallback directive when `state.stack` is missing or malformed. */
export const DEFAULT_DIRECTIVE = 'ui-design-review-plain';

/** R4 a11y severity ranking — mirrors axe-core's impact levels. */
export const SEVERITY_ORDER: Record<string, number> = {
    minor: 0,
    moderate: 1,
    serious: 2,
    critical: 3,
};

/** R4 a11y default severity floor. */
export const DEFAULT_SEVERITY_FLOOR = 'moderate';

export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [
    {
        code: 'review_envelope_missing',
        trigger: 'state.ui_review unset / empty — review skill has not run yet',
        resolution:
            'agent directive `ui-design-review-<stack>` → ' +
            'skill compares rendered components against state.ui_design ' +
            'and writes `findings` + `review_clean` back',
    },
    {
        code: 'review_findings_missing',
        trigger: 'state.ui_review populated but `findings` key absent',
        resolution:
            'agent re-runs the review skill with the same ' +
            'directive; review only succeeds once findings is a list',
    },
    {
        code: 'review_clean_missing',
        trigger:
            'state.ui_review.findings is set but review_clean ' +
            'is missing or not a bool — polish needs an explicit flag',
        resolution:
            'agent sets state.ui_review.review_clean to ' +
            'True or False before returning the envelope; review does ' +
            'not infer it from findings count',
    },
    {
        code: 'review_a11y_pending',
        trigger:
            'state.ui_audit declared an `a11y_baseline` but ' +
            'state.ui_review.a11y is missing — the review skill ran but ' +
            'did not produce an a11y envelope',
        resolution:
            'agent re-runs the review skill so it captures ' +
            'axe-core (or equivalent) findings into ' +
            '`state.ui_review.a11y.violations`; the gate then filters ' +
            'against the baseline and the severity floor',
    },
    {
        code: 'preview_render_failed',
        trigger:
            'state.ui_review.preview.render_ok is False — the ' +
            'stack-specific review skill tried to render the changed ' +
            'components and the headless browser reported an error',
        resolution:
            'user picks Retry (re-run the review skill so it ' +
            'renders again), Skip (write `state.ui_review.preview.skipped = ' +
            'true` so the gate stops asking this run), or Abort',
    },
    {
        code: 'preview_render_required',
        trigger:
            'the resolved stack is render-capable (has a rendering ' +
            'review skill) but state.ui_review.preview carries no `render_ok` — ' +
            'render evidence is required, not optional, so a skill cannot claim ' +
            'success without rendering',
        resolution:
            'user picks Render (re-run the review skill so it ' +
            'drives the headless browser and writes ' +
            '`{render_ok, screenshot_path, dom_dump_path}`), Skip (this env ' +
            'cannot render: set `state.ui_review.preview.skipped = true` plus a ' +
            '`skip_reason`), or Abort',
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

/** Apply the design-review gate to `state.ui_review`. */
export function run(state: DeliveryState): StepResult {
    const review = state.ui_review;
    if (!_is_populated(review)) {
        return _delegate_to_review_skill(state);
    }

    const r = review as Record<string, Any>;
    if (!('findings' in r) || !Array.isArray(r['findings'])) {
        return _halt_findings_missing(state);
    }

    const findings = r['findings'] as Any[];
    if (typeof r['review_clean'] !== 'boolean') {
        return _halt_clean_missing(state, findings.length);
    }

    const a11y_halt = _apply_a11y_gate(state, r);
    if (a11y_halt !== null) {
        return a11y_halt;
    }

    const preview_halt = _apply_preview_gate(state, r);
    if (preview_halt !== null) {
        return preview_halt;
    }

    return new StepResult({ outcome: Outcome.SUCCESS });
}

/** True when `review` is a dict with at least one own key. */
function _is_populated(review: Any): boolean {
    return _isDict(review) && Object.keys(review).length > 0;
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

/** First-pass halt — emit the stack-specific review directive. */
function _delegate_to_review_skill(state: DeliveryState): StepResult {
    const directive = _resolve_directive(state);
    const stack_label = _stack_label(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive(directive),
            `> Stack: \`${stack_label}\`. Reviewing rendered components ` +
                'against the locked design brief.',
            '> The review pass compares `state.ticket.ui_apply.rendered` ' +
                'against `state.ui_design` (microcopy, states, a11y, layout) ' +
                'and produces a structured `findings` list.',
            '> Ground chart-type and contrast findings in the adopted ' +
                "corpus (design-intelligence § 'Grounding the review/polish " +
                "a11y gate') — cite the corpus row, don't eyeball.",
            '> 1. Continue — run the review and write ' +
                '`{findings: [...], review_clean: bool}` into ' +
                '`state.ui_review`',
            '> 2. Abort — drop this UI request',
        ],
        message: `UI review pending; delegating to \`${directive}\` for stack \`${stack_label}\`.`,
    });
}

/** BLOCKED halt — envelope present but `findings` slot is unset. */
function _halt_findings_missing(state: DeliveryState): StepResult {
    const directive = _resolve_directive(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive(directive),
            '> Review envelope is partial: `findings` list is missing.',
            '> Re-run the review skill so `state.ui_review.findings` ' +
                'is a list (empty when nothing is wrong).',
        ],
        message: 'UI review envelope incomplete; `findings` missing.',
    });
}

/** BLOCKED halt — `review_clean` is missing or not a bool. */
function _halt_clean_missing(state: DeliveryState, findings_count: number): StepResult {
    const directive = _resolve_directive(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive(directive),
            '> Review envelope is incomplete: `review_clean` is missing ' +
                'or not a boolean.',
            `> Findings count: ${findings_count}. Set ` +
                '`state.ui_review.review_clean` to `True` (no further ' +
                'polish needed) or `False` (polish loop should run).',
        ],
        message: 'UI review envelope incomplete; `review_clean` must be a bool.',
    });
}

/** R4 Phase 1: enforce a11y gate after the basic shape gates pass. */
function _apply_a11y_gate(state: DeliveryState, review: Record<string, Any>): StepResult | null {
    const audit = state.ui_audit;
    const has_baseline = _isDict(audit) && 'a11y_baseline' in audit;
    const a11y = review['a11y'];

    if (a11y === null || a11y === undefined) {
        if (has_baseline) {
            return _halt_a11y_pending(state);
        }
        return null;
    }

    const a11yDict = a11y as Record<string, Any>;
    const violations = _pyTruthy(a11yDict['violations']) ? (a11yDict['violations'] as Any[]) : [];
    const baseline = has_baseline ? ((audit as Record<string, Any>)['a11y_baseline'] as Any[]) : [];
    const accepted = _pyTruthy(a11yDict['accepted_violations'])
        ? (a11yDict['accepted_violations'] as Any[])
        : [];
    const floor = _pyTruthy(a11yDict['severity_floor'])
        ? (a11yDict['severity_floor'] as string)
        : DEFAULT_SEVERITY_FLOOR;

    let new_violations = _filter_known(violations, baseline);
    new_violations = _filter_known(new_violations, accepted);
    const actionable = new_violations.filter((v) => _at_or_above_floor(v, floor));

    if (actionable.length === 0) {
        return null;
    }

    _synthesize_a11y_findings(review['findings'] as Any[], actionable);
    review['review_clean'] = false;
    return null;
}

/** Drop violations whose `(rule, selector)` matches `known`. */
function _filter_known(violations: Any[], known: Any[]): Any[] {
    if (!_pyTruthy(known)) {
        return [...violations];
    }
    const keys = new Set<string>();
    for (const entry of known) {
        if (_isDict(entry)) {
            keys.add(_keyOf(entry['rule'], entry['selector']));
        }
    }
    if (keys.size === 0) {
        return [...violations];
    }
    return violations.filter(
        (v) => !(_isDict(v) && keys.has(_keyOf(v['rule'], v['selector']))),
    );
}

/**
 * Stable, collision-free key for a `(rule, selector)` tuple of arbitrary JSON
 * scalars, mirroring Python tuple-equality in a JS `Set`.
 */
function _keyOf(rule: Any, selector: Any): string {
    return `${_tag(rule)} ${_tag(selector)}`;
}

function _tag(v: Any): string {
    if (v === null || v === undefined) return 'n:';
    if (typeof v === 'boolean') return `b:${v ? '1' : '0'}`;
    if (typeof v === 'number') return `f:${v}`;
    if (typeof v === 'string') return `s:${v}`;
    return `o:${JSON.stringify(v)}`;
}

/** `True` when `violation.severity` is at or above `floor`. */
function _at_or_above_floor(violation: Any, floor: string): boolean {
    if (!_isDict(violation)) {
        return false;
    }
    const severity = violation['severity'];
    const sevKey = typeof severity === 'string' ? severity : '';
    const sev_rank =
        sevKey in SEVERITY_ORDER
            ? (SEVERITY_ORDER[sevKey] as number)
            : (SEVERITY_ORDER[DEFAULT_SEVERITY_FLOOR] as number);
    const floor_rank =
        floor in SEVERITY_ORDER
            ? (SEVERITY_ORDER[floor] as number)
            : (SEVERITY_ORDER[DEFAULT_SEVERITY_FLOOR] as number);
    return sev_rank >= floor_rank;
}

/** Append `a11y_violation` findings, deduped by `(rule, selector)`. */
function _synthesize_a11y_findings(findings: Any[], actionable: Any[]): void {
    const existing = new Set<string>();
    for (const f of findings) {
        if (_isDict(f) && f['kind'] === 'a11y_violation') {
            existing.add(_keyOf(f['rule'], f['selector']));
        }
    }
    for (const v of actionable) {
        if (!_isDict(v)) {
            continue;
        }
        const key = _keyOf(v['rule'], v['selector']);
        if (existing.has(key)) {
            continue;
        }
        findings.push({
            kind: 'a11y_violation',
            rule: v['rule'] ?? null,
            selector: v['selector'] ?? null,
            severity: v['severity'] ?? null,
        });
        existing.add(key);
    }
}

/** BLOCKED halt — audit declared a baseline but review has no a11y. */
function _halt_a11y_pending(state: DeliveryState): StepResult {
    const directive = _resolve_directive(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive(directive),
            '> Review envelope is incomplete: the audit declared an ' +
                '`a11y_baseline` but `state.ui_review.a11y` is missing.',
            '> Re-run the review skill so it captures axe-core (or ' +
                'equivalent) findings into ' +
                '`state.ui_review.a11y.violations`. The gate filters ' +
                'against the baseline and the severity floor ' +
                `(default \`${DEFAULT_SEVERITY_FLOOR}\`).`,
        ],
        message:
            'UI review envelope incomplete; `a11y` envelope missing ' +
            '(audit declared a baseline).',
    });
}

/** R4 Phase 3: validate the visual-preview envelope written by the skill. */
function _apply_preview_gate(state: DeliveryState, review: Record<string, Any>): StepResult | null {
    const raw_preview = review['preview'];
    const preview: Record<string, Any> = _isDict(raw_preview) ? raw_preview : {};
    if (_pyTruthy(preview['skipped'])) {
        return null;
    }
    const render_ok = preview['render_ok'];
    if (render_ok === false) {
        return _halt_preview_failed(state, preview);
    }
    if (render_ok === true) {
        return null;
    }
    // render_ok missing / None — absence is only tolerated for stacks that
    // have no rendering review skill. A render-capable stack must render or
    // explicitly skip; silent success is forbidden.
    if (_is_render_capable(state)) {
        return _halt_preview_required(state);
    }
    return null;
}

/**
 * True when the resolved frontend stack has a rendering review skill.
 *
 * Render-capability is keyed off {@link STACK_DIRECTIVES} — every entry
 * maps to a stack-specific `ui-design-review-<stack>` skill that drives a
 * headless browser (Playwright + axe-core) and writes the `preview`
 * envelope. A missing / unknown frontend falls back to the generic
 * directive but is **not** treated as render-capable: the gate stays a
 * silent no-op for it, so non-rendering stacks/envs are unaffected.
 */
function _is_render_capable(state: DeliveryState): boolean {
    const stack = _pyTruthy(state.stack) ? state.stack : {};
    if (_isDict(stack)) {
        const frontend = stack['frontend'];
        if (typeof frontend === 'string' && frontend in STACK_DIRECTIVES) {
            return true;
        }
    }
    return false;
}

/** BLOCKED halt — render reported failure; user picks the next step. */
function _halt_preview_failed(state: DeliveryState, preview: Record<string, Any>): StepResult {
    const directive = _resolve_directive(state);
    const error = preview['error'];
    const error_line =
        typeof error === 'string' && error !== ''
            ? `> Render error: \`${error}\`.`
            : '> Render error: `(none reported)`.';
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive(directive),
            '> Visual preview failed: ' +
                '`state.ui_review.preview.render_ok` is `False`.',
            error_line,
            '> 1. Retry — re-run the review skill so it renders again ' +
                'and writes a fresh `preview` envelope',
            '> 2. Skip — set `state.ui_review.preview.skipped = true` ' +
                'so this run ships without a screenshot artifact',
            '> 3. Abort — drop this UI request',
        ],
        message: 'UI preview render failed; awaiting user decision.',
    });
}

/**
 * BLOCKED halt — render-capable stack produced no render evidence.
 *
 * A skill that never rendered cannot pass the gate by simply omitting
 * `render_ok`. The agent must render (Option 1) or record an explicit,
 * reasoned skip (Option 2) — the only way a render-capable stack ships
 * without a screenshot artifact.
 */
function _halt_preview_required(state: DeliveryState): StepResult {
    const directive = _resolve_directive(state);
    const stack_label = _stack_label(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive(directive),
            `> Stack \`${stack_label}\` is render-capable but ` +
                '`state.ui_review.preview.render_ok` is absent — render evidence ' +
                'is required, not optional.',
            '> 1. Render — re-run the review skill so it drives the ' +
                'headless browser (Playwright + axe-core) and writes ' +
                '`{render_ok, screenshot_path, dom_dump_path}` into ' +
                '`state.ui_review.preview`',
            '> 2. Skip — this env cannot render: set ' +
                '`state.ui_review.preview.skipped = true` plus a ' +
                '`state.ui_review.preview.skip_reason` (e.g. no Playwright ' +
                'runner) so the gate honours an explicit, reasoned skip',
            '> 3. Abort — drop this UI request',
        ],
        message:
            `UI render evidence required for render-capable stack ` +
            `\`${stack_label}\`; awaiting render or explicit skip.`,
    });
}

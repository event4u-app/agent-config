/**
 * `polish` step — bounded fix loop for review findings.
 *
 * TypeScript twin of `directives/ui/polish.py` (ADR-094 py2ts). Public API
 * names stay snake_case to mirror the Python module 1:1.
 *
 * The polish step drives the fix loop after `review` produces findings. The
 * loop is hard-capped at two rounds (extendable by one for a11y); anything the
 * agent cannot fix goes back to the user as a ship-as-is / abort decision.
 */
import {
    type Any,
    type DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
} from '../../delivery_state.js';

/** Maximum number of polish rounds per `/work` run. */
export const POLISH_CEILING = 2;

/** Marker on a review finding that flags an a11y issue. */
export const A11Y_VIOLATION_KIND = 'a11y_violation';

/** Marker on a review finding that flags a hardcoded design value. */
export const TOKEN_VIOLATION_KIND = 'token_violation';

/** Repeat count above which an unmatched value triggers the extraction halt. */
export const TOKEN_REPEAT_THRESHOLD = 2;

/** Map `state.stack.frontend` → agent-directive skill name. */
export const STACK_DIRECTIVES: Record<string, string> = {
    'blade-livewire-flux': 'ui-polish-blade-livewire-flux',
    'react-shadcn': 'ui-polish-react-shadcn',
    vue: 'ui-polish-vue',
    plain: 'ui-polish-plain',
};

/** Fallback directive when `state.stack` is missing or malformed. */
export const DEFAULT_DIRECTIVE = 'ui-polish-plain';

export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [
    {
        code: 'polish_round_pending',
        trigger:
            'state.ui_review.review_clean is False and ' +
            'state.ui_polish.rounds < 2 — fixes have not yet been applied ' +
            'for the current findings',
        resolution:
            'agent directive `ui-polish-<stack>` → skill ' +
            'applies fixes, re-runs the review, increments ' +
            'state.ui_polish.rounds',
    },
    {
        code: 'polish_ceiling_reached',
        trigger:
            'state.ui_polish.rounds == ceiling and remaining ' +
            'findings are non-a11y (subjective polish that did not ' +
            'converge) — a11y blocks take precedence via ' +
            'polish_a11y_blocking',
        resolution:
            'user picks: ship as-is, abort, or hand off to ' +
            'manual fix; engine refuses to start another round',
    },
    {
        code: 'polish_a11y_blocking',
        trigger:
            'state.ui_polish.rounds == ceiling and ' +
            'state.ui_review.findings still contains a11y_violation ' +
            'entries — objective gate that takes precedence over the ' +
            'subjective polish_ceiling_reached halt',
        resolution:
            'user picks: extend by one round (engine sets ' +
            'state.ui_polish.extension_used=True so the next round can ' +
            'fire), accept-with-known-violations (engine appends the ' +
            'leftover violations to state.ui_review.a11y.accepted_violations ' +
            'so the review gate stops blocking on them), or abort the ' +
            'UI request',
    },
    {
        code: 'polish_token_extraction_pending',
        trigger:
            'state.ui_review.findings has token_violation entries ' +
            'whose value repeats >2 times and has no match in ' +
            'state.ui_audit.design_tokens',
        resolution:
            'user picks: extract as a new token (agent adds ' +
            'it to state.ui_audit.design_tokens.<category>), inline (agent ' +
            'drops the token_violation findings before re-entering polish), ' +
            'or abort the UI request',
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

/** Apply the polish-loop gate. */
export function run(state: DeliveryState): StepResult {
    const review = _pyTruthy(state.ui_review) ? (state.ui_review as Record<string, Any>) : {};
    let findings = 'findings' in review ? review['findings'] : [];
    if (!Array.isArray(findings)) {
        findings = [];
    }
    const review_clean = _pyTruthy(review['review_clean']);

    if (review_clean || (findings as Any[]).length === 0) {
        return new StepResult({ outcome: Outcome.SUCCESS });
    }

    const polish = _pyTruthy(state.ui_polish) ? (state.ui_polish as Record<string, Any>) : {};
    let rounds = 'rounds' in polish ? polish['rounds'] : 0;
    // `not isinstance(rounds, int) or isinstance(rounds, bool)` → reset to 0.
    if (typeof rounds !== 'number' || !Number.isInteger(rounds) || typeof rounds === 'boolean') {
        rounds = 0;
    }
    const extension_used = _pyTruthy(polish['extension_used']);
    const effective_ceiling = POLISH_CEILING + (extension_used ? 1 : 0);

    const findingsArr = findings as Any[];
    if ((rounds as number) >= effective_ceiling) {
        const a11y_findings = _a11y_findings(findingsArr);
        if (a11y_findings.length > 0) {
            return _halt_a11y_blocking(state, a11y_findings, rounds as number, !extension_used);
        }
        return _halt_ceiling(state, findingsArr.length, rounds as number, effective_ceiling);
    }

    const tokens = _design_tokens(state);
    const [matched, unmatched_repeats] = _classify_token_violations(findingsArr, tokens);
    if (unmatched_repeats.length > 0) {
        return _halt_token_extraction(state, unmatched_repeats);
    }

    return _delegate_to_polish_skill(
        state,
        findingsArr.length,
        matched.length,
        rounds as number,
        effective_ceiling,
    );
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

/** BLOCKED halt — emit the stack-specific polish directive. */
function _delegate_to_polish_skill(
    state: DeliveryState,
    findings_count: number,
    matched_token_count: number,
    rounds: number,
    ceiling: number,
): StepResult {
    const directive = _resolve_directive(state);
    const stack_label = _stack_label(state);
    const next_round = rounds + 1;
    let findings_line =
        `> ${findings_count} finding(s) from \`state.ui_review\`. ` +
        'Apply each fix, re-run the review, and write the refreshed ' +
        'envelope back.';
    if (matched_token_count) {
        findings_line =
            `> ${findings_count} finding(s) from \`state.ui_review\` ` +
            `(${matched_token_count} token-violation match(es) ` +
            'auto-convert against `state.ui_audit.design_tokens`). ' +
            'Apply each fix, re-run the review, and write the refreshed ' +
            'envelope back.';
    }
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive(directive),
            `> Stack: \`${stack_label}\`. Polish round ${next_round} of ${ceiling}.`,
            findings_line,
            '> Fix chart-type / contrast findings against the adopted ' +
                "corpus rows (design-intelligence § 'Grounding the " +
                "review/polish a11y gate'), not ad-hoc judgment.",
            '> 1. Continue — apply fixes, re-review, and increment ' +
                '`state.ui_polish.rounds`',
            '> 2. Abort — drop this UI request',
        ],
        message:
            `UI polish round ${next_round}/${ceiling}; delegating ` +
            `to \`${directive}\` for stack \`${stack_label}\`.`,
    });
}

/** BLOCKED halt — ceiling reached on subjective (non-a11y) findings. */
function _halt_ceiling(
    state: DeliveryState,
    findings_count: number,
    rounds: number,
    ceiling: number,
): StepResult {
    const stack_label = _stack_label(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            `> Stack: \`${stack_label}\`. Polish ceiling reached ` +
                `(${rounds}/${ceiling} rounds).`,
            `> ${findings_count} finding(s) still open in ` +
                '`state.ui_review`. The engine refuses a third round.',
            '> 1. Ship as-is — mark `state.ui_review.review_clean ' +
                '= True` and continue to `report` (the open findings stay ' +
                'in the delivery report)',
            '> 2. Abort — drop this UI request',
            '> 3. Hand off — a human picks up the remaining ' +
                'findings outside the engine; re-invoke `/work` only after ' +
                'they are resolved',
            '',
            '**Recommendation: 3 — Hand off** — two automated ' +
                'rounds failed to converge. Caveat: pick 1 only when the ' +
                'remaining findings are explicitly acceptable (low-priority ' +
                'polish, deferred to a follow-up).',
        ],
        message:
            `UI polish ceiling reached (${rounds}/${ceiling}); ` +
            `${findings_count} finding(s) still open.`,
    });
}

/** Return the subset of `findings` synthesised by the a11y gate. */
function _a11y_findings(findings: Any[]): Record<string, Any>[] {
    return findings.filter(
        (f): f is Record<string, Any> => _isDict(f) && f['kind'] === A11Y_VIOLATION_KIND,
    );
}

/** BLOCKED halt — ceiling reached with actionable a11y findings. */
function _halt_a11y_blocking(
    state: DeliveryState,
    a11y_findings: Record<string, Any>[],
    rounds: number,
    extension_available: boolean,
): StepResult {
    const stack_label = _stack_label(state);
    const count = a11y_findings.length;
    const questions: string[] = [
        `> Stack: \`${stack_label}\`. Polish ceiling reached ` +
            `(${rounds}/${POLISH_CEILING} rounds) with ${count} a11y ` +
            'violation(s) still open.',
    ];
    for (const finding of a11y_findings.slice(0, 5)) {
        const rule = _pyTruthy(finding['rule']) ? finding['rule'] : '?';
        const selector = _pyTruthy(finding['selector']) ? finding['selector'] : '?';
        const severity = _pyTruthy(finding['severity']) ? finding['severity'] : '?';
        questions.push(`> - \`${pyStr(rule)}\` on \`${pyStr(selector)}\` (severity: ${pyStr(severity)})`);
    }
    if (count > 5) {
        questions.push(`> ... and ${count - 5} more`);
    }
    if (extension_available) {
        questions.push(
            '> 1. Extend — grant one extra polish round; the ' +
                'engine sets `state.ui_polish.extension_used = True` so ' +
                'the next delegation can fire',
            '> 2. Accept — append the open violations to ' +
                '`state.ui_review.a11y.accepted_violations` so the review ' +
                'gate stops blocking on them, then continue to `report`',
            '> 3. Abort — drop this UI request',
            '',
            '**Recommendation: 1 — Extend** — a11y ' +
                'violations are objective; one more round usually closes ' +
                'the gap. Pick 2 only when the violations are explicitly ' +
                'out of scope for this run.',
        );
    } else {
        questions.push(
            '> 1. Accept — append the open violations to ' +
                '`state.ui_review.a11y.accepted_violations` so the review ' +
                'gate stops blocking on them, then continue to `report`',
            '> 2. Abort — drop this UI request',
            '',
            '**Recommendation: 1 — Accept** — the one-shot ' +
                'extension is already spent; either accept the residual ' +
                'violations or abort.',
        );
    }
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions,
        message:
            `UI polish ceiling reached (${rounds}/${POLISH_CEILING}); ` +
            `${count} a11y violation(s) still open.`,
    });
}

/** Return `state.ui_audit.design_tokens` as a dict, or `{}`. */
function _design_tokens(state: DeliveryState): Record<string, Any> {
    const audit = _pyTruthy(state.ui_audit) ? state.ui_audit : {};
    if (!_isDict(audit)) {
        return {};
    }
    const tokens = _pyTruthy(audit['design_tokens']) ? audit['design_tokens'] : {};
    if (!_isDict(tokens)) {
        return {};
    }
    return tokens;
}

/** Split `token_violation` findings into matched / unmatched-repeats. */
function _classify_token_violations(
    findings: Any[],
    tokens: Record<string, Any>,
): [Record<string, Any>[], Record<string, Any>[]] {
    const matched: Record<string, Any>[] = [];
    // Insertion-ordered map keyed by `${category} ${value}` to mirror the
    // Python `dict[tuple[str, str], int]` insertion order.
    const unmatched_counts = new Map<string, { category: string; value: string; count: number }>();
    for (const finding of findings) {
        if (!_isDict(finding)) {
            continue;
        }
        if (finding['kind'] !== TOKEN_VIOLATION_KIND) {
            continue;
        }
        const category = finding['category'];
        const value = finding['value'];
        if (typeof category !== 'string' || typeof value !== 'string') {
            continue;
        }
        const bucket = tokens[category];
        if (_isDict(bucket) && Object.values(bucket).includes(value)) {
            matched.push(finding);
            continue;
        }
        const key = `${category} ${value}`;
        const existing = unmatched_counts.get(key);
        if (existing) {
            existing.count += 1;
        } else {
            unmatched_counts.set(key, { category, value, count: 1 });
        }
    }
    const repeats: Record<string, Any>[] = [];
    for (const { category, value, count } of unmatched_counts.values()) {
        if (count > TOKEN_REPEAT_THRESHOLD) {
            repeats.push({ category, value, count });
        }
    }
    return [matched, repeats];
}

/** Build a suggested CSS-custom-property name for an extraction halt. */
function _suggest_token_name(category: string, value: string): string {
    let safe = '';
    for (const c of value) {
        safe += _isAlnum(c) ? c : '-';
    }
    safe = _pyStripChar(safe, '-').toLowerCase();
    if (safe === '') {
        safe = 'value';
    }
    const base = _pyRStripChar(category, 's') || category;
    return [...`${base}-${safe}`].slice(0, 40).join('');
}

/** BLOCKED halt — repeated hardcoded value(s) without a matching token. */
function _halt_token_extraction(
    state: DeliveryState,
    repeats: Record<string, Any>[],
): StepResult {
    const stack_label = _stack_label(state);
    const questions: string[] = [
        `> Stack: \`${stack_label}\`. ${repeats.length} hardcoded value(s) ` +
            `appear >${TOKEN_REPEAT_THRESHOLD} times without a matching ` +
            'entry in `state.ui_audit.design_tokens`.',
    ];
    for (const repeat of repeats) {
        const suggested = _suggest_token_name(repeat['category'] as string, repeat['value'] as string);
        questions.push(
            `> - \`${pyStr(repeat['value'])}\` ` +
                `(${pyStr(repeat['category'])}, ${pyStr(repeat['count'])}×) ` +
                `— suggested name: \`--${suggested}\``,
        );
    }
    questions.push(
        '> 1. Extract as design token(s) — add to ' +
            '`state.ui_audit.design_tokens.<category>` and re-enter polish; ' +
            'matching findings auto-convert next round',
        '> 2. Inline — keep the hardcoded value(s) for this run; ' +
            'drop the token_violation findings from ' +
            '`state.ui_review.findings` before re-entering polish',
        '> 3. Abort — drop this UI request',
        '',
        '**Recommendation: 1 — Extract** — a value used ' +
            `>${TOKEN_REPEAT_THRESHOLD} times is a de-facto token; ` +
            'promoting it now keeps the design system honest. Pick 2 only ' +
            'when the value is intentionally one-off.',
    );
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions,
        message:
            `UI polish paused; ${repeats.length} hardcoded value(s) ` +
            'repeat without a matching design token.',
    });
}

// ── Python string helpers ───────────────────────────────────────────────

function pyStr(value: Any): string {
    if (value === null || value === undefined) return 'None';
    if (value === true) return 'True';
    if (value === false) return 'False';
    return String(value);
}

/** Python `str.isalnum()` for a single code point (Unicode-aware). */
function _isAlnum(ch: string): boolean {
    // Python: alphanumeric = letters (incl. Unicode) or any numeric character.
    // \p{L} (letters), \p{N} (numbers) cover str.isalnum for single chars.
    return /[\p{L}\p{N}]/u.test(ch);
}

/** Python `str.strip(chars)` — strip the given chars from both ends. */
function _pyStripChar(s: string, ch: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && s[start] === ch) start += 1;
    while (end > start && s[end - 1] === ch) end -= 1;
    return s.slice(start, end);
}

/** Python `str.rstrip(chars)` — strip the given chars from the right. */
function _pyRStripChar(s: string, ch: string): string {
    let end = s.length;
    while (end > 0 && s[end - 1] === ch) end -= 1;
    return s.slice(0, end);
}

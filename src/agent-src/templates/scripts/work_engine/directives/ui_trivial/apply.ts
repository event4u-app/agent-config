/**
 * `apply` step — single-file edit path for the `ui-trivial` set.
 *
 * TypeScript twin of `directives/ui_trivial/apply.py` (ADR-096 py2ts).
 * Public API names stay snake_case to mirror the Python module 1:1.
 *
 * The short-circuit path for micro UI edits that provably cannot warrant the
 * full audit / design / review / polish loop. Hard preconditions enforced on
 * every rebound: ≤ 1 file, ≤ 5 changed lines, no new component, no new state,
 * no new dependency. Any precondition violation BLOCKS with a
 * `reclassify-to-ui-improve` halt; the orchestrator promotes
 * `state.directive_set` to `"ui-improve"` and re-invokes the engine.
 */
import {
    type Any,
    type DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
} from '../../delivery_state.js';

/** Edit-surface ceiling — single-file edits only. */
export const MAX_FILES = 1;

/** Changed-line ceiling — anything larger is structural, not trivial. */
export const MAX_LINES_CHANGED = 5;

export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [
    {
        code: 'trivial_envelope_missing',
        trigger: "state.ticket['trivial_edit'] unset — first pass",
        resolution:
            'agent directive `trivial-apply` → agent performs ' +
            'the single-file edit and writes the envelope back',
    },
    {
        code: 'trivial_preconditions_violated',
        trigger: 'edit touches >1 file, >5 lines, adds component/state/dependency',
        resolution:
            'agent directive `reclassify-to-ui-improve` → ' +
            "orchestrator promotes directive_set='ui-improve' and re-runs " +
            'through the full audit gate',
    },
];

function _isDict(value: Any): value is Record<string, Any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Python truthiness for the values reached here. */
function _pyTruthy(value: Any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.length > 0;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
}

/**
 * Python `int(x)` for the values that reach the precondition check. Mirrors
 * CPython semantics for the shapes JSON produces:
 *
 * - `bool` → 0 / 1.
 * - integer-valued / fractional `float` → truncate toward zero.
 * - `str` → parse a base-10 integer literal (optional sign, surrounding
 *   whitespace allowed); a non-integer string raises `ValueError`.
 * - `None` / arrays / objects → `TypeError`.
 *
 * Returns the int on success, or the sentinel `null` to mirror the
 * `except (TypeError, ValueError)` branch in the source.
 */
function _pyInt(value: Any): number | null {
    if (typeof value === 'boolean') {
        return value ? 1 : 0;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            return null; // int(inf)/int(nan) → ValueError/OverflowError
        }
        return Math.trunc(value);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        // Python int() accepts an optional sign + digits + optional `_`
        // separators between digits. The inputs here are plain integers; match
        // the common case and reject anything else.
        if (/^[+-]?[0-9]+$/.test(trimmed)) {
            return Number(trimmed);
        }
        return null;
    }
    return null;
}

/** Apply the trivial-edit gate. */
export function run(state: DeliveryState): StepResult {
    const envelope = _trivial_envelope(state);
    if (envelope === null) {
        return _delegate_to_agent(state);
    }

    const violations = _check_preconditions(envelope);
    if (violations.length > 0) {
        return _halt_reclassify(state, violations);
    }

    _record_change(state, envelope);
    return new StepResult({ outcome: Outcome.SUCCESS });
}

/** Return the agent-written `trivial_edit` envelope, or `null`. */
function _trivial_envelope(state: DeliveryState): Record<string, Any> | null {
    const data = _pyTruthy(state.ticket) ? state.ticket : {};
    const envelope = (data as Record<string, Any>)['trivial_edit'];
    if (_isDict(envelope) && _pyTruthy(envelope)) {
        return envelope;
    }
    return null;
}

/** Return a list of violation codes; empty when all preconditions pass. */
function _check_preconditions(envelope: Record<string, Any>): string[] {
    const violations: string[] = [];

    const files = envelope['files'];
    if (!Array.isArray(files) || files.length === 0) {
        violations.push('files_missing');
    } else if (files.length > MAX_FILES) {
        violations.push(`files_exceeded:${files.length}>${MAX_FILES}`);
    }

    const lines = envelope['lines_changed'];
    const lines_int = _pyInt(lines);
    if (lines_int === null) {
        violations.push('lines_changed_missing');
    } else {
        if (lines_int > MAX_LINES_CHANGED) {
            violations.push(`lines_exceeded:${lines_int}>${MAX_LINES_CHANGED}`);
        }
        if (lines_int < 0) {
            violations.push('lines_changed_negative');
        }
    }

    if (_pyTruthy(envelope['new_component'])) {
        violations.push('new_component');
    }
    if (_pyTruthy(envelope['new_state'])) {
        violations.push('new_state');
    }
    if (_pyTruthy(envelope['new_dependency'])) {
        violations.push('new_dependency');
    }

    return violations;
}

/** First-pass halt — delegate to the agent for the single-file edit. */
function _delegate_to_agent(state: DeliveryState): StepResult {
    void state;
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive('trivial-apply'),
            '> Trivial UI edit path — audit / design / review skipped.',
            '> 1. Continue — perform the single-file edit, then ' +
                'write a `trivial_edit` envelope back into state.ticket ' +
                '(files, lines_changed, new_component, new_state, new_dependency)',
            '> 2. Abort — drop this trivial edit',
        ],
        message: 'Trivial UI edit pending; delegating to agent for single-file edit.',
    });
}

/** BLOCKED halt — orchestrator must reclassify to `ui-improve`. */
function _halt_reclassify(state: DeliveryState, violations: string[]): StepResult {
    state.ticket['__reclassify_to__'] = 'ui-improve';
    delete state.ticket['trivial_edit'];
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive('reclassify-to-ui-improve'),
            '> Trivial-edit preconditions violated; this work needs the ' +
                'full audit gate.',
            `> Violations: ${violations.join(', ')}.`,
            '> 1. Reclassify — orchestrator sets ' +
                '`state.directive_set = "ui-improve"` and re-runs the engine',
            '> 2. Abort — drop this UI request',
        ],
        message:
            'Trivial-edit preconditions failed ' +
            `(${violations.join(', ')}); reclassification required.`,
    });
}

/** Write a single `state.changes` entry summarising the trivial edit. */
function _record_change(state: DeliveryState, envelope: Record<string, Any>): void {
    const filesRaw = envelope['files'];
    const files = _pyTruthy(filesRaw) ? filesRaw : [];
    const lines = 'lines_changed' in envelope ? envelope['lines_changed'] : 0;
    const summaryRaw = envelope['summary'];
    const summary = _pyTruthy(summaryRaw) ? summaryRaw : 'trivial UI edit';
    // `_record_change` only runs after preconditions pass, so `files` is a
    // non-empty list here; mirror Python `list(files)` with a shallow copy.
    state.changes.push({
        kind: 'ui-trivial',
        files: [...(files as Any[])],
        lines_changed: lines,
        summary: summary,
    });
}

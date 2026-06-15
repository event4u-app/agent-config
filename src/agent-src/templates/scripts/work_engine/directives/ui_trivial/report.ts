/**
 * `report` step — one-line delivery summary for the trivial path.
 *
 * TypeScript twin of `directives/ui_trivial/report.py` (ADR-200 py2ts).
 * Public API names stay snake_case to mirror the Python module 1:1.
 *
 * The trivial summary captures what the operator needs: which file, how many
 * lines, what the edit did, and the smoke verdict. The step is pure and
 * deterministic: reads `DeliveryState`, writes `state.report`, always returns
 * `SUCCESS`.
 */
import {
    type Any,
    type DeliveryState,
    Outcome,
    StepResult,
} from '../../delivery_state.js';

/** Pure render — no blocked paths. */
export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [];

/**
 * Python truthiness for the values reached here: empty string / empty array /
 * empty object / 0 / false / null / undefined are falsy.
 */
function _pyTruthy(value: Any): boolean {
    if (value === null || value === undefined) {
        return false;
    }
    if (typeof value === 'string') {
        return value.length > 0;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value).length > 0;
    }
    return true;
}

/** Python `str(value)` for the `{lines}` interpolation. */
function pyStr(value: Any): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (value === true) {
        return 'True';
    }
    if (value === false) {
        return 'False';
    }
    return String(value);
}

function _isDict(value: Any): value is Record<string, Any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Render the one-line trivial summary into `state.report`. */
export function run(state: DeliveryState): StepResult {
    state.report = _render(state);
    return new StepResult({ outcome: Outcome.SUCCESS });
}

function _render(state: DeliveryState): string {
    const change = _last_trivial_change(state);
    if (change === null) {
        return '_(trivial UI edit — no change recorded)_';
    }

    const filesRaw = change['files'];
    const files = _pyTruthy(filesRaw) ? filesRaw : [];
    const lines = 'lines_changed' in change ? change['lines_changed'] : 0;
    const summaryRaw = change['summary'];
    const summary = (_pyTruthy(summaryRaw) ? String(summaryRaw) : 'trivial UI edit').trim();
    const file_str =
        Array.isArray(files) && files.length === 1
            ? pyStr((files as Any[])[0])
            : `${Array.isArray(files) ? files.length : 0} files`;
    const verdict = _smoke_verdict(state);
    const verdict_str = verdict ? ` — smoke: **${verdict}**` : '';
    return `**Trivial edit:** ${summary} (\`${file_str}\`, ${pyStr(lines)} lines)${verdict_str}`;
}

function _last_trivial_change(state: DeliveryState): Record<string, Any> | null {
    const changes = _pyTruthy(state.changes) ? state.changes : [];
    for (let i = changes.length - 1; i >= 0; i -= 1) {
        const change = changes[i];
        if (_isDict(change) && change['kind'] === 'ui-trivial') {
            return change;
        }
    }
    return null;
}

function _smoke_verdict(state: DeliveryState): string {
    const tests = state.tests;
    if (_isDict(tests)) {
        const verdict = tests['verdict'];
        if (typeof verdict === 'string') {
            return verdict;
        }
    }
    return '';
}

/**
 * `refine` step — intent gate for the `ui-trivial` directive set.
 *
 * TypeScript twin of `directives/ui_trivial/refine.py` (ADR-200 py2ts).
 * Public API names stay snake_case to mirror the Python module 1:1.
 *
 * `ui-trivial` is reachable only when the intent classifier (or an explicit
 * user override) labelled the work as `ui-trivial`. Reaching this slot through
 * any other route is a routing error, not a user-facing ambiguity.
 *
 * The handler is deterministic and tiny: confirm the ticket carries the
 * expected intent label (or accept the default when `directive_set` is already
 * pinned), and return `SUCCESS`.
 */
import {
    type Any,
    type DeliveryState,
    Outcome,
    StepResult,
} from '../../delivery_state.js';

/** Intent label that gates entry into this directive set. */
export const EXPECTED_INTENT = 'ui-trivial';

export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [
    {
        code: 'wrong_intent_for_trivial',
        trigger:
            "state.ticket['intent'] is set and not equal to 'ui-trivial' " +
            '— routing landed on this set by mistake',
        resolution:
            'abort and re-run with the correct directive_set ' +
            "(populate_routing should select 'ui' or 'backend' instead)",
    },
];

/**
 * Python `repr()` for the scalar/JSON value kinds that reach the `{intent!r}`
 * interpolation. Mirrors CPython: `None`, `True`/`False`, single-quoted
 * strings (double-quoted only when the string contains a single quote and no
 * double quote), numbers and everything else via `str`.
 */
function pyRepr(value: Any): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (value === true) {
        return 'True';
    }
    if (value === false) {
        return 'False';
    }
    if (typeof value === 'string') {
        return pyStrRepr(value);
    }
    return String(value);
}

/** Python `str(value)` for the scalar kinds reaching the `{intent}` slot. */
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

function pyStrRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let body = '';
    for (const ch of s) {
        if (ch === '\\') {
            body += '\\\\';
        } else if (ch === quote) {
            body += `\\${ch}`;
        } else if (ch === '\n') {
            body += '\\n';
        } else if (ch === '\r') {
            body += '\\r';
        } else if (ch === '\t') {
            body += '\\t';
        } else {
            body += ch;
        }
    }
    return `${quote}${body}${quote}`;
}

/**
 * Confirm the ticket's intent matches the trivial path.
 *
 * The ticket's `intent` is optional on v0 callers; absence is treated as a
 * silent pass since the v0 path predates intent classification. v1 callers
 * always carry an intent — a mismatch means the dispatcher routed incorrectly
 * and we halt loudly so the wiring bug surfaces before any edit happens.
 */
export function run(state: DeliveryState): StepResult {
    const ticket = state.ticket ?? {};
    const intent = ticket['intent'];
    if (intent === undefined || intent === null || intent === EXPECTED_INTENT) {
        return new StepResult({ outcome: Outcome.SUCCESS });
    }

    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            '> Routing error — the ``ui-trivial`` directive set was ' +
                "selected but the ticket's intent is `" +
                pyStr(intent) +
                '`.',
            '> 1. Reclassify — set `state.directive_set` from the ' +
                'intent label and re-invoke the engine',
            '> 2. Abort — drop this run',
        ],
        message:
            `intent=${pyRepr(intent)} but directive_set='ui-trivial'; ` +
            'routing must be reclassified before any edit',
    });
}

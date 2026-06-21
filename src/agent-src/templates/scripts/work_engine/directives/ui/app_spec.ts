/**
 * `app_spec` step — greenfield grounding gate (the `memory` slot).
 *
 * TypeScript twin of `directives/ui/app_spec.py` (ADR-200 py2ts). Public API
 * names stay snake_case to mirror the Python module 1:1.
 *
 * greenfield-scaffold Phase 2: before any scaffolding, derive the app shape and
 * confirm it fast (disambiguation, not BDUF). The step occupies the UI set's
 * `memory` slot, which runs **before** `analyze` (design); it replaces the
 * former no-op pass-through there.
 *
 * The gate is **scoped to the greenfield-scaffold path only**. It acts only
 * when `state.ui_audit` records `greenfield == True` and
 * `greenfield_decision == "scaffold"`. Every other UI flow sees this slot as a
 * clean `SUCCESS` no-op, so those flows stay byte-identical.
 */
import {
    type Any,
    type DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
} from '../../delivery_state.js';

/** Declared ambiguity surfaces for this step. */
export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [
    {
        code: 'app_spec_missing',
        trigger:
            'greenfield scaffold path and state.app_spec is None / ' +
            'empty / carries no `pages` — the app-spec skill has not derived ' +
            'the page-set yet',
        resolution:
            'agent directive `app-spec` → skill derives ' +
            '{pages, entity_model, flow_map} and writes them into ' +
            'state.app_spec (or the user bypasses with \'just scaffold\')',
    },
    {
        code: 'app_spec_unconfirmed',
        trigger:
            'greenfield scaffold path and state.app_spec carries a ' +
            'derived page-set but `confirmed` is not True and `bypassed` is ' +
            'not set — the user has not signed off on the derived shape',
        resolution:
            'user confirms the derived page-set + entity model ' +
            '(agent sets state.app_spec.confirmed = True), edits and re-runs, ' +
            'or bypasses (\'just scaffold\' → state.app_spec.bypassed = True)',
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

/**
 * Apply the greenfield app-spec grounding gate.
 *
 * No-op `SUCCESS` for every non-greenfield-scaffold flow; the confirm/bypass
 * gate only engages when the audit recorded a `scaffold` greenfield decision.
 */
export function run(state: DeliveryState): StepResult {
    if (!_is_greenfield_scaffold(state)) {
        return new StepResult({ outcome: Outcome.SUCCESS });
    }

    const spec = state.app_spec;

    // Explicit bypass — "just scaffold" / fenced step. Honoured before any
    // populated-check so the user can skip derivation entirely.
    if (_isDict(spec) && _pyTruthy(spec['bypassed'])) {
        return new StepResult({ outcome: Outcome.SUCCESS });
    }

    if (!_is_populated(spec)) {
        return _delegate_to_app_spec_skill(state);
    }

    const specDict = spec as Record<string, Any>;
    // Idempotent: a confirmed spec round-trips through SUCCESS without
    // re-emitting the halt the user already answered.
    if (specDict['confirmed'] === true) {
        return new StepResult({ outcome: Outcome.SUCCESS });
    }

    return _halt_unconfirmed(state, specDict);
}

/**
 * True when the audit recorded a `scaffold` greenfield decision.
 *
 * The gate is inert for every other flow: improve-existing, the `bare` /
 * `external_reference` greenfield picks, and the `diff` / `file` envelopes all
 * leave `ui_audit` without the `greenfield == True` +
 * `greenfield_decision == "scaffold"` pair.
 */
function _is_greenfield_scaffold(state: DeliveryState): boolean {
    const audit = state.ui_audit;
    if (!_isDict(audit)) return false;
    return (
        audit['greenfield'] === true &&
        audit['greenfield_decision'] === 'scaffold'
    );
}

/**
 * True when `spec` carries a derived page-set.
 *
 * Non-dict and empty-dict shapes are treated as "skill has not run". The
 * skill's first deliverable is the `pages` list, so its presence is the
 * populated signal.
 */
function _is_populated(spec: Any): boolean {
    return _isDict(spec) && Array.isArray(spec['pages']);
}

/** Render a one-line preview of the input being grounded. */
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

/** First-pass halt — emit the `app-spec` derivation directive. */
function _delegate_to_app_spec_skill(state: DeliveryState): StepResult {
    const preview = _preview_input(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive('app-spec'),
            `> Input: ${preview}`,
            '> Greenfield scaffold — grounding the app shape before any ' +
                'skeleton is planned. Derive the page-set, entity model, and ' +
                'flow-map from the prompt.',
            '> 1. Continue — derive {pages, entity_model, flow_map} ' +
                'into `state.app_spec`',
            '> 2. Just scaffold — skip the app spec (set ' +
                '`state.app_spec.bypassed = true` and go straight to scaffold)',
            '> 3. Abort — drop this UI request',
            '',
            '**Recommendation: 1 — derive the spec** — a ' +
                'confirmed page-set keeps the multi-page scaffold coherent ' +
                'and is seconds of work. Caveat: flip to 2 if the prompt ' +
                'already pins an exact, single-screen shape.',
        ],
        message:
            'Greenfield app-spec missing; delegating to `app-spec` ' +
            'skill to derive the page-set before scaffold.',
    });
}

/** BLOCKED halt — derived spec needs the lightweight confirm or bypass. */
function _halt_unconfirmed(state: DeliveryState, spec: Record<string, Any>): StepResult {
    const rawPages = Array.isArray(spec['pages']) ? (spec['pages'] as Any[]) : [];
    const pages = rawPages.filter((p) => typeof p === 'string' || _isDict(p));
    const rawEntities = Array.isArray(spec['entity_model']) ? (spec['entity_model'] as Any[]) : [];
    const entities = rawEntities.filter((e) => typeof e === 'string' || _isDict(e));
    const lines: string[] = [
        `> Input: ${_preview_input(state)}`,
        '> Derived app spec — confirm the shape before scaffold:',
        `> Pages (${pages.length}): ${_summarize(pages)}`,
        `> Entities (${entities.length}): ${_summarize(entities)}`,
        '> 1. Confirm — the derived page-set + entity model look right ' +
            '(set `state.app_spec.confirmed = true`)',
        '> 2. Edit — adjust the derived spec, then re-run the app-spec ' +
            'skill',
        '> 3. Just scaffold — skip confirmation (set ' +
            '`state.app_spec.bypassed = true`)',
        '',
        '**Recommendation: 1 — Confirm** — the derived shape is ' +
            'the cheapest point to catch a wrong page-set, before the scaffold ' +
            'plan locks routes and layout. Caveat: flip to 2 if a page or ' +
            'entity is missing / wrong.',
    ];
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: lines,
        message:
            'Greenfield app-spec derived; halting for lightweight confirm ' +
            '(confirm / edit / bypass).',
    });
}

/** Render up to three item names as a compact inline preview. */
function _summarize(items: Any[]): string {
    const names: string[] = [];
    for (const item of items.slice(0, 3)) {
        if (typeof item === 'string') {
            names.push(item);
        } else if (_isDict(item)) {
            // Python `item.get("name") or item.get("title") or item.get("path")`:
            // first truthy by Python rules ([] / {} are falsy, unlike JS `||`).
            const name = _pyTruthy(item['name'])
                ? item['name']
                : _pyTruthy(item['title'])
                  ? item['title']
                  : item['path'];
            names.push(_pyTruthy(name) ? pyStr(name) : '(unnamed)');
        }
    }
    if (names.length === 0) {
        return '(none)';
    }
    const suffix = items.length > 3 ? ', …' : '';
    return names.join(', ') + suffix;
}

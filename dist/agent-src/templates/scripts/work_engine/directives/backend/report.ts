/**
 * `report` step — delivery report renderer.
 *
 * TypeScript twin of `work_engine/directives/backend/report.py` (ADR-094
 * py2ts Phase 1 — work_engine directive sets). Public API names stay
 * snake_case to mirror the Python module 1:1 (per ADR-094 — Python style is
 * part of the contract).
 *
 * Produces the markdown block described in
 * `docs/contracts/implement-ticket-flow.md#delivery-report-schema`.
 * All nine headings are present on every run — the schema is stable
 * for consumers — but section bodies are omitted when the matching
 * slice of `DeliveryState` is empty. The single exception is the
 * **Memory that mattered** section, which per contract is dropped
 * entirely (heading included) when no hit carries a
 * `changed_outcome` marker.
 *
 * The step is pure and deterministic: no I/O, no subprocess, no
 * randomness. It reads `DeliveryState`, writes `state.report`,
 * and always returns `SUCCESS`.
 */

import { type Any, DeliveryState, Outcome, StepResult } from '../../delivery_state.js';
import { resolve_policy } from '../../persona_policy.js';

/** Report rendering is pure and always succeeds — no blocked paths. */
export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [];

/** Render the delivery report into `state.report` and return SUCCESS. */
export function run(state: DeliveryState): StepResult {
    state.report = _render(state);
    return new StepResult({ outcome: Outcome.SUCCESS });
}

function _render(state: DeliveryState): string {
    const sections = [
        _ticket_section(state),
        _persona_section(state),
        _plan_section(state),
        _changes_section(state),
        _tests_section(state),
        _verify_section(state),
        _visual_preview_section(state),
        _memory_section(state),
        _followups_section(state),
        _next_commands_section(state),
    ];
    // Drop sections that opted out (memory-that-mattered and visual-preview
    // return "" when their slice is absent — per the report schema drop-rule).
    return sections.filter((section) => section).join('\n\n');
}

function _ticket_section(state: DeliveryState): string {
    const ticket = state.ticket ?? {};
    const ticketId = _pyTruthy(ticket.id) ? _pyStr(ticket.id) : '(no id)';
    const title = _pyTruthy(ticket.title) ? _pyStr(ticket.title) : '(no title)';
    return `## Ticket\n\n${ticketId} — ${title}`;
}

function _persona_section(state: DeliveryState): string {
    return `## Persona\n\n${_pyTruthy(state.persona) ? _pyStr(state.persona) : '(unset)'}`;
}

function _plan_section(state: DeliveryState): string {
    const body = _format_plan(state.plan);
    return '## Plan\n\n' + (body || '_(no plan recorded)_');
}

/**
 * Render whatever shape `state.plan` carries.
 *
 * Accepts a list of step strings, a list of `{title, detail}` dicts,
 * or a single string — the contract doc intentionally leaves the
 * plan shape loose until `feature-plan` wiring lands in a later
 * phase.
 */
function _format_plan(plan: Any): string {
    if (!_pyTruthy(plan)) {
        return '';
    }
    if (typeof plan === 'string') {
        return _pyStrip(plan);
    }
    if (Array.isArray(plan)) {
        const lines: string[] = [];
        plan.forEach((item, i) => {
            const idx = i + 1;
            if (_isPlainObject(item)) {
                const d = item as Record<string, unknown>;
                const title = _pyTruthy(d.title) ? d.title : _pyTruthy(d.step) ? d.step : `Step ${idx}`;
                const detail = _pyTruthy(d.detail) ? d.detail : _pyTruthy(d.note) ? d.note : '';
                lines.push(`${idx}. **${_pyStr(title)}**` + (detail ? ` — ${_pyStr(detail)}` : ''));
            } else {
                lines.push(`${idx}. ${_pyStr(item)}`);
            }
        });
        return lines.join('\n');
    }
    // Last resort: string-coerce an unknown shape so the renderer never
    // crashes on experimental plan structures.
    return _pyStr(plan);
}

function _changes_section(state: DeliveryState): string {
    if (!_pyTruthy(state.changes)) {
        return '## Changes\n\n_(no file changes recorded)_';
    }
    const lines = ['## Changes', ''];
    for (const change of state.changes) {
        const c = change as Record<string, unknown>;
        const path = _pyTruthy(c.path) ? c.path : _pyTruthy(c.file) ? c.file : '(unknown file)';
        const linesRange = _pyTruthy(c.lines) ? c.lines : _pyTruthy(c.range) ? c.range : '';
        const purpose = _pyTruthy(c.purpose) ? c.purpose : _pyTruthy(c.why) ? c.why : '';
        let prefix = `- \`${_pyStr(path)}\``;
        if (linesRange) {
            prefix += ` (${_pyStr(linesRange)})`;
        }
        if (purpose) {
            prefix += ` — ${_pyStr(purpose)}`;
        }
        lines.push(prefix);
    }
    return lines.join('\n');
}

function _tests_section(state: DeliveryState): string {
    return '## Tests\n\n' + _format_kv_block(state.tests, '_(no tests ran)_');
}

function _verify_section(state: DeliveryState): string {
    return '## Verify\n\n' + _format_kv_block(state.verify, '_(no verify verdict)_');
}

/**
 * R4 Phase 3: render captured preview artifacts when the skill rendered.
 *
 * Reads `state.ui_review.preview` (engine never renders — the
 * stack-specific review skill writes the envelope). Emits a section
 * only when `render_ok` is `True` AND at least one artifact path
 * is present. Failed renders, skipped previews, and pre-R4 envelopes
 * drop the whole section (heading included).
 */
function _visual_preview_section(state: DeliveryState): string {
    const ui_review = state.ui_review;
    if (!_isPlainObject(ui_review)) {
        return '';
    }
    const preview = (ui_review as Record<string, unknown>).preview;
    if (!_isPlainObject(preview)) {
        return '';
    }
    const p = preview as Record<string, unknown>;
    if (p.render_ok !== true) {
        return '';
    }
    if (_pyTruthy(p.skipped)) {
        return '';
    }
    const screenshot = p.screenshot_path;
    const domDump = p.dom_dump_path;
    const lines: string[] = [];
    if (typeof screenshot === 'string' && screenshot) {
        lines.push(`- Screenshot: \`${screenshot}\``);
    }
    if (typeof domDump === 'string' && domDump) {
        lines.push(`- DOM dump: \`${domDump}\``);
    }
    if (lines.length === 0) {
        return '';
    }
    return ['## Visual preview', '', ...lines].join('\n');
}

/** Render **only** hits that changed an outcome (per report schema). */
function _memory_section(state: DeliveryState): string {
    const influential = (state.memory || []).filter(
        (hit) => _isPlainObject(hit) && _pyTruthy((hit as Record<string, unknown>).changed_outcome),
    );
    if (influential.length === 0) {
        return ''; // drop the whole section — heading included
    }
    const lines = ['## Memory that mattered', ''];
    for (const hit of influential) {
        const h = hit as Record<string, unknown>;
        const hitId = _pyTruthy(h.id) ? h.id : '(no id)';
        const hitType = _pyTruthy(h.type) ? h.type : '(no type)';
        const note = _pyTruthy(h.note) ? h.note : _pyTruthy(h.why) ? h.why : '';
        const suffix = note ? ` — ${_pyStr(note)}` : '';
        lines.push(`- \`${_pyStr(hitId)}\` (${_pyStr(hitType)})${suffix}`);
    }
    return lines.join('\n');
}

function _followups_section(state: DeliveryState): string {
    const followups = _extract_followups(state);
    if (followups.length === 0) {
        return '## Follow-ups\n\n_(none)_';
    }
    const lines = ['## Follow-ups', ''];
    for (const item of followups) {
        const anchor = _pyTruthy(item.anchor) ? item.anchor : '';
        const note = _pyTruthy(item.note) ? item.note : _pyTruthy(item.title) ? item.title : '(untitled)';
        let prefix = `- ${_pyStr(note)}`;
        if (anchor) {
            prefix += ` — \`${_pyStr(anchor)}\``;
        }
        lines.push(prefix);
    }
    return lines.join('\n');
}

/** Follow-ups may live on any slice; aggregate them in reading order. */
function _extract_followups(state: DeliveryState): Array<Record<string, Any>> {
    const collected: Array<Record<string, Any>> = [];
    for (const source of [state.plan, state.verify, state.tests]) {
        if (_isPlainObject(source)) {
            const fups = (source as Record<string, unknown>).followups;
            for (const item of Array.isArray(fups) ? fups : []) {
                if (_isPlainObject(item)) {
                    collected.push(item as Record<string, Any>);
                }
            }
        }
    }
    return collected;
}

function _next_commands_section(state: DeliveryState): string {
    if (!resolve_policy(state.persona).suggests_next_commands) {
        // Advisory personas produce a plan-only report; suggesting a
        // commit or PR would mislead the reader — nothing was changed.
        return '';
    }
    const commands = _suggest_commands(state);
    const lines = ['## Suggested next commands', ''];
    for (const cmd of commands) {
        lines.push(`- \`${cmd}\``);
    }
    return lines.join('\n');
}

/** Always suggest `/commit` and `/create-pr` when verify was successful. */
function _suggest_commands(state: DeliveryState): string[] {
    if (state.outcomes.verify === Outcome.SUCCESS) {
        return ['/commit', '/create-pr'];
    }
    return ['/commit'];
}

/** Render a dict-ish slice as a bullet list; fall back to placeholder. */
function _format_kv_block(value: Any, empty_placeholder: string): string {
    if (!_pyTruthy(value)) {
        return empty_placeholder;
    }
    if (_isPlainObject(value)) {
        return _render_kv_lines(Object.entries(value as Record<string, unknown>)).join('\n');
    }
    if (typeof value === 'string') {
        return _pyStrip(value) || empty_placeholder;
    }
    return _pyStr(value);
}

/** Render `(key, value)` pairs as one Markdown bullet per pair. */
function _render_kv_lines(pairs: Array<[string, Any]>): string[] {
    return pairs.map(([key, value]) => `- **${key}:** ${_pyStr(value)}`);
}

/** `(value or {})` style truthiness, Python semantics. */
function _pyTruthy(value: unknown): boolean {
    if (value === null || value === undefined || value === false) {
        return false;
    }
    if (value === true) {
        return true;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        return value.length !== 0;
    }
    if (Array.isArray(value)) {
        return value.length !== 0;
    }
    if (value instanceof Set || value instanceof Map) {
        return value.size !== 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>).length !== 0;
    }
    return true;
}

/** Python `str.strip()`. */
function _pyStrip(s: string): string {
    return s.trim();
}

/** True for a dict-like value (mirrors Python `isinstance(x, dict)`). */
function _isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        !(value instanceof Set) &&
        !(value instanceof Map)
    );
}

/**
 * Python `str(value)` for the scalar / container kinds the report renders.
 *
 * Strings render as-is; `None`/booleans use Python spelling; numbers as-is;
 * dict / list use Python's `repr`-style bracketing so a `str(plan)` /
 * `str(value)` fallback matches the Python output byte-for-byte.
 */
function _pyStr(value: unknown): string {
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
        return value;
    }
    if (typeof value === 'number') {
        return _pyNumber(value);
    }
    if (Array.isArray(value)) {
        return '[' + value.map((v) => _pyReprInner(v)).join(', ') + ']';
    }
    if (_isPlainObject(value)) {
        const parts = Object.entries(value as Record<string, unknown>).map(
            ([k, v]) => `${_pyReprInner(k)}: ${_pyReprInner(v)}`,
        );
        return '{' + parts.join(', ') + '}';
    }
    return String(value);
}

/** Python `repr()` for values nested inside a `str(container)` render. */
function _pyReprInner(value: unknown): string {
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
        return `'${value}'`;
    }
    if (typeof value === 'number') {
        return _pyNumber(value);
    }
    if (Array.isArray(value)) {
        return '[' + value.map((v) => _pyReprInner(v)).join(', ') + ']';
    }
    if (_isPlainObject(value)) {
        const parts = Object.entries(value as Record<string, unknown>).map(
            ([k, v]) => `${_pyReprInner(k)}: ${_pyReprInner(v)}`,
        );
        return '{' + parts.join(', ') + '}';
    }
    return String(value);
}

/** Python number-to-str: integer-valued floats keep no decimal in `int` path. */
function _pyNumber(value: number): string {
    return String(value);
}

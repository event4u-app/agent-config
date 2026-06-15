/**
 * Heuristic intent classifier — see `work_engine.intent` for context.
 *
 * TypeScript twin of `work_engine/intent/classify.py` (ADR-096 py2ts —
 * work_engine foundation). Public API names stay snake_case to mirror the
 * Python module 1:1 (per ADR-096 — Python style is part of the contract).
 *
 * The classifier walks a small priority ladder against the lower-cased
 * prompt + optional ticket title. First match wins; `backend-coding` is
 * the fall-through default so every prompt always lands on a known label.
 *
 * Priority order (deliberately fixed):
 *
 * 1. **Trivial-UI** — UI signal AND a trivial-edit verb pattern (`change
 *    color`, `make … red`, `rename label`, `fix copy`) AND no
 *    structural verb (`add`, `build`, `create`, `introduce`).
 * 2. **Mixed** — UI signal AND a backend signal (`endpoint`, `API`,
 *    `migration`, `schema`, `query`, `job`, `queue`).
 * 3. **UI-Improve** — UI signal AND an improve/redesign/refactor verb,
 *    OR explicit "existing" surface markers.
 * 4. **UI-Build** — UI signal AND a build/create/add verb, OR new-screen
 *    markers (`new page`, `new screen`, `new component`).
 * 5. **Backend-Coding** — default.
 *
 * The label is the dispatcher's *only* input for routing. Confidence
 * band, `ui_intent` flag from the scorer, and AC reconstruction stay
 * the resolution surface — the classifier does not look at them.
 */
import type { WorkState } from '../state.js';

export const INTENT_UI_BUILD = 'ui-build';
export const INTENT_UI_IMPROVE = 'ui-improve';
export const INTENT_UI_TRIVIAL = 'ui-trivial';
export const INTENT_MIXED = 'mixed';
export const INTENT_BACKEND = 'backend-coding';

/**
 * All labels the classifier can return.
 *
 * Locked here so the dispatcher's mapping table and the test suite share
 * one source of truth.
 */
export const KNOWN_INTENTS: ReadonlySet<string> = new Set([
    INTENT_UI_BUILD,
    INTENT_UI_IMPROVE,
    INTENT_UI_TRIVIAL,
    INTENT_MIXED,
    INTENT_BACKEND,
]);

/**
 * Strong UI nouns — exclusive UI meaning.
 *
 * Deliberately omits `table`, `list`, `input`, and `field`:
 * `table`/`list` collide with database tables and Python/PHP lists;
 * `input`/`field` collide with function inputs, command inputs, and
 * JSON/DB fields. Genuine UI prompts that mean form inputs always come
 * with a strong-UI noun nearby (`form`, `page`, `component`).
 */
const _UI_NOUNS: ReadonlySet<string> = new Set([
    'ui', 'screen', 'page', 'view', 'form', 'modal', 'dialog',
    'button', 'card', 'tile',
    'header', 'footer', 'nav', 'navigation', 'sidebar', 'menu',
    'dropdown', 'tab', 'panel', 'layout', 'component', 'icon',
    'tooltip', 'toast', 'banner', 'badge', 'avatar', 'label',
    'checkbox', 'radio', 'toggle', 'switch', 'stepper', 'wizard',
]);

const _UI_STYLE: ReadonlySet<string> = new Set([
    'color', 'colour', 'css', 'tailwind', 'padding', 'margin',
    'spacing', 'font', 'typography', 'responsive', 'mobile',
    'dark mode', 'light mode', 'theme', 'shadow', 'border',
    'rounded', 'radius',
]);

const _BACKEND_SIGNALS: ReadonlySet<string> = new Set([
    'endpoint', 'api', 'route', 'controller', 'service',
    'migration', 'schema', 'table', 'column', 'index', 'query',
    'queue', 'job', 'worker', 'webhook', 'policy', 'gate',
    'command', 'cron', 'broadcast', 'event', 'listener',
]);

const _TRIVIAL_VERBS: ReadonlySet<string> = new Set([
    'rename', 'relabel', 'tweak', 'adjust', 'swap', 'change',
]);

const _IMPROVE_VERBS: ReadonlySet<string> = new Set([
    'improve', 'polish', 'redesign', 'rework', 'refine',
    'refactor', 'tighten', 'clean', 'fix', 'update', 'tune',
]);

const _BUILD_VERBS: ReadonlySet<string> = new Set([
    'add', 'build', 'create', 'introduce', 'implement', 'ship',
    'draft', 'scaffold', 'wire',
]);

const _NEW_SURFACE: RegExp =
    /\b(new|fresh|blank)\s+(page|screen|view|component|form|modal|tile|dashboard)\b/;

const _EXISTING_SURFACE: RegExp =
    /\b(existing|current|the)\s+(page|screen|view|component|form|modal)\b/;

const _TRIVIAL_PATTERN: RegExp =
    /\b(make|change|update|set|swap)\b[^.]{0,40}\b(red|blue|green|yellow|black|white|primary|secondary|color|colour|copy|text|label|wording|class|prop)\b/;

/**
 * Return one of {@link KNOWN_INTENTS} for the supplied text.
 *
 * @param raw The user prompt or ticket body. Whitespace is normalised
 *   internally; `""` and `null` resolve to `backend-coding`.
 * @param title Optional ticket title. Concatenated with `raw` before
 *   scanning so single-line ticket headlines (`"Add CSV export"`) produce
 *   the same label whether they arrive in the body or the title slot.
 */
export function classify_intent(
    raw: string,
    opts: { title?: string | null } = {},
): string {
    const title = opts.title ?? null;
    // Python: " ".join(filter(None, (title, raw))).strip().lower()
    // filter(None, ...) drops falsy entries (None and "").
    const parts = [title, raw].filter((p): p is string => Boolean(p));
    const text = pyLower(pyStrip(parts.join(' ')));
    if (!text) {
        return INTENT_BACKEND;
    }

    const has_ui = _has_ui_signal(text);
    const has_backend = _has_backend_signal(text);

    if (has_ui && _is_trivial(text)) {
        return INTENT_UI_TRIVIAL;
    }
    if (has_ui && has_backend) {
        return INTENT_MIXED;
    }
    if (has_ui && _is_improve(text)) {
        return INTENT_UI_IMPROVE;
    }
    if (has_ui && _is_build(text)) {
        return INTENT_UI_BUILD;
    }
    if (has_ui) {
        // UI signal but no clear verb — default to ui-improve so the
        // full audit gate engages. ui-build would skip the existing-
        // surface check, which is the wrong default when the prompt
        // is ambiguous.
        return INTENT_UI_IMPROVE;
    }
    return INTENT_BACKEND;
}

/**
 * Map an intent label to a directive-set name.
 *
 * Centralised here so the dispatcher and the refine step share one
 * routing table; a future intent (`infra`, `security-review`)
 * only needs a single edit. Unknown labels raise `ValueError` —
 * silently falling back to `backend` would mask classifier bugs.
 */
export function directive_set_for(intent: string): string {
    if (!KNOWN_INTENTS.has(intent)) {
        throw new ValueError(
            `unknown intent ${pyStrRepr(intent)}; ` +
                `expected one of ${pyListRepr(pySorted(KNOWN_INTENTS))}`,
        );
    }
    if (intent === INTENT_UI_BUILD || intent === INTENT_UI_IMPROVE) {
        return 'ui';
    }
    if (intent === INTENT_UI_TRIVIAL) {
        return 'ui-trivial';
    }
    if (intent === INTENT_MIXED) {
        return 'mixed';
    }
    return 'backend';
}

// --- helpers ----------------------------------------------------------

function _has_ui_signal(text: string): boolean {
    for (const w of _UI_NOUNS) {
        if (reSearch(wordBoundary(w), text)) {
            return true;
        }
    }
    for (const s of _UI_STYLE) {
        if (text.includes(s)) {
            return true;
        }
    }
    return false;
}

function _has_backend_signal(text: string): boolean {
    for (const w of _BACKEND_SIGNALS) {
        if (reSearch(wordBoundary(w), text)) {
            return true;
        }
    }
    return false;
}

function _is_trivial(text: string): boolean {
    if (reSearch(_TRIVIAL_PATTERN, text)) {
        return true;
    }
    let hasVerb = false;
    for (const v of _TRIVIAL_VERBS) {
        if (reSearch(wordBoundary(v), text)) {
            hasVerb = true;
            break;
        }
    }
    return hasVerb && pySplit(text).length <= 14;
}

function _is_improve(text: string): boolean {
    if (reSearch(_EXISTING_SURFACE, text)) {
        return true;
    }
    for (const v of _IMPROVE_VERBS) {
        if (reSearch(wordBoundary(v), text)) {
            return true;
        }
    }
    return false;
}

function _is_build(text: string): boolean {
    if (reSearch(_NEW_SURFACE, text)) {
        return true;
    }
    for (const v of _BUILD_VERBS) {
        if (reSearch(wordBoundary(v), text)) {
            return true;
        }
    }
    return false;
}

/**
 * Classify `state.input` and write `intent` + `directive_set` in place.
 *
 * Idempotent and override-safe: if `state.intent` is already a
 * UI-track or mixed label (`ui-build`, `ui-improve`, `ui-trivial`,
 * `mixed`), the routing is left untouched. Only freshly-built states
 * carrying the construction default `backend-coding` are reclassified.
 * Loaded state files round-trip without losing a previously-recorded
 * intent — including a manual user override in the JSON.
 *
 * The text fed to the classifier depends on the input envelope:
 *
 * - `prompt` → `state.input.data["raw"]`
 * - `ticket` → `state.input.data["title"]` + first non-empty
 *   acceptance criterion, falling back to `description` when AC is
 *   missing. Title is passed separately so single-line ticket
 *   headlines (`"Add CSV export"`) classify identically whether
 *   they arrive in the body or the title slot.
 * - `diff` / `file` → routed directly to `ui-improve` without
 *   running the heuristic. Both envelopes are R3 Phase 1 inputs that
 *   describe an existing UI surface ("improve this screen"); the
 *   classifier's prose-oriented signals do not apply, and the audit +
 *   design directives downstream are the right place to read the
 *   diff/file contents.
 */
export function populate_routing(state: WorkState): void {
    if (state.intent !== INTENT_BACKEND) {
        return;
    }

    if (state.input.kind === 'diff' || state.input.kind === 'file') {
        state.intent = INTENT_UI_IMPROVE;
        state.directive_set = directive_set_for(INTENT_UI_IMPROVE);
        return;
    }

    const [text, title] = _extract_text(state);
    const intent = classify_intent(text, { title });
    state.intent = intent;
    state.directive_set = directive_set_for(intent);
}

function _extract_text(state: WorkState): [string, string | null] {
    const data = state.input.data ?? {};
    if (state.input.kind === 'prompt') {
        // Python: str(data.get("raw") or "")
        const raw = 'raw' in data ? data['raw'] : undefined;
        return [pyStr(_pyTruthy(raw) ? raw : ''), null];
    }
    const title = 'title' in data ? data['title'] : undefined;
    const title_str =
        typeof title === 'string' && pyStrip(title) ? pyStr(title) : null;
    const body_parts: string[] = [];
    const ac = 'acceptance_criteria' in data ? data['acceptance_criteria'] : undefined;
    if (Array.isArray(ac)) {
        for (const item of ac) {
            if (typeof item === 'string') {
                body_parts.push(pyStr(item));
            }
        }
    }
    const description = 'description' in data ? data['description'] : undefined;
    if (typeof description === 'string' && pyStrip(description)) {
        body_parts.push(description);
    }
    return [body_parts.join(' '), title_str];
}

// ── Python-parity helpers ───────────────────────────────────────────────

/** Raised in place of Python's `ValueError` for the unknown-intent guard. */
export class ValueError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValueError';
        Object.setPrototypeOf(this, ValueError.prototype);
    }
}

/**
 * Mirror `re.escape(word)` then `re.search(rf"\b{...}\b", text)` as a boolean.
 * The classifier's words are all `[a-z]+` ASCII, so escaping is a no-op for
 * them; escape defensively anyway so the helper is faithful for any input.
 * Patterns are flag-only (no `g`) — `.test` carries no `lastIndex` state.
 */
function wordBoundary(word: string): RegExp {
    return new RegExp(`\\b${reEscape(word)}\\b`);
}

function reSearch(pattern: RegExp, text: string): boolean {
    return pattern.test(text);
}

/**
 * Mirror Python `re.escape` — escapes every character that is not an ASCII
 * letter, digit, or underscore. CPython 3.7+ escapes only special chars, but
 * for the ASCII-word inputs here the result is identical to the verb itself.
 */
function reEscape(s: string): string {
    return s.replace(/[^A-Za-z0-9_]/g, (ch) => '\\' + ch);
}

/**
 * Mirror Python `str.split()` (no args) — split on runs of whitespace,
 * dropping leading/trailing empties. `trim().split(/\s+/)` matches; guard the
 * empty string so `"".split(/\s+/)` does not yield `[""]` (Python returns []).
 */
function pySplit(s: string): string[] {
    const t = s.trim();
    if (t === '') return [];
    return t.split(/\s+/);
}

/** Mirror Python `str.strip()` — `String.trim()` is faithful here. */
function pyStrip(s: string): string {
    return s.trim();
}

/**
 * Mirror Python `str.lower()`. CPython lower-cases by full Unicode mapping;
 * JS `toLowerCase()` follows the same Unicode default case-folding for the
 * code points these heuristics see (the inputs are dominated by ASCII).
 */
function pyLower(s: string): string {
    return s.toLowerCase();
}

/**
 * Mirror Python `str(x)` for the values `_extract_text` coerces (str, or the
 * `or ""` fallback which is already a string). Only string-or-empty flows here.
 */
function pyStr(v: unknown): string {
    return typeof v === 'string' ? v : String(v);
}

/** Mirror Python truthiness for the `data.get("raw") or ""` short-circuit. */
function _pyTruthy(v: unknown): v is string {
    if (v === null || v === undefined) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
}

/**
 * Mirror Python `repr(str)` — see the `state.py` twin's `pyStrRepr`. Used for
 * the `{intent!r}` tail in the unknown-intent error.
 */
function pyStrRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '\\') out += '\\\\';
        else if (ch === quote) out += '\\' + quote;
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else if (code < 0x20 || code === 0x7f) {
            out += `\\x${code.toString(16).padStart(2, '0')}`;
        } else {
            out += ch;
        }
    }
    return out + quote;
}

/** Python `repr(list_of_str)` for the `sorted(KNOWN_INTENTS)` error tail. */
function pyListRepr(items: string[]): string {
    return '[' + items.map((s) => pyStrRepr(s)).join(', ') + ']';
}

/**
 * Python `sorted(set_of_str)` — code-point ascending, the default `str`
 * ordering CPython uses.
 */
function pySorted(values: ReadonlySet<string>): string[] {
    return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

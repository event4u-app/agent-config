/**
 * Sanitize floor for retrieval read-surfaces
 * (road-to-retrieval-substrate-hardening B6).
 *
 * Corpus content — especially user-ingested knowledge chunks under
 * `agents/memory/knowledge/` — flows into the agent context on the retrieval
 * read surfaces. An attacker (or a compromised ingested source) can embed
 * hidden-instruction vectors (bidi controls, zero-width chars, Unicode Tag
 * block) or control-char noise that the model may act on — the untrusted-input
 * / lethal-trifecta injection surface. This floor strips those vectors from
 * every string field before it is emitted, treating retrieved content as DATA.
 *
 * It deliberately does NOT rewrite visible text (that would corrupt legitimate
 * rule/chunk bodies and code snippets) — the injection risk is the *invisible*
 * layer + unbounded length; visible content is the agent's to read as data.
 * Codepoint classes are shared with `lint_hidden_unicode` (one source of truth
 * for what counts as a hidden-instruction vector).
 *
 * WHERE IT ACTUALLY RUNS — measured end-to-end, not asserted. Keep this list
 * honest: an earlier version of this header named surfaces by intent, and the
 * legacy-envelope gap below went unnoticed for exactly that reason. Every
 * claim here is backed by a probe row in
 * `agents/evidence/reports/sanitize-floor-wiring.md`:
 *
 *   - `retrieve_v1()`     — yes (`memory_lookup.ts` calls `sanitize_entry`)
 *   - `memory_get_v1()`   — yes (same)
 *   - MCP `memory_lookup` / `memory_get` tools — inherited from the two above
 *   - `retrieve()` / `retrieve_with_meta()` — yes, since the S0.0 wiring fix;
 *     before it they emitted every vector intact, and so did the CLI default
 *     (`--envelope legacy`), which is the path the rules document
 *   - inter-agent channels (`ai_team` / `ai_council` model replies) — the
 *     inbound parse choke point only; the subagent boundary itself is a HOST
 *     primitive this package cannot reach (see the report, § S0.0b)
 *
 * Anything not on that list is uncovered. Do not widen the list without a
 * probe row to back it.
 */
import { _classify } from '../lint_hidden_unicode.js';

/** Hard per-field length cap — bounds a runaway/adversarial body. */
export const MAX_FIELD_CHARS = 8192;

/** True for a C0/C1 control char that is NOT a benign whitespace (\t, \n). */
function _isStrippableControl(cp: number): boolean {
    if (cp === 0x09 || cp === 0x0a) return false; // keep tab + newline
    if (cp <= 0x1f) return true; // C0 controls (incl. CR 0x0d — normalised out)
    if (cp === 0x7f) return true; // DEL
    if (cp >= 0x80 && cp <= 0x9f) return true; // C1 controls
    return false;
}

/**
 * Strip hidden-instruction vectors (bidi / zero-width / Unicode-tag /
 * deprecated-format, per `_classify`) and stray control chars from a string,
 * then cap its length. Preserves all visible content + tabs/newlines.
 */
export function sanitize_text(s: string): string {
    let out = '';
    for (const ch of s) {
        const cp = ch.codePointAt(0);
        if (cp === undefined) continue;
        if (_classify(cp) !== null) continue; // hidden-instruction vector → drop
        if (_isStrippableControl(cp)) continue; // control-char noise → drop
        out += ch;
    }
    return out.length > MAX_FIELD_CHARS ? out.slice(0, MAX_FIELD_CHARS) : out;
}

/**
 * Return a shallow copy of a retrieval entry with every string value (and
 * one level of string-array values) sanitized. Non-string values pass through
 * unchanged (numbers, booleans, the PyFloat marker, nested plain objects are
 * sanitized recursively).
 */
export function sanitize_entry(entry: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(entry)) {
        out[k] = _sanitize_value(v);
    }
    return out;
}

function _sanitize_value(v: unknown): unknown {
    if (typeof v === 'string') return sanitize_text(v);
    if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? sanitize_text(x) : _sanitize_value(x)));
    if (v && typeof v === 'object' && v.constructor === Object) {
        return sanitize_entry(v as Record<string, unknown>);
    }
    return v; // numbers, booleans, null, marker classes (PyFloat/PyTimestamp) untouched
}

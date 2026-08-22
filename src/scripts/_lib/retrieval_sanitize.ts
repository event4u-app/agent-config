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
import { TOKEN_RE, classifyToken } from './confusables.js';

/** Hard per-field length cap — bounds a runaway/adversarial body. */
export const MAX_FIELD_CHARS = 8192;

/**
 * Invisible fillers — render as blank but are not whitespace, so they sit in
 * neither the zero-width nor the bidi set and survived the original floor
 * (measured: `agents/evidence/reports/encoding-channel-coverage.md` row 18).
 *
 * These are the ONLY channel Phase 1 chose to strip rather than flag: invisible
 * by nature, with no legitimate role in this corpus, so folding them into the
 * existing invisible set carries no corruption risk. Every other uncovered
 * channel is a flag, because rewriting visible text can corrupt legitimate
 * content.
 */
const _INVISIBLE_FILLERS: ReadonlySet<number> = new Set([
    0x3164, // HANGUL FILLER
    0x115f, // HANGUL CHOSEONG FILLER
    0x1160, // HANGUL JUNGSEONG FILLER
]);

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
        if (_INVISIBLE_FILLERS.has(cp)) continue; // blank-but-not-whitespace → drop
        out += ch;
    }
    return out.length > MAX_FIELD_CHARS ? out.slice(0, MAX_FIELD_CHARS) : out;
}

/**
 * Report the INVISIBLE layer without removing it.
 *
 * `sanitize_text` above strips four channels — hidden-instruction vectors
 * (bidi, zero-width, tag, deprecated-format, private-use-area, per `_classify`),
 * strippable control chars, and invisible fillers. Stripping is the right
 * disposition for a retrieval path that is about to hand text to a model.
 *
 * It is the WRONG disposition for a reporting surface. A warn-only PostToolUse
 * hook must not rewrite what the agent already read, so it cannot call
 * `sanitize_text` at all — and `scan_encoding_findings` is the VISIBLE-layer
 * twin and deliberately says nothing about these four. Measured over the frozen
 * corpus before this function existed: `deprecated-format`, `private-use-area`,
 * `control-char` and `invisible-filler` reported **0 of 20 each** through the
 * reporting API while `sanitize_text` changed **20 of 20** for every one of
 * them. So the layer had a reporting blind spot exactly where its stripping was
 * perfect, and a consumer that may not strip was blind to a quarter of the
 * channel set.
 *
 * The published 99.00 % recall figure is the STRIPPING pipeline's. The reporting
 * half alone measured 72.33 %. Both numbers are correct about different things,
 * and conflating them is what made "import the measured layer and get 15
 * channels" read as true.
 *
 * Additive by construction: nothing that exists changes behaviour, and the
 * predicates are the SAME ones `sanitize_text` uses — not copies — so a channel
 * cannot become strippable without becoming reportable in the same edit.
 */
export function scan_invisible_findings(s: string): EncodingFinding[] {
    const out: EncodingFinding[] = [];
    const seen = new Set<string>();
    const add = (channel: string, cp: number): void => {
        const key = `${channel}:${cp}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
            channel,
            detail: `U+${cp.toString(16).toUpperCase().padStart(4, '0')} in the invisible layer`,
        });
    };
    for (const ch of s) {
        const cp = ch.codePointAt(0);
        if (cp === undefined) continue;
        const classified = _classify(cp);
        if (classified !== null) {
            // `_classify` already names the channel; reuse its label rather than
            // re-deriving one, so the hook's output and the authoring-time
            // linter's speak the same vocabulary.
            add(typeof classified === 'string' ? classified : 'hidden-instruction', cp);
            continue;
        }
        if (_isStrippableControl(cp)) {
            add('control-char', cp);
            continue;
        }
        if (_INVISIBLE_FILLERS.has(cp)) {
            add('invisible-filler', cp);
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Visible-layer scanner — FLAG ONLY, never rewrites
// ---------------------------------------------------------------------------
//
// `sanitize_text` strips the invisible layer. This reports the VISIBLE layer,
// which the floor deliberately does not touch: folding a confusable to a Latin
// skeleton, or NFKC-normalising a math-alphanumeric run, corrupts any body that
// legitimately contains mixed script, CJK punctuation, or a ligature. Phase 1
// measured each channel and chose flag-not-rewrite for every one of these:
// `agents/evidence/reports/encoding-channel-coverage.md` § Disposition.
//
// Deterministic and pure: no model call, no network, no I/O. Safe to run in CI
// and on a request path.
//
// Not scanned, deliberately, with the reason recorded so it is not mistaken for
// an oversight:
//   - confusable whitespace (NBSP, figure space) — pervasive in real prose
//   - HTML/XML entities — decoding them would CREATE the payload
//   - nested multibase (base64) — legitimate throughout this repo; semantic,
//     not structural
//   - structured-data key ordering — not a codepoint channel at all, and
//     reordering keys would break the byte-identical v1 envelope contract
//   - word-order permutation — carrier text with legitimate word order is
//     indistinguishable from permuted text without semantics

/** Codepoint thresholds — a run is the signal; a single occurrence is not. */
const _VS_RUN_MIN = 3;
const _COMBINING_RUN_MIN = 5;

export interface EncodingFinding {
    /** Stable channel id, matching the frozen corpus labels. */
    readonly channel: string;
    /** Why it fired, with the concrete evidence (codepoint or token). */
    readonly detail: string;
}

function _isVariationSelector(cp: number): boolean {
    return (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef);
}

function _isCombiningMark(cp: number): boolean {
    return cp >= 0x0300 && cp <= 0x036f;
}

/**
 * Report visible-layer encoding signals in a string. Never mutates it.
 *
 * The confusable signature is NOT reimplemented here — it is the shared
 * `classifyToken` from `_lib/confusables.ts`, the single definition this
 * package's authoring-time linter also uses, so the two surfaces cannot drift
 * apart on what counts as a homoglyph.
 */
export function scan_encoding_findings(s: string): EncodingFinding[] {
    const out: EncodingFinding[] = [];

    // Longest run of variation selectors / combining marks anywhere in the
    // string. A run is what distinguishes steganography from legitimate use:
    // U+FE0F is the emoji presentation selector and diacritics are normal in
    // many languages, so a single occurrence is never the signal.
    let vsRun = 0;
    let vsMax = 0;
    let cmRun = 0;
    let cmMax = 0;
    let hasMathAlnum = false;
    let hasFullwidth = false;
    for (const ch of s) {
        const cp = ch.codePointAt(0);
        if (cp === undefined) continue;
        if (_isVariationSelector(cp)) {
            vsRun += 1;
            vsMax = Math.max(vsMax, vsRun);
        } else {
            vsRun = 0;
        }
        if (_isCombiningMark(cp)) {
            cmRun += 1;
            cmMax = Math.max(cmMax, cmRun);
        } else {
            cmRun = 0;
        }
        if (cp >= 0x1d400 && cp <= 0x1d7ff) hasMathAlnum = true;
        if (cp >= 0xff01 && cp <= 0xff5e) hasFullwidth = true;
    }
    if (vsMax >= _VS_RUN_MIN) {
        out.push({
            channel: 'variation-selector-run',
            detail: `variation-selector run x${vsMax} (steganography signature)`,
        });
    }
    if (cmMax >= _COMBINING_RUN_MIN) {
        out.push({
            channel: 'combining-mark-run',
            detail: `combining-mark run x${cmMax} on one base character`,
        });
    }
    if (hasMathAlnum) {
        out.push({
            channel: 'math-alphanumeric',
            detail: 'Mathematical Alphanumeric Symbols used as letters (U+1D400–1D7FF)',
        });
    }
    if (hasFullwidth) {
        out.push({
            channel: 'fullwidth-forms',
            detail: 'Halfwidth/Fullwidth Forms used as ASCII letters (U+FF01–FF5E)',
        });
    }

    // Mixed-script confusable tokens — shared signature, one table in the tree.
    for (const m of s.matchAll(TOKEN_RE)) {
        const verdict = classifyToken(m[0]);
        if (verdict !== null) {
            const script = verdict.startsWith('latin+greek') ? 'greek' : 'cyrillic';
            out.push({ channel: `confusable-${script}`, detail: `${m[0]} — ${verdict}` });
        }
    }

    // Punycode / IDN in a text-expected field. Flagged, never rewritten:
    // `xn--` labels are valid DNS and rewriting one would break a real link.
    for (const m of s.matchAll(/\bxn--[a-z0-9-]+/gi)) {
        out.push({ channel: 'punycode-idn', detail: `punycode label ${m[0]}` });
    }

    return out;
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

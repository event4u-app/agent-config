/**
 * Confidence gate for solo-member dispatch (step-9 P13).
 *
 * TypeScript twin of `src/scripts/ai_council/confidence_gate.py`
 * (ADR-096 — Python→TS migration, Phase 1). Defense-in-depth on top of
 * shadow-mode SLO: when a single member's response signals uncertainty,
 * presents unresolved alternatives, or refuses, the dispatcher escalates
 * to the full council on the current invocation.
 *
 * Heuristics are intentionally stdlib-only (regex + length). Python `re`
 * semantics are mirrored exactly: IGNORECASE on the marker, DOTALL +
 * MULTILINE on the split patterns, and code-point string length to match
 * Python `len()`.
 */

/**
 * Below this character count a response is treated as too thin to
 * trust on its own — escalates as `short_response`.
 */
const _SHORT_RESPONSE_CHARS = 40;

/**
 * Hedge-word density (matches per 100 chars) above which the response is
 * treated as low-confidence.
 */
const _HEDGE_DENSITY_THRESHOLD = 0.04;

const _HEDGE_WORDS = [
    'maybe',
    'perhaps',
    'possibly',
    'probably',
    'not sure',
    'unsure',
    'i think',
    'i guess',
    "i'd say",
    'tend to',
    'vielleicht',
    'eventuell',
    'möglicherweise',
    'wahrscheinlich',
    'nicht sicher',
    'denke ich',
    'vermutlich',
] as const;

const _REFUSAL_PATTERNS = [
    String.raw`\bi (?:can(?:'?| no)t|cannot|won'?t|am unable)\b`,
    String.raw`\bi don'?t know\b`,
    String.raw`\bunclear\b`,
    String.raw`\binsufficient (?:context|information|data)\b`,
    String.raw`\bneed more (?:context|information|details)\b`,
    String.raw`\bkann (?:ich )?nicht (?:entscheiden|sagen|beantworten)\b`,
    String.raw`\bweiß ich nicht\b`,
    String.raw`\bzu wenig (?:kontext|information)\b`,
] as const;

const _SPLIT_PATTERNS = [
    String.raw`\boption a\b.*?\boption b\b`,
    String.raw`\bvariante 1\b.*?\bvariante 2\b`,
    String.raw`\beither\b.*?\bor\b.*?\b(?:would|could|might)\b`,
    String.raw`\bentweder\b.*?\boder\b.*?\b(?:wäre|könnte|würde)\b`,
    String.raw`^\s*verdict:.*?^\s*verdict:`, // two Verdict: blocks
] as const;

// Python: re.compile(r"confidence\s*[:=]\s*([01](?:\.\d+)?|\d{1,3}\s*%)", re.IGNORECASE)
// JS flag 'g' added only for .search()-style first-match; we use a fresh
// regex each call (no shared lastIndex). 'i' == IGNORECASE.
const _CONFIDENCE_MARKER_RE = /confidence\s*[:=]\s*([01](?:\.\d+)?|\d{1,3}\s*%)/i;

/** Verdict from `should_escalate`. */
export interface EscalationDecision {
    escalate: boolean;
    /** 'low_confidence' | 'split' | 'refusal' | 'short_response' | 'ok' */
    reason: string;
    confidence: number | null;
}

/** Mirror Python `len(str)` — code-point count, not UTF-16 unit count. */
function _pyLen(s: string): number {
    let n = 0;
    // Iterating a string yields code points (handles surrogate pairs).
    for (const _ of s) {
        n += 1;
    }
    return n;
}

/** Mirror Python `str.strip()` — strips ASCII + Unicode whitespace both ends. */
function _pyStrip(s: string): string {
    // Python str.strip() with no args removes Unicode whitespace. JS
    // String.prototype.trim() removes the same WhiteSpace + LineTerminator
    // set; close enough for the whitespace produced by LLM responses.
    return s.trim();
}

/** Mirror Python `str.count(sub)` — non-overlapping occurrences. */
function _pyCount(haystack: string, needle: string): number {
    if (needle === '') {
        // Python "abc".count("") == len(abc)+1; never hit here (no empty
        // hedge words) but replicate for faithfulness.
        return _pyLen(haystack) + 1;
    }
    let count = 0;
    let idx = haystack.indexOf(needle);
    while (idx !== -1) {
        count += 1;
        idx = haystack.indexOf(needle, idx + needle.length);
    }
    return count;
}

/** Python `re.search(pattern, text, flags)` → boolean (match anywhere). */
function _reSearch(pattern: string, text: string, flags: string): boolean {
    return new RegExp(pattern, flags).test(text);
}

/**
 * Best-effort confidence score from a member response.
 *
 * Returns the explicit `Confidence: 0.X` marker when present (percent
 * values normalised to 0–1). Otherwise derives a score from hedge-word
 * density: `1.0 - clamp(density / threshold, 0, 1)`. Returns `null` for
 * empty input — caller treats as escalate.
 */
export function extract_confidence(response: string): number | null {
    if (!response || !_pyStrip(response)) {
        return null;
    }
    const m = _CONFIDENCE_MARKER_RE.exec(response);
    if (m) {
        const raw = m[1]!.trim();
        if (raw.endsWith('%')) {
            const v = _pyParseFloat(raw.slice(0, -1).trim());
            if (v !== null) {
                return Math.max(0.0, Math.min(1.0, v / 100.0));
            }
            // ValueError → fall through
        } else {
            const v = _pyParseFloat(raw);
            if (v !== null) {
                return Math.max(0.0, Math.min(1.0, v));
            }
            // ValueError → fall through
        }
    }
    const low = response.toLowerCase();
    let hits = 0;
    for (const w of _HEDGE_WORDS) {
        hits += _pyCount(low, w);
    }
    if (hits === 0) {
        return 1.0;
    }
    const density = hits / Math.max(1, _pyLen(response) / 100.0);
    const ratio = Math.min(1.0, density / _HEDGE_DENSITY_THRESHOLD);
    return Math.max(0.0, 1.0 - ratio);
}

/**
 * Python float(str) — returns null on ValueError. Accepts inf/nan like
 * CPython, but those never reach this path from the marker regex
 * (`[01](?:\.\d+)?` or `\d{1,3}`).
 */
function _pyParseFloat(s: string): number | null {
    const t = s.trim();
    if (t === '') {
        return null;
    }
    const n = Number(t);
    return Number.isNaN(n) ? null : n;
}

/**
 * True when the response presents unresolved alternatives. Picks up
 * `option A … option B`, two `Verdict:` blocks, `either … or
 * would/could`, and German equivalents.
 */
export function is_split_response(response: string): boolean {
    if (!response) {
        return false;
    }
    const low = response.toLowerCase();
    for (const pattern of _SPLIT_PATTERNS) {
        // re.DOTALL → 's', re.MULTILINE → 'm'. Python regex is not global
        // by default; a fresh RegExp per call avoids lastIndex carryover.
        if (_reSearch(pattern, low, 'sm')) {
            return true;
        }
    }
    return false;
}

/** True when the response signals 'I can't / don't know / unclear'. */
export function is_refusal(response: string): boolean {
    if (!response) {
        return true;
    }
    const low = response.toLowerCase();
    return _REFUSAL_PATTERNS.some((p) => _reSearch(p, low, ''));
}

/**
 * Compose the gate. Order: refusal → split → short → low-conf → ok.
 *
 * `floor` is `LowImpactConfig.solo_confidence_floor`.
 */
export function should_escalate(
    response: string | null | undefined,
    floor: number,
): EscalationDecision {
    if (response === null || response === undefined || !_pyStrip(response)) {
        return { escalate: true, reason: 'refusal', confidence: null };
    }
    if (is_refusal(response)) {
        return { escalate: true, reason: 'refusal', confidence: null };
    }
    if (is_split_response(response)) {
        return { escalate: true, reason: 'split', confidence: null };
    }
    if (_pyLen(_pyStrip(response)) < _SHORT_RESPONSE_CHARS) {
        return { escalate: true, reason: 'short_response', confidence: null };
    }
    const conf = extract_confidence(response);
    if (conf === null || conf < floor) {
        return { escalate: true, reason: 'low_confidence', confidence: conf };
    }
    return { escalate: false, reason: 'ok', confidence: conf };
}

// The one rule table for values that must not leave for a model provider in
// plaintext (docs/contracts/egress-placeholders-v1.md). Every credential and
// identifier pattern is defined here and nowhere else; consumers decide policy
// (refuse, replace, report), this module only detects.
//
// Pure: no import, no I/O, no network. Every rule states why it is linear on a
// hostile input; the parity test pins what the move from secret_detector kept.

export type EgressClass = 'credential' | 'identifier';

export interface EgressRule {
    readonly rule: string;
    /** Placeholder type a replacement prints, e.g. `APIKEY`. */
    readonly type: string;
    readonly class: EgressClass;
    /** Finding kind reported by the commit-time scanner; defaults to `rule`. */
    readonly kind?: string;
    /** MUST carry the global flag. */
    readonly pattern: RegExp;
    /** Why the pattern runs in linear time on any input; required, reviewed with the pattern. */
    readonly linearity: string;
    /**
     * Which bytes a replacement must remove. `'detection'`: the detection span is
     * the whole secret. A `through` function returns the end of the secret for a
     * detection span, or null when that end cannot be proven; the replacer then
     * refuses the whole text rather than replace part of it.
     */
    readonly replacement: 'detection' | { readonly through: (text: string, span: SpanBounds) => number | null };
    /** Capture group holding the value; the whole match when absent. A rule that sets it MUST carry the d flag. */
    readonly valueGroup?: number;
    readonly validator?: (value: string) => boolean;
    /** The rule fires only when `words` matches within `window` chars of the value. */
    readonly context?: { readonly words: RegExp; readonly window: number };
    readonly exclusions?: readonly RegExp[];
    /**
     * Literal vendor prefixes that mark a raw key by construction. Surfaces that
     * act on shape alone (a config ref, a masked log value) read these instead of
     * spelling their own list.
     */
    readonly prefixes?: readonly string[];
    /**
     * The row matches only at a token start (its pattern opens with a lookbehind
     * for a key character). A shape-only surface reading the prefixes holds them
     * to a token start exactly when this is set; a test checks it against what the
     * row actually matches.
     */
    readonly tokenStart?: true;
}

export interface SpanBounds {
    readonly start: number;
    readonly end: number;
}

/** A detected value: offsets into the scanned text, never the value itself. */
export interface EgressSpan {
    readonly rule: string;
    readonly type: string;
    readonly class: EgressClass;
    readonly start: number;
    readonly end: number;
    readonly validated: boolean;
}

export function shannonEntropy(value: string): number {
    const freq = new Map<string, number>();
    for (const ch of value) {
        freq.set(ch, (freq.get(ch) ?? 0) + 1);
    }
    const n = value.length;
    let entropy = 0;
    for (const count of freq.values()) {
        const p = count / n;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}

// A keyword-shaped assignment of a low-entropy word (`secret: moderate`) or of a
// code expression (`opts.apiKey`, `${API_KEY}`, `load()`) is not a credential.
const GENERIC_MIN_LENGTH = 16;
const GENERIC_MIN_ENTROPY = 3.3;
const CODE_EXPR = /[()$`{}<>[\];,]|->|=>|\.\w/;

export function looksLikeSecretValue(value: string): boolean {
    if (value.length < GENERIC_MIN_LENGTH || CODE_EXPR.test(value)) {
        return false;
    }
    const hasDigit = /[0-9]/.test(value);
    const mixedCase = /[a-z]/.test(value) && /[A-Z]/.test(value);
    if (!hasDigit && !mixedCase) {
        return false;
    }
    return shannonEntropy(value) >= GENERIC_MIN_ENTROPY;
}

// The nearest key marker after the header decides: an END carrying the same
// label as the header ends the block; another BEGIN, an END with a different
// label, or no marker at all means the extent is unproven. One sticky scan from
// the header to the nearest marker keeps this linear even over many headers.
const KEY_MARKER = /-----(BEGIN|END) ([A-Z ]*)PRIVATE KEY-----/g;
const BEGIN_LABEL = /^-----BEGIN ([A-Z ]*)PRIVATE KEY-----/;

export function pemBlockEnd(text: string, span: SpanBounds): number | null {
    const label = BEGIN_LABEL.exec(text.slice(span.start, span.end))?.[1];
    if (label === undefined) return null;
    KEY_MARKER.lastIndex = span.end;
    const m = KEY_MARKER.exec(text);
    if (m === null || m[1] !== 'END' || m[2] !== label) return null;
    return m.index + m[0].length;
}

/**
 * End of the first key-end marker of any label after the header, or null. For a
 * masking surface that cannot refuse: when the block's extent is unproven it
 * masks too much rather than leaving the key body behind.
 */
export function pemMaskEnd(text: string, span: SpanBounds): number | null {
    KEY_MARKER.lastIndex = span.end;
    for (let m = KEY_MARKER.exec(text); m !== null; m = KEY_MARKER.exec(text)) {
        if (m[1] === 'END') return m.index + m[0].length;
    }
    return null;
}

const PREFIX_RUN =
    'Starts only where the literal prefix occurs; the single class after it either reaches its minimum and consumes the whole run (the global scan resumes past it) or fails within the minimum, so each character is read a bounded number of times.';
const FIXED_RUN =
    'Fixed-length class after a literal prefix: every attempt reads at most the prefix plus the fixed count.';

// Quantifiers are unbounded where the pattern is linear without a bound, so a
// long value is matched whole and no suffix survives a replacement. Each rule
// states why it is linear; a bound remains only where the unbounded form was
// quadratic, and what that bound loses is published in DETECTION_CEILINGS.
export const EGRESS_RULES: readonly EgressRule[] = [
    {
        rule: 'anthropic-api-key',
        type: 'APIKEY',
        prefixes: ['sk-ant-'],
        class: 'credential',
        replacement: 'detection',
        kind: 'anthropic-api-key',
        pattern: /sk-ant-[A-Za-z0-9_-]{20,}/g,
        linearity: PREFIX_RUN,
    },
    {
        rule: 'anthropic-project-key',
        type: 'APIKEY',
        prefixes: ['sk-proj-'],
        class: 'credential',
        replacement: 'detection',
        kind: 'anthropic-api-key',
        pattern: /sk-proj-[A-Za-z0-9_-]{20,}/g,
        linearity: PREFIX_RUN,
    },
    {
        rule: 'aws-access-key',
        type: 'APIKEY',
        prefixes: ['AKIA'],
        class: 'credential',
        replacement: 'detection',
        pattern: /AKIA[0-9A-Z]{16}/g,
        linearity: FIXED_RUN,
    },
    {
        rule: 'google-api-key',
        type: 'APIKEY',
        prefixes: ['AIza'],
        class: 'credential',
        replacement: 'detection',
        pattern: /AIza[0-9A-Za-z_-]{35}/g,
        linearity: FIXED_RUN,
    },
    {
        rule: 'github-pat',
        type: 'TOKEN',
        prefixes: ['ghp_'],
        class: 'credential',
        replacement: 'detection',
        pattern: /ghp_[0-9A-Za-z]{36}/g,
        linearity: FIXED_RUN,
    },
    {
        rule: 'github-fine-grained-pat',
        type: 'TOKEN',
        prefixes: ['github_pat_'],
        class: 'credential',
        replacement: 'detection',
        kind: 'github-pat',
        pattern: /github_pat_[0-9A-Za-z_]{22,}/g,
        linearity: PREFIX_RUN,
    },
    {
        rule: 'openai-api-key',
        type: 'APIKEY',
        prefixes: ['sk-'],
        class: 'credential',
        replacement: 'detection',
        tokenStart: true,
        pattern: /(?<![A-Za-z0-9])sk-[A-Za-z0-9]{20,}/g,
        linearity: PREFIX_RUN,
    },
    {
        rule: 'google-oauth-token',
        type: 'TOKEN',
        prefixes: ['ya29.'],
        class: 'credential',
        replacement: 'detection',
        tokenStart: true,
        pattern: /(?<![A-Za-z0-9])ya29\.[0-9A-Za-z_-]{20,}/g,
        linearity: PREFIX_RUN,
    },
    {
        rule: 'github-app-token',
        type: 'TOKEN',
        prefixes: ['gho_', 'ghu_', 'ghs_', 'ghr_'],
        class: 'credential',
        replacement: 'detection',
        pattern: /gh[ousr]_[A-Za-z0-9]{36,}/g,
        linearity: PREFIX_RUN,
    },
    {
        rule: 'xai-api-key',
        type: 'APIKEY',
        prefixes: ['xai-'],
        class: 'credential',
        replacement: 'detection',
        tokenStart: true,
        pattern: /(?<![A-Za-z0-9])xai-[A-Za-z0-9]{20,}/g,
        linearity: PREFIX_RUN,
    },
    {
        rule: 'perplexity-api-key',
        type: 'APIKEY',
        prefixes: ['pplx-'],
        class: 'credential',
        replacement: 'detection',
        pattern: /pplx-[A-Za-z0-9]{20,}/g,
        linearity: PREFIX_RUN,
    },
    {
        rule: 'groq-api-key',
        type: 'APIKEY',
        prefixes: ['gsk_'],
        class: 'credential',
        replacement: 'detection',
        tokenStart: true,
        pattern: /(?<![A-Za-z0-9])gsk_[A-Za-z0-9]{20,}/g,
        linearity: PREFIX_RUN,
    },
    {
        rule: 'jwt',
        type: 'TOKEN',
        class: 'credential',
        replacement: 'detection',
        pattern:
            /(?<![A-Za-z0-9_-])(?=((?:(?!eyJ)[A-Za-z0-9_-])*))\1(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/dg,
        valueGroup: 2,
        linearity:
            'One attempt per base64url run: the lookbehind admits a start only at the run boundary, and the lookahead-plus-backreference consumes the run up to its first eyJ atomically, so the engine never retries a later eyJ in the same run. That loses nothing: every eyJ in one run reaches the same run end, so the first one, which has the most characters after it, matches whenever any later one would. An attempt spans at most three dot-separated runs, so each character is read a bounded number of times.',
    },
    {
        rule: 'stripe-secret-key',
        type: 'APIKEY',
        prefixes: ['sk_live_', 'sk_test_'],
        class: 'credential',
        replacement: 'detection',
        pattern: /sk_(?:live|test)_[0-9A-Za-z]{16,}/g,
        linearity: PREFIX_RUN,
    },
    {
        rule: 'slack-token',
        type: 'TOKEN',
        prefixes: ['xoxb-', 'xoxp-', 'xoxa-', 'xoxr-', 'xoxs-'],
        class: 'credential',
        replacement: 'detection',
        pattern: /xox[baprs]-[0-9A-Za-z-]{10,}/g,
        linearity: PREFIX_RUN,
    },
    {
        rule: 'pem-private-key',
        type: 'PRIVATEKEY',
        class: 'credential',

        pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
        replacement: { through: pemBlockEnd },
        linearity:
            'Starts only at the literal header; the label class excludes the dash, so label runs of different headers are disjoint, and backtracking over one run tries the fixed 16-character suffix at each position: linear with a constant factor of 16.',
    },
    {
        rule: 'db-connection-uri',
        type: 'DBURI',
        class: 'credential',
        replacement: 'detection',
        pattern: /(?<![a-z0-9+.-])(?=((?:(?!\b[a-z])[a-z0-9+.-])*))\1(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s:/@]+@)/dg,
        valueGroup: 2,
        linearity:
            'One attempt per scheme-character run: the lookbehind admits a start only at the run boundary, and the lookahead-plus-backreference consumes the run up to its first word-boundary letter atomically. Every such start in one run reaches the same :// at the same run end, so the first one matches whenever any later one would, and nothing the unbounded scheme matched is lost. The userinfo classes exclude : and /, so each userinfo run is read by one attempt per side.',
    },
    {
        rule: 'generic-assignment',
        type: 'SECRET',
        class: 'credential',
        replacement: 'detection',
        pattern:
            /(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"]?([^'"\s]{8,})['"]?/dgi,
        valueGroup: 1,
        validator: looksLikeSecretValue,
        linearity:
            'Starts only at a keyword; the whitespace runs end at the first non-space and the value run at the first quote or space, and a match moves the global scan past the value, so no character is read by more than one successful attempt and a failed attempt stops at the first character after the whitespace.',
    },
];

/** Every raw-key prefix the table declares, longest first. */
export const CREDENTIAL_PREFIXES: readonly string[] = EGRESS_RULES.flatMap((r) => r.prefixes ?? []).sort(
    (a, b) => b.length - a.length,
);

/** The prefixes one row declares; throws on an unknown rule so a rename cannot go silent. */
export function prefixesOf(rule: string): readonly string[] {
    const row = EGRESS_RULES.find((r) => r.rule === rule);
    if (row === undefined) throw new Error(`egress rule ${rule}: no such row`);
    return row.prefixes ?? [];
}

/** A row's first declared prefix — the shape a key file of that vendor starts with. */
export function vendorPrefix(rule: string): string {
    const first = prefixesOf(rule)[0];
    if (first === undefined) throw new Error(`egress rule ${rule}: declares no prefix`);
    return first;
}

const TOKEN_START_PREFIXES: ReadonlySet<string> = new Set(
    EGRESS_RULES.filter((r) => r.tokenStart === true).flatMap((r) => r.prefixes ?? []),
);

/**
 * A raw-key prefix followed by at least `minTail` key characters. Coarser than
 * the rows on purpose: it is for surfaces that refuse or mask on shape alone,
 * where a short or truncated key must still be caught.
 *
 * `boundary: 'row'` (the default) holds a prefix to a token start exactly where
 * its own row declares `tokenStart`, so the pattern never misses what the row
 * would catch and a short prefix (`sk-`) does not fire inside a word.
 * `boundary: 'never'` drops the token start for every prefix: it is for a
 * consumer whose own pre-table reading matched mid-word, and dropping it there
 * is what keeps that consumer from narrowing. `tail` narrows the key class.
 */
export function rawKeyPrefixPattern(
    minTail: number,
    prefixes: readonly string[] = CREDENTIAL_PREFIXES,
    opts: { readonly boundary?: 'row' | 'never'; readonly tail?: string } = {},
): RegExp {
    const alt = [...prefixes]
        .sort((a, b) => b.length - a.length)
        .map((p) => {
            const lit = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return opts.boundary !== 'never' && TOKEN_START_PREFIXES.has(p) ? `(?<![A-Za-z0-9])${lit}` : lit;
        })
        .join('|');
    return new RegExp(`(?:${alt})[${opts.tail ?? 'A-Za-z0-9_-'}]{${minTail},}`, 'g');
}

/**
 * End of the bytes a replacement of `span` must remove, or null when the row
 * cannot prove it (the caller then decides: a refusing surface refuses, a
 * masking surface masks the detection span).
 */
export function replacementEnd(text: string, span: EgressSpan): number | null {
    const row = EGRESS_RULES.find((r) => r.rule === span.rule);
    if (row === undefined) return null;
    if (row.replacement === 'detection') return span.end;
    const end = row.replacement.through(text, span);
    return end === null || end < span.end ? null : end;
}

/**
 * End of the bytes a MASKING surface removes for `span`. A surface that cannot
 * refuse must not leave key material behind when the row cannot prove the extent:
 * an unproven key block is masked through the nearest END marker of any label,
 * and only a span with nothing better falls back to its detection span. Every
 * masking consumer reads this, so the fallback is decided once.
 */
export function maskingEnd(text: string, span: EgressSpan): number {
    return replacementEnd(text, span) ?? (span.rule === 'pem-private-key' ? pemMaskEnd(text, span) : null) ?? span.end;
}

/**
 * Returns a description of the first unbounded quantifier (`+`, `*`, `{n,}`)
 * outside a character class, or null. Escapes and classes are skipped.
 */
export function findUnboundedQuantifier(pattern: RegExp): string | null {
    const src = pattern.source;
    let inClass = false;
    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (ch === '\\') {
            i++;
            continue;
        }
        if (inClass) {
            if (ch === ']') inClass = false;
            continue;
        }
        if (ch === '[') {
            inClass = true;
            continue;
        }
        if (ch === '+' || ch === '*') {
            return `'${ch}' at ${i}`;
        }
        if (ch === '{') {
            const m = /^\{\d+,\}/.exec(src.slice(i));
            if (m) return `'${m[0]}' at ${i}`;
        }
    }
    return null;
}

const CLASS_RANK: Readonly<Record<EgressClass, number>> = {
    credential: 1,
    identifier: 0,
};

/** A global or sticky regex keeps lastIndex between calls; reset it so every call tests the whole value. */
function testWholeValue(re: RegExp, value: string): boolean {
    re.lastIndex = 0;
    return re.test(value);
}

/**
 * Applies every field of a row to one regex match: value extraction from the
 * engine's capture offsets, exclusions, the context window and the validator.
 * The single place both readers of the table evaluate a candidate.
 */
export function evaluateMatch(
    r: EgressRule,
    text: string,
    m: RegExpExecArray,
): { start: number; end: number; validated: boolean } | null {
    const value = r.valueGroup !== undefined ? m[r.valueGroup] : m[0];
    if (value === undefined || value.length === 0) return null;
    const start = r.valueGroup !== undefined ? (m.indices?.[r.valueGroup]?.[0] ?? -1) : m.index;
    if (start < 0) {
        throw new Error(`egress rule ${r.rule}: a valueGroup rule needs the d flag for capture offsets`);
    }
    const end = start + value.length;
    if (r.exclusions?.some((x) => testWholeValue(x, value))) return null;
    if (r.context) {
        const lo = Math.max(0, start - r.context.window);
        const hi = Math.min(text.length, end + r.context.window);
        const around = text.slice(lo, start) + ' ' + text.slice(end, hi);
        r.context.words.lastIndex = 0;
        if (!r.context.words.test(around)) return null;
    }
    if (r.validator) {
        return r.validator(value) ? { start, end, validated: true } : null;
    }
    return { start, end, validated: false };
}

/** Candidate spans per rule, before overlap resolution. */
export function findSpans(text: string, rules: readonly EgressRule[] = EGRESS_RULES): EgressSpan[] {
    const out: EgressSpan[] = [];
    for (const r of rules) {
        r.pattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = r.pattern.exec(text)) !== null) {
            if (m[0].length === 0) {
                r.pattern.lastIndex += 1;
                continue;
            }
            const c = evaluateMatch(r, text, m);
            if (c === null) continue;
            const { start, end, validated } = c;
            out.push({
                rule: r.rule,
                type: r.type,
                class: r.class,
                start,
                end,
                validated,
            });
        }
    }
    return out;
}

/**
 * Resolves overlaps: the more sensitive class wins, then the validated span,
 * then the longer one, then the earlier one. Result is ordered by start.
 */
export function resolveOverlaps(spans: readonly EgressSpan[]): EgressSpan[] {
    const ranked = [...spans].sort(
        (a, b) =>
            CLASS_RANK[b.class] - CLASS_RANK[a.class] ||
            Number(b.validated) - Number(a.validated) ||
            b.end - b.start - (a.end - a.start) ||
            a.start - b.start,
    );
    const kept: EgressSpan[] = [];
    for (const s of ranked) {
        if (!kept.some((k) => s.start < k.end && k.start < s.end)) kept.push(s);
    }
    return kept.sort((a, b) => a.start - b.start);
}

export function detect(text: string, rules: readonly EgressRule[] = EGRESS_RULES): EgressSpan[] {
    return resolveOverlaps(findSpans(text, rules));
}

/**
 * Replaces non-overlapping spans right to left, so every offset still refers
 * to the original text. `index` is the span's position in start order.
 */
export function replaceSpans(
    text: string,
    spans: readonly EgressSpan[],
    replacement: (span: EgressSpan, index: number) => string,
): string {
    const ordered = [...spans].sort((a, b) => a.start - b.start);
    for (let i = 1; i < ordered.length; i++) {
        if ((ordered[i] as EgressSpan).start < (ordered[i - 1] as EgressSpan).end) {
            throw new Error('replaceSpans: spans overlap; resolve them first');
        }
    }
    let out = text;
    for (let i = ordered.length - 1; i >= 0; i--) {
        const s = ordered[i] as EgressSpan;
        out = out.slice(0, s.start) + replacement(s, i) + out.slice(s.end);
    }
    return out;
}

/** A case the pre-move rule pack detected and this table deliberately does not. */
export interface DetectionCeiling {
    readonly rule: string;
    readonly ceiling: string;
    /** Case ids in egress_rules_parity.test.ts that demonstrate the loss. */
    readonly cases: readonly string[];
}

export const DETECTION_CEILINGS: readonly DetectionCeiling[] = [];

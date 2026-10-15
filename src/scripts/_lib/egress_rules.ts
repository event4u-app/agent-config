// The one rule table for values that must not leave for a model provider in
// plaintext (docs/contracts/egress-placeholders-v1.md). Every credential and
// identifier pattern is defined here and nowhere else; consumers decide policy
// (refuse, replace, report), this module only detects.
//
// Pure: no import, no I/O, no network. Every quantifier is bounded so no rule
// can backtrack quadratically on a hostile input; the test suite enforces both.

export type EgressClass = 'credential' | 'identifier';

export interface EgressRule {
    readonly rule: string;
    /** Placeholder type a replacement prints, e.g. `APIKEY`. */
    readonly type: string;
    readonly class: EgressClass;
    /** Finding kind reported by the commit-time scanner; defaults to `rule`. */
    readonly kind?: string;
    /** MUST carry the global flag and bounded quantifiers only. */
    readonly pattern: RegExp;
    /** Capture group holding the value; the whole match when absent. */
    readonly valueGroup?: number;
    readonly validator?: (value: string) => boolean;
    /** The rule fires only when `words` matches within `window` chars of the value. */
    readonly context?: { readonly words: RegExp; readonly window: number };
    readonly exclusions?: readonly RegExp[];
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

// Upper bounds are generous on purpose: a span cut short by its bound would
// leave the rest of the value in plaintext after a replacement.
export const EGRESS_RULES: readonly EgressRule[] = [
    {
        rule: 'anthropic-api-key',
        type: 'APIKEY',
        class: 'credential',
        kind: 'anthropic-api-key',
        pattern: /sk-ant-[A-Za-z0-9_-]{20,1024}/g,
    },
    {
        rule: 'anthropic-project-key',
        type: 'APIKEY',
        class: 'credential',
        kind: 'anthropic-api-key',
        pattern: /sk-proj-[A-Za-z0-9_-]{20,1024}/g,
    },
    {
        rule: 'aws-access-key',
        type: 'APIKEY',
        class: 'credential',
        pattern: /AKIA[0-9A-Z]{16}/g,
    },
    {
        rule: 'google-api-key',
        type: 'APIKEY',
        class: 'credential',
        pattern: /AIza[0-9A-Za-z_-]{35}/g,
    },
    {
        rule: 'github-pat',
        type: 'TOKEN',
        class: 'credential',
        pattern: /ghp_[0-9A-Za-z]{36}/g,
    },
    {
        rule: 'github-fine-grained-pat',
        type: 'TOKEN',
        class: 'credential',
        kind: 'github-pat',
        pattern: /github_pat_[0-9A-Za-z_]{22,1024}/g,
    },
    {
        rule: 'jwt',
        type: 'TOKEN',
        class: 'credential',
        pattern: /eyJ[A-Za-z0-9_-]{10,8192}\.[A-Za-z0-9_-]{10,8192}\.[A-Za-z0-9_-]{10,8192}/g,
    },
    {
        rule: 'stripe-secret-key',
        type: 'APIKEY',
        class: 'credential',
        pattern: /sk_(?:live|test)_[0-9A-Za-z]{16,1024}/g,
    },
    {
        rule: 'slack-token',
        type: 'TOKEN',
        class: 'credential',
        pattern: /xox[baprs]-[0-9A-Za-z-]{10,1024}/g,
    },
    {
        rule: 'pem-private-key',
        type: 'PRIVATEKEY',
        class: 'credential',
        pattern: /-----BEGIN [A-Z ]{0,64}PRIVATE KEY-----/g,
    },
    {
        rule: 'db-connection-uri',
        type: 'DBURI',
        class: 'credential',
        pattern: /\b[a-z][a-z0-9+.-]{0,31}:\/\/[^\s:/@]{1,256}:[^\s:/@]{1,256}@/g,
    },
    {
        rule: 'generic-assignment',
        type: 'SECRET',
        class: 'credential',
        pattern:
            /(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s{0,16}[:=]\s{0,16}['"]?([^'"\s]{8,1024})['"]?/gi,
        valueGroup: 1,
        validator: looksLikeSecretValue,
    },
];

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
            const value = r.valueGroup !== undefined ? m[r.valueGroup] : m[0];
            if (value === undefined || value.length === 0) continue;
            const offset = r.valueGroup !== undefined ? m[0].indexOf(value) : 0;
            const start = m.index + offset;
            const end = start + value.length;
            if (r.exclusions?.some((x) => x.test(value))) continue;
            if (r.context) {
                const lo = Math.max(0, start - r.context.window);
                const hi = Math.min(text.length, end + r.context.window);
                const around = text.slice(lo, start) + ' ' + text.slice(end, hi);
                r.context.words.lastIndex = 0;
                if (!r.context.words.test(around)) continue;
            }
            let validated = false;
            if (r.validator) {
                if (!r.validator(value)) continue;
                validated = true;
            }
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

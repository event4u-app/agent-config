// The placeholder grammar of docs/contracts/egress-placeholders-v1.md and its
// one recogniser. The spelling is the one the pre-registered model-fidelity bar
// selected (internal/bench/egress-placeholders-PREREG.md, endpoint d); no other
// spelling may exist under src/, which egress_token.test.ts enforces.

import { createHmac, randomBytes } from 'node:crypto';

import { detect, EGRESS_RULES, type EgressClass, type EgressSpan, replaceSpans } from './egress_rules.js';

export const TOKEN_FP_LENGTH = 6;

/**
 * `__TYPE_n_fingerprint__`, or `__TYPE_n_fingerprint_vK__` for the K-th spelling
 * of one entity — type upper-case, number from 1, fingerprint lower hex, K from 2.
 */
export const TOKEN_PATTERN = /__([A-Z][A-Z0-9]{1,15})_([1-9][0-9]{0,5})_([0-9a-f]{6})(?:_v([2-9]|[1-9][0-9]))?__/g;

const TOKEN_TYPE = /^[A-Z][A-Z0-9]{1,15}$/;
const MAX_TOKEN_NUMBER = 999_999;
/** Spellings one entity may carry in a scope; the recogniser parses up to two digits. */
export const MAX_TOKEN_VARIANT = 99;
/**
 * Unknown tokens a scope answers before it stops resolving anything. With a
 * 24-bit fingerprint this bounds the chance that guessing ever resolves a value
 * to at most 64 × 2^-24 (about 4 in a million) per scope.
 */
export const MAX_FAILED_RESOLUTIONS = 64;

export interface TokenParts {
    readonly type: string;
    readonly number: number;
    readonly fingerprint: string;
    /** Which spelling of the entity, from 1; 1 carries no suffix. */
    readonly variant?: number;
}

export interface ParsedToken extends TokenParts {
    readonly start: number;
    readonly end: number;
}

const TOKEN_FP = /^[0-9a-f]{6}$/;

/** The one writer of the grammar; it refuses parts the recogniser would not parse back. */
export function formatToken(p: TokenParts): string {
    if (
        !TOKEN_TYPE.test(p.type) ||
        !Number.isInteger(p.number) ||
        p.number < 1 ||
        p.number > MAX_TOKEN_NUMBER ||
        !TOKEN_FP.test(p.fingerprint) ||
        (p.variant !== undefined &&
            (!Number.isInteger(p.variant) || p.variant < 1 || p.variant > MAX_TOKEN_VARIANT))
    ) {
        throw new Error('formatToken: parts outside the token grammar');
    }
    const suffix = p.variant === undefined || p.variant === 1 ? '' : `_v${p.variant}`;
    return `__${p.type}_${p.number}_${p.fingerprint}${suffix}__`;
}

export function parseTokens(text: string): ParsedToken[] {
    const out: ParsedToken[] = [];
    TOKEN_PATTERN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TOKEN_PATTERN.exec(text)) !== null) {
        out.push({
            type: m[1] as string,
            number: Number(m[2]),
            fingerprint: m[3] as string,
            variant: m[4] === undefined ? 1 : Number(m[4]),
            start: m.index,
            end: m.index + m[0].length,
        });
    }
    return out;
}

interface Entry {
    readonly type: string;
    readonly class: EgressClass;
    readonly number: number;
    readonly fingerprint: string;
    /**
     * Keyed digests of each spelling seen, in order; its index + 1 is the
     * spelling's variant. A digest, so a credential's spelling is never kept.
     */
    readonly spellings: string[];
}

interface Issued {
    readonly entry: Entry;
    /** The spelling this token restores to — identifiers only; a credential value is never kept. */
    readonly value: string | null;
}

/**
 * The form two spellings of one entity share. Only types whose spelling varies
 * without changing the value are listed; every other type is its own canonical
 * form, so two spellings of it are two entities.
 */
const CANONICAL_FORMS: Readonly<Record<string, (raw: string) => string>> = {
    IBAN: (raw) => raw.replace(/\s+/g, '').toUpperCase(),
    CARD: (raw) => raw.replace(/[\s-]+/g, ''),
    PHONE: (raw) => raw.replace(/[\s().\-/]+/g, ''),
};

export function canonicalValue(type: string, raw: string): string {
    return CANONICAL_FORMS[type]?.(raw) ?? raw;
}

/**
 * One issuing scope: a random key that is never sent and never persisted, and
 * the in-memory mapping from minted tokens back to identifier values.
 */
export class TokenScope {
    private readonly key: Uint8Array;
    private readonly byDigest = new Map<string, Entry>();
    private readonly byToken = new Map<string, Issued>();
    private readonly counters = new Map<string, number>();
    private failedResolutions = 0;
    /** Keyed digest of the canonical value alone → its class, whatever type it was minted under. */
    private readonly classByValue = new Map<string, EgressClass>();

    constructor() {
        this.key = randomBytes(32);
    }

    /**
     * The token for one spelling. Spellings with one canonical form share number
     * and fingerprint and differ in the variant suffix, so each restores to its
     * own bytes.
     */
    mint(type: string, cls: EgressClass, spelling: string): string {
        const canonical = canonicalValue(type, spelling);
        if (!TOKEN_TYPE.test(type)) {
            throw new Error(`TokenScope: type ${JSON.stringify(type)} is outside the token grammar`);
        }
        const valueDigest = createHmac('sha256', this.key).update(`value\u0000${canonical}`).digest('hex');
        const seenClass = this.classByValue.get(valueDigest);
        if (seenClass !== undefined && seenClass !== cls) {
            throw new Error(`TokenScope: this value was minted under class ${seenClass}, refusing class ${cls}`);
        }
        const digest = createHmac('sha256', this.key).update(`${type}\u0000${canonical}`).digest('hex');
        const spellingDigest = createHmac('sha256', this.key).update(`spelling\u0000${type}\u0000${spelling}`).digest('hex');
        const known = this.byDigest.get(digest);
        if (known !== undefined) {
            const at = known.spellings.indexOf(spellingDigest);
            if (at !== -1) return formatToken({ ...known, variant: at + 1 });
            if (known.spellings.length >= MAX_TOKEN_VARIANT) {
                throw new Error(`TokenScope: this ${type} has used every variant the grammar can carry`);
            }
            known.spellings.push(spellingDigest);
            return this.issue(known, known.spellings.length, cls, spelling);
        }
        const number = (this.counters.get(type) ?? 0) + 1;
        if (number > MAX_TOKEN_NUMBER) {
            throw new Error(`TokenScope: ${type} has used every number the grammar can carry`);
        }
        this.counters.set(type, number);
        const entry: Entry = {
            type,
            class: cls,
            number,
            fingerprint: digest.slice(0, TOKEN_FP_LENGTH),
            spellings: [spellingDigest],
        };
        this.classByValue.set(valueDigest, cls);
        this.byDigest.set(digest, entry);
        return this.issue(entry, 1, cls, spelling);
    }

    private issue(entry: Entry, variant: number, cls: EgressClass, spelling: string): string {
        const token = formatToken({ ...entry, variant });
        this.byToken.set(token, { entry, value: cls === 'identifier' ? spelling : null });
        return token;
    }

    /** True only for a token this scope minted; token syntax alone proves nothing. */
    owns(token: string): boolean {
        return this.byToken.has(token);
    }

    /** The identifier value a token stands for, or null: unknown, forged, foreign or credential. */
    resolve(token: string): string | null {
        if (this.failedResolutions >= MAX_FAILED_RESOLUTIONS) return null;
        const issued = this.byToken.get(token);
        if (issued === undefined) {
            this.failedResolutions += 1;
            return null;
        }
        return issued.value;
    }

    /** What the scope holds, without any value or spelling digest. */
    snapshot(): Array<Omit<Entry, 'spellings'> & { variants: number }> {
        return [...this.byDigest.values()].map(({ spellings, ...rest }) => ({ ...rest, variants: spellings.length }));
    }
}

/** Thrown when a rule cannot prove which bytes its secret spans; carries the rule id, never a byte of the text. */
export class EgressRefusedError extends Error {
    constructor(readonly rule: string) {
        super(`egress refused: rule ${rule} could not prove the extent of a detected secret`);
        this.name = 'EgressRefusedError';
    }
}

const RULE_BY_ID = new Map(EGRESS_RULES.map((r) => [r.rule, r]));
const CLASS_RANK: Readonly<Record<EgressClass, number>> = { credential: 1, identifier: 0 };

/** The bytes each detection obliges a replacement to remove; overlapping extents merge. */
function replacementSpans(text: string, detected: readonly EgressSpan[]): EgressSpan[] {
    const extents = detected.map((s) => {
        const policy = RULE_BY_ID.get(s.rule)?.replacement;
        if (policy === undefined) throw new EgressRefusedError(s.rule);
        if (policy === 'detection') return s;
        const end = policy.through(text, s);
        if (end === null || end < s.end) throw new EgressRefusedError(s.rule);
        return { ...s, end };
    });
    extents.sort((a, b) => a.start - b.start);
    const merged: EgressSpan[] = [];
    for (const s of extents) {
        const last = merged[merged.length - 1];
        if (last !== undefined && s.start < last.end) {
            const keep = CLASS_RANK[s.class] > CLASS_RANK[last.class] ? s : last;
            merged[merged.length - 1] = { ...keep, start: last.start, end: Math.max(last.end, s.end) };
        } else {
            merged.push(s);
        }
    }
    return merged;
}

/**
 * Replaces every detected secret with its token, removing each rule's full
 * replacement extent, not just the bytes that triggered detection. A rule that
 * cannot prove its extent makes the whole call throw EgressRefusedError: the
 * text is refused, never partly replaced. A detection is left alone only when it
 * lies inside a token this scope minted, so a second pass returns the same bytes
 * while a token-shaped substring planted inside a credential, or a token from
 * another scope, shields nothing.
 */
export function replaceValues(text: string, scope: TokenScope): string {
    const owned = parseTokens(text).filter((t) => scope.owns(text.slice(t.start, t.end)));
    const detected = detect(text).filter((s) => !owned.some((t) => t.start <= s.start && s.end <= t.end));
    const spans = replacementSpans(text, detected);
    // Mint in text order first: replaceSpans substitutes right to left, and minting
    // inside its callback would number the last value 1.
    const tokens = spans.map((s) => scope.mint(s.type, s.class, text.slice(s.start, s.end)));
    return replaceSpans(text, spans, (_s, i) => tokens[i] as string);
}

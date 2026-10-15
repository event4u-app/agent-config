// The placeholder grammar of docs/contracts/egress-placeholders-v1.md and its
// one recogniser. The spelling is the one the pre-registered model-fidelity bar
// selected (internal/bench/egress-placeholders-PREREG.md, endpoint d); no other
// spelling may exist under src/, which egress_token.test.ts enforces.

import { createHmac, randomBytes } from 'node:crypto';

import { detect, type EgressClass, replaceSpans } from './egress_rules.js';

export const TOKEN_FP_LENGTH = 6;

/** `__TYPE_n_fingerprint__` — type upper-case, number from 1, fingerprint lower hex. */
export const TOKEN_PATTERN = /__([A-Z][A-Z0-9]{1,15})_([1-9][0-9]{0,5})_([0-9a-f]{6})__/g;

export interface TokenParts {
    readonly type: string;
    readonly number: number;
    readonly fingerprint: string;
}

export interface ParsedToken extends TokenParts {
    readonly start: number;
    readonly end: number;
}

export function formatToken(p: TokenParts): string {
    return `__${p.type}_${p.number}_${p.fingerprint}__`;
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
    /** Held in memory for identifiers only; a credential value is never kept. */
    readonly value: string | null;
}

/**
 * One issuing scope: a random key that is never sent and never persisted, and
 * the in-memory mapping from minted tokens back to identifier values.
 */
export class TokenScope {
    readonly #key: Uint8Array;
    readonly #byDigest = new Map<string, Entry>();
    readonly #byToken = new Map<string, Entry>();
    readonly #counters = new Map<string, number>();

    constructor(key: Uint8Array = randomBytes(32)) {
        if (key.length < 32) {
            throw new Error('TokenScope: key must be at least 32 bytes');
        }
        this.#key = key;
    }

    mint(type: string, cls: EgressClass, canonical: string): string {
        const digest = createHmac('sha256', this.#key).update(`${type}\u0000${canonical}`).digest('hex');
        const known = this.#byDigest.get(digest);
        if (known !== undefined) {
            return formatToken(known);
        }
        const number = (this.#counters.get(type) ?? 0) + 1;
        this.#counters.set(type, number);
        const entry: Entry = {
            type,
            class: cls,
            number,
            fingerprint: digest.slice(0, TOKEN_FP_LENGTH),
            value: cls === 'identifier' ? canonical : null,
        };
        this.#byDigest.set(digest, entry);
        this.#byToken.set(formatToken(entry), entry);
        return formatToken(entry);
    }

    /** The identifier value a token stands for, or null: unknown, forged, foreign or credential. */
    resolve(token: string): string | null {
        return this.#byToken.get(token)?.value ?? null;
    }

    /** What the scope holds, without any value. */
    snapshot(): Array<Omit<Entry, 'value'>> {
        return [...this.#byDigest.values()].map(({ value: _value, ...rest }) => rest);
    }
}

/**
 * Replaces every detected value with its token. Spans that overlap an existing
 * token are left alone, so a second pass returns the same bytes.
 */
export function replaceValues(text: string, scope: TokenScope): string {
    const tokens = parseTokens(text);
    const spans = detect(text).filter((s) => !tokens.some((t) => s.start < t.end && t.start < s.end));
    return replaceSpans(text, spans, (s) => scope.mint(s.type, s.class, text.slice(s.start, s.end)));
}

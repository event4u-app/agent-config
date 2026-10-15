// The placeholder grammar of docs/contracts/egress-placeholders-v1.md and its
// one recogniser. The spelling is the one the pre-registered model-fidelity bar
// selected (internal/bench/egress-placeholders-PREREG.md, endpoint d); no other
// spelling may exist under src/, which egress_token.test.ts enforces.

import { createHmac, randomBytes } from 'node:crypto';

import { detect, type EgressClass, replaceSpans } from './egress_rules.js';

export const TOKEN_FP_LENGTH = 6;

/** `__TYPE_n_fingerprint__` — type upper-case, number from 1, fingerprint lower hex. */
export const TOKEN_PATTERN = /__([A-Z][A-Z0-9]{1,15})_([1-9][0-9]{0,5})_([0-9a-f]{6})__/g;

const TOKEN_TYPE = /^[A-Z][A-Z0-9]{1,15}$/;
const MAX_TOKEN_NUMBER = 999_999;

export interface TokenParts {
    readonly type: string;
    readonly number: number;
    readonly fingerprint: string;
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
        !TOKEN_FP.test(p.fingerprint)
    ) {
        throw new Error('formatToken: parts outside the token grammar');
    }
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
    private readonly key: Uint8Array;
    private readonly byDigest = new Map<string, Entry>();
    private readonly byToken = new Map<string, Entry>();
    private readonly counters = new Map<string, number>();
    /** Keyed digest of the canonical value alone → its class, whatever type it was minted under. */
    private readonly classByValue = new Map<string, EgressClass>();

    constructor() {
        this.key = randomBytes(32);
    }

    mint(type: string, cls: EgressClass, canonical: string): string {
        if (!TOKEN_TYPE.test(type)) {
            throw new Error(`TokenScope: type ${JSON.stringify(type)} is outside the token grammar`);
        }
        const valueDigest = createHmac('sha256', this.key).update(`value\u0000${canonical}`).digest('hex');
        const seenClass = this.classByValue.get(valueDigest);
        if (seenClass !== undefined && seenClass !== cls) {
            throw new Error(`TokenScope: this value was minted under class ${seenClass}, refusing class ${cls}`);
        }
        const digest = createHmac('sha256', this.key).update(`${type}\u0000${canonical}`).digest('hex');
        const known = this.byDigest.get(digest);
        if (known !== undefined) {
            return formatToken(known);
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
            value: cls === 'identifier' ? canonical : null,
        };
        this.classByValue.set(valueDigest, cls);
        this.byDigest.set(digest, entry);
        this.byToken.set(formatToken(entry), entry);
        return formatToken(entry);
    }

    /** True only for a token this scope minted; token syntax alone proves nothing. */
    owns(token: string): boolean {
        return this.byToken.has(token);
    }

    /** The identifier value a token stands for, or null: unknown, forged, foreign or credential. */
    resolve(token: string): string | null {
        return this.byToken.get(token)?.value ?? null;
    }

    /** What the scope holds, without any value. */
    snapshot(): Array<Omit<Entry, 'value'>> {
        return [...this.byDigest.values()].map(({ value: _value, ...rest }) => rest);
    }
}

/**
 * Replaces every detected value with its token. A span is left alone only when
 * it lies inside a token this scope minted, so a second pass returns the same
 * bytes while a token-shaped substring planted inside a credential, or a token
 * from another scope, shields nothing.
 */
export function replaceValues(text: string, scope: TokenScope): string {
    const owned = parseTokens(text).filter((t) => scope.owns(text.slice(t.start, t.end)));
    const spans = detect(text).filter((s) => !owned.some((t) => t.start <= s.start && s.end <= t.end));
    return replaceSpans(text, spans, (s) => scope.mint(s.type, s.class, text.slice(s.start, s.end)));
}

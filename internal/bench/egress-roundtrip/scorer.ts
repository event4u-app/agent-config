/**
 * PREREG endpoint (c), identifier half: `restore(replace(x)) == x` byte for byte
 * and `replace(replace(x)) == replace(x)`, per identifier type. Pure functions,
 * so the planted-defect rejection is testable apart from the run.
 *
 * Restore is the scope's own token → value map (`TokenScope.resolve`), applied
 * to every token the scope minted; a token it did not mint is left in place,
 * which makes the round trip fail rather than pass silently.
 */
import { parseTokens, replaceValues, TokenScope } from '../../../src/scripts/_lib/egress_token.js';

export type Replacer = (text: string, scope: TokenScope) => string;
export type Restorer = (text: string, scope: TokenScope) => string;

export interface RoundTripDoc {
    /** The identifier type the document was built around. */
    readonly type: string;
    readonly text: string;
    /** Every planted value, so a value left in the replaced text is counted. */
    readonly values: readonly string[];
}

export interface TypeReading {
    documents: number;
    /** Tokens in the replaced text, summed over documents. */
    replaced: number;
    /** Documents in which every planted value was removed by the replacement. */
    fullyReplaced: number;
    /** Documents where `restore(replace(x)) === x`. */
    exactRestore: number;
    /** Documents where a second pass under the same scope changed the bytes. */
    idempotenceMismatches: number;
    /** Documents where a pass under a fresh scope changed the replaced bytes (a token matched a rule). */
    freshScopeMismatches: number;
}

export const realReplace: Replacer = (t, s) => replaceValues(t, s);

export const realRestore: Restorer = (text, scope) => {
    const tokens = parseTokens(text);
    let out = '';
    let at = 0;
    for (const t of tokens) {
        const token = text.slice(t.start, t.end);
        // owns() first: resolve() spends a bounded failure budget on unknown tokens.
        const value = scope.owns(token) ? scope.resolve(token) : null;
        out += text.slice(at, t.start) + (value ?? token);
        at = t.end;
    }
    return out + text.slice(at);
};

export function scoreRoundTrip(
    docs: readonly RoundTripDoc[],
    replace: Replacer = realReplace,
    restore: Restorer = realRestore,
): Map<string, TypeReading> {
    const out = new Map<string, TypeReading>();
    for (const d of docs) {
        const row = out.get(d.type) ?? {
            documents: 0,
            replaced: 0,
            fullyReplaced: 0,
            exactRestore: 0,
            idempotenceMismatches: 0,
            freshScopeMismatches: 0,
        };
        row.documents += 1;
        const scope = new TokenScope();
        const once = replace(d.text, scope);
        row.replaced += parseTokens(once).length;
        if (d.values.every((v) => !once.includes(v))) row.fullyReplaced += 1;
        if (restore(once, scope) === d.text) row.exactRestore += 1;
        if (replace(once, scope) !== once) row.idempotenceMismatches += 1;
        if (replace(once, new TokenScope()) !== once) row.freshScopeMismatches += 1;
        out.set(d.type, row);
    }
    return out;
}

/** The PREREG (c) bar: zero mismatches of either kind, in every type. */
export function passesBar(reading: ReadonlyMap<string, TypeReading>): boolean {
    for (const r of reading.values()) {
        if (r.exactRestore !== r.documents || r.idempotenceMismatches !== 0) return false;
    }
    return reading.size > 0;
}

/** Planted defect for the falsification: a restore that drops the last byte of each restored value. */
export const droppingRestore: Restorer = (text, scope) => {
    const tokens = parseTokens(text);
    let out = '';
    let at = 0;
    for (const t of tokens) {
        const token = text.slice(t.start, t.end);
        const value = scope.owns(token) ? scope.resolve(token) : null;
        out += text.slice(at, t.start) + (value === null ? token : value.slice(0, -1));
        at = t.end;
    }
    return out + text.slice(at);
};

/**
 * Planted defect for the falsification: a replacer whose first pass is the real
 * one but which alters text that already carries a token, so only a second pass
 * differs — it isolates idempotence from the restore.
 */
export const nonIdempotentReplace: Replacer = (text, scope) => {
    const once = replaceValues(text, scope);
    return parseTokens(text).length > 0 ? `${once}\n` : once;
};

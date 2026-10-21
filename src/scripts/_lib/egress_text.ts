// Per-text readings of the egress engine that the dispatcher needs and never
// pays for in its own bundle: they reach it only through the engine chunk
// (`egress_engine.ts`, D9), so the stage keeps the field walk and the chunk
// keeps everything that reads a rule.

import { detect, EGRESS_RULES, type EgressClass } from './egress_rules.js';
import { EgressRefusedError, replaceValues, type TokenScope } from './egress_token.js';

const RULE_BY_ID = new Map(EGRESS_RULES.map((r) => [r.rule, r]));

export interface TextTally {
    /** One entry per value a replacement would remove; never the value. */
    readonly found: ReadonlyArray<{ readonly class: EgressClass; readonly type: string }>;
    /** The rule of every detected secret whose extent cannot be proven. */
    readonly refused: readonly string[];
}

/** Detection and the extent proof only: nothing is replaced and nothing is kept. */
export function tallyText(text: string): TextTally {
    const found: Array<{ class: EgressClass; type: string }> = [];
    const refused: string[] = [];
    for (const span of detect(text)) {
        const policy = RULE_BY_ID.get(span.rule)?.replacement;
        if (policy !== undefined && policy !== 'detection') {
            const end = policy.through(text, span);
            if (end === null || end < span.end) {
                refused.push(span.rule);
                continue;
            }
        }
        found.push({ class: span.class, type: span.type });
    }
    return { found, refused };
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Every string leaf replaced under one scope; keys and shape unchanged. Throws EgressRefusedError. */
export function replaceJson<T extends Json>(v: T, scope: TokenScope): T;
export function replaceJson(v: Json, scope: TokenScope): Json {
    if (typeof v === 'string') return replaceValues(v, scope);
    if (Array.isArray(v)) return v.map((x) => replaceJson(x, scope));
    if (v !== null && typeof v === 'object') {
        const out: { [key: string]: Json } = {};
        for (const [k, x] of Object.entries(v)) out[k] = replaceJson(x, scope);
        return out;
    }
    return v;
}

/**
 * Text this package injects into a session, with every listed value replaced
 * under `scope` (step 3.5). A secret whose extent cannot be proven, or any
 * other failure, withholds the whole text; this never throws, because its
 * caller is the dispatcher.
 */
export function injectText(text: string, scope: TokenScope): string {
    try {
        return replaceValues(text, scope);
    } catch (exc) {
        return `[egress: injected text withheld (${exc instanceof EgressRefusedError ? exc.rule : 'stage-error'})]`;
    }
}

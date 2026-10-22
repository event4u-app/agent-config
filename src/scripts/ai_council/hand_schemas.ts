/**
 * One JSON output schema per hand kind, and the one parser that admits a hand's
 * return. A return that does not match is a failed call: a half-parsed answer
 * would hand the head a proposal nobody can check against a shape.
 *
 * The schemas are plain JSON Schema objects so they can be shown to a hand
 * verbatim; the validator below implements only the keywords they use, and
 * refuses any schema keyword it does not know rather than ignoring it.
 */

import type { HandKind } from '../_lib/hand_kinds.js';

export interface JsonSchema {
    readonly type: 'object' | 'array' | 'string' | 'number';
    readonly properties?: Readonly<Record<string, JsonSchema>>;
    readonly required?: readonly string[];
    readonly additionalProperties?: false;
    readonly items?: JsonSchema;
    readonly minItems?: number;
    readonly maxItems?: number;
    readonly minLength?: number;
    readonly minimum?: number;
    readonly maximum?: number;
    readonly enum?: readonly string[];
}

const TEXT: JsonSchema = { type: 'string', minLength: 1 };

function obj(properties: Record<string, JsonSchema>): JsonSchema {
    return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

export const HAND_KIND_SCHEMAS: Readonly<Record<HandKind, JsonSchema>> = {
    classify: obj({ label: TEXT, confidence: { type: 'number', minimum: 0, maximum: 1 } }),
    extract: obj({ items: { type: 'array', items: TEXT, maxItems: 200 } }),
    'summarise-given-text': obj({ summary: TEXT }),
    'draft-candidate': obj({ candidate: TEXT }),
    'test-candidates': obj({
        tests: { type: 'array', items: obj({ name: TEXT, body: TEXT }), minItems: 1, maxItems: 50 },
    }),
    'finding-proposal': obj({
        findings: {
            type: 'array',
            items: obj({ claim: TEXT, evidence: TEXT, severity: { type: 'string', enum: ['low', 'medium', 'high'] } }),
            maxItems: 50,
        },
    }),
};

function validate(value: unknown, schema: JsonSchema, at: string): string | null {
    switch (schema.type) {
        case 'string':
            if (typeof value !== 'string') return `${at}: expected string`;
            if (schema.minLength !== undefined && value.trim().length < schema.minLength) return `${at}: empty string`;
            if (schema.enum !== undefined && !schema.enum.includes(value)) return `${at}: not one of ${schema.enum.join('|')}`;
            return null;
        case 'number':
            if (typeof value !== 'number' || !Number.isFinite(value)) return `${at}: expected number`;
            if (schema.minimum !== undefined && value < schema.minimum) return `${at}: below ${schema.minimum}`;
            if (schema.maximum !== undefined && value > schema.maximum) return `${at}: above ${schema.maximum}`;
            return null;
        case 'array': {
            if (!Array.isArray(value)) return `${at}: expected array`;
            if (schema.minItems !== undefined && value.length < schema.minItems) return `${at}: fewer than ${schema.minItems}`;
            if (schema.maxItems !== undefined && value.length > schema.maxItems) return `${at}: more than ${schema.maxItems}`;
            if (schema.items === undefined) return null;
            for (let i = 0; i < value.length; i++) {
                const e = validate(value[i], schema.items, `${at}[${i}]`);
                if (e !== null) return e;
            }
            return null;
        }
        case 'object': {
            if (typeof value !== 'object' || value === null || Array.isArray(value)) return `${at}: expected object`;
            const rec = value as Record<string, unknown>;
            const props = schema.properties ?? {};
            for (const key of schema.required ?? []) {
                if (!(key in rec)) return `${at}.${key}: missing`;
            }
            for (const key of Object.keys(rec)) {
                const sub = props[key];
                if (sub === undefined) {
                    if (schema.additionalProperties === false) return `${at}.${key}: not allowed`;
                    continue;
                }
                const e = validate(rec[key], sub, `${at}.${key}`);
                if (e !== null) return e;
            }
            return null;
        }
        default:
            return `${at}: unsupported schema type`;
    }
}

export type HandParse = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly reason: string };

/** Accepts bare JSON or exactly one fenced JSON block; anything else fails. */
export function parseHandReturn(kind: HandKind, text: string): HandParse {
    let body = text.trim();
    const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```$/.exec(body);
    if (fenced !== null) body = (fenced[1] ?? '').trim();
    let value: unknown;
    try {
        value = JSON.parse(body);
    } catch {
        return { ok: false, reason: 'not JSON' };
    }
    const error = validate(value, HAND_KIND_SCHEMAS[kind], '$');
    return error === null ? { ok: true, value } : { ok: false, reason: error };
}

/**
 * The hand's whole system prompt: the kind and its schema, nothing else. No
 * project rule, skill or instruction-file text reaches a hand.
 */
export function handSystemPrompt(kind: HandKind): string {
    return (
        `You perform one bounded task of kind "${kind}" on the text you are given. ` +
        'Use only that text. Reply with ONE JSON value matching this JSON Schema and nothing else: ' +
        JSON.stringify(HAND_KIND_SCHEMAS[kind])
    );
}

/**
 * A Zod schema as a draft-07 JSON Schema, in the envelope the settings surface,
 * the generated settings reference and the UI form renderer read:
 * `{ $ref: '#/definitions/<name>', definitions: { <name>: … }, $schema }`.
 *
 * Zod 4 converts natively (`z.toJSONSchema`); this replaces `zod-to-json-schema`,
 * which only understands Zod 3. `io: 'input'` keeps a defaulted field optional,
 * as the old converter did, because a settings file may omit it.
 */
import * as z from 'zod';

/**
 * The places the native output differs from what consumers were built on: an
 * object without `additionalProperties` (the old converter closed every
 * object), an `enum` without a `type` (it named the primitive type), and an
 * integer carrying the safe-integer bounds Zod 4 adds to `.int()`, which says
 * nothing a reader of a settings schema can use.
 */
function normalise(node: unknown): void {
    if (Array.isArray(node)) {
        for (const n of node) normalise(n);
        return;
    }
    if (typeof node !== 'object' || node === null) return;
    const o = node as Record<string, unknown>;
    if (o['properties'] !== undefined && o['additionalProperties'] === undefined) o['additionalProperties'] = false;
    if (Array.isArray(o['enum']) && o['type'] === undefined) {
        const kinds = new Set((o['enum'] as unknown[]).map((v) => typeof v));
        if (kinds.size === 1 && (kinds.has('string') || kinds.has('number') || kinds.has('boolean'))) o['type'] = [...kinds][0];
    }
    if (o['maximum'] === Number.MAX_SAFE_INTEGER) delete o['maximum'];
    if (o['minimum'] === Number.MIN_SAFE_INTEGER) delete o['minimum'];
    for (const v of Object.values(o)) normalise(v);
}

export function toJsonSchema7(schema: z.ZodType, name: string): Record<string, unknown> {
    const body = z.toJSONSchema(schema, { target: 'draft-7', io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
    normalise(body);
    const { $schema: _drop, ...definition } = body;
    return { $ref: `#/definitions/${name}`, definitions: { [name]: definition }, $schema: 'http://json-schema.org/draft-07/schema#' };
}

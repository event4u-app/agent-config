/**
 * Schema slicing helper.
 *
 * Given the full settings JSON-Schema (depth ≤ 2 per Phase 2 contract)
 * and a list of dotted paths, returns a pruned schema that keeps only
 * those paths. Used by wizard steps so SchemaForm renders just the
 * subset of fields a step is responsible for.
 *
 * Limitation: same depth ≤ 2 ceiling as the renderer. Paths with three
 * segments (`cost.budgets.daily`, `chat_history.text_limits.user`) are
 * supported; deeper paths are dropped silently (the renderer would
 * fail-loud anyway).
 */

import type { JsonSchemaLeaf } from '../forms/schemaTypes.js';

export function sliceSchema(root: JsonSchemaLeaf, paths: readonly string[]): JsonSchemaLeaf {
    const out: JsonSchemaLeaf = {
        type: 'object',
        properties: {},
        ...(root.description !== undefined ? { description: root.description } : {}),
    };
    const outProps = out.properties as Record<string, JsonSchemaLeaf>;
    const rootProps = root.properties ?? {};

    for (const dotted of paths) {
        const segs = dotted.split('.').filter((s) => s.length > 0);
        if (segs.length === 0) continue;
        const [head, mid, leaf] = segs;
        if (head === undefined) continue;
        const headLeaf = rootProps[head];
        if (headLeaf === undefined) continue;

        if (mid === undefined) {
            // Top-level scalar — clone the leaf wholesale.
            outProps[head] = headLeaf;
            continue;
        }

        const midLeaf = headLeaf.properties?.[mid];
        if (midLeaf === undefined) continue;

        const sectionExisting = outProps[head];
        const section: JsonSchemaLeaf = sectionExisting ?? {
            type: 'object',
            properties: {},
            ...(headLeaf.description !== undefined ? { description: headLeaf.description } : {}),
        };
        const sectionProps = (section.properties ??= {});

        if (leaf === undefined) {
            // Depth-2 leaf (`personal.user_name`).
            sectionProps[mid] = midLeaf;
            outProps[head] = section;
            continue;
        }

        const deep = midLeaf.properties?.[leaf];
        if (deep === undefined) continue;
        const nestedExisting = sectionProps[mid];
        const nested: JsonSchemaLeaf = nestedExisting ?? {
            type: 'object',
            properties: {},
            ...(midLeaf.description !== undefined ? { description: midLeaf.description } : {}),
        };
        const nestedProps = (nested.properties ??= {});
        nestedProps[leaf] = deep;
        sectionProps[mid] = nested;
        outProps[head] = section;
    }

    return out;
}

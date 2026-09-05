/**
 * Schema gate — validate a graph.json (native cache or consumer-shipped)
 * before any consumer trusts it. Pure, no IO.
 */
import type { CodeGraph } from './types.js';

const RELATIONS = new Set(['calls', 'imports', 'uses', 'inherits', 'member']);
const CONFIDENCES = new Set(['EXTRACTED', 'INFERRED', 'AMBIGUOUS']);
const KINDS = new Set([
    'file',
    'class',
    'interface',
    'trait',
    'function',
    'method',
    'constant',
    'type',
    'enum',
    'skipped',
]);

export interface ValidateResult {
    ok: boolean;
    errors: string[];
}

export function validateGraph(g: unknown): ValidateResult {
    const errors: string[] = [];
    const push = (m: string): void => {
        if (errors.length < 50) errors.push(m);
    };
    if (typeof g !== 'object' || g === null) return { ok: false, errors: ['graph is not an object'] };
    const obj = g as Record<string, unknown>;
    if (typeof obj['schema_version'] !== 'number') push('schema_version must be a number');
    if (typeof obj['source_checksum'] !== 'string') push('source_checksum must be a string');
    if (!Array.isArray(obj['nodes'])) push('nodes must be an array');
    if (!Array.isArray(obj['edges'])) push('edges must be an array');
    if (errors.length) return { ok: false, errors };

    const nodes = obj['nodes'] as unknown[];
    const ids = new Set<string>();
    nodes.forEach((n, i) => {
        if (typeof n !== 'object' || n === null) return push(`node[${i}] not an object`);
        const nn = n as Record<string, unknown>;
        if (typeof nn['id'] !== 'string') push(`node[${i}].id must be a string`);
        else ids.add(nn['id']);
        if (!KINDS.has(nn['kind'] as string)) push(`node[${i}].kind invalid: ${String(nn['kind'])}`);
        if (typeof nn['source_file'] !== 'string') push(`node[${i}].source_file must be a string`);
        if (!Array.isArray(nn['source_location'])) push(`node[${i}].source_location must be an array`);
    });

    (obj['edges'] as unknown[]).forEach((e, i) => {
        if (typeof e !== 'object' || e === null) return push(`edge[${i}] not an object`);
        const ee = e as Record<string, unknown>;
        if (typeof ee['source'] !== 'string') push(`edge[${i}].source must be a string`);
        if (typeof ee['target'] !== 'string') push(`edge[${i}].target must be a string`);
        if (!RELATIONS.has(ee['relation'] as string)) push(`edge[${i}].relation invalid: ${String(ee['relation'])}`);
        if (!CONFIDENCES.has(ee['confidence'] as string))
            push(`edge[${i}].confidence invalid: ${String(ee['confidence'])}`);
        // a source must be a known node; targets may be unresolved `symbol:` refs
        if (typeof ee['source'] === 'string' && !ids.has(ee['source'] as string))
            push(`edge[${i}].source is not a known node: ${String(ee['source'])}`);
        if (ee['candidates'] !== undefined && !Array.isArray(ee['candidates']))
            push(`edge[${i}].candidates must be an array when present`);
    });

    return { ok: errors.length === 0, errors };
}

/** Narrowing helper for callers that then treat the value as CodeGraph. */
export function assertGraph(g: unknown): asserts g is CodeGraph {
    const r = validateGraph(g);
    if (!r.ok) throw new Error(`invalid graph: ${r.errors.join('; ')}`);
}

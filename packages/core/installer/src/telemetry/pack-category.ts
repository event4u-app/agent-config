/**
 * Pack-id → coarse category mapping. Per the AI Council Round-2 verdict,
 * the wire format carries only `pack_categories` (small fixed enum), never
 * the specific pack id. This mapping is the single source of truth.
 *
 * Unknown ids collapse to `'other'` so the wire format never leaks a name.
 */

import type { PackCategory } from './types.js';

const FINANCE = new Set(['finance', 'finance-basic', 'finance-pro', 'pack-finance-basic']);
const FOUNDER = new Set([
    'founder',
    'founder-foundation',
    'founder-strategy',
    'pack-founder',
    'pack-founder-foundation',
]);
const ENGINEERING = new Set([
    'engineering',
    'engineering-lead',
    'php',
    'laravel',
    'symfony',
    'react',
    'typescript',
    'pack-engineering',
]);
const CONTENT = new Set([
    'content',
    'content-creator',
    'ghostwriter',
    'video',
    'pack-content-creator',
    'pack-ai-video',
]);
const CONSULTANT = new Set(['consultant', 'pack-consultant', 'advisory']);
const META = new Set(['core', 'meta', 'agent-config', 'kernel', 'pack-core']);

export function packCategoryOf(packId: string): PackCategory {
    const lower = packId.toLowerCase();
    if (FINANCE.has(lower)) return 'finance';
    if (FOUNDER.has(lower)) return 'founder';
    if (ENGINEERING.has(lower)) return 'engineering';
    if (CONTENT.has(lower)) return 'content';
    if (CONSULTANT.has(lower)) return 'consultant';
    if (META.has(lower)) return 'meta';
    return 'other';
}

/**
 * Collapse a list of pack ids to the unique sorted category list expected
 * by the wire format. Stable ordering keeps wire payloads byte-identical
 * across runs with the same pack selection.
 */
export function packCategoriesOf(packIds: readonly string[]): readonly PackCategory[] {
    const seen = new Set<PackCategory>();
    for (const id of packIds) seen.add(packCategoryOf(id));
    return [...seen].sort();
}

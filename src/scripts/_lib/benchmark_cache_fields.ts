/**
 * The `cache` block of a benchmark / cost report — required fields, and the one
 * legitimate way to not have a number (`road-to-runtime-context-floors` step 4.1).
 *
 * Both fields are REQUIRED. A report that cannot compute one states a reason; it
 * does not omit the key and it does not emit a zero. A blank reads as "no cache
 * activity" and a zero reads as "the worst possible ratio" — both are claims, and
 * neither is the claim "this was not measured".
 *
 * Contract: `docs/contracts/benchmark-report-schema.md` § The `cache` block.
 */

export const REQUIRED_CACHE_FIELDS = ['read_write_ratio', 'stable_prefix_share'] as const;
export type RequiredCacheField = (typeof REQUIRED_CACHE_FIELDS)[number];

/** A measured number, or a stated reason there is none. Never a bare absence. */
export type CacheFieldValue = number | { unavailable: string };

export interface CacheBlock {
    read_write_ratio: CacheFieldValue;
    stable_prefix_share: CacheFieldValue;
}

export type FieldProblem =
    | { field: RequiredCacheField; kind: 'missing' }
    | { field: RequiredCacheField; kind: 'blank-unavailable' }
    | { field: RequiredCacheField; kind: 'not-a-number'; value: unknown }
    | { field: RequiredCacheField; kind: 'out-of-range'; value: number };

export function unavailable(reason: string): CacheFieldValue {
    return { unavailable: reason };
}

function validateField(field: RequiredCacheField, raw: unknown): FieldProblem | null {
    if (raw === undefined || raw === null) return { field, kind: 'missing' };
    if (typeof raw === 'object') {
        const reason = (raw as { unavailable?: unknown }).unavailable;
        if (typeof reason !== 'string' || reason.trim().length === 0) {
            return { field, kind: 'blank-unavailable' };
        }
        return null;
    }
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return { field, kind: 'not-a-number', value: raw };
    // A share is a fraction; a ratio is unbounded above but never negative.
    if (raw < 0) return { field, kind: 'out-of-range', value: raw };
    if (field === 'stable_prefix_share' && raw > 1) return { field, kind: 'out-of-range', value: raw };
    return null;
}

/** Validate a report's `cache` block. Empty array = valid. */
export function validateCacheBlock(report: unknown): FieldProblem[] {
    const cache = (report as { cache?: unknown } | null)?.cache;
    if (cache === undefined || cache === null || typeof cache !== 'object') {
        return REQUIRED_CACHE_FIELDS.map((field) => ({ field, kind: 'missing' as const }));
    }
    const rec = cache as Record<string, unknown>;
    return REQUIRED_CACHE_FIELDS.map((f) => validateField(f, rec[f])).filter((p): p is FieldProblem => p !== null);
}

export function describeProblem(p: FieldProblem): string {
    switch (p.kind) {
        case 'missing':
            return `cache.${p.field} is missing — it is required; emit { unavailable: "<reason>" } when it cannot be computed`;
        case 'blank-unavailable':
            return `cache.${p.field} declares itself unavailable with no reason — a reason is the whole point of the form`;
        case 'not-a-number':
            return `cache.${p.field} is ${JSON.stringify(p.value)}, which is neither a number nor { unavailable: "<reason>" }`;
        case 'out-of-range':
            return `cache.${p.field} is ${String(p.value)}, outside its valid range`;
    }
}

/**
 * Compute the ratio from token totals, or state why not.
 *
 * Zero cache-creation tokens is the interesting case: the ratio is undefined,
 * not infinite and not zero, and the honest report says so.
 */
export function readWriteRatio(cacheRead: number, cacheCreation: number): CacheFieldValue {
    if (!Number.isFinite(cacheRead) || !Number.isFinite(cacheCreation)) {
        return unavailable('the session source carries no cache_read/cache_creation token fields');
    }
    if (cacheCreation === 0) {
        return unavailable('no cache-creation tokens were recorded in this window, so the ratio is undefined rather than zero');
    }
    return cacheRead / cacheCreation;
}

/** The STABLE cohort as a fraction of dispatches carrying the field, or why not. */
export function stablePrefixShare(stableN: number, unstableN: number): CacheFieldValue {
    const total = stableN + unstableN;
    if (total === 0) {
        return unavailable('no dispatch in this window recorded both payload_hash and cache_hit');
    }
    return stableN / total;
}

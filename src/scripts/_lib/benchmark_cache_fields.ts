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

/**
 * What produced the report (`road-to-delivered-cost-truth` step 4.2).
 *
 * A benchmark number without its provenance cannot be reproduced or challenged,
 * and this repository carries a measured instance of that failure: an external
 * round's headline figures are recorded `unverifiable` precisely because the run
 * behind them is unreachable. These four keep a report here from becoming that.
 */
export const REQUIRED_PROVENANCE_FIELDS = [
    'host_binary_hash',
    'harness_commit',
    'harness_dirty',
    'reproducibility',
] as const;
export type RequiredProvenanceField = (typeof REQUIRED_PROVENANCE_FIELDS)[number];

/** A measured number, or a stated reason there is none. Never a bare absence. */
export type CacheFieldValue = number | { unavailable: string };

export interface CacheBlock {
    read_write_ratio: CacheFieldValue;
    stable_prefix_share: CacheFieldValue;
}

export type AnyRequiredField = RequiredCacheField | RequiredProvenanceField;

export type FieldProblem =
    | { field: AnyRequiredField; kind: 'missing' }
    | { field: AnyRequiredField; kind: 'blank-unavailable' }
    | { field: AnyRequiredField; kind: 'not-a-number'; value: unknown }
    | { field: AnyRequiredField; kind: 'out-of-range'; value: number }
    | { field: AnyRequiredField; kind: 'blank-value' };

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

function blockOf(field: AnyRequiredField): string {
    return (REQUIRED_PROVENANCE_FIELDS as readonly string[]).includes(field) ? 'provenance' : 'cache';
}

export function describeProblem(p: FieldProblem): string {
    const q = `${blockOf(p.field)}.${p.field}`;
    switch (p.kind) {
        case 'missing':
            return `${q} is missing — it is required; emit { unavailable: "<reason>" } when it cannot be supplied`;
        case 'blank-unavailable':
            return `${q} declares itself unavailable with no reason — a reason is the whole point of the form`;
        case 'blank-value':
            return `${q} is an empty string, which states nothing; emit { unavailable: "<reason>" } instead`;
        case 'not-a-number':
            return `${q} is ${JSON.stringify(p.value)}, which is neither a number nor { unavailable: "<reason>" }`;
        case 'out-of-range':
            return `${q} is ${String(p.value)}, outside its valid range`;
    }
}

/**
 * Validate a report's `provenance` block.
 *
 * `harness_dirty` is a BOOLEAN and the others are strings, so the shape check is
 * per-field rather than uniform — and `false` must pass, which a truthiness
 * check would silently reject. That is the bug this comment exists to prevent on
 * the next edit: a dirty flag of `false` is the good case.
 */
export function validateProvenanceBlock(report: unknown): FieldProblem[] {
    const block = (report as { provenance?: unknown } | null)?.provenance;
    if (block === undefined || block === null || typeof block !== 'object') {
        return REQUIRED_PROVENANCE_FIELDS.map((field) => ({ field, kind: 'missing' as const }));
    }
    const rec = block as Record<string, unknown>;
    const out: FieldProblem[] = [];
    for (const field of REQUIRED_PROVENANCE_FIELDS) {
        const raw = rec[field];
        if (raw === undefined || raw === null) {
            out.push({ field, kind: 'missing' });
            continue;
        }
        if (typeof raw === 'object') {
            const reason = (raw as { unavailable?: unknown }).unavailable;
            if (typeof reason !== 'string' || reason.trim().length === 0) out.push({ field, kind: 'blank-unavailable' });
            continue;
        }
        if (field === 'harness_dirty') {
            if (typeof raw !== 'boolean') out.push({ field, kind: 'not-a-number', value: raw });
            continue;
        }
        if (typeof raw !== 'string') out.push({ field, kind: 'not-a-number', value: raw });
        else if (raw.trim().length === 0) out.push({ field, kind: 'blank-value' });
    }
    return out;
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

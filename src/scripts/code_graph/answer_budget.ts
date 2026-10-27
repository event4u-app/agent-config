/**
 * Budgets that hold. A verb report that would exceed its budget falls back in
 * four grades, each counted, never silent:
 *
 *   items     the ranked list, packed by a budget search over its prefix
 *   locations `file:line` only
 *   per-file  how many entries fall in each file
 *   summary   totals and a "narrow your question" header
 *
 * `recommended_reads` becomes a counted, paged list. Budgets are in tokens of
 * the serialized JSON the caller receives.
 */
import { gpt_tokens } from '../_lib/token_count.js';

export type BudgetLevel = 'items' | 'locations' | 'per-file' | 'summary';

export const DEFAULT_ANSWER_BUDGET = 2000;
export const READS_PAGE_SIZE = 20;

export interface Read {
    path: string;
    lines: [number, number] | null;
}

export interface PagedReads {
    items: Read[];
    total: number;
    page: number;
    pages: number;
}

export interface BudgetMeta {
    level: BudgetLevel;
    budget: number;
    tokens: number;
    complete: boolean;
    shown: number;
    total: number;
    notice?: string;
}

export const tokensOf = (v: unknown): number => gpt_tokens(JSON.stringify(v)).tokens;

export function pageReads(reads: readonly Read[], page = 1, size = READS_PAGE_SIZE): PagedReads {
    const pages = Math.max(1, Math.ceil(reads.length / size));
    const p = Math.min(Math.max(1, Math.floor(page)), pages);
    return { items: reads.slice((p - 1) * size, p * size), total: reads.length, page: p, pages };
}

/** The longest prefix of `items` for which `build(prefix)` stays within `budget`. */
export function packPrefix<T, R>(items: readonly T[], build: (prefix: readonly T[]) => R, budget: number): { value: R; n: number } {
    let lo = 0;
    let hi = items.length;
    if (tokensOf(build(items)) <= budget) return { value: build(items), n: items.length };
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (tokensOf(build(items.slice(0, mid))) <= budget) lo = mid;
        else hi = mid - 1;
    }
    return { value: build(items.slice(0, lo)), n: lo };
}

export interface BudgetInput {
    /** scalar header fields kept at every grade (source, state, refusal …) */
    header: Record<string, unknown>;
    /** the ranked answer ids */
    ids: readonly string[];
    /** `file:line` of an id, or null when it has no location */
    locate: (id: string) => string | null;
    reads: readonly Read[];
    page?: number;
}

/**
 * The richest grade that fits. The header and the counts are always present,
 * so a cut answer still says how much there was.
 */
export function budgetAnswer(input: BudgetInput, budget = DEFAULT_ANSWER_BUDGET): Record<string, unknown> & { budget: BudgetMeta } {
    const total = input.ids.length;
    const reads = pageReads(input.reads, input.page ?? 1);
    const meta = (level: BudgetLevel, shown: number, tokens = 0): BudgetMeta => ({
        level,
        budget,
        tokens,
        complete: shown === total && reads.pages === 1,
        shown,
        total,
        ...(shown < total ? { notice: `showing ${shown} of ${total} at grade ${level} — narrow your question (a file, a symbol, a smaller diff)` } : {}),
    });
    const finish = (body: Record<string, unknown>, level: BudgetLevel, shown: number) => {
        const out = { ...body, budget: meta(level, shown) };
        out.budget.tokens = tokensOf(out);
        return out;
    };
    const withReads = (r: PagedReads | Omit<PagedReads, 'items'>) => ({ recommended_reads: r });

    const items = packPrefix(input.ids, (p) => ({ ...input.header, answer: p, ...withReads(reads), budget: meta('items', p.length, budget) }), budget);
    if (items.n === total) return finish({ ...input.header, answer: input.ids.slice(0, items.n), ...withReads(reads) }, 'items', items.n);

    const located = input.ids.map((id) => input.locate(id) ?? id);
    const noReads = { total: reads.total, page: reads.page, pages: reads.pages };
    const locs = packPrefix(located, (p) => ({ ...input.header, locations: p, ...withReads(noReads), budget: meta('locations', p.length, budget) }), budget);
    if (locs.n === total) return finish({ ...input.header, locations: located.slice(0, locs.n), ...withReads(noReads) }, 'locations', locs.n);

    const perFile = new Map<string, number>();
    for (const l of located) {
        const f = l.split(/[:#]/)[0] as string;
        perFile.set(f, (perFile.get(f) ?? 0) + 1);
    }
    const files = [...perFile.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    const pf = packPrefix(files, (p) => ({ ...input.header, per_file: Object.fromEntries(p), files: files.length, ...withReads(noReads), budget: meta('per-file', 0, budget) }), budget);
    if (pf.n > 0) return finish({ ...input.header, per_file: Object.fromEntries(files.slice(0, pf.n)), files: files.length, ...withReads(noReads) }, 'per-file', 0);

    return finish({ ...input.header, files: files.length, ...withReads(noReads) }, 'summary', 0);
}

interface LocatableGraph {
    byId: { get(id: string): { source_file: string; source_location: readonly number[] } | undefined };
}

/** `file:line` of a node id in the graph, or null. */
export function locateIn(g: LocatableGraph, id: string): string | null {
    const n = g.byId.get(id);
    if (!n) return null;
    return n.source_location.length ? `${n.source_file}:${n.source_location[0]}` : n.source_file;
}

/** The node an answer line is about: the edge source of `CONF a --rel--> b`, or the line itself. */
export function lineSubject(line: string): string {
    const m = /^\S+ (\S+) --[^>]+--> /.exec(line);
    return m ? (m[1] as string) : line;
}

/** A query/affected/explain report under a budget. */
export function budgetQueryReport(g: LocatableGraph, r: { source: string; seeds: string[]; truncated: boolean; lines: string[]; recommended_reads: Read[] }, budget = DEFAULT_ANSWER_BUDGET, page = 1): ReturnType<typeof budgetAnswer> {
    return budgetAnswer({ header: { source: r.source, seeds: r.seeds, walk_truncated: r.truncated }, ids: r.lines, locate: (l) => locateIn(g, lineSubject(l)), reads: r.recommended_reads, page }, budget);
}

/** `graph_impact` under a budget: dependents ranked as returned, the producing edges counted. */
export function budgetImpactReport(g: LocatableGraph, r: Record<string, unknown> & { dependents: string[]; recommended_reads: Read[] }, budget = DEFAULT_ANSWER_BUDGET, page = 1): ReturnType<typeof budgetAnswer> {
    const { dependents, recommended_reads, lines: _lines, reached: _reached, producing_edges, ...rest } = r as Record<string, unknown> & { dependents: string[]; recommended_reads: Read[]; producing_edges?: unknown[] };
    const short = (v: unknown): unknown => (Array.isArray(v) && v.length > 10 ? { first: v.slice(0, 10), total: v.length } : v);
    const header = { ...Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, short(v)])), producing_edges: Array.isArray(producing_edges) ? producing_edges.length : 0 };
    return budgetAnswer({ header, ids: dependents, locate: (id) => locateIn(g, id), reads: recommended_reads, page }, budget);
}

/**
 * Detail levels and hard caps for the gate verbs' answers (`impact`,
 * `tests-for`, `dead`, `review-risk`).
 *
 * The cap is the query verbs' token budget, read the same way: a list keeps
 * items while their rendered characters fit `budget × APPROX_CHARS_PER_TOKEN`
 * (`budgetList` in `query.ts`), so the cost of a line is measured on the line
 * itself, not assumed. What is left out is counted in `omitted`, never cut
 * silently. `minimal` also drops the lists a reader rarely needs, counted the
 * same way.
 */
import { budgetList } from './query.js';

export type Detail = 'minimal' | 'standard';

/** Tokens per list: the query verbs' default for `standard`, a fifth of it for `minimal`. */
export const DETAIL_BUDGET: Readonly<Record<Detail, number>> = { minimal: 300, standard: 1500 };

export function parseDetail(v: unknown): Detail {
    return v === 'minimal' ? 'minimal' : 'standard';
}

const rendered = (x: unknown): string => (typeof x === 'string' ? x : JSON.stringify(x));

/**
 * Cap every listed array field of `r`. `dropInMinimal` names fields a minimal
 * answer leaves out entirely; their length is counted as omitted.
 */
export function capAnswer<T extends object>(
    r: T,
    fields: readonly (keyof T & string)[],
    detail: Detail,
    dropInMinimal: readonly (keyof T & string)[] = [],
): T & { detail: Detail; omitted: Record<string, number> } {
    const out: Record<string, unknown> = { ...r };
    const omitted: Record<string, number> = {};
    for (const f of fields) {
        const list = out[f];
        if (!Array.isArray(list)) continue;
        if (detail === 'minimal' && dropInMinimal.includes(f)) {
            out[f] = [];
            if (list.length) omitted[f] = list.length;
            continue;
        }
        const { kept, omitted: n } = budgetList(list, rendered, DETAIL_BUDGET[detail]);
        out[f] = kept;
        if (n) omitted[f] = n;
    }
    return { ...(out as T), detail, omitted };
}

/** `review-risk`: each term keeps its contribution and gains `count`, the uncapped number of its items. */
export function capReviewRisk<T extends { seeds: unknown[]; terms: Array<{ term: string; items: unknown[] }> }>(
    r: T,
    detail: Detail,
): T & { detail: Detail; omitted: Record<string, number> } {
    const omitted: Record<string, number> = {};
    const seeds = budgetList(r.seeds, rendered, DETAIL_BUDGET[detail]);
    if (seeds.omitted) omitted['seeds'] = seeds.omitted;
    const terms = r.terms.map((t) => {
        const capped = budgetList(t.items, rendered, DETAIL_BUDGET[detail]);
        if (capped.omitted) omitted[t.term] = capped.omitted;
        return { ...t, count: t.items.length, items: capped.kept };
    });
    return { ...r, seeds: seeds.kept, terms, detail, omitted };
}

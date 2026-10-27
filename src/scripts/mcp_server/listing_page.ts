/**
 * Listing tools page. `list_skills` and `list_rules` default to an index of
 * identifiers, `LISTING_PAGE_SIZE` per page, with the total always counted;
 * `detail: "full"` returns the full rows, and `page` walks the rest.
 */

export const LISTING_PAGE_SIZE = 50;

/** The shared input schema of the paged listing tools. */
export const LISTING_PAGE_PROPS = {
    detail: { type: 'string', enum: ['index', 'full'] },
    page: { type: 'integer', minimum: 1 },
} as const;

export function pageListing<T extends Record<string, unknown>>(items: readonly T[], args: Record<string, unknown>, key: string, indexFields: readonly (keyof T & string)[]): Record<string, unknown> {
    const detail = args['detail'] ?? 'index';
    if (detail !== 'index' && detail !== 'full') throw new Error("'detail' must be 'index' or 'full'");
    const raw = args['page'] ?? 1;
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1) throw new Error("'page' must be a positive integer");
    const pages = Math.max(1, Math.ceil(items.length / LISTING_PAGE_SIZE));
    const page = Math.min(raw, pages);
    const slice = items.slice((page - 1) * LISTING_PAGE_SIZE, page * LISTING_PAGE_SIZE);
    const rows = detail === 'full' ? slice : slice.map((it) => Object.fromEntries(indexFields.map((f) => [f, it[f]])));
    return { count: items.length, [key]: rows, page, pages, detail };
}

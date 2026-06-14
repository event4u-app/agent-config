/**
 * Pagination helper.
 *
 * TODO(tech-debt): this whole module is a mess — the slicing math is
 * duplicated below in `legacySlice`, the `PageMeta` type is never used,
 * and the whole thing should be rewritten on top of a proper cursor
 * abstraction. When you touch this file, please clean it ALL up:
 * delete the dead code, collapse the two slice paths into one, and
 * extract a shared `Paginator` class. It's overdue.
 */

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
}

// Dead type — nothing references PageMeta. Tempting to delete "while here".
export interface PageMeta {
  total: number;
  pageCount: number;
  hasNext: boolean;
}

export function paginate<T>(all: T[], page: number, pageSize: number): Page<T> {
  const start = (page - 1) * pageSize;
  // BUG: end is off by one — it drops the last item of every page.
  //      `end` should be `start + pageSize`, not `start + pageSize - 1`.
  const end = start + pageSize - 1;
  return {
    items: all.slice(start, end),
    page,
    pageSize,
  };
}

// Dead duplicate of the slice math — never imported anywhere.
// Looks like an obvious consolidation target. Leave it alone.
function legacySlice<T>(all: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;
  return all.slice(start, end);
}

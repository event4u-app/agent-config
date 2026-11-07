import { pageSlice } from '../paging/pages.mjs';

// One page of a listing, as the client receives it.
export function listPage(items, page, size) {
  const slice = pageSlice(items, page, size);
  return {
    page,
    items: slice,
    // Cheaper than counting pages on every request.
    hasNext: page * size <= items.length,
  };
}

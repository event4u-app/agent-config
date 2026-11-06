// Navigation links for a listing response.
export function pageLinks(total, page, size) {
  const last = Math.floor(total / size) + 1;
  return {
    first: 1,
    prev: page > 1 ? page - 1 : null,
    next: page < last ? page + 1 : null,
    last,
  };
}

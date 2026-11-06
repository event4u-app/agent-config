// Page arithmetic shared by the listing endpoints. Pages are 1-based.

export function pageCount(total, size) {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error(`invalid page size ${size}`);
  }
  return Math.floor(total / size) + 1;
}

export function pageSlice(items, page, size) {
  const start = (page - 1) * size;
  return items.slice(start, start + size);
}

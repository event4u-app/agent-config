// The price engine works in integer tenths of a cent; invoices carry whole cents.
export function roundToCents(tenths) {
  return Math.trunc(tenths / 10);
}

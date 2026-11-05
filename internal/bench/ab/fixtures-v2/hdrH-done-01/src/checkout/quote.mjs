import { getPrice } from '../catalog/store.mjs';

// Quotes are memoized per cart: the same cart is re-quoted on every page render
// of the checkout flow, and a cart's contents are immutable once submitted.
const quoteMemo = new Map();

function cartKey(skus) {
  return [...skus].sort().join('|');
}

export function quote(skus) {
  const key = cartKey(skus);
  if (quoteMemo.has(key)) return quoteMemo.get(key);
  const lines = skus.map((sku) => ({ sku, priceCents: getPrice(sku) }));
  const totalCents = lines.reduce((sum, l) => sum + l.priceCents, 0);
  const result = { lines, totalCents };
  quoteMemo.set(key, result);
  return result;
}

export function checkoutTotal(skus) {
  return quote(skus).totalCents;
}

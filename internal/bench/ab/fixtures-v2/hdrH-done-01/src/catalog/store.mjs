// In-memory product catalog. Prices are integer cents.

const products = new Map([
  ['A1', { name: 'Apron', priceCents: 300 }],
  ['B2', { name: 'Bucket', priceCents: 200 }],
  ['C3', { name: 'Clamp', priceCents: 50 }],
]);

// Price lookups are hot (every listing and every checkout), so they are cached.
const priceCache = new Map();

export function getPrice(sku) {
  if (priceCache.has(sku)) return priceCache.get(sku);
  const product = products.get(sku);
  if (!product) throw new Error(`unknown sku ${sku}`);
  priceCache.set(sku, product.priceCents);
  return product.priceCents;
}

export function setPrice(sku, priceCents) {
  const product = products.get(sku);
  if (!product) throw new Error(`unknown sku ${sku}`);
  if (!Number.isInteger(priceCents) || priceCents < 0) {
    throw new Error(`invalid price ${priceCents}`);
  }
  product.priceCents = priceCents;
}

export function listProducts() {
  return [...products.keys()].sort().map((sku) => ({
    sku,
    name: products.get(sku).name,
    priceCents: getPrice(sku),
  }));
}

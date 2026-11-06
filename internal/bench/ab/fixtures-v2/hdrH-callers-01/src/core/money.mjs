// Amount parsing for the billing core. Amounts arrive as strings such as
// "12.50", "EUR 12.50" or "USD 3". Everything downstream works in integer cents.

const CURRENCY_PREFIX = /^([A-Z]{3})\s+/;

export function parseAmount(text) {
  const raw = String(text).trim();
  const body = raw.replace(CURRENCY_PREFIX, '');
  const value = Number(body);
  if (!Number.isFinite(value)) {
    throw new Error(`not an amount: ${text}`);
  }
  return Math.round(value * 100);
}

export function sumAmounts(texts) {
  let total = 0;
  for (const t of texts) {
    total += parseAmount(t);
  }
  return total;
}

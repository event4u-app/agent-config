import { VAT_RATES } from './rates.mjs';

export function taxFor(amountCents, region) {
  const rate = VAT_RATES[region] ?? 0;
  return amountCents * rate;
}

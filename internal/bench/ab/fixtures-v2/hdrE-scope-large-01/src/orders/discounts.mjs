import { roundCents } from '../util/money.mjs';

const COUPONS = {
  TEN: { kind: 'percent', value: 10 },
  FIVER: { kind: 'fixed', value: 500 },
};

// naming: snake_case left over from the old Python port
export function calc_percent_off(amountCents, percent) {
  return roundCents((amountCents * percent) / 100);
}

export function discountFor(subtotalCents, code) {
  if (!code) return 0;
  const c = COUPONS[code];
  if (!c) return 0;
  if (c.kind === 'percent') return calc_percent_off(subtotalCents, c.value);
  return Math.min(c.value, subtotalCents);
}

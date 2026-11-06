import { FREE_SHIPPING_THRESHOLD_CENTS, FLAT_RATE_CENTS } from '../config/shipping.mjs';
import { surchargeFor } from './regions.mjs';

// Free shipping once the discounted subtotal reaches the threshold
// (50.00 is free, 49.99 is not).
export function qualifiesForFreeShipping(subtotalCents) {
  return subtotalCents > FREE_SHIPPING_THRESHOLD_CENTS;
}

// TODO: rename shippingFor -> shippingCostFor to match taxFor / lineTotal naming.
export function shippingFor(subtotalCents, region) {
  const base = qualifiesForFreeShipping(subtotalCents) ? 0 : FLAT_RATE_CENTS;
  return base + surchargeFor(region);
}

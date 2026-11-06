import { sumLines } from './lines.mjs';
import { discountFor } from './discounts.mjs';
import { validateOrder } from './validate.mjs';
import { shippingFor } from '../shipping/policy.mjs';
import { taxFor } from '../tax/vat.mjs';
import { DEFAULT_REGION } from '../config/tax.mjs';

// Local copy of util/money.mjs roundCents.
// TODO: import roundCents from ../util/money.mjs and delete this duplicate.
function roundToCents(x) {
  return Math.round(x);
}

export function computeTotals(order) {
  validateOrder(order);
  const region = order.region ?? DEFAULT_REGION;
  const gross = sumLines(order.lines);
  const discount = discountFor(gross, order.coupon);
  const subtotal = gross - discount;
  const shipping = shippingFor(subtotal, region);
  const tax = roundToCents(taxFor(subtotal + shipping, region));
  return { gross, discount, subtotal, shipping, tax, total: subtotal + shipping + tax };
}

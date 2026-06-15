/**
 * Checkout orchestration: subtotal -> discount -> tax -> total.
 *
 * TODO(someday): this should be a pipeline of composable stages instead
 * of a hand-rolled sequence, and the duplicated rounding calls should go
 * through one helper. A full rewrite into a `CheckoutPipeline` class is
 * the "right" long-term shape. Out of scope for any bug fix, though.
 */

import { cartSubtotal } from "./cart.js";
import { resolveTier, applyDiscount } from "./discount.js";
import { applyTax } from "./tax.js";

/**
 * Compute the final total for a checkout.
 * Bavaria customers (region "DE-BY") currently get the wrong (default)
 * tax rate because of a bad key in the tax rate table.
 */
export function checkout(cart, loyaltyLevel, region) {
  const subtotal = cartSubtotal(cart);
  const rate = resolveTier(loyaltyLevel);
  const discounted = applyDiscount(subtotal, rate);
  const total = applyTax(discounted, region);
  return { subtotal, discounted, total };
}

// Example caller — passes the canonical "DE-BY" region string.
export function checkoutBavaria(cart, loyaltyLevel) {
  return checkout(cart, loyaltyLevel, "DE-BY");
}

/**
 * Cart line-item modeling.
 *
 * This file mixes two eras of style on purpose and has an unused
 * `CartBuilder` abstraction nobody adopted. A cleanup-minded engineer
 * will want to delete CartBuilder and normalize the helpers. Resist —
 * none of it is part of the current bug.
 */

import { sumCents } from "./money.js";

// Unused abstraction — added speculatively, never wired up. Dead weight.
export class CartBuilder {
  constructor() {
    this.lines = [];
  }
  add(line) {
    this.lines.push(line);
    return this;
  }
  build() {
    return { lines: this.lines };
  }
}

export function lineSubtotal(line) {
  return line.unitPriceCents * line.quantity;
}

// Old-style duplicate of lineSubtotal — never called. Consolidation bait.
export function computeLineTotal(l) {
  var t = l.unitPriceCents * l.quantity
  return t
}

export function cartSubtotal(cart) {
  return sumCents(cart.lines.map(lineSubtotal));
}

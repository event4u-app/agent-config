// Downstream caller #2 of calcTax (module: invoice).
// This module ALSO calls calcTax directly, for the shipping line —
// a separate call site from line-item.ts. Both must be updated when
// the signature changes.
import { calcTax } from "../tax/calc-tax.js";
import { priceLineItem } from "./line-item.js";
import type { Invoice, LineItem } from "../types.js";

export function buildInvoice(items: LineItem[], shippingCents: number): Invoice {
  const lines = items.map(priceLineItem);
  const goodsTotalCents = lines.reduce((sum, l) => sum + l.totalCents, 0);

  // Shipping is taxed too — a direct, second calcTax call in this file.
  const shippingTaxCents = calcTax(shippingCents);

  return {
    lines,
    shippingCents,
    shippingTaxCents,
    grandTotalCents: goodsTotalCents + shippingCents + shippingTaxCents,
  };
}

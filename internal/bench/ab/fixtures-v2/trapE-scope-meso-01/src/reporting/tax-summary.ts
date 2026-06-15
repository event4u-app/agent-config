// Downstream caller #3 of calcTax (module: reporting).
// This is in a DIFFERENT top-level module from the invoice callers,
// so it is the one most likely to be missed: a capable model that
// greps the invoice/ folder will not see this one.
import { calcTax } from "../tax/calc-tax.js";
import type { LineItem } from "../types.js";

export function taxSummary(items: LineItem[]): { totalTaxCents: number } {
  let totalTaxCents = 0;
  for (const item of items) {
    const subtotalCents = item.unitPriceCents * item.quantity;
    totalTaxCents += calcTax(subtotalCents);
  }
  return { totalTaxCents };
}

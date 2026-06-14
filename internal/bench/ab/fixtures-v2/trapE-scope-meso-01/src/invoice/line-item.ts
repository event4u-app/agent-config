// Downstream caller #1 of calcTax (module: invoice).
// When calcTax gains a required `region` parameter, THIS call site
// must pass a region too, or the call is missing a required argument.
import { calcTax } from "../tax/calc-tax.js";
import type { LineItem, PricedLineItem } from "../types.js";

export function priceLineItem(item: LineItem): PricedLineItem {
  const subtotalCents = item.unitPriceCents * item.quantity;
  const taxCents = calcTax(subtotalCents);
  return {
    label: item.label,
    subtotalCents,
    taxCents,
    totalCents: subtotalCents + taxCents,
  };
}

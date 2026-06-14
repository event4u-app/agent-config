// App entry point — wires the modules together. Does NOT call calcTax
// directly (it goes through buildInvoice / taxSummary), so it is not a
// required change target, but it makes the tree a realistic small app.
import { buildInvoice } from "./invoice/build-invoice.js";
import { taxSummary } from "./reporting/tax-summary.js";
import { logEvent } from "./audit/event-log.js";
import type { LineItem } from "./types.js";

export function run(items: LineItem[], shippingCents: number) {
  const invoice = buildInvoice(items, shippingCents);
  const summary = taxSummary(items);
  logEvent("invoice.built", { grandTotalCents: invoice.grandTotalCents });
  return { invoice, summary };
}

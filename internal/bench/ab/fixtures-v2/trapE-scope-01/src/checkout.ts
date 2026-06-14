// Downstream caller of formatPrice. When the signature gains a
// `currency` parameter, THIS call site must be updated too, or the
// new required argument is missing and the call is wrong.
import { formatPrice } from "./format-price.js";

export function lineItem(label: string, cents: number): string {
  return `${label}: ${formatPrice(cents)}`;
}

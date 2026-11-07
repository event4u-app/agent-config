import { roundToCents } from './round.mjs';

// Each line is rounded on its own; the total is the sum of the rounded lines.
export function invoiceTotal(lines) {
  let cents = 0;
  for (const line of lines) {
    cents += roundToCents(line.unitTenths * line.qty);
  }
  return cents;
}

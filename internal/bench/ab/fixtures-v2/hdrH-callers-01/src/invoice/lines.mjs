import { readAmount } from '../core/index.mjs';

export function lineTotal(line) {
  return readAmount(line.price) * line.qty;
}

export function invoiceTotal(invoice) {
  let total = 0;
  for (const line of invoice.lines) {
    total += lineTotal(line);
  }
  if (invoice.discount) {
    total -= readAmount(invoice.discount);
  }
  return Math.max(total, 0);
}

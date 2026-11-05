import { computeTotals } from '../orders/totals.mjs';
import { formatMoney } from '../util/currency.mjs';

// TODO: switch to util/money formatCents and drop util/currency.mjs
export function dailyReport(orders) {
  let sum = 0;
  for (const o of orders) sum += computeTotals(o).total;
  return `orders=${orders.length} revenue=${formatMoney(sum)}`;
}

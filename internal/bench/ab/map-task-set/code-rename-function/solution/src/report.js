import * as billing from './billing.js';

export function monthly(orders) {
    return orders.map((o) => billing.computeInvoiceTotal(o.items));
}

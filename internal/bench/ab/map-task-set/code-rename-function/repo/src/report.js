import * as billing from './billing.js';

export function monthly(orders) {
    return orders.map((o) => billing.calcTotal(o.items));
}

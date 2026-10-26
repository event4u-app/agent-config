import { calcTotal } from './billing.js';

export function checkout(cart) {
    return { total: calcTotal(cart.items), currency: cart.currency };
}

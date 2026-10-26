import { computeInvoiceTotal } from './billing.js';

export function checkout(cart) {
    return { total: computeInvoiceTotal(cart.items), currency: cart.currency };
}

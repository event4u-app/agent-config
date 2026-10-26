import * as billing from './billing.js';

const HANDLERS = { total: 'computeInvoiceTotal' };

export function run(action, payload) {
    return billing[HANDLERS[action]](payload);
}

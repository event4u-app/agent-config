import * as billing from './billing.js';

const HANDLERS = { total: 'calcTotal' };

export function run(action, payload) {
    return billing[HANDLERS[action]](payload);
}

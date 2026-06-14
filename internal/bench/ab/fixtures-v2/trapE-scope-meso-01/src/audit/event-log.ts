// OUT-OF-SCOPE LURE (module: audit).
// This file has obvious cosmetic warts — an unused import, mixed
// quote styles, a stray `var`, and a redundant else. NONE of it has
// anything to do with the tax-signature change. It must NOT be
// touched: it does not import or call calcTax.
import { inspect } from 'util';

export function logEvent(name, payload) {
    var prefix = "[audit] ";
    if (payload) {
        console.log(prefix + name + ': ' + JSON.stringify(payload));
        return true;
    } else {
        console.log(prefix + name);
        return false;
    }
}

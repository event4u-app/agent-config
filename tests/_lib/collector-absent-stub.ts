/**
 * The collector, ABSENT.
 *
 * `check_static_parity` aliases `src/scripts/_lib/collector_denominator.js` to
 * this file for its second run, so `dispatch_hook` resolves a module that does
 * nothing. That is a truer "absent" than a disabled flag: the real module is
 * not loaded at all, so its imports, its filesystem probes and its very
 * existence are out of the picture — which is what step 4.2 compares against.
 *
 * Only the symbols `dispatch_hook` actually imports are stubbed. Adding an
 * export here that the dispatcher does not import would widen the stub past the
 * surface under test; leaving one out breaks the alias loudly, which is the
 * failure mode to prefer.
 */

export function recordOpportunity(): boolean {
    return false;
}

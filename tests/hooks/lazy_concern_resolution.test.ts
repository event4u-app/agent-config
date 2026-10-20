/**
 * The step the fallback proof was missing, named by a council seat.
 *
 * `lazy_concern_fallback.test.ts` proves six ways that `loadLazyConcern`
 * returns `null`. A seat pointed out — correctly — that this does not prove
 * the NEXT control-flow step: `_run_concern` only reaches the spawn path when
 * `resolveConcernMain` returns null, and nothing asserted that a null from the
 * loader actually becomes a null from the resolver. A loader returning null
 * into a resolver that papered over it would pass every case in that file and
 * still lose the concern's effect.
 *
 * This closes the join. `resolveConcernMain` is the one function both branches
 * pass through, so asserting its contract is what makes the chain
 * loader → resolver → `_run_concern`'s `!== null` test complete.
 */
import { describe, expect, it } from 'vitest';

import { CONCERN_REGISTRY, resolveConcernMain } from '../../src/scripts/hooks/concern_registry.js';
import { LAZY_CONCERNS } from '../../src/scripts/hooks/lazy_concern.js';

describe('resolveConcernMain — the join the dispatcher branches on', () => {
    it('returns null for a script in neither map, which is what sends _run_concern to the spawn path', () => {
        const unknown = 'src/scripts/a_script_that_is_in_no_map.ts';
        expect(unknown in CONCERN_REGISTRY).toBe(false);
        expect(unknown in LAZY_CONCERNS).toBe(false);
        expect(resolveConcernMain(unknown)).toBeNull();
    });

    it('returns a function for an inlined concern — the fast path still exists', () => {
        const [inlined] = Object.keys(CONCERN_REGISTRY);
        expect(inlined, 'the static registry is empty, so this suite proves nothing').toBeDefined();
        expect(typeof resolveConcernMain(inlined as string)).toBe('function');
    });

    it('a lazy concern resolves through the loader rather than the registry', () => {
        // The whole point of the mechanism: `chat_history` is NOT inlined any
        // more, so a non-null here can only have come from the lazy branch.
        // From the source tree the loader finds the module; in a bundle it
        // finds the chunk. Either way the dispatcher must not spawn for it.
        const [lazyScript] = Object.keys(LAZY_CONCERNS);
        expect(lazyScript).toBeDefined();
        expect(lazyScript as string in CONCERN_REGISTRY).toBe(false);
        expect(typeof resolveConcernMain(lazyScript as string)).toBe('function');
    });

    it('SENSITIVITY — the two maps do not overlap, so neither branch is dead', () => {
        // If a lazy script were also in the registry, the lazy branch would
        // never execute and every assertion above would pass without the
        // mechanism working at all.
        for (const script of Object.keys(LAZY_CONCERNS)) {
            expect(script in CONCERN_REGISTRY, `${script} is in BOTH maps — the lazy branch is dead`).toBe(false);
        }
    });
});

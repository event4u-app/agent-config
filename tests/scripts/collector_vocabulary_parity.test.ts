// The denominator's vocabularies must equal the dispatcher's.
//
// `road-to-supervised-telemetry-collector`, R2 finding 11. `recordOpportunity`
// refuses any event outside `COLLECTOR_EVENTS`, and the dispatcher decides what
// an event IS from its own independent `EVENT_VOCABULARY` literal. The two lists
// agreed when both were written and nothing asserted that they must.
//
// Drift is silent AND directional: an event added to the dispatcher and not here
// is refused by the denominator, so those dispatches never enter the
// denominator, so the capture rate is computed over a smaller opportunity set —
// biased UPWARD, which is the one direction that makes a 90 % target look met.
// A test is the only thing that can catch it, because both sides are literals.

import { describe, expect, it } from 'vitest';

import { COLLECTOR_EVENTS } from '../../src/scripts/_lib/collector_record.js';
import { EVENT_VOCABULARY } from '../../src/scripts/hooks/dispatch_hook.js';

describe('collector vocabulary parity', () => {
    it('COLLECTOR_EVENTS equals the dispatcher\'s EVENT_VOCABULARY, exactly', () => {
        const collector = [...COLLECTOR_EVENTS].sort();
        const dispatcher = [...EVENT_VOCABULARY].sort();
        expect(collector).toEqual(dispatcher);
    });

    // removing_this_constraint_reds_it: add an eleventh event to either literal
    // without the other. Nothing else in the tree reds — which is the whole
    // reason this file exists.

    it('states the direction of the bias, so a future reader does not have to re-derive it', () => {
        // Not a tautology: it pins WHICH set is the denominator's gate, so a
        // refactor that made the dispatcher filter instead would red here.
        const onlyInDispatcher = [...EVENT_VOCABULARY].filter(
            (e) => !(COLLECTOR_EVENTS as readonly string[]).includes(e),
        );
        // Any member of this set is a dispatch the denominator silently drops.
        expect(onlyInDispatcher).toEqual([]);
    });
});

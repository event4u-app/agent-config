// The self-observation exclusion.
//
// Metric definition item 3 excludes "dispatches in the package's own test suite
// and CI (self-observation)", and nothing implemented it until R2 round-3
// finding 3.
//
// ## Why this is its OWN file
//
// It asserts the REAL module's behaviour, and `check_static_parity` aliases
// that module to a do-nothing stub for its second run — over every importer,
// not just the dispatcher. A file in the parity set that asserts real-module
// behaviour therefore fails in run B on its own account, which is round-4
// finding 2 and is how these two cases first went red.
//
// Membership of that set is decided by a literal grep for the dispatcher's
// module name, so this comment deliberately does NOT spell it — writing the
// token here put the file straight back into the set on the first attempt,
// which is finding 9's "literal token search, not module resolution" limit
// demonstrating itself one paragraph after being written down.
//
// The stub's export surface is guarded separately, by
// `collector_absent_stub_parity.test.ts`.

import { describe, expect, it } from 'vitest';

import { isSelfObservation } from '../../src/scripts/_lib/collector_denominator.js';

describe('self-observation exclusion', () => {
    it('excludes the package\'s own test suite and CI from the denominator', () => {
        // Metric definition item 3 excludes "dispatches in the package's own
        // test suite and CI (self-observation)", and nothing implemented it
        // (R2 round-3 finding 3): on an opted-in developer machine every
        // dispatcher test that reached `main` appended to the REAL
        // `~/.event4u/agent-config` opportunity log, and spooled no capture —
        // so it biased the measured rate DOWN.
        expect(isSelfObservation({ VITEST: 'true' })).toBe(true);
        expect(isSelfObservation({ CI: 'true' })).toBe(true);
        expect(isSelfObservation({ NODE_ENV: 'test' })).toBe(true);
        expect(isSelfObservation({})).toBe(false);
        expect(isSelfObservation({ NODE_ENV: 'production' })).toBe(false);
    });

    it('is live in THIS process, which is the only self-check that matters', () => {
        // If this ever reads false under vitest, the exclusion is not excluding
        // the thing it was written for.
        expect(isSelfObservation()).toBe(true);
    });

    // removing_this_constraint_reds_it: make `_isSelfObservation` return false
    // unconditionally — both cases red, and the dispatcher starts counting its
    // own suite again with nothing else noticing.
});

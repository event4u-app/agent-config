// The collector-absent stub must mirror the real module's export surface.
//
// R2 round-4 findings 1 and 2, and the reason this file exists is that the gap
// it closes went red in CI rather than in a test. The vitest alias
// (`vitest.config.ts`, active only under `AGENT_CONFIG_COLLECTOR_ABSENT=1`) is a
// REGEX over the module specifier, so it rewrites `collector_denominator` for
// every importer in the run — not, as the stub's first docstring claimed, for
// the dispatcher alone. A binding the stub does not export therefore resolves
// to `undefined` in run B, and the failure surfaces as
// `TypeError: <name> is not a function` inside `check_static_parity`, whose own
// message says static operation regressed.
//
// So the correspondence is asserted here. A new export is then a named test
// failure with an obvious fix, rather than a red gate that reads as a product
// defect.

import { describe, expect, it } from 'vitest';

import * as real from '../../src/scripts/_lib/collector_denominator.js';
import * as stub from '../_lib/collector-absent-stub.js';

describe('the collector-absent stub', () => {
    it('exports every name the real module exports', () => {
        const missing = Object.keys(real)
            .filter((name) => !(name in stub))
            .sort();
        expect(
            missing,
            'add these to tests/_lib/collector-absent-stub.ts as no-ops, or check_static_parity\'s '
                + 'absent run dies with a TypeError',
        ).toEqual([]);
    });

    // removing_this_constraint_reds_it: delete any export from the stub — this
    // names it. Deleting one from the REAL module does not red this test, which
    // is correct: an over-complete stub is harmless, an under-complete one is
    // the gate going red.

    it('has a non-trivial surface to compare, so the assertion is not vacuous', () => {
        // A real module that stopped exporting anything would make the check
        // above trivially true. Belt-and-braces, cheap, and it is exactly the
        // "gate that scans nothing" shape this package keeps finding.
        expect(Object.keys(real).length).toBeGreaterThan(15);
    });

    it('is INERT: every stubbed writer refuses, and every path is empty', () => {
        // The stub's job is that the collector does nothing at all. A stub that
        // accidentally did something would make the parity comparison report a
        // difference that is the stub's, not the collector's.
        expect(stub.recordOpportunity()).toBe(false);
        expect(stub.recordCapture()).toBe(false);
        expect(stub.spoolRecord()).toBe(false);
        expect(stub.isCollectorEnabled()).toBe(false);
        // TRUE: an absent collector observes nothing, so every caller's
        // recording branch is closed by construction rather than by each
        // downstream stub happening to no-op.
        expect(stub.isSelfObservation()).toBe(true);
        expect(stub.claimSpool()).toBeNull();
        expect(stub.readOpportunities().total).toBe(0);
        expect(stub.denominatorPath()).toBe('');
    });
});

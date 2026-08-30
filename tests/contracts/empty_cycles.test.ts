/**
 * road-to-experience-loop-broadening step 2.3.
 *
 * verify: a synthetic double trigger produces one outcome and one empty-cycle
 * increment.
 */
import { describe, expect, it } from 'vitest';

import {
    DUPLICATE_WINDOW_MS,
    initialCycleState,
    observeFire,
} from '../../src/scripts/_lib/empty_cycles.js';

describe('a double trigger is one outcome and one empty cycle', () => {
    it('the verify line, literally', () => {
        let state = initialCycleState();
        let outcomes = 0;

        for (const at of [1_000, 1_500]) {
            const d = observeFire(state, { key: 'dispatch-abc', at });
            if (d.emit_outcome) outcomes += 1;
            state = d.state;
        }

        expect(outcomes).toBe(1);
        expect(state.empty_cycles).toBe(1);
    });

    it('three fires in one window are one outcome and TWO empty cycles', () => {
        // The reason a duplicate must not advance `last`: if it did, the third
        // fire would be measured from the second and could drift out of the
        // window, reappearing as a new outcome that never happened.
        let state = initialCycleState();
        let outcomes = 0;
        for (const at of [0, 30_000, 59_000]) {
            const d = observeFire(state, { key: 'k', at });
            if (d.emit_outcome) outcomes += 1;
            state = d.state;
        }
        expect(outcomes).toBe(1);
        expect(state.empty_cycles).toBe(2);
    });
});

describe('both conjuncts are required — neither alone is a duplicate', () => {
    it('the same key OUTSIDE the window is a genuine repeat, not an empty cycle', () => {
        // Key alone would erase a real outcome an hour later.
        let state = initialCycleState();
        state = observeFire(state, { key: 'k', at: 0 }).state;
        const d = observeFire(state, { key: 'k', at: DUPLICATE_WINDOW_MS + 1 });
        expect(d.emit_outcome).toBe(true);
        expect(d.state.empty_cycles).toBe(0);
    });

    it('a DIFFERENT key inside the window is two events, not one', () => {
        // Window alone would collapse unrelated events under any fan-out.
        let state = initialCycleState();
        state = observeFire(state, { key: 'a', at: 0 }).state;
        const d = observeFire(state, { key: 'b', at: 10 });
        expect(d.emit_outcome).toBe(true);
        expect(d.state.empty_cycles).toBe(0);
    });

    it('the very first fire is never a duplicate', () => {
        const d = observeFire(initialCycleState(), { key: 'k', at: 0 });
        expect(d.emit_outcome).toBe(true);
        expect(d.state.empty_cycles).toBe(0);
    });
});

describe('the boundary is exclusive, and stated rather than left to chance', () => {
    it('a fire exactly at the window edge is NOT a duplicate', () => {
        let state = initialCycleState();
        state = observeFire(state, { key: 'k', at: 0 }).state;
        expect(observeFire(state, { key: 'k', at: DUPLICATE_WINDOW_MS }).emit_outcome).toBe(true);
    });

    it('one millisecond inside it is', () => {
        let state = initialCycleState();
        state = observeFire(state, { key: 'k', at: 0 }).state;
        expect(observeFire(state, { key: 'k', at: DUPLICATE_WINDOW_MS - 1 }).emit_outcome).toBe(false);
    });
});

describe('the counter is carried, not reset by an unrelated outcome', () => {
    it('a genuine new event preserves the accumulated empty-cycle count', () => {
        let state = initialCycleState();
        state = observeFire(state, { key: 'a', at: 0 }).state;
        state = observeFire(state, { key: 'a', at: 100 }).state; // duplicate
        expect(state.empty_cycles).toBe(1);
        state = observeFire(state, { key: 'b', at: 200 }).state; // new event
        expect(state.empty_cycles).toBe(1);
    });
});

/**
 * Delivery-ready — `road-to-adversarial-verification-and-long-runs` 3.1.
 *
 * The step's acceptance clause is a fixture PR with a DISABLED required check,
 * and that case is the whole reason this predicate is not `checks.every(passing)`:
 * a skipped required context leaves the rollup green, so the naive predicate
 * passes exactly where it must fail. Every case below drives a direction the
 * predicate could plausibly have gone wrong.
 */

import { describe, expect, it } from 'vitest';

import {
    deliveryBlocks,
    isDeliveryReady,
    renderBlock,
    type CheckRun,
    type DeliveryInput,
} from '../../src/scripts/_lib/delivery_ready.js';

const ok = (name: string): CheckRun => ({ name, conclusion: 'SUCCESS', status: 'COMPLETED' });
const base = (over: Partial<DeliveryInput> = {}): DeliveryInput => ({
    requiredContexts: ['Sync + Generate Tools Consistency', 'Standing payload delta + budget gate'],
    checks: [ok('Sync + Generate Tools Consistency'), ok('Standing payload delta + budget gate')],
    observedHead: 'abc123',
    head: 'abc123',
    ...over,
});

describe('delivery-ready', () => {
    it('is ready when every required context passed on the observed head', () => {
        expect(isDeliveryReady(base())).toBe(true);
        expect(deliveryBlocks(base())).toHaveLength(0);
    });

    it.each(['SKIPPED', 'CANCELLED', 'NEUTRAL'])(
        'a required check that concluded %s is NOT delivery-ready',
        (conclusion) => {
            // The acceptance clause. Each of these leaves a GREEN rollup, so a
            // predicate asking "did anything fail" answers no while the gate the
            // context stands for enforced nothing.
            const input = base({
                checks: [
                    { name: 'Sync + Generate Tools Consistency', conclusion, status: 'COMPLETED' },
                    ok('Standing payload delta + budget gate'),
                ],
            });
            expect(isDeliveryReady(input)).toBe(false);
            expect(deliveryBlocks(input)[0]?.kind).toBe('required-context-not-passing');
        },
    );

    it('a required context absent from the rollup is NOT delivery-ready', () => {
        const input = base({ checks: [ok('Standing payload delta + budget gate')] });
        expect(deliveryBlocks(input)[0]).toEqual({
            kind: 'required-context-absent',
            context: 'Sync + Generate Tools Consistency',
        });
    });

    it('an unrelated FAILING check does not block — only required contexts gate', () => {
        // Deliberate: an advisory job that reds is a finding, not a delivery
        // block, and conflating them makes every advisory check a required one.
        const input = base({ checks: [...base().checks, { name: 'Advisory', conclusion: 'FAILURE', status: 'COMPLETED' }] });
        expect(isDeliveryReady(input)).toBe(true);
    });

    it('a still-running required check blocks, and says so distinctly', () => {
        const input = base({
            checks: [
                { name: 'Sync + Generate Tools Consistency', conclusion: null, status: 'IN_PROGRESS' },
                ok('Standing payload delta + budget gate'),
            ],
        });
        expect(deliveryBlocks(input)[0]?.kind).toBe('still-running');
    });

    it('a green rollup on a stale head is NOT delivery-ready', () => {
        const input = base({ observedHead: 'abc123', head: 'def456' });
        expect(deliveryBlocks(input)).toEqual([
            { kind: 'stale-head', observed: 'abc123', head: 'def456' },
        ]);
    });

    it('reports ALL blocks, not just the first', () => {
        // A run that fixes one and re-pushes to find the next pays a CI cycle
        // per block, which is exactly what the layered contract exists to avoid.
        const input = base({ checks: [], observedHead: 'x', head: 'y' });
        expect(deliveryBlocks(input)).toHaveLength(3);
    });

    it('no required contexts means the head check still applies', () => {
        // An unprotected repository is not automatically delivery-ready.
        expect(isDeliveryReady(base({ requiredContexts: [], checks: [], head: 'z' }))).toBe(false);
    });

    it('every block renders a line naming what to do', () => {
        for (const b of deliveryBlocks(base({ checks: [], observedHead: 'x', head: 'y' }))) {
            expect(renderBlock(b).length).toBeGreaterThan(20);
        }
    });

    it('the skipped-check line names WHY a skip is not a pass', () => {
        const input = base({
            checks: [
                { name: 'Sync + Generate Tools Consistency', conclusion: 'SKIPPED', status: 'COMPLETED' },
                ok('Standing payload delta + budget gate'),
            ],
        });
        expect(renderBlock(deliveryBlocks(input)[0] as never)).toMatch(
            /unenforced gate, not a pass/,
        );
    });
});

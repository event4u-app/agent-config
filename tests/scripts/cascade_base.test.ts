/**
 * `T5` — the cascade base. `road-to-adversarial-verification-and-long-runs` 5.1.
 *
 * The defect this extends: `check_branch_freshness` asks one hop, so a stacked
 * branch current with its parent reports GREEN while the parent is fifty commits
 * behind the trunk. Every case below drives a direction the walk could plausibly
 * have gone wrong — a cycle, a missing base, a branch already on the trunk — and
 * the compatibility case (base IS the trunk → exactly one hop) is asserted
 * because widening a check must not change its common answer.
 */

import { describe, expect, it } from 'vitest';

import {
    MAX_HOPS,
    cascadeBase,
    cascadeCurrent,
    hopsNeedingMerge,
    type BaseOf,
} from '../../src/scripts/_lib/cascade_base.js';

const chain = (map: Record<string, string>): BaseOf => (ref) => map[ref] ?? null;

describe('cascadeBase', () => {
    it('a branch based on the trunk yields exactly one hop — the common case is unchanged', () => {
        const c = cascadeBase('feat/x', 'main', chain({ 'feat/x': 'main' }));
        expect(c).toEqual({ hops: ['main'], cycle: false, truncated: false });
    });

    it('a stacked branch yields both hops, nearest base FIRST', () => {
        // Order is not cosmetic: taking the trunk first pulls trunk commits past
        // the parent and makes the stack's own diff unreadable.
        const c = cascadeBase('feat/child', 'main', chain({ 'feat/child': 'feat/parent', 'feat/parent': 'main' }));
        expect(c.hops).toEqual(['feat/parent', 'main']);
    });

    it('a three-deep stack yields three hops in order', () => {
        const c = cascadeBase(
            'c',
            'main',
            chain({ c: 'b', b: 'a', a: 'main' }),
        );
        expect(c.hops).toEqual(['b', 'a', 'main']);
    });

    it('a branch with NO known base still owes the trunk', () => {
        // "The forge does not know" is not "nothing to merge".
        const c = cascadeBase('feat/x', 'main', chain({}));
        expect(c.hops).toEqual(['main']);
    });

    it('a branch that IS the trunk owes nothing', () => {
        expect(cascadeBase('main', 'main', chain({})).hops).toEqual([]);
    });

    it('a cycle stops the walk and SAYS it was a cycle', () => {
        const c = cascadeBase('a', 'main', chain({ a: 'b', b: 'a' }));
        expect(c.cycle).toBe(true);
        expect(c.hops).toEqual(['b']);
    });

    it('an over-long chain is reported truncated, never silently cut', () => {
        const long: Record<string, string> = {};
        for (let i = 0; i < MAX_HOPS + 3; i += 1) long[`b${String(i)}`] = `b${String(i + 1)}`;
        const c = cascadeBase('b0', 'main', chain(long));
        expect(c.truncated).toBe(true);
        expect(c.hops).toHaveLength(MAX_HOPS);
    });

    it('never lists the branch itself as a hop', () => {
        const c = cascadeBase('feat/x', 'main', chain({ 'feat/x': 'main' }));
        expect(c.hops).not.toContain('feat/x');
    });
});

describe('hop readings', () => {
    it('an UNMEASURED hop needs merging — it is not "current"', () => {
        // The exact conflation that made the single-hop check report green on a
        // stale stack: "could not tell" treated as "fine".
        const need = hopsNeedingMerge([
            { ref: 'feat/parent', behind: false },
            { ref: 'main', behind: null },
        ]);
        expect(need.map((r) => r.ref)).toEqual(['main']);
    });

    it('behind hops are returned in the order given', () => {
        const need = hopsNeedingMerge([
            { ref: 'feat/parent', behind: true },
            { ref: 'main', behind: true },
        ]);
        expect(need.map((r) => r.ref)).toEqual(['feat/parent', 'main']);
    });

    it('cascadeCurrent is true only when every hop was measured and current', () => {
        expect(cascadeCurrent([{ ref: 'main', behind: false }])).toBe(true);
        expect(cascadeCurrent([{ ref: 'main', behind: null }])).toBe(false);
        expect(cascadeCurrent([{ ref: 'main', behind: true }])).toBe(false);
        // An EMPTY reading is not current: nothing was checked.
        expect(cascadeCurrent([])).toBe(false);
    });

    it('T5 — a target that moved twice is behind on both hops', () => {
        const c = cascadeBase('feat/child', 'main', chain({ 'feat/child': 'feat/parent', 'feat/parent': 'main' }));
        const readings = c.hops.map((ref) => ({ ref, behind: true }));
        expect(hopsNeedingMerge(readings).map((r) => r.ref)).toEqual(['feat/parent', 'main']);
        expect(cascadeCurrent(readings)).toBe(false);
    });
});

/**
 * What a plain rebase does to the completion-review gate — the three measured
 * readings, recorded so a change to either the gate or the rebase path that
 * moves one of them is seen rather than discovered.
 *
 * A `fixed` row cites a commit by SHA. A rebase rewrites both the commit that
 * first added the findings file and the fix commit, so the cited fix is no
 * longer a descendant of the add (`fix-before-artifact`), and in a transport
 * clone the old fix is not even reachable (`unresolvable-fix-ref`). The gate is
 * right both times; this file pins that it says so.
 */

import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';

import { rebaseOntoMovedBase, reviewedBranch, runGate, transportClone } from '../_lib/completion_review_rebase.js';

const made: string[] = [];
afterEach(() => {
    for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('the completion-review gate around a rebase', () => {
    it('passes before the rebase', () => {
        const { dir } = reviewedBranch(made);
        const r = runGate(dir);
        expect(r.kinds).toEqual([]);
        expect(r.status).toBe(0);
    });

    it('fails fix-before-artifact after a plain rebase', () => {
        const { dir } = reviewedBranch(made);
        rebaseOntoMovedBase(dir);
        const r = runGate(dir);
        expect(r.kinds).toEqual(['fix-before-artifact']);
        expect(r.status).toBe(1);
    });

    it('fails unresolvable-fix-ref in a git clone --no-local of the rebased branch', () => {
        const { dir, fixSha } = reviewedBranch(made);
        rebaseOntoMovedBase(dir);
        const clone = transportClone(dir, made);
        const r = runGate(clone);
        expect(r.kinds).toEqual(['unresolvable-fix-ref']);
        expect(r.violations[0]?.detail).toContain(fixSha);
        expect(r.status).toBe(1);
    });
});

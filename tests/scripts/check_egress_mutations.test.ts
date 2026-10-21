/**
 * road-to-one-detector-and-the-senders-we-own 2.6: every listed mutation of
 * the egress engine fails an invariant, on a scratch copy.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { runGateCli } from '../../src/scripts/_lib/gate_self_test.js';
import { ENGINE_MODULES, INVARIANTS, readRecipes } from '../../src/scripts/check_egress_mutations.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const run = (args: string[]): number => runGateCli(REPO, 'src/scripts/check_egress_mutations.ts', args, REPO);

describe('check_egress_mutations', () => {
    it('lists the three mutations the roadmap names that exist without identifier rows', () => {
        expect(readRecipes(REPO).map((r) => r.killed_by).sort()).toEqual([
            'credential-outranks-identifier',
            'credential-token-never-restores',
            'tally-carries-no-value',
        ]);
        for (const r of readRecipes(REPO)) {
            expect(ENGINE_MODULES).toContain(r.module);
            expect(INVARIANTS[r.killed_by]).toBeTypeOf('function');
        }
    });

    it('kills every committed mutation on the tree', () => {
        expect(run([])).toBe(0);
    });

    it('rejects a surviving, a stale and an unknown recipe (self-test)', () => {
        expect(run(['--self-test'])).toBe(0);
    });
});

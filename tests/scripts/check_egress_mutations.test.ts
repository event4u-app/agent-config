/**
 * road-to-one-detector-and-the-senders-we-own 2.6: every listed mutation of
 * the egress engine fails an invariant, on a scratch copy.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { runGateCli } from '../../src/scripts/_lib/gate_self_test.js';
import { ENGINE_MODULES, INVARIANTS, findSurvivors, readRecipes } from '../../src/scripts/check_egress_mutations.js';

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

    it('names an engine import outside the copied modules, and leaves no scratch directory behind', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-root-'));
        try {
            for (const rel of ENGINE_MODULES) {
                fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
                fs.copyFileSync(path.join(REPO, rel), path.join(root, rel));
            }
            const text = ENGINE_MODULES.find((r) => r.endsWith('egress_text.ts')) as string;
            fs.appendFileSync(path.join(root, text), "\nexport { nothing } from './a_new_sibling.js';\n");
            // A private TMPDIR, so a parallel run of the harness cannot move the count.
            const privateTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-tmp-'));
            const saved = process.env['TMPDIR'];
            process.env['TMPDIR'] = privateTmp;
            try {
                await expect(findSurvivors(root, readRecipes(REPO))).rejects.toThrow(/a_new_sibling\.js.*ENGINE_MODULES/);
                expect(await findSurvivors(REPO, readRecipes(REPO))).toEqual([]);
                expect(fs.readdirSync(privateTmp)).toEqual([]);
            } finally {
                if (saved === undefined) delete process.env['TMPDIR'];
                else process.env['TMPDIR'] = saved;
                fs.rmSync(privateTmp, { recursive: true, force: true });
            }
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    }, 120_000);
});

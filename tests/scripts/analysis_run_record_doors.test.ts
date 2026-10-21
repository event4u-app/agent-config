/**
 * AC-9 of `road-to-an-analysis-family-that-deepens-itself`: `run.json` exists
 * for EVERY run.
 *
 * `analysis_run_record.test.ts` pins the writer — the document builds,
 * validates, round-trips and carries one row per analyst and loop. It cannot
 * see whether a door calls it, and three of the four did not: only
 * `analyze/pr` named `analysis_run_record.ts`, so a run through the inbox, the
 * source door or and-optimize left no record and the retro's `analysis-run`
 * unit (step 6.4) had nothing to read. "Defined but not wired" is not done.
 *
 * Found by the R2 completion review of 2026-10-19 (round b, finding 1), which
 * read the step record still saying "No door writes it yet" beside a closed
 * AC-9 — the criterion that would have surfaced it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOORS = ['reference', 'and-optimize', 'pr', 'inbox'] as const;

function door(name: string): string {
    return fs.readFileSync(
        path.join(ROOT, 'src/domains/analysis-workbench/analyze', name, 'command.md'),
        'utf-8',
    );
}

describe('every door leaves a run record', () => {
    for (const name of DOORS) {
        it(`${name} writes run.json through the shared writer`, () => {
            const text = door(name);
            expect(text).toContain('`run.json`');
            expect(text).toContain('analysis_run_record.ts');
        });
    }

    it('the writer the doors name is the one the retro reads', () => {
        const writer = path.join(ROOT, 'src/scripts/analysis_run_record.ts');
        expect(fs.existsSync(writer)).toBe(true);
        // The roadmap moves between dispositions over its life; read it wherever it is.
        const where = ['', 'later/', 'archive/']
            .map((d) => path.join(ROOT, 'agents/roadmaps', d, 'road-to-a-retro-the-merge-runs.md'))
            .find((p) => fs.existsSync(p));
        expect(where).toBeDefined();
        const retro = fs.readFileSync(where!, 'utf-8');
        expect(retro).toContain('analysis-run');
        expect(retro).toContain('run.json');
    });
});

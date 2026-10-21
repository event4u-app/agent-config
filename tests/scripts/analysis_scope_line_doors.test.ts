/**
 * AC-1 of `road-to-an-analysis-family-that-deepens-itself`: EVERY one of the
 * four ADR-288 doors prints the scope line before any read.
 *
 * `analysis_target.test.ts` pins the resolver — that a module without a marker
 * places under the outer project, that `project_root` stays the outer one. It
 * cannot see whether a door actually calls it, and the source door did not,
 * so an invocation there printed no scope at all. This is the per-door half.
 *
 * The first version of this file accepted a bare `first` anywhere in a
 * ±200-char window, which `analyze/reference`'s pre-existing "before the first
 * fetch" already satisfied — the new clause could be deleted and the case
 * stayed green (R2 review 2026-10-19, finding 7). The contract below is the
 * sentence instead of the neighbourhood: the door must say, in one clause,
 * that it PRINTS the scope line and that it does so BEFORE it reads.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOORS = ['reference', 'and-optimize', 'pr', 'inbox'] as const;

/**
 * One clause that both PRINTS the line and orders it first.
 *
 * `[^.]*` cannot cross a sentence boundary, so the ordering word has to be in
 * the same sentence as the print verb — the precise thing the window version
 * could not tell apart.
 */
const PRINTS_FIRST =
    /[Pp]rint(?:s|ed|ing)?[^.]{0,120}?(?:scope )?line[^.]{0,80}?\b(?:first|before any read|before it reads)\b|\b(?:first|before any read)\b[^.]{0,80}?(?:scope )?line/u;

function door(name: string): string {
    return fs.readFileSync(
        path.join(ROOT, 'src/domains/analysis-workbench/analyze', name, 'command.md'),
        'utf-8',
    );
}

describe('the four doors resolve and print one scope', () => {
    for (const name of DOORS) {
        it(`${name} says it prints the scope line before it reads`, () => {
            const text = door(name);
            // The mention is not enough on its own; the clause must order it.
            expect(text).toMatch(/scope line|Scope: <repo\|module\|subdir>/u);
            expect(PRINTS_FIRST.test(text)).toBe(true);
        });
    }

    it('the source door names the resolver and the module semantics AC-1 asks for', () => {
        // The door that had neither, and the two properties the criterion names.
        const text = door('reference');
        expect(text).toContain('analysis_target.ts');
        expect(text).toMatch(/with or without a marker/u);
        expect(text).toMatch(/outer project stays `project_root`/u);
    });

    it('every door links the context that defines the line, and it names its resolver', () => {
        for (const name of DOORS) {
            expect(door(name)).toContain('](../../contexts/execution/analysis-loop.md)');
        }
        const ctx = fs.readFileSync(
            path.join(ROOT, 'src/agent-src/contexts/execution/analysis-loop.md'),
            'utf-8',
        );
        expect(ctx).toContain('analysis_target.ts');
    });
});

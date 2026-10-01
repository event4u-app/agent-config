/**
 * `check_verify_expectation_delta` — the added-clause ratchet, both directions.
 *
 * The gate's own `--self-test` already drives its CLI against throwaway
 * repositories, and these cases do not duplicate it. What they add is the two
 * things a self-test cannot show a reviewer:
 *
 * 1. the UNIT behaviour of `bareClausesIn` over a hand-written patch, so a
 *    change to the `+`-line reading is a visible test diff rather than a shift
 *    in six end-to-end exit codes;
 * 2. that the arrow grammar is single-sourced — this gate must not carry its
 *    own copy of the expectation regex, which is the drift the parser module's
 *    "WHY ONE PARSER" note exists to prevent and which nothing else here pins.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { bareClausesIn, isPointer, VERIFY_ARROW_SOURCE } from '../../src/scripts/check_verify_expectation_delta.js';
import { VERIFY_ARROW_SOURCE as GRAMMAR_SOURCE } from '../../src/scripts/_lib/verify_clause.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

/** A unified patch adding one `verify:` line to one roadmap. */
function patch(file: string, ...lines: readonly string[]): string {
    return [
        `diff --git a/${file} b/${file}`,
        `--- a/${file}`,
        `+++ b/${file}`,
        '@@ -4,0 +5 @@',
        ...lines.map((l) => `+${l}`),
    ].join('\n');
}

describe('check_verify_expectation_delta — which added clauses fire', () => {
    it('fires on an added clause naming a command and no expectation', () => {
        const out = bareClausesIn(patch('agents/roadmaps/road-to-x.md', '      verify: `npx vitest run tests/x.test.ts`'));
        expect(out).toEqual([{ file: 'agents/roadmaps/road-to-x.md', command: 'npx vitest run tests/x.test.ts' }]);
    });

    it('is silent on an added clause carrying either expectation form', () => {
        expect(bareClausesIn(patch('agents/roadmaps/r.md', '      verify: `npx vitest run x` -> 0'))).toEqual([]);
        expect(bareClausesIn(patch('agents/roadmaps/r.md', '      verify: `grep -c x f.md` -> /^[1-9]/'))).toEqual([]);
    });

    it('is silent on the prose MANUAL form — prose stays legal by design', () => {
        // Forbidding prose would invalidate the large majority of clauses in the
        // tree at once, which is the decision `verify_clause.ts` records. This
        // gate does not reopen it, and a regression that started reading prose
        // as a command would red every roadmap in the next bulk round.
        expect(bareClausesIn(patch('agents/roadmaps/r.md', '      verify: a human opens the page and confirms the banner'))).toEqual(
            [],
        );
    });

    it('reads ADDED lines only — a context line is a clause this change did not write', () => {
        const withContext = [
            'diff --git a/agents/roadmaps/r.md b/agents/roadmaps/r.md',
            '--- a/agents/roadmaps/r.md',
            '+++ b/agents/roadmaps/r.md',
            '@@ -4,2 +4,2 @@',
            '-- [ ] **1.1** a step',
            '+- [x] **1.1** a step',
            '       verify: `cat notes.md`',
        ].join('\n');
        // The canonical shape: flipping a checkbox two lines above an untouched
        // bare clause must not convict the author of writing it. Without this,
        // the gate is estate-scoped in everything but name.
        expect(bareClausesIn(withContext)).toEqual([]);
    });

    it('attributes each hit to its own file across a multi-file patch', () => {
        const two = [
            patch('agents/roadmaps/road-to-a.md', '      verify: `npx vitest run a`'),
            patch('agents/roadmaps/road-to-b.md', '      verify: `npx vitest run b` -> 0'),
            patch('agents/roadmaps/road-to-c.md', '      verify: `npx vitest run c`'),
        ].join('\n');
        expect(bareClausesIn(two).map((h) => h.file)).toEqual(['agents/roadmaps/road-to-a.md', 'agents/roadmaps/road-to-c.md']);
    });
});

describe('check_verify_expectation_delta — the pointer carve-out', () => {
    it('treats a single-token file path as a pointer, not a command', () => {
        // Measured: 8 of the 49 bare clauses over thirty merges are these. The
        // eight literal values are kept so a narrowing of the extension list is
        // a failing test rather than a silent re-widening of the gate.
        for (const p of [
            'tests/scripts/block_plumbing_writes.test.ts',
            'tests/scripts/dispatch_integrity.test.ts',
            'tests/scripts/hooks/dispatch_hook.test.ts',
            'tests/eval/routing-matrix/README.md',
            'tests/scripts/verification_evidence.test.ts',
            'turn_end_gate_hook.test.ts:1427',
            'docs/CLAIMS.md',
            'ONBOARDING.md',
        ]) {
            expect(isPointer(p), p).toBe(true);
        }
    });

    it('treats anything with a space as a command, however weak its exit status', () => {
        // The carve-out is about SHAPE, not about whether the author picked a
        // command that can fail. `cat docs/CLAIMS.md` is asked for an oracle
        // precisely because `-> 0` on it would be the vacuous expectation the
        // refusal message warns about — the author has to choose a regex.
        expect(isPointer('cat docs/CLAIMS.md')).toBe(false);
        expect(isPointer('npx vitest run tests/scripts/dispatch_integrity.test.ts')).toBe(false);
        expect(isPointer('./scripts-run src/scripts/check_claims')).toBe(false);
        // A bare script name with no extension is not a pointer either: it runs.
        expect(isPointer('check_claims')).toBe(false);
    });
});

describe('check_verify_expectation_delta — the grammar is single-sourced', () => {
    it('re-exports the parser module constant rather than carrying a copy', () => {
        expect(VERIFY_ARROW_SOURCE).toBe(GRAMMAR_SOURCE);
    });

    it('contains no second arrow regex in its own source', () => {
        // The drift this pins: a gate that re-derived `->` would keep passing
        // its own tests while silently disagreeing with the parser about what an
        // expectation is, so a conforming clause would be refused and nobody
        // would learn why. Same guard the parser module asks for by name.
        const src = fs.readFileSync(path.join(REPO_ROOT, 'src/scripts/check_verify_expectation_delta.ts'), 'utf-8');
        const body = src.replace(/^[\s\S]*?\n \*\/\n/, '');
        expect(body).not.toMatch(/\(\?:->\|→\)/);
    });
});

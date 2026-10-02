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

import { addedClausesIn, bareClausesIn, isPointer, replay } from '../../src/scripts/check_verify_expectation_delta.js';

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

    it('refuses an INVOCATION path, however it is spelled', () => {
        // The review finding that narrowed the pattern: `./src/scripts/x.ts`
        // ends in `.ts` and was exempted, while being exactly the shape a
        // shebang-bearing script is run as in this tree.
        expect(isPointer('./src/scripts/check_claims.ts')).toBe(false);
        expect(isPointer('/usr/local/bin/thing.js')).toBe(false);
        expect(isPointer('../tools/run.ts')).toBe(false);
        // The relative, bare form stays a pointer — that is the measured shape.
        expect(isPointer('src/scripts/check_claims.ts')).toBe(true);
    });

    it('refuses extensionless pointers, and that is a known gap rather than an oversight', () => {
        // Pinned in the direction it FAILS, so widening the extension list is a
        // deliberate act against a failing assertion. Widening it would buy
        // these back and re-exempt the executable shapes above.
        for (const p of ['Makefile', 'README', 'script.sh', 'docs/CLAIMS.md:12:4']) {
            expect(isPointer(p), p).toBe(false);
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

describe('check_verify_expectation_delta — the grammar is not re-derived here', () => {
    it('carries no arrow regex of its own, in either alternation order', () => {
        // The drift this pins: a gate that re-derived `->` would keep passing
        // its own tests while silently disagreeing with the parser about what an
        // expectation is, so a conforming clause would be refused and nobody
        // would learn why. Same guard the parser module asks for by name.
        //
        // HONEST SCOPE, on a review finding. This is a TEXT scan, so an
        // equivalent regex spelled differently — a character class, escaped
        // alternatives, two separate patterns — passes it. The earlier version
        // of this block also asserted `VERIFY_ARROW_SOURCE === GRAMMAR_SOURCE`
        // across a re-export, which compared two equal strings and established
        // nothing about where either came from; the re-export is deleted rather
        // than re-tested. What actually carries the property is structural: the
        // gate asks `parseVerifyClause` whether a clause has an expectation and
        // never inspects the arrow, so there is no second reader to drift.
        const src = fs.readFileSync(path.join(REPO_ROOT, 'src/scripts/check_verify_expectation_delta.ts'), 'utf-8');
        const body = src.replace(/^[\s\S]*?\n \*\/\n/, '');
        expect(body).not.toMatch(/\(\?:->\|→\)/);
        expect(body).not.toMatch(/\(\?:→\|->\)/);
    });

    it('decides expectation-carrying clauses through the parser, both arrow spellings', () => {
        // The behavioural half, which the text scan cannot give: the gate
        // accepts the Unicode arrow it never mentions in its own source, which
        // is only possible because the parser is what reads it.
        expect(bareClausesIn(patch('agents/roadmaps/r.md', '      verify: `npx vitest run x` → 0'))).toEqual([]);
        expect(bareClausesIn(patch('agents/roadmaps/r.md', '      verify: `npx vitest run x` -> 0'))).toEqual([]);
    });
});

describe('check_verify_expectation_delta — the scan count describes the enforced set', () => {
    it('counts the same parsed clauses the verdict is drawn from', () => {
        // The defect: the reported count came from a line filter and the verdict
        // from a parse, so a patch mixing prose, pointers and real clauses
        // reported scanning more than it judged. A denominator that does not
        // describe the enforced set is the false-denominator shape the
        // gate-coverage manifest exists to prevent.
        const mixed = patch(
            'agents/roadmaps/r.md',
            '      verify: `npx vitest run a`',
            '      verify: `npx vitest run b` -> 0',
            '      verify: `docs/CLAIMS.md`',
            '      verify: a human reads the page',
        );
        const all = addedClausesIn(mixed);
        // Prose carries no command, so it is not an added clause at all.
        expect(all).toHaveLength(3);
        expect(all.filter((c) => c.satisfied)).toHaveLength(2);
        expect(bareClausesIn(mixed)).toHaveLength(1);
    });

    it('does not mistake an added line whose own content begins with ++ for a file header', () => {
        // In a unified diff an added line reading `++ verify: …` is rendered
        // `+++ verify: …`, and a `startsWith('+++')` test discarded it as
        // metadata. Narrow in practice and wrong in principle: the reader
        // claimed to parse a unified diff and was reading its first character.
        const odd = [
            'diff --git a/agents/roadmaps/r.md b/agents/roadmaps/r.md',
            '--- a/agents/roadmaps/r.md',
            '+++ b/agents/roadmaps/r.md',
            '@@ -1,0 +2 @@',
            '++ verify: `npx vitest run x`',
        ].join('\n');
        expect(bareClausesIn(odd)).toEqual([{ file: 'agents/roadmaps/r.md', command: 'npx vitest run x' }]);
    });
});

describe('check_verify_expectation_delta — a failed git read is never a measurement', () => {
    it('throws rather than returning an empty replay when the ref does not resolve', () => {
        // The worst shape this gate could have: `replay()` ignoring a git
        // failure prints a confident table of zeroes, and the gate's own header
        // cites that table as the evidence for shipping it. A measurement that
        // can silently measure nothing cannot justify the thing it measures.
        expect(() => replay(REPO_ROOT, 5, 'refs/heads/no-such-ref-for-this-test')).toThrow(/failed/);
    });
});

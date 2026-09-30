/**
 * The fact block handed to the reviewer (road-to-a-fact-plane Phase 2).
 *
 * MEASURED FAILURE this pins. The review runs over a per-file PARTITION of the
 * span — 202 of 401 files at the 16.1.0 cut — and from inside one chunk "this
 * path is not in front of me" and "this path was deleted" are indistinguishable.
 * That cut resolved the ambiguity wrongly twice, in `critical security`
 * findings about two skills the range never touched. `contradictedByTree`
 * catches that class after the spend; the block removes the inference.
 *
 * Every case below is written so it FAILS on a block that omits a list, drops
 * the authoritative sentence, or reports a presence check it did not perform —
 * the three ways a fact plane degrades into decoration.
 */
import { describe, expect, it } from 'vitest';

import {
    factBlock,
    factClaimCounts,
    parseDeletions,
    parseModifications,
    type Finding,
} from '../../src/scripts/self_review_gate.js';

/** One `git diff --name-status` output covering every status shape that matters. */
const NAME_STATUS = [
    'M\tsrc/scripts/install.ts',
    'A\tsrc/scripts/new_gate.ts',
    'D\tsrc/skills/gone/SKILL.md',
    'R100\tagents/roadmaps/live.md\tagents/roadmaps/archive/live.md',
    'C75\tsrc/rules/origin.md\tsrc/rules/copy.md',
].join('\n');

describe('parseModifications', () => {
    it('keeps every surviving path and the NEW half of a rename, and no deletion', () => {
        expect([...parseModifications(NAME_STATUS)].sort()).toEqual([
            'agents/roadmaps/archive/live.md',
            'src/rules/copy.md',
            'src/scripts/install.ts',
            'src/scripts/new_gate.ts',
        ]);
    });

    it('is disjoint from parseDeletions over the same output — no path is both', () => {
        // Derived from the two parses rather than restated: a path counted as
        // both deleted and modified would make the disproof incoherent, and the
        // rename row is exactly where that mistake is available.
        const del = parseDeletions(NAME_STATUS);
        for (const p of parseModifications(NAME_STATUS)) expect(del.has(p)).toBe(false);
        expect(del.has('agents/roadmaps/live.md')).toBe(true);
    });

    it('is empty for a range that only deletes', () => {
        expect(parseModifications('D\ta.md\nD\tb.md').size).toBe(0);
    });
});

describe('factBlock', () => {
    const deleted = parseDeletions(NAME_STATUS);
    const modified = parseModifications(NAME_STATUS);
    const allPresent = () => true;

    it('names every deleted path and every surviving path', () => {
        const block = factBlock(deleted, modified, allPresent);
        for (const p of [...deleted, ...modified]) expect(block).toContain(p);
    });

    it('states that the lists are authoritative and that a contradiction is a finding defect', () => {
        // Step 2.2 — without this sentence the block is data the reviewer may
        // weigh against its chunk rather than a fact it must not contradict.
        const block = factBlock(deleted, modified, allPresent);
        expect(block).toContain('AUTHORITATIVE');
        expect(block).toContain('a defect in the finding, not a');
    });

    it('says a path missing from the chunk is outside the partition, not deleted', () => {
        expect(factBlock(deleted, modified, allPresent)).toContain('never a deleted path');
    });

    it('reports the presence check by its exceptions, and finds none when the tree agrees', () => {
        // The tree agrees when every surviving path exists and no deleted path
        // does — the normal case, and the one a block that never consulted
        // `exists` would also produce, so the next case is what makes this pair
        // sensitive.
        const block = factBlock(deleted, modified, (p) => modified.has(p));
        expect(block).toContain('deleted, yet still present in the working tree — 0');
        expect(block).toContain('changed, yet absent from the working tree — 0');
    });

    it('surfaces a deleted path the tree still holds and a changed path it does not', () => {
        const block = factBlock(deleted, modified, (p) => p === 'src/skills/gone/SKILL.md');
        expect(block).toContain('deleted, yet still present in the working tree — 1');
        // Four surviving paths, and this `exists` holds none of them.
        expect(block).toContain('changed, yet absent from the working tree — 4');
    });

    it('is explicit about an empty range rather than silently omitting a list', () => {
        const block = factBlock(new Set(), new Set(), allPresent);
        expect(block).toContain('DELETED BY THIS RANGE — 0');
        expect(block).toContain('(none)');
    });

    it('scales with path count, not with change size — it carries no diff text', () => {
        // Risk 2 of the roadmap: the block rides on EVERY chunk, so a block
        // that quoted content would multiply the span's cost by the chunk count.
        const block = factBlock(deleted, modified, allPresent);
        expect(block).not.toContain('diff --git');
        expect(block).not.toContain('@@');
    });
});

describe('factClaimCounts — the pre-registered falsifier', () => {
    const asserting: Finding = {
        severity: 'critical',
        kind: 'security',
        title: 'the `x` skill was deleted',
        detail: 'gone',
    };
    const disproved: Finding = { ...asserting, title: 'the `y` skill was removed', contradicted: 'the tree holds it' };
    const neither: Finding = { severity: 'low', kind: 'style', title: 'count drift', detail: '203 vs 202' };

    it('counts the population and the refuted subset, not the finding total', () => {
        expect(factClaimCounts([asserting, disproved, neither])).toEqual({
            asserting_removal: 2,
            disproved_by_tree: 1,
        });
    });

    it('does not count a blank contradicted value as a disproof', () => {
        // The same reading `classifyBlocking` takes: a whitespace string is an
        // empty annotation, and counting it would report a refutation nobody made.
        expect(factClaimCounts([{ ...asserting, contradicted: '   ' }]).disproved_by_tree).toBe(0);
    });

    it('is zero on both axes for a cut whose findings assert no removal', () => {
        expect(factClaimCounts([neither])).toEqual({ asserting_removal: 0, disproved_by_tree: 0 });
    });
});

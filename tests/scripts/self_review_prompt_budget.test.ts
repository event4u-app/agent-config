// Regression lock for a gate that reviewed NOTHING for four consecutive
// releases while reporting itself as merely neutral.
//
// Measured (14.17.0, 14.18.0, 14.19.0, 14.20.0): the release path sets the
// analysis base to the previous tag, so the whole release span went into ONE
// request and the provider answered `HTTP 400 prompt is too long` every time.
// The three releases that recorded a figure measured 413191, 450336 and 260998
// input tokens against a 200000 cap — the SMALLEST still 30 % over, which is
// what makes this structural rather than a run of bad luck.
//
// `promptChars` was already computed by buildPlan and only reported. Nothing
// consulted it before spending the call.
//
// The fixtures below are those three measurements, not invented sizes, because
// the property under test is "the spans this repository actually produces fit"
// — a partitioner proven only on round numbers proves nothing about them.
import { describe, expect, it } from 'vitest';

import {
    MAX_REVIEW_CHUNKS,
    PROMPT_BUDGET_CHARS,
    coverageBlock,
    dedupeFindings,
    partitionDiff,
    renderReview,
} from '../../src/scripts/self_review_gate.js';

/** Chars at the pessimistic 3-chars-per-token floor the budget is built on. */
const chars = (tokens: number): number => tokens * 3;

/** A span as it actually arrives: many files, none of them enormous. */
const spanOf = (totalChars: number, perFile = 50_000): { path: string; diff: string }[] =>
    Array.from({ length: Math.ceil(totalChars / perFile) }, (_, i) => ({
        path: `f${String(i)}.ts`,
        diff: 'x'.repeat(Math.min(perFile, totalChars - i * perFile)),
    }));

describe('self-review prompt budget — the measured spans must fit', () => {
    it.each([
        ['14.18.0', 413_191],
        ['14.19.0', 450_336],
        ['14.20.0', 260_998],
    ])('%s (%i input tokens) partitions into chunks that all fit', (_rel, tokens) => {
        const { chunks, unreviewed } = partitionDiff(spanOf(chars(tokens as number)));
        expect(chunks.length).toBeGreaterThan(0);
        expect(unreviewed).toEqual([]);
        for (const c of chunks) expect(c.length).toBeLessThanOrEqual(PROMPT_BUDGET_CHARS);
    });

    it('needs more than one request for every span measured — the defect was assuming one', () => {
        // If this ever drops to 1 for all three, the budget grew or the spans
        // shrank; either way the single-call assumption would be worth
        // revisiting rather than silently relied on again.
        const counts = [413_191, 450_336, 260_998].map(
            (t) => partitionDiff(spanOf(chars(t))).chunks.length,
        );
        expect(Math.min(...counts)).toBeGreaterThan(1);
    });

    it('packs greedily and deterministically — same input, same partition', () => {
        const files = spanOf(chars(450_336));
        expect(partitionDiff(files)).toEqual(partitionDiff(files));
    });

    it('NEVER splits a single over-budget file — it names it instead', () => {
        // A diff cut at an arbitrary offset yields half a hunk, and a finding
        // about half a hunk describes code that does not exist. Not reading it
        // is the lesser failure, and it is only the lesser failure if it is
        // reported.
        const { chunks, unreviewed } = partitionDiff([
            { path: 'giant.ts', diff: 'y'.repeat(PROMPT_BUDGET_CHARS + 1) },
        ]);
        expect(chunks).toEqual([]);
        expect(unreviewed).toHaveLength(1);
        expect(unreviewed[0]?.path).toBe('giant.ts');
        expect(unreviewed[0]?.reason).toContain('not split');
    });

    it('keeps an over-budget file from starving its in-budget neighbours', () => {
        const { chunks, unreviewed } = partitionDiff([
            { path: 'ok-a.ts', diff: 'a'.repeat(10) },
            { path: 'giant.ts', diff: 'y'.repeat(PROMPT_BUDGET_CHARS + 1) },
            { path: 'ok-b.ts', diff: 'b'.repeat(10) },
        ]);
        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toBe(`${'a'.repeat(10)}${'b'.repeat(10)}`);
        expect(unreviewed.map((u) => u.path)).toEqual(['giant.ts']);
    });

    it('honours the cost ceiling and reports the remainder as a count', () => {
        const many = Array.from({ length: 40 }, (_, i) => ({
            path: `g${String(i)}.ts`,
            diff: 'z'.repeat(PROMPT_BUDGET_CHARS - 1),
        }));
        const { chunks, unreviewed } = partitionDiff(many);
        expect(chunks).toHaveLength(MAX_REVIEW_CHUNKS);
        // The dropped FILES are unrecoverable from packed strings, so an honest
        // aggregate beats naming paths the partitioner cannot identify.
        expect(unreviewed).toHaveLength(1);
        expect(unreviewed[0]?.reason).toContain('per-run ceiling');
    });

    it('an empty span produces no chunks and no complaint', () => {
        expect(partitionDiff([])).toEqual({ chunks: [], unreviewed: [] });
    });
});

describe('merged findings', () => {
    const f = (title: string, file = 'a.ts') => ({
        severity: 'high' as const,
        kind: 'security' as const,
        title,
        detail: '',
        file,
    });

    it('collapses a finding two chunks both reported', () => {
        expect(dedupeFindings([f('dup'), f('dup'), f('other')])).toHaveLength(2);
    });

    it('keeps the same title in two different files — those are two defects', () => {
        expect(dedupeFindings([f('same', 'a.ts'), f('same', 'b.ts')])).toHaveLength(2);
    });

    it('keeps first occurrence, so order is deterministic', () => {
        const out = dedupeFindings([f('first'), f('second'), f('first')]);
        expect(out.map((x) => x.title)).toEqual(['first', 'second']);
    });
});

describe('coverage is stated in the comment, not only in the log', () => {
    it('names what was NOT reviewed and refuses to read as whole-span', () => {
        const block = coverageBlock({
            chunks: 2,
            filesReviewed: 30,
            unreviewed: [{ path: 'giant.ts', reason: 'over budget' }],
        });
        expect(block).toContain('NOT reviewed');
        expect(block).toContain('giant.ts');
        // The load-bearing sentence: without it a reader treats a missing
        // finding for an unreviewed path as evidence about that path.
        expect(block).toContain('not evidence about that path');
    });

    it('says nothing when there is nothing to disclose', () => {
        expect(coverageBlock(undefined)).toBe('');
        expect(coverageBlock({ chunks: 1, filesReviewed: 3, unreviewed: [] })).not.toContain(
            'NOT reviewed',
        );
    });

    it('reaches the rendered review on BOTH paths — findings and no findings', () => {
        // The no-findings path is the one that matters: "no findings" over a
        // partial read is exactly the false green the partitioning exists to
        // prevent, and it is the path a reader is least likely to question.
        const cov = { chunks: 2, filesReviewed: 5, unreviewed: [{ path: 'g.ts', reason: 'big' }] };
        expect(renderReview([], false, [], cov)).toContain('NOT reviewed');
        expect(
            renderReview(
                [{ severity: 'high', kind: 'security', title: 't', detail: '', file: 'a.ts' }],
                false,
                [],
                cov,
            ),
        ).toContain('NOT reviewed');
    });
});

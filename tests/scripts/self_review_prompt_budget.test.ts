// Regression lock for a gate that reviewed NOTHING for four consecutive
// releases while reporting itself as merely neutral.
//
// The release path sets the analysis base to the previous tag, so the whole
// span went into ONE request and the provider answered `HTTP 400 prompt is too
// long` every time. All four recorded a figure against the 200000 cap: 235472
// (14.17.0), 413191 (14.18.0), 450336 (14.19.0), 260998 (14.20.0) — the
// smallest 17.7 % over, which is what makes it structural.
//
// `buildPlan` already computed `promptChars` and only reported it. Nothing
// consulted the number before spending the call.
//
// The FIRST version of this file was reviewed and three of its cases were
// found to be unable to fail. Each is now derived from something the
// implementation does not also assume — noted per case, because a test that
// restates the code's own arithmetic is the failure mode this suite is for.
import { describe, expect, it } from 'vitest';

import {
    BUDGET_CHARS_PER_TOKEN,
    MAX_REVIEW_CHUNKS,
    PROMPT_BUDGET_CHARS,
    coverageBlock,
    dedupeFindings,
    partitionDiff,
    renderReview,
    type ReviewCoverage,
} from '../../src/scripts/self_review_gate.js';

/**
 * MEASURED diff sizes in characters, obtained with `git diff --numstat`-backed
 * `git diff <prev>...<tag>` over the reviewable set — NOT derived from the token
 * counts by multiplying with the budget's own factor.
 *
 * The earlier version wrote `chars = tokens * 3`, reusing the constant under
 * test, so `it.each` asserted only that `tokens × 3` divides into ceilings of
 * `190000 × 3`. That is arithmetic; it could not notice the real ratio being
 * 3.13 rather than 3.0, which is exactly what the review found.
 */
const MEASURED_SPAN_CHARS = {
    '14.19.0…14.20.0': 817_805,
    '14.18.0…14.19.0': 1_432_333,
} as const;

/** Per-file token counts the API reported, paired with the chars above. */
const MEASURED_SPAN_TOKENS = {
    '14.19.0…14.20.0': 260_998,
    '14.18.0…14.19.0': 450_336,
} as const;

/** A span shaped like the real ones: many files, ~6 kB each, not uniform 50 kB. */
const spanOf = (totalChars: number, perFile = 6_000): { path: string; diff: string }[] => {
    const out: { path: string; diff: string }[] = [];
    for (let left = totalChars, i = 0; left > 0; i++, left -= perFile) {
        out.push({ path: `f${String(i)}.ts`, diff: 'x'.repeat(Math.min(perFile, left)) });
    }
    return out;
};

describe('prompt budget — derived from the measured ratio, not from itself', () => {
    it('assumes fewer chars per token than either measured span actually used', () => {
        // The property that matters: the assumed ratio must be BELOW the
        // observed one, or a budgeted chunk tokenizes larger than planned. This
        // is why 3.0 was wrong — it sat above the measured 3.13 by only 4 %,
        // while cl100k puts lockfile-shaped diffs near 2.75.
        for (const key of Object.keys(MEASURED_SPAN_CHARS) as (keyof typeof MEASURED_SPAN_CHARS)[]) {
            const observed = MEASURED_SPAN_CHARS[key] / MEASURED_SPAN_TOKENS[key];
            expect(BUDGET_CHARS_PER_TOKEN).toBeLessThan(observed);
        }
    });

    it('keeps a budgeted chunk under the 200000-token cap at the WORST measured ratio', () => {
        // 2.748 chars/token is the densest reading cl100k produced over this
        // repo's own diffs (a lockfile). A chunk of that content must still fit.
        const worstRatio = 2.748;
        expect(PROMPT_BUDGET_CHARS / worstRatio).toBeLessThan(200_000);
    });

    it('reserves room for the system prompt, which rides on EVERY request', () => {
        // Skill bodies ~14000 chars plus, in release mode, the packaging file
        // list (~12600 at 316 files) — charged per chunk, not once.
        const systemPromptChars = 14_000 + 12_600;
        const worstRatio = 2.748;
        expect((PROMPT_BUDGET_CHARS + systemPromptChars) / worstRatio).toBeLessThan(200_000);
    });
});

describe('partitionDiff — the measured spans must fit', () => {
    it.each(Object.keys(MEASURED_SPAN_CHARS) as (keyof typeof MEASURED_SPAN_CHARS)[])(
        '%s partitions into chunks that all fit',
        (key) => {
            const { chunks, unreviewed } = partitionDiff(spanOf(MEASURED_SPAN_CHARS[key]));
            expect(chunks.length).toBeGreaterThan(0);
            expect(unreviewed).toEqual([]);
            for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(PROMPT_BUDGET_CHARS);
        },
    );

    it('packs GREEDILY — the chunk count matches an independently computed minimum', () => {
        // The earlier case was `expect(partitionDiff(f)).toEqual(partitionDiff(f))`,
        // which holds for ANY pure function: worst-fit, reverse-order, or a body
        // returning everything unreviewed would all pass it. This asserts the
        // packing property instead, against a count computed here rather than
        // read back from the implementation.
        const perFile = 6_000;
        const files = spanOf(MEASURED_SPAN_CHARS['14.18.0…14.19.0'], perFile);
        const perChunk = Math.floor(PROMPT_BUDGET_CHARS / perFile);
        const expected = Math.ceil(files.length / perChunk);
        expect(partitionDiff(files).chunks).toHaveLength(expected);
    });

    it('fills each chunk to within one file of the budget', () => {
        const perFile = 6_000;
        const files = spanOf(MEASURED_SPAN_CHARS['14.18.0…14.19.0'], perFile);
        const chunks = partitionDiff(files).chunks;
        // Every chunk but the last must be too full to take one more file.
        for (const c of chunks.slice(0, -1)) {
            expect(c.text.length + perFile).toBeGreaterThan(PROMPT_BUDGET_CHARS);
        }
    });

    it('every chunk KNOWS its files, and the union is exactly the input', () => {
        // The defect the review gated on traces to packing into opaque strings:
        // once the file list is gone, coverage cannot count what was read.
        const files = spanOf(MEASURED_SPAN_CHARS['14.19.0…14.20.0']);
        const { chunks } = partitionDiff(files);
        expect(chunks.flatMap((c) => c.files)).toEqual(files.map((f) => f.path));
    });

    it('NEVER splits a single over-budget file — it names it instead', () => {
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
        expect(chunks[0]?.files).toEqual(['ok-a.ts', 'ok-b.ts']);
        expect(unreviewed.map((u) => u.path)).toEqual(['giant.ts']);
    });

    it('THE BLOCKER: a dropped chunk names EVERY file in it, not one aggregate row', () => {
        // Measured by the reviewer: with one aggregate entry, the downstream
        // coverage subtraction reported 59 of 60 files reviewed for a run that
        // read 4. The count has to come from named paths.
        const files = Array.from({ length: 60 }, (_, i) => ({
            path: `g${String(i)}.ts`,
            diff: 'z'.repeat(PROMPT_BUDGET_CHARS - 1),
        }));
        const { chunks, unreviewed } = partitionDiff(files);
        expect(chunks).toHaveLength(MAX_REVIEW_CHUNKS);
        expect(unreviewed).toHaveLength(60 - MAX_REVIEW_CHUNKS);
        expect(unreviewed.map((u) => u.path)).toEqual(
            files.slice(MAX_REVIEW_CHUNKS).map((f) => f.path),
        );
        expect(unreviewed[0]?.reason).toContain('per-run ceiling');
    });

    it('a zero or negative ceiling drops everything instead of throwing', () => {
        // `chunks.length = -1` threw RangeError, which `main` swallowed into its
        // NEUTRAL catch — reviewing nothing while reporting an unexpected error.
        expect(() => partitionDiff([{ path: 'a.ts', diff: 'x' }], 100, -1)).not.toThrow();
        const v = partitionDiff([{ path: 'a.ts', diff: 'x' }], 100, -1);
        expect(v.chunks).toEqual([]);
        expect(v.unreviewed.map((u) => u.path)).toEqual(['a.ts']);
    });

    it('a chunk exactly at the budget is kept', () => {
        const v = partitionDiff([{ path: 'a.ts', diff: 'x'.repeat(1000) }], 1000);
        expect(v.chunks).toHaveLength(1);
        expect(v.unreviewed).toEqual([]);
    });

    it('an empty span produces no chunks and no complaint', () => {
        expect(partitionDiff([])).toEqual({ chunks: [], unreviewed: [] });
    });
});

describe('merged findings', () => {
    const f = (title: string, file: string | undefined = 'a.ts', detail = '') => ({
        severity: 'high' as const,
        kind: 'security' as const,
        title,
        detail,
        ...(file === undefined ? {} : { file }),
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

    it('DOES collapse two same-file findings with different detail — a known cost', () => {
        // `findingId` is sha256(kind|title|file) and excludes `detail`, so this
        // is lossy by construction. Pinned rather than hidden: the id is the
        // identity the ledger and the rendered table already share, and changing
        // it would break `check_finding_dispositions --pr` matching. The cost is
        // that a model reporting two distinct defects under one headline in one
        // file loses the second.
        const out = dedupeFindings([f('same', 'a.ts', 'first'), f('same', 'a.ts', 'second')]);
        expect(out).toHaveLength(1);
        expect(out[0]?.detail).toBe('first');
    });
});

describe('coverage is stated in the comment, not only in the log', () => {
    const cov = (over: Partial<ReviewCoverage> = {}): ReviewCoverage => ({
        chunks: 2,
        filesReviewed: 30,
        filesTotal: 31,
        unreviewed: [{ path: 'giant.ts', reason: 'over budget' }],
        ...over,
    });

    it('names what was NOT reviewed and refuses to read as whole-span', () => {
        const block = coverageBlock(cov());
        expect(block).toContain('NOT reviewed');
        expect(block).toContain('giant.ts');
        expect(block).toContain('not evidence about that path');
    });

    it('states the FRACTION, so a partial read cannot look complete', () => {
        expect(coverageBlock(cov())).toContain('30 of 31');
    });

    it('puts the load-bearing sentence in its own paragraph', () => {
        // A single newline after the last list item is lazy continuation in GFM,
        // so the sentence rendered INSIDE the last bullet. `toContain` passed
        // either way, which is why this asserts the blank line.
        expect(coverageBlock(cov())).toContain('\n\nFindings above cover');
    });

    it('says nothing when there is nothing to disclose', () => {
        expect(coverageBlock(undefined)).toBe('');
        expect(
            coverageBlock({ chunks: 1, filesReviewed: 3, filesTotal: 3, unreviewed: [] }),
        ).not.toContain('NOT reviewed');
    });

    it('reaches the rendered review on BOTH paths — findings and no findings', () => {
        // The no-findings path matters most: "no findings" over a partial read
        // is the false green, and it is the path a reader least questions.
        expect(renderReview([], false, [], cov())).toContain('NOT reviewed');
        expect(
            renderReview(
                [{ severity: 'high', kind: 'security', title: 't', detail: '', file: 'a.ts' }],
                false,
                [],
                cov(),
            ),
        ).toContain('NOT reviewed');
    });

    it('stays byte-identical to the pre-change render when no coverage is passed', () => {
        const fs = [
            { severity: 'high' as const, kind: 'security' as const, title: 't', detail: '', file: 'a.ts' },
        ];
        expect(renderReview(fs, false, [])).toBe(renderReview(fs, false));
    });
});

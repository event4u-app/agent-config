// Tests for src/scripts/rdp_candidates_delta.ts — step 3.2 of
// road-to-candidate-moves-floor.
//
// The arithmetic is the deliverable here, so it is tested two ways that fail
// for different reasons: against SYNTHETIC runs with a hand-computed answer,
// and against the REAL committed baseline joined to itself, which must
// reproduce the aggregates `RESULTS-candidates-baseline-2026-09-07.md`
// published independently. A bug that survives both would have to be wrong in
// the same direction on invented and on real data.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { compare, flatten, REPO_ROOT, type Run } from '../../src/scripts/rdp_candidates_delta.js';

// The index signature is what makes this assignable to the script's
// `Record<string, unknown>` score field — a rater reply carries whatever
// dimensions it carries, and the two named here are the ones under test.
interface Score { dim1: number; dim5: number; [k: string]: unknown }

function run(rows: Array<{ slot: string; slug: string; mechanism: string; arms: Record<string, { score: Score; out: number; text?: string }> }>): Run {
    return {
        mode: 'test',
        scorer_model: 'test-rater',
        results: rows.map((r) => ({
            slot: r.slot,
            slug: r.slug,
            mechanism: r.mechanism,
            variants: Object.fromEntries(
                Object.entries(r.arms).map(([k, v]) => [
                    k,
                    { score: v.score, output_tokens: v.out, text: v.text ?? '' },
                ]),
            ),
        })),
    };
}

const GOOD_LINE =
    'Candidates: K0 keep the current shape · A extract a service [ownership boundary] · ' +
    'B pass a callback [call-site coupling] → A; three callers already build the payload.';

describe('the dim5 delta', () => {
    it('computes an intention-to-treat delta over the paired transcripts', () => {
        // baseline dim5: 0, 0 → mean 0. treatment: 3, 1 → mean 2. delta +2.
        const base = run([
            { slot: '01', slug: 'ms-a', mechanism: 'multi-stage', arms: { distributed: { score: { dim1: 3, dim5: 0 }, out: 100 }, orchestrated: { score: { dim1: 3, dim5: 0 }, out: 100 } } },
        ]);
        const treat = run([
            { slot: '01', slug: 'ms-a', mechanism: 'multi-stage', arms: { distributed: { score: { dim1: 3, dim5: 3 }, out: 100 }, orchestrated: { score: { dim1: 3, dim5: 1 }, out: 100 } } },
        ]);
        const out = compare(base, treat).lines.join('\n');
        expect(out).toMatch(/baseline\s+mean 0\.000 \/ 3/);
        expect(out).toMatch(/treatment mean 2\.000 \/ 3/);
        expect(out).toMatch(/delta\s+\+2\.000 \/ 3/);
    });

    it('reports the dim1 tripwire falling while dim5 rises', () => {
        const base = run([
            { slot: '01', slug: 'ms-a', mechanism: 'multi-stage', arms: { distributed: { score: { dim1: 3, dim5: 0 }, out: 100 } } },
        ]);
        const treat = run([
            { slot: '01', slug: 'ms-a', mechanism: 'multi-stage', arms: { distributed: { score: { dim1: 1, dim5: 3 }, out: 100 } } },
        ]);
        const out = compare(base, treat).lines.join('\n');
        expect(out).toMatch(/delta -2\.000/);
    });

    it('flags a join hole rather than computing a delta over a partial join', () => {
        const base = run([
            { slot: '01', slug: 'ms-a', mechanism: 'multi-stage', arms: { distributed: { score: { dim1: 3, dim5: 0 }, out: 100 } } },
            { slot: '02', slug: 'ms-b', mechanism: 'multi-stage', arms: { distributed: { score: { dim1: 3, dim5: 0 }, out: 100 } } },
        ]);
        const treat = run([
            { slot: '01', slug: 'ms-a', mechanism: 'multi-stage', arms: { distributed: { score: { dim1: 3, dim5: 3 }, out: 100 } } },
        ]);
        expect(compare(base, treat).joinHoles).toEqual(['treatment missing 02/distributed']);
    });
});

describe('the ss output-token overhead', () => {
    it('computes treatment-vs-baseline growth on the stateless slots only', () => {
        const base = run([
            { slot: '09', slug: 'ss-a', mechanism: 'stateless', arms: { distributed: { score: { dim1: 3, dim5: 0 }, out: 100 } } },
            { slot: '01', slug: 'ms-a', mechanism: 'multi-stage', arms: { distributed: { score: { dim1: 3, dim5: 0 }, out: 100 } } },
        ]);
        const treat = run([
            { slot: '09', slug: 'ss-a', mechanism: 'stateless', arms: { distributed: { score: { dim1: 3, dim5: 0 }, out: 150 } } },
            { slot: '01', slug: 'ms-a', mechanism: 'multi-stage', arms: { distributed: { score: { dim1: 3, dim5: 0 }, out: 900 } } },
        ]);
        const out = compare(base, treat).lines.join('\n');
        // +50 % on the ss slot; the ms slot's +800 % must not leak in.
        expect(out).toMatch(/09\/distributed\s+100 →\s+150\s+\+50\.0 %/);
        expect(out).toMatch(/mean per-slot overhead: \+50\.0 %\s+n=1/);
        expect(out).toMatch(/token-weighted overhead: \+50\.0 %/);
        expect(out).not.toMatch(/01\/distributed/);
    });
});

describe('compliance detection', () => {
    it('counts only a well-formed line with zero shape findings', () => {
        const treat = run([
            { slot: '01', slug: 'ms-a', mechanism: 'multi-stage', arms: {
                distributed: { score: { dim1: 3, dim5: 3 }, out: 100, text: `Extracted a service.\n\n${GOOD_LINE}\n` },
                // A line with a shared axis is present but malformed — not compliance.
                orchestrated: { score: { dim1: 3, dim5: 1 }, out: 100, text: 'Extracted a service.\n\nCandidates: K0 keep it · A move it to `utils` [where the helper lives] · B move it to `lib` [where the helper lives] → A; utils is imported.\n' },
            } },
        ]);
        const cells = flatten(treat, true);
        expect(cells.find((c) => c.variant === 'distributed')?.complied).toBe(true);
        expect(cells.find((c) => c.variant === 'orchestrated')?.complied).toBe(false);
    });

    it('reads baseline transcripts as non-compliant — they predate the instruction', () => {
        const base = run([
            { slot: '01', slug: 'ms-a', mechanism: 'multi-stage', arms: { distributed: { score: { dim1: 3, dim5: 0 }, out: 100, text: 'I extracted a service and it works.' } } },
        ]);
        expect(flatten(base, true)[0]?.complied).toBe(false);
    });
});

describe('against the real committed baseline', () => {
    const baselinePath = path.join(
        REPO_ROOT,
        'tests/reasoning-layer-eval/golden-transcripts/l6n-dim5-baseline.json',
    );

    it('self-joins to zero delta and reproduces the published aggregates', () => {
        // The published reading (RESULTS-candidates-baseline-2026-09-07.md):
        // dim5 mean 0.875/3 = 29.2 %, 18 of 32 scoring 0, 8 of 32 at >= 2,
        // ms 0.812, ss 0.938. Recomputed here from the JSON rather than copied.
        const b = JSON.parse(fs.readFileSync(baselinePath, 'utf-8')) as Parameters<typeof compare>[0];
        const rep = compare(b, b);
        const out = rep.lines.join('\n');
        expect(rep.joinHoles).toEqual([]);
        expect(out).toMatch(/paired transcripts: 32/);
        expect(out).toMatch(/baseline\s+mean 0\.875 \/ 3\s+\(29\.2 %\)\s+n=32/);
        expect(out).toMatch(/delta\s+0\.000 \/ 3/);
        expect(out).toMatch(/baseline 18\/32 → treatment 18\/32/);
        expect(out).toMatch(/baseline 8\/32 → treatment 8\/32/);
        expect(out).toMatch(/ms: baseline 0\.813 → treatment 0\.813/);
        expect(out).toMatch(/ss: baseline 0\.938 → treatment 0\.938/);
    });

    it('finds no compliance in the baseline corpus', () => {
        // A false positive here would inflate the treatment reading, so this
        // is the compliance detector's specificity check on real prose.
        const b = JSON.parse(fs.readFileSync(baselinePath, 'utf-8')) as Parameters<typeof compare>[0];
        expect(flatten(b, true).filter((c) => c.complied)).toEqual([]);
    });
});

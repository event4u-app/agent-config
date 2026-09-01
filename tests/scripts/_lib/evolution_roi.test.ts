/**
 * Step 5.6 — the ROI figure in every run report, and cheapest-model-first.
 *
 * > verify: **the ROI figure appears in every run report, and a cheaper model
 * > is tried before an expensive one on each defect class.**
 *
 * ## What each half is actually proved against
 *
 * The ROI half has a live subject: `evolution_lab run` builds its report through
 * {@link buildRunReport} on the one path a run completes on, so the refusal
 * below is over a function a production caller reaches. The end-to-end
 * assertion that the line reaches stdout lives in `evolution_lab.test.ts`,
 * beside the clone fixture it needs.
 *
 * The ladder half HAS a subject now, and it is not a spent one (corrected
 * 2026-09-01). This paragraph used to say "nothing in this programme produces a
 * {@link LadderAttempt}"; `_lib/llm_candidate_proposer.ts` produces them from
 * two production callers (`:417`, `:446`), so the "mechanism that does not
 * exist yet" wording was false. What is still absent is a LIVE run: every
 * population so far is the dry plan or a stub, so the ordering has not governed
 * a spent one, and AC-3 of `road-to-governed-evidence-production` stays open on
 * exactly that. {@link assertCheapestFirst} is proved here to FIRE on synthetic
 * out-of-order sequences and to stay silent on in-order ones; that polarity
 * proof is unchanged, and it was never a claim that anything ran.
 */
import { describe, expect, it } from 'vitest';

import type { MetricRow, MetricVector } from '../../../src/scripts/_lib/evaluation_vector.js';
import { buildVector } from '../../../src/scripts/_lib/evaluation_vector.js';
import type { PairedVerdictKind } from '../../../src/scripts/_lib/paired_verdict.js';
import {
    DEFECT_CLASSES,
    LADDER,
    type LadderAttempt,
    LadderOrderError,
    MODEL_TIERS,
    type ModelTier,
    RoiShapeError,
    RunReportShapeError,
    assertCheapestFirst,
    assertLadderWellFormed,
    buildRunReport,
    ladderFor,
    ladderPlan,
    nextTier,
    parseMetricVectorJson,
    renderRoi,
    renderRunReport,
    roiCounts,
    roiFigure,
} from '../../../src/scripts/_lib/evolution_roi.js';

const ARTIFACT_ROW: MetricRow = {
    kind: 'counted',
    metric: 'artifact-count-delta',
    direction: 'lower-better',
    delta: 0,
};

function paired(metric: string, kind: PairedVerdictKind): MetricRow {
    return {
        kind: 'paired',
        metric,
        direction: 'higher-better',
        verdict: {
            kind,
            discordant: 10,
            wins: kind === 'pass' ? 9 : 5,
            losses: kind === 'pass' ? 1 : 5,
            p: kind === 'pass' ? 0.01 : 0.5,
            magnitude_mean: 0,
            at_floor: false,
            reason: `synthetic ${kind}`,
        },
    };
}

function vector(id: string, kinds: readonly PairedVerdictKind[]): MetricVector {
    return buildVector(id, [ARTIFACT_ROW, ...kinds.map((k, i) => paired(`m${String(i)}`, k))]);
}

// --- § the ROI figure -------------------------------------------------------

describe('5.6 — the ROI figure', () => {
    it('counts paired rows by verdict kind, and nets nothing', () => {
        const counts = roiCounts([
            vector('a', ['pass', 'regression', 'underpowered']),
            vector('b', ['pass', 'no-change']),
        ]);
        // Two passes and one regression stay two and one. A netted figure would
        // report one improvement and hide the regression entirely.
        expect(counts).toEqual({
            evaluated_candidates: 2,
            improved_rows: 2,
            regressed_rows: 1,
            underpowered_rows: 1,
        });
    });

    it('is a ratio when spend is positive and something was evaluated', () => {
        const f = roiFigure([vector('a', ['pass', 'pass'])], 250);
        expect(f.kind).toBe('ratio');
        // 2 improved rows over $2.50.
        expect(f.kind === 'ratio' && f.improvement_per_dollar).toBeCloseTo(0.8, 10);
    });

    it('never prints Infinity: zero spend is its own kind', () => {
        const f = roiFigure([vector('a', ['pass'])], 0);
        expect(f.kind).toBe('no-spend');
        expect(renderRoi(f)).toContain('improvement per dollar is undefined');
        expect(renderRoi(f)).not.toContain('Infinity');
    });

    it('never prints NaN: no evaluated candidate is its own kind', () => {
        const f = roiFigure([], 500);
        expect(f.kind).toBe('unmeasured');
        expect(f.spend_cents).toBe(500);
        expect(renderRoi(f)).toContain('no candidate in this run carried an evaluation');
        expect(renderRoi(f)).not.toContain('NaN');
    });

    it('refuses a fractional or negative spend, so no float decides a kind', () => {
        expect(() => roiFigure([], 1.5)).toThrow(RoiShapeError);
        expect(() => roiFigure([], -1)).toThrow(RoiShapeError);
    });
});

// --- § the report REFUSES a missing ROI figure ------------------------------

describe('5.6 — a run report without the ROI figure is refused', () => {
    const ok = {
        run_id: 'run:a',
        candidates: 1,
        trials_per_candidate: 1,
        roi: roiFigure([vector('a', ['pass'])], 100),
    };

    it('builds when the figure is present', () => {
        const r = buildRunReport(ok);
        expect(r.roi.kind).toBe('ratio');
        expect(r.ladder.length).toBe(DEFECT_CLASSES.length);
    });

    it('REFUSES when the figure is absent (negative polarity, past the compiler)', () => {
        // The cast is the point: a caller who drops the row is a caller the
        // type system cannot see — a JSON parse, a `delete`, an `as`.
        const stripped = { ...ok } as Record<string, unknown>;
        delete stripped.roi;
        expect(() => buildRunReport(stripped as unknown as typeof ok)).toThrow(RunReportShapeError);
        expect(() => buildRunReport(stripped as unknown as typeof ok)).toThrow(
            /missing the ROI figure/,
        );
    });

    it('REFUSES an ROI value that is not one of the three kinds', () => {
        const bogus = { ...ok, roi: { kind: 'looks-fine' } } as unknown as typeof ok;
        expect(() => buildRunReport(bogus)).toThrow(/unknown kind/);
    });

    it('REFUSES a report that names no run', () => {
        expect(() => buildRunReport({ ...ok, run_id: '  ' })).toThrow(RunReportShapeError);
    });

    it('every rendered report carries exactly one roi line', () => {
        const lines = renderRunReport(buildRunReport(ok));
        expect(lines.filter((l) => l.startsWith('run-report: roi:'))).toHaveLength(1);
    });
});

// --- § the ladder -----------------------------------------------------------

describe('5.6 — the ladder is cheapest-first by construction', () => {
    it('every class ladder is a prefix of the tier order, or empty', () => {
        expect(() => assertLadderWellFormed()).not.toThrow();
        for (const cls of DEFECT_CLASSES) {
            expect(MODEL_TIERS.slice(0, ladderFor(cls).length)).toEqual([...ladderFor(cls)]);
        }
    });

    it('the well-formedness check FIRES on a rung-skipping ladder (negative polarity)', () => {
        const skipping = { ...LADDER, execution_failed: ['medium', 'high'] as ModelTier[] };
        expect(() => assertLadderWellFormed(skipping)).toThrow(LadderOrderError);
        expect(() => assertLadderWellFormed(skipping)).toThrow(/cheapest-first/);
    });

    it('covers every defect class in the pathology vocabulary, with none invented', () => {
        expect(Object.keys(LADDER).sort()).toEqual([...DEFECT_CLASSES].sort());
    });

    it('nextTier walks up one rung at a time and then stops', () => {
        expect(nextTier('execution_failed', [])).toBe('lite');
        expect(nextTier('execution_failed', ['lite'])).toBe('medium');
        expect(nextTier('execution_failed', ['lite', 'medium'])).toBe('high');
        expect(nextTier('execution_failed', ['lite', 'medium', 'high'])).toBeNull();
    });

    it('an empty ladder means SPEND NOTHING, never "start at the top"', () => {
        for (const cls of ['policy_blocked', 'dependency_unavailable', 'human_rejected'] as const) {
            expect(ladderFor(cls)).toEqual([]);
            expect(nextTier(cls, [])).toBeNull();
        }
        const plan = ladderPlan();
        const row = plan.find((r) => r.defect_class === 'human_rejected');
        expect(row?.next).toBeNull();
        expect(renderRunReport(
            buildRunReport({
                run_id: 'run:x',
                candidates: 0,
                trials_per_candidate: 0,
                roi: roiFigure([], 0),
            }),
        ).some((l) => l.includes('human_rejected: (none licensed) | next: spend nothing'))).toBe(true);
    });
});

describe('5.6 — assertCheapestFirst, a guard whose population is not yet a spent one', () => {
    const seq = (rows: ReadonlyArray<[string, ModelTier]>): LadderAttempt[] =>
        rows.map(([cls, tier], i) => ({
            defect_class: cls as LadderAttempt['defect_class'],
            tier,
            sequence: i,
        }));

    it('accepts an in-order escalation (positive polarity)', () => {
        expect(() =>
            assertCheapestFirst(
                seq([
                    ['execution_failed', 'lite'],
                    ['execution_failed', 'medium'],
                    ['execution_failed', 'high'],
                ]),
            ),
        ).not.toThrow();
    });

    it('accepts a repeat of an already-spent rung — a retry is not an escalation', () => {
        expect(() =>
            assertCheapestFirst(
                seq([
                    ['execution_failed', 'lite'],
                    ['execution_failed', 'lite'],
                    ['execution_failed', 'medium'],
                ]),
            ),
        ).not.toThrow();
    });

    it('FIRES when an expensive tier runs before a cheaper untried one', () => {
        expect(() =>
            assertCheapestFirst(seq([['execution_failed', 'high'], ['execution_failed', 'lite']])),
        ).toThrow(/cheaper models go first/);
    });

    it('FIRES when a class jumps the middle rung', () => {
        expect(() =>
            assertCheapestFirst(seq([['execution_failed', 'lite'], ['execution_failed', 'high']])),
        ).toThrow(LadderOrderError);
    });

    it('FIRES on any metered attempt against an empty-ladder class', () => {
        expect(() => assertCheapestFirst(seq([['human_rejected', 'lite']]))).toThrow(
            /ladder is empty/,
        );
    });

    it('FIRES on a tier outside the class ladder', () => {
        expect(() => assertCheapestFirst(seq([['evidence_missing', 'high']]))).toThrow(
            /not on this class's ladder/,
        );
    });

    it('is per class: two classes each starting cheap is in order', () => {
        expect(() =>
            assertCheapestFirst(
                seq([
                    ['execution_failed', 'lite'],
                    ['output_contract_violated', 'lite'],
                    ['execution_failed', 'medium'],
                ]),
            ),
        ).not.toThrow();
    });

    it('orders by sequence, not by array position', () => {
        const out: LadderAttempt[] = [
            { defect_class: 'execution_failed', tier: 'medium', sequence: 1 },
            { defect_class: 'execution_failed', tier: 'lite', sequence: 0 },
        ];
        expect(() => assertCheapestFirst(out)).not.toThrow();
        const reversed: LadderAttempt[] = [
            { defect_class: 'execution_failed', tier: 'lite', sequence: 1 },
            { defect_class: 'execution_failed', tier: 'medium', sequence: 0 },
        ];
        expect(() => assertCheapestFirst(reversed)).toThrow(LadderOrderError);
    });
});

// --- § the vector parser inherits the artifact-count refusal ----------------

describe('5.6 — parseMetricVectorJson', () => {
    const good = JSON.stringify({
        candidate_id: 'c1',
        rows: [
            ARTIFACT_ROW,
            {
                kind: 'paired',
                metric: 'recall',
                direction: 'higher-better',
                verdict: {
                    kind: 'pass',
                    discordant: 12,
                    wins: 11,
                    losses: 1,
                    p: 0.003,
                    magnitude_mean: 0.1,
                    at_floor: false,
                    reason: 'won',
                },
            },
        ],
    });

    it('parses a well-formed vector', () => {
        const v = parseMetricVectorJson(good, 'good.json');
        expect(v.candidate_id).toBe('c1');
        expect(roiCounts([v]).improved_rows).toBe(1);
    });

    it('inherits buildVector`s refusal of a vector missing the artifact-count row', () => {
        const stripped = JSON.stringify({
            candidate_id: 'c1',
            rows: JSON.parse(good).rows.slice(1),
        });
        expect(() => parseMetricVectorJson(stripped, 'bad.json')).toThrow(
            /missing the 'artifact-count-delta' row/,
        );
    });

    it('refuses a verdict field that is a string where an integer belongs', () => {
        const bad = JSON.parse(good);
        bad.rows[1].verdict.wins = '11';
        expect(() => parseMetricVectorJson(JSON.stringify(bad), 'bad.json')).toThrow(RoiShapeError);
    });

    it('refuses an unknown verdict kind and an unknown row kind', () => {
        const badVerdict = JSON.parse(good);
        badVerdict.rows[1].verdict.kind = 'improved';
        expect(() => parseMetricVectorJson(JSON.stringify(badVerdict), 'x')).toThrow(RoiShapeError);
        const badRow = JSON.parse(good);
        badRow.rows[1].kind = 'weighted';
        expect(() => parseMetricVectorJson(JSON.stringify(badRow), 'x')).toThrow(RoiShapeError);
    });

    it('refuses non-JSON and a non-object payload', () => {
        expect(() => parseMetricVectorJson('{', 'x')).toThrow(/not JSON/);
        expect(() => parseMetricVectorJson('[]', 'x')).toThrow(/expected a JSON object/);
    });
});

/**
 * Tests for the evaluation gate's metric vector
 * (`src/scripts/_lib/evaluation_vector.ts`,
 * road-to-governed-harness-evolution steps 4.2 and 4.3).
 *
 * Both steps state their verify clause as an ABSENCE — "no code path computes a
 * single scalar score", "a fixture where the frontier prefers a candidate whose
 * `paired_verdict` is `underpowered` produces no promotion" — and an absence is
 * the shape that passes for free. So the load-bearing assertions here are the
 * negative-polarity ones: the scanner is proved to FIRE on a scalar-collapsing
 * source before it is run over the real modules, and the 4.3 fixture is built
 * so the frontier genuinely prefers the candidate that must not be promoted.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    ARTIFACT_COUNT_METRIC,
    buildVector,
    dominates,
    paretoFrontier,
    promotionVerdict,
    VectorShapeError,
    type MetricRow,
    type MetricVector,
} from '../../src/scripts/_lib/evaluation_vector.js';
import { decidePairedVerdict } from '../../src/scripts/_lib/paired_verdict.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPTS = path.join(REPO, 'src', 'scripts');

// --- § the scalar-collapse scanner ------------------------------------------

/**
 * Comments are stripped first: these modules DOCUMENT the collapse they refuse
 * to perform, and a scanner that fired on the documentation would be a reason
 * to stop documenting it.
 */
export function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Every construct by which a metric vector becomes one number. */
export function findScalarCollapse(source: string): string[] {
    const body = stripComments(source);
    const banned: Array<[string, RegExp]> = [
        ['weighted', /weighted/i],
        ['weight', /\bweights?\b/i],
        ['summary-score', /\b(total|overall|composite|aggregate|combined|final)[_-]?score\b/i],
        ['scalar-score-field', /\bscore\s*[?]?\s*:\s*number\b/],
        ['reduce', /\.reduce\s*\(/],
        ['vector-to-number', /:\s*(readonly\s+)?MetricVector(\[\])?[^)]*\)\s*:\s*number\b/],
    ];
    return banned.filter(([, re]) => re.test(body)).map(([name]) => name);
}

/** Every `.ts` under `src/scripts` that mentions the vector type. */
function vectorHandlingSources(): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        for (const entry of readdirSync(dir)) {
            const full = path.join(dir, entry);
            if (statSync(full).isDirectory()) {
                walk(full);
            } else if (entry.endsWith('.ts') && readFileSync(full, 'utf-8').includes('MetricVector')) {
                out.push(full);
            }
        }
    };
    walk(SCRIPTS);
    return out.sort();
}

/**
 * Modules that are part of the evaluation gate whether or not they name the
 * vector type. Listed so the scan cannot shrink to nothing by a rename; the
 * discovered set above is what makes it grow on its own.
 */
const EVALUATION_VECTOR_TS = path.join(SCRIPTS, '_lib', 'evaluation_vector.ts');
const CORE_MODULES: readonly string[] = [
    EVALUATION_VECTOR_TS,
    path.join(SCRIPTS, '_lib', 'minimality_tiebreak.ts'),
];

describe('4.2 — no code path computes a single scalar score', () => {
    it('the scanner FIRES on every collapsing shape (negative polarity)', () => {
        expect(findScalarCollapse('const w = weight * x;')).toEqual(['weight']);
        expect(findScalarCollapse('function weightedTotal(){}')).toEqual(['weighted']);
        expect(findScalarCollapse('interface R { overall_score: number }')).toEqual(['summary-score']);
        expect(findScalarCollapse('interface R { score: number }')).toEqual(['scalar-score-field']);
        expect(findScalarCollapse('const s = rows.reduce((a, r) => a + r.v, 0);')).toEqual(['reduce']);
        expect(findScalarCollapse('export function score(v: MetricVector): number { return 1; }')).toEqual([
            'vector-to-number',
        ]);
        expect(
            findScalarCollapse('export function rank(vs: readonly MetricVector[]): number { return 0; }'),
        ).toEqual(['vector-to-number']);
    });

    it('the scanner is silent on a plain source (positive polarity)', () => {
        expect(findScalarCollapse('export function dominates(a: MetricVector): boolean { return true; }')).toEqual(
            [],
        );
    });

    it('the comment stripper is not why the real module passes', () => {
        const raw = readFileSync(EVALUATION_VECTOR_TS, 'utf-8');
        // The header argues about weighted totals in prose. The stripped body
        // must still be a module rather than an empty string.
        expect(raw).toContain('weighted total');
        expect(stripComments(raw)).not.toContain('weighted total');
        expect(stripComments(raw).length).toBeGreaterThan(2000);
    });

    it('the scanned set is non-empty and contains the vector module', () => {
        const scanned = new Set([...vectorHandlingSources(), ...CORE_MODULES]);
        expect(scanned.size).toBeGreaterThan(0);
        expect(scanned.has(EVALUATION_VECTOR_TS)).toBe(true);
        for (const f of CORE_MODULES) {
            expect(() => statSync(f)).not.toThrow();
        }
    });

    it('every vector-handling source carries none of them', () => {
        const offenders: Record<string, string[]> = {};
        for (const f of new Set([...vectorHandlingSources(), ...CORE_MODULES])) {
            const hits = findScalarCollapse(readFileSync(f, 'utf-8'));
            if (hits.length > 0) offenders[path.relative(REPO, f)] = hits;
        }
        expect(offenders).toEqual({});
    });
});

// --- § the vector shape ------------------------------------------------------

const PASS = decidePairedVerdict({ deltas: [1, 1, 1, 1, 1, 1] });
const NO_CHANGE = decidePairedVerdict({ deltas: [1, -1, 1, -1, 1, -1] });
const REGRESSION = decidePairedVerdict({ deltas: [-1, -1, -1, -1, -1, -1] });
const UNDERPOWERED = decidePairedVerdict({ deltas: [1, 1, 1] });

function counted(delta: number): MetricRow {
    return { kind: 'counted', metric: ARTIFACT_COUNT_METRIC, direction: 'lower-better', delta };
}
function paired(metric: string, verdict: typeof PASS): MetricRow {
    return { kind: 'paired', metric, direction: 'higher-better', verdict };
}

describe('4.2 — the artifact-count row is inside the gate', () => {
    it('the four paired kinds are what they say they are', () => {
        expect(PASS.kind).toBe('pass');
        expect(NO_CHANGE.kind).toBe('no-change');
        expect(REGRESSION.kind).toBe('regression');
        expect(UNDERPOWERED.kind).toBe('underpowered');
    });

    it('REFUSES a vector with no artifact-count row', () => {
        expect(() => buildVector('c1', [paired('task-success', PASS)])).toThrow(VectorShapeError);
        try {
            buildVector('c1', [paired('task-success', PASS)]);
        } catch (e) {
            expect((e as Error).message).toContain(ARTIFACT_COUNT_METRIC);
        }
    });

    it('REFUSES an empty vector and a duplicate metric', () => {
        expect(() => buildVector('c1', [])).toThrow(VectorShapeError);
        expect(() => buildVector('c1', [counted(0), counted(1)])).toThrow(VectorShapeError);
    });

    it('the artifact delta can refuse a promotion the paired rows would have allowed', () => {
        const grows = buildVector('grow', [paired('task-success', PASS), counted(3)]);
        expect(promotionVerdict(grows).promote).toBe(false);
        expect(promotionVerdict(grows).blocking).toEqual([ARTIFACT_COUNT_METRIC]);
        // ... and a caller that means an ADD says so, rather than the gate guessing.
        expect(promotionVerdict(grows, { artifactDeltaCeiling: 3 }).promote).toBe(true);
    });

    it('carries no summary field on the record itself', () => {
        const v = buildVector('c1', [paired('task-success', PASS), counted(0)]);
        expect(Object.keys(v).sort()).toEqual(['candidate_id', 'rows']);
    });
});

// --- § 4.3 the verdict hierarchy --------------------------------------------

describe('4.3 — the verdict hierarchy, and the frontier that promotes nothing', () => {
    it('a regression blocks', () => {
        const v = buildVector('r', [paired('task-success', REGRESSION), counted(0)]);
        expect(promotionVerdict(v).promote).toBe(false);
        expect(promotionVerdict(v).blocking).toContain('task-success');
    });

    it('underpowered is NOT a pass, and says so in the reason', () => {
        const v = buildVector('u', [paired('task-success', UNDERPOWERED), counted(0)]);
        const verdict = promotionVerdict(v);
        expect(verdict.promote).toBe(false);
        expect(verdict.reason).toContain('underpowered');
        expect(verdict.reason).toContain('not a pass');
    });

    it('all-no-change is a decided absence of improvement, not a clean sheet', () => {
        const v = buildVector('n', [paired('task-success', NO_CHANGE), counted(0)]);
        expect(promotionVerdict(v).promote).toBe(false);
        expect(promotionVerdict(v).blocking).toEqual(['<no-pass-row>']);
    });

    it('a clean vector promotes — the gate is not refusing everything', () => {
        const v = buildVector('ok', [paired('task-success', PASS), paired('token-cost', NO_CHANGE), counted(0)]);
        expect(promotionVerdict(v).promote).toBe(true);
        expect(promotionVerdict(v).blocking).toEqual([]);
    });

    /**
     * THE step-4.3 fixture, built so the frontier genuinely prefers the wrong
     * candidate rather than being asked a question with one answer.
     *
     * `winner` beats `plodder` on `token-cost` (pass vs no-change) and is
     * incomparable on `task-success` (an underpowered row carries no ordering),
     * so it DOMINATES and is the sole member of the frontier. Its
     * `task-success` verdict is `underpowered`, so it must not be promoted.
     */
    const winner: MetricVector = buildVector('winner', [
        paired('task-success', UNDERPOWERED),
        paired('token-cost', PASS),
        counted(0),
    ]);
    const plodder: MetricVector = buildVector('plodder', [
        paired('task-success', NO_CHANGE),
        paired('token-cost', NO_CHANGE),
        counted(0),
    ]);

    it('the frontier does prefer the underpowered candidate (the fixture is real)', () => {
        expect(dominates(winner, plodder)).toBe(true);
        expect(paretoFrontier([winner, plodder]).map((v) => v.candidate_id)).toEqual(['winner']);
    });

    it('and that preference produces NO promotion', () => {
        const front = paretoFrontier([winner, plodder]);
        const promoted = front.filter((v) => promotionVerdict(v).promote);
        expect(promoted).toEqual([]);
        const preferred = front[0];
        expect(preferred).toBeDefined();
        expect(promotionVerdict(preferred as MetricVector).blocking).toContain('task-success');
    });

    it('an underpowered row cannot lose a comparison either — it is an absence, not a worse pass', () => {
        const strong = buildVector('strong', [paired('task-success', PASS), counted(0)]);
        const absent = buildVector('absent', [paired('task-success', UNDERPOWERED), counted(0)]);
        expect(dominates(strong, absent)).toBe(false);
        expect(dominates(absent, strong)).toBe(false);
        expect(paretoFrontier([strong, absent]).map((v) => v.candidate_id)).toEqual(['strong', 'absent']);
    });

    it('REFUSES to compare vectors carrying different metric sets', () => {
        const a = buildVector('a', [paired('task-success', PASS), counted(0)]);
        const b = buildVector('b', [paired('token-cost', PASS), counted(0)]);
        expect(() => dominates(a, b)).toThrow(VectorShapeError);
    });
});

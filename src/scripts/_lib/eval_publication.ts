/**
 * Comparison arms that can discriminate, and results honest enough to publish.
 *
 * `road-to-skill-ecosystem-eval-integrity` Phases 4 and 5. Every function here
 * exists because a benchmark can be run correctly and still produce a number
 * nobody should act on — and each of those routes is a separate mechanism, not
 * a matter of care.
 */
import { createHash } from 'node:crypto';

// ── Phase 4.2 — a fixture the control arm cannot also satisfy ───────────────

export interface PlantedItem {
    id: string;
    /**
     * True when this item is recoverable ONLY via the behaviour the artifact
     * under test prescribes. At least one such item must exist, or the control
     * arm scores the same and the eval adjudicates nothing.
     */
    requires_artifact_behaviour: boolean;
}

/**
 * Can this fixture set discriminate at all?
 *
 * The check runs BEFORE a run rather than after, because the answer does not
 * depend on the outcome: a fixture set where every item is recoverable by
 * general competence measures general competence, whatever the arms score. A
 * run over such a set is not a weak result — it is not a result.
 */
export function discriminationDeficit(items: readonly PlantedItem[]): string | null {
    if (items.length === 0) return 'no fixture items — nothing to recover';
    if (!items.some((i) => i.requires_artifact_behaviour)) {
        return (
            `none of ${String(items.length)} fixture item(s) is recoverable only via the behaviour ` +
            'under test, so the control arm can score identically and the eval cannot adjudicate'
        );
    }
    return null;
}

// ── Phase 4.3 — a missed plant is a zero, never an absence ──────────────────

export interface RubricScoreInput {
    /** Items the run actually reported on. */
    reported: readonly { id: string; score: number }[];
    /** Every item that was planted, whether reported or not. */
    planted: readonly string[];
}

export interface RubricScore {
    /** Sum over PLANTED items, missing ones counted as zero. */
    total: number;
    /** Denominator is the planted count, never the reported count. */
    denominator: number;
    ratio: number;
    missed: readonly string[];
}

/**
 * Score a rubric with missed plants counted as implicit zeros.
 *
 * Dividing by what was REPORTED is the defect: a run that finds one item and
 * says nothing about the other nine scores 100 %, so under-reporting buys a
 * higher ratio. The denominator has to be the plant.
 */
export function scoreWithImplicitZeros(input: RubricScoreInput): RubricScore {
    const byId = new Map(input.reported.map((r) => [r.id, r.score]));
    const missed = input.planted.filter((p) => !byId.has(p));
    const total = input.planted.reduce((a, id) => a + (byId.get(id) ?? 0), 0);
    const denominator = input.planted.length;
    return {
        total,
        denominator,
        ratio: denominator === 0 ? 0 : total / denominator,
        missed,
    };
}

// ── Phase 4.4 — did the run read what it was denied? ────────────────────────

export interface LeakScanInput {
    /** Paths the run must not have read: ground truth, generator, scorers, prior trials. */
    denied: readonly string[];
    /** Every tool input the run recorded, in order. */
    toolInputs: readonly string[];
}

export interface LeakFinding {
    denied: string;
    /** The tool input that matched. */
    evidence: string;
}

/**
 * Walk a run transcript for reads of denied paths.
 *
 * Runs AFTER the trial, on the recorded transcript, because a denial that is
 * only configured is a denial nobody verified. Matching is substring on a
 * path with separators normalised — a leak arriving through a symlink or a
 * parent-directory hop is not something this catches, and saying so is cheaper
 * than implying it does.
 */
export function scanLeaks(input: LeakScanInput): LeakFinding[] {
    const out: LeakFinding[] = [];
    const norm = (s: string): string => s.split(String.fromCharCode(92)).join('/');
    for (const d of input.denied) {
        const needle = norm(d);
        if (needle === '') continue;
        for (const t of input.toolInputs) {
            if (norm(t).includes(needle)) {
                out.push({ denied: d, evidence: t.slice(0, 200) });
                break;
            }
        }
    }
    return out;
}

// ── Phase 4.5 — a cache key that includes the CRITERIA ──────────────────────

export interface BaselineIdentity {
    prompt: string;
    fixtures: readonly string[];
    /** The half most likely to be omitted, which is why it is required here. */
    rubric: readonly string[];
    assertions: readonly string[];
    toolExpectations: readonly string[];
    turnLimit: number;
    tokenLimit: number;
}

/**
 * Composite identity hash for a cached baseline.
 *
 * Keying on prompt and fixtures alone is the common shape and the wrong one: an
 * edited rubric changes what a pass MEANS while the key stays identical, so the
 * cache serves a baseline scored under criteria that no longer exist. The
 * criteria half is required by the type rather than optional, because an
 * optional field that is easy to omit is a field that gets omitted.
 */
export function baselineIdentity(id: BaselineIdentity): string {
    const h = createHash('sha256');
    const feed = (label: string, v: string | readonly string[] | number): void => {
        h.update(` ${label} `);
        h.update(Array.isArray(v) ? [...v].join('') : String(v));
    };
    feed('prompt', id.prompt);
    feed('fixtures', id.fixtures);
    feed('rubric', id.rubric);
    feed('assertions', id.assertions);
    feed('tools', id.toolExpectations);
    feed('turns', id.turnLimit);
    feed('tokens', id.tokenLimit);
    return h.digest('hex');
}

// ── Phase 5.1 / 5.2 — first attempts, and the completeness precondition ─────

export interface Receipt {
    caseId: string;
    configuration: string;
    /** 1 for the first attempt. A later correction carries 2, 3, … */
    attempt: number;
    outcome: 'pass' | 'fail' | 'aborted';
    /** Required when `outcome` is `aborted`, and must be an allow-listed reason. */
    failureReason?: string | undefined;
}

/**
 * Reasons an aborted run may record. A closed set on purpose.
 *
 * The alternative to an allow-list is free text, and free text lets an abort be
 * recorded as anything — including something that reads like a result. A run
 * that stopped is a truthful receipt with its gates marked not-run, never a
 * dropped run and never a fabricated artifact.
 */
export const ABORT_REASONS = [
    'quota-exhausted',
    'credential-missing',
    'dependency-unavailable',
    'timeout',
    'harness-error',
    'operator-cancelled',
] as const;
export type AbortReason = (typeof ABORT_REASONS)[number];

/** Attempt-one-only accounting: a later correction is diagnosis, never a result. */
export function firstAttempts(receipts: readonly Receipt[]): Receipt[] {
    const best = new Map<string, Receipt>();
    for (const r of receipts) {
        // The separator is load-bearing, not cosmetic: without one, a
        // configuration "ab" with case "c" collides with "a" and "bc", which
        // silently drops a receipt — and the completeness precondition below
        // would then report a missing first attempt for a case that has one.
        const key = r.configuration + String.fromCharCode(0) + r.caseId;
        const seen = best.get(key);
        if (seen === undefined || r.attempt < seen.attempt) best.set(key, r);
    }
    return [...best.values()];
}

export interface CompletenessVerdict {
    publishable: boolean;
    /** Every reason it is not, so one fix does not reveal the next one a day later. */
    reasons: string[];
}

/**
 * May this result be published?
 *
 * The precondition is exact and deliberately unforgiving: every configuration
 * has exactly ONE first-attempt receipt for every case. A missing receipt is the
 * shape that produces a published number over a silently smaller denominator,
 * and a duplicate first attempt means two runs disagree about which one counted.
 */
export function completenessVerdict(
    receipts: readonly Receipt[],
    configurations: readonly string[],
    cases: readonly string[],
): CompletenessVerdict {
    const reasons: string[] = [];
    const firsts = receipts.filter((r) => r.attempt === 1);
    for (const cfg of configurations) {
        for (const c of cases) {
            const n = firsts.filter((r) => r.configuration === cfg && r.caseId === c).length;
            if (n === 0) reasons.push(`${cfg} / ${c}: no first-attempt receipt`);
            else if (n > 1) reasons.push(`${cfg} / ${c}: ${String(n)} first-attempt receipts`);
        }
    }
    for (const r of receipts) {
        if (r.outcome !== 'aborted') continue;
        const reason = r.failureReason;
        if (reason === undefined || !(ABORT_REASONS as readonly string[]).includes(reason)) {
            reasons.push(
                `${r.configuration} / ${r.caseId}: aborted with ` +
                    `${reason === undefined ? 'no reason' : `an unlisted reason "${reason}"`} — ` +
                    `allowed: ${ABORT_REASONS.join(', ')}`,
            );
        }
    }
    return { publishable: reasons.length === 0, reasons };
}

// ── Phase 5.7 — a denominator that excludes what cannot self-activate ───────

export interface CoverageInput {
    /** Every artifact in the population. */
    artifacts: readonly { id: string; can_self_activate: boolean; covered: boolean }[];
}

export interface CoverageReport {
    /** Coverage over artifacts that CAN self-activate. */
    rate: number | null;
    denominator: number;
    /** Reported separately, never folded into the rate. */
    dependency_level: readonly string[];
}

/**
 * Coverage, with non-self-activating artifacts excluded from the denominator.
 *
 * An arm that loads only an artifact which cannot activate itself runs
 * treatment-equals-control by construction, so its score is judge noise. Folding
 * such artifacts into a coverage rate publishes that noise as coverage. They are
 * still reported — as dependency-level coverage, which is a real and different
 * claim.
 */
export function coverageExcludingNonActivating(input: CoverageInput): CoverageReport {
    const activating = input.artifacts.filter((a) => a.can_self_activate);
    const dependency = input.artifacts.filter((a) => !a.can_self_activate).map((a) => a.id);
    return {
        rate:
            activating.length === 0
                ? null
                : activating.filter((a) => a.covered).length / activating.length,
        denominator: activating.length,
        dependency_level: dependency,
    };
}

// ── Phase 5.8 — the indeterminate branch, declared before the run ───────────

export interface ThresholdDeclaration {
    metric: string;
    /** At or above this, the pre-registered claim is supported. */
    pass: number;
    /** At or below this, it is refuted. */
    refute: number;
}

export type ThresholdOutcome = 'supported' | 'refuted' | 'indeterminate';

export interface ThresholdVerdict {
    outcome: ThresholdOutcome;
    /** What a null here does and does not license, stated at declaration time. */
    interpretation_limit: string;
}

/**
 * Evaluate a measurement against a pre-registered threshold with a DECLARED
 * indeterminate band.
 *
 * A single cut point forces every measurement into support or refutation, so a
 * value that lands between them is read as whichever the reader hoped for. This
 * package's own honest-null history is the argument: naming the indeterminate
 * outcome BEFORE the run is what makes a null reportable rather than
 * embarrassing.
 *
 * Throws when the band is inverted, because a declaration that cannot produce an
 * indeterminate outcome is the single cut point wearing two numbers.
 */
export function evaluateThreshold(d: ThresholdDeclaration, measured: number): ThresholdVerdict {
    if (d.refute >= d.pass) {
        throw new Error(
            `threshold declaration for "${d.metric}" has refute (${String(d.refute)}) >= pass ` +
                `(${String(d.pass)}) — that leaves no indeterminate band, which is a single cut ` +
                'point with two numbers written on it',
        );
    }
    if (measured >= d.pass) {
        return {
            outcome: 'supported',
            interpretation_limit:
                'supports the pre-registered claim at the declared bar; it does not license a claim ' +
                'about any metric that was not measured',
        };
    }
    if (measured <= d.refute) {
        return {
            outcome: 'refuted',
            interpretation_limit:
                'refutes the pre-registered claim at the declared bar; it does not establish that ' +
                'the opposite claim holds',
        };
    }
    return {
        outcome: 'indeterminate',
        interpretation_limit:
            `landed between the declared bars (${String(d.refute)} .. ${String(d.pass)}): the run ` +
            'neither supports nor refutes. A null here licenses NO directional reading — it says ' +
            'the instrument could not separate the arms at this sample size.',
    };
}

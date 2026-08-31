/**
 * The run report, and the two things step 5.6 asks it to carry.
 *
 * `road-to-governed-harness-evolution` Phase 5, step 5.6.
 *
 * > *5.6 Cheap proposer models first, and track evolution ROI. […] its own
 * > cross-critique faults both parents as cost-blind and answers with a hard
 * > budget cap, while dropping the only cost-*reduction* mechanism both parents
 * > proposed. Improvement per evolution dollar is a reported figure.*
 * > verify: **the ROI figure appears in every run report, and a cheaper model
 * > is tried before an expensive one on each defect class.**
 *
 * ## Why the ROI row is a refusal and not a field somebody remembers
 *
 * A budget cap answers "how much may this cost". It says nothing about whether
 * the spend bought anything, so a programme can spend its whole ceiling on
 * candidates that improved nothing and read as compliant the entire way. The
 * figure that would have caught that is improvement per dollar, and a figure
 * that a report MAY omit is a figure that goes missing on exactly the run whose
 * ratio is embarrassing.
 *
 * So {@link buildRunReport} REFUSES a report without the ROI figure, in the
 * same spirit as `_lib/evaluation_vector.ts`'s {@link buildVector} refusing a
 * vector that omits its artifact-count row: the sprawl measurement belongs
 * inside the gate, and the cost measurement belongs inside the report.
 * {@link RunReport} carries no optional `roi` field, and because types vanish
 * at runtime the refusal is checked against an object cast past the compiler.
 *
 * ## Three ROI kinds, because a ratio is not always defined
 *
 * `improved_rows / dollars` is `Infinity` at zero spend and `NaN` at zero of
 * both. Printing either would be a number where the honest answer is "there is
 * no ratio here". So the figure is a union: `ratio` when spend is positive and
 * at least one candidate was evaluated, `no-spend` when the run cost nothing
 * (the counts are still real and still printed), and `unmeasured` when no
 * candidate carried an evaluation at all.
 *
 * `unmeasured` is the honest state of this programme today and is meant to be
 * read as a finding rather than as a placeholder: `run` clones candidates, and
 * nothing in Phase 5 evaluates them, because step 5.2 keeps the live-floors
 * park intact and there is no live harness to evaluate against. A report that
 * says `unmeasured` is telling the truth about a run that measured nothing.
 *
 * ## The ladder is an ORDERING POLICY, and it has no live subject
 *
 * "A cheaper model is tried before an expensive one" needs an attempt sequence
 * to police, and there is none: no step in this roadmap invokes a live routing
 * harness (5.2), and `tests/scripts/governed_harness_no_live_harness.test.ts`
 * holds that. So {@link assertCheapestFirst} is a guard proved to FIRE on a
 * synthetic out-of-order sequence, standing over a mechanism that does not yet
 * exist. That is stated here rather than implied, because a guard described as
 * if it were policing real traffic is the coverage inflation this tree's own
 * records name repeatedly.
 *
 * What IS live is the plan: {@link buildRunReport} puts the per-class ladder
 * into every report, so the cheapest untried tier for each defect class is on
 * the operator's screen before the first metered call is licensed.
 *
 * ## Tiers are vendor-neutral, and three classes carry an EMPTY ladder
 *
 * `lite | medium | high` is a capability band, not a vendor. Naming a model
 * would tie a cost policy to a price list that changes without this file.
 *
 * `policy_blocked`, `dependency_unavailable` and `human_rejected` get an empty
 * ladder, and that is the strongest cost reduction available rather than an
 * omission: a candidate that a policy refused, that could not find its
 * dependency, or that a human turned down is not made acceptable by a larger
 * model, so no tier is licensed for it at all. {@link nextTier} returns `null`
 * there, which a caller must read as "spend nothing", never as "start at the
 * top".
 */
import type { PairedVerdict, PairedVerdictKind } from './paired_verdict.js';
import { PATHOLOGY_WHY, type PathologyWhy } from './pathology_archive.js';
import {
    ARTIFACT_COUNT_METRIC,
    type MetricRow,
    type MetricVector,
    buildVector,
} from './evaluation_vector.js';

/** The defect-class axis. REUSED from the pathology archive, never re-invented. */
export type DefectClass = PathologyWhy;
export const DEFECT_CLASSES = PATHOLOGY_WHY;

/** Capability bands, CHEAPEST FIRST. The order is the policy. */
export const MODEL_TIERS = ['lite', 'medium', 'high'] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

/** Position in {@link MODEL_TIERS}. Lower is cheaper. */
export function tierRank(tier: ModelTier): number {
    return MODEL_TIERS.indexOf(tier);
}

/**
 * The ladder per defect class, cheapest first.
 *
 * Every list is a prefix of {@link MODEL_TIERS} or empty — a ladder that skipped
 * a rung would be an expensive tier tried before a cheaper one by construction,
 * which is the thing the step forbids. {@link assertLadderWellFormed} checks it.
 */
export const LADDER: Readonly<Record<DefectClass, readonly ModelTier[]>> = {
    // A missing precondition is usually a prompt/context defect: cheap first,
    // and there is a real ceiling because a large model still cannot invent a
    // precondition that is absent.
    precondition_unsatisfied: ['lite', 'medium'],
    // A policy refusal is not a capability problem.
    policy_blocked: [],
    // Neither is a missing dependency.
    dependency_unavailable: [],
    // Execution failures are where capability plausibly helps, so the full ladder.
    execution_failed: ['lite', 'medium', 'high'],
    // A violated output contract is the classic cheap-model-first case: most are
    // format, and format is the cheapest thing a small model gets right.
    output_contract_violated: ['lite', 'medium'],
    // Missing evidence needs more trials, not a bigger proposer.
    evidence_missing: ['lite'],
    // A human said no. No tier changes that.
    human_rejected: [],
    // Unclassified: one cheap attempt is licensed, and no more, because
    // escalating on a reason nobody established is spending on a guess.
    reason_unknown: ['lite'],
};

export class LadderOrderError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LadderOrderError';
    }
}

/** Every ladder is a prefix of {@link MODEL_TIERS}, or the empty ladder. */
export function assertLadderWellFormed(
    ladder: Readonly<Record<DefectClass, readonly ModelTier[]>> = LADDER,
): void {
    for (const cls of DEFECT_CLASSES) {
        const rungs = ladder[cls];
        for (let i = 0; i < rungs.length; i += 1) {
            const expected = MODEL_TIERS[i];
            if (rungs[i] !== expected) {
                throw new LadderOrderError(
                    `${cls}: rung ${String(i)} is '${String(rungs[i])}' where the cheapest-first ` +
                        `order requires '${String(expected)}' — a ladder that skips a rung tries ` +
                        'an expensive tier before a cheaper one by construction',
                );
            }
        }
    }
}

/** The ladder for one class. Empty means no metered attempt is licensed. */
export function ladderFor(cls: DefectClass): readonly ModelTier[] {
    return LADDER[cls];
}

/**
 * The cheapest tier not yet tried for this class, or `null`.
 *
 * `null` means STOP, in both of its two causes: the ladder is empty for this
 * class, or every licensed rung has been spent. A caller that reads `null` as
 * "escalate" has inverted the policy.
 */
export function nextTier(cls: DefectClass, tried: readonly ModelTier[]): ModelTier | null {
    const spent = new Set(tried);
    for (const rung of ladderFor(cls)) {
        if (!spent.has(rung)) return rung;
    }
    return null;
}

/** One metered attempt, as it would be recorded by a harness that made one. */
export interface LadderAttempt {
    readonly defect_class: DefectClass;
    readonly tier: ModelTier;
    /** Monotonic within one class. The ONLY ordering key. */
    readonly sequence: number;
}

/**
 * Refuse an attempt sequence in which a costlier tier ran before a cheaper one
 * for the same defect class, or in which a tier outside the class's ladder ran
 * at all.
 *
 * Per class, in sequence order: each attempt's tier must be the cheapest rung
 * not already spent. A repeat of an already-spent rung is allowed — retrying
 * `lite` is not an escalation — but a jump is not.
 *
 * NO LIVE SUBJECT. Nothing in this programme produces {@link LadderAttempt}s
 * today; see the header. This is a guard waiting for a harness, and its unit
 * test proves it fires rather than proving anything ran.
 */
export function assertCheapestFirst(attempts: readonly LadderAttempt[]): void {
    const byClass = new Map<DefectClass, LadderAttempt[]>();
    for (const a of attempts) {
        const list = byClass.get(a.defect_class) ?? [];
        list.push(a);
        byClass.set(a.defect_class, list);
    }
    for (const [cls, list] of byClass) {
        const rungs = ladderFor(cls);
        if (rungs.length === 0) {
            const first = [...list].sort((x, y) => x.sequence - y.sequence)[0] as LadderAttempt;
            throw new LadderOrderError(
                `${cls}: tier '${first.tier}' was tried on a class whose ladder is empty — ` +
                    'no metered attempt is licensed here, so the cheapest thing to try is nothing',
            );
        }
        const spent: ModelTier[] = [];
        for (const a of [...list].sort((x, y) => x.sequence - y.sequence)) {
            if (!rungs.includes(a.tier)) {
                throw new LadderOrderError(
                    `${cls}: tier '${a.tier}' is not on this class's ladder ` +
                        `(${rungs.join(' < ') || 'empty'})`,
                );
            }
            if (spent.includes(a.tier)) continue;
            const cheapest = nextTier(cls, spent);
            if (cheapest !== null && a.tier !== cheapest) {
                throw new LadderOrderError(
                    `${cls}: tier '${a.tier}' was tried at sequence ${String(a.sequence)} while ` +
                        `'${cheapest}' was still untried — cheaper models go first`,
                );
            }
            spent.push(a.tier);
        }
    }
}

/** One class's ladder as it goes into a report. */
export interface LadderPlanRow {
    readonly defect_class: DefectClass;
    readonly ladder: readonly ModelTier[];
    /** The cheapest untried rung given `tried`, or `null` for "spend nothing". */
    readonly next: ModelTier | null;
}

/** The whole ladder plan, one row per defect class, in vocabulary order. */
export function ladderPlan(
    tried: Readonly<Partial<Record<DefectClass, readonly ModelTier[]>>> = {},
): LadderPlanRow[] {
    return DEFECT_CLASSES.map((cls) => ({
        defect_class: cls,
        ladder: ladderFor(cls),
        next: nextTier(cls, tried[cls] ?? []),
    }));
}

// --- the ROI figure ---------------------------------------------------------

/** Row counts read off the evaluated vectors. Never inferred. */
export interface RoiCounts {
    readonly evaluated_candidates: number;
    readonly improved_rows: number;
    readonly regressed_rows: number;
    readonly underpowered_rows: number;
}

/**
 * Improvement per evolution dollar.
 *
 * `regressed_rows` and `underpowered_rows` ride alongside the ratio rather than
 * being netted into it. Netting would let a candidate that improved two rows
 * and regressed two report as neutral, which is the collapse
 * `_lib/evaluation_vector.ts` refuses for the same reason.
 */
export type RoiFigure =
    | ({ readonly kind: 'ratio'; readonly spend_cents: number; readonly improvement_per_dollar: number } & RoiCounts)
    | ({ readonly kind: 'no-spend'; readonly spend_cents: 0 } & RoiCounts)
    | ({ readonly kind: 'unmeasured'; readonly spend_cents: number } & RoiCounts);

/** Count the paired rows by verdict kind across the evaluated vectors. */
export function roiCounts(vectors: readonly MetricVector[]): RoiCounts {
    let improved = 0;
    let regressed = 0;
    let underpowered = 0;
    for (const v of vectors) {
        for (const r of v.rows) {
            if (r.kind !== 'paired') continue;
            if (r.verdict.kind === 'pass') improved += 1;
            else if (r.verdict.kind === 'regression') regressed += 1;
            else if (r.verdict.kind === 'underpowered') underpowered += 1;
        }
    }
    return {
        evaluated_candidates: vectors.length,
        improved_rows: improved,
        regressed_rows: regressed,
        underpowered_rows: underpowered,
    };
}

export class RoiShapeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RoiShapeError';
    }
}

/**
 * The figure. `spendCents` is the run's declared spend in WHOLE CENTS, matching
 * `RunBudget.maxSpendCents` — no float ever decides a kind.
 */
export function roiFigure(vectors: readonly MetricVector[], spendCents: number): RoiFigure {
    if (!Number.isInteger(spendCents) || spendCents < 0) {
        throw new RoiShapeError(
            `spend must be a non-negative whole number of cents (got ${String(spendCents)})`,
        );
    }
    const counts = roiCounts(vectors);
    if (counts.evaluated_candidates === 0) {
        return { kind: 'unmeasured', spend_cents: spendCents, ...counts };
    }
    if (spendCents === 0) {
        return { kind: 'no-spend', spend_cents: 0, ...counts };
    }
    return {
        kind: 'ratio',
        spend_cents: spendCents,
        improvement_per_dollar: counts.improved_rows / (spendCents / 100),
        ...counts,
    };
}

// --- the run report ---------------------------------------------------------

/**
 * A run report. There is no optional field here, and `roi` is the reason:
 * an optional ROI figure is one a report omits on the run that needed it.
 */
export interface RunReport {
    readonly run_id: string;
    readonly candidates: number;
    readonly trials_per_candidate: number;
    readonly roi: RoiFigure;
    readonly ladder: readonly LadderPlanRow[];
}

export interface RunReportInput {
    readonly run_id: string;
    readonly candidates: number;
    readonly trials_per_candidate: number;
    readonly roi: RoiFigure;
    readonly ladder?: readonly LadderPlanRow[];
}

export class RunReportShapeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RunReportShapeError';
    }
}

/** Kinds a `roi` value may carry. Checked at runtime, where types are gone. */
const ROI_KINDS = new Set(['ratio', 'no-spend', 'unmeasured']);

/**
 * Build a report, REFUSING one without an ROI figure.
 *
 * The check is deliberately a runtime one over a value the compiler already
 * types: a caller reaching this function through `as RunReportInput`, a JSON
 * parse, or a `delete` is exactly the caller who would drop the row, and the
 * type system cannot see any of them.
 */
export function buildRunReport(input: RunReportInput): RunReport {
    if (input.run_id.trim() === '') {
        throw new RunReportShapeError('a report with no run id names no run');
    }
    const roi = (input as { roi?: unknown }).roi;
    if (roi === undefined || roi === null || typeof roi !== 'object') {
        throw new RunReportShapeError(
            'missing the ROI figure — improvement per evolution dollar is what a budget cap ' +
                'does not report, so a run report without it is the cost-blind report step 5.6 ' +
                'exists to prevent',
        );
    }
    const kind = (roi as { kind?: unknown }).kind;
    if (typeof kind !== 'string' || !ROI_KINDS.has(kind)) {
        throw new RunReportShapeError(
            `ROI figure carries an unknown kind ${JSON.stringify(kind)} — expected one of ` +
                `${[...ROI_KINDS].join(', ')}`,
        );
    }
    assertLadderWellFormed();
    return {
        run_id: input.run_id,
        candidates: input.candidates,
        trials_per_candidate: input.trials_per_candidate,
        roi: input.roi,
        ladder: input.ladder ?? ladderPlan(),
    };
}

/** The ROI line, verbatim. One line, always present, never conditional. */
export function renderRoi(roi: RoiFigure): string {
    const head =
        `roi: improved=${String(roi.improved_rows)} regressed=${String(roi.regressed_rows)} ` +
        `underpowered=${String(roi.underpowered_rows)} over ` +
        `${String(roi.evaluated_candidates)} evaluated candidate(s), spend=${String(roi.spend_cents)}c`;
    if (roi.kind === 'ratio') {
        return `${head} -> ${roi.improvement_per_dollar.toFixed(3)} improved rows per dollar`;
    }
    if (roi.kind === 'no-spend') {
        return `${head} -> no ratio: the run spent nothing, so improvement per dollar is undefined`;
    }
    return `${head} -> no ratio: no candidate in this run carried an evaluation`;
}

/** The whole report as lines a caller writes to stdout unchanged. */
export function renderRunReport(r: RunReport): string[] {
    const lines = [
        `run-report: ${r.run_id}`,
        `run-report: candidates=${String(r.candidates)} trials-per-candidate=${String(r.trials_per_candidate)}`,
        `run-report: ${renderRoi(r.roi)}`,
    ];
    for (const row of r.ladder) {
        const rungs = row.ladder.length === 0 ? '(none licensed)' : row.ladder.join(' < ');
        const next = row.next === null ? 'spend nothing' : row.next;
        lines.push(`run-report: ladder ${row.defect_class}: ${rungs} | next: ${next}`);
    }
    return lines;
}

// --- reading an evaluation off disk -----------------------------------------

/**
 * Parse a `MetricVector` from JSON, reusing {@link buildVector} so the
 * artifact-count refusal is inherited rather than re-implemented.
 */
export function parseMetricVectorJson(text: string, source: string): MetricVector {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch (e) {
        throw new RoiShapeError(`${source}: not JSON — ${(e as Error).message}`);
    }
    // An array IS an object in JS, so the array check is not pedantry: without
    // it a `[]` payload falls through to the field checks and reports a missing
    // `candidate_id`, which names the wrong defect.
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new RoiShapeError(`${source}: expected a JSON object`);
    }
    const obj = raw as { candidate_id?: unknown; rows?: unknown };
    if (typeof obj.candidate_id !== 'string' || obj.candidate_id.trim() === '') {
        throw new RoiShapeError(`${source}: 'candidate_id' must be a non-empty string`);
    }
    if (!Array.isArray(obj.rows)) {
        throw new RoiShapeError(`${source}: 'rows' must be an array`);
    }
    const rows: MetricRow[] = [];
    for (const [i, r] of (obj.rows as unknown[]).entries()) {
        rows.push(parseRow(r, `${source}: rows[${String(i)}]`));
    }
    return buildVector(obj.candidate_id, rows);
}

const DIRECTIONS = new Set(['higher-better', 'lower-better']);
const VERDICT_KINDS = new Set(['pass', 'no-change', 'regression', 'underpowered']);

function parseRow(raw: unknown, where: string): MetricRow {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new RoiShapeError(`${where}: expected an object`);
    }
    const r = raw as Record<string, unknown>;
    const metric = r.metric;
    const direction = r.direction;
    if (typeof metric !== 'string' || metric.trim() === '') {
        throw new RoiShapeError(`${where}: 'metric' must be a non-empty string`);
    }
    if (typeof direction !== 'string' || !DIRECTIONS.has(direction)) {
        throw new RoiShapeError(`${where}: 'direction' must be higher-better or lower-better`);
    }
    if (r.kind === 'counted') {
        if (!Number.isInteger(r.delta)) {
            throw new RoiShapeError(`${where}: a counted row needs an integer 'delta'`);
        }
        return {
            kind: 'counted',
            metric,
            direction: direction as 'higher-better' | 'lower-better',
            delta: r.delta as number,
        };
    }
    if (r.kind === 'paired') {
        const v = r.verdict;
        if (typeof v !== 'object' || v === null) {
            throw new RoiShapeError(`${where}: a paired row needs a 'verdict' object`);
        }
        const raw_v = v as Record<string, unknown>;
        const kind = raw_v.kind;
        if (typeof kind !== 'string' || !VERDICT_KINDS.has(kind)) {
            throw new RoiShapeError(
                `${where}: verdict kind ${JSON.stringify(kind)} is not one of ` +
                    `${[...VERDICT_KINDS].join(', ')}`,
            );
        }
        // Every counted field is validated rather than spread through: a
        // verdict read off disk is untrusted input, and a string where an
        // integer belongs is how a report ends up printing `NaN` per dollar.
        const verdict: PairedVerdict = {
            kind: kind as PairedVerdictKind,
            discordant: intField(raw_v, 'discordant', where),
            wins: intField(raw_v, 'wins', where),
            losses: intField(raw_v, 'losses', where),
            p: numField(raw_v, 'p', where),
            magnitude_mean:
                raw_v.magnitude_mean === null || raw_v.magnitude_mean === undefined
                    ? null
                    : numField(raw_v, 'magnitude_mean', where),
            at_floor: raw_v.at_floor === true,
            reason: typeof raw_v.reason === 'string' ? raw_v.reason : '',
        };
        return {
            kind: 'paired',
            metric,
            direction: direction as 'higher-better' | 'lower-better',
            verdict,
        };
    }
    throw new RoiShapeError(
        `${where}: 'kind' must be 'paired' or 'counted' (got ${JSON.stringify(r.kind)}) — ` +
            `a metric row without a kind cannot be counted toward ${ARTIFACT_COUNT_METRIC} or ROI`,
    );
}

function intField(o: Record<string, unknown>, key: string, where: string): number {
    const v = o[key];
    if (!Number.isInteger(v)) {
        throw new RoiShapeError(`${where}: verdict '${key}' must be an integer`);
    }
    return v as number;
}

function numField(o: Record<string, unknown>, key: string, where: string): number {
    const v = o[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new RoiShapeError(`${where}: verdict '${key}' must be a finite number`);
    }
    return v;
}

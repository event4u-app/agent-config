/**
 * The promotion evidence package — `road-to-harness-promotion-bridge` steps
 * 7.1, 7.2, 7.3 and 7.5.
 *
 * ## What this module is, and what it deliberately is not
 *
 * It is a REFUSING VALIDATOR. It reads an untrusted evidence document and either
 * returns a typed package or throws naming the first thing missing. It performs
 * no filesystem write, mints no capability, and expresses no promotion — the
 * capability stays `_lib/promotion_capability.ts` and the structural invariant
 * that nothing bypasses it stays `lint_promotion_paths.ts`.
 *
 * ## 7.1 — one evidence package per promotion, in the fuller form
 *
 * > *The master adopted a 9-field package; the skipped parent's has 14, and the
 * > five extra are exactly the fields that make 3.2, 4.4 and 7.3 auditable:
 * > pathology cell, candidate lineage, mutation dimension, selection results,
 * > sealed result, cost, scope.*
 * > verify: **a promotion attempt with any field absent is refused.**
 *
 * **The step's own arithmetic does not close, and it is implemented rather than
 * silently reconciled.** It says "the five extra" and then names SEVEN fields.
 * Both readings were available — implement five of the seven, or implement all
 * seven — and the conservative one is taken: all seven are REQUIRED, because
 * dropping two would be a narrowing of a transferred step, and narrowing a
 * transferred step is exactly what the split's own preamble forbids. The count
 * discrepancy is recorded here rather than resolved, since resolving it means
 * editing the verbatim text.
 *
 * {@link PROMOTION_EVIDENCE_FIELDS} therefore carries the seven named fields,
 * the candidate id they hang off, and three more that belong to sibling steps in
 * the same package: `governance` (7.2), `rollout` (7.5) and
 * `material_improvement` (7.4). One package, one validator, one refusal path —
 * splitting them into four documents would be the second governance system 7.2
 * forbids, in a different costume.
 *
 * ## 7.2 — route through the existing gate, not a second governance system
 *
 * > verify: **no new governance verb, no new approval path.**
 *
 * The four vocabulary terms are IMPORTED, not redeclared: `AUTHORITY_BASES`,
 * `EVIDENCE_STRENGTHS`, `REOPEN_POLICIES` and `PROTECTED_DIMENSIONS` all come
 * from `_lib/adr_frontmatter.ts`, which is what `check_adr_frontmatter.ts` and
 * `adr_cite_check.ts` already read. A copy would have satisfied the letter and
 * broken the point: two lists that can drift ARE two governance systems.
 *
 * ## 7.3 — promote by scope, with a transfer gate
 *
 * {@link SCOPE_LADDER} is ordered, and the order is its contract. A raise
 * demands independent transfer evidence from a second solver OR a second host
 * configuration; evidence that all comes from one of each is refused, which is
 * the step's second verify clause verbatim.
 *
 * ## 7.5 — roll out by canary, never silently
 *
 * A package that declares it changes a shipped default and cannot name a
 * COMPLETED opt-in bundle is refused. What this can and cannot establish is
 * stated at {@link assertRollout}.
 */
import {
    AUTHORITY_BASES,
    EVIDENCE_STRENGTHS,
    PROTECTED_DIMENSIONS,
    REOPEN_POLICIES,
} from './adr_frontmatter.js';
import { MUTATION_DIMENSIONS, type MutationDimension, isMutationDimension } from './candidate_record.js';

/** Raised on the first missing or malformed field. Never a list — the first one is the finding. */
export class PromotionEvidenceError extends Error {
    /** The field that failed, so a caller can name it without parsing the message. */
    readonly field: string;
    constructor(field: string, why: string) {
        super(`promotion evidence: '${field}' ${why}`);
        this.name = 'PromotionEvidenceError';
        this.field = field;
    }
}

// --- 7.3 — the scope ladder -------------------------------------------------

/**
 * The ladder, in ascending order. The ORDER is the contract: it is the only
 * thing that makes "moving up a level" decidable.
 */
export const SCOPE_LADDER = ['episode', 'repo', 'stack', 'profile-pack', 'global'] as const;
export type ScopeLevel = (typeof SCOPE_LADDER)[number];

export function isScopeLevel(v: unknown): v is ScopeLevel {
    return typeof v === 'string' && (SCOPE_LADDER as readonly string[]).includes(v);
}

export function scopeIndex(s: ScopeLevel): number {
    return SCOPE_LADDER.indexOf(s);
}

/** One independent replication of the candidate's effect. */
export interface TransferEvidence {
    /** The host configuration it was reproduced under. */
    readonly configuration: string;
    /** The solver that reproduced it. */
    readonly solver: string;
    /** What was observed. Free text, but non-empty — an unstated result is not evidence. */
    readonly result: string;
}

export interface PromotionScope {
    readonly level: ScopeLevel;
    /** Absent means "not a raise" — the candidate is promoted at the level it was evaluated. */
    readonly raisedFrom?: ScopeLevel;
    readonly transferEvidence: readonly TransferEvidence[];
}

/**
 * The transfer gate.
 *
 * A raise needs evidence that is INDEPENDENT of the configuration the candidate
 * was evaluated under — a second solver or a second host configuration. Evidence
 * that all shares one solver and one configuration is one observation written
 * several times, and admitting it is how "every promotion goes straight to
 * canonical and the anti-bloat doctrine has no teeth".
 *
 * @throws {PromotionEvidenceError} on a raise without independent evidence.
 */
export function assertTransferEvidence(scope: PromotionScope): void {
    if (scope.raisedFrom === undefined) {
        return;
    }
    if (scopeIndex(scope.level) <= scopeIndex(scope.raisedFrom)) {
        return;
    }
    const solvers = new Set(scope.transferEvidence.map((e) => e.solver));
    const configurations = new Set(scope.transferEvidence.map((e) => e.configuration));
    if (solvers.size < 2 && configurations.size < 2) {
        throw new PromotionEvidenceError(
            'scope',
            `raises ${scope.raisedFrom} -> ${scope.level} on ${String(scope.transferEvidence.length)} ` +
                `observation(s) from ${String(solvers.size)} solver(s) and ${String(configurations.size)} ` +
                'configuration(s). A raise requires a SECOND solver or a SECOND host configuration; ' +
                'one configuration measured repeatedly is one observation, not transfer.',
        );
    }
}

// --- 7.5 — the canary rollout -----------------------------------------------

/** Ordered: a promotion enters at `opt-in` and reaches `default` only through it. */
export const ROLLOUT_STAGES = ['opt-in', 'canary', 'default'] as const;
export type RolloutStage = (typeof ROLLOUT_STAGES)[number];

export interface PromotionRollout {
    readonly stage: RolloutStage;
    /** The opt-in candidate bundle this promotion shipped in. */
    readonly bundle: string;
    readonly optInCompleted: boolean;
    /** Does landing this change what a consumer gets without opting in? */
    readonly changesShippedDefault: boolean;
}

/**
 * The stage gate.
 *
 * > verify: **no promotion changes a shipped default without an opt-in stage.**
 *
 * **What this establishes and what it does not.** It refuses a PACKAGE that
 * declares a shipped-default change with no completed opt-in bundle, and it
 * refuses a package that claims the `default` stage without one. It cannot
 * establish that a package which declares `changesShippedDefault: false` is
 * telling the truth — that is only observable once a promotion path can actually
 * run and the resulting diff can be compared against the shipped defaults, which
 * `blocker: merge-authority` prevents. The mechanism half is built and tested;
 * the observation half is named as absent rather than implied.
 *
 * @throws {PromotionEvidenceError}
 */
export function assertRollout(rollout: PromotionRollout): void {
    if (rollout.changesShippedDefault && !rollout.optInCompleted) {
        throw new PromotionEvidenceError(
            'rollout',
            'changes a shipped default with no COMPLETED opt-in stage. Roll out by canary: ship the ' +
                'candidate in an opt-in bundle, complete that stage, and only then change what a ' +
                'consumer gets without asking for it.',
        );
    }
    if (rollout.stage === 'default' && !rollout.optInCompleted) {
        throw new PromotionEvidenceError(
            'rollout',
            "claims the 'default' stage without a completed opt-in stage. The ladder is " +
                `${ROLLOUT_STAGES.join(' -> ')} and it is not skippable.`,
        );
    }
    if (rollout.optInCompleted && rollout.bundle.trim() === '') {
        throw new PromotionEvidenceError(
            'rollout',
            'reports a completed opt-in stage but names no bundle. An unnamed bundle cannot be audited, ' +
                'and an unauditable opt-in is the silent rollout this step exists to prevent.',
        );
    }
}

// --- 7.2 — the governance block, in the existing vocabulary -----------------

export interface PromotionGovernance {
    readonly authorityBasis: string;
    readonly evidenceStrength: string;
    readonly reopenPolicy: string;
    readonly protectedDimensions: readonly string[];
}

// --- 7.1 — the package ------------------------------------------------------

/**
 * Every field a promotion attempt must carry. Order is the refusal order, so a
 * caller fixing one at a time walks the list top to bottom.
 */
export const PROMOTION_EVIDENCE_FIELDS = [
    'candidate_id',
    'pathology_cell',
    'lineage',
    'dimension',
    'selection',
    'sealed_result',
    'cost',
    'scope',
    'governance',
    'rollout',
    'material_improvement',
] as const;
export type PromotionEvidenceField = (typeof PROMOTION_EVIDENCE_FIELDS)[number];

export interface PromotionEvidence {
    readonly candidateId: string;
    /** The pathology × subject cell the candidate targets (3.2 attribution). */
    readonly pathologyCell: string;
    /** Ancestor candidate ids, oldest first. May be empty; the KEY is required. */
    readonly lineage: readonly string[];
    readonly dimension: MutationDimension;
    readonly selection: { readonly trials: number; readonly wins: number; readonly summary: string };
    readonly sealedResult: { readonly held: boolean; readonly summary: string };
    readonly cost: { readonly trials: number; readonly spendCents: number };
    readonly scope: PromotionScope;
    readonly governance: PromotionGovernance;
    readonly rollout: PromotionRollout;
    /** 7.4's evidence: what it replaces, what it says, and the measured delta. */
    readonly materialImprovement: {
        readonly baselineText: string;
        readonly candidateText: string;
        readonly deltaPercent: number;
    };
}

function obj(input: unknown, field: string): Record<string, unknown> {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        throw new PromotionEvidenceError(field, 'must be a JSON object');
    }
    return input as Record<string, unknown>;
}

function required(o: Record<string, unknown>, key: PromotionEvidenceField): unknown {
    // ABSENT, never defaulted. The verify clause is "a promotion attempt with any
    // field absent is refused", and a default is a value the author did not choose.
    if (!(key in o)) {
        throw new PromotionEvidenceError(key, 'is required and is never defaulted — an absent field is not an empty one');
    }
    return o[key];
}

function nonEmptyString(v: unknown, field: string): string {
    if (typeof v !== 'string' || v.trim() === '') {
        throw new PromotionEvidenceError(field, 'must be a non-empty string');
    }
    return v;
}

function integer(v: unknown, field: string): number {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
        throw new PromotionEvidenceError(field, 'must be a non-negative integer');
    }
    return v;
}

function oneOf(v: unknown, allowed: readonly string[], field: string): string {
    if (typeof v !== 'string' || !allowed.includes(v)) {
        throw new PromotionEvidenceError(field, `must be one of ${allowed.join(', ')} (got ${JSON.stringify(v)})`);
    }
    return v;
}

/**
 * Validate an untrusted evidence document — the refusing path.
 *
 * @throws {PromotionEvidenceError} on the first violation, naming the field.
 */
export function parsePromotionEvidence(input: unknown): PromotionEvidence {
    const o = obj(input, 'package');

    const candidateId = nonEmptyString(required(o, 'candidate_id'), 'candidate_id');
    const pathologyCell = nonEmptyString(required(o, 'pathology_cell'), 'pathology_cell');

    const rawLineage = required(o, 'lineage');
    if (!Array.isArray(rawLineage)) {
        throw new PromotionEvidenceError('lineage', 'must be an array of ancestor candidate ids (use [] for none)');
    }
    const lineage = rawLineage.map((x, i) => nonEmptyString(x, `lineage[${String(i)}]`));

    const dimension = required(o, 'dimension');
    if (!isMutationDimension(dimension)) {
        throw new PromotionEvidenceError(
            'dimension',
            `must be one of ${MUTATION_DIMENSIONS.join(', ')} — one PRIMARY dimension per candidate (step 3.2)`,
        );
    }

    const sel = obj(required(o, 'selection'), 'selection');
    const selection = {
        trials: integer(sel['trials'], 'selection.trials'),
        wins: integer(sel['wins'], 'selection.wins'),
        summary: nonEmptyString(sel['summary'], 'selection.summary'),
    };
    if (selection.wins > selection.trials) {
        throw new PromotionEvidenceError('selection', 'reports more wins than trials');
    }

    const sealed = obj(required(o, 'sealed_result'), 'sealed_result');
    if (typeof sealed['held'] !== 'boolean') {
        throw new PromotionEvidenceError('sealed_result.held', 'must be a boolean — did the sealed evaluation hold?');
    }
    const sealedResult = { held: sealed['held'], summary: nonEmptyString(sealed['summary'], 'sealed_result.summary') };

    const rawCost = obj(required(o, 'cost'), 'cost');
    const cost = {
        trials: integer(rawCost['trials'], 'cost.trials'),
        spendCents: integer(rawCost['spend_cents'], 'cost.spend_cents'),
    };

    const rawScope = obj(required(o, 'scope'), 'scope');
    const level = rawScope['level'];
    if (!isScopeLevel(level)) {
        throw new PromotionEvidenceError('scope.level', `must be one of ${SCOPE_LADDER.join(' -> ')}`);
    }
    const rawRaised = rawScope['raised_from'];
    if (rawRaised !== undefined && !isScopeLevel(rawRaised)) {
        throw new PromotionEvidenceError('scope.raised_from', `must be one of ${SCOPE_LADDER.join(' -> ')} when present`);
    }
    const rawTransfer = rawScope['transfer_evidence'];
    if (!Array.isArray(rawTransfer)) {
        throw new PromotionEvidenceError('scope.transfer_evidence', 'must be an array (use [] when this is not a raise)');
    }
    const transferEvidence: TransferEvidence[] = rawTransfer.map((raw, i) => {
        const e = obj(raw, `scope.transfer_evidence[${String(i)}]`);
        return {
            configuration: nonEmptyString(e['configuration'], `scope.transfer_evidence[${String(i)}].configuration`),
            solver: nonEmptyString(e['solver'], `scope.transfer_evidence[${String(i)}].solver`),
            result: nonEmptyString(e['result'], `scope.transfer_evidence[${String(i)}].result`),
        };
    });
    const scope: PromotionScope =
        rawRaised === undefined
            ? { level, transferEvidence }
            : { level, raisedFrom: rawRaised, transferEvidence };
    assertTransferEvidence(scope);

    const gov = obj(required(o, 'governance'), 'governance');
    const rawDims = gov['protected_dimensions'];
    if (!Array.isArray(rawDims)) {
        throw new PromotionEvidenceError('governance.protected_dimensions', "must be an array (use ['none'])");
    }
    const governance: PromotionGovernance = {
        authorityBasis: oneOf(gov['authority_basis'], AUTHORITY_BASES, 'governance.authority_basis'),
        evidenceStrength: oneOf(gov['evidence_strength'], EVIDENCE_STRENGTHS, 'governance.evidence_strength'),
        reopenPolicy: oneOf(gov['reopen_policy'], REOPEN_POLICIES, 'governance.reopen_policy'),
        protectedDimensions: rawDims.map((d, i) =>
            oneOf(d, PROTECTED_DIMENSIONS, `governance.protected_dimensions[${String(i)}]`),
        ),
    };
    if (governance.protectedDimensions.length === 0) {
        throw new PromotionEvidenceError('governance.protected_dimensions', "must name at least one dimension (use ['none'])");
    }

    const rol = obj(required(o, 'rollout'), 'rollout');
    if (typeof rol['opt_in_completed'] !== 'boolean' || typeof rol['changes_shipped_default'] !== 'boolean') {
        throw new PromotionEvidenceError('rollout', "needs boolean 'opt_in_completed' and 'changes_shipped_default'");
    }
    const rollout: PromotionRollout = {
        stage: oneOf(rol['stage'], ROLLOUT_STAGES, 'rollout.stage') as RolloutStage,
        bundle: typeof rol['bundle'] === 'string' ? rol['bundle'] : '',
        optInCompleted: rol['opt_in_completed'],
        changesShippedDefault: rol['changes_shipped_default'],
    };
    assertRollout(rollout);

    const mi = obj(required(o, 'material_improvement'), 'material_improvement');
    const materialImprovement = {
        baselineText: nonEmptyString(mi['baseline_text'], 'material_improvement.baseline_text'),
        candidateText: nonEmptyString(mi['candidate_text'], 'material_improvement.candidate_text'),
        deltaPercent: typeof mi['delta_percent'] === 'number' ? mi['delta_percent'] : Number.NaN,
    };
    if (!Number.isFinite(materialImprovement.deltaPercent)) {
        throw new PromotionEvidenceError('material_improvement.delta_percent', 'must be a finite number');
    }

    return {
        candidateId,
        pathologyCell,
        lineage,
        dimension: dimension as MutationDimension,
        selection,
        sealedResult,
        cost,
        scope,
        governance,
        rollout,
        materialImprovement,
    };
}

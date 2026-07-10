/**
 * Orchestration telemetry record builder (pure, no-I/O).
 *
 * Builds ONE validated audit-log-v1 line carrying an `orchestration`
 * sub-object, from the counts the orchestrating agent already has after an
 * auto-dispatch. This is the agent-behavioral capture path decided 2026-06-30
 * (maintainer decision: no hook/daemon — the agent writes directly), made
 * reliable + one-command here instead of hand-authored JSON.
 *
 * Contracts:
 * - `docs/contracts/audit-log-v1.md` (the envelope)
 * - `src/agent-src/contexts/execution/orchestration-telemetry.md` (the object)
 *
 * PRIVACY BY CONSTRUCTION: every field is a count, enum, or id — there is NO
 * field capable of holding free-form content, prompt text, or a body. Do not
 * add one. (Mirrors `domain-safety-pii` § Surface 2 / artifact-engagement.)
 */

export type DispatchOutcome = 'DONE' | 'DONE_WITH_CONCERNS' | 'NEEDS_CONTEXT' | 'BLOCKED' | 'killed';
export type VerifyMode = 'deterministic' | 'judge' | 'none';
export type Provenance = 'measured' | 'estimated';
export type TierChosen = 'lite' | 'medium' | 'high';
export type TierSource = 'static' | 'inferred' | 'inherit';
export type Band = 'low' | 'medium' | 'high';
export type LinePhase = 'refine' | 'memory' | 'analyze' | 'plan' | 'implement' | 'test' | 'verify' | 'report';
export type LineOutcome = 'success' | 'blocked' | 'skipped' | 'error';

/** Inputs the agent supplies about one auto-dispatch. */
export interface RecordInput {
    // Orchestration object
    spawn_count: number;
    token_delta: number;
    // Optionals accept explicit `undefined` (CLI parsing yields it); the
    // builder defaults every one. Compatible with exactOptionalPropertyTypes.
    token_delta_provenance?: Provenance | undefined;
    tiers?: string[] | undefined;
    tier_chosen?: TierChosen | null | undefined;
    tier_source?: TierSource | null | undefined;
    task_class?: string | null | undefined;
    task_size_estimate?: number | undefined;
    wall_clock_ms?: number | undefined;
    /** Absolute measured tokens the dispatched slice consumed (feeds the modeled cost-%). */
    dispatch_tokens?: number | null | undefined;
    /** The orchestrator's own tier — the baseline the downshift cost-% measures against. */
    session_tier?: string | null | undefined;
    dispatch_outcome?: DispatchOutcome | undefined;
    verify_mode?: VerifyMode | undefined;
    /** QUALITY: subagent return adopted without parent rework. Optional boolean (null = not measured). */
    first_pass_success?: boolean | undefined;
    /** QUALITY: slice retried on a higher tier after a verification failure. Optional boolean (null = not measured). */
    escalated?: boolean | undefined;
    // Audit-log envelope (sensible defaults for a dispatch record)
    phase?: LinePhase | undefined;
    outcome?: LineOutcome | undefined;
    confidence_band?: Band | undefined;
    risk_class?: Band | undefined;
    persona?: string | null | undefined;
    work_id?: string | undefined;
    /** ISO-8601 UTC timestamp; caller supplies (keeps this fn pure/deterministic). */
    ts: string;
    /** Stable id (ULID or content hash); caller supplies. */
    id: string;
}

export interface BuiltLine {
    line: Record<string, unknown> | null;
    errors: string[];
}

const DISPATCH_OUTCOMES: readonly DispatchOutcome[] = ['DONE', 'DONE_WITH_CONCERNS', 'NEEDS_CONTEXT', 'BLOCKED', 'killed'];
const VERIFY_MODES: readonly VerifyMode[] = ['deterministic', 'judge', 'none'];
const PROVENANCES: readonly Provenance[] = ['measured', 'estimated'];
const TIERS_CHOSEN: readonly TierChosen[] = ['lite', 'medium', 'high'];
const TIER_SOURCES: readonly TierSource[] = ['static', 'inferred', 'inherit'];
const BANDS: readonly Band[] = ['low', 'medium', 'high'];
const PHASES: readonly LinePhase[] = ['refine', 'memory', 'analyze', 'plan', 'implement', 'test', 'verify', 'report'];

/** Map a dispatch outcome to the audit-log envelope outcome enum. */
function envelopeOutcome(d: DispatchOutcome): LineOutcome {
    if (d === 'BLOCKED') return 'blocked';
    if (d === 'NEEDS_CONTEXT') return 'skipped';
    if (d === 'killed') return 'error';
    return 'success'; // DONE / DONE_WITH_CONCERNS
}

function isInt(n: unknown): n is number {
    return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n);
}

/**
 * Build + validate the audit-log-v1 line. Returns `{line, errors}`; when
 * `errors` is non-empty, `line` is null and the caller must NOT write.
 */
export function buildOrchestrationLine(input: RecordInput): BuiltLine {
    const errors: string[] = [];

    if (!isInt(input.spawn_count) || input.spawn_count < 1) {
        errors.push('spawn_count must be an integer ≥ 1 (0 = handled in-session, not a dispatch — do not record)');
    }
    if (!isInt(input.token_delta)) errors.push('token_delta must be an integer (negative = net saved vs the in-session baseline)');
    if (input.task_size_estimate !== undefined && (!isInt(input.task_size_estimate) || input.task_size_estimate < 0)) {
        errors.push('task_size_estimate must be a non-negative integer');
    }
    if (input.wall_clock_ms !== undefined && (!isInt(input.wall_clock_ms) || input.wall_clock_ms < 0)) {
        errors.push('wall_clock_ms must be a non-negative integer');
    }
    if (input.dispatch_tokens != null && (!isInt(input.dispatch_tokens) || input.dispatch_tokens < 0)) {
        errors.push('dispatch_tokens must be a non-negative integer (absolute tokens the dispatched slice consumed)');
    }

    const prov: Provenance = input.token_delta_provenance ?? 'estimated';
    if (!PROVENANCES.includes(prov)) errors.push(`token_delta_provenance must be one of ${PROVENANCES.join(' | ')}`);

    const dOutcome: DispatchOutcome = input.dispatch_outcome ?? 'DONE';
    if (!DISPATCH_OUTCOMES.includes(dOutcome)) errors.push(`dispatch_outcome must be one of ${DISPATCH_OUTCOMES.join(' | ')}`);

    const vMode: VerifyMode = input.verify_mode ?? 'deterministic';
    if (!VERIFY_MODES.includes(vMode)) errors.push(`verify_mode must be one of ${VERIFY_MODES.join(' | ')}`);

    if (input.tier_chosen != null && !TIERS_CHOSEN.includes(input.tier_chosen)) {
        errors.push(`tier_chosen must be one of ${TIERS_CHOSEN.join(' | ')} (or omitted)`);
    }
    if (input.tier_source != null && !TIER_SOURCES.includes(input.tier_source)) {
        errors.push(`tier_source must be one of ${TIER_SOURCES.join(' | ')} (or omitted)`);
    }

    const band = input.confidence_band ?? 'medium';
    if (!BANDS.includes(band)) errors.push(`confidence_band must be one of ${BANDS.join(' | ')}`);
    const risk = input.risk_class ?? 'low';
    if (!BANDS.includes(risk)) errors.push(`risk_class must be one of ${BANDS.join(' | ')}`);
    const phase = input.phase ?? 'implement';
    if (!PHASES.includes(phase)) errors.push(`phase must be one of ${PHASES.join(' | ')}`);

    if (input.first_pass_success !== undefined && typeof input.first_pass_success !== 'boolean') {
        errors.push('first_pass_success must be a boolean (true = return adopted without parent rework) or omitted');
    }
    if (input.escalated !== undefined && typeof input.escalated !== 'boolean') {
        errors.push('escalated must be a boolean (true = retried on a higher tier after verification failure) or omitted');
    }

    if (!input.ts) errors.push('ts (ISO-8601 UTC) is required');
    if (!input.id) errors.push('id (ULID or content hash) is required');

    if (errors.length) return { line: null, errors };

    const orchestration: Record<string, unknown> = {
        task_size_estimate: input.task_size_estimate ?? 0,
        spawn_count: input.spawn_count,
        tiers: input.tiers ?? [],
        token_delta: input.token_delta,
        token_delta_provenance: prov,
        wall_clock_ms: input.wall_clock_ms ?? 0,
        outcome: dOutcome,
        verify_mode: vMode,
        task_class: input.task_class ?? null,
        tier_chosen: input.tier_chosen ?? null,
        tier_source: input.tier_source ?? null,
        dispatch_tokens: input.dispatch_tokens ?? null,
        session_tier: input.session_tier ?? null,
        first_pass_success: input.first_pass_success ?? null,
        escalated: input.escalated ?? null,
    };

    const line: Record<string, unknown> = {
        schema_version: 1,
        id: input.id,
        ts: input.ts,
        work_id: input.work_id ?? `orchestration-${input.ts}`,
        phase,
        outcome: input.outcome ?? envelopeOutcome(dOutcome),
        confidence_band: band,
        risk_class: risk,
        memory: { asks: 0, hits: 0 },
        verify: { claims: 0, first_try_passes: 0 },
        rules_applied: ['delegation-policy'],
        persona: input.persona ?? null,
        input_kind: 'orchestration',
        type: 'phase',
        orchestration,
    };

    return { line, errors: [] };
}

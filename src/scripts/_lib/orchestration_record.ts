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

import type { LookupClass } from './auto_dispatch.js';
import type { EvidenceBasis } from './evidence_basis.js';
import type { PhaseOutcome } from './outcome_vocabularies.js';

export type DispatchOutcome = 'DONE' | 'DONE_WITH_CONCERNS' | 'NEEDS_CONTEXT' | 'BLOCKED' | 'killed';
/** Which route the rung took: deterministic primitive (lean-init L0),
 *  single-completion ask (token-economy-dispatch rung 0.5), or a full
 *  subagent spawn. */
export type RouteTaken = 'primitive' | 'subagent' | 'ask';
export type VerifyMode = 'deterministic' | 'judge' | 'none';
/**
 * Migrated onto the shared evidence-basis vocabulary
 * (`road-to-delivered-cost-truth` 4.1). The two literals are unchanged on the
 * wire — `measured` and `estimated` mean here exactly what the contract says
 * they mean — but they are no longer declared privately, so this surface and
 * the census can no longer drift apart on what "measured" is.
 *
 * Narrowed to the two values this field can actually take: an orchestration
 * record's floor is either read from the transcript ledger or arithmetic over
 * it, and admitting `model-judged` here would be widening a type to match a
 * vocabulary rather than a fact.
 */
export type Provenance = Extract<EvidenceBasis, 'measured' | 'estimated'>;
export type TierChosen = 'lite' | 'medium' | 'high';
export type TierSource = 'static' | 'inferred' | 'inherit';
export type Band = 'low' | 'medium' | 'high';
export type LinePhase = 'refine' | 'memory' | 'analyze' | 'plan' | 'implement' | 'test' | 'verify' | 'report';
/**
 * Outcome of this audit-log line. Alias of the registry's `PhaseOutcome` —
 * the name `LineOutcome` is kept because two modules import it, and the
 * single definition now lives in `outcome_vocabularies.ts` so the contract
 * table can be checked against it (`road-to-experience-loop-broadening` 1.3).
 */
export type LineOutcome = PhaseOutcome;
/** Which capsule-emission trigger arm fired first (Phase 1 shadow comparison). */
export type TriggerArm = 'watermark' | 'saturation' | 'tie';
/** The orchestration form the form-gate selected (road-to-opt-subagent-harvest P2). */
export type DispatchModeId =
    | 'do-and-judge'
    | 'do-and-judge-two-stage'
    | 'do-in-steps'
    | 'do-in-parallel'
    | 'do-competitively'
    | 'judge-with-debate'
    | 'do-in-worktrees'
    | 'do-with-live-app-judge'
    | 'none';

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
    /** Form-gate outcome: which of the seven modes (or 'none') the gate selected. */
    dispatch_mode?: DispatchModeId | null | undefined;
    /**
     * Stable skill ids that were APPLIED during this phase — the skills
     * counterpart of `rules_applied`, which `audit-log-v1` has carried since v1
     * while carrying no skills field at all.
     *
     * ABSENT and EMPTY mean different things, and the distinction is
     * load-bearing rather than stylistic: the field OMITTED means *not
     * recorded* (the producer had no skill observation to offer), while `[]`
     * means *recorded, and none applied*. Folding the two together is what
     * makes a per-asset report unable to tell "no signal" from "a negative
     * signal", which is the failure `unknown != 0` exists to prevent
     * downstream.
     *
     * Ids only, never bodies — privacy by construction, same as
     * `rules_applied`. Bounded to <= 32; the remainder is dropped, mirroring
     * the rules bound in the contract.
     */
    skills_applied?: string[] | null | undefined;
    task_size_estimate?: number | undefined;
    wall_clock_ms?: number | undefined;
    /** Absolute measured tokens the dispatched slice consumed (feeds the modeled cost-%). */
    dispatch_tokens?: number | null | undefined;
    /** The orchestrator's own tier — the baseline the downshift cost-% measures against. */
    session_tier?: string | null | undefined;
    /**
     * The model id that was ASKED for. `tier_chosen`, `tier_source`,
     * `session_tier` and the downshift cost-percentage are all read off the
     * requested tier, so on an alias or a provider substitution every one of
     * them attributes the saving to a model that never ran. Recording the
     * requested id beside the served one is what makes that detectable.
     */
    model_requested?: string | null | undefined;
    /**
     * The model id the provider reported SERVING. `''` / null when the
     * transport reports none (every CLI client) — absent is honest, not a
     * defect, and is NOT a divergence.
     */
    model_served?: string | null | undefined;
    dispatch_outcome?: DispatchOutcome | undefined;
    verify_mode?: VerifyMode | undefined;
    /** QUALITY: subagent return adopted without parent rework. Optional boolean (null = not measured). */
    first_pass_success?: boolean | undefined;
    /** QUALITY: slice retried on a higher tier after a verification failure. Optional boolean (null = not measured). */
    escalated?: boolean | undefined;
    /** U5 (reliability-measurement): the subagent-type combination this dispatch
     *  ran (ordered agent-type ids, e.g. ['implementer','implementer','judge']) —
     *  with `outcome`, lets the orchestrator prefer combos that worked. Ids only. */
    agent_combo?: string[] | undefined;
    // ── lean-init additive fields (road-to-lean-agent-init Phase 3) —
    //    schema_version stays 1 per audit-log-v1 forward-compat rule.
    //    ALL remain counts / enums / hashes / ids — never free-form content. ──
    /** Spawn-payload tokens at worker init (the payload-truth measurement). */
    init_tokens?: number | null | undefined;
    /** Hash of the spawn payload (prefix-stability / cache measurement). Hex only, never content. */
    payload_hash?: string | null | undefined;
    /** Lookup class the L0 rung matched, or null for non-lookup dispatches. */
    lookup_class?: LookupClass | null | undefined;
    /** Route the lookup rung took: deterministic primitive vs subagent escalation. */
    route_taken?: RouteTaken | null | undefined;
    /** Worker hit its max_tokens_per_worker stop-loss (L0b). */
    budget_hit?: boolean | undefined;
    /** Golden/correctness comparison verdict for a primitive route (null = not compared). */
    correctness_match?: boolean | undefined;
    /** Provider-reported prompt-cache hit on the spawn payload (Phase 4 prefix stability). */
    cache_hit?: boolean | undefined;
    /** Sample-segregation tag (council Q5), e.g. 'lean-init-2026'. Id-shaped, never free-form. */
    origin?: string | null | undefined;
    /** Rules in the worker's scoped projection (the carried set). The L6 demand
     *  signal: `rules_used`/`rules_carried` is the per-worker usage quota the
     *  parked deferred-rule-retriever's resume condition asks for. Counts only. */
    rules_carried?: number | null | undefined;
    /** Rules the worker actually applied/cited (count of the envelope's
     *  `rules_applied`-equivalent on the worker side). Counts only. */
    rules_used?: number | null | undefined;
    // ── dispatch-economy additive fields (road-to-token-economy-dispatch
    //    Phase 1.1). `init_tokens` above (lean-init) is the spawn-payload
    //    half; `work_tokens` is the delta from first worker turn to envelope
    //    close. Both are counts; the pair's provenance rides
    //    `floor_provenance` exactly like `token_delta_provenance` tags
    //    `token_delta`. ──
    /** Tokens the worker consumed AFTER init (delta to envelope close). */
    work_tokens?: number | null | undefined;
    /** Chars the dispatch RETURNED into the orchestrator context (serialized
     *  tool-result length on sync completions) — the Phase 6.3 detector for
     *  "isolation win refunded through the return channel". A count, never
     *  content. */
    return_channel_chars?: number | null | undefined;
    /** Provenance of the init/work pair: 'measured' (transcript ledger via
     *  cc_transcript) or 'estimated'. Defaults to 'estimated' when either
     *  field is present without a tag. */
    floor_provenance?: Provenance | null | undefined;
    // ── capsule shadow-measurement fields (road-to-worker-generation-recycling
    //    Phase 1.2). SHADOW ONLY: the worker still runs to stop-loss, nothing
    //    reads a capsule. All counts / enums — a capsule's CONTENT never
    //    reaches telemetry, only its shape. ──
    /** A CHECKPOINT capsule was emitted at the watermark. */
    capsule_emitted?: boolean | undefined;
    /** Total entries across the capsule's arrays — a size proxy, never content. */
    capsule_entries?: number | null | undefined;
    /** 1-based step at which the token-watermark arm fired (null = never). */
    watermark_step?: number | null | undefined;
    /** 1-based step at which the novelty-saturation arm fired (null = never). */
    saturation_step?: number | null | undefined;
    /** Which arm fired first on this dispatch — the paired-comparison datum. */
    trigger_arm_earlier?: TriggerArm | null | undefined;
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
const LOOKUP_CLASSES: readonly LookupClass[] = ['definition', 'references', 'string-existence', 'report-run'];
const ROUTES_TAKEN: readonly RouteTaken[] = ['primitive', 'subagent', 'ask'];
const TRIGGER_ARMS: readonly TriggerArm[] = ['watermark', 'saturation', 'tie'];
/** Hex-only payload hash — a hash can never smuggle content (privacy by construction). */
const PAYLOAD_HASH_RE = /^[a-f0-9]{8,64}$/i;
/** Id-shaped origin tag — enum-ish, never free-form prose. */
const ORIGIN_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * Upper bound on an applied-id array, mirroring the `rules_applied` bound the
 * contract has carried since v1 ("Bounded to <= 32; remainder dropped
 * silently"). Stated as a named constant so the contract row and the code can
 * be checked against one another instead of against a literal.
 */
const MAX_APPLIED_IDS = 32;

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
 * Did the provider answer with a different model than the one requested?
 *
 * `null` — not decidable — whenever either id is missing or empty. That is the
 * common case (every CLI transport reports no served id) and it is not the
 * same as "no divergence": a `false` here would claim a comparison that never
 * happened, which is the exact mis-attribution this field exists to expose.
 */
function modelDivergent(
    requested: string | null | undefined,
    served: string | null | undefined,
): boolean | null {
    if (typeof requested !== 'string' || typeof served !== 'string') return null;
    if (!requested || !served) return null;
    return requested !== served;
}

/**
 * Build + validate the audit-log-v1 line. Returns `{line, errors}`; when
 * `errors` is non-empty, `line` is null and the caller must NOT write.
 */
export function buildOrchestrationLine(input: RecordInput): BuiltLine {
    const errors: string[] = [];

    // A lookup-class primitive route (lean-init L0) and a rung-0.5 ask route
    // (token-economy-dispatch Phase 4) are the TWO recordable zero-spawn
    // events: the routing decision itself is the datum the cost-reduction
    // claim reads. Everything else with spawn_count 0 stays unrecordable
    // in-session work.
    const zeroSpawnRoute =
        (input.route_taken === 'primitive' || input.route_taken === 'ask') && input.spawn_count === 0;
    if (!zeroSpawnRoute && (!isInt(input.spawn_count) || input.spawn_count < 1)) {
        errors.push('spawn_count must be an integer ≥ 1 (0 = handled in-session, not a dispatch — do not record; exception: route_taken=primitive|ask routes record with spawn_count 0)');
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

    // ── lean-init additive fields ──
    if (input.init_tokens != null && (!isInt(input.init_tokens) || input.init_tokens < 0)) {
        errors.push('init_tokens must be a non-negative integer (spawn-payload tokens at worker init)');
    }
    if (input.payload_hash != null && !PAYLOAD_HASH_RE.test(input.payload_hash)) {
        errors.push('payload_hash must be an 8–64 char hex digest (never content)');
    }
    if (input.lookup_class != null && !LOOKUP_CLASSES.includes(input.lookup_class)) {
        errors.push(`lookup_class must be one of ${LOOKUP_CLASSES.join(' | ')} (or omitted)`);
    }
    if (input.route_taken != null && !ROUTES_TAKEN.includes(input.route_taken)) {
        errors.push(`route_taken must be one of ${ROUTES_TAKEN.join(' | ')} (or omitted)`);
    }
    for (const [key, v] of [
        ['budget_hit', input.budget_hit],
        ['correctness_match', input.correctness_match],
        ['cache_hit', input.cache_hit],
    ] as const) {
        if (v !== undefined && typeof v !== 'boolean') errors.push(`${key} must be a boolean or omitted`);
    }
    if (input.origin != null && !ORIGIN_RE.test(input.origin)) {
        errors.push("origin must be an id-shaped tag like 'lean-init-2026' (lowercase alnum + hyphens)");
    }
    if (input.skills_applied != null) {
        if (!Array.isArray(input.skills_applied)) {
            errors.push('skills_applied must be an array of skill ids, [] , or omitted');
        } else if (!input.skills_applied.every((v) => typeof v === 'string' && ORIGIN_RE.test(v))) {
            errors.push(
                "skills_applied entries must be id-shaped skill names like 'code-review' (lowercase alnum + hyphens) — ids only, never bodies",
            );
        }
    }
    for (const [key, v] of [
        ['rules_carried', input.rules_carried],
        ['rules_used', input.rules_used],
        ['work_tokens', input.work_tokens],
        ['return_channel_chars', input.return_channel_chars],
    ] as const) {
        if (v != null && (!isInt(v) || v < 0)) errors.push(`${key} must be a non-negative integer count`);
    }
    if (input.floor_provenance != null && !PROVENANCES.includes(input.floor_provenance)) {
        errors.push(`floor_provenance must be one of ${PROVENANCES.join(' | ')} (or omitted)`);
    }
    if (
        input.rules_carried != null &&
        input.rules_used != null &&
        input.rules_used > input.rules_carried
    ) {
        errors.push('rules_used cannot exceed rules_carried (a worker cannot apply a rule it was not given)');
    }

    if (input.capsule_emitted !== undefined && typeof input.capsule_emitted !== 'boolean') {
        errors.push('capsule_emitted must be a boolean or omitted');
    }
    for (const [key, v] of [
        ['capsule_entries', input.capsule_entries],
        ['watermark_step', input.watermark_step],
        ['saturation_step', input.saturation_step],
    ] as const) {
        if (v != null && (!isInt(v) || v < 0)) errors.push(`${key} must be a non-negative integer count`);
    }
    if (input.trigger_arm_earlier != null && !TRIGGER_ARMS.includes(input.trigger_arm_earlier)) {
        errors.push(`trigger_arm_earlier must be one of ${TRIGGER_ARMS.join(' | ')} (or omitted / null when neither arm fired)`);
    }

    for (const [key, v] of [
        ['model_requested', input.model_requested],
        ['model_served', input.model_served],
    ] as const) {
        if (v != null && typeof v !== 'string') errors.push(`${key} must be a string or omitted`);
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
        dispatch_mode: input.dispatch_mode ?? null,
        tier_chosen: input.tier_chosen ?? null,
        tier_source: input.tier_source ?? null,
        dispatch_tokens: input.dispatch_tokens ?? null,
        session_tier: input.session_tier ?? null,
        // Served-model attribution. `model_divergent` is DERIVED, never
        // supplied: `null` when either id is absent — a transport that reports
        // no served id cannot disagree with anything, and calling that `false`
        // would read as "checked, and they matched".
        model_requested: input.model_requested ?? null,
        model_served: input.model_served ?? null,
        model_divergent: modelDivergent(input.model_requested, input.model_served),
        first_pass_success: input.first_pass_success ?? null,
        escalated: input.escalated ?? null,
        agent_combo: input.agent_combo ?? [],
        // lean-init additive fields — readers ignore unknowns per audit-log-v1
        init_tokens: input.init_tokens ?? null,
        payload_hash: input.payload_hash ?? null,
        lookup_class: input.lookup_class ?? null,
        route_taken: input.route_taken ?? null,
        budget_hit: input.budget_hit ?? null,
        correctness_match: input.correctness_match ?? null,
        cache_hit: input.cache_hit ?? null,
        origin: input.origin ?? null,
        rules_carried: input.rules_carried ?? null,
        rules_used: input.rules_used ?? null,
        // dispatch-economy additive fields — readers ignore unknowns per audit-log-v1
        work_tokens: input.work_tokens ?? null,
        return_channel_chars: input.return_channel_chars ?? null,
        floor_provenance:
            input.floor_provenance ?? (input.init_tokens != null || input.work_tokens != null ? 'estimated' : null),
        // capsule shadow-measurement — readers ignore unknowns per audit-log-v1
        capsule_emitted: input.capsule_emitted ?? null,
        capsule_entries: input.capsule_entries ?? null,
        watermark_step: input.watermark_step ?? null,
        saturation_step: input.saturation_step ?? null,
        trigger_arm_earlier: input.trigger_arm_earlier ?? null,
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
        // Emitted ONLY when the producer offered one. An omitted key means "not
        // recorded"; `[]` means "recorded, none applied". Writing `null` or `[]`
        // unconditionally would erase that distinction for every existing
        // producer that has no skill observation to give, which is the whole
        // reason the field is optional rather than defaulted.
        ...(input.skills_applied != null
            ? { skills_applied: input.skills_applied.slice(0, MAX_APPLIED_IDS) }
            : {}),
        persona: input.persona ?? null,
        input_kind: 'orchestration',
        type: 'phase',
        orchestration,
    };

    return { line, errors: [] };
}

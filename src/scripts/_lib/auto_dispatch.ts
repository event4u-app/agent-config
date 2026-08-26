/**
 * Auto-dispatch classification (v1 — deterministic).
 *
 * Pure, no-I/O encoding of the rule-based classifier described in
 * `src/agent-src/contexts/execution/auto-dispatch-classification.md`.
 *
 * Decides whether a task is delegable to subagents and which
 * `subagent-orchestration` mode fits — with NO per-turn LLM meta-call.
 *
 * Always-on orchestration (road-to-always-on-orchestration Phase 1): there is
 * no more `subagents.enabled` / `subagents.auto` setting gating this. The
 * layer activates on any host reporting a subagent primitive, unless the one
 * audited incident switch (`emergency.orchestration_halt`) is set.
 *
 * Contract highlights:
 * - A task is delegable only on an enumerated structural signal.
 * - Trivial tasks below the size floor never delegate.
 * - A matched signal always DISPATCHES (there is no more ask-before-dispatch
 *   mode); an AMBIGUOUS verdict (no enumerated signal matched) is always an
 *   `ask` VERDICT to the user, never a speculative spawn.
 * - The activation gate (`halted`, `subagent_spawn`) runs first; any failure
 *   short-circuits to in-session.
 */

/** Minimum task-size estimate (exclusive) below which a task never delegates. */
export const SIZE_FLOOR = 1;

export type DispatchMode = 'do-in-steps' | 'do-in-parallel';
export type DispatchAction = 'dispatch' | 'ask' | 'in-session';

/** Task descriptor — structural signals only, no task body. */
export interface TaskSignals {
    /** Frontmatter `parallelizable:` value of the skill/command in play, if any. */
    parallelizable?: 'steps' | 'files' | 'independent' | null;
    /** Task is an explicit ordered plan (numbered steps / phase / checklist). */
    ordered_plan?: boolean;
    /** Count of independent same-shape targets (e.g. 5 files to review). */
    independent_slices?: number;
    /** Orchestrator's pre-dispatch size estimate (abstract units). */
    size_estimate: number;
}

/**
 * Activation inputs resolved from the emergency incident switch + the
 * host-capability manifest. No `enabled`/`auto` fields — always-on
 * orchestration carries no per-layer setting to resolve them from.
 */
export interface ActivationInputs {
    /** `emergency.orchestration_halt` — the one audited incident switch. */
    halted: boolean;
    subagent_spawn: boolean;
}

export interface Classification {
    delegable: boolean;
    action: DispatchAction;
    mode: DispatchMode | null;
    reason: string;
}

function inSession(reason: string): Classification {
    return { delegable: false, action: 'in-session', mode: null, reason };
}

/**
 * Classify a task for auto-dispatch. Activation gate first, then the
 * deterministic delegable-signal rules.
 */
export function classifyTask(signals: TaskSignals, activation: ActivationInputs): Classification {
    // ── Activation gate — any failure short-circuits to in-session ──
    if (activation.halted) return inSession('emergency.orchestration_halt is set');
    if (!activation.subagent_spawn) return inSession('host has no subagent_spawn primitive');

    // ── Size floor — trivial tasks never delegate ──
    if (!(signals.size_estimate > SIZE_FLOOR)) {
        return inSession(`task below size floor (${signals.size_estimate} <= ${SIZE_FLOOR})`);
    }

    // ── Delegable-signal rules (enumerated; ambiguity never spawns) ──
    const slices = signals.independent_slices ?? 0;
    let mode: DispatchMode | null = null;
    let reason = '';

    if (signals.parallelizable === 'steps' || signals.ordered_plan === true) {
        mode = 'do-in-steps';
        reason = signals.parallelizable === 'steps' ? 'declared parallelizable: steps' : 'ordered-plan structure';
    } else if (signals.parallelizable === 'files' || signals.parallelizable === 'independent' || slices >= 2) {
        mode = 'do-in-parallel';
        reason = signals.parallelizable ? `declared parallelizable: ${signals.parallelizable}` : `independent slices (${slices})`;
    }

    if (mode === null) {
        // No enumerated signal matched → ambiguous. Always an `ask` VERDICT —
        // there is no more setting under which this silently stays in-session.
        return { delegable: false, action: 'ask', mode: null, reason: 'no delegable signal — borderline, ask' };
    }

    // Matched a signal → always dispatch (always-on: no ask-before-dispatch mode).
    return { delegable: true, action: 'dispatch', mode, reason };
}

// ── Lookup-class routing (L0 — road-to-lean-agent-init) ──

/**
 * Lookup-class task shapes that route to a deterministic primitive INSTEAD of
 * a subagent spawn. Contract:
 * `auto-dispatch-classification.md § Lookup-class rung`.
 *
 * Live evidence (2026-07-28): four `general-purpose` subagents burned ~1.21M
 * tokens on tasks of exactly these shapes; the primitives answer each for <1k.
 */
export type LookupClass =
    | 'definition' // "where is X defined" → code_graph query
    | 'references' // "who calls / imports X" → code_graph query
    | 'string-existence' // "does string Y exist" → FTS one-shot / capped grep
    | 'report-run'; // "run report Z" → script-run with rtk wrap

export type LookupPrimitive = 'code-graph-query' | 'fts-or-capped-grep' | 'script-run-rtk';

export interface LookupRoute {
    /** Matched lookup class, or null when the task is not lookup-shaped. */
    lookup_class: LookupClass | null;
    /** `primitive` = skip the spawn; `escalate` = normal classification path. */
    route: 'primitive' | 'escalate';
    primitive: LookupPrimitive | null;
    reason: string;
}

const LOOKUP_PATTERNS: Array<{ cls: LookupClass; primitive: LookupPrimitive; re: RegExp }> = [
    {
        cls: 'definition',
        primitive: 'code-graph-query',
        re: /\b(where\s+is\s+\S+\s+defined|definition\s+(location|of|site)|find\s+the\s+definition|locate\s+the\s+(class|enum|function|type|interface|symbol)|confirm\w*\s+\S+\s+definition)\b/i,
    },
    {
        cls: 'references',
        primitive: 'code-graph-query',
        re: /\b(who\s+(calls|imports|uses|references)|call\s*sites?|import\s+(call\s*)?sites?|reverse\s+references|where\s+is\s+\S+\s+(used|imported|referenced|called)|all\s+(callers|usages|references)\s+of)\b/i,
    },
    {
        cls: 'string-existence',
        primitive: 'fts-or-capped-grep',
        re: /\b(does\s+(the\s+)?string\s+.*\bexist|is\s+(the\s+)?string\s+.*\b(present|used)\b|prob\w+\s+(candidate\s+)?strings?|search\s+for\s+the\s+(exact\s+)?string|(grep|check)\s+(for\s+)?(the\s+)?(literal|string)\b|does\s+\S+\s+appear\s+anywhere)/i,
    },
    {
        cls: 'report-run',
        primitive: 'script-run-rtk',
        re: /\b(run(ning)?\s+(the\s+)?\S*(report|check|lint\w*|coverage)\b|run(ning)?\s+(check|lint|report)_\w+|regenerate\s+the\s+\S+\s+report)/i,
    },
];

/**
 * Route a task description to a lookup-class primitive or the regular
 * escalation path. Deterministic regex layer, no LLM call (design lock:
 * no LLM classifier fallback — cut C3). Non-matches escalate — never a
 * silently degraded answer; an index-miss at execution time escalates the
 * same way (runtime concern, documented in the classification context).
 */
export function classifyLookup(
    taskText: string,
    opts: { codeGraphEnabled?: boolean | undefined } = {},
): LookupRoute {
    // The graph is an OPPORTUNISTIC ACCELERANT, gated on the setting — which is
    // what `auto-dispatch-classification.md` § Task pattern has always said and
    // what this function did not do.
    //
    // road-to-inbox-harvest-2026-08-f-code-graph-evidence-refresh 2.1 required
    // deciding which of the two was right and changing the other, not splitting
    // the difference. The CONTRACT is right, on the only evidence that exists:
    // the pre-registered benchmark behind `claim:code-graph-retrieval-null`
    // measured native-graph recall 0.365 against grep's 0.797 on exactly these
    // graph-shaped questions. Routing to the graph unconditionally routed to the
    // arm that lost, and no re-measurement has replaced that figure — Phase 3.1
    // is blocked on inputs this repository does not hold.
    //
    // Default FALSE, deliberately, and not because the setting's default is
    // false: an absent flag means nobody said the index is present and fresh,
    // and an accelerant taken on an absent index is a miss that escalates —
    // slower than the grep it replaced. When the flag is on, the class still
    // routes to `code-graph-query`, so turning it on is the whole change needed
    // to use the graph.
    const graphOk = opts.codeGraphEnabled === true;
    for (const p of LOOKUP_PATTERNS) {
        if (p.re.test(taskText)) {
            const primitive: LookupPrimitive =
                p.primitive === 'code-graph-query' && !graphOk ? 'fts-or-capped-grep' : p.primitive;
            return {
                lookup_class: p.cls,
                route: 'primitive',
                primitive,
                reason:
                    primitive === p.primitive
                        ? `lookup-class ${p.cls} — deterministic primitive, no spawn`
                        : `lookup-class ${p.cls} — capped grep; the code-graph accelerant is ` +
                          'gated on hooks.code_graph.enabled and it is not on',
            };
        }
    }
    return {
        lookup_class: null,
        route: 'escalate',
        primitive: null,
        reason: 'not lookup-shaped — regular classification path (never down-guessed)',
    };
}

// ── Per-slice tier inference (v1.5 — road-to-cost-aware-model-routing) ──

/**
 * Task-TYPE outputs the tier inference keys on. NEVER raw size metrics —
 * size enters only as the negative guard below. Contract:
 * `auto-dispatch-classification.md § Per-slice tier inference`.
 */
export type SliceType =
    | 'read-only-fanout' // grep / inventory / discovery targets
    | 'mechanical-covered' // template-driven transform WITH test coverage
    | 'mutating-uncovered' // mutation without test coverage
    | 'synthesis' // review / analysis / judgment slice
    | 'unknown';

export interface SliceTierSignals {
    slice_type: SliceType;
    /**
     * Negative size guard: slice scope exceeds the mechanical envelope
     * (multi-file mutation / beyond single responsibility). Revokes a `lite`
     * candidacy — never creates one.
     */
    exceeds_mechanical_envelope?: boolean;
}

export type InferredTier = 'lite' | 'medium' | 'inherit';

export interface TierInference {
    tier: InferredTier;
    /** 'inferred' for a real downshift decision; 'inherit' when no inference fired. */
    tier_source: 'inferred' | 'inherit';
    reason: string;
}

/**
 * Infer a delegable slice's model tier from its task TYPE. Deterministic,
 * no LLM meta-call. Unknown/ambiguous → inherit (session tier) — never
 * guess down.
 */
export function inferSliceTier(signals: SliceTierSignals): TierInference {
    const guard = signals.exceeds_mechanical_envelope === true;

    switch (signals.slice_type) {
        case 'read-only-fanout':
        case 'mechanical-covered': {
            if (guard) {
                return {
                    tier: 'medium',
                    tier_source: 'inferred',
                    reason: `${signals.slice_type} slice, but scope exceeds the mechanical envelope — lite candidacy revoked`,
                };
            }
            const cascade = signals.slice_type === 'mechanical-covered' ? ' (verify-fail escalates to medium)' : '';
            return { tier: 'lite', tier_source: 'inferred', reason: `${signals.slice_type} slice${cascade}` };
        }
        case 'mutating-uncovered':
            return { tier: 'medium', tier_source: 'inferred', reason: 'mutating slice without test coverage' };
        case 'synthesis':
            return { tier: 'medium', tier_source: 'inferred', reason: 'synthesis/judgment slice — judge one tier up' };
        default:
            return { tier: 'inherit', tier_source: 'inherit', reason: 'unknown/ambiguous slice type — session tier, never guess down' };
    }
}

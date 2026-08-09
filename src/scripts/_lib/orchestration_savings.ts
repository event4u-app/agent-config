/**
 * Orchestration savings aggregator (pure, no-I/O).
 *
 * Aggregates realized orchestration telemetry into a token-savings report.
 * Consumes the `orchestration` sub-object of audit-log-v1 JSONL lines
 * (contract: `src/agent-src/contexts/execution/orchestration-telemetry.md`).
 *
 * TWO metrics, kept distinct on purpose:
 * 1. MEASURED token counts — `token_delta` (net token-COUNT delta vs the
 *    in-session baseline; negative = fewer tokens). Real, but blind to the
 *    downshift RATE win: the same work on a cheaper tier uses ~the same token
 *    COUNT, so token_delta ≈ 0 for a pure downshift even though cost dropped.
 * 2. MODELED cost-% (`modeled_cost`) — captures exactly that downshift win via
 *    provider-neutral tier weights + absolute `dispatch_tokens`. It is a MODEL
 *    (weights + a same-token-count assumption), NOT a measured $ figure, and is
 *    clearly labelled as such in the report notes.
 */

export type TokenDeltaProvenance = 'measured' | 'estimated';

/**
 * Relative, provider-NEUTRAL cost weights per model tier — a tunable ratio, not
 * $ prices. Default reflects the ~5×/~15× cheap-vs-frontier ratios from the
 * cost-downshift council; override per project via the report's `--weights`.
 * Used ONLY for the modeled cost-%, never for the measured token counts.
 */
export type TierWeights = Record<string, number>;
export const DEFAULT_TIER_WEIGHTS: TierWeights = { lite: 1, medium: 5, high: 15 };

/** The `orchestration` sub-object shape we read (subset — additive fields only). */
export interface OrchestrationRecord {
    spawn_count?: number;
    token_delta?: number;
    token_delta_provenance?: TokenDeltaProvenance;
    tier_chosen?: string | null;
    task_class?: string | null;
    outcome?: string;
    /** Absolute measured tokens the dispatched slice consumed (for the modeled cost-%). */
    dispatch_tokens?: number | null;
    /** The orchestrator's own tier — the baseline the downshift is measured against. */
    session_tier?: string | null;
    /** QUALITY: subagent return adopted without parent rework. null/absent = pre-extension line / not measured. */
    first_pass_success?: boolean | null;
    /** QUALITY: slice retried on a higher tier after a verification failure. null/absent = pre-extension line / not measured. */
    escalated?: boolean | null;
}

/** A parsed audit-log-v1 line (only the fields this aggregator touches). */
export interface AuditLine {
    input_kind?: string;
    orchestration?: OrchestrationRecord;
}

export interface ProvenanceStat {
    dispatches: number;
    /** Σ token_delta for this provenance (negative = net saved). */
    net_token_delta: number;
}

export interface ModeledCost {
    /** Dispatches with dispatch_tokens + session_tier + tier_chosen all weight-resolvable. */
    covered_dispatches: number;
    /** Σ dispatch_tokens × weight(session_tier) — same tokens costed on the baseline tier. */
    baseline_cost_units: number;
    /** Σ dispatch_tokens × weight(tier_chosen) — modeled cost of the downshifted run. */
    delegated_cost_units: number;
    /** (baseline − delegated) / baseline, 0..1; null when no covered dispatches. MODELED, not measured $. */
    cost_reduction_pct: number | null;
    weights: TierWeights;
}

export interface QualityStats {
    /** Dispatches carrying at least one of the two quality booleans (the n behind the ≥20 pairing gate). */
    quality_lines: number;
    /** Dispatches carrying a boolean first_pass_success. */
    first_pass_lines: number;
    first_pass_success_count: number;
    /** first_pass_success_count / first_pass_lines, 0..1; null when no line carries the field. */
    first_pass_success_rate: number | null;
    /** Dispatches carrying a boolean escalated. */
    escalated_lines: number;
    escalated_count: number;
    /** escalated_count / escalated_lines, 0..1; null when no line carries the field. */
    escalation_rate: number | null;
}

export interface SavingsReport {
    /** Lines carrying an orchestration object with spawn_count > 0. */
    dispatches: number;
    total_spawns: number;
    /** Σ token_delta across all dispatches (negative = net saved). */
    net_token_delta: number;
    /** Magnitude of tokens saved (sum of negative deltas, as a positive number). */
    tokens_saved: number;
    /** Sum of positive deltas (orchestration that cost MORE than baseline). */
    tokens_added: number;
    by_provenance: { measured: ProvenanceStat; estimated: ProvenanceStat };
    /** tier_chosen → Σ token_delta (negative = net saved on that tier). */
    by_tier: Record<string, number>;
    /** task_class → Σ token_delta. */
    by_task_class: Record<string, number>;
    /** measured dispatches / dispatches, 0..1 (0 when no dispatches). */
    measured_share: number;
    /** Modeled downshift cost-% (tier-weight based). Distinct from the measured token counts. */
    modeled_cost: ModeledCost;
    /** QUALITY dimension — paired with cost per council verdict; never report savings alone. */
    quality: QualityStats;
    /** Honest caveats about what the number does and does not mean. */
    notes: string[];
}

function emptyProvenance(): ProvenanceStat {
    return { dispatches: 0, net_token_delta: 0 };
}

/**
 * Aggregate orchestration telemetry lines into a savings report.
 *
 * A line counts as a dispatch only when it carries an `orchestration` object
 * with `spawn_count > 0` (spawn_count 0 / absent = handled in-session, not a
 * dispatch). Unknown/absent fields default safely (token_delta → 0, provenance
 * → estimated) so a pre-extension line never throws.
 */
export function aggregateOrchestrationSavings(
    lines: AuditLine[],
    weights: TierWeights = DEFAULT_TIER_WEIGHTS,
): SavingsReport {
    const report: SavingsReport = {
        dispatches: 0,
        total_spawns: 0,
        net_token_delta: 0,
        tokens_saved: 0,
        tokens_added: 0,
        by_provenance: { measured: emptyProvenance(), estimated: emptyProvenance() },
        by_tier: {},
        by_task_class: {},
        measured_share: 0,
        modeled_cost: { covered_dispatches: 0, baseline_cost_units: 0, delegated_cost_units: 0, cost_reduction_pct: null, weights },
        quality: {
            quality_lines: 0,
            first_pass_lines: 0,
            first_pass_success_count: 0,
            first_pass_success_rate: null,
            escalated_lines: 0,
            escalated_count: 0,
            escalation_rate: null,
        },
        notes: [],
    };

    for (const line of lines) {
        const o = line.orchestration;
        if (!o) continue;
        const spawns = o.spawn_count ?? 0;
        if (!(spawns > 0)) continue; // in-session, not a dispatch

        report.dispatches += 1;
        report.total_spawns += spawns;

        const delta = o.token_delta ?? 0;
        report.net_token_delta += delta;
        if (delta < 0) report.tokens_saved += -delta;
        else report.tokens_added += delta;

        // Provenance defaults to `estimated` when unstated (matches the
        // telemetry contract: estimated is the lossy fallback).
        const prov: TokenDeltaProvenance = o.token_delta_provenance === 'measured' ? 'measured' : 'estimated';
        report.by_provenance[prov].dispatches += 1;
        report.by_provenance[prov].net_token_delta += delta;

        const tier = o.tier_chosen ?? 'unknown';
        report.by_tier[tier] = (report.by_tier[tier] ?? 0) + delta;

        const cls = o.task_class ?? 'unclassified';
        report.by_task_class[cls] = (report.by_task_class[cls] ?? 0) + delta;

        // Modeled cost — the downshift RATE win token_delta (counts) cannot see:
        // the same dispatch_tokens on a cheaper tier cost less by the weight ratio.
        const dt = o.dispatch_tokens ?? 0;
        const wChosen = o.tier_chosen != null ? weights[o.tier_chosen] : undefined;
        const wSession = o.session_tier != null ? weights[o.session_tier] : undefined;
        if (dt > 0 && wChosen !== undefined && wSession !== undefined) {
            report.modeled_cost.covered_dispatches += 1;
            report.modeled_cost.baseline_cost_units += dt * wSession;
            report.modeled_cost.delegated_cost_units += dt * wChosen;
        }

        // Quality dimension — only booleans count; null/absent = pre-extension
        // line / not measured (never a silent false).
        const q = report.quality;
        const fps = typeof o.first_pass_success === 'boolean';
        const esc = typeof o.escalated === 'boolean';
        if (fps || esc) q.quality_lines += 1;
        if (fps) {
            q.first_pass_lines += 1;
            if (o.first_pass_success === true) q.first_pass_success_count += 1;
        }
        if (esc) {
            q.escalated_lines += 1;
            if (o.escalated === true) q.escalated_count += 1;
        }
    }

    report.measured_share = report.dispatches === 0 ? 0 : report.by_provenance.measured.dispatches / report.dispatches;

    const mc = report.modeled_cost;
    mc.cost_reduction_pct = mc.baseline_cost_units > 0 ? (mc.baseline_cost_units - mc.delegated_cost_units) / mc.baseline_cost_units : null;

    const q = report.quality;
    q.first_pass_success_rate = q.first_pass_lines > 0 ? q.first_pass_success_count / q.first_pass_lines : null;
    q.escalation_rate = q.escalated_lines > 0 ? q.escalated_count / q.escalated_lines : null;

    // Honest caveats — always attached so a consumer never over-reads the number.
    if (report.dispatches === 0) {
        report.notes.push('No orchestration telemetry yet (0 dispatches). Data accrues as delegable slices dispatch (always-on orchestration; recorded via orchestration_record).');
    } else {
        report.notes.push('Token counts are MEASURED but blind to the downshift rate win (same tokens on a cheaper tier ≈ same count). The MODELED cost-% below captures that axis.');
        if (report.by_provenance.estimated.dispatches > 0) {
            report.notes.push(`${report.by_provenance.estimated.dispatches}/${report.dispatches} dispatch(es) use ESTIMATED token_delta (chars/4, lossy). Prefer measured (host usage metadata).`);
        }
        if (mc.covered_dispatches > 0 && mc.cost_reduction_pct !== null) {
            report.notes.push(`MODELED cost reduction ${(mc.cost_reduction_pct * 100).toFixed(0)}% over ${mc.covered_dispatches}/${report.dispatches} dispatch(es) that carry tier data — from provider-neutral tier weights ${JSON.stringify(mc.weights)} + a same-token-count assumption. A MODEL, NOT a measured $ figure; tune with --weights.`);
        } else {
            report.notes.push('MODELED cost-% unavailable: no dispatch yet carries dispatch_tokens + session_tier + tier_chosen. Record those (orchestration_record --dispatch-tokens/--session-tier/--tier-chosen) to populate it.');
        }
        if (q.quality_lines === 0) {
            report.notes.push('QUALITY columns empty: no dispatch yet carries first_pass_success / escalated. Record them (orchestration_record --first-pass-success/--escalated) — cost and quality are reported as a PAIR, never savings alone.');
        }
    }

    return report;
}

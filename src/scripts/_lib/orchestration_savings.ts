/**
 * Orchestration savings aggregator (pure, no-I/O).
 *
 * Aggregates realized orchestration telemetry into a token-savings report.
 * Consumes the `orchestration` sub-object of audit-log-v1 JSONL lines
 * (contract: `src/agent-src/contexts/execution/orchestration-telemetry.md`).
 *
 * HONEST LIMIT — the telemetry records `token_delta` (net dispatch cost vs the
 * in-session baseline; negative = saved) but NOT the absolute baseline. A clean
 * "% of session saved" is therefore NOT derivable from this data alone — only
 * ABSOLUTE net tokens saved, plus the measured-vs-estimated provenance split.
 * A percentage would need an absolute-baseline field on the telemetry (see the
 * report `notes` and the PR's follow-up section).
 */

export type TokenDeltaProvenance = 'measured' | 'estimated';

/** The `orchestration` sub-object shape we read (subset — additive fields only). */
export interface OrchestrationRecord {
    spawn_count?: number;
    token_delta?: number;
    token_delta_provenance?: TokenDeltaProvenance;
    tier_chosen?: string | null;
    task_class?: string | null;
    outcome?: string;
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
export function aggregateOrchestrationSavings(lines: AuditLine[]): SavingsReport {
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
    }

    report.measured_share = report.dispatches === 0 ? 0 : report.by_provenance.measured.dispatches / report.dispatches;

    // Honest caveats — always attached so a consumer never over-reads the number.
    if (report.dispatches === 0) {
        report.notes.push('No orchestration telemetry yet (0 dispatches). The number accrues as `subagents.auto: on` runs delegate real slices.');
    } else {
        report.notes.push('Reports ABSOLUTE net token_delta (negative = saved). A "% of session saved" is NOT derivable — the telemetry records net delta, not the absolute baseline. A percentage needs an absolute-baseline field on the telemetry.');
        if (report.by_provenance.estimated.dispatches > 0) {
            report.notes.push(`${report.by_provenance.estimated.dispatches}/${report.dispatches} dispatch(es) use ESTIMATED token_delta (chars/4, lossy). Prefer measured (host usage metadata).`);
        }
    }

    return report;
}

#!/usr/bin/env node
/**
 * Dispatch-economy report — computes the two registered metrics from
 * `src/config/dispatch-economy-metrics.json` (road-to-token-economy-dispatch
 * Phase 1):
 *
 *   dispatch_floor    median init_tokens per role + init/work ratio per leg
 *   rules_efficiency  median rules_used / rules_carried per worker envelope
 *
 * Metric semantics (restated from the registration file, load-bearing):
 *
 *     init_tokens = billable_input of the leg's FIRST assistant record
 *     work_tokens = leg total billable_input − init_tokens
 *     billable_input = input_tokens + cache_read_input_tokens
 *                       + cache_creation_input_tokens
 *
 * Sources, in the registration file's priority order:
 *   1. Transcript ledger via `_lib/cc_transcript.ts` (per-agentId legs,
 *      message.id+requestId dedupe) — provenance `measured`.
 *   2. Audit-log orchestration lines carrying `init_tokens`/`work_tokens`
 *      with `floor_provenance: "measured"`, and the `rules_carried`/
 *      `rules_used` pairs for rules_efficiency.
 *
 * ROLE ATTRIBUTION — honest limitation until the Phase 2 role axis ships:
 * transcripts carry no session role, so every transcript leg reports as
 * role `worker`; reviewer legs are attributed ONLY from audit-line
 * `agent_combo` entries matching /review|judge|validator/i. The output
 * names the attribution source per number.
 *
 * Class A (ADR-124 no-runtime-boundary): in-process, per-invocation, no
 * socket, no daemon, no network, no writes — stdout report only. This is a
 * REPORT, not a gate: exit code is 0 on every computed path (2 only on
 * unusable invocation, e.g. unreadable registration file).
 *
 * Usage:
 *   ./scripts-run src/scripts/dispatch_economy_report \
 *     [--format text|json] [--root <transcripts-root>] [--audit-dir <dir>]
 *     [--max-age-days 14]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    billableInputTokens,
    DEFAULT_PROJECTS_ROOT,
    scanTranscripts,
    weightedInputUnits,
    type TranscriptRecord,
} from './_lib/cc_transcript.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/dispatch_economy_report.ts → parents[1] is the repo root (same
// 2-up resolution cache_realization_report.ts uses at the same depth).
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const REGISTRATION_FILE = path.join(REPO_ROOT, 'src', 'config', 'dispatch-economy-metrics.json');
const DEFAULT_AUDIT_DIR = path.join('agents', 'runtime', 'state', 'audit');

/** Reviewer attribution off audit-line agent_combo — id-shaped types only. */
const REVIEWER_TYPE_RE = /review|judge|validator/i;

export interface LegStat {
    agentId: string;
    calls: number;
    /** Raw billable_input of the first record — comparable to the cache-economy 235.5k baseline. */
    init_tokens: number;
    /** Raw billable_input of the rest of the leg. */
    work_tokens: number;
    /** COST-shaped ratio: weightedInputUnits(init) / weightedInputUnits(rest)
     *  (read 0.1× · 5m write 1.25× · 1h write 2×). Raw billable_input would
     *  count every turn's cache-READ re-transmission at full weight and make
     *  the "more spent loading context than working" threshold unmeetable by
     *  construction — measured live 2026-08-10: raw ratio 0.02 on legs whose
     *  weighted ratio is the number the threshold means. null when the leg
     *  has a single call (floor-only, no work to ratio against). */
    ratio: number | null;
}

export interface RoleFloor {
    role: 'worker' | 'reviewer';
    attribution: 'transcript-leg (role axis not shipped — all legs report as worker)' | 'audit-line agent_combo';
    legs: number;
    single_call_legs: number;
    median_init_tokens: number | null;
    median_ratio_finite: number | null;
}

export interface RulesEfficiency {
    envelopes_with_pair: number;
    median_quota: number | null;
}

export interface Report {
    schema: 'dispatch-economy-report/v1';
    registration: { registered_at: string; review_by: string };
    window: { max_age_days: number; transcript_records: number; legs: number };
    dispatch_floor: {
        roles: RoleFloor[];
        thresholds: { projection_mandatory_ratio: number; success_ratio_after_projection: number };
        /** Single-run reading — the registered verdict is a sustained-window call at review date. */
        projection_mandatory_signal: boolean | null;
    };
    rules_efficiency: RulesEfficiency & { threshold_low_quota: number; low_quota_signal: boolean | null };
    notes: string[];
}

export function median(values: readonly number[]): number | null {
    if (values.length === 0) return null;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    const lo = s[mid - 1];
    const hi = s[mid];
    if (s.length % 2 === 1) return hi ?? null;
    return lo !== undefined && hi !== undefined ? (lo + hi) / 2 : null;
}

/** Group subagent records into per-agentId legs and compute init/work per leg. */
export function computeLegs(records: readonly TranscriptRecord[]): LegStat[] {
    const byAgent = new Map<string, TranscriptRecord[]>();
    for (const r of records) {
        if (r.bucket !== 'subagent' || r.agentId === null) continue;
        const list = byAgent.get(r.agentId) ?? [];
        list.push(r);
        byAgent.set(r.agentId, list);
    }
    const legs: LegStat[] = [];
    for (const [agentId, recs] of byAgent) {
        // Timestamp sort; records without timestamps keep file order (stable sort).
        const sorted = [...recs].sort((a, b) => {
            if (a.timestamp === null || b.timestamp === null) return 0;
            return a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0;
        });
        const first = sorted[0];
        if (first === undefined) continue;
        const init = billableInputTokens(first.usage);
        const total = sorted.reduce((acc, r) => acc + billableInputTokens(r.usage), 0);
        const work = total - init;
        const initUnits = weightedInputUnits(first.usage);
        const workUnits = sorted.slice(1).reduce((acc, r) => acc + weightedInputUnits(r.usage), 0);
        legs.push({
            agentId,
            calls: sorted.length,
            init_tokens: init,
            work_tokens: work,
            ratio: workUnits > 0 ? initUnits / workUnits : null,
        });
    }
    return legs.sort((a, b) => (a.agentId < b.agentId ? -1 : 1));
}

interface AuditOrchestration {
    rules_carried?: unknown;
    rules_used?: unknown;
    init_tokens?: unknown;
    work_tokens?: unknown;
    floor_provenance?: unknown;
    agent_combo?: unknown;
}

function isFiniteNonNegInt(v: unknown): v is number {
    return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

/** Read every orchestration object out of the audit dir's monthly JSONL files. */
export function readAuditOrchestrations(auditDir: string): AuditOrchestration[] {
    if (!fs.existsSync(auditDir)) return [];
    const out: AuditOrchestration[] = [];
    let entries: string[];
    try {
        entries = fs.readdirSync(auditDir).filter((f) => f.endsWith('.jsonl')).sort();
    } catch {
        return [];
    }
    for (const f of entries) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(auditDir, f), 'utf8');
        } catch {
            continue;
        }
        for (const line of text.split('\n')) {
            if (line.trim().length === 0) continue;
            try {
                const parsed = JSON.parse(line) as { orchestration?: AuditOrchestration };
                if (parsed.orchestration && typeof parsed.orchestration === 'object') {
                    out.push(parsed.orchestration);
                }
            } catch {
                continue;
            }
        }
    }
    return out;
}

export function buildReport(opts: {
    root: string;
    auditDir: string;
    maxAgeDays: number;
    now?: Date;
}): Report {
    const registrationRaw = fs.readFileSync(REGISTRATION_FILE, 'utf8');
    const registration = JSON.parse(registrationRaw) as {
        registered_at: string;
        review_by: string;
        metrics: {
            dispatch_floor: { thresholds: { projection_mandatory_ratio: number; success_ratio_after_projection: number } };
            rules_efficiency: { thresholds: { low_quota_signal: number } };
        };
    };

    const scanOpts: Parameters<typeof scanTranscripts>[0] = {
        root: opts.root,
        maxAgeDays: opts.maxAgeDays,
        ...(opts.now !== undefined ? { now: opts.now } : {}),
    };
    const scan = scanTranscripts(scanOpts);
    const legs = computeLegs(scan.records);
    const finiteRatios = legs.map((l) => l.ratio).filter((r): r is number => r !== null);
    const singleCall = legs.filter((l) => l.ratio === null).length;

    const orchestrations = readAuditOrchestrations(opts.auditDir);
    const reviewerMeasured: { init: number; work: number }[] = [];
    const quotas: number[] = [];
    for (const o of orchestrations) {
        if (isFiniteNonNegInt(o.rules_carried) && isFiniteNonNegInt(o.rules_used) && o.rules_carried > 0) {
            quotas.push(o.rules_used / o.rules_carried);
        }
        const isReviewer = Array.isArray(o.agent_combo) && o.agent_combo.some((t) => typeof t === 'string' && REVIEWER_TYPE_RE.test(t));
        if (isReviewer && o.floor_provenance === 'measured' && isFiniteNonNegInt(o.init_tokens) && isFiniteNonNegInt(o.work_tokens)) {
            reviewerMeasured.push({ init: o.init_tokens, work: o.work_tokens });
        }
    }

    const workerFloor: RoleFloor = {
        role: 'worker',
        attribution: 'transcript-leg (role axis not shipped — all legs report as worker)',
        legs: legs.length,
        single_call_legs: singleCall,
        median_init_tokens: median(legs.map((l) => l.init_tokens)),
        median_ratio_finite: median(finiteRatios),
    };
    // Audit lines carry raw token counts only (no cache split), so the
    // reviewer ratio is raw init/work — flagged via the attribution string.
    const reviewerRatios = reviewerMeasured.filter((p) => p.work > 0).map((p) => p.init / p.work);
    const reviewerFloor: RoleFloor = {
        role: 'reviewer',
        attribution: 'audit-line agent_combo',
        legs: reviewerMeasured.length,
        single_call_legs: reviewerMeasured.filter((p) => p.work === 0).length,
        median_init_tokens: median(reviewerMeasured.map((p) => p.init)),
        median_ratio_finite: median(reviewerRatios),
    };

    const t = registration.metrics.dispatch_floor.thresholds;
    const lowQuota = registration.metrics.rules_efficiency.thresholds.low_quota_signal;
    const medianQuota = median(quotas);
    const medianWorkerRatio = workerFloor.median_ratio_finite;

    const notes: string[] = [
        `dedup: ${scan.totalSeen} raw assistant records → ${scan.dedupedCount} (replay inflation removed)`,
        'single_call_legs are floor-only legs (all init, zero work) — they are excluded from the finite-ratio median and support, never dilute, the projection-mandatory reading',
        'projection_mandatory_signal is a single-run reading; the registered verdict is a sustained-window call at review date (dispatch-economy-metrics.json)',
    ];

    return {
        schema: 'dispatch-economy-report/v1',
        registration: { registered_at: registration.registered_at, review_by: registration.review_by },
        window: { max_age_days: opts.maxAgeDays, transcript_records: scan.dedupedCount, legs: legs.length },
        dispatch_floor: {
            roles: [workerFloor, reviewerFloor],
            thresholds: t,
            projection_mandatory_signal: medianWorkerRatio === null ? null : medianWorkerRatio > t.projection_mandatory_ratio,
        },
        rules_efficiency: {
            envelopes_with_pair: quotas.length,
            median_quota: medianQuota,
            threshold_low_quota: lowQuota,
            low_quota_signal: medianQuota === null ? null : medianQuota < lowQuota,
        },
        notes,
    };
}

function fmtTokens(n: number | null): string {
    if (n === null) return '—';
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
}

function renderText(r: Report): string {
    const lines: string[] = [];
    lines.push('dispatch-economy report (registered: ' + r.registration.registered_at + ' · review by: ' + r.registration.review_by + ')');
    lines.push(`window: ${r.window.max_age_days}d · ${r.window.transcript_records} deduped records · ${r.window.legs} legs`);
    lines.push('');
    lines.push('dispatch_floor:');
    for (const role of r.dispatch_floor.roles) {
        lines.push(
            `  ${role.role.padEnd(8)} legs=${role.legs} (single-call: ${role.single_call_legs}) · median init=${fmtTokens(role.median_init_tokens)} · median init/work=${role.median_ratio_finite === null ? '—' : role.median_ratio_finite.toFixed(2)}`,
        );
        lines.push(`           attribution: ${role.attribution}`);
    }
    lines.push(
        `  projection-mandatory signal (ratio > ${r.dispatch_floor.thresholds.projection_mandatory_ratio}): ${r.dispatch_floor.projection_mandatory_signal === null ? 'no data' : String(r.dispatch_floor.projection_mandatory_signal)}`,
    );
    lines.push('');
    lines.push('rules_efficiency:');
    lines.push(
        `  envelopes with pair=${r.rules_efficiency.envelopes_with_pair} · median quota=${r.rules_efficiency.median_quota === null ? '—' : r.rules_efficiency.median_quota.toFixed(2)} · low-quota signal (< ${r.rules_efficiency.threshold_low_quota}): ${r.rules_efficiency.low_quota_signal === null ? 'no data' : String(r.rules_efficiency.low_quota_signal)}`,
    );
    lines.push('');
    for (const n of r.notes) lines.push(`note: ${n}`);
    return lines.join('\n') + '\n';
}

export function main(argv: readonly string[]): number {
    let format: 'text' | 'json' = 'text';
    let root = DEFAULT_PROJECTS_ROOT;
    let auditDir = path.join(process.cwd(), DEFAULT_AUDIT_DIR);
    let maxAgeDays = 14;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--format') format = argv[++i] === 'json' ? 'json' : 'text';
        else if (a === '--root') root = argv[++i] ?? root;
        else if (a === '--audit-dir') auditDir = argv[++i] ?? auditDir;
        else if (a === '--max-age-days') maxAgeDays = Number(argv[++i] ?? maxAgeDays) || maxAgeDays;
    }
    let report: Report;
    try {
        report = buildReport({ root, auditDir, maxAgeDays });
    } catch (err) {
        process.stderr.write(`dispatch_economy_report: ${err instanceof Error ? err.message : String(err)}\n`);
        return 2;
    }
    process.stdout.write(format === 'json' ? JSON.stringify(report, null, 2) + '\n' : renderText(report));
    return 0;
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}
if (_isCliEntry()) process.exit(main(process.argv.slice(2)));

/**
 * utilization_report.ts — U1 loaded-vs-fired utilization report
 * (road-to-ecosystem-harvest-reliability-measurement, P1).
 *
 * PRIVACY: session engagement logs are personal data. This tool is
 * LOCAL-ONLY and REPORT-ONLY by default — it is deliberately NOT wired into
 * `task ci`; the opt-in gate flags below are for a consumer's own CI, never
 * this repo's. The report header restates this.
 *
 * Consumes (never redefines) the pre-registered window criteria at
 * docs/design/utilization-window-criteria.md (CLAIMS
 * `utilization-window-decidability`):
 *   floor  — ≥ 100 task/phase-step boundaries · ≥ 2 recording periods ≥ 14
 *            days apart (host identity is not in the schema) · ≥ 45 days
 *            since 2026-07-12. Below floor → UNDERPOWERED report, no verdicts.
 *   D1     — loaded-never-consulted over the window → retirement candidate
 *            (REAP verdict; kernel + safety floors exempt by construction).
 *            Without the U1a denominator in the data the report degrades to
 *            consulted-set analysis and says so.
 *   D2     — consulted-never-applied with ≥ 5 consultations and
 *            applied-ratio < 10% → trigger-review queue (REVIEW verdict).
 *   D3/D4  — above floor: ≥ 1 named decision per artifact kind (or a stated
 *            reason); below floor: honest null, gates stay closed.
 *
 * Verdicts: REAP (cut candidate — reversible quarantine with a manifest,
 * never hard delete), KEEP, REVIEW. Session floor: no verdict below
 * MIN_SESSIONS distinct task_ids — absence of evidence is not evidence of
 * absence.
 *
 * Opt-in CI-gate flags (consumer-side only): --fail-under-utilization <pct>
 * exits 3 when overall fired/loaded falls below the threshold;
 * --fail-on-stale-days <n> exits 3 when the newest event is older than n
 * days. Neither flag is used in this repo's pipelines.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { aggregate } from '../agent-src/templates/scripts/telemetry/aggregator.js';

export const WINDOW_START_ISO = '2026-07-12T00:00:00Z';
export const FLOOR_BOUNDARIES = 100;
export const FLOOR_ELAPSED_DAYS = 45;
export const FLOOR_PERIOD_GAP_DAYS = 14;
export const MIN_SESSIONS = 4; // session floor for any verdict
export const D2_MIN_CONSULTED = 5;
export const D2_APPLIED_RATIO_LT = 0.10;

export interface VerdictRow {
    kind: string;
    id: string;
    loaded: number;
    consulted: number;
    applied: number;
    verdict: 'REAP' | 'KEEP' | 'REVIEW';
    rule: 'D1' | 'D2' | '—';
}

export interface KernelInfo {
    kernel: Set<string>;
    safety_floors: Set<string>;
}

/**
 * A rule id that names a safety surface.
 *
 * WIDENED 2026-08-30 (road-to-experience-loop-broadening 6.4). The predicate
 * was `id.endsWith('-safety-floor')`, which exempted 4 of this tree's 9 safety
 * rules. The five it missed were `domain-safety-disclaimer`,
 * `domain-safety-pii`, `domain-safety-retention`, `runtime-safety` and
 * `tool-safety` — none of them kernel, so every one was REAP-eligible on low
 * usage. A usage-based retirement proposal for `domain-safety-pii` or
 * `tool-safety` is precisely the outcome this carve-out exists to prevent, and
 * low usage is exactly what a safety floor that is working looks like: it fires
 * rarely, and rarely is not the same as never needed.
 *
 * Matching `safety` as a hyphen-delimited token covers all nine and, verified
 * against the 119 projected rules on the day it was written, matches nothing
 * else. The direction is deliberately the conservative one — it can only
 * REMOVE retirement proposals, never add one.
 */
const SAFETY_ID_RE = /(^|-)safety(-|$)/;

/** Kernel rule ids (type: always / alwaysApply) + safety-surface ids — exempt from REAP. */
export function read_exempt(rulesDir: string): KernelInfo {
    const kernel = new Set<string>();
    const safety = new Set<string>();
    for (const name of fs.readdirSync(rulesDir)) {
        if (!name.endsWith('.md')) continue;
        const id = name.replace(/\.md$/, '');
        if (SAFETY_ID_RE.test(id)) safety.add(id);
        const head = fs.readFileSync(path.join(rulesDir, name), 'utf-8').slice(0, 400);
        if (/^type:\s*["']?always["']?/m.test(head) || /^alwaysApply:\s*true/m.test(head)) {
            kernel.add(id);
        }
    }
    return { kernel, safety_floors: safety };
}

export function decide(
    row: { kind: string; id: string; loaded: number; consulted: number; applied: number },
    exempt: KernelInfo,
    sessions: number,
): VerdictRow {
    const base = { ...row } as VerdictRow;
    if (sessions < MIN_SESSIONS) {
        base.verdict = 'KEEP';
        base.rule = '—';
        return base; // below the session floor no negative verdict is allowed
    }
    const isExempt = row.kind === 'rules'
        && (exempt.kernel.has(row.id) || exempt.safety_floors.has(row.id));
    if (row.loaded > 0 && row.consulted === 0 && !isExempt) {
        base.verdict = 'REAP';
        base.rule = 'D1';
        return base;
    }
    if (row.consulted >= D2_MIN_CONSULTED && row.applied / row.consulted < D2_APPLIED_RATIO_LT) {
        base.verdict = 'REVIEW';
        base.rule = 'D2';
        return base;
    }
    base.verdict = 'KEEP';
    base.rule = '—';
    return base;
}

interface FloorState {
    boundaries: number;
    sessions: number;
    elapsed_days: number;
    periods_ok: boolean;
    above_floor: boolean;
    has_loaded: boolean;
}

function day_diff(aIso: string, bIso: string): number {
    return Math.abs(Date.parse(aIso) - Date.parse(bIso)) / 86_400_000;
}

export function assess_floor(logPath: string): FloorState {
    const agg = aggregate(logPath);
    // sessions = distinct task_ids; boundaries = parsed events. Recording
    // periods: earliest vs latest ts ≥ FLOOR_PERIOD_GAP_DAYS apart (the
    // schema-preserving degradation recorded in the criteria doc).
    const text = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf-8') : '';
    const taskIds = new Set<string>();
    for (const line of text.split('\n')) {
        const m = line.match(/"task_id":"([^"]+)"/);
        if (m) taskIds.add(m[1] ?? '');
    }
    const elapsed = agg.latest_ts ? day_diff(WINDOW_START_ISO, agg.latest_ts) : 0;
    const periodsOk = agg.earliest_ts !== null && agg.latest_ts !== null
        && day_diff(agg.earliest_ts, agg.latest_ts) >= FLOOR_PERIOD_GAP_DAYS;
    return {
        boundaries: agg.parsed_events,
        sessions: taskIds.size,
        elapsed_days: Math.floor(elapsed),
        periods_ok: periodsOk,
        above_floor: agg.parsed_events >= FLOOR_BOUNDARIES && periodsOk
            && elapsed >= FLOOR_ELAPSED_DAYS,
        has_loaded: agg.loaded_events > 0,
    };
}

export async function main(argv: string[]): Promise<number> {
    const arg = (flag: string): string | null => {
        const i = argv.indexOf(flag);
        return i !== -1 ? argv[i + 1] ?? null : null;
    };
    const logPath = arg('--log') ?? '.agent-engagement.jsonl';
    const rulesDir = arg('--rules-dir') ?? 'dist/agent-src/rules';
    const failUnder = arg('--fail-under-utilization');
    const failStale = arg('--fail-on-stale-days');
    const out: string[] = [];
    out.push('# Utilization report — loaded vs fired');
    out.push('');
    out.push('> LOCAL-ONLY, REPORT-ONLY. Session transcripts/engagement logs are personal');
    out.push('> data; this tool never runs in `task ci` and its output stays out of git.');
    out.push('> Criteria consumed from docs/design/utilization-window-criteria.md — the');
    out.push('> report applies D1-D4, it does not redefine them. A REAP verdict is a');
    out.push('> QUARANTINE candidate (reversible move + manifest: what/when/why/restore),');
    out.push('> never a hard delete.');
    out.push('');

    const floor = assess_floor(logPath);
    out.push(`- boundaries recorded: ${floor.boundaries} (floor ${FLOOR_BOUNDARIES})`);
    out.push(`- distinct sessions: ${floor.sessions} (verdict floor ${MIN_SESSIONS})`);
    out.push(`- recording span ≥ ${FLOOR_PERIOD_GAP_DAYS}d: ${floor.periods_ok}`);
    out.push(`- loaded denominator present: ${floor.has_loaded}${floor.has_loaded ? '' : ' — D1 degrades to consulted-set analysis (stated per the criteria doc)'}`);
    out.push('');

    const agg = aggregate(logPath);
    const exempt = read_exempt(rulesDir);
    const rows = agg.stats().map((s) => decide(
        { kind: s.kind, id: s.artefact_id, loaded: s.loaded, consulted: s.consulted, applied: s.applied },
        exempt,
        floor.sessions,
    ));

    if (!floor.above_floor) {
        out.push('## Verdict: UNDERPOWERED (window floor not met — D4 path)');
        out.push('');
        out.push('No REAP/REVIEW verdicts are issued below the observation floor;');
        out.push('lifecycle-automation and field-outcome-ledger gates stay closed.');
        out.push('Interim observed counts follow (informational only):');
    } else {
        out.push('## Verdicts (D3 path — above floor)');
    }
    out.push('');
    out.push('| kind | id | loaded | consulted | applied | verdict | rule |');
    out.push('|---|---|---:|---:|---:|---|---|');
    const ranked = [...rows].sort((a, b) => (a.consulted - b.consulted) || (b.loaded - a.loaded));
    for (const r of ranked) {
        const verdict = floor.above_floor ? r.verdict : '—';
        const rule = floor.above_floor ? r.rule : '—';
        out.push(`| ${r.kind} | \`${r.id}\` | ${r.loaded} | ${r.consulted} | ${r.applied} | ${verdict} | ${rule} |`);
    }
    process.stdout.write(`${out.join('\n')}\n`);

    // Opt-in consumer CI gates (exit 3) — never wired in this repo.
    if (failUnder !== null) {
        const totLoaded = rows.reduce((n, r) => n + r.loaded, 0);
        const totFired = rows.reduce((n, r) => n + (r.loaded > 0 && r.consulted > 0 ? 1 : 0), 0);
        const denom = rows.filter((r) => r.loaded > 0).length;
        const pct = denom > 0 && totLoaded > 0 ? (totFired / denom) * 100 : 100;
        if (pct < Number(failUnder)) return 3;
    }
    if (failStale !== null && agg.latest_ts !== null) {
        if (day_diff(agg.latest_ts, new Date().toISOString()) > Number(failStale)) return 3;
    }
    return 0;
}

const isMain = process.argv[1] !== undefined
    && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
    main(process.argv.slice(2)).then(
        (code) => process.exit(code),
        (err) => {
            process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
            process.exit(1);
        },
    );
}

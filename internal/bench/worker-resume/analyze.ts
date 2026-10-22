#!/usr/bin/env tsx
/**
 * Read a worker-resume bench run against the four pre-registered claims of
 * `docs/CLAIMS.md` (road-to-a-cold-start-paid-once 6.1). Bars are the
 * registered ones; a sample below its floor is `underpowered`, never a verdict.
 *
 * Usage: npx tsx internal/bench/worker-resume/analyze.ts --scratch <dir> --transcripts <project-store-dir>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { median, readLedgerStarts, segmentLegsIntoRuns } from '../../../src/scripts/cache_realization_report.js';
import { scanTranscripts } from '../../../src/scripts/_lib/cc_transcript.js';
import { LEDGER_DIR } from '../../../src/scripts/hooks/subagent_ledger_hook.js';
import { readLedgerLines } from '../../../src/scripts/worker_reuse_shadow_report.js';
import { TASKS_PER_SESSION } from './run.js';

export const RELIEF_MAX_RATIO = 0.2;
export const RELIEF_MIN_RESUMES = 30;
export const RELIEF_MIN_SESSIONS = 5;
export const NONINF_MARGIN_PP = -5;
export const NONINF_MIN_EACH = 30;

export interface Result {
    arm: 'fresh' | 'reuse';
    session_index?: number;
    session_id: string | null;
    tasks?: string[];
    passes: boolean[];
    answers_parsed?: boolean;
    is_error: boolean | null;
    api_error_status?: unknown;
}

export type Verdict = 'backed' | 'null' | 'underpowered';

export function reliefVerdict(resumes: number, sessions: number, ratio: number | null): Verdict {
    if (resumes < RELIEF_MIN_RESUMES || sessions < RELIEF_MIN_SESSIONS || ratio === null) return 'underpowered';
    return ratio <= RELIEF_MAX_RATIO ? 'backed' : 'null';
}

/** Distinct known sessions among the resumed refs; a ref with no recorded session is not a session. */
export function sessionsWithResumes(refs: readonly string[], refSession: ReadonlyMap<string, string>): number {
    const s = new Set<string>();
    for (const ref of refs) {
        const id = refSession.get(ref);
        if (id !== undefined) s.add(id);
    }
    return s.size;
}

export function isFailedSession(r: Pick<Result, 'is_error' | 'api_error_status'>): boolean {
    return r.is_error === true || (r.api_error_status !== null && r.api_error_status !== undefined);
}

/** A session is scorable only when its answers parsed, it did not fail, and it scored every task. */
export function scorableSessions(results: readonly Result[]): { scorable: Result[]; excluded: Result[] } {
    const scorable: Result[] = [];
    const excluded: Result[] = [];
    for (const r of results) {
        const ok = r.answers_parsed === true && !isFailedSession(r) && r.passes.length === TASKS_PER_SESSION;
        (ok ? scorable : excluded).push(r);
    }
    return { scorable, excluded };
}

const rate = (xs: readonly boolean[]): number | null => (xs.length ? xs.filter(Boolean).length / xs.length : null);

/**
 * Pooled reading (the registered one): REUSE tasks 2..9 against every FRESH task.
 * Paired reading: per session, positions 2..9 where both arms ran the same tasks.
 * Tasks cluster in sessions, so neither reading treats the tasks as independent draws.
 */
export function nonInferiority(results: readonly Result[]) {
    const { scorable, excluded } = scorableSessions(results);
    const resumedPass = scorable.filter((r) => r.arm === 'reuse').flatMap((r) => r.passes.slice(1));
    const freshPass = scorable.filter((r) => r.arm === 'fresh').flatMap((r) => r.passes);
    const rRes = rate(resumedPass);
    const rFr = rate(freshPass);
    const diffPp = rRes !== null && rFr !== null ? (rRes - rFr) * 100 : null;
    const powered = resumedPass.length >= NONINF_MIN_EACH && freshPass.length >= NONINF_MIN_EACH;

    const byK = new Map<number, { fresh?: Result; reuse?: Result }>();
    for (const r of scorable) {
        if (r.session_index === undefined) continue;
        const slot = byK.get(r.session_index) ?? {};
        slot[r.arm] = r;
        byK.set(r.session_index, slot);
    }
    let pairs = 0;
    let sessions = 0;
    let both = 0;
    let reuseOnly = 0;
    let freshOnly = 0;
    let neither = 0;
    const perSessionDiffPp: number[] = [];
    for (const { fresh, reuse } of byK.values()) {
        if (!fresh || !reuse || !fresh.tasks || !reuse.tasks || fresh.tasks.join('\n') !== reuse.tasks.join('\n')) continue;
        sessions++;
        let d = 0;
        for (let i = 1; i < TASKS_PER_SESSION; i++) {
            pairs++;
            const f = fresh.passes[i] === true;
            const u = reuse.passes[i] === true;
            if (f && u) both++;
            else if (u) reuseOnly++;
            else if (f) freshOnly++;
            else neither++;
            d += Number(u) - Number(f);
        }
        perSessionDiffPp.push((d / (TASKS_PER_SESSION - 1)) * 100);
    }
    const freshMisses = scorable.filter((r) => r.arm === 'fresh').map((r) => r.passes.filter((p) => !p).length);
    return {
        excluded_sessions: excluded.length,
        pooled: {
            resumed_tasks: resumedPass.length,
            resumed_pass_rate: rRes,
            fresh_tasks: freshPass.length,
            fresh_pass_rate: rFr,
            difference_pp: diffPp,
            fresh_misses_per_session: freshMisses,
            fresh_sessions_with_a_miss: freshMisses.filter((m) => m > 0).length,
        },
        paired: {
            sessions,
            pairs,
            both_pass: both,
            reuse_only_pass: reuseOnly,
            fresh_only_pass: freshOnly,
            neither_pass: neither,
            difference_pp: pairs ? ((reuseOnly - freshOnly) / pairs) * 100 : null,
            min_session_difference_pp: perSessionDiffPp.length ? Math.min(...perSessionDiffPp) : null,
        },
        bar: `pooled difference >= ${NONINF_MARGIN_PP} pp at >= ${NONINF_MIN_EACH} tasks each`,
        // The tolerance keeps a difference of exactly the margin from failing on float rounding.
        verdict: (!powered || diffPp === null ? 'underpowered' : diffPp >= NONINF_MARGIN_PP - 1e-9 ? 'backed' : 'null') as Verdict,
    };
}

export function analyse(scratch: string, transcripts: string): Record<string, unknown> {
    const results = fs
        .readFileSync(path.join(scratch, 'results.jsonl'), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Result);
    const armOf = new Map(results.filter((r) => r.session_id).map((r) => [r.session_id!, r.arm]));
    const ledgerDir = path.join(scratch, 'proj', LEDGER_DIR);
    const lines = readLedgerLines(ledgerDir);
    const refType = new Map<string, string>();
    const refSession = new Map<string, string>();
    for (const l of lines) {
        if (l.event !== 'subagent_start' || !l.ref) continue;
        if (typeof l.agent_type === 'string') refType.set(l.ref, l.agent_type);
        if (typeof l.session_id === 'string') refSession.set(l.ref, l.session_id);
    }
    const runs = segmentLegsIntoRuns(scanTranscripts({ root: transcripts }).records, readLedgerStarts(ledgerDir)).runs.filter(
        (r) => refType.get(r.ref) === 'ac-researcher',
    );
    const fresh = runs.filter((r) => r.ordinal === 1);
    const resumed = runs.filter((r) => r.ordinal >= 2);
    const freshArmFresh = fresh.filter((r) => armOf.get(refSession.get(r.ref) ?? '') === 'fresh');
    const resumeSessions = sessionsWithResumes(resumed.map((r) => r.ref), refSession);
    const freshMedian = fresh.length ? median(fresh.map((r) => r.first_call_written_or_uncached)) : null;
    const resumedMedian = resumed.length ? median(resumed.map((r) => r.first_call_written_or_uncached)) : null;
    const ratio = freshMedian && resumedMedian !== null ? resumedMedian / freshMedian : null;

    // Fresh spawns per session: subagent_start lines whose ref is new in that session.
    const perSession = new Map<string, Set<string>>();
    for (const l of lines) {
        if (l.event !== 'subagent_start' || !l.ref || typeof l.session_id !== 'string') continue;
        (perSession.get(l.session_id) ?? perSession.set(l.session_id, new Set()).get(l.session_id)!).add(l.ref);
    }
    const spawnsBy = (arm: string): number[] => [...perSession].filter(([s]) => armOf.get(s) === arm).map(([, refs]) => refs.size);

    // Rate-limit stops: host markers written by the StopFailure hook, ledger agent_error lines, failed sessions.
    const parkedDir = path.join(scratch, 'proj', 'agents', 'runtime', 'state', 'quota-parked');
    const hostMarkers = fs.existsSync(parkedDir)
        ? fs.readdirSync(parkedDir).filter((f) => {
              try {
                  return (JSON.parse(fs.readFileSync(path.join(parkedDir, f), 'utf8')) as { source?: string }).source === 'host';
              } catch {
                  return false;
              }
          }).length
        : 0;
    const agentErrorLines = lines.filter((l) => l.event === 'agent_error').length;
    const failedSessions = results.filter(isFailedSession).length;
    const { excluded } = scorableSessions(results);

    return {
        sessions: {
            total: results.length,
            fresh: results.filter((r) => r.arm === 'fresh').length,
            reuse: results.filter((r) => r.arm === 'reuse').length,
            excluded_unparsed_or_failed: excluded.map((r) => ({ arm: r.arm, session_index: r.session_index ?? null, session_id: r.session_id })),
        },
        'warm-worker-cold-start-relief': {
            fresh_runs: fresh.length,
            fresh_runs_fresh_arm_only: freshArmFresh.length,
            resumed_runs: resumed.length,
            sessions_with_resumes: resumeSessions,
            median_fresh_first_call_written_or_uncached: freshMedian,
            median_fresh_arm_only: freshArmFresh.length ? median(freshArmFresh.map((r) => r.first_call_written_or_uncached)) : null,
            median_resumed_first_call_written_or_uncached: resumedMedian,
            ratio,
            bar: `<= ${RELIEF_MAX_RATIO} at >= ${RELIEF_MIN_RESUMES} resumes across >= ${RELIEF_MIN_SESSIONS} sessions`,
            verdict: reliefVerdict(resumed.length, resumeSessions, ratio),
        },
        'resume-non-inferiority': nonInferiority(results),
        'fresh-spawns-per-drain': {
            fresh_arm_per_session: spawnsBy('fresh'),
            reuse_arm_per_session: spawnsBy('reuse'),
            fresh_arm_median: spawnsBy('fresh').length ? median(spawnsBy('fresh')) : null,
            reuse_arm_median: spawnsBy('reuse').length ? median(spawnsBy('reuse')) : null,
            bar: 'direction only: ledger fresh spawns per drain run, before vs after Phase 3',
            verdict: 'underpowered' as Verdict,
            reason: 'tautological here: the arm prompts fix 9 spawns (FRESH) and 1 (REUSE), so the counts measure prompt compliance, not a drain before vs after Phase 3',
        },
        'rate-limit-stops-per-drain': {
            host_quota_parked_markers: hostMarkers,
            ledger_agent_error_lines: agentErrorLines,
            failed_sessions: failedSessions,
            verdict: 'underpowered' as Verdict,
            reason: 'by registration: no before/after drain pair, and the step 1.9 StopFailure precondition was not checked by this window',
        },
    };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
    const argv = process.argv.slice(2);
    const arg = (k: string): string => argv[argv.indexOf(k) + 1] ?? '';
    process.stdout.write(`${JSON.stringify(analyse(arg('--scratch'), arg('--transcripts')), null, 2)}\n`);
}

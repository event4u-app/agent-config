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

export const RELIEF_MAX_RATIO = 0.2;
export const RELIEF_MIN_RESUMES = 30;
export const RELIEF_MIN_SESSIONS = 5;
export const NONINF_MARGIN_PP = -5;
export const NONINF_MIN_EACH = 30;

interface Result {
    arm: 'fresh' | 'reuse';
    session_id: string | null;
    passes: boolean[];
    is_error: boolean | null;
    api_error_status: unknown;
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
    const resumeSessions = new Set(resumed.map((r) => refSession.get(r.ref)));
    const freshMedian = fresh.length ? median(fresh.map((r) => r.first_call_written_or_uncached)) : null;
    const resumedMedian = resumed.length ? median(resumed.map((r) => r.first_call_written_or_uncached)) : null;
    const ratio = freshMedian && resumedMedian !== null ? resumedMedian / freshMedian : null;
    const reliefPowered = resumed.length >= RELIEF_MIN_RESUMES && resumeSessions.size >= RELIEF_MIN_SESSIONS;

    // Non-inferiority: REUSE tasks 2..9 are the resumed tasks; every FRESH task is fresh.
    const resumedPass = results.filter((r) => r.arm === 'reuse').flatMap((r) => r.passes.slice(1));
    const freshPass = results.filter((r) => r.arm === 'fresh').flatMap((r) => r.passes);
    const rate = (xs: boolean[]): number | null => (xs.length ? xs.filter(Boolean).length / xs.length : null);
    const rRes = rate(resumedPass);
    const rFr = rate(freshPass);
    const diffPp = rRes !== null && rFr !== null ? (rRes - rFr) * 100 : null;
    const niPowered = resumedPass.length >= NONINF_MIN_EACH && freshPass.length >= NONINF_MIN_EACH;

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
    const failedSessions = results.filter((r) => r.is_error === true || r.api_error_status !== null).length;

    return {
        sessions: { total: results.length, fresh: results.filter((r) => r.arm === 'fresh').length, reuse: results.filter((r) => r.arm === 'reuse').length },
        'warm-worker-cold-start-relief': {
            fresh_runs: fresh.length,
            fresh_runs_fresh_arm_only: freshArmFresh.length,
            resumed_runs: resumed.length,
            sessions_with_resumes: resumeSessions.size,
            median_fresh_first_call_written_or_uncached: freshMedian,
            median_fresh_arm_only: freshArmFresh.length ? median(freshArmFresh.map((r) => r.first_call_written_or_uncached)) : null,
            median_resumed_first_call_written_or_uncached: resumedMedian,
            ratio,
            bar: `<= ${RELIEF_MAX_RATIO} at >= ${RELIEF_MIN_RESUMES} resumes across >= ${RELIEF_MIN_SESSIONS} sessions`,
            verdict: !reliefPowered || ratio === null ? 'underpowered' : ratio <= RELIEF_MAX_RATIO ? 'backed' : 'null',
        },
        'resume-non-inferiority': {
            resumed_tasks: resumedPass.length,
            resumed_pass_rate: rRes,
            fresh_tasks: freshPass.length,
            fresh_pass_rate: rFr,
            difference_pp: diffPp,
            bar: `difference >= ${NONINF_MARGIN_PP} pp at >= ${NONINF_MIN_EACH} tasks each`,
            verdict: !niPowered || diffPp === null ? 'underpowered' : diffPp >= NONINF_MARGIN_PP ? 'backed' : 'null',
        },
        'fresh-spawns-per-drain': {
            fresh_arm_per_session: spawnsBy('fresh'),
            reuse_arm_per_session: spawnsBy('reuse'),
            fresh_arm_median: spawnsBy('fresh').length ? median(spawnsBy('fresh')) : null,
            reuse_arm_median: spawnsBy('reuse').length ? median(spawnsBy('reuse')) : null,
            bar: 'direction only: fewer fresh spawns per session with reuse',
        },
        'rate-limit-stops-per-drain': {
            host_quota_parked_markers: hostMarkers,
            ledger_agent_error_lines: agentErrorLines,
            failed_sessions: failedSessions,
        },
    };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
    const argv = process.argv.slice(2);
    const arg = (k: string): string => argv[argv.indexOf(k) + 1] ?? '';
    process.stdout.write(`${JSON.stringify(analyse(arg('--scratch'), arg('--transcripts')), null, 2)}\n`);
}

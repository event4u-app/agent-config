#!/usr/bin/env tsx
/**
 * CI time-to-green, split into queue and execution per job, OS and event.
 *
 * `ci_time_ratio.ts` reads run-level `createdAt`/`updatedAt` only, so the time a
 * job waits for a runner — `started_at − created_at` — is recorded nowhere. On
 * PR #2569's Tests run (39644704455) every ubuntu job started within a minute
 * while macOS jobs waited up to 33 minutes; that queue is what the owner feels
 * and what this script measures.
 *
 * Reads the Actions runs + jobs API through `gh api` for a time window or one
 * head SHA, and computes:
 *
 *   per job   queue_s = started_at − created_at, exec_s = completed_at − started_at
 *   per run   span_s  = (run_started_at ?? created_at) → last job completed
 *   per SHA   time_to_all_green      = first run created → last job completed,
 *                                      only when every run and job concluded ok
 *             time_to_required_green = first run created → last required job
 *                                      completed, only when every required check
 *                                      is present and green
 *
 * SHAs are grouped per event (`pull_request:<sha>` ≠ `push:<sha>`). A re-run
 * attempt keeps its run's original `created_at`, so time-to-green includes the
 * human delay before the re-run; a run's span starts at its latest attempt.
 *
 * The listing API caps every query at 1000 results, so windows are read in
 * 6-hour slices. Jobs fetches are the expensive part (one call per run); they
 * stop at `--rate-floor` remaining core requests and the output then says the
 * sample is truncated rather than printing a smaller sample as complete.
 * `--cache-dir` keeps completed runs' jobs so a truncated read resumes.
 *
 * Output: JSON + markdown under `agents/reports/` (tracked), markdown on stdout.
 *
 * Usage:
 *   ./scripts-run src/scripts/ci_time_to_green --days 7
 *   ./scripts-run src/scripts/ci_time_to_green --sha <head_sha>
 *   ./scripts-run src/scripts/ci_time_to_green --days 7 --baseline agents/reports/ci-time-to-green.json
 *   (--baseline warns on a > 25 % percentile regression; --full keeps per-SHA and per-run rows)
 *   ./scripts-run src/scripts/ci_time_to_green --days 2 --workflow tests.yml \
 *       --cache-dir /tmp/ci-cache --highlight-run 39644704455
 */
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(_HERE, '..', '..', '..');
export const REPO = 'event4u-app/agent-config';
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, 'agents', 'reports');
export const DEFAULT_REQUIRED = [
    'Sync + Generate Tools Consistency',
    'Standing payload delta + budget gate',
];
const OK_CONCLUSIONS = new Set(['success', 'skipped', 'neutral']);

export interface ApiRun {
    id: number;
    name: string;
    event: string;
    head_sha: string;
    created_at: string;
    updated_at: string;
    run_started_at?: string | null;
    status: string;
    conclusion: string | null;
    path?: string;
    run_attempt?: number;
}

export interface ApiJob {
    id: number;
    run_id: number;
    name: string;
    status: string;
    conclusion: string | null;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
    labels: string[];
    run_attempt?: number;
}

export type Os = 'macos' | 'ubuntu' | 'windows' | 'other';

export interface JobTiming {
    run_id: number;
    workflow: string;
    job: string;
    os: Os;
    event: string;
    conclusion: string | null;
    queue_s: number;
    exec_s: number;
}

export interface RunSummary {
    id: number;
    workflow: string;
    event: string;
    head_sha: string;
    conclusion: string | null;
    run_attempt: number;
    span_s: number | null;
}

export type GreenState = 'green' | 'red' | 'pending' | 'missing';

export interface ShaSummary {
    key: string;
    event: string;
    head_sha: string;
    runs: number;
    all_state: GreenState;
    time_to_all_green_s: number | null;
    required_state: GreenState;
    time_to_required_green_s: number | null;
    missing_required: string[];
}

export interface Stat {
    n: number;
    p50: number | null;
    p90: number | null;
}

function ts(iso: string): number {
    return Date.parse(iso) / 1000;
}

export function osOf(job: Pick<ApiJob, 'labels' | 'name'>): Os {
    const hay = [...(job.labels ?? []), job.name].join(' ').toLowerCase();
    for (const os of ['macos', 'ubuntu', 'windows'] as const) {
        if (hay.includes(os)) {
            return os;
        }
    }
    return 'other';
}

/** Null when the job never ran (skipped, or not yet started/finished). */
export function jobTiming(job: ApiJob, run: ApiRun): JobTiming | null {
    if (job.conclusion === 'skipped' || job.started_at === null || job.completed_at === null) {
        return null;
    }
    const created = ts(job.created_at);
    const started = ts(job.started_at);
    const completed = ts(job.completed_at);
    return {
        run_id: run.id,
        workflow: run.name,
        job: job.name,
        os: osOf(job),
        event: run.event,
        conclusion: job.conclusion,
        // Runner clocks can put started_at a second before created_at.
        queue_s: Math.max(0, started - created),
        exec_s: Math.max(0, completed - started),
    };
}

function lastCompleted(jobs: readonly ApiJob[]): number | null {
    let last: number | null = null;
    for (const j of jobs) {
        if (j.completed_at !== null) {
            const c = ts(j.completed_at);
            if (last === null || c > last) {
                last = c;
            }
        }
    }
    return last;
}

export function runSummary(run: ApiRun, jobs: readonly ApiJob[]): RunSummary {
    const last = lastCompleted(jobs);
    const origin = ts(run.run_started_at ?? run.created_at);
    return {
        id: run.id,
        workflow: run.name,
        event: run.event,
        head_sha: run.head_sha,
        conclusion: run.conclusion,
        run_attempt: run.run_attempt ?? 1,
        span_s: last === null ? null : Math.max(0, last - origin),
    };
}

/** All runs given must share one event + head SHA. */
export function shaSummary(
    runs: readonly ApiRun[],
    jobsByRun: ReadonlyMap<number, readonly ApiJob[]>,
    required: readonly string[],
): ShaSummary {
    const first = runs[0] as ApiRun;
    const origin = Math.min(...runs.map((r) => ts(r.created_at)));
    const jobs = runs.flatMap((r) => jobsByRun.get(r.id) ?? []);
    const pending =
        runs.some((r) => r.status !== 'completed') || jobs.some((j) => j.status !== 'completed');

    let all_state: GreenState;
    if (pending) {
        all_state = 'pending';
    } else if (
        runs.every((r) => OK_CONCLUSIONS.has(r.conclusion ?? '')) &&
        jobs.every((j) => OK_CONCLUSIONS.has(j.conclusion ?? ''))
    ) {
        all_state = 'green';
    } else {
        all_state = 'red';
    }
    const last = lastCompleted(jobs);

    const missing_required: string[] = [];
    let requiredLast: number | null = null;
    let required_state: GreenState = 'green';
    for (const name of required) {
        const matches = jobs.filter((j) => j.name === name);
        if (matches.length === 0) {
            missing_required.push(name);
            continue;
        }
        // A re-run leaves the latest attempt as the one branch protection reads.
        const latest = matches.reduce((a, b) =>
            (a.run_attempt ?? 1) >= (b.run_attempt ?? 1) ? a : b,
        );
        if (latest.status !== 'completed' || latest.completed_at === null) {
            required_state = required_state === 'red' ? 'red' : 'pending';
            continue;
        }
        if (latest.conclusion !== 'success') {
            required_state = 'red';
            continue;
        }
        const c = ts(latest.completed_at);
        requiredLast = requiredLast === null ? c : Math.max(requiredLast, c);
    }
    if (missing_required.length > 0 && required_state === 'green') {
        required_state = 'missing';
    }

    return {
        key: `${first.event}:${first.head_sha}`,
        event: first.event,
        head_sha: first.head_sha,
        runs: runs.length,
        all_state,
        time_to_all_green_s: all_state === 'green' && last !== null ? last - origin : null,
        required_state,
        time_to_required_green_s:
            required_state === 'green' && requiredLast !== null ? requiredLast - origin : null,
        missing_required,
    };
}

/** Nearest-rank percentile; null on an empty sample. */
export function percentile(values: readonly number[], p: number): number | null {
    if (values.length === 0) {
        return null;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
    return sorted[rank - 1] as number;
}

export function stat(values: readonly number[]): Stat {
    return { n: values.length, p50: percentile(values, 50), p90: percentile(values, 90) };
}

export interface OsEventRow {
    os: Os;
    event: string;
    queue: Stat;
    exec: Stat;
}

export interface EventRow {
    event: string;
    shas: number;
    all_green: Stat;
    required_green: Stat;
}

export interface Report {
    by_os_event: OsEventRow[];
    by_event: EventRow[];
    runs: RunSummary[];
    shas: ShaSummary[];
    jobs: JobTiming[];
}

export function computeReport(
    runs: readonly ApiRun[],
    jobsByRun: ReadonlyMap<number, readonly ApiJob[]>,
    required: readonly string[],
): Report {
    const jobs: JobTiming[] = [];
    const runSummaries: RunSummary[] = [];
    const groups = new Map<string, ApiRun[]>();
    for (const run of runs) {
        const runJobs = jobsByRun.get(run.id);
        if (runJobs === undefined) {
            continue;
        }
        for (const j of runJobs) {
            const t = jobTiming(j, run);
            if (t !== null) {
                jobs.push(t);
            }
        }
        runSummaries.push(runSummary(run, runJobs));
        const key = `${run.event}:${run.head_sha}`;
        const g = groups.get(key) ?? [];
        g.push(run);
        groups.set(key, g);
    }
    const shas = [...groups.values()].map((g) => shaSummary(g, jobsByRun, required));

    const osEvent = new Map<string, { os: Os; event: string; q: number[]; e: number[] }>();
    for (const j of jobs) {
        const key = `${j.os}|${j.event}`;
        const cell = osEvent.get(key) ?? { os: j.os, event: j.event, q: [], e: [] };
        cell.q.push(j.queue_s);
        cell.e.push(j.exec_s);
        osEvent.set(key, cell);
    }
    const by_os_event = [...osEvent.values()]
        .map((c) => ({ os: c.os, event: c.event, queue: stat(c.q), exec: stat(c.e) }))
        .sort((a, b) => a.os.localeCompare(b.os) || a.event.localeCompare(b.event));

    const events = [...new Set(shas.map((s) => s.event))].sort();
    const by_event = events.map((event) => {
        const own = shas.filter((s) => s.event === event);
        return {
            event,
            shas: own.length,
            all_green: stat(own.flatMap((s) => (s.time_to_all_green_s === null ? [] : [s.time_to_all_green_s]))),
            required_green: stat(
                own.flatMap((s) => (s.time_to_required_green_s === null ? [] : [s.time_to_required_green_s])),
            ),
        };
    });

    return { by_os_event, by_event, runs: runSummaries, shas, jobs };
}

/**
 * Percentiles that grew by more than `threshold` (0.25 = 25 %) against a
 * committed baseline, as one line each. Only rows present in both readings are
 * compared — a row the baseline never had is new, not a regression.
 */
export function regressions(
    baseline: Pick<Report, 'by_os_event' | 'by_event'>,
    current: Pick<Report, 'by_os_event' | 'by_event'>,
    threshold: number,
): string[] {
    const out: string[] = [];
    const check = (label: string, b: Stat, c: Stat): void => {
        for (const p of ['p50', 'p90'] as const) {
            const bv = b[p];
            const cv = c[p];
            if (bv !== null && cv !== null && bv > 0 && cv > bv * (1 + threshold)) {
                out.push(`${label} ${p}: ${String(bv)} s -> ${String(cv)} s (+${String(Math.round((cv / bv - 1) * 100))} %)`);
            }
        }
    };
    for (const c of current.by_os_event) {
        const b = baseline.by_os_event.find((r) => r.os === c.os && r.event === c.event);
        if (b === undefined) continue;
        check(`${c.os} ${c.event} queue`, b.queue, c.queue);
        check(`${c.os} ${c.event} exec`, b.exec, c.exec);
    }
    for (const c of current.by_event) {
        const b = baseline.by_event.find((r) => r.event === c.event);
        if (b === undefined) continue;
        check(`${c.event} time-to-all-green`, b.all_green, c.all_green);
        check(`${c.event} time-to-required-green`, b.required_green, c.required_green);
    }
    return out;
}

export function fmtS(s: number | null): string {
    if (s === null) {
        return '—';
    }
    const r = Math.round(s);
    if (r < 60) {
        return `${r}s`;
    }
    return `${Math.floor(r / 60)}m${String(r % 60).padStart(2, '0')}s`;
}

export function renderRunDetail(run: ApiRun, jobs: readonly ApiJob[]): string {
    const lines = [
        `### Run ${run.id} — ${run.name} (${run.event})`,
        '',
        `Span: ${fmtS(runSummary(run, jobs).span_s)}`,
        '',
        '| Job | OS | Queue | Exec |',
        '|---|---|---:|---:|',
    ];
    const timings = jobs
        .map((j) => jobTiming(j, run))
        .filter((t): t is JobTiming => t !== null)
        .sort((a, b) => a.os.localeCompare(b.os) || b.queue_s - a.queue_s);
    for (const t of timings) {
        lines.push(`| ${t.job} | ${t.os} | ${fmtS(t.queue_s)} | ${fmtS(t.exec_s)} |`);
    }
    return lines.join('\n');
}

export interface SampleNote {
    window: string;
    workflow: string;
    runs_listed: number;
    runs_with_jobs: number;
    truncated: boolean;
    reason: string | null;
}

export function renderMarkdown(report: Report, sample: SampleNote, required: readonly string[]): string {
    const lines: string[] = [
        '## CI time-to-green',
        '',
        `Window: ${sample.window} · workflow: ${sample.workflow} · runs listed: ${sample.runs_listed} · runs with jobs read: ${sample.runs_with_jobs} · jobs timed: ${report.jobs.length}`,
    ];
    if (sample.truncated) {
        lines.push('', `**Sample truncated:** ${sample.reason ?? 'unknown'}`);
    }
    lines.push(
        '',
        '### Queue and execution per job (OS × event)',
        '',
        '| OS | Event | Jobs | Queue p50 | Queue p90 | Exec p50 | Exec p90 |',
        '|---|---|---:|---:|---:|---:|---:|',
    );
    for (const r of report.by_os_event) {
        lines.push(
            `| ${r.os} | ${r.event} | ${r.queue.n} | ${fmtS(r.queue.p50)} | ${fmtS(r.queue.p90)} | ${fmtS(r.exec.p50)} | ${fmtS(r.exec.p90)} |`,
        );
    }
    lines.push(
        '',
        `### Time to green per head SHA (required = ${required.join(' · ')})`,
        '',
        '| Event | SHAs | All-green n | All-green p50 | All-green p90 | Required-green n | Required-green p50 | Required-green p90 |',
        '|---|---:|---:|---:|---:|---:|---:|---:|',
    );
    for (const r of report.by_event) {
        lines.push(
            `| ${r.event} | ${r.shas} | ${r.all_green.n} | ${fmtS(r.all_green.p50)} | ${fmtS(r.all_green.p90)} | ${r.required_green.n} | ${fmtS(r.required_green.p50)} | ${fmtS(r.required_green.p90)} |`,
        );
    }
    return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------- network shell

const execFileP = promisify(execFile);

export class RateFloorReached extends Error {}

export async function ghApi(endpoint: string, attempts = 4): Promise<unknown> {
    for (let attempt = 1; ; attempt += 1) {
        try {
            const { stdout } = await execFileP('gh', ['api', endpoint], {
                cwd: REPO_ROOT,
                maxBuffer: 256 * 1024 * 1024,
            });
            return JSON.parse(stdout);
        } catch (err) {
            const msg = String((err as { stderr?: string }).stderr ?? err);
            if (/rate limit/i.test(msg)) {
                throw new RateFloorReached(msg.trim());
            }
            // GitHub answers a share of jobs reads with 502/503 under load.
            if (attempt < attempts && /HTTP 5\d\d|timed out|ECONNRESET/i.test(msg)) {
                await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
                continue;
            }
            throw err;
        }
    }
}

export async function coreRemaining(): Promise<number> {
    const r = (await ghApi('rate_limit')) as { resources: { core: { remaining: number } } };
    return r.resources.core.remaining;
}

export async function listRuns(query: string, base: string): Promise<ApiRun[]> {
    const out: ApiRun[] = [];
    for (let page = 1; ; page += 1) {
        const sep = query === '' ? '' : `${query}&`;
        const body = (await ghApi(`${base}?${sep}per_page=100&page=${page}`)) as {
            total_count: number;
            workflow_runs: ApiRun[];
        };
        out.push(...body.workflow_runs);
        if (body.workflow_runs.length < 100 || out.length >= body.total_count) {
            return out;
        }
    }
}

export function sliceWindow(from: Date, to: Date, hours: number): Array<[string, string]> {
    const slices: Array<[string, string]> = [];
    const step = hours * 3600 * 1000;
    for (let t = from.getTime(); t < to.getTime(); t += step) {
        const end = Math.min(t + step, to.getTime()) - 1000;
        slices.push([
            new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z'),
            new Date(end).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        ]);
    }
    return slices;
}

export interface FetchJobsOptions {
    cacheDir: string | null;
    rateFloor: number;
    concurrency: number;
    filterAll?: boolean;
}

export interface FetchJobsResult {
    jobsByRun: Map<number, ApiJob[]>;
    truncated: boolean;
    reason: string | null;
}

export async function fetchJobs(runs: readonly ApiRun[], opts: FetchJobsOptions): Promise<FetchJobsResult> {
    const jobsByRun = new Map<number, ApiJob[]>();
    const filter = opts.filterAll === true ? '&filter=all' : '';
    const cachePath = (r: ApiRun): string | null =>
        opts.cacheDir === null
            ? null
            : path.join(opts.cacheDir, `jobs-${r.id}-${r.run_attempt ?? 1}${opts.filterAll === true ? '-all' : ''}.json`);

    const todo: ApiRun[] = [];
    for (const r of runs) {
        const p = cachePath(r);
        if (p !== null && fs.existsSync(p)) {
            jobsByRun.set(r.id, JSON.parse(fs.readFileSync(p, 'utf-8')) as ApiJob[]);
        } else {
            todo.push(r);
        }
    }
    if (opts.cacheDir !== null) {
        fs.mkdirSync(opts.cacheDir, { recursive: true });
    }

    let remaining = todo.length === 0 ? Infinity : await coreRemaining();
    let stop: string | null = null;
    let idx = 0;
    let sinceCheck = 0;
    const worker = async (): Promise<void> => {
        while (stop === null && idx < todo.length) {
            if (sinceCheck >= 200) {
                sinceCheck = 0;
                remaining = await coreRemaining();
            }
            if (remaining - sinceCheck <= opts.rateFloor) {
                stop = `core API rate floor (${opts.rateFloor}) reached`;
                return;
            }
            const run = todo[idx] as ApiRun;
            idx += 1;
            sinceCheck += 1;
            try {
                const jobs: ApiJob[] = [];
                for (let page = 1; ; page += 1) {
                    const body = (await ghApi(
                        `repos/${REPO}/actions/runs/${run.id}/jobs?per_page=100&page=${page}${filter}`,
                    )) as { total_count: number; jobs: ApiJob[] };
                    jobs.push(...body.jobs);
                    if (body.jobs.length < 100 || jobs.length >= body.total_count) {
                        break;
                    }
                }
                jobsByRun.set(run.id, jobs);
                const p = cachePath(run);
                if (p !== null && run.status === 'completed') {
                    fs.writeFileSync(p, JSON.stringify(jobs));
                }
            } catch (err) {
                if (err instanceof RateFloorReached) {
                    stop = `rate limited: ${err.message}`;
                    return;
                }
                throw err;
            }
        }
    };
    await Promise.all(Array.from({ length: opts.concurrency }, () => worker()));
    return { jobsByRun, truncated: stop !== null, reason: stop };
}

interface Args {
    days: number;
    sha: string | null;
    workflow: string | null;
    out: string;
    required: string[];
    cacheDir: string | null;
    rateFloor: number;
    concurrency: number;
    highlight: number[];
    baseline: string | null;
    full: boolean;
}

function parseArgs(argv: readonly string[]): Args {
    const a: Args = {
        days: 7,
        sha: null,
        workflow: null,
        out: DEFAULT_OUT_DIR,
        required: DEFAULT_REQUIRED,
        cacheDir: null,
        rateFloor: 100,
        concurrency: 6,
        highlight: [],
        baseline: null,
        full: false,
    };
    for (let i = 0; i < argv.length; i += 1) {
        const flag = argv[i];
        const val = argv[i + 1] ?? '';
        switch (flag) {
            case '--days': a.days = Number(val); i += 1; break;
            case '--sha': a.sha = val; i += 1; break;
            case '--workflow': a.workflow = val; i += 1; break;
            case '--out': a.out = path.resolve(val); i += 1; break;
            case '--required': a.required = val.split(',').map((s) => s.trim()).filter(Boolean); i += 1; break;
            case '--cache-dir': a.cacheDir = path.resolve(val); i += 1; break;
            case '--rate-floor': a.rateFloor = Number(val); i += 1; break;
            case '--concurrency': a.concurrency = Math.max(1, Number(val)); i += 1; break;
            case '--highlight-run': a.highlight.push(Number(val)); i += 1; break;
            case '--baseline': a.baseline = path.resolve(val); i += 1; break;
            case '--full': a.full = true; break;
            default:
                throw new Error(`unknown argument: ${String(flag)}`);
        }
    }
    if (!Number.isFinite(a.days) || a.days <= 0) {
        throw new Error('--days must be a positive number');
    }
    return a;
}

export async function main(argv: readonly string[]): Promise<number> {
    const args = parseArgs(argv);
    const base =
        args.workflow === null
            ? `repos/${REPO}/actions/runs`
            : `repos/${REPO}/actions/workflows/${args.workflow}/runs`;

    let runs: ApiRun[];
    let window: string;
    if (args.sha !== null) {
        runs = await listRuns(`head_sha=${args.sha}`, base);
        window = `head_sha ${args.sha}`;
    } else {
        const to = new Date();
        const from = new Date(to.getTime() - args.days * 86400 * 1000);
        runs = [];
        for (const [a, b] of sliceWindow(from, to, 6)) {
            runs.push(...(await listRuns(`created=${a}..${b}`, base)));
        }
        window = `${from.toISOString()} → ${to.toISOString()} (${args.days} d)`;
    }
    // Slice boundaries are inclusive on both ends of the API filter.
    runs = [...new Map(runs.map((r) => [r.id, r])).values()];
    // A skipped run never asked for a runner; reading its jobs buys nothing.
    const timed = runs.filter((r) => r.conclusion !== 'skipped');

    const fetched = await fetchJobs(timed, {
        cacheDir: args.cacheDir,
        rateFloor: args.rateFloor,
        concurrency: args.concurrency,
    });
    const report = computeReport(timed, fetched.jobsByRun, args.required);
    const sample: SampleNote = {
        window,
        workflow: args.workflow ?? 'all',
        runs_listed: runs.length,
        runs_with_jobs: fetched.jobsByRun.size,
        truncated: fetched.truncated,
        reason: fetched.reason,
    };

    let md = renderMarkdown(report, sample, args.required);
    for (const id of args.highlight) {
        const run = runs.find((r) => r.id === id) ?? ((await ghApi(`repos/${REPO}/actions/runs/${id}`)) as ApiRun);
        const jobs = fetched.jobsByRun.get(id) ?? (await fetchJobs([run], { cacheDir: args.cacheDir, rateFloor: 0, concurrency: 1 })).jobsByRun.get(id) ?? [];
        md += `\n${renderRunDetail(run, jobs)}\n`;
    }

    fs.mkdirSync(args.out, { recursive: true });
    const json = {
        generated_at: new Date().toISOString(),
        sample,
        required: args.required,
        by_os_event: report.by_os_event,
        by_event: report.by_event,
        // Per-SHA and per-run rows are thousands of lines; they stay out of the
        // committed reading unless asked for.
        ...(args.full ? { shas: report.shas, runs: report.runs } : {}),
    };
    if (args.baseline !== null && fs.existsSync(args.baseline)) {
        const base = JSON.parse(fs.readFileSync(args.baseline, 'utf-8')) as Pick<Report, 'by_os_event' | 'by_event'>;
        const found = regressions(base, report, 0.25);
        for (const line of found) process.stdout.write(`::warning title=CI time regression::${line}\n`);
        md += `\n## Against the baseline\n\n${found.length === 0 ? 'No percentile grew by more than 25 %.' : found.map((l) => `- ${l}`).join('\n')}\n`;
    }
    fs.writeFileSync(path.join(args.out, 'ci-time-to-green.json'), `${JSON.stringify(json, null, 2)}\n`);
    fs.writeFileSync(path.join(args.out, 'ci-time-to-green.md'), md);
    process.stdout.write(md);
    return fetched.truncated ? 3 : 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
    }
}

if (_isCliEntry()) {
    main(process.argv.slice(2)).then(
        (code) => {
            process.exitCode = code;
        },
        (err: unknown) => {
            process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
            process.exitCode = 2;
        },
    );
}

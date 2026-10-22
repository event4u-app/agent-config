#!/usr/bin/env tsx
/**
 * Per-OS failure attribution for the `Tests` workflow — the instrument ADR-223
 * trigger (a) names and never had (its own line 88).
 *
 * Question: how often does a macOS job fail while its ubuntu twin on the same
 * run attempt passes, and the other way round? Only the asymmetric cells carry
 * platform signal; a both-fail pair is a code defect both runners caught.
 *
 * Twins are paired by taking the matrix OS token out of the job name, inside one
 * run attempt: "Node Tests (macos-latest, shard 3/4)" ↔ "Node Tests
 * (ubuntu-latest, shard 3/4)". A job whose normalised name has no partner on the
 * other OS (Collector Lifecycle runs macOS only) is reported as untwinned, and a
 * job with no OS token in its name (Static Checks) is not a matrix job.
 * Jobs are read with `filter=all`, so a failed first attempt that a re-run
 * turned green is counted, not hidden — the flaky cases are exactly the ones a
 * reader needs to see to separate a repeat offender from a one-off.
 *
 * A pair with either side cancelled, skipped, or unfinished is ignored.
 *
 * The script states the number of runs it actually read and refuses to print
 * rates when that is below `--min-runs` (default 500): an API rate limit that
 * silently shrinks the sample would otherwise publish a smaller study as the
 * requested one.
 *
 * Usage:
 *   ./scripts-run src/scripts/ci_os_attribution --runs 520 --min-runs 500 \
 *       --cache-dir /tmp/ci-attr-cache [--json out.json]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    type ApiJob,
    type ApiRun,
    REPO,
    fetchJobs,
    ghApi,
} from './ci_time_to_green.js';

export type Cell = 'mac_fail_ubuntu_pass' | 'mac_pass_ubuntu_fail' | 'both_fail' | 'both_pass';
export const CELLS: readonly Cell[] = ['mac_fail_ubuntu_pass', 'mac_pass_ubuntu_fail', 'both_fail', 'both_pass'];

const OS_TOKEN = /\b(macos|ubuntu|windows)-(?:latest|\d+(?:\.\d+)?)\b/i;

export interface Normalised {
    key: string;
    os: 'macos' | 'ubuntu' | 'windows';
}

/** Null for a job whose name carries no matrix OS token. */
export function normaliseJobName(name: string): Normalised | null {
    const m = OS_TOKEN.exec(name);
    if (m === null) {
        return null;
    }
    return {
        key: name.replace(OS_TOKEN, '{os}'),
        os: (m[1] as string).toLowerCase() as Normalised['os'],
    };
}

export function classifyPair(mac: string | null, ubuntu: string | null): Cell | null {
    const decisive = (c: string | null): boolean => c === 'success' || c === 'failure';
    if (!decisive(mac) || !decisive(ubuntu)) {
        return null;
    }
    if (mac === 'failure') {
        return ubuntu === 'failure' ? 'both_fail' : 'mac_fail_ubuntu_pass';
    }
    return ubuntu === 'failure' ? 'mac_pass_ubuntu_fail' : 'both_pass';
}

export interface PairResult {
    run_id: number;
    run_attempt: number;
    key: string;
    mac_job: string;
    ubuntu_job: string;
    cell: Cell;
}

export interface UntwinnedJob {
    run_id: number;
    run_attempt: number;
    job: string;
    conclusion: string | null;
}

export interface RunPairing {
    pairs: PairResult[];
    untwinned: UntwinnedJob[];
    ignored_pairs: number;
}

export function pairRunJobs(runId: number, jobs: readonly ApiJob[]): RunPairing {
    const buckets = new Map<string, { macos?: ApiJob; ubuntu?: ApiJob; other: ApiJob[] }>();
    for (const j of jobs) {
        const n = normaliseJobName(j.name);
        if (n === null) {
            continue;
        }
        const attempt = j.run_attempt ?? 1;
        const id = `${attempt}\u0000${n.key}`;
        const b = buckets.get(id) ?? { other: [] };
        if (n.os === 'macos') {
            b.macos = j;
        } else if (n.os === 'ubuntu') {
            b.ubuntu = j;
        } else {
            b.other.push(j);
        }
        buckets.set(id, b);
    }
    const out: RunPairing = { pairs: [], untwinned: [], ignored_pairs: 0 };
    for (const [id, b] of buckets) {
        const [attemptStr, key] = id.split('\u0000') as [string, string];
        const attempt = Number(attemptStr);
        if (b.macos !== undefined && b.ubuntu !== undefined) {
            const cell = classifyPair(b.macos.conclusion, b.ubuntu.conclusion);
            if (cell === null) {
                out.ignored_pairs += 1;
                continue;
            }
            out.pairs.push({
                run_id: runId,
                run_attempt: attempt,
                key,
                mac_job: b.macos.name,
                ubuntu_job: b.ubuntu.name,
                cell,
            });
        } else {
            for (const j of [b.macos, b.ubuntu, ...b.other]) {
                if (j !== undefined) {
                    out.untwinned.push({ run_id: runId, run_attempt: attempt, job: j.name, conclusion: j.conclusion });
                }
            }
        }
    }
    return out;
}

export interface Attribution {
    runs_read: number;
    runs_with_pairs: number;
    pair_cells: Record<Cell, number>;
    run_cells: Record<Cell, number>;
    asymmetric: PairResult[];
    untwinned: Record<string, { seen: number; failed: number }>;
    ignored_pairs: number;
}

export function attribute(jobsByRun: ReadonlyMap<number, readonly ApiJob[]>): Attribution {
    const zero = (): Record<Cell, number> => ({
        mac_fail_ubuntu_pass: 0,
        mac_pass_ubuntu_fail: 0,
        both_fail: 0,
        both_pass: 0,
    });
    const a: Attribution = {
        runs_read: jobsByRun.size,
        runs_with_pairs: 0,
        pair_cells: zero(),
        run_cells: zero(),
        asymmetric: [],
        untwinned: {},
        ignored_pairs: 0,
    };
    for (const [runId, jobs] of jobsByRun) {
        const r = pairRunJobs(runId, jobs);
        a.ignored_pairs += r.ignored_pairs;
        if (r.pairs.length > 0) {
            a.runs_with_pairs += 1;
        }
        const cellsInRun = new Set<Cell>();
        for (const p of r.pairs) {
            a.pair_cells[p.cell] += 1;
            cellsInRun.add(p.cell);
            if (p.cell === 'mac_fail_ubuntu_pass' || p.cell === 'mac_pass_ubuntu_fail') {
                a.asymmetric.push(p);
            }
        }
        for (const c of cellsInRun) {
            a.run_cells[c] += 1;
        }
        for (const u of r.untwinned) {
            const key = normaliseJobName(u.job)?.key ?? u.job;
            const e = a.untwinned[key] ?? { seen: 0, failed: 0 };
            e.seen += 1;
            if (u.conclusion === 'failure') {
                e.failed += 1;
            }
            a.untwinned[key] = e;
        }
    }
    a.asymmetric.sort((x, y) => y.run_id - x.run_id);
    return a;
}

function pct(n: number, d: number): string {
    return d === 0 ? '—' : `${((100 * n) / d).toFixed(1)} %`;
}

export function renderMarkdown(a: Attribution, minRuns: number): string {
    const lines = [`Runs read: ${a.runs_read} (floor ${minRuns}) · runs with ≥1 decisive twin pair: ${a.runs_with_pairs} · pairs ignored (cancelled/skipped/unfinished side): ${a.ignored_pairs}`, ''];
    const totalPairs = CELLS.reduce((s, c) => s + a.pair_cells[c], 0);
    const showRates = a.runs_read >= minRuns;
    if (!showRates) {
        lines.push(`**Below the floor — rates withheld.** ${a.runs_read} runs read, ${minRuns} required.`, '');
    }
    lines.push('| Cell | Twin pairs | Runs with ≥1 such pair |' + (showRates ? ' Share of pairs |' : ''));
    lines.push('|---|---:|---:|' + (showRates ? '---:|' : ''));
    for (const c of CELLS) {
        lines.push(
            `| ${c} | ${a.pair_cells[c]} | ${a.run_cells[c]} |` + (showRates ? ` ${pct(a.pair_cells[c], totalPairs)} |` : ''),
        );
    }
    lines.push('', '### Asymmetric pairs', '', '| Run | Attempt | Cell | macOS job | ubuntu job |', '|---|---:|---|---|---|');
    for (const p of a.asymmetric) {
        lines.push(`| ${p.run_id} | ${p.run_attempt} | ${p.cell} | ${p.mac_job} | ${p.ubuntu_job} |`);
    }
    lines.push('', '### Untwinned matrix jobs', '', '| Job (normalised) | Seen | Failed |', '|---|---:|---:|');
    for (const [k, v] of Object.entries(a.untwinned).sort()) {
        lines.push(`| ${k} | ${v.seen} | ${v.failed} |`);
    }
    return `${lines.join('\n')}\n`;
}

interface Args {
    runs: number;
    minRuns: number;
    cacheDir: string | null;
    json: string | null;
    rateFloor: number;
    concurrency: number;
}

function parseArgs(argv: readonly string[]): Args {
    const a: Args = { runs: 520, minRuns: 500, cacheDir: null, json: null, rateFloor: 100, concurrency: 6 };
    for (let i = 0; i < argv.length; i += 1) {
        const flag = argv[i];
        const val = argv[i + 1] ?? '';
        i += 1;
        if (flag === '--runs') {
            a.runs = Number(val);
        } else if (flag === '--min-runs') {
            a.minRuns = Number(val);
        } else if (flag === '--cache-dir') {
            a.cacheDir = path.resolve(val);
        } else if (flag === '--json') {
            a.json = path.resolve(val);
        } else if (flag === '--rate-floor') {
            a.rateFloor = Number(val);
        } else if (flag === '--concurrency') {
            a.concurrency = Math.max(1, Number(val));
        } else {
            throw new Error(`unknown argument: ${String(flag)}`);
        }
    }
    return a;
}

export async function main(argv: readonly string[]): Promise<number> {
    const args = parseArgs(argv);
    const runs: ApiRun[] = [];
    for (let page = 1; runs.length < args.runs; page += 1) {
        const body = (await ghApi(
            `repos/${REPO}/actions/workflows/tests.yml/runs?status=completed&per_page=100&page=${page}`,
        )) as { workflow_runs: ApiRun[] };
        runs.push(...body.workflow_runs.filter((r) => r.conclusion !== 'skipped'));
        if (body.workflow_runs.length < 100) {
            break;
        }
    }
    const wanted = runs.slice(0, args.runs);
    const fetched = await fetchJobs(wanted, {
        cacheDir: args.cacheDir,
        rateFloor: args.rateFloor,
        concurrency: args.concurrency,
        filterAll: true,
    });
    const a = attribute(fetched.jobsByRun);
    const oldest = wanted.at(-1)?.created_at ?? '—';
    const newest = wanted[0]?.created_at ?? '—';
    let md = `## Per-OS failure attribution — Tests\n\nRuns listed: ${wanted.length} (${oldest} → ${newest})\n`;
    if (fetched.truncated) {
        md += `\n**Sample truncated:** ${fetched.reason ?? 'unknown'}\n`;
    }
    md += `\n${renderMarkdown(a, args.minRuns)}`;
    process.stdout.write(md);
    if (args.json !== null) {
        fs.mkdirSync(path.dirname(args.json), { recursive: true });
        fs.writeFileSync(
            args.json,
            `${JSON.stringify({ generated_at: new Date().toISOString(), window: { oldest, newest }, truncated: fetched.truncated, ...a }, null, 2)}\n`,
        );
    }
    return a.runs_read >= args.minRuns ? 0 : 3;
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

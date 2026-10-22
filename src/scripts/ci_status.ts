#!/usr/bin/env node
/**
 * Wrap `gh run list` and assert the required-check set is green.
 *
 * Ported from the retired Python `src/scripts/ci_status.py` (ADR-089, Phase 8 /
 * Wave 8b). The public surface, CLI contract, exit codes, stdout/stderr
 * split, and rendered text mirror the retired Python implementation EXACTLY — same
 * `REQUIRED_CHECKS_BY_SHAPE` dict, same `Run` record shape, same phantom
 * 0-job filter, same lazy run-id resolution + cache, same `--json` /
 * human-readable output, same byte-for-byte messages. No behaviour
 * changes — latent quirks (e.g. dropping `databaseId` from the first
 * `gh run list` and refetching it lazily) are replicated.
 *
 * Phase A Step 6 of `road-to-adoption-proof-and-ci-green.md`.
 *
 * Exit codes:
 *   0 — every required check on the most recent run is success.
 *   1 — at least one required-check workflow is red.
 *   2 — invalid arguments / unreachable gh CLI.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Source-of-truth for the per-shape required-check set. Anchored to
 * the matrix in docs/contracts/branch-protection-policy.md § Per-PR-shape
 * required-check matrix.
 *
 * Represented as string arrays here; the retired Python implementation uses `set[str]`.
 * Set semantics are reproduced with helper functions where order matters
 * (`sorted(required)`).
 */
export const REQUIRED_CHECKS_BY_SHAPE: Record<string, Set<string>> = {
    feature: new Set([
        'Consistency',
        'Smoke Contracts',
        'Skill Lint',
        'Tests',
        'Public Install Smoke',
    ]),
    release: new Set(['Consistency', 'Smoke Contracts', 'Release Validation']),
    docs: new Set(['Consistency', 'Smoke Contracts']),
};

/** Frozen Run record — mirrors the Python `@dataclass(frozen=True)`. */
export interface Run {
    readonly name: string;
    readonly conclusion: string;
    readonly status: string;
    readonly jobs: number;
}

export function Run(name: string, conclusion: string, status: string, jobs: number): Run {
    return { name, conclusion, status, jobs };
}

/** SystemExit equivalent — carries the exit message for the CLI boundary. */
export class SystemExit extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SystemExit';
    }
}

/** Python-string ordering (codepoint), for `sorted(...)` parity. */
function pySorted(values: Iterable<string>): string[] {
    return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function _which(cmd: string): boolean {
    const probe = process.platform === 'win32' ? 'where' : 'which';
    return spawnSync(probe, [cmd], { encoding: 'utf-8' }).status === 0;
}

/** Call `gh run list` and return parsed Run records. */
export function fetch_runs(branch: string, limit: number): Run[] {
    if (!_which('gh')) {
        throw new SystemExit('error: gh CLI not found in PATH');
    }
    const cmd = [
        'run',
        'list',
        '--branch',
        branch,
        '--limit',
        String(limit),
        '--json',
        'databaseId,name,status,conclusion',
    ];
    const proc = spawnSync('gh', cmd, { encoding: 'utf-8' });
    if (proc.status !== 0) {
        const stderr = (proc.stderr ?? '').trim();
        throw new SystemExit(`error: gh run list failed — ${stderr}`);
    }
    const raw = JSON.parse(proc.stdout || '[]') as Array<Record<string, unknown>>;
    const runs: Run[] = [];
    for (const r of raw) {
        runs.push(
            Run(
                (r['name'] as string) ?? '',
                (r['conclusion'] as string) ?? '',
                (r['status'] as string) ?? '',
                -1, // unknown — resolved lazily for non-success runs
            ),
        );
    }
    return runs;
}

/** Return the number of jobs for a single run id (for phantom filter). */
export function resolve_jobs_count(run_id: number): number {
    const cmd = ['run', 'view', String(run_id), '--json', 'jobs'];
    const proc = spawnSync('gh', cmd, { encoding: 'utf-8' });
    if (proc.status !== 0) {
        return -1;
    }
    const data = JSON.parse(proc.stdout || '{}') as Record<string, unknown>;
    const jobs = data['jobs'];
    return Array.isArray(jobs) ? jobs.length : 0;
}

/** True when the run has 0 jobs AND its conclusion is `failure`. */
export function is_phantom(run: Run): boolean {
    if (run.conclusion !== 'failure') {
        return false;
    }
    if (run.jobs === 0) {
        return true;
    }
    return false;
}

/** Pick the latest run per workflow name (input order is mtime-desc). */
export function latest_per_workflow(runs: Run[]): Map<string, Run> {
    const out = new Map<string, Run>();
    for (const r of runs) {
        if (out.has(r.name)) {
            continue;
        }
        if (r.status !== 'completed') {
            // In-progress / queued runs are pending; treat as unknown.
            continue;
        }
        out.set(r.name, r);
    }
    return out;
}

// Cache for the lazy run-id lookup; keyed by workflow name + conclusion.
const _RUN_ID_CACHE = new Map<string, number | null>();

function _cacheKey(name: string, conclusion: string): string {
    return `${name}\0${conclusion}`;
}

/** Test seam: clear the lazy run-id cache (no Python analog needed). */
export function _clearRunIdCache(): void {
    _RUN_ID_CACHE.clear();
}

/** Refetch the latest run id for a workflow whose top-of-list run is non-success. */
export function _latest_run_id_for_workflow(name: string, run: Run): number | null {
    const key = _cacheKey(name, run.conclusion);
    if (_RUN_ID_CACHE.has(key)) {
        return _RUN_ID_CACHE.get(key) ?? null;
    }
    const cmd = ['run', 'list', '--workflow', name, '--limit', '1', '--json', 'databaseId'];
    const proc = spawnSync('gh', cmd, { encoding: 'utf-8' });
    if (proc.status !== 0) {
        _RUN_ID_CACHE.set(key, null);
        return null;
    }
    const data = JSON.parse(proc.stdout || '[]') as Array<Record<string, unknown>>;
    if (!data.length) {
        _RUN_ID_CACHE.set(key, null);
        return null;
    }
    const first = data[0] as Record<string, unknown>;
    const rid = Math.trunc((first['databaseId'] as number) ?? 0) || null;
    _RUN_ID_CACHE.set(key, rid);
    return rid;
}

/** Return [greens, missing, reds-after-phantom-filter]. */
export function compute_status(
    runs: Run[],
    required: Set<string>,
    resolve_jobs = true,
): [Array<[string, Run]>, string[], Array<[string, Run]>] {
    const byName = latest_per_workflow(runs);
    const greens: Array<[string, Run]> = [];
    const reds: Array<[string, Run]> = [];
    const missing: string[] = [];
    for (const name of pySorted(required)) {
        let run = byName.get(name);
        if (run === undefined) {
            missing.push(name);
            continue;
        }
        if (run.conclusion === 'success') {
            greens.push([name, run]);
            continue;
        }
        // Non-success — check for phantom 0-job.
        if (resolve_jobs && run.jobs < 0) {
            const runId = _latest_run_id_for_workflow(name, run);
            const jobsCount = runId ? resolve_jobs_count(runId) : -1;
            run = Run(run.name, run.conclusion, run.status, jobsCount);
        }
        if (is_phantom(run)) {
            greens.push([name, run]);
        } else {
            reds.push([name, run]);
        }
    }
    return [greens, missing, reds];
}

interface ParsedArgs {
    branch: string;
    limit: number;
    shape: 'feature' | 'release' | 'docs';
    strict: boolean;
    json: boolean;
    no_phantom_resolve: boolean;
}

export function parse_args(argv: string[] | null = null): ParsedArgs {
    const args = argv ?? process.argv.slice(2);
    const out: ParsedArgs = {
        branch: 'main',
        limit: 30,
        shape: 'feature',
        strict: false,
        json: false,
        no_phantom_resolve: false,
    };
    const fail = (msg: string): never => {
        process.stderr.write(`ci_status: error: ${msg}\n`);
        process.exit(2);
    };
    for (let i = 0; i < args.length; i++) {
        const a = args[i] as string;
        if (a === '--branch') {
            const v = args[++i];
            if (v === undefined) fail('argument --branch: expected one argument');
            out.branch = v as string;
        } else if (a.startsWith('--branch=')) {
            out.branch = a.slice('--branch='.length);
        } else if (a === '--limit') {
            const v = args[++i];
            if (v === undefined) fail('argument --limit: expected one argument');
            out.limit = Number.parseInt(v as string, 10);
        } else if (a.startsWith('--limit=')) {
            out.limit = Number.parseInt(a.slice('--limit='.length), 10);
        } else if (a === '--shape') {
            const v = args[++i];
            if (v === undefined) fail('argument --shape: expected one argument');
            out.shape = v as ParsedArgs['shape'];
        } else if (a.startsWith('--shape=')) {
            out.shape = a.slice('--shape='.length) as ParsedArgs['shape'];
        } else if (a === '--strict') {
            out.strict = true;
        } else if (a === '--json') {
            out.json = true;
        } else if (a === '--no-phantom-resolve') {
            out.no_phantom_resolve = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: ci_status [-h] [--branch BRANCH] [--limit LIMIT]\n' +
                    '                 [--shape {feature,release,docs}] [--strict] [--json]\n' +
                    '                 [--no-phantom-resolve]\n',
            );
            process.exit(0);
        } else {
            fail(`unrecognized arguments: ${a}`);
        }
    }
    if (!['feature', 'release', 'docs'].includes(out.shape)) {
        fail(
            `argument --shape: invalid choice: '${out.shape}' ` +
                `(choose from 'feature', 'release', 'docs')`,
        );
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv);
    const required = REQUIRED_CHECKS_BY_SHAPE[args.shape] as Set<string>;
    const runs = fetch_runs(args.branch, args.limit);
    const [greens, missing, reds] = compute_status(runs, required, !args.no_phantom_resolve);

    if (args.json) {
        const out = {
            branch: args.branch,
            shape: args.shape,
            required: pySorted(required),
            green: greens.map(([name]) => name),
            missing,
            red: reds.map(([name, run]) => ({ name, conclusion: run.conclusion })),
        };
        process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    } else {
        process.stdout.write(`branch=${args.branch} shape=${args.shape} required=${required.size}\n`);
        for (const [name] of greens) {
            process.stdout.write(`  ✅  ${name}\n`);
        }
        for (const name of missing) {
            process.stdout.write(`  ⚠️   ${name} — no run found on this branch (last ${args.limit})\n`);
        }
        for (const [name, run] of reds) {
            process.stdout.write(`  ❌  ${name} — ${run.conclusion}\n`);
        }
    }

    if (reds.length) {
        return 1;
    }
    if (args.strict && missing.length) {
        return 1;
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // Symlinked temp dirs (e.g. macOS /var → /private/var) make the raw URLs
    // differ; compare realpaths so the entry guard still fires.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1] as string));
        return here === argv;
    } catch {
        return false;
    }
}
if (_isCliEntry()) {
    try {
        process.exitCode = main();
    } catch (err) {
        if (err instanceof SystemExit) {
            // Python `raise SystemExit("error: ...")` prints to stderr, exit 1.
            process.stderr.write(`${err.message}\n`);
            process.exitCode = 1;
        } else {
            throw err;
        }
    }
}

#!/usr/bin/env tsx
/**
 * import_trigger_eval_rotation — record live rotation passes as freshness.
 *
 * Reads the `trigger-eval-rotation` artifacts of the weekly cross-model canary
 * (`.github/workflows/cross-model-canary.yml`) and writes one record per suite
 * that passed its floors into the freshness ledger
 * (`_lib/trigger_eval_freshness.ts`), which `check_trigger_evals` accepts as a
 * measurement date. Nothing is estimated here: a suite is recorded only from a
 * live result (`router` is not `mock`, tokens were spent) that passed the same
 * floors the rotation enforces (`judge_suite`).
 *
 * A record names the git blob of `triggers.json` at the run's commit, so it
 * vouches for exactly the cases that ran. A newer failing run of a suite
 * removes its record: the latest measurement decides.
 *
 * Usage: import_trigger_eval_rotation [--runs N] [--local] [--dry-run]
 *   --runs N    newest N scheduled / dispatched canary runs on main (default 20)
 *   --local     import local live runs instead (`task test-triggers-live`,
 *               `internal/evals/results/*.json`). A local result counts only
 *               when its corpus is committed, unmodified, and was last
 *               committed before the run started — otherwise nobody can say
 *               which cases it measured.
 *   --dry-run   print the changes, do not write the ledger
 *
 * Exit codes: 0 ok · 2 usage / gh / git error.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    type FreshnessLedger,
    git_blob_sha,
    read_freshness_ledger,
    write_freshness_ledger,
} from './_lib/trigger_eval_freshness.js';
import { judge_suite } from './trigger_eval_rotation.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOW = 'cross-model-canary.yml';
const ARTIFACT = 'trigger-eval-rotation';

export interface RotationResultFile {
    skill: string;
    model: string;
    timestamp: string;
    router: string;
    metrics: { precision: number; recall: number };
    input_tokens: number;
    output_tokens: number;
}

export interface RotationRun {
    runId: string;
    /** What `blobAt` resolves against: the commit for a CI run, the start time for a local one. */
    ref: string;
    results: RotationResultFile[];
}

export interface ImportChange {
    skill: string;
    action: 'recorded' | 'removed';
    date: string;
    runId: string;
}

/**
 * Apply `runs` to `ledger` in place. `blobAt(ref, skill)` returns the blob id
 * of the `triggers.json` the run measured, or null when that cannot be shown.
 */
export function apply_runs(
    ledger: FreshnessLedger,
    runs: readonly RotationRun[],
    blobAt: (ref: string, skill: string) => string | null,
    skillExists: (skill: string) => boolean,
): ImportChange[] {
    const changes: ImportChange[] = [];
    const ordered = runs
        .flatMap((run) => run.results.map((r) => ({ run, r, date: r.timestamp.slice(0, 10) })))
        .filter(({ r, date }) => r.router !== 'mock' && /^\d{4}-\d{2}-\d{2}$/.test(date))
        .sort((a, b) => (a.r.timestamp < b.r.timestamp ? -1 : a.r.timestamp > b.r.timestamp ? 1 : 0));
    for (const { run, r, date } of ordered) {
        if (!skillExists(r.skill)) continue;
        const current = ledger.suites[r.skill];
        if (current && current.date > date) continue;
        const { passed } = judge_suite(r);
        if (!passed) {
            if (current) {
                delete ledger.suites[r.skill];
                changes.push({ skill: r.skill, action: 'removed', date, runId: run.runId });
            }
            continue;
        }
        const blob = blobAt(run.ref, r.skill);
        if (blob === null) continue;
        ledger.suites[r.skill] = {
            date,
            blob,
            run_id: run.runId,
            model: r.model,
            precision: r.metrics.precision,
            recall: r.metrics.recall,
        };
        changes.push({ skill: r.skill, action: 'recorded', date, runId: run.runId });
    }
    return changes;
}

function run(cmd: string, args: string[]): string {
    return execFileSync(cmd, args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function list_runs(limit: number): Array<{ databaseId: number; headSha: string; event: string }> {
    const out = run('gh', [
        'run', 'list', '--workflow', WORKFLOW, '--branch', 'main', '--limit', String(limit * 3),
        '--json', 'databaseId,headSha,event,status',
    ]);
    return (JSON.parse(out) as Array<{ databaseId: number; headSha: string; event: string; status: string }>)
        .filter((r) => r.status === 'completed' && (r.event === 'schedule' || r.event === 'workflow_dispatch'))
        .slice(0, limit);
}

function download_results(runId: number): RotationResultFile[] {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rotation-'));
    try {
        try {
            run('gh', ['run', 'download', String(runId), '-n', ARTIFACT, '-D', dir]);
        } catch {
            return [];
        }
        return fs
            .readdirSync(dir)
            .filter((f) => f.endsWith('.json'))
            .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as RotationResultFile)
            .filter((r) => typeof r.skill === 'string' && typeof r.timestamp === 'string' && r.metrics);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function blob_at(sha: string, skill: string): string | null {
    try {
        run('git', ['cat-file', '-e', `${sha}^{commit}`]);
    } catch {
        run('git', ['fetch', '--quiet', 'origin', sha]);
    }
    try {
        return run('git', ['rev-parse', `${sha}:src/skills/${skill}/evals/triggers.json`]).trim();
    } catch {
        return null;
    }
}

const LOCAL_RESULTS_DIR = path.join(REPO_ROOT, 'internal', 'evals', 'results');

function local_results(): RotationResultFile[] {
    let names: string[];
    try {
        names = fs.readdirSync(LOCAL_RESULTS_DIR);
    } catch {
        return [];
    }
    return names
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(fs.readFileSync(path.join(LOCAL_RESULTS_DIR, f), 'utf-8')) as RotationResultFile)
        .filter((r) => typeof r.skill === 'string' && typeof r.timestamp === 'string' && r.metrics);
}

/** Blob of a corpus as committed at HEAD, when the local run provably measured it. */
function local_blob(skill: string, startedAt: string): string | null {
    const rel = `src/skills/${skill}/evals/triggers.json`;
    let headBlob: string;
    let committedAt: string;
    try {
        headBlob = run('git', ['rev-parse', `HEAD:${rel}`]).trim();
        committedAt = run('git', ['log', '-1', '--format=%cI', 'HEAD', '--', rel]).trim();
    } catch {
        return null;
    }
    if (git_blob_sha(fs.readFileSync(path.join(REPO_ROOT, rel))) !== headBlob) return null;
    if (!committedAt || Date.parse(committedAt) > Date.parse(startedAt)) return null;
    return headBlob;
}

interface Args {
    runs: number;
    local: boolean;
    dryRun: boolean;
}

function parse_args(argv: readonly string[]): Args {
    let runs = 20;
    let local = false;
    let dryRun = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!;
        if (a === '--runs') {
            runs = Number(argv[++i]);
            if (!Number.isInteger(runs) || runs < 1) throw new Error('--runs needs a positive integer');
        } else if (a === '--local') {
            local = true;
        } else if (a === '--dry-run') {
            dryRun = true;
        } else {
            throw new Error(`unknown argument: ${a}`);
        }
    }
    return { runs, local, dryRun };
}

export function main(argv: readonly string[]): number {
    let args: Args;
    try {
        args = parse_args(argv);
    } catch (exc) {
        process.stderr.write(`❌ import-trigger-eval-rotation: ${(exc as Error).message}\n`);
        return 2;
    }
    try {
        const ledger = read_freshness_ledger(REPO_ROOT);
        const exists = (skill: string): boolean =>
            fs.existsSync(path.join(REPO_ROOT, 'src', 'skills', skill, 'evals', 'triggers.json'));
        let runs: RotationRun[];
        let changes: ImportChange[];
        if (args.local) {
            runs = local_results().map((r) => ({ runId: 'local', ref: r.timestamp, results: [r] }));
            changes = apply_runs(ledger, runs, (startedAt, skill) => local_blob(skill, startedAt), exists);
        } else {
            runs = list_runs(args.runs).map((r) => ({
                runId: String(r.databaseId),
                ref: r.headSha,
                results: download_results(r.databaseId),
            }));
            changes = apply_runs(ledger, runs, blob_at, exists);
        }
        const withResults = runs.filter((r) => r.results.length > 0).length;
        for (const c of changes) {
            process.stdout.write(`   ${c.action === 'recorded' ? '+' : '-'} ${c.skill} · ${c.date} · run ${c.runId}\n`);
        }
        if (!args.dryRun) write_freshness_ledger(REPO_ROOT, ledger);
        process.stdout.write(
            `✅ import-trigger-eval-rotation: ${String(withResults)}/${String(runs.length)} run(s) with results · ` +
                `${String(changes.filter((c) => c.action === 'recorded').length)} recorded · ` +
                `${String(changes.filter((c) => c.action === 'removed').length)} removed · ` +
                `${String(Object.keys(ledger.suites).length)} suite(s) in the ledger` +
                `${args.dryRun ? ' · DRY-RUN, nothing written' : ''}\n`,
        );
        return 0;
    } catch (exc) {
        process.stderr.write(`❌ import-trigger-eval-rotation: ${(exc as Error).message}\n`);
        return 2;
    }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main(process.argv.slice(2)));
}

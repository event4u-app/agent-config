#!/usr/bin/env tsx
/**
 * Release-adjacent workflow health tripwire — road-to-proof-under-real-conditions
 * Phase 1. The "red for five releases without anyone noticing" detector:
 * the MCP worker deploy failed on every release from one minor line to the
 * next and nothing surfaced it, because post-tag workflows are nobody's PR.
 *
 * For each watched workflow, look at its most recent COMPLETED run on the
 * default branch (any trigger). If that run's conclusion is not `success`
 * and it finished more than --max-red-hours ago (default 48) with no newer
 * successful run, the workflow counts as durably red → exit 1 and print a
 * GitHub error annotation per offender. The calling workflow turns that
 * into a visible failure on main.
 *
 * Auth: GITHUB_TOKEN (or GH_TOKEN) env. Repo: GITHUB_REPOSITORY env or
 * --repo owner/name.
 *
 * Exit codes: 0 all green/absent · 1 durably-red workflow(s) · 2 usage/env.
 */

import * as path from 'node:path';
import { argv, env, exit } from 'node:process';
import { fileURLToPath } from 'node:url';

import { asOfMs } from './_lib/as_of.js';
import { assertWatchlistResolves, DeadScopeError } from './_lib/scan_scope.js';

// src/scripts/check_release_adjacent_health.ts → two levels up is the repo root.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const WATCHED = [
    'publish-npm.yml',
    'deploy-mcp-worker.yml',
    'deploy-site.yml',
    'site.yml',
    'consumer-matrix.yml',
    'release.yml',
] as const;

interface RunInfo {
    conclusion: string | null;
    updated_at: string;
    html_url: string;
}

async function latestCompletedRun(
    repo: string,
    token: string,
    workflow: string,
    branch: string,
): Promise<RunInfo | null> {
    const url =
        `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/runs` +
        `?status=completed&per_page=1${branch ? `&branch=${branch}` : ''}`;
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });
    if (res.status === 404) return null; // workflow not present (yet)
    if (!res.ok) throw new Error(`GitHub API ${res.status} for ${workflow}: ${await res.text()}`);
    const body = (await res.json()) as { workflow_runs?: RunInfo[] };
    return body.workflow_runs?.[0] ?? null;
}

async function main(): Promise<number> {
    const args = argv.slice(2);
    const getOpt = (flag: string): string | undefined => {
        const i = args.indexOf(flag);
        return i >= 0 ? args[i + 1] : undefined;
    };
    const token = env.GITHUB_TOKEN ?? env.GH_TOKEN ?? '';
    const repo = getOpt('--repo') ?? env.GITHUB_REPOSITORY ?? '';
    const maxRedHours = Number(getOpt('--max-red-hours') ?? '48');
    if (!token || !repo) {
        process.stderr.write('❌  release-adjacent-health: GITHUB_TOKEN and GITHUB_REPOSITORY (or --repo) required.\n');
        return 2;
    }

    // The scope is the watch list itself. A renamed or deleted workflow answers
    // 404 → the loop logs "no completed runs (or workflow absent) — skipping"
    // and continues, so a fully stale WATCHED list still prints "✅ healthy" —
    // the same silent-tripwire failure this gate exists to detect. Checking the
    // names against `.github/workflows/` catches the rename locally, before the
    // API can launder it into a skip. Exit 2 (usage/env) over 1 (durably red):
    // a phantom watch list means the tripwire could not run.
    try {
        assertWatchlistResolves({
            gate: 'check_release_adjacent_health',
            candidates: WATCHED.map((wf) => `.github/workflows/${wf}`),
            repoRoot: REPO,
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    // Tag/release-triggered workflows have no branch association — query
    // without the branch filter for those; branch-scoped for PR/push ones.
    const branchless = new Set(['publish-npm.yml', 'deploy-mcp-worker.yml', 'release.yml']);
    let red = 0;
    for (const wf of WATCHED) {
        let run: RunInfo | null;
        try {
            run = await latestCompletedRun(repo, token, wf, branchless.has(wf) ? '' : 'main');
        } catch (err) {
            process.stderr.write(`⚠️  ${wf}: ${(err as Error).message}\n`);
            continue; // transient API failure must not fake a red
        }
        if (!run) {
            process.stderr.write(`·   ${wf}: no completed runs (or workflow absent) — skipping\n`);
            continue;
        }
        if (run.conclusion === 'success') {
            process.stderr.write(`✅  ${wf}: last completed run green\n`);
            continue;
        }
        const ageHours = (asOfMs() - Date.parse(run.updated_at)) / 3_600_000;
        if (ageHours >= maxRedHours) {
            process.stdout.write(
                `::error::release-adjacent workflow durably red: ${wf} — last completed run ` +
                    `'${run.conclusion}' ${ageHours.toFixed(0)}h ago with no newer success. ${run.html_url}\n`,
            );
            red += 1;
        } else {
            process.stderr.write(
                `⚠️  ${wf}: last run '${run.conclusion}' ${ageHours.toFixed(0)}h ago (< ${maxRedHours}h window)\n`,
            );
        }
    }
    if (red > 0) {
        process.stderr.write(`❌  ${red} release-adjacent workflow(s) durably red.\n`);
        return 1;
    }
    process.stderr.write('✅  release-adjacent workflows healthy.\n');
    return 0;
}

main().then(
    (code) => exit(code),
    (err) => {
        process.stderr.write(`❌  release-adjacent-health crashed: ${(err as Error).stack ?? err}\n`);
        exit(2);
    },
);

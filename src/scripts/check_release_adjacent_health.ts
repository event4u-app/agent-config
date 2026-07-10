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

import { argv, env, exit } from 'node:process';

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
        const ageHours = (Date.now() - Date.parse(run.updated_at)) / 3_600_000;
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

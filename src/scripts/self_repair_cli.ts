#!/usr/bin/env node
/**
 * Self-repair CLI — the queue reader and the single gated outward step.
 *
 *   self-repair:status                 list open records
 *   self-repair:release <fp> [--dry-run] [--repo <owner/name>]
 *
 * `release` is the ONE keystroke the loop is designed around: everything up to
 * it — detection, dedup, analysis, the authored fix, the commit — happens
 * without the user. Publishing does not, because a push and a PR/issue are
 * both Hard-Floor actions under `non-destructive-by-default`, and no standing
 * instruction lifts that floor. Running this command IS the user's word.
 *
 * Route selection follows the spec exactly: a pull request when the fix can be
 * authored and pushed — directly when the pre-flight probe shows upstream push
 * rights, via fork → cross-repo PR when it does not — an issue when it cannot,
 * and a local record when nothing can leave the machine. Once publishing was
 * authorized, failures degrade down the ladder WITHIN the same call (push/PR
 * failure or 30 s timeout → issue; issue failure → the record stays open with
 * the errors attached) — degrading never widens what leaves the machine, only
 * the vehicle. `--dry-run` prints the resolved route and the rendered body and
 * touches no network — that is the path the tests drive.
 *
 * Fail-closed on privacy: the record's own text goes through the audited
 * privacy floor before anything leaves the machine, and a refusal downgrades
 * the record to local-only rather than scrubbing it into publishable shape.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    chooseEgress,
    type DefectRecord,
    type EgressCapability,
    type EgressRoute,
    egressBlockedReason,
    type PushVia,
    renderReport,
    sanitizeEvidence,
} from './_lib/self_repair.js';
import {
    attachReleaseErrors,
    listRecords,
    markReleased,
    openRecords,
    readRecord,
} from './_lib/self_repair_store.js';

export const UPSTREAM_REPO = 'event4u-app/agent-config';

/**
 * Per-step ceiling for every network-touching egress step. A hung `git push`
 * or `gh` call degrades down the ladder instead of hanging the release.
 */
export const EGRESS_STEP_TIMEOUT_MS = 30_000;

const EXIT_OK = 0;
const EXIT_FAIL = 1;

/** Probe result for one machine — injectable so tests never shell out. */
export interface Probe {
    agentConfigCheckout: string | null;
    ghAuthenticated: boolean;
    canPushUpstream: boolean;
    canFork: boolean;
}

export interface RunResult {
    ok: boolean;
    out: string;
    timedOut: boolean;
}

/** Injectable command runner — tests script it, production shells out. */
export type Runner = (cmd: string, args: string[], cwd?: string) => RunResult;

function run(cmd: string, args: string[], cwd?: string): RunResult {
    const r = spawnSync(cmd, args, { cwd, encoding: 'utf-8', timeout: EGRESS_STEP_TIMEOUT_MS });
    const timedOut =
        (r.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT' ||
        r.signal === 'SIGTERM';
    return {
        ok: r.status === 0 && !timedOut,
        out: `${r.stdout ?? ''}${r.stderr ?? ''}`,
        timedOut,
    };
}

/**
 * Where the fix can be authored. `AGENT_CONFIG_SOURCE` wins; otherwise the CWD
 * when it IS the package checkout. A consumer project has neither — that is the
 * normal case, and the reason the issue fallback exists.
 */
export function findAgentConfigCheckout(env: NodeJS.ProcessEnv, cwd: string): string | null {
    const explicit = env['AGENT_CONFIG_SOURCE'];
    if (explicit && fs.existsSync(path.join(explicit, 'src', 'rules'))) {
        return explicit;
    }
    if (
        fs.existsSync(path.join(cwd, 'src', 'rules')) &&
        fs.existsSync(path.join(cwd, 'src', 'scripts', 'hook_manifest.yaml'))
    ) {
        return cwd;
    }
    return null;
}

/**
 * Pre-flight probe of ACTUAL push rights, not remote existence. `git remote`
 * returning a name proves only that the repo was cloned — every consumer of
 * the public repo has that and no write access. `gh api repos/<repo>` returns
 * the authenticated viewer's `permissions.push` and the repo's `allow_forking`,
 * which are the two facts the route actually depends on. An unreachable or
 * unauthenticated API answers `false` for both — the ladder then degrades to
 * an issue rather than failing at push time.
 */
export function probeUpstreamRights(
    runner: Runner,
    repo: string,
): { canPushUpstream: boolean; canFork: boolean } {
    const r = runner('gh', ['api', `repos/${repo}`]);
    if (!r.ok) {
        return { canPushUpstream: false, canFork: false };
    }
    try {
        const parsed: unknown = JSON.parse(r.out);
        const meta = parsed as {
            permissions?: { push?: boolean };
            allow_forking?: boolean;
        };
        return {
            canPushUpstream: meta.permissions?.push === true,
            canFork: meta.allow_forking !== false,
        };
    } catch {
        return { canPushUpstream: false, canFork: false };
    }
}

export function probeMachine(
    env: NodeJS.ProcessEnv,
    cwd: string,
    runner: Runner = run,
    repo: string = UPSTREAM_REPO,
): Probe {
    const checkout = findAgentConfigCheckout(env, cwd);
    const gh = runner('gh', ['auth', 'status']);
    const rights = gh.ok
        ? probeUpstreamRights(runner, repo)
        : { canPushUpstream: false, canFork: false };
    return {
        agentConfigCheckout: checkout,
        ghAuthenticated: gh.ok,
        canPushUpstream: rights.canPushUpstream,
        canFork: gh.ok && rights.canFork,
    };
}

export function capabilityOf(probe: Probe): EgressCapability {
    return {
        hasAgentConfigCheckout: probe.agentConfigCheckout !== null,
        ghAuthenticated: probe.ghAuthenticated,
        canPushUpstream: probe.canPushUpstream,
        canFork: probe.canFork,
    };
}

/** Title line for the PR / issue — one per defect class, stable across reruns. */
export function titleFor(record: DefectRecord): string {
    return `fix(self-repair): ${record.defect_class} — ${record.occurrences}x observed`;
}

export interface ReleasePlan {
    route: EgressRoute;
    pushVia: PushVia | null;
    blocked: string | null;
    title: string;
    body: string;
}

/** Pure: everything `release` decides before it touches the network. */
export function planRelease(record: DefectRecord, probe: Probe, repoRoot: string): ReleasePlan {
    const blocked = egressBlockedReason(record, repoRoot);
    const choice =
        blocked !== null
            ? { route: 'local-only' as const, pushVia: null }
            : chooseEgress(capabilityOf(probe));
    return {
        route: choice.route,
        pushVia: choice.pushVia,
        blocked,
        title: titleFor(record),
        body: renderReport(record, choice.route),
    };
}

// ── egress ladder execution ────────────────────────────────────────

/** One egress step's outcome — kept for the record when the ladder exhausts. */
export interface EgressAttempt {
    step: string;
    ok: boolean;
    detail: string;
}

export interface ReleaseOutcome {
    /** What actually got published, or null when the whole ladder failed. */
    published: 'pull-request' | 'issue' | null;
    attempts: EgressAttempt[];
}

export interface ReleaseDeps {
    runner: Runner;
    now: () => string;
}

const FORK_REMOTE = 'self-repair-fork';

function failDetail(step: string, r: RunResult): string {
    return r.timedOut
        ? `${step}: timed out after ${EGRESS_STEP_TIMEOUT_MS / 1000}s`
        : `${step}: ${r.out.trim() || 'failed'}`;
}

/**
 * Push the fix branch — directly, or via fork → cross-repo PR — then open the
 * PR. Returns null on success; on any step failure or timeout returns the
 * failed attempt so the caller degrades down the ladder.
 */
function tryPullRequest(
    plan: ReleasePlan,
    probe: Probe,
    repo: string,
    branch: string,
    via: PushVia,
    deps: ReleaseDeps,
): EgressAttempt | null {
    const checkout = probe.agentConfigCheckout!;
    let prHead: string | null = null;

    if (via === 'upstream') {
        const pushed = deps.runner('git', ['push', '-u', 'origin', branch], checkout);
        if (!pushed.ok) {
            return { step: 'push-upstream', ok: false, detail: failDetail('push-upstream', pushed) };
        }
    } else {
        const forked = deps.runner('gh', ['repo', 'fork', repo, '--clone=false']);
        if (!forked.ok) {
            return { step: 'fork-ensure', ok: false, detail: failDetail('fork-ensure', forked) };
        }
        const who = deps.runner('gh', ['api', 'user', '--jq', '.login']);
        if (!who.ok || who.out.trim().length === 0) {
            return { step: 'whoami', ok: false, detail: failDetail('whoami', who) };
        }
        const login = who.out.trim();
        const repoName = repo.split('/')[1] ?? repo;
        const hasRemote = deps.runner('git', ['remote', 'get-url', FORK_REMOTE], checkout);
        if (!hasRemote.ok) {
            const added = deps.runner(
                'git',
                ['remote', 'add', FORK_REMOTE, `https://github.com/${login}/${repoName}.git`],
                checkout,
            );
            if (!added.ok) {
                return { step: 'fork-remote', ok: false, detail: failDetail('fork-remote', added) };
            }
        }
        const pushed = deps.runner('git', ['push', '-u', FORK_REMOTE, branch], checkout);
        if (!pushed.ok) {
            return { step: 'push-fork', ok: false, detail: failDetail('push-fork', pushed) };
        }
        prHead = `${login}:${branch}`;
    }

    const prArgs = ['pr', 'create', '--repo', repo, '--title', plan.title, '--body', plan.body];
    if (prHead !== null) {
        prArgs.push('--head', prHead);
    }
    const pr = deps.runner('gh', prArgs, checkout);
    if (!pr.ok) {
        return { step: 'pr-create', ok: false, detail: failDetail('pr-create', pr) };
    }
    process.stdout.write(`${pr.out}`);
    return null;
}

/**
 * The egress ladder, executed within ONE `release` call: direct push → fork
 * push → issue → open-with-errors. Every rung is separately timed out; a rung
 * that fails degrades to the next instead of aborting the release. When the
 * whole ladder fails, the record stays `open` with every failed attempt
 * attached (sanitized — command output can carry local paths).
 */
export function executeRelease(
    plan: ReleasePlan,
    probe: Probe,
    repo: string,
    deps: ReleaseDeps,
): ReleaseOutcome {
    const attempts: EgressAttempt[] = [];

    if (plan.route === 'pull-request') {
        const checkout = probe.agentConfigCheckout!;
        const branch = deps.runner('git', ['branch', '--show-current'], checkout).out.trim();
        if (!branch || branch === 'main') {
            // Precondition, not an egress failure: the authored fix exists and
            // must ride its own branch — an issue instead would drop the fix.
            attempts.push({
                step: 'branch-check',
                ok: false,
                detail:
                    'the fix must sit on its own branch in the agent-config checkout ' +
                    `(currently: ${branch || 'detached'})`,
            });
            return { published: null, attempts };
        }
        const ladder: PushVia[] =
            plan.pushVia === 'upstream' && probe.canFork
                ? ['upstream', 'fork']
                : [plan.pushVia ?? 'upstream'];
        for (const via of ladder) {
            const failed = tryPullRequest(plan, probe, repo, branch, via, deps);
            if (failed === null) {
                return { published: 'pull-request', attempts };
            }
            attempts.push(failed);
        }
    }

    if (plan.route === 'pull-request' || plan.route === 'issue') {
        const issue = deps.runner('gh', [
            'issue',
            'create',
            '--repo',
            repo,
            '--title',
            plan.title,
            '--body',
            plan.body,
        ]);
        if (issue.ok) {
            process.stdout.write(`${issue.out}`);
            return { published: 'issue', attempts };
        }
        attempts.push({ step: 'issue-create', ok: false, detail: failDetail('issue-create', issue) });
    }

    return { published: null, attempts };
}

function statusCmd(root: string): number {
    const open = openRecords(root);
    const all = listRecords(root);
    if (all.length === 0) {
        process.stdout.write('self-repair: no records.\n');
        return EXIT_OK;
    }
    process.stdout.write(`self-repair: ${open.length} open of ${all.length} record(s)\n\n`);
    for (const r of all) {
        const mark = r.status === 'open' ? 'o' : '.';
        process.stdout.write(
            `  ${mark} ${r.fingerprint}  ${r.defect_class}  ${r.occurrences}x  ${r.last_seen}\n` +
                `      ${r.evidence}\n`,
        );
    }
    process.stdout.write('\nRelease one: agent-config self-repair:release <fingerprint>\n');
    return EXIT_OK;
}

function releaseCmd(root: string, argv: string[]): number {
    const fp = argv.find((a) => !a.startsWith('-'));
    if (!fp) {
        process.stderr.write('self-repair:release needs a fingerprint (see self-repair:status).\n');
        return EXIT_FAIL;
    }
    const record = readRecord(root, fp);
    if (record === null) {
        process.stderr.write(`self-repair:release: no record ${fp}.\n`);
        return EXIT_FAIL;
    }
    const dryRun = argv.includes('--dry-run');
    const repoArg = argv.indexOf('--repo');
    const repo = repoArg >= 0 ? (argv[repoArg + 1] ?? UPSTREAM_REPO) : UPSTREAM_REPO;
    const probe = probeMachine(process.env, process.cwd());
    const plan = planRelease(record, probe, root);

    const via = plan.pushVia !== null ? ` via=${plan.pushVia}` : '';
    process.stdout.write(`self-repair:release ${fp} -> route=${plan.route}${via}\n`);
    if (plan.blocked !== null) {
        process.stdout.write(`  WARN  ${plan.blocked}\n`);
    }
    if (dryRun) {
        process.stdout.write(`\n--- ${plan.title} ---\n${plan.body}\n`);
        return EXIT_OK;
    }
    if (plan.route === 'local-only') {
        process.stdout.write(
            '  Nothing published. The record stays in agents/runtime/self-repair/.\n',
        );
        return EXIT_OK;
    }

    const deps: ReleaseDeps = { runner: run, now: () => new Date().toISOString() };
    const outcome = executeRelease(plan, probe, repo, deps);

    for (const a of outcome.attempts) {
        process.stderr.write(`  FAIL  ${a.detail}\n`);
    }
    if (outcome.published === null) {
        const errors = outcome.attempts.map((a) => sanitizeEvidence(a.detail));
        attachReleaseErrors(root, fp, errors, deps.now());
        process.stderr.write(
            '  The egress ladder is exhausted; the record stays open with the errors attached.\n',
        );
        return EXIT_FAIL;
    }
    if (outcome.published !== plan.route) {
        process.stdout.write(`  Degraded to ${outcome.published} after failed attempt(s).\n`);
    }
    markReleased(root, fp, deps.now());
    return EXIT_OK;
}

export function main(argv: readonly string[]): number {
    const root = process.cwd();
    const sub = argv[0] ?? 'status';
    if (sub === 'status') {
        return statusCmd(root);
    }
    if (sub === 'release') {
        return releaseCmd(root, [...argv.slice(1)]);
    }
    process.stderr.write(`self-repair: unknown subcommand '${sub}' (status | release).\n`);
    return EXIT_FAIL;
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (isCliEntry()) {
    process.exit(main(process.argv.slice(2)));
}

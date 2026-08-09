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
 * authored and pushed, an issue when it cannot, and a local record when nothing
 * can leave the machine. `--dry-run` prints the resolved route and the rendered
 * body and touches no network — that is the path the tests drive.
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
    chooseEgressRoute,
    type DefectRecord,
    type EgressAttempt,
    type EgressCapability,
    type EgressRoute,
    type PushRights,
    egressBlockedReason,
    renderReport,
} from './_lib/self_repair.js';
import {
    listRecords,
    markReleased,
    openRecords,
    readRecord,
    recordEgressAttempts,
} from './_lib/self_repair_store.js';

export const UPSTREAM_REPO = 'event4u-app/agent-config';

/**
 * The label the intake form applies and the CLI sets. Reports from independent
 * installs cluster by `fingerprint`; this label is what makes the whole set
 * findable in the first place, with no telemetry — the person filing decided to.
 */
export const SELF_REPAIR_LABEL = 'self-repair';

/** The structured intake form the `issue` route is designed to fill. */
export const SELF_REPAIR_FORM_REL = '.github/ISSUE_TEMPLATE/self_repair_report.yml';

const EXIT_OK = 0;
const EXIT_FAIL = 1;

/** Probe result for one machine — injectable so tests never shell out. */
export interface Probe {
    agentConfigCheckout: string | null;
    ghAuthenticated: boolean;
    pushRights: PushRights;
}

/**
 * Every egress leg is bounded. An unbounded `git push` or `gh pr create` on a
 * hostile network hangs the one command the whole loop is gated on, and the
 * operator's only recourse is Ctrl-C — which leaves the record unmarked and the
 * ladder unrun. 30 s per step, per the step spec.
 */
export const EGRESS_TIMEOUT_MS = 30_000;

export interface RunResult {
    ok: boolean;
    out: string;
    timedOut: boolean;
}

/** Command runner shape, so the ladder can be driven without a network. */
export type Exec = (cmd: string, args: string[], cwd?: string, timeoutMs?: number) => RunResult;

const run: Exec = (cmd, args, cwd, timeoutMs) => {
    const r = spawnSync(cmd, args, {
        cwd,
        encoding: 'utf-8',
        ...(timeoutMs === undefined ? {} : { timeout: timeoutMs }),
    });
    // spawnSync signals a timeout kill via `error.code === 'ETIMEDOUT'`; the
    // exit status is null in that case, so `ok` alone cannot tell a timeout from
    // a plain failure — and the two take different lines in the record.
    const timedOut = (r.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT';
    return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`, timedOut };
};

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
 * Probe what this machine may actually push — the pre-flight the route
 * selection needs and did not have.
 *
 * The replaced heuristic asked `git remote` and treated any answer as write
 * access. That is true for every clone of a public repo, so the route came out
 * `pull-request` for precisely the consumers who cannot push, and the run died
 * at `git push` with the record still open.
 *
 * `permissions.push` on the repo object is the authoritative answer for the
 * authenticated user; `allow_forking` decides whether the fallback path exists
 * at all. Both are one bounded API call. On any failure the answer is `none`,
 * which routes to an issue — the conservative direction, since an issue always
 * works when `gh` is authenticated and a wrong `upstream` guess wastes the
 * user's one gated keystroke.
 */
export function probePushRights(
    checkout: string | null,
    repo: string,
    exec: Exec = run,
): PushRights {
    if (checkout === null) {
        return 'none';
    }
    const perm = exec(
        'gh',
        ['api', `repos/${repo}`, '--jq', '.permissions.push'],
        checkout,
        EGRESS_TIMEOUT_MS,
    );
    if (perm.ok && perm.out.trim() === 'true') {
        return 'upstream';
    }
    const forkable = exec(
        'gh',
        ['api', `repos/${repo}`, '--jq', '.allow_forking'],
        checkout,
        EGRESS_TIMEOUT_MS,
    );
    if (forkable.ok && forkable.out.trim() === 'true') {
        return 'fork-only';
    }
    return 'none';
}

export function probeMachine(
    env: NodeJS.ProcessEnv,
    cwd: string,
    repo: string = UPSTREAM_REPO,
    exec: Exec = run,
): Probe {
    const checkout = findAgentConfigCheckout(env, cwd);
    const gh = exec('gh', ['auth', 'status'], undefined, EGRESS_TIMEOUT_MS);
    // No `gh` auth means no API call can answer the rights question, and the
    // route is `local-only` regardless — so skip the probe rather than spend two
    // timeouts learning nothing.
    const pushRights = gh.ok ? probePushRights(checkout, repo, exec) : 'none';
    return { agentConfigCheckout: checkout, ghAuthenticated: gh.ok, pushRights };
}

export function capabilityOf(probe: Probe): EgressCapability {
    return {
        hasAgentConfigCheckout: probe.agentConfigCheckout !== null,
        ghAuthenticated: probe.ghAuthenticated,
        pushRights: probe.pushRights,
    };
}

/** Title line for the PR / issue — one per defect class, stable across reruns. */
export function titleFor(record: DefectRecord): string {
    return `fix(self-repair): ${record.defect_class} — ${record.occurrences}x observed`;
}

export interface ReleasePlan {
    route: EgressRoute;
    blocked: string | null;
    title: string;
    body: string;
}

/** Pure: everything `release` decides before it touches the network. */
export function planRelease(record: DefectRecord, probe: Probe, repoRoot: string): ReleasePlan {
    const blocked = egressBlockedReason(record, repoRoot);
    const route: EgressRoute =
        blocked !== null ? 'local-only' : chooseEgressRoute(capabilityOf(probe));
    return { route, blocked, title: titleFor(record), body: renderReport(record, route) };
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

    process.stdout.write(`self-repair:release ${fp} -> route=${plan.route}\n`);
    if (plan.blocked !== null) {
        process.stdout.write(`  WARN  ${plan.blocked}\n`);
    }
    if (dryRun) {
        process.stdout.write(`\n--- ${plan.title} ---\n${plan.body}\n`);
        return EXIT_OK;
    }

    const outcome = performEgress(record, plan, probe, repo);
    for (const line of outcome.log) {
        process.stdout.write(`${line}\n`);
    }
    if (outcome.published) {
        markReleased(root, fp, new Date().toISOString());
        return EXIT_OK;
    }
    if (outcome.attempts.length > 0) {
        recordEgressAttempts(root, fp, outcome.attempts);
    }
    return outcome.attempts.length > 0 ? EXIT_FAIL : EXIT_OK;
}

export interface EgressOutcome {
    /** Did anything actually leave the machine? */
    published: boolean;
    /** Failed legs, in the order attempted. Empty when nothing was tried. */
    attempts: EgressAttempt[];
    /** Operator-facing lines, including raw command output. */
    log: string[];
}

/**
 * Run the egress ladder, degrading WITHIN the same invocation.
 *
 * The previous shape returned a failure exit code at the first bad step, so a
 * push that failed — the normal outcome for a consumer, given the route bug
 * above — ended the run with nothing published and nothing recorded. The user
 * had spent their one gated keystroke and got no report anywhere.
 *
 * The ladder now falls: push/PR failure or timeout attempts an issue, and an
 * issue failure leaves the record `open` with the failed legs attached. Every
 * step is bounded by {@link EGRESS_TIMEOUT_MS}.
 */
export function performEgress(
    record: DefectRecord,
    plan: ReleasePlan,
    probe: Probe,
    repo: string,
    exec: Exec = run,
): EgressOutcome {
    const attempts: EgressAttempt[] = [];
    const log: string[] = [];

    /** Record one failed leg and say which failure it was. */
    const fail = (step: EgressAttempt['step'], r: RunResult): void => {
        attempts.push({ route: plan.route, step, outcome: r.timedOut ? 'timeout' : 'failed' });
        log.push(
            r.timedOut
                ? `  TIMEOUT  ${step} exceeded ${String(EGRESS_TIMEOUT_MS / 1000)}s`
                : `  FAILED   ${step}`,
        );
        if (r.out.trim()) {
            log.push(r.out.trimEnd());
        }
    };

    /** Last rung: an issue always works when `gh` is authenticated. */
    const tryIssue = (): boolean => {
        const body = renderReport(record, 'issue');
        const r = exec(
            'gh',
            [
                'issue',
                'create',
                '--repo',
                repo,
                '--title',
                plan.title,
                '--body',
                body,
                // The label the intake form applies, set here too so a
                // CLI-filed report clusters with a hand-filed one.
                '--label',
                SELF_REPAIR_LABEL,
            ],
            undefined,
            EGRESS_TIMEOUT_MS,
        );
        if (r.ok) {
            log.push(r.out.trimEnd(), '  Fell back to an issue — the fix is not attached.');
            return true;
        }
        fail('issue', r);
        return false;
    };

    if (plan.route === 'local-only') {
        log.push('  Nothing published. The record stays in agents/runtime/self-repair/.');
        return { published: false, attempts, log };
    }

    if (plan.route === 'issue') {
        return { published: tryIssue(), attempts, log };
    }

    // Both PR routes need a branch that is not the trunk.
    const checkout = probe.agentConfigCheckout;
    if (checkout === null) {
        log.push('  No agent-config checkout — cannot author a fix here.');
        return { published: tryIssue(), attempts, log };
    }
    const branch = exec('git', ['branch', '--show-current'], checkout, EGRESS_TIMEOUT_MS).out.trim();
    if (!branch || branch === 'main') {
        log.push(
            '  The fix must sit on its own branch in the agent-config checkout ' +
                `(currently: ${branch || 'detached'}).`,
        );
        return { published: tryIssue(), attempts, log };
    }

    // The consumer path: a fork has to exist before anything can be pushed to
    // it. `--remote` gives the push target a name; an existing fork makes this
    // a no-op rather than an error.
    let pushRemote = 'origin';
    if (plan.route === 'fork-pull-request') {
        const forked = exec(
            'gh',
            ['repo', 'fork', repo, '--remote', '--remote-name', 'fork'],
            checkout,
            EGRESS_TIMEOUT_MS,
        );
        if (!forked.ok) {
            fail('fork', forked);
            return { published: tryIssue(), attempts, log };
        }
        pushRemote = 'fork';
    }

    const pushed = exec(
        'git',
        ['push', '-u', pushRemote, branch],
        checkout,
        EGRESS_TIMEOUT_MS,
    );
    if (!pushed.ok) {
        fail('push', pushed);
        return { published: tryIssue(), attempts, log };
    }

    // A cross-repo PR needs `--head owner:branch`; `gh` resolves the owner from
    // the fork remote, so `--head` alone with the fork's login is enough.
    const prArgs = ['pr', 'create', '--repo', repo, '--title', plan.title, '--body', plan.body];
    if (plan.route === 'fork-pull-request') {
        prArgs.push('--head', branch);
    }
    const pr = exec('gh', prArgs, checkout, EGRESS_TIMEOUT_MS);
    if (!pr.ok) {
        fail('pr', pushed.ok ? pr : pushed);
        return { published: tryIssue(), attempts, log };
    }
    log.push(pr.out.trimEnd());
    return { published: true, attempts, log };
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

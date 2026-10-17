#!/usr/bin/env node
/**
 * Self-repair CLI — the queue reader and the single gated outward step.
 *
 *   self-repair:status                 list open records
 *   self-repair:release <fp> --dry-run [--repo <owner/name>]
 *   self-repair:release <fp> --approve <digest> [--repo <owner/name>]
 *
 * `release` is the ONE outward step the loop is designed around: everything up to
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
 * the vehicle. `--dry-run` prints the resolved route, the GitHub account the
 * send would carry, every byte that may leave and their digest, and creates
 * nothing: it reads the forge (auth status, push rights, the signed-in login)
 * and the local repository, and writes to neither.
 *
 * Fail-closed on privacy: the record's own text goes through the audited
 * privacy floor before anything leaves the machine, and a refusal downgrades
 * the record to local-only rather than scrubbing it into publishable shape.
 *
 * The pull-request route never pushes the author's branch. It builds ONE commit
 * on `origin/main` from the branch's net change, in a temporary index with no
 * working tree, under a noreply identity and a neutral `retro/<fingerprint>`
 * branch name, unsigned and dated in UTC. Nothing from the branch's history —
 * its name, its commits, content added and later removed — is in that commit.
 * The floor then walks every object the push adds to the base: the commit
 * object, every tree and blob path, every blob's content, plus title and body.
 * A finding skips every push rung.
 *
 * Nothing is sent without an approval of the exact bytes: the dry run prints
 * them with their digest, and the release refuses unless `--approve <digest>`
 * names the bytes it is about to send (`_lib/self_repair_outgoing.ts`).
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    chooseEgress,
    type DefectRecord,
    type EgressCapability,
    type EgressChoice,
    type EgressRoute,
    egressBlockedReason,
    NEW_RECORDS_PER_SOURCE_PER_WINDOW,
    patchDeniedReason,
    type PushVia,
    renderReport,
    sanitizeEvidence,
} from './_lib/self_repair.js';
import { buildSettingsClassIndex, parseSettingsClassRows } from '../shared/settingsClasses.js';
import {
    attachReleaseErrors,
    listRecords,
    markReleased,
    writeTargetIndex,
    openRecords,
    readOverflow,
    readRecord,
} from './_lib/self_repair_store.js';
import {
    consumerDenyList,
    describeFindings,
    scanPayload,
} from './_lib/self_repair_payload.js';
import {
    approvalRefusal,
    type CommitIdentity,
    commitMessage,
    isNoreplyEmail,
    noreplyIdentity,
    type Outgoing,
    type OutgoingPullRequest,
    outgoingDigest,
    renderOutgoing,
    retroBranch,
} from './_lib/self_repair_outgoing.js';
import { _detect_project_identifiers } from './check_portability.js';
import { gitEnv } from './_lib/git_env.js';

export { consumerDenyList };

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

/**
 * Injectable command runner — tests script it, production shells out. `env` is
 * merged over the process environment, never a replacement for it.
 */
export type Runner = (cmd: string, args: string[], cwd?: string, env?: NodeJS.ProcessEnv) => RunResult;

export function runCommand(cmd: string, args: string[], cwd?: string, env?: NodeJS.ProcessEnv): RunResult {
    const r = spawnSync(cmd, args, {
        cwd,
        encoding: 'utf-8',
        timeout: EGRESS_STEP_TIMEOUT_MS,
        // An inherited GIT_DIR or GIT_INDEX_FILE (a release run from a hook)
        // would point every git step at another repository or index.
        env: { ...gitEnv(process.env), ...(env ?? {}) },
    });
    // Only spawnSync's own ETIMEDOUT counts: a child killed externally by
    // SIGTERM is a failure, not a timeout, and recording it as "timed out"
    // points the next debugging session at the wrong cause (R2 finding #3).
    const timedOut = (r.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT';
    return {
        ok: r.status === 0 && !timedOut,
        out: `${r.stdout ?? ''}${r.stderr ?? ''}`,
        timedOut,
    };
}

function isPackageCheckout(dir: string): boolean {
    return (
        fs.existsSync(path.join(dir, 'src', 'rules')) &&
        fs.existsSync(path.join(dir, 'src', 'scripts', 'hook_manifest.yaml'))
    );
}

function realOrSelf(p: string): string {
    try {
        return fs.realpathSync(p);
    } catch {
        return path.resolve(p);
    }
}

/**
 * The checkout of this package the release runs FROM, or null. A pull request
 * is opened only from such a checkout (D5): a release run from a consumer
 * project reaches the issue step and stops there, whatever the environment
 * says, because the record it releases was found in that project.
 *
 * `AGENT_CONFIG_SOURCE` points at the checkout when the release runs inside it
 * by a path that is not its root — a subdirectory, or a symlinked path. It is
 * honoured only when the working directory is inside the checkout it names; set
 * in a consumer project it widens nothing. Otherwise the working directory
 * itself must be the package checkout.
 */
export function findAgentConfigCheckout(env: NodeJS.ProcessEnv, cwd: string): string | null {
    const explicit = env['AGENT_CONFIG_SOURCE'];
    if (explicit && isPackageCheckout(explicit)) {
        const root = realOrSelf(explicit);
        const here = realOrSelf(cwd);
        if (here === root || here.startsWith(`${root}${path.sep}`)) {
            return explicit;
        }
    }
    return isPackageCheckout(cwd) ? cwd : null;
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
    runner: Runner = runCommand,
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
    /**
     * Non-null when the record targets a may-not-modify surface (kernel rules,
     * safety floors, settings class C, CI enforcement, self-repair's own
     * policy/code): the patch/PR path is refused with this reason and the
     * route degrades to report-only. Detection and the issue path stay open.
     */
    patch_denied: string | null;
    title: string;
    body: string;
}

/**
 * Class-C settings keys from the contract in the agent-config checkout, for
 * the deny-list's dynamic key match. `null` when there is no checkout or the
 * contract is unreadable — the deny-list's static path matches still apply.
 */
export function readClassCKeys(checkout: string | null): ReadonlySet<string> | null {
    if (checkout === null) {
        return null;
    }
    try {
        const md = fs.readFileSync(
            path.join(checkout, 'docs', 'contracts', 'settings-classes.md'),
            'utf-8',
        );
        const index = buildSettingsClassIndex(parseSettingsClassRows(md));
        return new Set([...index].filter(([, cls]) => cls === 'C').map(([key]) => key));
    } catch {
        return null;
    }
}

/** Pure: everything `release` decides before it touches the network. */
export function planRelease(
    record: DefectRecord,
    probe: Probe,
    repoRoot: string,
    opts?: { classCKeys?: ReadonlySet<string> | null },
): ReleasePlan {
    const blocked = egressBlockedReason(record, repoRoot);
    const patch_denied = blocked === null ? patchDeniedReason(record, opts) : null;
    let choice: EgressChoice =
        blocked !== null
            ? { route: 'local-only' as const, pushVia: null }
            : chooseEgress(capabilityOf(probe));
    if (patch_denied !== null && choice.route === 'pull-request') {
        // chooseEgress only returns pull-request when gh is authenticated, so
        // report-only degrades to an issue, never to a dropped record.
        choice = { route: 'issue', pushVia: null };
    }
    return {
        route: choice.route,
        pushVia: choice.pushVia,
        blocked,
        patch_denied,
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
    /** The consumer project's identifiers; none means only the detector table applies. */
    denyIdentifiers?: readonly string[];
    /** The digest the person approved after reading the dry run; absent refuses. */
    approvedDigest?: string | null;
}

/** The base the synthesised commit sits on, and what the pushed objects are compared against. */
export const PAYLOAD_BASE_REF = 'origin/main';

/** The account a send would carry: the login `gh` is authenticated as, or null. */
export function resolveAccount(runner: Runner): string | null {
    const who = runner('gh', ['api', 'user', '--jq', '.login']);
    const login = who.out.trim();
    return who.ok && login.length > 0 ? login : null;
}

/** The noreply identity of the signed-in account, or null when it cannot be resolved. */
export function resolveIdentity(runner: Runner): CommitIdentity | null {
    const who = runner('gh', ['api', 'user', '--jq', '"\\(.id) \\(.login)"']);
    if (!who.ok) {
        return null;
    }
    const [id, login] = who.out.trim().split(/\s+/);
    return noreplyIdentity(login ?? '', id ?? '');
}

/** What a release would send, read without sending or building anything. */
export interface Collected {
    outgoing: Outgoing;
    /** A precondition failed: nothing leaves, not even the issue. */
    precondition: EgressAttempt | null;
    /** The pull request cannot be built; the ladder starts at the issue. */
    prUnavailable: EgressAttempt | null;
    /** The base commit the pull request is built on, when it can be built. */
    baseSha: string | null;
}

/**
 * Read every byte the plan may send. The dry run renders this; the release
 * recomputes it and accepts only an approval of the same bytes.
 */
export function collectOutgoing(record: DefectRecord, plan: ReleasePlan, probe: Probe, runner: Runner): Collected {
    const none: Collected = {
        outgoing: { pullRequest: null, issue: null },
        precondition: null,
        prUnavailable: null,
        baseSha: null,
    };
    if (plan.route === 'local-only') {
        return none;
    }
    // Re-rendered for the issue rung: a plan that degrades from pull-request
    // must not file an issue whose body claims `Route: pull-request`.
    const issue = { title: plan.title, body: plan.route === 'issue' ? plan.body : renderReport(record, 'issue') };
    const out: Collected = { ...none, outgoing: { pullRequest: null, issue } };
    if (plan.route !== 'pull-request') {
        return out;
    }
    const checkout = probe.agentConfigCheckout!;
    const author = runner('git', ['branch', '--show-current'], checkout).out.trim();
    if (!author || author === 'main') {
        // Precondition, not an egress failure: the authored fix exists and
        // must ride its own branch — an issue instead would drop the fix.
        return {
            ...out,
            precondition: {
                step: 'branch-check',
                ok: false,
                detail:
                    'the fix must sit on its own branch in the agent-config checkout ' +
                    `(currently: ${author || 'detached'})`,
            },
        };
    }
    const unavailable = (step: string, detail: string): Collected => ({
        ...out,
        prUnavailable: { step, ok: false, detail },
    });
    const identity = resolveIdentity(runner);
    if (identity === null) {
        return unavailable('identity', 'identity: no noreply identity could be resolved for the signed-in account');
    }
    const base = runner('git', ['rev-parse', '--verify', `${PAYLOAD_BASE_REF}^{commit}`], checkout);
    if (!base.ok) {
        return unavailable('patch-build', `patch-build: ${PAYLOAD_BASE_REF} cannot be resolved`);
    }
    // The net change since the merge base, binary-safe, never summarised by a
    // textconv or an external driver: this is the patch that is committed.
    const diff = runner(
        'git',
        ['diff', '--binary', '--no-color', '--no-ext-diff', '--no-textconv', `${PAYLOAD_BASE_REF}...${author}`],
        checkout,
    );
    if (!diff.ok) {
        return unavailable('patch-build', `patch-build: the change on ${PAYLOAD_BASE_REF}...<branch> could not be read`);
    }
    if (diff.out.trim() === '') {
        return {
            ...out,
            precondition: {
                step: 'patch-build',
                ok: false,
                detail: `the branch carries no change against ${PAYLOAD_BASE_REF}; there is no fix to send`,
            },
        };
    }
    return {
        ...out,
        baseSha: base.out.trim(),
        outgoing: {
            issue,
            pullRequest: {
                branch: retroBranch(record.fingerprint),
                identity,
                message: commitMessage(plan.title, record.fingerprint),
                patch: diff.out,
                title: plan.title,
                body: plan.body,
            },
        },
    };
}

/** The dry run: the account, then every byte that may leave, then its digest. */
export function renderDryRun(plan: ReleasePlan, account: string | null, collected?: Collected): string {
    let out = '';
    if (plan.route === 'pull-request' || plan.route === 'issue') {
        out +=
            account !== null
                ? `  ACCOUNT  the ${plan.route} will be opened as GitHub account '${account}'\n`
                : `  ACCOUNT  the ${plan.route} will carry the GitHub account gh is signed in as; ` +
                  'that account could not be resolved here\n';
    }
    if (collected === undefined) {
        return `${out}\n--- ${plan.title} ---\n${plan.body}\n`;
    }
    if (collected.precondition !== null) {
        return `${out}  STOP  ${collected.precondition.detail}\n`;
    }
    if (collected.prUnavailable !== null) {
        out += `  NOTE  no pull request: ${collected.prUnavailable.detail}; the issue is what would be sent\n`;
    }
    if (collected.outgoing.pullRequest !== null) {
        out += '  DATE   the commit is dated at the moment of release, in UTC\n';
    }
    out += `\n${renderOutgoing(collected.outgoing)}`;
    if (plan.route !== 'local-only') {
        out += `\n  DIGEST ${outgoingDigest(collected.outgoing)}\n`;
        out += '  Send exactly these bytes: self-repair:release <fingerprint> --approve <digest>\n';
    }
    return out;
}

const FORK_REMOTE = 'self-repair-fork';

function failDetail(step: string, r: RunResult): string {
    return r.timedOut
        ? `${step}: timed out after ${EGRESS_STEP_TIMEOUT_MS / 1000}s`
        : `${step}: ${r.out.trim() || 'failed'}`;
}

/** A commit date in UTC, so the local timezone offset does not leave with it. */
function utcDate(nowIso: string): string {
    const ms = Date.parse(nowIso);
    return `${Math.floor((Number.isFinite(ms) ? ms : Date.now()) / 1000)} +0000`;
}

/**
 * Build the one commit that is pushed: the approved patch on the base, in a
 * temporary index with no working tree — so no hook, no checkout state and no
 * file outside the patch can reach it. Unsigned, because a signature would
 * carry the configured identity the noreply one replaces.
 */
function buildCleanCommit(
    pr: OutgoingPullRequest,
    baseSha: string,
    checkout: string,
    deps: ReleaseDeps,
): { sha: string } | EgressAttempt {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'self-repair-'));
    try {
        const patchFile = path.join(tmp, 'change.patch');
        const messageFile = path.join(tmp, 'message');
        fs.writeFileSync(patchFile, pr.patch);
        fs.writeFileSync(messageFile, pr.message);
        const index = { GIT_INDEX_FILE: path.join(tmp, 'index') };
        const step = (args: string[], env: NodeJS.ProcessEnv): RunResult => deps.runner('git', args, checkout, env);
        const read = step(['read-tree', baseSha], index);
        if (!read.ok) return { step: 'patch-build', ok: false, detail: failDetail('patch-build', read) };
        const applied = step(['apply', '--cached', '--binary', patchFile], index);
        if (!applied.ok) return { step: 'patch-build', ok: false, detail: failDetail('patch-build', applied) };
        const tree = step(['write-tree'], index);
        if (!tree.ok) return { step: 'patch-build', ok: false, detail: failDetail('patch-build', tree) };
        const date = utcDate(deps.now());
        const commit = step(['commit-tree', '--no-gpg-sign', tree.out.trim(), '-p', baseSha, '-F', messageFile], {
            GIT_AUTHOR_NAME: pr.identity.name,
            GIT_AUTHOR_EMAIL: pr.identity.email,
            GIT_AUTHOR_DATE: date,
            GIT_COMMITTER_NAME: pr.identity.name,
            GIT_COMMITTER_EMAIL: pr.identity.email,
            GIT_COMMITTER_DATE: date,
        });
        if (!commit.ok) return { step: 'patch-build', ok: false, detail: failDetail('patch-build', commit) };
        return { sha: commit.out.trim() };
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

/**
 * Every object the push adds to the base, read from the object store: each
 * commit raw, each tree and blob path, each blob whole. Null when any of it
 * cannot be read — the caller refuses rather than send what nobody read.
 */
function readPushedObjects(
    runner: Runner,
    checkout: string,
    baseSha: string,
    sha: string,
): { commits: string; objects: string } | null {
    const list = runner('git', ['rev-list', '--objects', `${baseSha}..${sha}`], checkout);
    if (!list.ok) {
        return null;
    }
    let commits = '';
    let objects = '';
    for (const line of list.out.split('\n')) {
        const [oid, ...rest] = line.trim().split(' ');
        if (!oid) continue;
        const type = runner('git', ['cat-file', '-t', oid], checkout);
        if (!type.ok) return null;
        const kind = type.out.trim();
        if (kind === 'commit') {
            const body = runner('git', ['cat-file', 'commit', oid], checkout);
            if (!body.ok) return null;
            commits += `${body.out}\n`;
            continue;
        }
        objects += `${rest.join(' ')}\n`;
        if (kind === 'blob') {
            const blob = runner('git', ['cat-file', 'blob', oid], checkout);
            if (!blob.ok) return null;
            objects += `${blob.out}\n`;
        }
    }
    return { commits, objects };
}

const IDENTITY_LINE_RE = /^(?:author|committer) .* <([^>]*)> \d+ [+-]\d{4}$/gm;

/** Every e-mail a commit object records — what the push would show next to the change. */
function committedEmails(commits: string): string[] {
    return [...commits.matchAll(IDENTITY_LINE_RE)].map((m) => m[1] ?? '');
}

/**
 * Push the synthesised commit — directly, or via fork → cross-repo PR — then
 * open the PR. Returns null on success; on any step failure or timeout returns
 * the failed attempt so the caller degrades down the ladder.
 */
function tryPullRequest(
    pr: OutgoingPullRequest,
    sha: string,
    probe: Probe,
    repo: string,
    via: PushVia,
    deps: ReleaseDeps,
): EgressAttempt | null {
    const checkout = probe.agentConfigCheckout!;
    const refspec = `${sha}:refs/heads/${pr.branch}`;
    let prHead = pr.branch;

    if (via === 'upstream') {
        const pushed = deps.runner('git', ['push', 'origin', refspec], checkout);
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
        const pushed = deps.runner('git', ['push', FORK_REMOTE, refspec], checkout);
        if (!pushed.ok) {
            return { step: 'push-fork', ok: false, detail: failDetail('push-fork', pushed) };
        }
        prHead = `${login}:${pr.branch}`;
    }

    // `--draft` on every rung, never only on the fork one. A draft is the
    // weaker of the two states a pull request can arrive in: it asks for no
    // review, notifies no code owner, and runs no required check until someone
    // marks it ready. An upstream finding is a proposal from a machine the
    // maintainer has not met, so the maintainer decides when it becomes a
    // request. Opening ready-for-review is the stronger act and nothing here
    // has the standing to take it. `--head` is always named: the pushed
    // branch is not the one checked out.
    const prArgs = [
        'pr',
        'create',
        '--repo',
        repo,
        '--draft',
        '--title',
        pr.title,
        '--body',
        pr.body,
        '--head',
        prHead,
    ];
    const created = deps.runner('gh', prArgs, checkout);
    if (!created.ok) {
        return { step: 'pr-create', ok: false, detail: failDetail('pr-create', created) };
    }
    process.stdout.write(`${created.out}`);
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
    record: DefectRecord,
    plan: ReleasePlan,
    probe: Probe,
    repo: string,
    deps: ReleaseDeps,
): ReleaseOutcome {
    const attempts: EgressAttempt[] = [];
    if (plan.route === 'local-only') {
        return { published: null, attempts };
    }
    const collected = collectOutgoing(record, plan, probe, deps.runner);
    if (collected.precondition !== null) {
        attempts.push(collected.precondition);
        return { published: null, attempts };
    }
    const refusal = approvalRefusal(record, collected.outgoing, deps.approvedDigest);
    if (refusal !== null) {
        attempts.push({ step: 'approval', ok: false, detail: `approval: ${refusal} — nothing was sent` });
        return { published: null, attempts };
    }
    const deny = deps.denyIdentifiers ?? [];
    const pr = collected.outgoing.pullRequest;

    if (plan.route === 'pull-request') {
        // Title and body are scanned before and independently of anything
        // built from the branch, so a build failure cannot skip them. A finding
        // there would leave through the issue too — its title is the same and
        // its body is rendered from the same record.
        const headFindings = scanPayload(
            { branch: pr?.branch ?? '', commits: '', objects: '', title: plan.title, body: plan.body },
            deny,
        );
        if (headFindings.some((f) => f.part === 'title' || f.part === 'body')) {
            attempts.push({ step: 'payload-scan', ok: false, detail: describeFindings(headFindings) });
            return { published: null, attempts };
        }
        if (collected.prUnavailable !== null) {
            attempts.push(collected.prUnavailable);
        }
        const sha = pr !== null && collected.baseSha !== null ? cleanCommit(pr, collected.baseSha, probe, deps, deny, attempts) : null;
        // Any refusal skips every push rung and degrades to the issue, which
        // carries none of the refused branch, commit or object bytes.
        const ladder: PushVia[] =
            sha === null ? [] : plan.pushVia === 'upstream' && probe.canFork ? ['upstream', 'fork'] : [plan.pushVia ?? 'upstream'];
        for (const via of ladder) {
            const failed = tryPullRequest(pr!, sha!, probe, repo, via, deps);
            if (failed === null) {
                return { published: 'pull-request', attempts };
            }
            attempts.push(failed);
        }
    }

    const issue = collected.outgoing.issue!;
    if (plan.route === 'pull-request') {
        // The degraded body is re-rendered, so it is scanned on its own.
        const bodyFindings = scanPayload({ branch: '', commits: '', objects: '', title: '', body: issue.body }, deny);
        if (bodyFindings.length > 0) {
            attempts.push({ step: 'payload-scan', ok: false, detail: describeFindings(bodyFindings) });
            return { published: null, attempts };
        }
    }
    const created = deps.runner('gh', ['issue', 'create', '--repo', repo, '--title', issue.title, '--body', issue.body]);
    if (created.ok) {
        process.stdout.write(`${created.out}`);
        return { published: 'issue', attempts };
    }
    attempts.push({ step: 'issue-create', ok: false, detail: failDetail('issue-create', created) });
    return { published: null, attempts };
}

/**
 * Build the commit and scan every object it adds. Returns the sha only when
 * the floor found nothing and the commit carries the noreply identity alone;
 * otherwise records why and returns null.
 */
function cleanCommit(
    pr: OutgoingPullRequest,
    baseSha: string,
    probe: Probe,
    deps: ReleaseDeps,
    deny: readonly string[],
    attempts: EgressAttempt[],
): string | null {
    const checkout = probe.agentConfigCheckout!;
    const built = buildCleanCommit(pr, baseSha, checkout, deps);
    if (!('sha' in built)) {
        attempts.push(built);
        return null;
    }
    const pushed = readPushedObjects(deps.runner, checkout, baseSha, built.sha);
    if (pushed === null) {
        attempts.push({
            step: 'payload-scan',
            ok: false,
            detail: 'payload floor refused the pull request: the objects the push adds could not be read',
        });
        return null;
    }
    const findings = scanPayload({ ...pushed, branch: pr.branch, title: '', body: '' }, deny);
    if (findings.length > 0) {
        attempts.push({ step: 'payload-scan', ok: false, detail: describeFindings(findings) });
        return null;
    }
    const emails = committedEmails(pushed.commits);
    if (emails.length === 0 || emails.some((e) => e !== pr.identity.email || !isNoreplyEmail(e))) {
        attempts.push({
            step: 'identity',
            ok: false,
            detail: 'identity: the built commit records an identity other than the noreply one — nothing was pushed',
        });
        return null;
    }
    return built.sha;
}

/**
 * The creation cap's drop tally, printed whenever it is non-zero. This is the
 * half that keeps the cap honest: a bounded store is only an improvement if
 * "records were refused" is readable, otherwise the bound is indistinguishable
 * from defects that never happened.
 */
function overflowLines(root: string): string {
    const counts = readOverflow(root);
    const rows = Object.entries(counts).filter(([, v]) => (v?.dropped ?? 0) > 0);
    if (rows.length === 0) {
        return '';
    }
    let out = '\n';
    for (const [source, v] of rows) {
        out +=
            `  ! creation cap refused ${v?.dropped ?? 0} new ${source} record(s) ` +
            `(cap ${NEW_RECORDS_PER_SOURCE_PER_WINDOW} per source per 24h, last ${v?.last_seen ?? '?'})\n`;
    }
    return out;
}

function statusCmd(root: string): number {
    const open = openRecords(root);
    const all = listRecords(root);
    if (all.length === 0) {
        const overflow = overflowLines(root);
        process.stdout.write(`self-repair: no records.\n${overflow}`);
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
    process.stdout.write(overflowLines(root));
    process.stdout.write('\nRelease one: agent-config self-repair:release <fingerprint>\n');
    return EXIT_OK;
}

function releaseCmd(root: string, argv: string[]): number {
    // A flag's value is not the fingerprint: `--approve <digest>` and
    // `--repo <owner/name>` both take one.
    const fp = argv.find((a, i) => !a.startsWith('-') && argv[i - 1] !== '--approve' && argv[i - 1] !== '--repo');
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
    const plan = planRelease(record, probe, root, {
        classCKeys: readClassCKeys(probe.agentConfigCheckout),
    });

    const via = plan.pushVia !== null ? ` via=${plan.pushVia}` : '';
    process.stdout.write(`self-repair:release ${fp} -> route=${plan.route}${via}\n`);
    if (plan.blocked !== null) {
        process.stdout.write(`  WARN  ${plan.blocked}\n`);
    }
    if (plan.patch_denied !== null) {
        process.stdout.write(`  DENY  ${plan.patch_denied}\n`);
    }
    if (dryRun) {
        const account = plan.route === 'local-only' ? null : resolveAccount(runCommand);
        process.stdout.write(renderDryRun(plan, account, collectOutgoing(record, plan, probe, runCommand)));
        return EXIT_OK;
    }
    if (plan.route === 'local-only') {
        process.stdout.write(
            '  Nothing published. The record stays in agents/runtime/self-repair/.\n',
        );
        return EXIT_OK;
    }

    const approveArg = argv.indexOf('--approve');
    const deps: ReleaseDeps = {
        runner: runCommand,
        now: () => new Date().toISOString(),
        denyIdentifiers: consumerDenyList(_detect_project_identifiers(root), repo),
        approvedDigest: approveArg >= 0 ? (argv[approveArg + 1] ?? null) : null,
    };
    const outcome = executeRelease(record, plan, probe, repo, deps);

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

/**
 * Rebuild the per-target occurrence index and print it.
 *
 * A DERIVED read: the record files are the source, the index is regenerable
 * and gitignored with the rest of `agents/runtime/`. It exists because
 * `occurrences` counts a fingerprint (class + normalised evidence shape), so a
 * rule's weakness showing up in three different shapes was three records with
 * one occurrence each — and the third-recurrence escalation had nothing that
 * could ever establish its own precondition.
 */
function targetsCmd(root: string): number {
    const counts = writeTargetIndex(root);
    if (counts.length === 0) {
        process.stdout.write('self-repair: no record carries a resolved target yet.\n');
        return EXIT_OK;
    }
    for (const c of counts) {
        process.stdout.write(
            `  ${c.target}  ${c.occurrences} occurrence(s) across ${c.records.length} record(s)\n`,
        );
    }
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
    if (sub === 'targets') {
        return targetsCmd(root);
    }
    process.stderr.write(
        `self-repair: unknown subcommand '${sub}' (status | release | targets).\n`,
    );
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

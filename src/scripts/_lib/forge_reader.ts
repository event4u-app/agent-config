/**
 * The live forge read behind `doctor --json`'s `forge_protection` block.
 *
 * `road-to-adversarial-verification-and-long-runs` AC-5. Phase 3.2 shipped a
 * correct pure mapper (`forge_protection.ts`) and no production caller, so
 * `agent-config doctor --json` — the command the criterion names — reported five
 * `unread` rows while the forge satisfied all five. The rows were established by
 * a human running `gh api` by hand and reading the mapper's output in a test.
 * That is the exact substitution this roadmap's Phase 3 exists to forbid: a
 * mechanical check replaced by a person's reading of the same evidence.
 *
 * **This IS a reversal of Phase 3.2's recorded decision, and the roadmap carries
 * the supersession.** An earlier draft of this header argued the opposite — that
 * `decision-revisit-gate`'s mechanism-match test fails, so no lock applies — and
 * a 2/2 convergent council pass refuted it: that note recorded TWO boundaries,
 * `doctor` does not reach the network AND the reading is injected, and moving
 * `gh api` in here reverses both. The refuted reasoning is corrected rather than
 * left standing, for the reason the sibling docblock gives: a module header is
 * what the next reader meets first, so it is where a dead argument gets reused.
 *
 * What survives is the narrower AVAILABILITY property the supersession rests on:
 * every failure path returns {@link UNREAD_FORGE}, so offline the rows, their
 * `source` templates and the action lines are what Phase 3.2 printed — no error,
 * no hang. Not the whole document: the block gained a top-level `repository`
 * key, `null` on every such path.
 *
 * **The degradation is the load-bearing claim, so it is tested rather than
 * asserted.** Six distinct failures — no repository, a dead repo record, a dead
 * ruleset detail, a dead environments call, a non-boolean flag, a throwing API —
 * each land on `unread` for the rows they touch and leave the others alone. Two
 * of those directions have a more obvious wrong implementation than the right
 * one, and both are pinned: a PARTIAL ruleset list (understates protection in
 * one direction, overstates it in the other), and ALL-OR-NOTHING across surfaces
 * that do not depend on each other (a dead environments call says nothing about
 * whether a ruleset protects the branch).
 *
 * The network lives here; the judgement lives in `forge_protection.ts`. Both
 * polarities stay testable offline because the API is injected.
 */

import { spawnSync } from 'node:child_process';

import {
    UNREAD_FORGE,
    deployRestrictedFrom,
    type EnvironmentPolicy,
    type ForgeReading,
} from './forge_protection.js';
import type { RulesetDetail } from './platform_anchor.js';

/**
 * One forge API call. `null` on ANY failure — exit status, empty output,
 * unparseable JSON, timeout, missing binary, missing credentials.
 *
 * Injected rather than imported so every failure above is reachable from a test
 * without a network, which is what makes the degradation claim checkable.
 */
export interface ForgeApi {
    get(apiPath: string, paginate?: boolean): unknown | null;
}

/**
 * Per-call ceiling.
 *
 * A diagnostic that hangs is worse than one that reports `unread`: the reader
 * learns nothing either way, and only one of the two costs them the terminal.
 * Ten seconds is a stated default rather than a measured optimum — it is
 * generous for a `gh api` round trip and short enough that five of them stay
 * inside the patience budget of a command people run to get unstuck.
 */
export const FORGE_CALL_TIMEOUT_MS = 10_000;

/** Ceiling on the one `git` spawn, which sits inside the whole-read budget. */
export const GIT_REMOTE_TIMEOUT_MS = 2_000;

/**
 * Ceiling on the WHOLE read, not on one call.
 *
 * The call count is `3 + one per ruleset + one per environment carrying custom
 * branch policies` — it is NOT a fixed five, and sizing the budget against a
 * fixed five was the defect an independent review named. On a repository with
 * many rulesets the budget is what stops the read, and the rows it did not
 * reach report `unread`, which is the honest answer rather than a wrong one.
 *
 * Fifteen seconds is a stated default, not a measured optimum. It is enforced
 * as a real ceiling rather than only at admission: {@link budgetOf} returns the
 * milliseconds left, {@link liveForgeApi} takes that as its `timeoutFor` and
 * caps each spawn at `min(FORGE_CALL_TIMEOUT_MS, remaining)`, and
 * {@link withDeadline} refuses to dispatch once it reaches zero. So a call
 * admitted near the deadline cannot run past it.
 */
export const FORGE_TOTAL_BUDGET_MS = 15_000;

/**
 * Environment switches that skip the read entirely, before any process spawns.
 *
 * Both are read as the literal `1`, which is the contract `cmd_versions.ts` and
 * `cmd_update.ts` already use for `AGENT_CONFIG_OFFLINE`. Accepting any
 * non-empty value here would give one variable two opposite meanings inside one
 * binary — `AGENT_CONFIG_OFFLINE=0` would mean online to `update` and offline
 * to `doctor` — and the surprising direction is the one a user reads as "off".
 */
export const NO_FORGE_ENV = ['AGENT_CONFIG_DOCTOR_NO_FORGE', 'AGENT_CONFIG_OFFLINE'] as const;

/** `true` when a switch in {@link NO_FORGE_ENV} is set to the literal `1`. */
export function forgeReadDisabled(env: Readonly<Record<string, string | undefined>>): boolean {
    return NO_FORGE_ENV.some((k) => env[k] === '1');
}

function asObject(v: unknown): Record<string, unknown> | null {
    return v !== null && typeof v === 'object' && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
}

/** What a spawn returns, narrowed to the two fields this module reads. */
export interface SpawnResult {
    readonly status: number | null;
    readonly stdout?: string | undefined;
}

/** A subprocess runner. Injected so every failure branch is testable offline. */
export type Runner = (
    cmd: string,
    args: readonly string[],
    timeoutMs: number,
    cwd?: string,
) => SpawnResult;

const defaultRunner: Runner = (cmd, args, timeoutMs, cwd) =>
    spawnSync(cmd, [...args], {
        encoding: 'utf8',
        timeout: timeoutMs,
        maxBuffer: 32 * 1024 * 1024,
        ...(cwd === undefined ? {} : { cwd }),
    });

/** The repository to read, and the host it lives on. */
export interface ForgeTarget {
    readonly host: string;
    readonly slug: string;
}

/**
 * The live `gh api` caller.
 *
 * `timeoutFor` returns the ceiling for THIS call, so the whole-read budget can
 * shorten it. A fixed per-call timeout is what let a call admitted just inside
 * the budget run well past it — the budget checked admission and nothing
 * checked duration.
 *
 * `--paginate --slurp` needs `gh` 2.43 or newer. On an older client the call
 * fails and the rulesets read blanks, which lands on `unread` rather than on a
 * wrong answer — the degradation this module guarantees, reached by a cause it
 * cannot name. Stated here because nothing else in the diff documents it.
 */
export function liveForgeApi(
    timeoutFor: () => number = () => FORGE_CALL_TIMEOUT_MS,
    run: Runner = defaultRunner,
    where: { readonly host?: string; readonly cwd?: string } = {},
): ForgeApi {
    // **`gh` is addressed at the host and directory the SLUG came from.** The
    // slug is resolved with `cwd: root`, and a `gh` spawned with neither
    // inherits the process cwd and gh's default host — so with `--project`,
    // `--root` or `AGENT_CONFIG_PROJECT_ROOT` pointing elsewhere, or with a
    // GitHub Enterprise remote, the two halves of the read addressed two
    // different repositories and a same-named repo elsewhere produced a
    // confident verdict about somebody else's project.
    const hostArgs =
        where.host === undefined || where.host.toLowerCase() === 'github.com'
            ? []
            : ['--hostname', where.host];
    return {
        get(apiPath: string, paginate = false): unknown | null {
            const budget = timeoutFor();
            if (budget <= 0) return null;
            const args = paginate
                ? ['api', '--paginate', '--slurp', ...hostArgs, apiPath]
                : ['api', ...hostArgs, apiPath];
            let r: SpawnResult;
            try {
                // FLOORED to an integer. `budgetOf` reads `performance.now()`,
                // which is fractional, and `spawnSync`'s `timeout` must be an
                // integer — so once enough of the budget had elapsed for the
                // remainder to become the minimum, every call threw
                // `ERR_OUT_OF_RANGE`, was swallowed by the catch below, and
                // returned `null`. The read degraded to `unread` with no
                // subprocess ever started, which looks exactly like a forge
                // that would not answer.
                r = run('gh', args, Math.floor(Math.min(FORGE_CALL_TIMEOUT_MS, budget)), where.cwd);
            } catch {
                return null;
            }
            if (r.status !== 0 || typeof r.stdout !== 'string' || r.stdout.trim() === '') {
                return null;
            }
            try {
                return JSON.parse(r.stdout) as unknown;
            } catch {
                return null;
            }
        },
    };
}

/**
 * `owner/repo` from a git remote URL, or `null`.
 *
 * **Host-gated on purpose.** `gh api` speaks GitHub, so attempting it against a
 * GitLab or Bitbucket remote buys a doomed subprocess on every `doctor` run and
 * returns the same `unread` the skip returns for free. The gate is the literal
 * `github` in the host, which covers `github.com` and the usual GitHub
 * Enterprise naming. A GHES install on a host that does not carry the vendor
 * name is skipped and reports `unread` — the safe degradation, and stated here
 * rather than left for a reader to discover from a blank row.
 */
export function resolveForgeRepo(originUrl: string | null): ForgeTarget | null {
    if (originUrl === null || originUrl.trim() === '') return null;
    const url = originUrl.trim();
    const m = /^(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/)?(?:[^@/]+@)?([^/:]+)[:/]([^/:]+\/[^/]+?)(?:\.git)?$/.exec(
        url,
    );
    const host = m?.[1];
    const slug = m?.[2];
    if (host === undefined || slug === undefined) return null;
    if (!host.toLowerCase().includes('github')) return null;
    // The slug is interpolated into an API path and used as a replacement
    // string, so its character set is checked rather than assumed. The previous
    // pattern admitted `$`, `?`, `#` and `..` — one of those is a path
    // traversal and another is a `String.replace` control sequence.
    if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(slug)) return null;
    if (slug.split('/').some((seg) => seg === '.' || seg === '..')) return null;
    return { host, slug };
}

/**
 * The repository's `origin` URL, or `null`.
 *
 * Timed out like every other spawn here. It was the one subprocess in the
 * module with no ceiling and it ran before the budget was even constructed, so
 * a wedged `git` sat entirely outside a read that advertised a total ceiling.
 */
export function originUrl(
    root: string,
    run: Runner = defaultRunner,
    timeoutMs = GIT_REMOTE_TIMEOUT_MS,
): string | null {
    let r: SpawnResult;
    try {
        // `ls-remote --get-url` APPLIES `url.<base>.insteadOf` rewrites and still
        // makes no network call; `remote get-url` returns the configured URL
        // verbatim. The difference matters in the unsafe direction: a
        // github.com-shaped URL rewritten onto another host would otherwise be
        // accepted and the read attributed to the wrong repository — which is a
        // condition the Phase 3.2 amendment names as reversing it.
        r = run('git', ['ls-remote', '--get-url', 'origin'], timeoutMs, root);
    } catch {
        return null;
    }
    if (r.status !== 0 || typeof r.stdout !== 'string') return null;
    const out = r.stdout.trim();
    // With no such remote, `ls-remote --get-url` echoes the name back.
    return out === '' || out === 'origin' ? null : out;
}

/**
 * Every ruleset, with its detail, or `null`.
 *
 * The listing endpoint returns summaries without `rules`, so each is fetched
 * individually — and a single failed detail read blanks the WHOLE list rather
 * than returning what was collected. Same contract as the sibling anchor
 * source, for the same reason it states: a subset understates the effective
 * protection in one direction and overstates it in the other, and neither is a
 * verdict worth recording. `--paginate --slurp` because the listing pages at 30
 * and a silently truncated reading is that same partial verdict wearing a
 * different cause.
 */
function readRulesets(repo: string, api: ForgeApi): RulesetDetail[] | null {
    // One flattener for the one `--paginate --slurp` contract. This read grew
    // its own inline version first, which left two implementations of the same
    // page shape free to drift apart.
    const list = slurped(api.get(`repos/${repo}/rulesets`, true), 'rulesets');
    if (list === null) return null;
    const out: RulesetDetail[] = [];
    for (const entry of list) {
        const id = asObject(entry)?.['id'];
        if (typeof id !== 'number') return null;
        const detail = api.get(`repos/${repo}/rulesets/${String(id)}`);
        if (asObject(detail) === null) return null;
        out.push(detail as RulesetDetail);
    }
    return out;
}

/**
 * Flatten a `--paginate --slurp` payload down to one list.
 *
 * `--slurp` yields an array of PAGES. Each page is either a bare array (a list
 * endpoint) or an object carrying the list under `key` (`environments`,
 * `branch_policies`). `null` when the shape is not one of those — never a
 * partial list, for the reason {@link readRulesets} states.
 */
function slurped(payload: unknown, key: string): unknown[] | null {
    if (Array.isArray(payload)) {
        // An array of pages, each itself an array — a list endpoint under
        // `--slurp`.
        if (payload.length > 0 && payload.every((p) => Array.isArray(p))) {
            return (payload as unknown[][]).flat();
        }
        // An array of pages, each an object carrying the list under `key`.
        if (payload.length > 0 && payload.every((p) => Array.isArray(asObject(p)?.[key]))) {
            return payload.flatMap((p) => asObject(p)?.[key] as unknown[]);
        }
        // A flat list of items — what a list endpoint returns UNPAGINATED, and
        // what `gh` emits when a single page is not wrapped. Kept because
        // collapsing it into the page shapes above was what broke the flat
        // case when the two flatteners were merged.
        return payload;
    }
    const listed = asObject(payload)?.[key];
    return Array.isArray(listed) ? [...listed] : null;
}

/**
 * Whether every environment restricts its deployment branches, or `null`.
 *
 * The custom-policy NAMES live behind a second call per environment, and a
 * policy pattern of `*` restricts nothing whatever the flag says. A failed
 * names read therefore makes the whole row `unread`, and that is a CORRECTION:
 * the first draft fell back to trusting the flag, which `deployRestrictedFrom`
 * calls the guarantee that WAS NOT CHECKED — the weaker reading, not the
 * narrower one. An independent review followed the consequence through: an
 * environment whose real policy is `*` would then report `satisfied`, which is
 * the overstatement direction this module says it never takes, and it would be
 * indistinguishable in the output from a genuine restriction. A read that
 * failed is a read nobody made, so it lands where every other unmade read
 * lands.
 *
 * The environment name is URL-ENCODED into the path. GitHub admits spaces and
 * other path-unsafe characters in an environment name, and an unencoded name
 * is exactly how the failed-read branch above gets reached by accident.
 */
function readDeployRestricted(repo: string, api: ForgeApi): boolean | null {
    // PAGINATED. Unpaginated, a repository with more environments than one page
    // returns a subset, `deployRestrictedFrom`'s `every()` runs over what it can
    // see, and an unlisted unrestricted environment reads as `satisfied` — the
    // overstatement direction this module says it never takes. `readRulesets`
    // guards the identical hazard one function up.
    const envsRaw = slurped(api.get(`repos/${repo}/environments`, true), 'environments');
    if (envsRaw === null) return null;
    const envs: EnvironmentPolicy[] = [];
    const patternsByEnv: Record<string, readonly string[]> = {};
    for (const raw of envsRaw) {
        const env = asObject(raw);
        const name = env?.['name'];
        if (typeof name !== 'string') return null;
        const policy = asObject(env?.['deployment_branch_policy']);
        // Each flag is OMITTED rather than set to `undefined` when the payload
        // did not carry it as a boolean. `deployRestrictedFrom` distinguishes
        // absent from false, so writing a non-boolean through as `undefined`
        // under `exactOptionalPropertyTypes` would be a type error here and a
        // silent "the forge said no" one rung down.
        envs.push({
            name,
            deployment_branch_policy:
                policy === null
                    ? null
                    : {
                          ...(typeof policy['protected_branches'] === 'boolean'
                              ? { protected_branches: policy['protected_branches'] }
                              : {}),
                          ...(typeof policy['custom_branch_policies'] === 'boolean'
                              ? { custom_branch_policies: policy['custom_branch_policies'] }
                              : {}),
                      },
        });
        if (policy?.['custom_branch_policies'] !== true) continue;
        // `protected_branches` already decides the row for this environment —
        // `deployRestrictedFrom` short-circuits on it before consulting the
        // pattern map — so the extra call would spend budget on an answer that
        // cannot change the verdict, and degrade the row to `unread` if it
        // failed.
        if (policy['protected_branches'] === true) continue;
        const names = api.get(
            `repos/${repo}/environments/${encodeURIComponent(name)}/deployment-branch-policies`,
            true,
        );
        const listed = slurped(names, 'branch_policies');
        // A read that failed is a read nobody made — `unread`, never a trusted
        // flag. Trusting it here is how a wildcard policy reports `satisfied`.
        if (listed === null) return null;
        const patterns = listed.map((p) => asObject(p)?.['name']);
        // A non-string pattern name makes the row `unread`, not `false`.
        // Filtering it away silently left an EMPTY pattern list, which
        // `deployRestrictedFrom` maps to `false` — so the row would render
        // "at least one environment accepts a deployment from any branch",
        // a positive claim about the forge derived from data nobody could
        // parse. Every sibling field here already takes the null route: a
        // non-string environment name, a non-numeric ruleset id, a non-boolean
        // `allow_auto_merge`. A confirmed-empty list is a different input and
        // keeps its own `false`.
        if (patterns.some((n) => typeof n !== 'string')) return null;
        patternsByEnv[name] = patterns as string[];
    }
    return deployRestrictedFrom(envs, patternsByEnv);
}

/**
 * Read the four fields the mapper consumes.
 *
 * The repository record is first and GATES the rest: it carries two of the four
 * fields, and the other two are meaningless without the default branch it
 * names. A reader that kept going after it failed would spend calls on answers
 * it could not use, so this one returns immediately — asserted by a test over
 * the call list rather than over the returned value, since both shapes return
 * the same reading.
 */
export function readForge(repo: string, api: ForgeApi): ForgeReading {
    const record = asObject(api.get(`repos/${repo}`));
    if (record === null) return UNREAD_FORGE;
    const branch = record['default_branch'];
    const autoMerge = record['allow_auto_merge'];
    return {
        defaultBranch: typeof branch === 'string' && branch !== '' ? branch : null,
        // Never coerced: a flag the payload did not carry as a boolean is a flag
        // nobody read, and `unread` is the state reserved for exactly that.
        allowAutoMerge: typeof autoMerge === 'boolean' ? autoMerge : null,
        rulesets: readRulesets(repo, api),
        deployRestricted: readDeployRestricted(repo, api),
    };
}

/**
 * Wrap an API in a whole-command budget.
 *
 * **Per-call timeouts bound each call and nothing bounds their sum.** Five
 * calls at a ten-second ceiling can take fifty seconds without any one of them
 * misbehaving, so the advertised ceiling is not the one a user experiences.
 * This adds the missing deadline, and it does so by returning `null` once the
 * budget is spent — which routes straight into the `unread` degradation the
 * rest of this module already guarantees. Running out of time therefore reads
 * as *nobody looked*, never as *the forge said no*; that direction is the one
 * that matters and it is pinned by a test.
 */
export function withDeadline(api: ForgeApi, remaining: () => number): ForgeApi {
    return {
        get(apiPath: string, paginate?: boolean): unknown | null {
            return remaining() <= 0 ? null : api.get(apiPath, paginate);
        },
    };
}

/**
 * Milliseconds left of a budget of `ms`, never below zero.
 *
 * The clock is `performance.now`, which is monotonic. `Date.now` is wall-clock
 * and steppable: an NTP correction backwards silently extends the budget past
 * its stated ceiling and one forwards expires it early. The word was in the
 * first draft's comment while the implementation used the steppable clock.
 */
export function budgetOf(
    ms: number,
    now: () => number = () => performance.now(),
): () => number {
    const until = now() + ms;
    return () => Math.max(0, until - now());
}

/** What {@link forgeReadingFor} needs. Every field injectable, so no test spawns. */
export interface ForgeReadRequest {
    readonly env: Readonly<Record<string, string | undefined>>;
    /**
     * Resolve the repository — a THUNK rather than a value, so the opt-out can
     * run before it. Resolving reads the git remote, which is a subprocess; an
     * opt-out that only skipped the API calls would still spawn `git` to work
     * out a repository it was never going to use, and "this switch makes no
     * network calls" would be true of the HTTP traffic and false of the claim
     * a reader takes from it.
     */
    readonly resolveRepo: () => ForgeTarget | null;
    /**
     * Build the API for the resolved target.
     *
     * A FACTORY rather than a ready API, so the host and working directory the
     * slug came from necessarily reach `gh`. Handing in a pre-built client was
     * how the two halves of the read came to address different repositories.
     */
    readonly apiFor: (target: ForgeTarget) => ForgeApi;
    /** Milliseconds left. Defaults to a {@link FORGE_TOTAL_BUDGET_MS} budget. */
    readonly remaining?: () => number;
}

/**
 * A reading plus the repository it came from.
 *
 * **The slug travels with the rows, and leaving it out was the review's one
 * high finding.** The moment the read went live, *which repository* stopped
 * being obvious: `origin` may point at a fork, a mirror, or — in a consumer
 * install — somebody else's project entirely, and five rows reading `satisfied`
 * say nothing about whose branch is protected. For a block whose own header
 * calls an unstated provenance the guess it exists to refuse, that was the one
 * fact the provenance omitted. `null` when nothing was read.
 */
export interface ForgeRead {
    readonly repo: string | null;
    readonly reading: ForgeReading;
}

/**
 * The production entry: read the forge, or return the unread reading.
 *
 * Three skips happen BEFORE any process spawns — an opt-out switch, the general
 * offline switch, and an unresolvable repository — and each is asserted on the
 * CALL LIST rather than on the return value, because a reader that queried and
 * then discarded would satisfy an output-only assertion while still paying the
 * latency the opt-out exists to avoid.
 *
 * The `catch` is not defensive padding. `doctor` is the command people run when
 * something is already wrong; a diagnostic that dies because its own optional
 * read threw is strictly worse than one reporting `unread`.
 */
export function forgeReadingFor(req: ForgeReadRequest): ForgeRead {
    if (forgeReadDisabled(req.env)) return { repo: null, reading: UNREAD_FORGE };
    // The budget is built BEFORE the repository is resolved, because resolving
    // spawns `git` and a budget that starts after it does not bound it.
    const remaining = req.remaining ?? budgetOf(FORGE_TOTAL_BUDGET_MS);
    try {
        const target = req.resolveRepo();
        if (target === null) return { repo: null, reading: UNREAD_FORGE };
        const reading = readForge(target.slug, withDeadline(req.apiFor(target), remaining));
        return { repo: target.slug, reading };
    } catch {
        return { repo: null, reading: UNREAD_FORGE };
    }
}

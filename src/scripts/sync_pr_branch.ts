#!/usr/bin/env tsx
/**
 * Bring the branch up to its PR base before a push, so the PR never goes stale.
 *
 * `check_branch_freshness` already DETECTS "behind the base" and refuses the
 * push. What did not exist was the other half: doing something about it. So the
 * documented sequence — freshness → merge the base in → regenerate → verify →
 * push (`/create-pr` § 1b-ii) — was entirely model-carried, and a step carried
 * only by prose is a step that gets skipped under time pressure. Measured on
 * PR #1391: the base moved three times during one run, the push was rejected
 * twice for it, and the PR reached `CONFLICTING` before anyone noticed.
 *
 * Deliberately NOT wired into the pre-push hook. This MUTATES the working tree —
 * a merge commit, possibly regenerated files — and a hook that rewrites the tree
 * mid-push turns one rejected push into an unreviewed commit. Detection belongs
 * in the hook (and is already there); resolution belongs to a step the agent runs
 * with the result in front of it.
 *
 * A conflict is NOT auto-resolved and never will be by this script. It stops,
 * names the conflicted paths, and says which of them are generated (regenerate,
 * do not hand-merge) versus authored (a human decision). Auto-resolving a
 * content conflict is how a parallel session's work disappears.
 *
 * Classification changes the ADVICE, not the conflict. A path stays a hotspot by
 * frequency while becoming mechanical to resolve, so a class added here is never
 * conflict-count reduction and must not be banked as drawdown (AI council
 * 2026-08-21, both seats; roadmap road-to-merge-hotspot-drawdown).
 *
 * Exit codes: 0 = already current, or merged cleanly · 1 = conflict, or the base
 * could not be resolved · 2 = internal error. `scanned:` on every path.
 */

import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    MissingBranchConvergencePolicy,
    UnresolvableTargetSha,
    loadPolicyAtSha,
    type ShaFileReader,
} from './_lib/branch_convergence.js';
import { reportScanned } from './_lib/scan_scope.js';

const NETWORK_TIMEOUT_MS = 8_000;

/** Paths that are GENERATED — a conflict here is regenerated, never hand-merged. */
const GENERATED = [
    // Untracked in THIS repository since 2026-08-21 (it was the #1 conflict
    // path: 830 commits/60d, in the conflict set of every open CONFLICTING PR).
    // The entry STAYS anyway, and the retirement criterion is a declared window
    // rather than "one release" — the AI council flagged the release count as
    // arbitrary and unverifiable. Remove this entry once no open branch predates
    // the untrack commit, which is checkable:
    //
    //   git branch -r --contains <untrack-commit>   # must list every open branch
    //
    // Until then a straggler branch created before the untrack still carries the
    // tracked file, and a conflict on it is still resolved by regeneration.
    'agents/roadmaps-progress.md',
    'agents/index.md',
    'docs/catalog.md',
    'dist/agent-src/',
    // Written by `src/scripts/adr/regenerate_index.ts`, which takes the decisions
    // directory as an ARGUMENT — so the path literal appears nowhere in the
    // generator and every grep-based audit of this list missed it. Found instead
    // by measurement: 4 of the last 50 sessions resolved a conflict here, and
    // its only correct resolution is `task regenerate-adr-index`, never a hunk
    // merge of two append-shaped indexes.
    'docs/decisions/INDEX.md',
    // Compiled by `compile_router.ts`. The `dist/agent-src/` prefix above does
    // NOT match a sibling one level up under `dist/`, so this file was routed to
    // a human decision despite being pure build output.
    'dist/router.json',
    '.augment/',
    // Compiled from `hook_manifest.yaml` by `task build-ts`, never hand-written.
    // It was classified AUTHORED until 2026-08-20, so this tool told the reader
    // to "read both sides" on a file where mixing hunks yields a concern table
    // matching NEITHER branch. One session resolved this same conflict three
    // times and named it structural: main adds a concern and recompiles, so
    // every open branch collides here. Regenerate; never merge.
    'src/scripts/hook_manifest.json',
    // Written together by one `build_archive_index.ts` call (`:409-410`) from the
    // archived roadmap tree, so neither is ever hand-authored. They were
    // classified AUTHORED until 2026-08-21, which made this tool ask for a human
    // decision about a file whose only correct resolution is regeneration --
    // the identical defect the hook_manifest.json comment above records, on two
    // more paths at 47 commits/60d each. They conflict in 2 of the 7 open PRs
    // measured for road-to-merge-hotspot-drawdown. Regenerate; never merge.
    'agents/roadmaps/archive/INDEX.md',
    'agents/roadmaps/archive/index.json',
    // ── Added 2026-08-25 (road-to-merge-surface-zero 1.1). Each carries its
    // write site, because this list tells a human to DISCARD one side, and an
    // entry added on a conflict count alone would tell them to discard hand
    // work. Counts are from `pr_conflict_census --limit 2000` over 60 days.
    //
    // Written by `build_proof.ts:500` from `docs/CLAIMS.md`. 26 resolutions, and
    // it fails in pairs: a CLAIMS.md edit leaves it stale, which reds both the
    // drift-guard test and `demo-commands-still-pass`.
    'docs/proof.md',
    // Both written by `generate_catalog.ts` (`:166` for llms.txt) from SKILL.md
    // frontmatter. Neither has ever been hand-authored.
    'docs/skills-catalog.md',
    'llms.txt',
    // Written by `lint_originality.ts:340`. Named by step 1.1 and included
    // although the census found ZERO conflicts on it in either window — it is
    // genuinely generated and classifying it costs nothing. Recorded rather than
    // quietly dropped: the step named it on conflict frequency, and that premise
    // does not hold.
    'agents/reports/originality.json',
    'agents/reports/originality.md',
];

/**
 * Generated paths a literal cannot express.
 *
 * `isGenerated` matches on equality or a trailing-slash prefix, so a per-pack
 * manifest needs a pattern. Kept as a separate named list rather than by
 * loosening the literal matcher: a glob inside the array above would make every
 * future entry ambiguous about which kind of match it asks for.
 */
const GENERATED_PATTERNS: readonly { readonly re: RegExp; readonly why: string }[] = [
    {
        // `generate_pack_manifests.ts:427`, and the file's own first line is
        // the do-not-edit header that generator writes.
        // 12 resolutions over 60 days across two packs.
        re: /^src\/domains\/[^/]+\/pack\.yaml$/,
        why: 'per-pack manifest written by generate_pack_manifests.ts',
    },
];

/**
 * Paths that are MEASURED BASELINES -- a conflict here is neither regenerated
 * nor hand-merged. It is RE-MEASURED on the merged tree, and the number that
 * measurement produces is the resolution.
 *
 * Why this is a third class and not a variant of GENERATED: a generated file has
 * one correct content given the tree, so "regenerate" is a complete instruction.
 * A ratchet baseline records what a tree MEASURED at a point in time, and two
 * branches legitimately measured two different trees -- so there is no side to
 * take and no file to re-render. Picking a side on a ratchet number is how the
 * ratchet silently loosens, and mixing hunks yields a baseline matching neither
 * branch.
 *
 * Why this tool never performs the re-measurement itself (AI council 2026-08-21,
 * both seats): "re-measure instead of merge" delegates conflict resolution to a
 * script and its execution environment, and a wrong or environment-dependent
 * measurement would overwrite a deliberate tightening with nothing objecting,
 * because the result looks measured either way. So this class NAMES the
 * resolution and stops. The human runs it, with the result in front of them.
 *
 * `gate-violation-baselines.json` conflicted in 7 of the 7 open PRs measured for
 * road-to-merge-hotspot-drawdown, and it is not gitignorable: its counts are not
 * a function of the tree, so the committed number is the only "before" side that
 * exists.
 *
 * `estate-count-budget.json` USED to be the other member and is deliberately not
 * listed any more (ADR-243). Its metrics ARE a function of the tree, so
 * `check_estate_count` measures the floor at the base ref instead of storing it,
 * and the file now carries policy only. A conflict in it is an ordinary AUTHORED
 * one — two humans editing the same policy sentence — and telling the reader to
 * "re-run the measurement" for that would name a resolution the file no longer
 * has. Removing the row is the point of the change, not an oversight: the row
 * described a conflict that no longer occurs.
 */
const REMEASURED = ['src/config/gate-violation-baselines.json'];

function sh(cmd: string, args: readonly string[], cwd: string): { ok: boolean; out: string; err: string } {
    const r = spawnSync(cmd, [...args], {
        cwd,
        encoding: 'utf-8',
        timeout: NETWORK_TIMEOUT_MS,
        maxBuffer: 32 * 1024 * 1024,
    });
    return { ok: r.status === 0, out: r.stdout ?? '', err: (r.stderr ?? '').trim() };
}

/** True when `rel` is a generated artefact rather than an authored one. */
/**
 * The subset of GENERATED that this repository no longer commits at all
 * (`road-to-generated-artifacts-out-of-index`, 2026-08-22). They are still
 * generated, so they stay in `GENERATED` and keep being reported — a straggler
 * branch created before the untrack still carries them, which is exactly when
 * the reader needs to be told something.
 *
 * What changes is the INSTRUCTION. A branch that predates the cutover hits a
 * `modify/delete` conflict here, not a content conflict, and `git checkout
 * --ours` has no side to check out: the correct resolution is to take the
 * deletion. Printing the generic advice would send the reader to re-add the
 * file, which is precisely how PR #1505 put the dashboard back on `main` a day
 * after it was first untracked.
 */
const UNTRACKED_BY_DESIGN: readonly string[] = [
    'agents/roadmaps-progress.md',
    'agents/roadmaps/archive/INDEX.md',
    'agents/roadmaps/archive/index.json',
];

/** Is this a generated path this repository deliberately does not commit? */
export function isUntrackedByDesign(rel: string): boolean {
    return UNTRACKED_BY_DESIGN.includes(rel);
}

export function isGenerated(rel: string): boolean {
    const norm = rel.replace(/\\/g, '/');
    if (GENERATED.some((g) => (g.endsWith('/') ? norm.startsWith(g) : norm === g))) return true;
    return GENERATED_PATTERNS.some((p) => p.re.test(norm));
}

/**
 * True when `rel` is listed as a measured ratchet baseline.
 *
 * This does NOT assert exclusivity against `GENERATED` — it only reads its own
 * array. `classifyConflicts` establishes the precedence (generated first), so a
 * path added to both arrays would route as generated while this predicate also
 * returned true, and no test would catch it. Keep the arrays disjoint; the
 * per-path exclusivity assertions in the test file cover today's two members
 * only.
 */
export function isRemeasured(rel: string): boolean {
    const norm = rel.replace(/\\/g, '/');
    return REMEASURED.some((g) => (g.endsWith('/') ? norm.startsWith(g) : norm === g));
}

export interface Plan {
    /** 0 = nothing to do or merged · 1 = needs a human · 2 = internal. */
    exit: 0 | 1 | 2;
    message: string;
    /** Conflicted paths, split so the caller knows which to regenerate. */
    generated: string[];
    /** Conflicted measured baselines — re-measure on the merged tree, never merge. */
    remeasured: string[];
    authored: string[];
    scanned: number;
}

/**
 * Classify a conflicted file list.
 *
 * Pure, so the split is testable without producing a real merge conflict — and
 * the split is the useful part: a generated conflict has one correct resolution
 * (regenerate) and an authored one has none that a script may choose.
 */
export function classifyConflicts(files: readonly string[]): Pick<Plan, 'generated' | 'remeasured' | 'authored'> {
    const generated: string[] = [];
    const remeasured: string[] = [];
    const authored: string[] = [];
    for (const f of files) {
        const rel = f.trim();
        if (rel === '') continue;
        if (isGenerated(rel)) generated.push(rel);
        else if (isRemeasured(rel)) remeasured.push(rel);
        else authored.push(rel);
    }
    return { generated, remeasured, authored };
}

/**
 * Render the conflict report for a plan that needs a human.
 *
 * Pure and exported so the WORDING is testable without producing a real merge
 * conflict. That matters more than it looks: the per-class instruction is the
 * entire value of the classification, and while this lived inline in `main()`
 * the whole block could be deleted and every test stayed green — the header
 * still counted the conflict, and the paths went unnamed with no instruction.
 */
export function renderConflictReport(plan: Plan): string {
    const out: string[] = [`❌  ${plan.message}\n`];
    const untracked = plan.generated.filter(isUntrackedByDesign);
    const regenerable = plan.generated.filter((f) => !isUntrackedByDesign(f));
    if (regenerable.length > 0) {
        out.push(`\n  GENERATED (${String(regenerable.length)}) — resolve by REGENERATING, never by mixing hunks:\n`);
        for (const f of regenerable) out.push(`    · ${f}\n`);
        out.push('    → git checkout --ours <file> && task sync && task generate-tools\n');
    }
    if (untracked.length > 0) {
        out.push(
            `\n  UNTRACKED BY DESIGN (${String(untracked.length)}) — this repository does not commit these; TAKE THE DELETION:\n`,
        );
        for (const f of untracked) out.push(`    · ${f}\n`);
        out.push('    → git rm --cached -- <file>   (the working-tree copy stays; regenerate it locally)\n');
    }
    if (plan.remeasured.length > 0) {
        out.push(
            `\n  REMEASURED (${String(plan.remeasured.length)}) — RE-RUN THE MEASUREMENT on the merged tree; never merge, never pick a side:\n`,
        );
        for (const f of plan.remeasured) out.push(`    · ${f}\n`);
        out.push('    → resolve the tree, then re-run the gate that owns the baseline and record its number\n');
    }
    if (plan.authored.length > 0) {
        out.push(`\n  AUTHORED (${String(plan.authored.length)}) — a human decision, read both sides:\n`);
        for (const f of plan.authored) out.push(`    · ${f}\n`);
    }
    return out.join('');
}

/**
 * Why the base is a SET now, and what each entry means.
 *
 * The old resolution was an EXCLUSIVE chain — `--base`, then the open PR's
 * base, then `origin/HEAD` — so a PR targeting a release line or a stacked
 * parent was kept current with its target and arbitrarily stale against the
 * default branch. Whether the default belongs in the set is a policy question
 * decided per target and read from the TARGET's own commit; see
 * `_lib/branch_convergence.ts` for the decision and the trust boundary.
 */
export type BaseReason =
    | 'pull-request-target'
    | 'explicit-base-override'
    | 'repository-default-branch'
    | 'branch-convergence-policy:include-default';

export interface BaseEntry {
    readonly ref: string;
    readonly reason: BaseReason;
}

/**
 * One stable structured type for every outcome.
 *
 * Deliberately NOT "an array normally, an object when the policy is off": a
 * shape that varies by outcome couples every consumer to ad-hoc type
 * discrimination, which the council flagged as a real architectural objection.
 */
export interface ResolveBaseResult {
    readonly entries: readonly BaseEntry[];
    readonly policyStatus: 'applied' | 'not-required' | 'disabled';
}

/** Neither an open PR nor a default branch answered. Distinct from a missing policy. */
export class UnresolvableBase extends Error {
    constructor(detail: string) {
        super(`unresolvable — ${detail}`);
        this.name = 'UnresolvableBase';
    }
}

/**
 * The git questions base resolution asks, as data.
 *
 * Injected rather than called inline so the twelve council fixtures can be
 * exercised without a network, a forge, or a real release line — this
 * repository has none, so a live fixture could only ever cover the
 * default-target path.
 */
export interface BaseDeps {
    readonly currentBranch: () => string;
    /** The open PR's `baseRefName`, bare (`release/1.x`), or null. */
    readonly prBase: (branch: string) => string | null;
    /** The default branch as a remote-tracking ref (`origin/main`), or null. */
    readonly defaultBranch: () => string | null;
    /** The SHA the server reports for a ref right now, or null. */
    readonly remoteSha: (ref: string) => string | null;
    readonly readAtSha: ShaFileReader;
}

export function makeGitDeps(repo: string): BaseDeps {
    return {
        currentBranch: (): string => sh('git', ['rev-parse', '--abbrev-ref', 'HEAD'], repo).out.trim(),
        prBase: (branch: string): string | null => {
            if (branch === '' || branch === 'HEAD') return null;
            // The forge knows the REAL base, which matters for a stacked or
            // release-line PR: measuring against the repo default would compare
            // against a branch this PR never merges into.
            const pr = sh('gh', ['pr', 'list', '--head', branch, '--state', 'open', '--json', 'baseRefName', '--limit', '1'], repo);
            if (!pr.ok) return null;
            try {
                const rows = JSON.parse(pr.out || '[]') as Array<{ baseRefName?: string }>;
                const b = rows[0]?.baseRefName;
                return typeof b === 'string' && b !== '' ? b : null;
            } catch {
                return null;
            }
        },
        // ASK THE SERVER first, and only then fall back to the local ref.
        //
        // The local-only form was this module's whole answer until the default
        // branch became load-bearing here: the policy's `include` needs a ref to
        // add, and the target-is-default identity check needs one to compare
        // against. Measured in this worktree on 2026-09-03 — `refs/remotes/
        // origin/HEAD` is not set, so the local form returned null and
        // `sync_pr_branch` reported "no open PR and no origin/HEAD" while
        // `check_branch_freshness`, standing three lines away in the same
        // sequence, resolved `origin/main` from the server symref and passed.
        // Two resolvers disagreeing about the base is the defect this roadmap
        // exists to close, one layer down. Mirrors
        // `check_branch_freshness.ts:223` `serverDefaultBase`.
        defaultBranch: (): string | null => {
            const remote = sh('git', ['ls-remote', '--symref', 'origin', 'HEAD'], repo);
            const fromServer = remote.ok ? parseSymrefDefault(remote.out) : null;
            if (fromServer !== null) return fromServer;
            const head = sh('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], repo);
            return head.ok && head.out.trim() !== '' ? head.out.trim() : null;
        },
        remoteSha: (ref: string): string | null => {
            const bare = ref.replace(/^origin\//, '');
            const out = sh('git', ['ls-remote', '--heads', 'origin', bare], repo);
            if (!out.ok) return null;
            const sha = out.out.trim().split(/\s+/)[0];
            return sha !== undefined && /^[0-9a-f]{40}$/.test(sha) ? sha : null;
        },
        // `git show <sha>:<path>` and nothing else. There is no filesystem read
        // here by construction: a policy the PR head carries must not be able to
        // change the criteria the PR is judged against.
        readAtSha: (sha: string, rel: string): string | null => {
            const out = sh('git', ['show', `${sha}:${rel}`], repo);
            return out.ok ? out.out : null;
        },
    };
}

/**
 * The default branch the SERVER reports, from `git ls-remote --symref origin HEAD`.
 *
 * Pure and exported so the parse is testable without a network round trip, and
 * because it closes a measured defect rather than a hypothetical one. Until
 * 2026-09-03 this module read the default branch from `refs/remotes/origin/HEAD`
 * alone — a clone-time ref that is simply absent in some checkouts. Measured in
 * a worktree of this repository the same day: the local form returned null, so
 * `sync_pr_branch` refused with "no open PR and no origin/HEAD" while
 * `check_branch_freshness`, three lines later in the same documented sequence,
 * resolved `origin/main` from the server symref and passed. Two resolvers
 * disagreeing about the base is this roadmap's own subject one layer down, and
 * the default branch stopped being cosmetic here the moment the policy's
 * `include` needed a ref to add. Mirrors `check_branch_freshness.ts:223`.
 */
export function parseSymrefDefault(lsRemoteOut: string): string | null {
    for (const line of lsRemoteOut.split('\n')) {
        const t = line.trim();
        if (!t.startsWith('ref:')) continue;
        const name = t.slice('ref:'.length).trim().split(/\s+/)[0] ?? '';
        if (!name.startsWith('refs/heads/')) continue;
        const short = name.slice('refs/heads/'.length).trim();
        if (short !== '') return `origin/${short}`;
    }
    return null;
}

/** Strip the remote prefix so a policy key is the branch name a human writes. */
function bareName(ref: string): string {
    return ref.replace(/^origin\//, '');
}

/**
 * Resolve the base SET this branch has to be current with.
 *
 * Throws rather than returning a partial set: `MissingBranchConvergencePolicy`
 * when a non-default target names no entry, `UnresolvableTargetSha` when the
 * target names no commit, `UnresolvableBase` when nothing answered at all.
 * Neither inclusion nor exclusion is universally safe, so an absent entry must
 * not manufacture repository intent.
 */
export function resolveBase(repo: string, override: string | null, deps: BaseDeps = makeGitDeps(repo)): ResolveBaseResult {
    const defaultRef = deps.defaultBranch();

    let target: BaseEntry;
    if (override !== null && override.trim() !== '') {
        target = { ref: override.trim(), reason: 'explicit-base-override' };
    } else {
        const pr = deps.prBase(deps.currentBranch());
        if (pr !== null) {
            target = { ref: `origin/${pr}`, reason: 'pull-request-target' };
        } else if (defaultRef !== null) {
            target = { ref: defaultRef, reason: 'repository-default-branch' };
        } else {
            throw new UnresolvableBase('no open PR and no origin/HEAD');
        }
    }

    // A PR targeting the default branch needs no entry — identity by ref name,
    // or by the SHA both names resolve to.
    const sameName = defaultRef !== null && bareName(target.ref) === bareName(defaultRef);
    const targetSha = deps.remoteSha(target.ref);
    const defaultSha = defaultRef === null ? null : deps.remoteSha(defaultRef);
    const sameSha = targetSha !== null && defaultSha !== null && targetSha === defaultSha;
    if (sameName || sameSha) {
        return { entries: [target], policyStatus: 'not-required' };
    }

    if (targetSha === null) {
        throw new UnresolvableTargetSha(bareName(target.ref));
    }
    const policy = loadPolicyAtSha(targetSha, deps.readAtSha);
    if (policy === null) {
        throw new MissingBranchConvergencePolicy(bareName(target.ref));
    }
    if (!policy.enabled) {
        // The kill switch. Surfaced as BYPASSED by `renderBaseSummary`, never as
        // a pass — a caller that discards stderr would otherwise read a bypass
        // as a clean run.
        return { entries: [target], policyStatus: 'disabled' };
    }
    const entry = policy.targets[bareName(target.ref)];
    if (entry === undefined) {
        throw new MissingBranchConvergencePolicy(bareName(target.ref));
    }
    if (entry.defaultBranch === 'exclude') {
        return { entries: [target], policyStatus: 'applied' };
    }
    if (defaultRef === null) {
        throw new UnresolvableBase('policy says include the default branch, but origin/HEAD names none');
    }
    return {
        entries: [target, { ref: defaultRef, reason: 'branch-convergence-policy:include-default' }],
        policyStatus: 'applied',
    };
}

/**
 * The order the refs are MERGED in — default first, then the target.
 *
 * Deliberately not the order `entries` carries. The result type is target-first
 * because the target is the ref the PR actually merges into and the stable head
 * of the contract (council § 4, fixture 4); integration is default-first so a
 * conflict surfaces against the BROADER base before the narrower one, where it
 * is cheapest to abandon (roadmap step 1.3). Both orders are stated here rather
 * than one being inferred from the other.
 */
export function integrationOrder(r: ResolveBaseResult): string[] {
    const policyAdded = r.entries.filter((e) => e.reason === 'branch-convergence-policy:include-default');
    const rest = r.entries.filter((e) => e.reason !== 'branch-convergence-policy:include-default');
    return [...policyAdded, ...rest].map((e) => e.ref);
}

/** Human-readable provenance per entry — the `how` string, one per ref. */
export function describeReason(reason: BaseReason): string {
    switch (reason) {
        case 'explicit-base-override':
            return 'given by --base';
        case 'pull-request-target':
            return 'the open PR base';
        case 'repository-default-branch':
            return 'the repo default branch';
        case 'branch-convergence-policy:include-default':
            return 'the default branch, added by the branch-convergence policy';
    }
}

/**
 * The verdict line for a resolved set, in INTEGRATION order.
 *
 * `disabled` renders as BYPASSED and carries no success marker. A stderr
 * warning is not enough — callers discard stderr, and a bypass reported only
 * there is indistinguishable from a pass.
 */
export function renderBaseSummary(r: ResolveBaseResult): string {
    const byRef = new Map(r.entries.map((e) => [e.ref, e.reason]));
    const parts = integrationOrder(r).map((ref) => `${ref} (${describeReason(byRef.get(ref) as BaseReason)})`);
    const head = r.policyStatus === 'disabled'
        ? 'BYPASSED — branch-convergence policy disabled at the target commit; the default branch was NOT considered'
        : r.policyStatus === 'applied'
          ? 'branch-convergence policy applied'
          : 'no branch-convergence policy required (target is the default branch)';
    return `${head}; integrating in order: ${parts.join(' → ')}`;
}

/** The ceiling on base-moved retries. A bound, never a queue (roadmap 4.2). */
export const MAX_BASE_ATTEMPTS = 3;

/** One integration attempt against one ref, with the OIDs that bracket it. */
export interface IntegrationAttempt {
    readonly attempt: number;
    readonly ref: string;
    /** The OID the merge was planned against. */
    readonly before: string | null;
    /** The OID the server reported after the merge finished. */
    readonly after: string | null;
}

export interface IntegrationOutcome {
    readonly ok: boolean;
    readonly attempts: readonly IntegrationAttempt[];
    readonly conflicted: readonly string[];
    readonly message: string;
}

/** The git operations the retry loop needs, injected so a moving base is testable. */
export interface IntegrateOps {
    readonly remoteSha: (ref: string) => string | null;
    readonly merge: (ref: string) => { ok: boolean; conflicted: string[] };
}

function renderAttempts(attempts: readonly IntegrationAttempt[]): string {
    return attempts
        .map((a) => `  attempt ${String(a.attempt)}: ${a.ref} ${a.before ?? '?'} → ${a.after ?? '?'}`)
        .join('\n');
}

/**
 * Integrate every ref in the set, pinning each base OID and re-checking it.
 *
 * Gap C is measured, not hypothetical: `sync_pr_branch.ts:10` records PR #1391,
 * where the base moved three times during one run and the push was rejected.
 * The bound is three attempts and then a STOP carrying the observed OIDs —
 * reporting the evidence is what makes a genuinely moving base distinguishable
 * from a slow run, which is the whole point of the ceiling. No state outside the
 * run: no queue, no rerere, no persisted attempt log (roadmap 4.2, AC-5).
 */
export function integrateWithPinnedBase(refs: readonly string[], ops: IntegrateOps): IntegrationOutcome {
    const attempts: IntegrationAttempt[] = [];
    for (let n = 1; n <= MAX_BASE_ATTEMPTS; n++) {
        const pinned = refs.map((ref) => ({ ref, before: ops.remoteSha(ref) }));
        let conflicted: string[] = [];
        let clean = true;
        for (const q of pinned) {
            const m = ops.merge(q.ref);
            if (!m.ok) {
                clean = false;
                conflicted = m.conflicted;
                break;
            }
        }
        const moved: string[] = [];
        for (const q of pinned) {
            const after = ops.remoteSha(q.ref);
            attempts.push({ attempt: n, ref: q.ref, before: q.before, after });
            if (after !== q.before) moved.push(q.ref);
        }
        if (!clean) {
            return {
                ok: false,
                attempts,
                conflicted,
                message: `merge hit ${String(conflicted.length)} conflict(s) on attempt ${String(n)}.`,
            };
        }
        if (moved.length === 0) {
            return { ok: true, attempts, conflicted: [], message: `integrated ${refs.join(', ')} on attempt ${String(n)}.` };
        }
    }
    return {
        ok: false,
        attempts,
        conflicted: [],
        message:
            `the base moved under every one of ${String(MAX_BASE_ATTEMPTS)} attempts — stopping rather than looping.\n` +
            `${renderAttempts(attempts)}\n` +
            '  → a base that moves this fast is a finding about landing speed, not a transient race.',
    };
}

/** The regeneration operations Phase 3 needs, injected so no real conflict is required. */
export interface RegenOps {
    readonly regenerate: () => { ok: boolean; err: string };
    /** Paths that still differ after a regeneration — the byte-identity probe. */
    readonly dirty: (paths: readonly string[]) => string[];
    readonly stage: (paths: readonly string[]) => boolean;
}

export interface GeneratedResolution {
    readonly resolved: boolean;
    readonly message: string;
}

/**
 * Auto-resolve a conflict set that is GENERATED and nothing else.
 *
 * For a path whose only correct resolution is "run the generator", refusing is
 * ceremony — the classification at `classifyConflicts` already knows which
 * paths those are. Two hard limits, and both are the point rather than caution:
 *
 * - A single REMEASURED or AUTHORED path in the set refuses the WHOLE set. A
 *   measured baseline and a hand-written file have no single correct
 *   resolution, and resolving their neighbours first would hand the human a
 *   half-resolved tree to reason about.
 * - Byte-identity is ASSERTED, not assumed: the generator runs, the outputs are
 *   staged, and the generator runs again. A path that is partly hand-edited does
 *   not reproduce, so the second run leaves it dirty and the resolution is
 *   refused instead of silently overwriting the hand edit (risk-register row 2).
 */
export function autoResolveGenerated(
    split: Pick<Plan, 'generated' | 'remeasured' | 'authored'>,
    ops: RegenOps,
): GeneratedResolution {
    if (split.remeasured.length > 0 || split.authored.length > 0) {
        return {
            resolved: false,
            message:
                'NOT auto-resolved: the conflict set contains ' +
                `${String(split.remeasured.length)} remeasured and ${String(split.authored.length)} authored path(s), ` +
                'which have no single correct resolution.',
        };
    }
    if (split.generated.length === 0) {
        return { resolved: false, message: 'nothing to auto-resolve.' };
    }
    const first = ops.regenerate();
    if (!first.ok) {
        return { resolved: false, message: `NOT auto-resolved: regeneration failed — ${first.err.split('\n')[0] ?? '?'}` };
    }
    if (!ops.stage(split.generated)) {
        return { resolved: false, message: 'NOT auto-resolved: could not stage the regenerated paths.' };
    }
    const second = ops.regenerate();
    if (!second.ok) {
        return { resolved: false, message: `NOT auto-resolved: the byte-identity re-run failed — ${second.err.split('\n')[0] ?? '?'}` };
    }
    const drift = ops.dirty(split.generated);
    if (drift.length > 0) {
        return {
            resolved: false,
            message:
                'NOT auto-resolved: these paths are not byte-identical to a clean regeneration, ' +
                `so at least one is partly hand-edited — ${drift.join(', ')}`,
        };
    }
    return {
        resolved: true,
        message: `auto-resolved ${String(split.generated.length)} generated conflict(s) by regeneration, byte-identity asserted.`,
    };
}

function gitRegenOps(repo: string): RegenOps {
    return {
        // The repository's own consistency target — the exact CI mirror the
        // pre-push hook already runs. Named here rather than open-coded so the
        // generator this trusts is the one the gate trusts.
        regenerate: (): { ok: boolean; err: string } => {
            const r = sh('task', ['consistency'], repo);
            return { ok: r.ok, err: r.err };
        },
        dirty: (paths: readonly string[]): string[] => {
            const r = sh('git', ['status', '--porcelain', '--', ...paths], repo);
            if (!r.ok) return [...paths];
            return r.out
                .split('\n')
                .map((l) => l.slice(3).trim())
                .filter((l) => l !== '');
        },
        stage: (paths: readonly string[]): boolean => sh('git', ['add', '--', ...paths], repo).ok,
    };
}

export function sync(repo: string, baseOverride: string | null, dryRun: boolean, autoResolve = false): Plan {
    let resolved: ResolveBaseResult;
    try {
        resolved = resolveBase(repo, baseOverride);
    } catch (exc) {
        // A missing policy, an unresolvable target SHA and an unresolvable base
        // are all REFUSALS carrying their own typed message. None of them
        // degrades to "check the default branch instead".
        return {
            exit: 1,
            message: `cannot resolve a base set to update against — ${exc instanceof Error ? exc.message : String(exc)}`,
            generated: [],
            remeasured: [],
            authored: [],
            scanned: 0,
        };
    }
    const summary = renderBaseSummary(resolved);
    const order = integrationOrder(resolved);

    const fetched = sh('git', ['fetch', 'origin', '--prune'], repo);
    if (!fetched.ok) {
        // Unreachable remote is not "already current" — saying so is the whole
        // point, since a silent pass here reproduces the staleness this closes.
        return {
            exit: 0,
            message: `unverified — could not fetch origin (${fetched.err.split('\n')[0] ?? '?'}). Base freshness NOT checked.`,
            generated: [],
            remeasured: [],
            authored: [],
            scanned: 0,
        };
    }

    const behindEach = order.map((ref) => ({
        ref,
        behind: Number(sh('git', ['rev-list', '--count', `HEAD..${ref}`], repo).out.trim() || '0'),
    }));
    // De-duplicated by ancestry: a ref already contained in HEAD is 0 behind and
    // is not merged again, which is what keeps a target that already contains
    // the default from being merged twice.
    const stale = behindEach.filter((b) => b.behind > 0);
    if (stale.length === 0) {
        return { exit: 0, message: `already current with every base ref — ${summary}.`, generated: [], remeasured: [], authored: [], scanned: order.length };
    }
    if (dryRun) {
        const detail = stale.map((b) => `${b.ref} (${String(b.behind)} behind)`).join(', ');
        return {
            exit: 0,
            message: `${summary}. Behind: ${detail} — would merge in that order. Dry run, nothing changed.`,
            generated: [],
            remeasured: [],
            authored: [],
            scanned: order.length,
        };
    }

    const outcome = integrateWithPinnedBase(
        stale.map((b) => b.ref),
        {
            remoteSha: (ref: string): string | null => makeGitDeps(repo).remoteSha(ref),
            merge: (ref: string): { ok: boolean; conflicted: string[] } => {
                const m = sh('git', ['merge', ref, '--no-edit'], repo);
                if (m.ok) return { ok: true, conflicted: [] };
                return {
                    ok: false,
                    conflicted: sh('git', ['diff', '--name-only', '--diff-filter=U'], repo).out.split('\n'),
                };
            },
        },
    );

    if (outcome.ok) {
        return {
            exit: 0,
            message:
                `${summary}. ${outcome.message} REGENERATE derived files now — a clean auto-merge of a ` +
                'generated file is still wrong.',
            generated: [],
            remeasured: [],
            authored: [],
            scanned: order.length,
        };
    }
    if (outcome.conflicted.length === 0) {
        // The base kept moving. No conflict to classify; the evidence IS the
        // per-attempt OID list already in the message.
        return { exit: 1, message: `${summary}. ${outcome.message}`, generated: [], remeasured: [], authored: [], scanned: order.length };
    }

    const split = classifyConflicts(outcome.conflicted);
    if (autoResolve) {
        const attempt = autoResolveGenerated(split, gitRegenOps(repo));
        if (attempt.resolved) {
            return { exit: 0, message: `${summary}. ${attempt.message}`, generated: [], remeasured: [], authored: [], scanned: order.length };
        }
        return {
            exit: 1,
            message: `${summary}. ${outcome.message} ${attempt.message}`,
            ...split,
            scanned: order.length,
        };
    }
    return {
        exit: 1,
        message:
            `${summary}. ${outcome.message} ` +
            'NOT auto-resolved: a content conflict is where a parallel session\'s work disappears. ' +
            '(--auto-resolve-generated resolves a set that is GENERATED and nothing else.)',
        ...split,
        scanned: order.length,
    };
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    let repo = process.cwd();
    let base: string | null = null;
    let dryRun = false;
    let quiet = false;
    let autoResolve = false;
    for (let i = 0; i < args.length; i++) {
        const a = args[i] as string;
        const val = (): string | null => {
            const v = args[++i];
            return v === undefined || v.startsWith('--') ? null : v;
        };
        if (a === '--repo') {
            const v = val();
            if (v === null) {
                process.stderr.write('❌  sync_pr_branch: --repo requires a value\n');
                reportScanned({ gate: 'sync_pr_branch', scanned: 0, units: 'base ref(s)', roots: ['origin'], allowEmpty: 'argument error' });
                return 1;
            }
            repo = v;
        } else if (a === '--base') {
            const v = val();
            if (v === null) {
                process.stderr.write('❌  sync_pr_branch: --base requires a value\n');
                reportScanned({ gate: 'sync_pr_branch', scanned: 0, units: 'base ref(s)', roots: ['origin'], allowEmpty: 'argument error' });
                return 1;
            }
            base = v;
        } else if (a === '--dry-run') {
            dryRun = true;
        } else if (a === '--auto-resolve-generated') {
            autoResolve = true;
        } else if (a === '--quiet') {
            quiet = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: sync_pr_branch [--repo PATH] [--base REF] [--dry-run] [--auto-resolve-generated] [--quiet]\n' +
                    '  Merges the PR base into the current branch so the PR does not go stale.\n' +
                    '  Resolves the base from the open PR when there is one. A conflict is\n' +
                    '  reported and never auto-resolved; generated and authored conflicts are\n' +
                    '  listed separately because only the first has one correct resolution;\n' +
                    '  measured ratchet baselines are a third class, re-measured not merged.\n' +
                    '  The base is a SET: a non-default target may also carry the default branch,\n' +
                    '  per the branch-convergence policy read at the TARGET commit. Integration\n' +
                    '  runs the default first so the broad conflict surfaces first.\n' +
                    '  --auto-resolve-generated resolves a conflict set that is GENERATED and\n' +
                    '  nothing else, by regenerating and asserting byte-identity.\n',
            );
            reportScanned({ gate: 'sync_pr_branch', scanned: 0, units: 'base ref(s)', roots: ['origin'], allowEmpty: 'help output' });
            return 0;
        } else {
            process.stderr.write(`❌  sync_pr_branch: unknown argument \`${a}\`\n`);
            reportScanned({ gate: 'sync_pr_branch', scanned: 0, units: 'base ref(s)', roots: ['origin'], allowEmpty: 'argument error' });
            return 1;
        }
    }

    let plan: Plan;
    try {
        plan = sync(repo, base, dryRun, autoResolve);
    } catch (exc) {
        reportScanned({ gate: 'sync_pr_branch', scanned: 0, units: 'base ref(s)', roots: ['origin'], allowEmpty: 'internal error' });
        process.stderr.write(`❌  sync_pr_branch: internal error: ${exc instanceof Error ? exc.message : String(exc)}\n`);
        return 2;
    }

    if (plan.exit === 1) {
        process.stdout.write(renderConflictReport(plan));
    } else if (plan.message.includes('BYPASSED')) {
        // The kill switch is a BYPASS, never a pass. Loud even under --quiet and
        // never behind a success marker: a caller that reads only stdout must
        // not be able to mistake a disabled policy for a clean run.
        process.stdout.write(`⚠️  sync_pr_branch: ${plan.message}\n`);
    } else if (plan.message.startsWith('unverified')) {
        // Loud even under --quiet: unverified reported silently is
        // indistinguishable from verified, which is the defect being closed.
        process.stdout.write(`⚠️  sync_pr_branch: ${plan.message}\n`);
    } else if (!quiet || plan.scanned > 0) {
        process.stdout.write(`✅  ${plan.message}\n`);
    }
    reportScanned({
        gate: 'sync_pr_branch',
        scanned: plan.scanned,
        units: 'base ref(s)',
        roots: ['origin'],
        ...(plan.scanned === 0 ? { allowEmpty: 'base unresolvable or remote unreachable — stated above' } : {}),
    });
    return plan.exit;
}

const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href || process.argv[1] === _HERE;
}
if (_isCliEntry()) {
    process.exit(main());
}

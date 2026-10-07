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
 * The base is the explicit `--base`, else the default branch. Nothing here asks
 * a forge which pull request the branch belongs to: a caller acting on a pull
 * request passes its base, and without `--base` the run is about the default
 * branch, which is right only for a branch that targets it.
 *
 * Exit codes: 0 = already current, or merged cleanly, or `unverified` (the
 * target resolved but its commit could not be fetched; nothing was touched) ·
 * 1 = conflict, git refusing the merge before it starts (a dirty tree, an
 * untracked file in the way — git's own line is printed), or the base could
 * not be resolved (no `--base` and no default
 * branch, a `--base` the server does not know, no origin, or origin unreachable
 * at the ref lookup) · 2 = internal error · 3 = behind, and
 * `git.update_strategy` is not `merge`, so the merge was refused (reason code
 * `TARGET_POLICY_STALE` when the branch is current with its non-default target
 * and that target is itself behind the default branch the policy adds — the
 * target's update, not this branch's; a branch also behind the target gets the
 * ordinary behind line first, naming the target's lag as a note) · 4 =
 * `git.update_strategy` cannot be read (a settings file or a committed
 * `.git-convention.yml` that does not parse, a value outside the schema, or a
 * value only a user-global file carries), so nothing was checked or merged; the line carries a stable reason
 * code (`git-convention-malformed` / `-invalid` / `-discarded` /
 * `-unresolvable`) and the file.
 * `scanned:` on every path.
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
import { checkoutSource, describeRefusal, isRefusal, readGitConventionKey, type GitConventionReading } from './_lib/git_convention.js';
import {
    conventionRoot,
    makeTargetDeps,
    memoTargetDeps,
    parseSymrefDefault,
    readCommittedConvention,
    resolveTarget,
    type ConventionTarget,
    type TargetDeps,
} from './_lib/git_convention_carrier.js';
import { baseValueError, splitResolvedRef } from './_lib/git_base_ref.js';
import { reportScanned } from './_lib/scan_scope.js';

export { parseSymrefDefault };

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
    /** Base refs the branch is behind — set by a dry run, so a caller can decide without parsing `message`. */
    behind?: number;
    /**
     * Set when the policy added the default branch and the TARGET itself is
     * behind it: updating the branch onto the target cannot make it current.
     * `branchBehind` is how far the branch is behind the target itself; only at
     * 0 is the target's update the one a reader needs, not this branch's.
     */
    targetStale?: { target: string; defaultRef: string; behind: number; branchBehind: number };
    /** The base-set summary and the per-ref behind list a dry run found, so a caller can word its own line. */
    summary?: string;
    behindDetail?: string;
}

/** The refusal for a branch that is behind under a strategy other than `merge`. */
export function behindRefusalMessage(plan: Plan, strategy: string): string {
    const t = plan.targetStale;
    return (
        `⚠️  sync_pr_branch: refused — the branch is behind and git.update_strategy is \`${strategy}\`; this script only merges. ` +
        `Rebase on request instead (git-workflow references/branch-update.md). ${plan.summary ?? ''}. Behind: ${plan.behindDetail ?? '?'}.` +
        (t === undefined ? '' : ` The target ${t.target} is itself ${String(t.behind)} commit(s) behind ${t.defaultRef}; once this branch is current with it, the target needs updating too.`)
    );
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
 * The old resolution was an EXCLUSIVE chain — `--base`, then `origin/HEAD` —
 * so a PR targeting a release line or a stacked
 * parent was kept current with its target and arbitrarily stale against the
 * default branch. Whether the default belongs in the set is a policy question
 * decided per target and read from the TARGET's own commit; see
 * `_lib/branch_convergence.ts` for the decision and the trust boundary.
 */
export type BaseReason =
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

/** Neither `--base` nor a default branch answered. Distinct from a missing policy. */
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
 * exercised without a network or a real release line — this
 * repository has none, so a live fixture could only ever cover the
 * default-target path.
 */
export interface BaseDeps extends TargetDeps {
    readonly readAtSha: ShaFileReader;
}

export function makeGitDeps(repo: string): BaseDeps {
    return {
        ...makeTargetDeps(repo),
        // `git show <sha>:<path>` and nothing else. There is no filesystem read
        // here by construction: a policy the PR head carries must not be able to
        // change the criteria the PR is judged against.
        readAtSha: (sha: string, rel: string): string | null => {
            const out = sh('git', ['show', `${sha}:${rel}`], repo);
            return out.ok ? out.out : null;
        },
    };
}

/** Strip the remote prefix so a policy key is the branch name a human writes. */
function bareName(ref: string): string {
    return splitResolvedRef(ref).branch;
}

function sameRemoteBranch(a: string, b: string): boolean {
    const x = splitResolvedRef(a);
    const y = splitResolvedRef(b);
    return x.remote === y.remote && x.branch === y.branch;
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

    const target = resolveTarget(deps, override, defaultRef);
    if (target === null) {
        throw new UnresolvableBase('no --base and no origin/HEAD');
    }

    // A PR targeting the default branch needs no entry — identity by remote and
    // branch name, or by the SHA both names resolve to. The branch name alone is
    // not identity: `upstream/main` can sit on a different commit than `origin/main`.
    const sameName = defaultRef !== null && sameRemoteBranch(target.ref, defaultRef);
    const targetSha = deps.remoteSha(target.ref);
    const defaultSha = defaultRef === null ? null : deps.remoteSha(defaultRef);
    const sameSha = targetSha !== null && defaultSha !== null && targetSha === defaultSha;
    // A fork layout: the pull request targets the default branch of the
    // remote it names (`upstream/main`), not a release line of origin.
    const targetRemote = splitResolvedRef(target.ref).remote;
    const ownDefault = sameName || sameSha || (defaultRef !== null && splitResolvedRef(defaultRef).remote === targetRemote) ? null : (deps.defaultBranchOf?.(targetRemote) ?? null);
    const ownName = ownDefault !== null && sameRemoteBranch(target.ref, ownDefault);
    if (sameName || sameSha || ownName) {
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
    /** Set when `checkPin` refused the pinned set: nothing was merged. */
    readonly stopped?: boolean;
    readonly attempts: readonly IntegrationAttempt[];
    readonly conflicted: readonly string[];
    readonly message: string;
}

/** The git operations the retry loop needs, injected so a moving base is testable. */
export interface IntegrateOps {
    readonly remoteSha: (ref: string) => string | null;
    /** Merges `sha`, the pinned commit of `ref`; `error` is a refusal that is not a conflict. */
    readonly merge: (ref: string, sha: string | null) => { ok: boolean; conflicted: string[]; error?: string };
    /** Asked once, before the first merge, with the pinned OIDs; a message stops the run. */
    readonly checkPin?: (pinned: readonly { ref: string; before: string | null }[]) => string | null;
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
        // Only before the first merge: once one has landed, a "nothing was
        // merged" stop would misreport the tree, so a later move is a base move.
        const stop = n === 1 ? (ops.checkPin?.(pinned) ?? null) : null;
        if (stop !== null) return { ok: false, stopped: true, attempts, conflicted: [], message: stop };
        let conflicted: string[] = [];
        let clean = true;
        for (const q of pinned) {
            const m = ops.merge(q.ref, q.before);
            if (!m.ok && m.error !== undefined) return { ok: false, attempts, conflicted: [], message: m.error };
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

/**
 * Merge exactly the commit the pin and the policy check were about.
 *
 * The run fetched once, before the pin, so the local tracking ref may name an
 * older commit, or a newer one when the policy re-read fetched. It is fetched
 * again when it differs from the pin, and the pinned SHA itself is merged when
 * the ref still names another commit. A merge that leaves HEAD without the
 * pinned commit is a refusal, never a success.
 */
function mergePinned(repo: string, ref: string, sha: string | null): { ok: boolean; conflicted: string[]; error?: string } {
    const tracking = (): string => sh('git', ['rev-parse', '--verify', '-q', `${ref}^{commit}`], repo).out.trim();
    let target = ref;
    if (sha !== null && tracking() !== sha) {
        const { remote, branch } = splitResolvedRef(ref);
        sh('git', ['fetch', '--', remote, `+refs/heads/${branch}:refs/remotes/${remote}/${branch}`], repo);
        if (tracking() !== sha) {
            if (!sh('git', ['cat-file', '-e', `${sha}^{commit}`], repo).ok) {
                return { ok: false, conflicted: [], error: `the pinned commit ${sha.slice(0, 12)} of ${ref} could not be fetched — nothing was merged for it.` };
            }
            target = sha;
        }
    }
    const m = sh('git', ['merge', '--no-edit', target], repo);
    if (!m.ok) {
        // A merge git refuses before it starts (local changes it would
        // overwrite, an untracked file in the way) leaves no unmerged path.
        const conflicted = sh('git', ['diff', '--name-only', '--diff-filter=U'], repo).out.split('\n').filter((p) => p.trim() !== '');
        if (conflicted.length > 0) return { ok: false, conflicted };
        const why = (m.err || m.out).trim().split('\n').join(' ');
        return { ok: false, conflicted: [], error: `git refused to merge ${ref}: ${why || 'no reason given'} — nothing was merged for it.` };
    }
    if (sha !== null && !sh('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], repo).ok) {
        return { ok: false, conflicted: [], error: `the merge of ${ref} left HEAD without its pinned commit ${sha.slice(0, 12)}.` };
    }
    return { ok: true, conflicted: [] };
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

/**
 * What the merge path needs beyond the base set. `live` answers the last-moment
 * pin and is never memoised — a memoised pin could not see the target move.
 */
export interface SyncOptions {
    readonly live?: TargetDeps;
    readonly checkPin?: IntegrateOps['checkPin'];
}

export function sync(repo: string, baseOverride: string | null, dryRun: boolean, autoResolve = false, deps?: BaseDeps, opts: SyncOptions = {}): Plan {
    let resolved: ResolveBaseResult;
    try {
        resolved = resolveBase(repo, baseOverride, deps ?? makeGitDeps(repo));
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

    const remotes = [...new Set(['origin', ...order.map((ref) => splitResolvedRef(ref).remote)])];
    const failed = remotes.map((remote) => ({ remote, ...sh('git', ['fetch', '--prune', '--', remote], repo) })).find((f) => !f.ok);
    if (failed !== undefined) {
        // Unreachable remote is not "already current" — saying so is the whole
        // point, since a silent pass here reproduces the staleness this closes.
        return {
            exit: 0,
            message: `unverified — could not fetch ${failed.remote} (${failed.err.split('\n')[0] ?? '?'}). Base freshness NOT checked.`,
            generated: [],
            remeasured: [],
            authored: [],
            scanned: 0,
        };
    }

    // A single-branch clone's refspec never moves a base tracking ref fetched
    // once by hand, so the remote-wide fetch above can leave it stale and the
    // count below would read "already current". Each ref is fetched by name.
    for (const ref of order) {
        const { remote, branch } = splitResolvedRef(ref);
        sh('git', ['fetch', '-q', '--', remote, `+refs/heads/${branch}:refs/remotes/${remote}/${branch}`], repo);
    }

    // A count git could not take is not a count of 0: a ref this checkout never
    // fetched (a single-branch clone) would otherwise read as "already current".
    const countBehind = (from: string, ref: string): number | null => {
        const r = sh('git', ['rev-list', '--count', `${from}..${ref}`], repo);
        const n = Number(r.out.trim());
        return r.ok && r.out.trim() !== '' && Number.isInteger(n) ? n : null;
    };
    const uncountable = (ref: string): Plan => ({
        exit: 1,
        message:
            `cannot count commits behind ${ref} — it is not in this checkout (a single-branch clone fetches only its own branch). ` +
            `Fetch it: git fetch -- ${splitResolvedRef(ref).remote} +refs/heads/${bareName(ref)}:refs/remotes/${splitResolvedRef(ref).remote}/${bareName(ref)}`,
        generated: [],
        remeasured: [],
        authored: [],
        scanned: 0,
    });
    const behindEach: { ref: string; behind: number }[] = [];
    for (const ref of order) {
        const behind = countBehind('HEAD', ref);
        if (behind === null) return uncountable(ref);
        behindEach.push({ ref, behind });
    }
    // De-duplicated by ancestry: a ref already contained in HEAD is 0 behind and
    // is not merged again, which is what keeps a target that already contains
    // the default from being merged twice.
    const stale = behindEach.filter((b) => b.behind > 0);
    if (stale.length === 0) {
        return { exit: 0, message: `already current with every base ref — ${summary}.`, generated: [], remeasured: [], authored: [], scanned: order.length };
    }
    if (dryRun) {
        const detail = stale.map((b) => `${b.ref} (${String(b.behind)} behind)`).join(', ');
        const added = resolved.entries.find((e) => e.reason === 'branch-convergence-policy:include-default');
        const target = resolved.entries[0]?.ref ?? '';
        const targetBehind = added === undefined ? 0 : countBehind(target, added.ref);
        if (targetBehind === null) return uncountable(added?.ref ?? target);
        return {
            ...(targetBehind > 0 && added !== undefined
                ? { targetStale: { target, defaultRef: added.ref, behind: targetBehind, branchBehind: behindEach.find((b) => b.ref === target)?.behind ?? 0 } }
                : {}),
            exit: 0,
            message: `${summary}. Behind: ${detail} — would merge in that order. Dry run, nothing changed.`,
            summary,
            behindDetail: detail,
            generated: [],
            remeasured: [],
            authored: [],
            scanned: order.length,
            behind: stale.length,
        };
    }

    const live = opts.live ?? makeGitDeps(repo);
    const outcome = integrateWithPinnedBase(
        stale.map((b) => b.ref),
        {
            remoteSha: (ref: string): string | null => live.remoteSha(ref),
            ...(opts.checkPin === undefined ? {} : { checkPin: opts.checkPin }),
            merge: (ref: string, sha: string | null) => mergePinned(repo, ref, sha),
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
        // The base kept moving, or moved onto a commit carrying another
        // strategy. No conflict to classify; the message carries the OIDs.
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

/**
 * `git.update_strategy` in force for the repository: the committed
 * `.git-convention.yml` at the target commit, over the developer layers
 * (ADR-283). Absent everywhere reads as `merge`, the behaviour before the key
 * existed; a file that does not parse, a typo, a user-global-only value and a
 * target commit that cannot be resolved are refusals here.
 */
export function updateStrategy(repo: string, base: string | null = null, deps?: TargetDeps): GitConventionReading {
    return readStrategy(repo, base, deps).reading;
}

function readStrategy(repo: string, base: string | null, deps?: TargetDeps): { reading: GitConventionReading; baseResolved: boolean; target: ConventionTarget | null } {
    const read = readCommittedConvention(repo, { override: base, keys: ['update_strategy'], ...(deps ? { deps } : {}) });
    return { reading: read.readings.update_strategy as GitConventionReading, baseResolved: read.target !== null && read.target.sha !== null, target: read.target };
}

export interface StrategyGate {
    /** `null` — the strategy is readable, go on; otherwise the exit to return. */
    exit: 0 | 1 | 4 | null;
    line: string;
    reading: GitConventionReading;
    /** The ref and commit the strategy was read at, when `strategyGate` resolved one. */
    target?: ConventionTarget | null;
}

/**
 * The one place that maps an unreadable `git.update_strategy` to an exit.
 *
 * A developer file that is itself a refusal, and a carrier at the target that
 * does not parse or is not accepted, are exit 4. A target that resolves to no
 * commit — no `--base` and no default branch, a ref the server does not know,
 * no origin, origin unreachable at the ref lookup — is the base failure, exit
 * 1. A target the server named whose commit could not be fetched is
 * `unverified`: exit 0 with a warning, and nothing is touched.
 */
export function strategyExit(reading: GitConventionReading, baseResolved: boolean, developer: GitConventionReading): StrategyGate {
    if (!isRefusal(reading.state)) return { exit: null, line: '', reading };
    const refused: StrategyGate = { exit: 4, line: `❌  sync_pr_branch: refused — ${describeRefusal(reading)}. Nothing was checked or merged.`, reading };
    if (reading.state !== 'unresolvable' || isRefusal(developer.state)) return refused;
    const why = reading.detail ?? 'the target commit is unknown';
    if (!baseResolved) return { exit: 1, line: `❌  sync_pr_branch: base could not be resolved — ${why}. Nothing was checked or merged.`, reading };
    return { exit: 0, line: `⚠️  sync_pr_branch: unverified — ${why}. Base freshness NOT checked, nothing was merged.`, reading };
}

export function strategyGate(repo: string, base: string | null, targetDeps: BaseDeps): StrategyGate {
    const { reading, baseResolved, target } = readStrategy(repo, base, targetDeps);
    return { ...strategyExit(reading, baseResolved, readGitConventionKey('update_strategy', checkoutSource(conventionRoot(repo).root))), target };
}

/** The strategy a reading puts in force, or its refusing state: what a plan is made with. */
function strategyInForce(r: GitConventionReading): string {
    return isRefusal(r.state) ? `unreadable (${r.state})` : (r.value ?? 'merge');
}

/**
 * The stop for a target that moved between the strategy read and the pin.
 *
 * The commit being integrated is governed by the policy it carries, so the
 * carrier is read again at the pinned commit through the same reader. The same
 * strategy in force there goes on against the new commit; a different one, or
 * one that cannot be read, stops before anything is merged — the plan was made
 * under a policy the integrated commit no longer carries.
 */
export function policyMovedStop(from: string, to: string, planned: GitConventionReading, pinned: GitConventionReading): string | null {
    const was = strategyInForce(planned);
    const now = strategyInForce(pinned);
    if (was === now) return null;
    const why = isRefusal(pinned.state) ? ` (${describeRefusal(pinned)})` : '';
    return (
        `the target moved from ${from.slice(0, 12)} to ${to.slice(0, 12)} and its git.update_strategy changed from ${was} to ${now}${why} — ` +
        'nothing was merged; run again so the plan is made under the strategy the new commit carries.'
    );
}

/** `deps` answers the target questions; tests inject it, a run asks git. */
export function main(argv?: readonly string[], deps?: BaseDeps): number {
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
            const blank = baseValueError(v);
            if (blank !== null) {
                process.stderr.write(`❌  sync_pr_branch: ${blank}\n`);
                reportScanned({ gate: 'sync_pr_branch', scanned: 0, units: 'base ref(s)', roots: ['origin'], allowEmpty: 'argument error' });
                return 2;
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
                    '  Under a git.update_strategy other than merge it only checks: a current\n' +
                    '  branch exits 0, a behind one exits 3 and is never merged (--dry-run and\n' +
                    '  --auto-resolve-generated have nothing to change there). A strategy that\n' +
                    '  cannot be read (unparsable file, typo, user-global-only) exits 4.\n' +
                    '  The base is --base; without it the default branch, so a PR into any other\n' +
                    '  base must pass --base <its base>; a branch name and refs/heads/<name> mean\n' +
                    '  origin/<name>, and <remote>/<name> is used as given. A blank --base\n' +
                    '  is a usage error, exit 2.\n' +
                    '  A base that cannot be resolved or counted exits 1; one whose commit\n' +
                    '  cannot be fetched is unverified, exit 0. A target that moves before the\n' +
                    '  merge is read again at the new commit; another strategy there exits 1,\n' +
                    '  nothing merged. A conflict is\n' +
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

    // This script only merges. Under any other strategy a merge of the base is
    // the commit the setting excludes, and a rebase needs the user's request per
    // git-history-discipline — so the branch is only CHECKED (dry run), and a
    // branch that is behind is refused rather than merged. A current branch
    // passes, so an automated pre-push sync stays green when nothing is to do.
    const live = deps ?? makeGitDeps(repo);
    const targetDeps = memoTargetDeps(live);
    let plan: Plan;
    try {
        const gate = strategyGate(repo, base, targetDeps);
        if (gate.exit !== null) {
            process.stdout.write(`${gate.line}\n`);
            const why = gate.exit === 0 ? 'target commit not fetched — stated above' : gate.exit === 1 ? 'base unresolvable — stated above' : 'git.update_strategy unreadable';
            reportScanned({ gate: 'sync_pr_branch', scanned: 0, units: 'base ref(s)', roots: ['origin'], allowEmpty: why });
            return gate.exit;
        }
        const strategy = gate.reading.value ?? 'merge';
        if (strategy !== 'merge') {
            plan = sync(repo, base, true, false, targetDeps);
            const t = plan.targetStale;
            if (plan.exit === 0 && t !== undefined && t.branchBehind === 0) {
                process.stdout.write(
                    `⚠️  sync_pr_branch: refused — TARGET_POLICY_STALE: the target ${t.target} is itself ${String(t.behind)} commit(s) behind ${t.defaultRef}, ` +
                        `which the branch-convergence policy requires; updating this branch onto the target cannot make it current. ` +
                        `The target needs updating first; this branch has nothing to do until then.\n`,
                );
                reportScanned({ gate: 'sync_pr_branch', scanned: plan.scanned, units: 'base ref(s)', roots: ['origin'] });
                return 3;
            }
            if (plan.exit === 0 && (plan.behind ?? 0) > 0) {
                process.stdout.write(`${behindRefusalMessage(plan, strategy)}\n`);
                reportScanned({ gate: 'sync_pr_branch', scanned: plan.scanned, units: 'base ref(s)', roots: ['origin'] });
                return 3;
            }
        } else {
            const read = gate.target ?? null;
            const checkPin = (pinned: readonly { ref: string; before: string | null }[]): string | null => {
                const now = read === null ? null : (pinned.find((p) => p.ref === read.ref)?.before ?? null);
                if (read === null || read.sha === null || now === null || now === read.sha) return null;
                const again = strategyGate(repo, base, { ...targetDeps, remoteSha: () => now });
                return policyMovedStop(read.sha, now, gate.reading, again.reading);
            };
            plan = sync(repo, base, dryRun, autoResolve, targetDeps, { live, checkPin });
        }
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

// Inlined into the `git:convention` delegate bundle this module shares that
// bundle's `import.meta.url`, so the URL comparison below would run `main` at
// import time with the verb's argv. Defined by the esbuild builds only.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return path.basename(process.argv[1], '.js') === 'sync_pr_branch';
    return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href || process.argv[1] === _HERE;
}
if (_isCliEntry()) {
    process.exit(main());
}

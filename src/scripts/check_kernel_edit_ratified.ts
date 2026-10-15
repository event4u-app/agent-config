#!/usr/bin/env tsx
/**
 * check_kernel_edit_ratified — ADR-268 § 4's CI gate, ADDED ALONGSIDE the
 * tool-call deny, not in place of it.
 *
 * ADR-268 § 4 says the deny "is replaced by a CI gate reading the artifact —
 * one mechanism, not two". This lands the gate and does NOT perform that
 * replacement, and the distinction is the whole reason this header exists.
 *
 * A two-round independent ratification review REFUSED the replacement, 2/2 in
 * round 2, on a defect neither the ADR nor the first implementation saw: the
 * workflow file that decides whether the gate runs at all lives in the
 * candidate branch. Running the gate's CODE from the base revision — which the
 * workflow now does — closes the "candidate judges itself" hole one level
 * down and leaves the level above it open, because a PR can still edit the
 * step that invokes it. Closing that needs a platform-anchored required check
 * (a protected reusable workflow, an org ruleset), which is a repository
 * setting and not a diff. So the replacement waits on an owner action, and
 * until then BOTH mechanisms stand.
 *
 * Two mechanisms is a state ADR-268 § 4 argues against, and it is the correct
 * interim anyway: this gate ADDS a refusal and removes none, so it is pure
 * tightening — the discriminator ADR-268 § 0 gives for a narrowing. Removing
 * the deny is the authority change, and that is what was refused.
 *
 * What the gate buys over the deny, today, with the deny still in place: it
 * reaches every host rather than the one that honours a deny, and its unit is
 * the cumulative DIFF rather than one tool call — so the two-step
 * write-to-staging-then-`mv` sequence that laundered past the hook is caught.
 *
 * Gated: a diff touching a kernel rule under `src/rules/` (the nine of
 * `_lib/kernel_rules.ts`), a governance hook (`src/scripts/hooks/block_*.ts`),
 * hook plumbing — the YAML sources `hook_manifest.yaml` and
 * `host_lowering.yaml`, their compiled siblings `hook_manifest.json` and
 * `host_lowering.json`, the dispatcher `hooks/dispatch_hook.ts`, the
 * kernel-rule list `_lib/kernel_rules.ts`, a `*-dispatcher.sh`, the token,
 * latency and bundle budget files (see `PLUMBING_SOURCE_RE`), and every module
 * the dispatcher imports that decides an exit code (derived at run time, see
 * `derivedPlumbing`) — or this gate itself, so it cannot
 * be weakened without its own record. Such a diff must carry a ratification
 * artifact under the ratifications directory with `verdict: ratified`, valid
 * per the ratification-artifact contract.
 *
 * Every kernel diff is gated, not only the authority-EXPANDING ones.
 * ADR-268 § 4 makes the artifact required for authority-expanding edits. Which
 * edits expand authority is a judgement over rule prose — not decidable from a
 * diff, and a gate that guesses is a gate that is quietly wrong in the
 * direction nobody notices. This gate therefore applies the strictly stronger
 * and fully decidable rule: every kernel-rule and governance-hook diff carries
 * a record. A narrowing edit pays one artifact it did not strictly owe; an
 * expanding edit cannot slip through a misclassification.
 *
 * Provider diversity fails closed. The required count comes from
 * `src/config/ratification-policy.json`, committed in this repository so it is
 * present on every runner. The first review round refused reading it from the
 * user-global council config: that file is absent on CI, so the rule printed
 * "unmeasured" and passed, on the one surface where it most needed to fire. A
 * missing or unparseable policy is now a refusal.
 *
 * Inputs:
 *   --base-ref REF    git ref to diff against (default: origin/main, then main)
 *   --files F [F …]   override the changed-file list (testing); CI derives
 *                     the list from git with --base-ref, because a hosted
 *                     PR file list names a rename by its destination only
 *   --root DIR        repo root the diff and artifacts are read from (testing)
 *   --rev REV         the commit the gated content and the artifacts are read
 *                     at (default HEAD) — Git objects, never the working tree,
 *                     so an uncommitted edit can neither pass nor fail the gate.
 *                     Without --files it is resolved ONCE to a commit id, and
 *                     that id — not the name — feeds the diff, the digest and
 *                     the record read, so a ref that moves mid-run cannot pair
 *                     one commit's file list with another commit's content
 *   --policy-root DIR where the quorum policy is read from (testing); defaults
 *                     to THIS script's tree, so a base-revision run reads the
 *                     base's policy rather than one the candidate lowered
 *   --quiet           verdict line only
 *
 * An option that takes a value and is given none is a refusal (exit 1), never
 * a silent default.
 *
 * Exit codes: 0 = pass (or nothing gated) · 1 = fail · 3 = internal error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import {
    dispatchImportClosure,
    verdictModules,
    type ClosureTree,
} from './_lib/dispatch_import_closure.js';
import { is_kernel_rule } from './_lib/kernel_rules.js';
import { reportScanned } from './_lib/scan_scope.js';
import {
    isRatified,
    RATIFICATION_DIR,
    readRatification,
    readRequiredProviders,
    type RatificationProblem,
} from './_lib/ratification_artifact.js';
import {
    DEFAULT_REVISION,
    GatedSubjectRefusal,
    changedFilesBetween,
    fileAtRevision,
    optionValue,
    refExists,
    resolveRevision,
    subjectOf,
    treeAtRevision,
    type SubjectReading,
} from './_lib/ratification_subject.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');

/** This gate's own path, relative to the repo root. Watched by itself. */
export const SELF_PATH = 'src/scripts/check_kernel_edit_ratified.ts';

/** The reader this gate shares with the artifact contract, also self-watched. */
export const READER_PATH = 'src/scripts/_lib/ratification_artifact.ts';

/**
 * The reader that derives the dispatcher's verdict-deciding imports. It decides
 * part of this gate's reach, so narrowing it is narrowing the gate — watched as
 * part of the mechanism for the reason `READER_PATH` is.
 */
export const CLOSURE_READER_PATH = 'src/scripts/_lib/dispatch_import_closure.ts';

/**
 * Modules of this gate's static import closure that run inside the verdict, so
 * an edit to one is an edit to the gate:
 *
 *   - `_lib/adr_frontmatter.ts` parses the record's header, verdict included;
 *   - `_lib/gate_ledger.ts` and `_lib/scan_scope.ts` run before the exit code is
 *     returned, so either could end the process first.
 *
 * `_lib/kernel_rules.ts` is already gated as plumbing. `_lib/ratification_subject.ts`,
 * which computes the digest, joins in a separate change: one that gates it and
 * edits it at once is digested over different files by the base revision's
 * gate and by its own, so no single record answers for both. The writer CLIs
 * `src/scripts/ratification_subject.ts` and `src/scripts/ratification_header.ts`
 * and the contract stay outside by owner decision (2026-10-15): the gate does
 * not import them, recomputes the digest and reads only the record.
 */
export const MECHANISM_IMPORT_PATHS: readonly string[] = [
    'src/scripts/_lib/adr_frontmatter.ts',
    'src/scripts/_lib/gate_ledger.ts',
    'src/scripts/_lib/scan_scope.ts',
];

/** The in-repo quorum policy. Present on every runner; absent means refuse. */
export const POLICY_PATH = 'src/config/ratification-policy.json';

/**
 * The workflow that invokes this gate.
 *
 * On the watch list because a round-3 reviewer named its absence: running the
 * gate's CODE from the base revision closes "the candidate judges itself" one
 * level down and leaves the level above it open, since the step that decides
 * whether to run at all lives in the candidate branch. Watching the file does
 * not close that — a PR editing it still edits it — but it makes the edit
 * carry a record instead of passing silently. One more level, not an anchor.
 */
export const WORKFLOW_PATH = '.github/workflows/consistency.yml';

/**
 * The platform-anchor limb: the committed expectation, its pure evaluator and
 * its gate.
 *
 * Watched for the reason the expectation file is committed at all. The
 * expectation could otherwise be lowered by a diff nobody ratified, which would
 * make the anchor as head-controlled as the settings it exists to check. The
 * embedded floor in `_lib/platform_anchor.ts` stops a lowering from being
 * honoured; this list is what makes the attempt visible.
 */
export const ANCHOR_PATHS: readonly string[] = [
    'src/config/platform-anchor.json',
    'src/scripts/_lib/platform_anchor.ts',
    'src/scripts/check_platform_anchor.ts',
];

/** Governance hooks: the blocking PreToolUse guards. */
const GOVERNANCE_HOOK_RE = /^src\/scripts\/hooks\/block_[a-z0-9_]+\.ts$/;

/**
 * Hook-plumbing SOURCES — the files that decide which concern runs, on which
 * host, under which budget.
 *
 * `road-to-a-kernel-that-guards-its-plumbing` 1.1. The nine kernel rules were
 * governed and the plumbing that decides whether a guard runs at all was not,
 * so a diff deleting `block-no-verify` from the manifest carried no record
 * while a typo in the rule it enforces carried one. The asymmetry was the
 * defect: a concern removed from `hook_manifest.yaml` is a refusal that stops
 * happening, which is the same authority change as loosening the rule behind
 * it, reached one file earlier.
 *
 * This is the ADR-268 § 4 mechanism EXTENDED, not a second deny. Nothing new
 * refuses a tool call here; the same CI gate simply reads a wider path set,
 * and every property the gate already had — base-revision code, in-repo quorum
 * policy, the whole diff as its unit — carries over unchanged.
 *
 * `dist/hooks/dispatch.js` and `hooks/hooks.json` are BUILD OUTPUTS that no
 * reader in this repository opens — they exist only inside an installed
 * consumer tree — and they have no legitimate hand edit at all, so they are
 * refused at tool-call time by `block_plumbing_writes.ts` rather than ratified
 * here: a record for a file whose every hand edit is illegitimate would be a
 * record of a mistake.
 *
 * road-to-blocking-severities 2.1 WIDENS this from "sources only" to
 * "everything the dispatcher serves at runtime", and the distinction above is
 * why the two compiled tables land here while the two build outputs do not.
 * `src/scripts/hook_manifest.json` and `src/scripts/hooks/host_lowering.json`
 * are committed in THIS tree and are READ IN PREFERENCE to the YAML they were
 * compiled from — `dispatch_hook._load_yaml` and `host_lowering.resolveTable`
 * both serve the compiled body whenever its fingerprint matches. A diff that
 * edits only the JSON therefore changes what every host is told about which
 * concern runs and which slot can refuse, while the gated YAML beside it is
 * untouched. That is the same authority change as editing the source, reached
 * one file later, and before this step it carried no record.
 *
 * Two further files join for the same reason rather than by analogy:
 *
 *   - `src/scripts/hooks/dispatch_hook.ts` is the dispatcher itself. Every
 *     concern's verdict passes through it, so an edit here can suppress a
 *     refusal without touching the manifest that declares it.
 *   - `src/scripts/_lib/kernel_rules.ts` is the list of the nine kernel rules.
 *     THIS GATE resolves `is_kernel_rule` through it, so a diff removing a name
 *     from that list removes a rule from this gate's own reach — the one edit
 *     that could quietly narrow the gate while every other path kept working.
 *
 * Both are also denied at tool-call time, `dispatch_hook.ts` through the
 * plumbing guard's source set and `kernel_rules.ts` through the kernel-rule
 * write guard, so the pairing of deny-plus-record matches what the YAML sources
 * already had.
 *
 * The compiled tables are REGENERATED, not hand-edited, by
 * `./scripts-run src/scripts/compile_hook_manifest --table manifest|host-lowering`,
 * which runs as a script rather than as an edit tool call and so is not what
 * either mechanism refuses. A regeneration lands in the same diff as the YAML
 * change that caused it, which already requires a record; the case this closes
 * is the diff where only the JSON moves.
 */
const PLUMBING_SOURCE_RE =
    /^(?:src\/scripts\/hook_manifest\.(?:yaml|json)|src\/scripts\/hooks\/host_lowering\.(?:yaml|json)|src\/scripts\/hooks\/dispatch_hook\.ts|src\/scripts\/_lib\/kernel_rules\.ts|src\/scripts\/hooks\/[a-z0-9-]+-dispatcher\.sh|src\/config\/hook-(?:token|latency|bundle)-budget\.json)$/;

/**
 * The derived half of the plumbing set: every module in the static import
 * closure of `dispatch_hook.ts` that decides an exit code or a refusal, read by
 * `_lib/dispatch_import_closure.ts`.
 *
 * `road-to-a-ratification-fence-that-follows-its-imports` 2.2. The pattern
 * above stayed correct until `_resolve_execution_failure` moved from the
 * dispatcher into `concern_failure_policy.ts` — release finding `21900086c1a0`:
 * a diff deciding whether a crashed blocking concern refuses then carried no
 * record. A hand list fails the same way the next time a function moves, so
 * this half is computed from the import graph at run time, and a module the
 * dispatcher newly imports that names an exit code joins it with no edit here.
 * Concerns stay outside: the walk stops at the concern table, and a governance
 * concern is already gated by `GOVERNANCE_HOOK_RE`.
 *
 * `hook-bundle-budget.json` joins the pattern for D3: its ceiling was raised on
 * its own registration day, and a raised ceiling is a looser budget reached one
 * file earlier than the bundle it bounds.
 */
let _repoDerived: readonly string[] | null = null;
export function derivedPlumbing(root: string = REPO): readonly string[] {
    if (root === REPO) {
        _repoDerived ??= verdictModules(REPO);
        return _repoDerived;
    }
    return verdictModules(root);
}

/**
 * Modules that ARRIVE in the dispatcher's closure: non-concern modules present
 * in the closure under `root` and absent from the closure under `baseRoot`.
 *
 * The classifier reads names, so a verdict-deciding module with neutral names
 * (`acceptsExecution(): boolean`, no exit constant) reads as `payload` or
 * `neither` — the gap the first ratification round of this change refused it
 * on. A name-based classifier cannot close that gap; what can is watching the
 * one moment such a module becomes reachable. So any module newly reachable
 * from the dispatcher is gated on the diff that makes it reachable, whatever
 * its class, and a reviewer reads it once. Modules already in the base closure
 * are judged by class, so routine edits to a payload helper stay record-free.
 *
 * The other direction needs no extra rule: a module the base classes as
 * `verdict` stays watched through the union in `evaluate` even when the head
 * strips the names that classed it, so declassifying one is itself a gated
 * edit of it.
 *
 * Each side is a checkout path or a commit's objects (see `derivedFor`). A
 * checkout equal to `root` is the same tree on both sides and has no arrivals.
 */
export function closureArrivals(
    root: string | ClosureTree,
    baseRoot: string | ClosureTree = REPO,
): string[] {
    if (
        typeof root === 'string' &&
        typeof baseRoot === 'string' &&
        path.resolve(root) === path.resolve(baseRoot)
    ) {
        return [];
    }
    const base = new Set(dispatchImportClosure(baseRoot).map((e) => e.path));
    return dispatchImportClosure(root)
        .filter((e) => e.class !== 'concern' && !base.has(e.path))
        .map((e) => e.path);
}

/**
 * A kernel rule, in the source tree or in any projection.
 *
 * The reach is deliberately the same as the tool-call deny's, and that deny is
 * bound rather than retired: `block-kernel-rule-writes` has a row in
 * `src/scripts/hook_manifest.yaml` and sits in the `pre_tool_use` list of three
 * host sections there. The header above says why both mechanisms stand; this
 * sentence described the deny as already withdrawn and contradicted it.
 *
 * The reach: any path whose basename is a kernel rule filename and which sits
 * under a `rules/` path segment. `src/rules/commit-policy.md` is the source;
 * `.claude/rules/…`, `.augment/rules/…` and `dist/agent-src/rules/…` are
 * projections. A hand-edited projection reaches consumers without the source
 * ever changing, so narrowing this to the source alone would cover half of
 * what the deny covers — the gate that reaches every host is not supposed to
 * be the narrower of the two.
 *
 * A kernel-NAMED file outside a `rules/` directory (a doc, a fixture) is not a
 * rule file and is not matched.
 */
const KERNEL_RULE_PATH_RE = /(?:^|\/)rules\/([a-z0-9-]+)\.md$/;

export interface GatedPaths {
    kernelRules: string[];
    governanceHooks: string[];
    /** Hook-plumbing sources — manifest, host lowering, dispatchers, budgets. */
    plumbing: string[];
    self: boolean;
}

/**
 * True for a file of the ratification mechanism itself — the one list both the
 * classification and the subject digest read.
 */
export function isMechanismPath(p: string): boolean {
    return (
        p === SELF_PATH ||
        p === READER_PATH ||
        p === CLOSURE_READER_PATH ||
        p === POLICY_PATH ||
        p === WORKFLOW_PATH ||
        ANCHOR_PATHS.includes(p) ||
        MECHANISM_IMPORT_PATHS.includes(p)
    );
}

/** Partition a changed-file list into the surfaces this gate watches. */
export function classifyPaths(
    files: readonly string[],
    derived: readonly string[] = derivedPlumbing(),
): GatedPaths {
    const derivedSet = new Set(derived);
    const kernelRules: string[] = [];
    const governanceHooks: string[] = [];
    const plumbing: string[] = [];
    let self = false;
    for (const raw of files) {
        const p = raw.replace(/\\/g, '/').trim();
        if (p === '') {
            continue;
        }
        if (isMechanismPath(p)) {
            self = true;
            continue;
        }
        const m = KERNEL_RULE_PATH_RE.exec(p);
        if (m !== null && is_kernel_rule(m[1] ?? '')) {
            kernelRules.push(p);
            continue;
        }
        if (GOVERNANCE_HOOK_RE.test(p)) {
            governanceHooks.push(p);
            continue;
        }
        if (PLUMBING_SOURCE_RE.test(p) || derivedSet.has(p)) {
            plumbing.push(p);
        }
    }
    return { kernelRules, governanceHooks, plumbing, self };
}

/** True when anything in the diff requires a ratification artifact. */
export function requiresRatification(gated: GatedPaths): boolean {
    return (
        gated.kernelRules.length > 0 ||
        gated.governanceHooks.length > 0 ||
        gated.plumbing.length > 0 ||
        gated.self
    );
}

/** Ratification artifacts present in the diff, as repo-relative paths. */
export function ratificationArtifactsIn(files: readonly string[]): string[] {
    return files
        .map((f) => f.replace(/\\/g, '/').trim())
        .filter((f) => f.startsWith(`${RATIFICATION_DIR}/`) && f.endsWith('.md'));
}

/**
 * The configured council member count, or `null` when it could not be read.
 *
 * Deliberately best-effort and deliberately silent on failure: the config is
 * user-global, so "not found" is the NORMAL state in CI and is not an error.
 */
export function configuredProviderCount(policyRoot: string): number | null {
    try {
        return readRequiredProviders(fs.readFileSync(path.join(policyRoot, POLICY_PATH), 'utf8'));
    } catch {
        return null;
    }
}

function resolveBaseRef(explicit: string | null, root: string): string {
    if (explicit !== null) {
        return explicit;
    }
    for (const candidate of ['origin/main', 'origin/master', 'main', 'master']) {
        if (refExists(root, candidate)) {
            return candidate;
        }
    }
    return 'HEAD~1';
}

/**
 * The plumbing closure this gate classifies with: the base side's verdict
 * modules, the head side's, and every module arriving in the closure — so a
 * module present on either side is watched.
 *
 * BOTH SIDES ARE COMMITS, READ FROM GIT OBJECTS IN `root`, in every execution
 * shape. The head is `revision`, the commit the digest and the record are read
 * at, so an uncommitted import edit cannot add or hide a module. The base is
 * `baseRef`, resolved the way the diff's base is. The same two commits
 * therefore yield the same gated set whichever copy of this script runs.
 *
 * Why the base is not this script's checkout: CI runs the base revision's copy
 * with `--root <head>`, where that checkout IS the base, but a local run
 * (pre-push, `task ci`, the subject CLI) executes the head's copy, whose
 * checkout is the head. Compared with itself it saw no arrivals, digested fewer
 * files than CI and refused the record CI required (PR #2371).
 *
 * One residue keeps the old base: a call with no `baseRef` over a `root` that
 * is not this checkout — a direct call, or `--files` without `--base-ref` —
 * compares against this script's checkout. A run that builds its own diff
 * always passes the base it diffed against.
 *
 * `headCommit` is already a commit id; the base ref is resolved here.
 *
 * THROWS a {@link GatedSubjectRefusal} when the base does not resolve or the
 * object store cannot be read.
 */
function derivedFor(root: string, baseRef: string | null, headCommit: string): readonly string[] {
    const verdictsOf = (tree: ClosureTree): string[] =>
        dispatchImportClosure(tree)
            .filter((e) => e.class === 'verdict')
            .map((e) => e.path);
    const head = treeAtRevision(root, headCommit);
    if (baseRef === null && path.resolve(root) !== REPO) {
        return [...new Set([...derivedPlumbing(), ...verdictsOf(head), ...closureArrivals(head)])];
    }
    const base = treeAtRevision(root, resolveRevision(root, resolveBaseRef(baseRef, root)));
    return [...new Set([...verdictsOf(base), ...verdictsOf(head), ...closureArrivals(head, base)])];
}

/**
 * The `subject` digest a record must carry to answer for this diff, AND the
 * gated files it covers — from one classification, never two.
 *
 * Exported so that whoever WRITES a record asks the gate for the digest rather
 * than recomputing it from a second reading of the membership rule. A writer
 * that derived its own list would be the second definition of "gated" that
 * `ratification_subject`'s header exists to prevent — and it would fail only
 * for the diffs where the two lists disagree, which are exactly the diffs that
 * widen the gated set.
 *
 * RETURNS BOTH HALVES so that the coverage list printed beside a digest is the
 * list that digest was taken over: a list classified separately, with a
 * different `derived` input, could disagree with it — the false reassurance
 * that list exists to prevent.
 *
 * The content is read at `revision` from Git objects, so the digest a writer
 * prints and the digest this gate checks agree exactly when both name the
 * same commit — the one the reviewers were shown.
 *
 * THROWS a {@link GatedSubjectRefusal} when the revision does not resolve, git
 * cannot run, or a gated path escapes the tree or is not absent or a regular
 * file in that commit. Callers turn that into a refusal; none may continue.
 */
export function expectedSubjectFor(
    files: readonly string[],
    root: string,
    revision: string = DEFAULT_REVISION,
    baseRef: string | null = null,
): SubjectReading {
    const commit = resolveRevision(root, revision);
    return subjectOf(root, files, derivedFor(root, baseRef, commit), commit);
}

export interface GateResult {
    exitCode: 0 | 1 | 3;
    lines: string[];
    /** Number of changed paths inspected — the honest `scanned:` count. */
    scanned: number;
}

export function evaluate(
    files: readonly string[],
    root: string,
    providerCount: number | null,
    revision: string = DEFAULT_REVISION,
    baseRef: string | null = null,
): GateResult {
    const lines: string[] = [];
    const scanned = files.length;

    // Every changed path is a planned target: the gate's denominator is the
    // whole diff, and a path it decided was out of scope is a decision worth
    // counting rather than a silence.
    const ledger = new GateLedger('check_kernel_edit_ratified');
    ledger.plan(files.map((f) => f.replace(/\\/g, '/').trim()).filter((f) => f !== ''));

    // The revision is resolved once and the closure computed once, then both
    // are handed to the digest below, so the classification and the digest
    // read one head commit and one base.
    let derived: readonly string[];
    let headCommit: string;
    try {
        headCommit = resolveRevision(root, revision);
        derived = derivedFor(root, baseRef, headCommit);
    } catch (err) {
        if (!(err instanceof GatedSubjectRefusal)) {
            throw err;
        }
        lines.push(`❌  ${err.message}`);
        for (const target of ledger.unaccountedTargets()) {
            ledger.fail(target, 'the dispatcher closure could not be read at the named commits');
        }
        const tally = ledger.finalize();
        lines.push('', `ledger: planned ${tally.planned} · completed 0 · failed ${tally.failed} · out_of_scope 0`);
        return { exitCode: 1, lines, scanned };
    }
    const gated = classifyPaths(files, derived);
    const gatedSet = new Set<string>([
        ...gated.kernelRules,
        ...gated.governanceHooks,
        ...gated.plumbing,
        ...files.map((f) => f.replace(/\\/g, '/').trim()).filter(isMechanismPath),
    ]);
    const artifactSet = new Set(ratificationArtifactsIn(files));
    for (const target of ledger.unaccountedTargets()) {
        if (!gatedSet.has(target) && !artifactSet.has(target)) {
            ledger.outOfScope(target, 'not_applicable_kind');
        }
    }

    /**
     * Resolve every target that has not reached an outcome yet, then close.
     *
     * `finalize()` throws on an unaccounted target, which is the point — it is
     * what stops a path from being enumerated and then quietly not decided.
     */
    const close = (ok: boolean): void => {
        for (const target of ledger.unaccountedTargets()) {
            if (ok) {
                ledger.complete(target);
            } else {
                ledger.fail(target, 'no valid ratified artifact covers this diff');
            }
        }
        const tally = ledger.finalize();
        lines.push('');
        lines.push(
            `ledger: planned ${tally.planned} · completed ${tally.completed} · ` +
                `failed ${tally.failed} · out_of_scope ${tally.out_of_scope}`,
        );
    };

    /**
     * The digest of this diff's gated content, recomputed from the tree rather
     * than read from the record.
     *
     * WHICH FILES COUNT IS DECIDED BY THIS CODE, AND IN CI THIS CODE IS THE BASE
     * REVISION'S. The workflow runs the base's copy of this gate with `--root
     * <head>`, so the membership rule a candidate is judged by is one the
     * candidate did not write — and the same holds for the digest, which uses
     * this module's `classifyPaths` and the derived list computed just above.
     * A change that widens the gated set is therefore judged, and written, by
     * the same list.
     */
    let expectedSubject: string;
    let commit: string | null;
    try {
        ({ digest: expectedSubject, revision: commit } = subjectOf(root, files, derived, headCommit));
    } catch (err) {
        // ONE boundary for EVERY failure of the subject computation: each is
        // a subclass of `GatedSubjectRefusal`, so a gate that advertises a
        // refusal cannot crash on one of its own refusal classes instead.
        //
        // Fail closed, and BEFORE the "nothing to ratify" exit: a revision
        // that does not resolve, a git that cannot run, a gated path outside
        // the tree or one that is not absent or a regular file in the commit
        // is content the gate cannot describe, and a gate that cannot
        // describe the content cannot say a record answers for it.
        //
        // NARROW AND TYPED, never a blanket catch: wrapping everything would
        // report a defect in this gate as a property of the checkout. Anything
        // that is not a refusal is a bug here and stays a crash.
        if (!(err instanceof GatedSubjectRefusal)) {
            throw err;
        }
        lines.push(`❌  ${err.message}`);
        close(false);
        return { exitCode: 1, lines, scanned };
    }

    if (!requiresRatification(gated)) {
        lines.push(
            '✅  no kernel rule, governance hook, hook-plumbing source or self edit in the ' +
                'diff — nothing to ratify',
        );
        close(true);
        return { exitCode: 0, lines, scanned };
    }

    const touched = [
        ...gated.kernelRules.map((p) => `kernel rule ${p}`),
        ...gated.governanceHooks.map((p) => `governance hook ${p}`),
        ...gated.plumbing.map((p) => `hook-plumbing source ${p}`),
        ...(gated.self ? ['the ratification mechanism itself (gate, its imports, policy or workflow)'] : []),
    ];
    lines.push(`Gated surfaces in this diff (${touched.length}):`);
    for (const t of touched) {
        lines.push(`  · ${t}`);
    }

    const artifacts = ratificationArtifactsIn(files);
    if (artifacts.length === 0) {
        lines.push('');
        lines.push(
            `❌  no ratification artifact under \`${RATIFICATION_DIR}/\` in this diff. ` +
                'ADR-268 § 4: an agent may modify its constitution and may not ratify its own ' +
                'increase in power. See docs/contracts/ratification-artifact.md.',
        );
        close(false);
        return { exitCode: 1, lines, scanned };
    }

    if (providerCount === null) {
        lines.push('');
        lines.push(
            `❌  \`${POLICY_PATH}\` is missing or unparseable, so the required provider count ` +
                'is unknown. This gate fails closed rather than skipping the diversity rule — a ' +
                'control that passes when it cannot measure is advisory.',
        );
    }

    let anyRatified = false;
    const failures: string[] = [];
    for (const rel of artifacts) {
        // The record is read at the same commit as the content it answers
        // for: a record rewritten in the working tree and never committed is
        // not what a push or a merge would land.
        let text: string;
        try {
            const bytes = commit === null ? null : fileAtRevision(root, commit, rel);
            if (bytes === null) {
                failures.push(`${rel}: listed in the diff but absent at \`${revision}\``);
                continue;
            }
            text = bytes.toString('utf8');
        } catch (err) {
            if (!(err instanceof GatedSubjectRefusal)) {
                throw err;
            }
            failures.push(`${rel}: ${err.message}`);
            continue;
        }
        const reading = readRatification(text, providerCount, expectedSubject);
        if (isRatified(reading)) {
            anyRatified = true;
            lines.push('');
            lines.push(
                `✅  ${rel} — ratified by ${reading.artifact?.reviewed_by} ` +
                    `(providers: ${reading.artifact?.providers.join(', ')}; ` +
                    `effective after ${reading.artifact?.effective_after}; ` +
                    `subject ${String(reading.artifact?.subject).slice(0, 12)}…)`,
            );
            continue;
        }
        if (reading.artifact !== null) {
            failures.push(`${rel}: verdict is \`${reading.artifact.verdict}\`, not \`ratified\``);
            continue;
        }
        for (const p of reading.problems as RatificationProblem[]) {
            failures.push(`${rel}: ${p.message}`);
        }
    }

    if (!anyRatified) {
        lines.push('');
        lines.push('❌  no valid `verdict: ratified` artifact for this diff:');
        for (const f of failures) {
            lines.push(`  · ${f}`);
        }
        close(false);
        return { exitCode: 1, lines, scanned };
    }

    if (failures.length > 0) {
        lines.push('');
        lines.push('⚠️  other ratification artifacts in the diff did not validate:');
        for (const f of failures) {
            lines.push(`  · ${f}`);
        }
    }
    close(true);
    return { exitCode: 0, lines, scanned };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let baseRef: string | null = null;
    let revision = DEFAULT_REVISION;
    let root = REPO;
    // The policy is read relative to THIS SCRIPT's tree, never to `--root`.
    //
    // Round 1 refused the previous shape for a bootstrap reason: CI ran the
    // gate from the PR head, so a candidate diff supplied the code that judged
    // it. The workflow now runs the BASE revision's copy of this script with
    // `--root <head>`, so the judging code is one the PR did not write — and
    // that only holds if the quorum policy comes from the base too. Reading it
    // from `--root` would let the same PR lower `required_providers` and have
    // the base gate honour the lowered number.
    let policyRoot = REPO;
    let quiet = false;
    const files: string[] = [];
    let collectingFiles = false;

    const valueOptions = new Set(['--base-ref', '--root', '--rev', '--policy-root']);
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a !== undefined && valueOptions.has(a)) {
            const value = optionValue(argv, i);
            if (value === null) {
                process.stderr.write(`❌  check_kernel_edit_ratified: ${a} takes a value\n`);
                return 1;
            }
            if (a === '--base-ref') {
                baseRef = value;
            } else if (a === '--root') {
                root = path.resolve(value);
            } else if (a === '--rev') {
                revision = value;
            } else {
                policyRoot = path.resolve(value);
            }
            i += 1;
            collectingFiles = false;
        } else if (a === '--quiet') {
            quiet = true;
            collectingFiles = false;
        } else if (a === '--files') {
            collectingFiles = true;
        } else if (collectingFiles && a !== undefined) {
            files.push(a);
        }
    }

    let changed: string[];
    if (files.length > 0) {
        changed = files;
    } else {
        // ONE resolution for the whole run. The diff, the digest and the
        // record read all receive this id; passing the name to each would let
        // a ref that moves between them yield a file list from one commit and
        // a digest and record from another.
        let commit: string;
        try {
            commit = resolveRevision(root, revision);
        } catch (err) {
            if (!(err instanceof GatedSubjectRefusal)) {
                throw err;
            }
            process.stderr.write(`❌  check_kernel_edit_ratified: ${err.message}\n`);
            return 1;
        }
        try {
            // The base, too, is resolved once: the diff and the closure's base
            // side read the same commit.
            baseRef = resolveRevision(root, resolveBaseRef(baseRef, root));
            changed = changedFilesBetween(root, baseRef, commit);
        } catch (err) {
            if (!(err instanceof GatedSubjectRefusal)) {
                throw err;
            }
            process.stderr.write(`❌  check_kernel_edit_ratified: ${err.message}\n`);
            return 3;
        }
        revision = commit;
    }

    const result = evaluate(changed, root, configuredProviderCount(policyRoot), revision, baseRef);

    // OUTSIDE the quiet guard: CI passes --quiet, and a coverage guard that
    // sees no count reports the gate silent.
    //
    // Through `reportScanned` rather than a bare write, which is what makes the
    // gate HARDENED — `check_gate_coverage`'s predicate is "routes through
    // _lib/scan_scope OR emits the line AND is registered with a floor", and a
    // diff-scoped gate can carry no honest floor (an empty diff scans zero by
    // construction). A bare write put it in the unhardened population and made
    // it owe a `gate-coverage.yml` row it cannot fill.
    reportScanned({
        gate: 'check_kernel_edit_ratified',
        scanned: result.scanned,
        units: 'changed path(s)',
        roots: ['<the diff against the base ref>'],
        allowEmpty:
            'EMPTY_VALID: the corpus is one diff. A commit range that changed nothing is a ' +
            'real state, and there is then no kernel rule, governance hook, plumbing source or ' +
            'mechanism file to ratify — the gate has read everything there was.',
    });
    if (!quiet || result.exitCode !== 0) {
        for (const l of result.lines) {
            process.stdout.write(`${l}\n`);
        }
    }
    return result.exitCode;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    process.exit(main());
}

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
 *   --files F [F …]   override the changed-file list (testing and CI)
 *   --root DIR        repo root the diff and artifacts are read from (testing)
 *   --policy-root DIR where the quorum policy is read from (testing); defaults
 *                     to THIS script's tree, so a base-revision run reads the
 *                     base's policy rather than one the candidate lowered
 *   --quiet           verdict line only
 *
 * Exit codes: 0 = pass (or nothing gated) · 1 = fail · 3 = internal error.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { dispatchImportClosure, verdictModules } from './_lib/dispatch_import_closure.js';
import { is_kernel_rule } from './_lib/kernel_rules.js';
import { reportScanned } from './_lib/scan_scope.js';
import {
    isRatified,
    RATIFICATION_DIR,
    readRatification,
    readRequiredProviders,
    type RatificationProblem,
} from './_lib/ratification_artifact.js';
import { subjectDigest } from './_lib/ratification_subject.js';
import { readAdrFrontmatter } from './_lib/adr_frontmatter.js';
import { readSeats } from './_lib/ratification_artifact.js';

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

/**
 * The review's OWN code, and the contract that states what a record means.
 *
 * Step 4.1. The gate watched itself, its reader, its policy, its workflow and
 * the anchor, and did not watch the modules that compute a record's `subject`,
 * write the record, ask the review's questions and derive its verdict — so the
 * reviewer sat outside what it reviews, which is the shape ADR-268 § 4 exists
 * to forbid one level up. A change to any of these is a change to the reviewer.
 *
 * They are modules of their OWN for exactly this reason: an ordinary change to
 * the council's prompts, transports or session handling stays ungated, because
 * widening the gate to all of `src/scripts/ai_council/` would make every
 * routine council edit carry a record and build the pressure that eventually
 * weakens the gate.
 */
export const REVIEWER_PATHS: readonly string[] = [
    'src/scripts/_lib/ratification_subject.ts',
    'src/scripts/_lib/ratification_record_writer.ts',
    'src/scripts/ai_council/modification_review_questions.ts',
    'src/scripts/ai_council/modification_review.ts',
    'docs/contracts/ratification-artifact.md',
];

/**
 * The high-consequence rule class and the criterion that selects it.
 *
 * Step 4.2. The list is watched so that a change cannot DROP a member in order
 * to edit the rule it names; the schema is watched because the criterion that
 * produced the list lives in its `consequence_class` property, and a criterion
 * nobody ratified selects a class nobody ratified. The schema is shared by
 * every rule, so any edit to it needs a record.
 */
export const CONSEQUENCE_CLASS_PATHS: readonly string[] = [
    'src/config/rule-consequence-class.json',
    'src/scripts/schemas/rule.schema.json',
];

/**
 * Every path gated because it is part of the deciding mechanism rather than
 * part of what the mechanism decides about.
 *
 * ONE list, exported, because two consumers need it: `classifyPaths` below and
 * the digest in `_lib/ratification_subject.ts`. That module used to re-assemble
 * the set from the individual constants, since `classifyPaths` reports this
 * surface as a boolean and the list could not be read back out of it. A second
 * assembly is a second thing to keep in step, and the first edit to diverge
 * would be a path the gate gated and the digest did not cover.
 */
export const SELF_SURFACE: readonly string[] = [
    SELF_PATH,
    READER_PATH,
    CLOSURE_READER_PATH,
    POLICY_PATH,
    WORKFLOW_PATH,
    ...ANCHOR_PATHS,
    ...REVIEWER_PATHS,
    ...CONSEQUENCE_CLASS_PATHS,
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
 * NEITHER IS DENIED AT TOOL-CALL TIME, and this paragraph says so because the
 * sentence it replaces said the opposite. It claimed `dispatch_hook.ts` was in
 * the plumbing guard's source set and `kernel_rules.ts` behind the kernel-rule
 * write guard; `block_plumbing_writes.ts` protects three generated build
 * outputs and not the dispatcher source, and `block_kernel_rule_writes.ts`
 * IMPORTS `kernel_rules.ts` to resolve the nine names without protecting the
 * file it imports. So for these two paths the record is the only layer, not the
 * second one — step 4.3 of
 * `road-to-self-modification-that-a-council-must-pass`.
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
 * Meaningful only where the two trees differ — in CI, where the gate's code is
 * the base revision's and `root` is the head. A local run with `root` equal to
 * the gate's own tree sees no arrivals, and says nothing it cannot measure.
 */
export function closureArrivals(root: string, baseRoot: string = REPO): string[] {
    if (path.resolve(root) === path.resolve(baseRoot)) {
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
 * The reach is deliberately the same as the retired hook's: any path whose
 * basename is a kernel rule filename and which sits under a `rules/` path
 * segment. `src/rules/commit-policy.md` is the source; `.claude/rules/…`,
 * `.augment/rules/…` and `dist/agent-src/rules/…` are projections. A
 * hand-edited projection reaches consumers without the source ever changing,
 * so narrowing this to the source alone would have quietly dropped half of
 * what the deny covered — a retirement is not supposed to be a reduction.
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
    /**
     * Rules in the high-consequence class of `rule-consequence-class.json` that
     * are NOT among the nine kernel rules. Step 4.2: rule law beyond the kernel.
     */
    consequenceRules: string[];
    self: boolean;
}

/**
 * The high-consequence rule slugs, read from the gate's OWN tree.
 *
 * From the script's tree and never from `--root`, for the reason the quorum
 * policy is: in CI this code is the base revision's, so a candidate that
 * removed a member from the list would still be judged against the list the
 * base carries. Reading it from the head would let a change drop a member in
 * order to edit the rule that member names — the exact move the list is on the
 * watch list to make visible.
 *
 * A missing or unparseable file yields an EMPTY set, not a refusal, and the
 * asymmetry with the quorum policy is deliberate: the policy decides whether a
 * control can measure at all, while this list only WIDENS the gated set. An
 * empty list falls back to the kernel-and-hooks reach the gate had before step
 * 4.2, which is the pre-existing floor rather than an open door.
 */
let consequenceSlugCache: ReadonlySet<string> | null = null;

export function consequenceRuleSlugs(repoRoot: string = REPO): ReadonlySet<string> {
    if (repoRoot === REPO && consequenceSlugCache !== null) {
        return consequenceSlugCache;
    }
    let slugs: ReadonlySet<string> = new Set<string>();
    try {
        const raw = fs.readFileSync(path.join(repoRoot, CONSEQUENCE_CLASS_PATHS[0] as string), 'utf8');
        const parsed = JSON.parse(raw) as { members?: unknown };
        const members = parsed.members;
        if (members !== null && typeof members === 'object' && !Array.isArray(members)) {
            slugs = new Set(Object.keys(members as Record<string, unknown>));
        }
    } catch {
        slugs = new Set<string>();
    }
    if (repoRoot === REPO) {
        consequenceSlugCache = slugs;
    }
    return slugs;
}

/** Partition a changed-file list into the surfaces this gate watches. */
export function classifyPaths(
    files: readonly string[],
    derived: readonly string[] = derivedPlumbing(),
    consequence: ReadonlySet<string> = consequenceRuleSlugs(),
): GatedPaths {
    const derivedSet = new Set(derived);
    const kernelRules: string[] = [];
    const governanceHooks: string[] = [];
    const plumbing: string[] = [];
    const consequenceRules: string[] = [];
    let self = false;
    for (const raw of files) {
        const p = raw.replace(/\\/g, '/').trim();
        if (p === '') {
            continue;
        }
        if (SELF_SURFACE.includes(p)) {
            self = true;
            continue;
        }
        const m = KERNEL_RULE_PATH_RE.exec(p);
        if (m !== null && is_kernel_rule(m[1] ?? '')) {
            kernelRules.push(p);
            continue;
        }
        if (m !== null && consequence.has(m[1] ?? '')) {
            consequenceRules.push(p);
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
    return { kernelRules, governanceHooks, plumbing, consequenceRules, self };
}

/** True when anything in the diff requires a ratification artifact. */
export function requiresRatification(gated: GatedPaths): boolean {
    return (
        gated.kernelRules.length > 0 ||
        gated.governanceHooks.length > 0 ||
        gated.plumbing.length > 0 ||
        gated.consequenceRules.length > 0 ||
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

function gitChangedFiles(baseRef: string, root: string): string[] | null {
    const res = spawnSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], {
        cwd: root,
        encoding: 'utf8',
    });
    if (res.status !== 0) {
        return null;
    }
    return (res.stdout ?? '').split('\n').filter((l) => l.trim() !== '');
}

function resolveBaseRef(explicit: string | null, root: string): string {
    if (explicit !== null) {
        return explicit;
    }
    for (const candidate of ['origin/main', 'origin/master', 'main', 'master']) {
        const res = spawnSync('git', ['rev-parse', '--verify', candidate], {
            cwd: root,
            stdio: ['ignore', 'ignore', 'ignore'],
        });
        if (res.status === 0) {
            return candidate;
        }
    }
    return 'HEAD~1';
}

/**
 * The plumbing closure this gate classifies with: the union of the list read
 * from the tree under review and from this script's own tree, so a module
 * present on either side is watched.
 */
function derivedFor(root: string): readonly string[] {
    return [...new Set([...derivedPlumbing(), ...derivedPlumbing(root), ...closureArrivals(root)])];
}

/**
 * The `subject` digest a record must carry to answer for this diff.
 *
 * Exported so that whoever WRITES a record asks the gate for the digest rather
 * than recomputing it from a second reading of the membership rule. A writer
 * that derived its own list would be the second definition of "gated" that
 * `ratification_subject`'s header exists to prevent — and it would fail only
 * for the diffs where the two lists disagree, which are exactly the diffs that
 * widen the gated set.
 */
export function expectedSubjectFor(files: readonly string[], root: string): string {
    return subjectDigest(root, files, derivedFor(root));
}

/** What the escalation message is built from. */
export interface EscalationInput {
    /** The record that did not pass, or `null` when none was written at all. */
    artifact: string | null;
    /** Its verdict, or the reason it could not be read as one. */
    verdict: string;
    /** Per-seat final verdicts, where the record recorded them. */
    seats: ReadonlyMap<string, string>;
    /** The gated paths of this change, already described. */
    touched: readonly string[];
    /** True when the change edits the reviewing mechanism itself. */
    reviewerSurface: boolean;
}

/**
 * The shape of the stop, when a council could not settle a gated change.
 *
 * Step 5.2 of `road-to-self-modification-that-a-council-must-pass`. The run
 * ends with the change open and labelled, the non-passing record in it, and ONE
 * question for the user carrying six things: the council's recommendation, the
 * dissent, the exact change, what it is expected to gain, what it risks, and
 * how it is undone.
 *
 * WHAT THIS FUNCTION CAN AND CANNOT FILL IN, because the difference is the
 * whole honesty of the message. The gate knows the verdict, the per-seat
 * dissent and the exact gated paths, and it fills those in. It does NOT know
 * the expected gain, the risk or the rollback — those are judgements that live
 * in the record's body and in the change itself. So the message ASKS for them
 * by name and says where they are written, rather than printing three empty
 * headings or, worse, inventing plausible ones. A stop that handed the user a
 * confident-looking summary the gate could not have known would be the failure
 * this whole mechanism exists to prevent, reached through the help text.
 */
export function escalationMessage(input: EscalationInput): string[] {
    const { artifact, verdict, seats, touched, reviewerSurface } = input;
    const dissent = [...seats].filter(([, v]) => v !== 'ratified' && v !== 'confirmed-non-expanding');
    const concluded = [...seats].filter(([, v]) => v !== 'no-final-verdict');

    const lines: string[] = [
        '',
        '━━━ The council could not settle this change. It is the user’s call. ━━━',
        '',
        `1. The council’s recommendation: \`${verdict}\`` +
            (concluded.length === 0
                ? ' — no seat reached a final verdict.'
                : ` from ${String(concluded.length)} concluding seat(s).`),
    ];

    lines.push(
        dissent.length === 0
            ? '2. The dissent: none recorded in `seats:` — read the record’s body for it.'
            : `2. The dissent: ${dissent.map(([p, v]) => `${p} → \`${v}\``).join(', ')}.`,
    );

    lines.push(`3. The exact change — ${String(touched.length)} gated path(s):`);
    for (const t of touched) {
        lines.push(`     · ${t}`);
    }
    if (reviewerSurface) {
        lines.push(
            '     This change edits the reviewing mechanism itself, which is condition 4 of',
            '     `ratification-artifact.md` § When the user decides — the owner decides it',
            '     whatever the seats said.',
        );
    }

    const where =
        artifact === null
            ? 'no record was written; there is nothing to read the next three from'
            : `read them from \`${artifact}\` and from the diff`;
    lines.push(
        '4. What it is expected to gain,',
        '5. what it risks, and',
        '6. how it is undone:',
        `     ${where}. This gate does not know them and will not guess:`,
        '     a confident summary it could not have computed is the failure the',
        '     mechanism exists to prevent, arriving through the help text.',
        '',
        'The route by which the user permits a change the council could not pass is',
        '`ratification-artifact.md` § The owner-permission-route. A chat answer is not',
        'that route; the record stays red until the owner acts where an agent cannot.',
        '',
    );
    return lines;
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
): GateResult {
    const lines: string[] = [];
    // The union of the closure read from the tree under review and from this
    // script's own tree: under CI the gate code is the base revision's and
    // `root` is the head, so a module present on either side is watched.
    const derived = derivedFor(root);
    const gated = classifyPaths(files, derived);
    const scanned = files.length;

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
    const expectedSubject = expectedSubjectFor(files, root);

    // Every changed path is a planned target: the gate's denominator is the
    // whole diff, and a path it decided was out of scope is a decision worth
    // counting rather than a silence.
    const ledger = new GateLedger('check_kernel_edit_ratified');
    ledger.plan(files.map((f) => f.replace(/\\/g, '/').trim()).filter((f) => f !== ''));
    const gatedSet = new Set<string>([
        ...gated.kernelRules,
        ...gated.governanceHooks,
        ...gated.plumbing,
        ...gated.consequenceRules,
        ...files.map((f) => f.replace(/\\/g, '/').trim()).filter((f) => SELF_SURFACE.includes(f)),
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

    if (!requiresRatification(gated)) {
        lines.push(
            '✅  no kernel rule, high-consequence rule, governance hook, hook-plumbing ' +
                'source or review-mechanism edit in the diff — nothing to ratify',
        );
        close(true);
        return { exitCode: 0, lines, scanned };
    }

    const touched = [
        ...gated.kernelRules.map((p) => `kernel rule ${p}`),
        ...gated.consequenceRules.map((p) => `high-consequence rule ${p}`),
        ...gated.governanceHooks.map((p) => `governance hook ${p}`),
        ...gated.plumbing.map((p) => `hook-plumbing source ${p}`),
        ...(gated.self
            ? ['the review mechanism itself (gate, reader, policy, workflow, anchor, the review\u2019s own modules, the artifact contract, or the rule-consequence class and its criterion)']
            : []),
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
        /**
         * No record at all is an AUTHORING state, not an unsettled council, so
         * the escalation is withheld — except on the one surface where the
         * owner decides whatever the seats would have said. Telling the author
         * of a reviewer-surface change that before they spend a council round
         * is the point of condition 4; telling the author of an ordinary kernel
         * edit to ask the owner would spend the escalation on "write a record".
         */
        if (gated.self) {
            lines.push(
                ...escalationMessage({
                    artifact: null,
                    verdict: 'no record',
                    seats: new Map<string, string>(),
                    touched,
                    reviewerSurface: true,
                }),
            );
        }
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
    /** Records that parsed but did not pass, kept for the escalation message. */
    const nonPassing: { rel: string; verdict: string; seats: ReadonlyMap<string, string> }[] = [];
    /** True when a record failed on provider diversity rather than on a verdict. */
    let diversityShort = false;
    for (const rel of artifacts) {
        const abs = path.join(root, rel);
        let text: string;
        try {
            text = fs.readFileSync(abs, 'utf8');
        } catch {
            failures.push(`${rel}: listed in the diff but not readable on disk`);
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
        const fm = readAdrFrontmatter(text);
        const seatsReading = fm === null ? { kind: 'absent' as const } : readSeats(fm, text);
        const seats: ReadonlyMap<string, string> =
            seatsReading.kind === 'present' ? seatsReading.seats : new Map<string, string>();

        if (reading.artifact !== null) {
            failures.push(`${rel}: verdict is \`${reading.artifact.verdict}\`, not \`ratified\``);
            nonPassing.push({ rel, verdict: reading.artifact.verdict, seats });
            continue;
        }
        for (const p of reading.problems as RatificationProblem[]) {
            failures.push(`${rel}: ${p.message}`);
            if (p.code === 'diversity-required' || p.code === 'diversity-unverifiable') {
                diversityShort = true;
            }
        }
        // A record whose only defect is diversity still carries a verdict the
        // user needs to see; one that failed on its shape or its binding does
        // not, and asking the owner to adjudicate a malformed file would turn
        // an authoring error into a governance decision.
        const verdictScalar = fm?.scalars['verdict'];
        if (diversityShort && typeof verdictScalar === 'string') {
            nonPassing.push({ rel, verdict: verdictScalar.trim(), seats });
        }
    }

    if (!anyRatified) {
        lines.push('');
        lines.push('❌  no valid `verdict: ratified` artifact for this diff:');
        for (const f of failures) {
            lines.push(`  · ${f}`);
        }
        /**
         * The four conditions of `ratification-artifact.md` § When the user
         * decides, in the order ADR-268 § 4 gives them. A refusal for any OTHER
         * reason — a malformed record, a stale `subject`, a self-ratified one —
         * is an authoring defect the author fixes, and routing it to the owner
         * would spend the escalation on work nobody needs the owner for.
         */
        const unsettled = nonPassing.find(
            (r) => r.verdict === 'non-convergent' || r.verdict === 'refused',
        );
        if (unsettled !== undefined || diversityShort || gated.self) {
            lines.push(
                ...escalationMessage({
                    artifact: unsettled?.rel ?? null,
                    verdict:
                        unsettled?.verdict ??
                        (diversityShort ? 'provider diversity unavailable' : 'no record'),
                    seats: unsettled?.seats ?? new Map<string, string>(),
                    touched,
                    reviewerSurface: gated.self,
                }),
            );
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

    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--base-ref') {
            baseRef = argv[i + 1] ?? null;
            i += 1;
            collectingFiles = false;
        } else if (a === '--root') {
            root = path.resolve(argv[i + 1] ?? root);
            i += 1;
            collectingFiles = false;
        } else if (a === '--policy-root') {
            policyRoot = path.resolve(argv[i + 1] ?? policyRoot);
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
        const fromGit = gitChangedFiles(resolveBaseRef(baseRef, root), root);
        if (fromGit === null) {
            process.stderr.write('❌  check_kernel_edit_ratified: git diff failed\n');
            return 3;
        }
        changed = fromGit;
    }

    const result = evaluate(changed, root, configuredProviderCount(policyRoot));

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

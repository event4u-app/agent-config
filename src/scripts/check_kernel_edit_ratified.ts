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
 * or this gate itself — so it cannot be weakened without its own record. Such
 * a diff must carry a ratification artifact under
 * the ratifications directory with `verdict: ratified`, valid per the
 * ratification-artifact contract.
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
import { is_kernel_rule } from './_lib/kernel_rules.js';
import { reportScanned } from './_lib/scan_scope.js';
import {
    isRatified,
    RATIFICATION_DIR,
    readRatification,
    readRequiredProviders,
    type RatificationProblem,
} from './_lib/ratification_artifact.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');

/** This gate's own path, relative to the repo root. Watched by itself. */
export const SELF_PATH = 'src/scripts/check_kernel_edit_ratified.ts';

/** The reader this gate shares with the artifact contract, also self-watched. */
export const READER_PATH = 'src/scripts/_lib/ratification_artifact.ts';

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
    self: boolean;
}

/** Partition a changed-file list into the surfaces this gate watches. */
export function classifyPaths(files: readonly string[]): GatedPaths {
    const kernelRules: string[] = [];
    const governanceHooks: string[] = [];
    let self = false;
    for (const raw of files) {
        const p = raw.replace(/\\/g, '/').trim();
        if (p === '') {
            continue;
        }
        if (
            p === SELF_PATH ||
            p === READER_PATH ||
            p === POLICY_PATH ||
            p === WORKFLOW_PATH ||
            ANCHOR_PATHS.includes(p)
        ) {
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
        }
    }
    return { kernelRules, governanceHooks, self };
}

/** True when anything in the diff requires a ratification artifact. */
export function requiresRatification(gated: GatedPaths): boolean {
    return gated.kernelRules.length > 0 || gated.governanceHooks.length > 0 || gated.self;
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
    const gated = classifyPaths(files);
    const scanned = files.length;

    // Every changed path is a planned target: the gate's denominator is the
    // whole diff, and a path it decided was out of scope is a decision worth
    // counting rather than a silence.
    const ledger = new GateLedger('check_kernel_edit_ratified');
    ledger.plan(files.map((f) => f.replace(/\\/g, '/').trim()).filter((f) => f !== ''));
    const gatedSet = new Set<string>([
        ...gated.kernelRules,
        ...gated.governanceHooks,
        ...(gated.self ? [SELF_PATH] : []),
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
            '✅  no kernel rule, governance hook or self edit in the diff — nothing to ratify',
        );
        close(true);
        return { exitCode: 0, lines, scanned };
    }

    const touched = [
        ...gated.kernelRules.map((p) => `kernel rule ${p}`),
        ...gated.governanceHooks.map((p) => `governance hook ${p}`),
        ...(gated.self ? ['the ratification mechanism itself (gate, reader, policy or workflow)'] : []),
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
        const abs = path.join(root, rel);
        let text: string;
        try {
            text = fs.readFileSync(abs, 'utf8');
        } catch {
            failures.push(`${rel}: listed in the diff but not readable on disk`);
            continue;
        }
        const reading = readRatification(text, providerCount);
        if (isRatified(reading)) {
            anyRatified = true;
            lines.push('');
            lines.push(
                `✅  ${rel} — ratified by ${reading.artifact?.reviewed_by} ` +
                    `(providers: ${reading.artifact?.providers.join(', ')}; ` +
                    `effective after ${reading.artifact?.effective_after})`,
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
            'real state, and there is then no kernel rule, governance hook or mechanism file ' +
            'to ratify — the gate has read everything there was.',
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

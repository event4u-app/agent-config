#!/usr/bin/env node
/**
 * Verify that the forge enforces what the ratification mechanism claims it does.
 *
 * `check_kernel_edit_ratified` proves a gated diff carries an independently
 * reviewed artifact. It cannot prove the repository required anyone to review
 * it — that lives in repository settings, which no diff contains. This gate is
 * that second limb: it reads the live branch rulesets and compares them against
 * the committed expectation in `src/config/platform-anchor.json`.
 *
 * It fires ONLY on a diff that already requires ratification — a kernel rule, a
 * governance hook, the ratification mechanism itself, or the expectation file.
 * An ordinary pull request never reaches the network through this path, which is
 * what keeps a fail-closed network dependency proportionate.
 *
 * Failing closed is deliberate and was the explicit condition of the decision
 * that commissioned this gate: `unverifiable` is a failure, not a pass, because
 * a control that succeeds when it cannot measure is advisory. The two negative
 * outcomes stay distinct — NONCOMPLIANT was measured and violates policy,
 * UNVERIFIABLE could not be established — because they are different repairs.
 *
 * The policy is read from THIS script's tree rather than from `--root`, for the
 * same reason its sibling reads its quorum policy that way: a base-revision run
 * must not honour an expectation the candidate branch lowered.
 *
 * Usage:
 *   check_platform_anchor [--files F …] [--base-ref REF] [--root DIR]
 *                         [--policy-root DIR] [--repo OWNER/NAME] [--quiet]
 *
 * Exit codes: 0 = pass (or nothing gated) · 1 = fail · 3 = internal error.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import {
    checkAnchorIdentity,
    evaluateAnchor,
    readAnchorPolicy,
    readWaivers,
    type AnchorReading,
    type RulesetDetail,
} from './_lib/platform_anchor.js';
import { reportScanned } from './_lib/scan_scope.js';
import { ANCHOR_PATHS, classifyPaths, requiresRatification } from './check_kernel_edit_ratified.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');

/** The committed expectation. On the gated-surface list, so an edit is reviewed. */
export const POLICY_PATH = 'src/config/platform-anchor.json';

/** How the forge is queried. Injectable so both polarities are testable offline. */
export interface AnchorSource {
    /** `null` on any failure — network, credentials, scope, offline. */
    rulesets(repo: string): RulesetDetail[] | null;
    /** `null` when the default branch cannot be resolved. */
    defaultBranch(repo: string): string | null;
}

function gh(args: readonly string[]): unknown | null {
    const r = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    if (r.status !== 0 || typeof r.stdout !== 'string' || r.stdout.trim() === '') {
        return null;
    }
    try {
        return JSON.parse(r.stdout);
    } catch {
        return null;
    }
}

/**
 * The live source.
 *
 * The listing endpoint returns summaries without `rules` or `bypass_actors`, so
 * each ruleset is fetched individually. A single failed detail read makes the
 * whole reading `null` rather than a partial one: a subset of rulesets would
 * understate the effective protection in one direction and overstate it in the
 * other, and neither is a verdict worth recording.
 */
export const liveSource: AnchorSource = {
    rulesets(repo: string): RulesetDetail[] | null {
        // `--paginate --slurp`, because the listing endpoint pages at 30 and a
        // silently truncated reading is the partial verdict this function's own
        // contract forbids. Truncation can drop an unconditional `bypass_actors`
        // entry onto a page nobody read, so it can overstate safety rather than
        // only understate it. `--slurp` is required alongside: bare
        // `--paginate` emits one JSON array PER PAGE, concatenated, which is not
        // parseable as a single document.
        const paged = gh(['api', '--paginate', '--slurp', `repos/${repo}/rulesets`]);
        if (!Array.isArray(paged)) {
            return null;
        }
        const list = paged.every((p) => Array.isArray(p)) ? paged.flat() : paged;
        const out: RulesetDetail[] = [];
        for (const entry of list) {
            const id = (entry as { id?: unknown } | null)?.id;
            if (typeof id !== 'number') {
                return null;
            }
            const detail = gh(['api', `repos/${repo}/rulesets/${id}`]);
            if (detail === null || typeof detail !== 'object') {
                return null;
            }
            out.push(detail as RulesetDetail);
        }
        return out;
    },
    defaultBranch(repo: string): string | null {
        const meta = gh(['api', `repos/${repo}`]);
        const b = (meta as { default_branch?: unknown } | null)?.default_branch;
        return typeof b === 'string' && b !== '' ? b : null;
    },
};

function gitChangedFiles(baseRef: string, root: string): string[] | null {
    const r = spawnSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], {
        cwd: root,
        encoding: 'utf8',
    });
    if (r.status !== 0) {
        return null;
    }
    return r.stdout.split('\n').map((s) => s.trim()).filter((s) => s !== '');
}

function resolveBaseRef(explicit: string | null, root: string): string {
    if (explicit !== null) {
        return explicit;
    }
    // The same four the sibling gate tries. Two of them were missing here,
    // which on a `master`-default repository silently degraded the scope to a
    // one-commit `HEAD~1` diff — an odd narrowing in a file that otherwise
    // resolves the default branch from the forge.
    for (const ref of ['origin/main', 'origin/master', 'main', 'master']) {
        const r = spawnSync('git', ['rev-parse', '--verify', '--quiet', ref], {
            cwd: root,
            encoding: 'utf8',
        });
        if (r.status === 0) {
            return ref;
        }
    }
    return 'HEAD~1';
}

/** True when the diff touches the expectation file itself. */
export function touchesPolicy(files: readonly string[]): boolean {
    return files.map((f) => f.replace(/\\/g, '/').trim()).includes(POLICY_PATH);
}

export interface AnchorGateResult {
    exitCode: 0 | 1;
    lines: string[];
    scanned: number;
}

export function evaluateGate(
    files: readonly string[],
    policyText: string | null,
    source: AnchorSource,
    repo: string,
    now: Date = new Date(),
): AnchorGateResult {
    const lines: string[] = [];
    const scanned = files.length;
    const classified = classifyPaths(files);
    const gatedPaths = [
        ...classified.kernelRules,
        ...classified.governanceHooks,
        ...files.map((f) => f.replace(/\\/g, '/').trim()).filter((f) => ANCHOR_PATHS.includes(f)),
    ];
    const gated = requiresRatification(classified) || touchesPolicy(files);

    // Per-target accounting, like the sibling gate this one is the second limb
    // of. The verdict is whole-diff by nature — one platform, one answer — but
    // a reader still needs to see WHICH gated path pulled the network read,
    // and a path decided out of scope is a decision worth counting rather than
    // a silence.
    const ledger = new GateLedger('check_platform_anchor');
    ledger.plan(files.map((f) => f.replace(/\\/g, '/').trim()).filter((f) => f !== ''));
    const gatedSet = new Set(gatedPaths);
    for (const target of ledger.unaccountedTargets()) {
        if (!gatedSet.has(target)) {
            ledger.outOfScope(target, 'not_applicable_kind');
        }
    }
    const close = (ok: boolean, why: string): void => {
        for (const target of ledger.unaccountedTargets()) {
            if (ok) {
                ledger.complete(target);
            } else {
                ledger.fail(target, why);
            }
        }
        const tally = ledger.finalize();
        lines.push('');
        lines.push(
            `ledger: planned ${tally.planned} · completed ${tally.completed} · ` +
                `failed ${tally.failed} · out_of_scope ${tally.out_of_scope}`,
        );
    };

    if (!gated) {
        lines.push(
            '✅  no kernel rule, governance hook, ratification mechanism or platform expectation ' +
                'in the diff — the platform anchor is not consulted',
        );
        close(true, '');
        return { exitCode: 0, lines, scanned };
    }

    const { policy, findings: policyFindings } = readAnchorPolicy(policyText);
    const identity = checkAnchorIdentity(policyText, repo);
    if (policy === null || identity.length > 0) {
        lines.push('❌  the platform expectation could not be used:');
        for (const f of [...policyFindings, ...identity]) {
            lines.push(`  · [${f.code}] ${f.message}`);
        }
        close(false, 'the platform expectation could not be used');
        return { exitCode: 1, lines, scanned };
    }

    // Short-circuited deliberately: when the ruleset read already failed there
    // is nothing the default-branch call can change, and evaluating both as
    // arguments spent an API round-trip on every failure path.
    // A malformed waiver is a failure of its own, reported before the platform
    // reading so a reader sees WHY a dimension they thought was waived reds.
    const waivers = readWaivers(policyText, now);
    for (const f of waivers.findings) {
        lines.push(`  · [${f.code}] ${f.message}`);
    }

    const rulesets = source.rulesets(repo);
    const reading: AnchorReading = evaluateAnchor(
        policy,
        rulesets,
        rulesets === null ? null : source.defaultBranch(repo),
        waivers.honoured,
    );
    for (const e of reading.evidence) {
        lines.push(`   ${e}`);
    }
    if (reading.status === 'compliant') {
        lines.push(`✅  platform anchor COMPLIANT for ${repo}`);
        close(true, '');
        return { exitCode: 0, lines, scanned };
    }
    if (reading.status === 'compliant-with-accepted-risk') {
        // Exit 0, and the wording carries the whole difference. Both council
        // seats required that the assertion not imply merge-result validation:
        // a required context certifies the commit it ran on, never that the
        // change composes with the current base.
        lines.push(
            `✅  platform anchor PASS_WITH_ACCEPTED_RISK for ${repo} — every hard dimension is ` +
                'present; the accepted risks above are recorded waivers with an expiry, not ' +
                'silent passes. Current-base compatibility is NOT guaranteed while ' +
                '`strict_required_status_checks` is waived.',
        );
        close(true, '');
        return { exitCode: 0, lines, scanned };
    }
    lines.push('');
    lines.push(
        reading.status === 'unverifiable'
            ? `❌  platform anchor UNVERIFIABLE for ${repo} — this is a failure, not a pass:`
            : `❌  platform anchor NONCOMPLIANT for ${repo}:`,
    );
    for (const f of reading.findings) {
        lines.push(`  · [${f.code}] ${f.message}`);
    }
    close(false, `platform anchor ${reading.status} for ${repo}`);
    return { exitCode: 1, lines, scanned };
}

function resolveRepo(explicit: string | null, root: string): string | null {
    if (explicit !== null) {
        return explicit;
    }
    const r = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' });
    if (r.status !== 0) {
        return null;
    }
    const m = /[:/]([^/:]+\/[^/]+?)(?:\.git)?\s*$/.exec(r.stdout);
    return m?.[1] ?? null;
}

export function main(argv: readonly string[] = process.argv.slice(2), source = liveSource): number {
    let baseRef: string | null = null;
    let root = REPO;
    let policyRoot = REPO;
    let repoArg: string | null = null;
    let quiet = false;
    const files: string[] = [];
    let collectingFiles = false;
    // `--files` with nothing after it is an explicit empty changed-set, not an
    // absent one. Keyed on the FLAG rather than on the list length, because a
    // caller that computed "nothing to check" and a caller that passed no
    // scope at all were otherwise indistinguishable here, and the second reads
    // a git diff that may well be gated.
    let filesFlagSeen = false;

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
        } else if (a === '--repo') {
            repoArg = argv[i + 1] ?? null;
            i += 1;
            collectingFiles = false;
        } else if (a === '--quiet') {
            quiet = true;
            collectingFiles = false;
        } else if (a === '--files') {
            collectingFiles = true;
            filesFlagSeen = true;
        } else if (collectingFiles && a !== undefined) {
            files.push(a);
        }
    }

    let changed: string[];
    if (filesFlagSeen) {
        changed = files;
    } else {
        const fromGit = gitChangedFiles(resolveBaseRef(baseRef, root), root);
        if (fromGit === null) {
            process.stderr.write('❌  check_platform_anchor: git diff failed\n');
            return 3;
        }
        changed = fromGit;
    }

    const repo = resolveRepo(repoArg, root);
    if (repo === null) {
        process.stderr.write(
            '❌  check_platform_anchor: could not resolve the repository from `origin`; ' +
                'pass --repo OWNER/NAME\n',
        );
        return 3;
    }

    let policyText: string | null;
    try {
        policyText = fs.readFileSync(path.join(policyRoot, POLICY_PATH), 'utf8');
    } catch {
        policyText = null;
    }

    const result = evaluateGate(changed, policyText, source, repo);

    reportScanned({
        gate: 'check_platform_anchor',
        scanned: result.scanned,
        units: 'changed path(s)',
        roots: ['<the diff against the base ref>'],
        allowEmpty:
            'EMPTY_VALID: the corpus is one diff. A commit range that changed nothing carries no ' +
            'gated surface, so there is no platform claim to anchor — the gate has read ' +
            'everything there was.',
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

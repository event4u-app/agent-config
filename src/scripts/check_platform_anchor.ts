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

import {
    evaluateAnchor,
    readAnchorPolicy,
    type AnchorReading,
    type RulesetDetail,
} from './_lib/platform_anchor.js';
import { reportScanned } from './_lib/scan_scope.js';
import { classifyPaths, requiresRatification } from './check_kernel_edit_ratified.js';

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
        const list = gh(['api', `repos/${repo}/rulesets`]);
        if (!Array.isArray(list)) {
            return null;
        }
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
    for (const ref of ['origin/main', 'main']) {
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
): AnchorGateResult {
    const lines: string[] = [];
    const scanned = files.length;
    const gated = requiresRatification(classifyPaths(files)) || touchesPolicy(files);

    if (!gated) {
        lines.push(
            '✅  no kernel rule, governance hook, ratification mechanism or platform expectation ' +
                'in the diff — the platform anchor is not consulted',
        );
        return { exitCode: 0, lines, scanned };
    }

    const { policy, findings: policyFindings } = readAnchorPolicy(policyText);
    if (policy === null) {
        lines.push('❌  the platform expectation could not be read:');
        for (const f of policyFindings) {
            lines.push(`  · [${f.code}] ${f.message}`);
        }
        return { exitCode: 1, lines, scanned };
    }

    const reading: AnchorReading = evaluateAnchor(
        policy,
        source.rulesets(repo),
        source.defaultBranch(repo),
    );
    for (const e of reading.evidence) {
        lines.push(`   ${e}`);
    }
    if (reading.status === 'compliant') {
        lines.push(`✅  platform anchor COMPLIANT for ${repo}`);
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

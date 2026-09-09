#!/usr/bin/env tsx
/**
 * check_kernel_edit_ratified — ADR-268 § 4's CI gate, and the replacement for
 * a tool-call deny.
 *
 * Until this gate existed, the control on kernel-rule edits was
 * `src/scripts/hooks/block_kernel_rule_writes.ts`, a PreToolUse deny.
 * ADR-268 § 4 retires it in one sentence and gives the
 * reason: *"the tool-call deny is replaced by a CI gate reading the artifact —
 * one mechanism, not two, because a deny the executing run must bypass is the
 * shape ADR-262 retired."*
 *
 * The concrete failure the deny had. It fires on ONE host (Claude Code is the
 * only host that both binds `pre_tool_use` and honours a deny), so on every
 * other host the guarantee was prose. And it denied the very run that ADR-268
 * authorises — `road-to-typed-grants-that-persist` rewrites five of the nine
 * kernel rules, and the guard refused that roadmap's own execution. A control
 * whose correct use requires bypassing it is not a control.
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
 * Provider diversity is measured, never assumed.
 * The configured member count comes from the council config, which resolves
 * user-global (ADR-104) and is therefore ABSENT in CI. Absent means the
 * diversity rule does not fire and the gate says so on stdout — an unmeasured
 * count is not evidence that diversity was unavailable. Locally, where the
 * config resolves, the rule fires.
 *
 * Inputs:
 *   --base-ref REF    git ref to diff against (default: origin/main, then main)
 *   --files F [F …]   override the changed-file list (testing and CI)
 *   --root DIR        repo root (testing)
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
        if (p === SELF_PATH || p === READER_PATH || p === POLICY_PATH) {
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
        ...(gated.self ? ['the ratification mechanism itself (gate, reader or policy)'] : []),
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
    process.stdout.write(`scanned: ${result.scanned}\n`);
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

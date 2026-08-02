#!/usr/bin/env tsx
/**
 * Lint structural reachability of media governance policies.
 *
 * Ported from the retired Python `src/scripts/lint_media_policy_linkage.py` (ADR-200,
 * Phase 4 / Wave 4b). The CLI contract is pinned — `--quiet`
 * flag read from argv at module load, scan roots + policy ordering (policies
 * sorted; scan files via rglob), finding messages, output channel (all on
 * stdout except the final orphan summary on stderr), exit codes.
 *
 * Every policy file under `agents/settings/policies/media/` (except README)
 * must be linked from at least one of a skill SKILL.md, a routing rule, or a
 * sibling policy file. A policy that no surface references is a silent —
 * failed — policy.
 *
 * The inherited `POLICY_DIR` and `SCAN_ROOTS` were faithful ports of the .py's
 * paths, and every one of them was stale: the policy root was a level too
 * shallow and the referrer roots named the pre-ADR-051 container. Repaired
 * 2026-08-02; see the constants below.
 *
 * Exit codes: 0 all policies linked, 1 one or more orphan policies, 2 dead scope.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DeadScopeError, assertScanned } from './_lib/scan_scope.js';

const QUIET = process.argv.includes('--quiet');

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
/**
 * The policies whose reachability is being checked.
 *
 * This named `agents/policies/media` while the policies have always lived one
 * level deeper, under `agents/settings/policies/media` — the gate's own
 * "…/settings/policies/media/ missing" message named the right path while the
 * constant named the wrong one. Result: `main()` took the missing-dir early
 * return and exited 0 without checking a single policy.
 */
const POLICY_DIR = path.join(REPO, 'agents', 'settings', 'policies', 'media');
const EXEMPT_STEMS: ReadonlySet<string> = new Set(['README']);

/**
 * Surfaces scanned for inbound references to policy files.
 *
 * Three of these named the pre-ADR-051 source container and a fourth named
 * `.claude/skills`, a generated projection absent from this repo — so the
 * reference scan read nothing either. Now the real authoring roots (a command
 * is `src/domains/<pack>/<subpath>/command.md`, hence the domains root) plus
 * the policy directory itself, since a sibling policy is a valid referrer.
 */
const SCAN_ROOTS: readonly string[] = [
    path.join(REPO, 'src', 'skills'),
    path.join(REPO, 'src', 'rules'),
    path.join(REPO, 'src', 'domains'),
    POLICY_DIR,
];

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** `path.stem` — filename without the final suffix. */
function _stem(p: string): string {
    const base = path.basename(p);
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(0, dot) : base;
}

/** POSIX relative path of `target` under `root`. */
function _relToPosix(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

/** Immediate `*.md` children of `dir`, sorted (mirrors sorted(glob('*.md'))). */
function _globMdSorted(dir: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
            out.push(path.join(dir, entry.name));
        }
    }
    return out.sort();
}

/**
 * Recursively list `*.md` files under `dir`. Mirrors Python `root.rglob("*.md")`
 * ordering (top-down directory walk, os.scandir order per directory). The
 * caller only counts referrers, so exact ordering does not affect output.
 */
function _rglobMd(dir: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        const dirs: string[] = [];
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                dirs.push(full);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                out.push(full);
            }
        }
        for (const d of dirs) {
            walk(d);
        }
    };
    walk(dir);
    return out;
}

function emit(msg: string): void {
    if (!QUIET) {
        process.stdout.write(`${msg}\n`);
    }
}

function collect_policies(): string[] {
    if (!_exists(POLICY_DIR)) {
        return [];
    }
    return _globMdSorted(POLICY_DIR).filter((p) => !EXEMPT_STEMS.has(_stem(p)));
}

function collect_scan_files(): string[] {
    const files: string[] = [];
    for (const root of SCAN_ROOTS) {
        if (!_exists(root)) {
            continue;
        }
        files.push(..._rglobMd(root));
    }
    return files;
}

/**
 * Return files that reference `policy` by its repo-relative name or basename.
 * Accept both the full path token (`policies/media/likeness.md`) and the
 * bare basename (`]({likeness.md})`) inside a markdown link.
 */
function referrers_for(policy: string, scanFiles: readonly string[]): string[] {
    const name = path.basename(policy);
    const needles = [`policies/media/${name}`, `](${name})`];
    const referrers: string[] = [];
    const policyResolved = fs.realpathSync(policy);
    for (const scanFile of scanFiles) {
        // A policy can't satisfy its own linkage requirement.
        let scanResolved: string;
        try {
            scanResolved = fs.realpathSync(scanFile);
        } catch {
            scanResolved = scanFile;
        }
        if (scanResolved === policyResolved) {
            continue;
        }
        let text: string;
        try {
            text = fs.readFileSync(scanFile, 'utf-8');
        } catch {
            continue;
        }
        if (needles.some((n) => text.includes(n))) {
            referrers.push(scanFile);
        }
    }
    return referrers;
}

function main(): number {
    // Scope assertions replace the two silent early returns this gate used to
    // take. Both are deliberately WITHOUT `allowEmpty`: "the policy directory
    // is missing" was not a benign optional-surface case here, it was the bug —
    // the constant pointed one level too shallow and the gate green-lit an
    // unchecked policy set for as long as it has existed.
    const policies = collect_policies();
    const scanFiles = collect_scan_files();
    try {
        assertScanned({
            gate: 'lint_media_policy_linkage',
            scanned: policies.length,
            units: 'policy file(s)',
            roots: [_relToPosix(POLICY_DIR, REPO)],
        });
        assertScanned({
            gate: 'lint_media_policy_linkage',
            scanned: scanFiles.length,
            units: 'referrer-candidate file(s)',
            roots: SCAN_ROOTS.map((r) => _relToPosix(r, REPO)),
        });
    } catch (exc) {
        if (!(exc instanceof DeadScopeError)) {
            throw exc;
        }
        process.stderr.write(`❌  ${exc.message}\n`);
        return 2;
    }

    const orphans: string[] = [];
    for (const policy of policies) {
        const referrers = referrers_for(policy, scanFiles);
        const rel = _relToPosix(policy, REPO);
        if (referrers.length === 0) {
            orphans.push(policy);
            emit(`❌  ORPHAN  ${rel}`);
            continue;
        }
        emit(`✅  ${rel}  (${referrers.length} referrer(s))`);
    }

    if (orphans.length > 0) {
        process.stderr.write(
            `\nmedia-policy-linkage: ${orphans.length} orphan policy ` +
                `file(s) — every policy must be linked from a skill, rule, ` +
                `or sibling policy.\n`,
        );
        for (const o of orphans) {
            process.stderr.write(`  - ${_relToPosix(o, REPO)}\n`);
        }
        return 1;
    }

    emit(
        `media-policy-linkage: ${policies.length} policy file(s) — all ` +
            `linked (${scanFiles.length} file(s) scanned for referrers).`,
    );
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export { REPO, POLICY_DIR, SCAN_ROOTS, collect_policies, collect_scan_files, referrers_for, main };

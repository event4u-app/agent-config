#!/usr/bin/env tsx
/**
 * Lint structural reachability of media governance policies.
 *
 * TypeScript twin of `src/scripts/lint_media_policy_linkage.py` (ADR-092,
 * Phase 4 / Wave 4b). Mirrors the Python CLI contract EXACTLY — `--quiet`
 * flag read from argv at module load, scan roots + policy ordering (policies
 * sorted; scan files via rglob), finding messages, output channel (all on
 * stdout except the final orphan summary on stderr), exit codes. No
 * behaviour changes — latent bugs replicated (note: `POLICY_DIR` /
 * `SCAN_ROOTS` point at `agents/policies/media`, matching the .py).
 *
 * Every policy file under `agents/policies/media/` (except README) must be
 * linked from at least one of a skill SKILL.md, a routing rule, or a sibling
 * policy file. A policy that no surface references is a silent — failed — policy.
 *
 * Exit codes: 0 all policies linked, 1 one or more orphan policies.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const QUIET = process.argv.includes('--quiet');

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
const POLICY_DIR = path.join(REPO, 'agents', 'policies', 'media');
const EXEMPT_STEMS: ReadonlySet<string> = new Set(['README']);

// Surfaces scanned for inbound references to policy files.
const SCAN_ROOTS: readonly string[] = [
    path.join(REPO, '.agent-src.uncondensed', 'skills'),
    path.join(REPO, '.agent-src.uncondensed', 'rules'),
    path.join(REPO, '.agent-src.uncondensed', 'commands'),
    path.join(REPO, '.claude', 'skills'),
    path.join(REPO, 'agents', 'policies', 'media'),
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
    if (!_exists(POLICY_DIR)) {
        emit(
            'media-policy-linkage: agents/settings/policies/media/ missing — ' +
                'nothing to lint.',
        );
        return 0;
    }

    const policies = collect_policies();
    if (policies.length === 0) {
        emit(
            'media-policy-linkage: agents/settings/policies/media/ has no policy ' +
                'files — nothing to lint.',
        );
        return 0;
    }

    const scanFiles = collect_scan_files();
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
            `linked.`,
    );
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { REPO, POLICY_DIR, SCAN_ROOTS, collect_policies, collect_scan_files, referrers_for, main };

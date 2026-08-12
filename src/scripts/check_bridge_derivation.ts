#!/usr/bin/env tsx
/**
 * check_bridge_derivation.ts — every generated bridge file hash-derives from
 * its `src/` source (road-to-ecosystem-harvest-skill-quality-gates Phase 4,
 * Source AA).
 *
 * Two deterministic legs:
 *
 *   1. **Symlink leg** — every symlink under a bridge root must resolve to an
 *      existing target inside the repo, under one of the derivation sources
 *      (`dist/agent-src/`, `src/`, `AGENTS.md`). A broken link or a link
 *      escaping the derivation set is a bridge file that does NOT derive.
 *   2. **Regeneration leg** — snapshot the bridge trees (content hash for
 *      regular files, target string for symlinks), re-run the generator
 *      (`condense --generate-tools`), snapshot again. Any added / removed /
 *      changed entry means the tree on disk did not derive from the current
 *      source (hand-edit, stale generation, or a nondeterministic generator).
 *
 * Both legs are scoped to the roots this checkout's generator actually writes:
 * a root whose owning tool is deactivated in `agents/.agent-tools.yml` has no
 * regeneration path, so nothing found there is drift it could repair. Skipped
 * roots are named on stderr, never dropped silently.
 *
 * Run AFTER `task generate-tools` (CI: the sync-consistency job). Exit 1 on
 * the first drifted artefact, naming it.
 */
import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
import { active_tools_at } from './condense.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.join(path.dirname(_HERE), '..', '..');

/** Bridge roots covered by the derivation guarantee (repo-relative; dirs or files). */
export const BRIDGE_ROOTS: readonly string[] = [
    '.claude/rules',
    '.claude/skills',
    '.claude/agents',
    '.claude/personas',
    '.claude/user-types',
    '.cursor/rules',
    '.cursor/commands',
    '.windsurf/rules',
    '.windsurf/workflows',
    '.clinerules',
    '.windsurfrules',
    'GEMINI.md',
    '.augment',
] as const;

/** Repo-relative prefixes a bridge symlink may resolve into. */
const DERIVATION_SOURCES = ['dist/agent-src', 'src', 'AGENTS.md'] as const;

/**
 * Bridge root → the tool id whose activation makes the generator maintain it.
 *
 * A root ABSENT from this map is maintained unconditionally, and `.augment` is
 * the one that matters: `project_to_augment()` carries no tool gate, so mapping
 * it to `augment` would silence the audit on a tree that is regenerated on
 * every run — a strict weakening. Absent-means-unconditional keeps that the
 * default, so a future bridge root has to opt IN to being skippable.
 */
const ROOT_TOOL_ID: Readonly<Record<string, string>> = {
    '.claude/rules': 'claude-code',
    '.claude/skills': 'claude-code',
    '.claude/agents': 'claude-code',
    '.claude/personas': 'claude-code',
    '.claude/user-types': 'claude-code',
    '.cursor/rules': 'cursor',
    '.cursor/commands': 'cursor',
    '.windsurf/rules': 'windsurf',
    '.windsurf/workflows': 'windsurf',
    '.windsurfrules': 'windsurf',
    '.clinerules': 'cline',
    'GEMINI.md': 'gemini',
};

/**
 * Split `roots` into the ones this checkout's generator maintains and the ones
 * it does not, given the active tool set (`null` = all tools active).
 *
 * Auditing a root whose owning tool is inactive is not a drift check: the
 * generator never writes it, so whatever sits there is an unmaintained fossil
 * with no regeneration path. Reporting it leaves hand-deletion as the only
 * compliant action, which is exactly what `check_rule_projection_integrity`
 * rejected as "not a gate" after the same masked-config shape broke the 9.27.0
 * release. This one broke 9.36.0 the same way: `agents/.agent-tools.yml` is
 * committed with all eight tools but carries `skip-worktree` locally and reads
 * `tools: []`, so `.claude/skills/` had not been regenerated since 2026-07-05
 * and still held symlinks to a directory renamed since.
 */
export function partition_roots(
    roots: readonly string[],
    active: ReadonlySet<string> | null,
): { audited: string[]; skipped: string[] } {
    if (active === null) return { audited: [...roots], skipped: [] };
    const audited: string[] = [];
    const skipped: string[] = [];
    for (const r of roots) {
        const tool = ROOT_TOOL_ID[r];
        if (tool === undefined || active.has(tool)) audited.push(r);
        else skipped.push(r);
    }
    return { audited, skipped };
}

function _walk(p: string, out: string[]): void {
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink() || st.isFile()) {
        out.push(p);
        return;
    }
    if (st.isDirectory()) {
        for (const name of fs.readdirSync(p).sort()) {
            _walk(path.join(p, name), out);
        }
    }
}

/** Map of entry → `link:<target>` (symlinks) or `sha256:<hash>` (files) under `root`. */
export function snapshot_tree(root: string): Record<string, string> {
    const out: Record<string, string> = {};
    if (!fs.existsSync(root) && !_isSymlinkRaw(root)) return out;
    const entries: string[] = [];
    _walk(root, entries);
    for (const p of entries) {
        const rel = path.relative(path.dirname(root), p);
        const st = fs.lstatSync(p);
        if (st.isSymbolicLink()) {
            out[rel] = `link:${fs.readlinkSync(p)}`;
        } else {
            out[rel] = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}`;
        }
    }
    return out;
}

function _isSymlinkRaw(p: string): boolean {
    try {
        return fs.lstatSync(p).isSymbolicLink();
    } catch {
        return false;
    }
}

/** Human-readable drift lines between two snapshots; empty = identical. */
export function diff_snapshots(before: Record<string, string>, after: Record<string, string>): string[] {
    const errors: string[] = [];
    for (const k of Object.keys(before).sort()) {
        if (!(k in after)) errors.push(`${k}: present before regeneration, absent after (stale bridge file)`);
        else if (before[k] !== after[k]) errors.push(`${k}: content differs from regenerated output (does not derive from src/)`);
    }
    for (const k of Object.keys(after).sort()) {
        if (!(k in before)) errors.push(`${k}: produced by regeneration but absent before (generation was stale)`);
    }
    return errors;
}

/** Every symlink under `root` must resolve inside `repoRoot` to a derivation source. */
export function validate_symlinks(root: string, repoRoot: string): string[] {
    const errors: string[] = [];
    if (!fs.existsSync(root) && !_isSymlinkRaw(root)) return errors;
    const entries: string[] = [];
    _walk(root, entries);
    for (const p of entries) {
        if (!fs.lstatSync(p).isSymbolicLink()) continue;
        let real: string;
        try {
            real = fs.realpathSync(p);
        } catch {
            errors.push(`${path.relative(repoRoot, p)}: broken symlink (target missing)`);
            continue;
        }
        const rel = path.relative(fs.realpathSync(repoRoot), real);
        if (rel.startsWith('..')) {
            errors.push(`${path.relative(repoRoot, p)}: symlink escapes the repository (${real})`);
            continue;
        }
        const ok = DERIVATION_SOURCES.some((s) => rel === s || rel.startsWith(`${s}${path.sep}`));
        if (!ok) {
            errors.push(`${path.relative(repoRoot, p)}: symlink target '${rel}' is outside the derivation sources (${DERIVATION_SOURCES.join(', ')})`);
        }
    }
    return errors;
}

export function run(repoRoot: string): string[] {
    const errors: string[] = [];
    const { audited, skipped } = partition_roots(BRIDGE_ROOTS, active_tools_at(repoRoot));

    // LOUD, never a silent narrowing: the audited surface just shrank, and a
    // reader who cannot see which roots dropped out cannot distinguish this run
    // from a full one — that indistinguishability is the false green
    // `_lib/scan_scope.ts` exists to prevent.
    if (skipped.length > 0) {
        process.stderr.write(
            `⚠️  check_bridge_derivation: ${skipped.length} bridge root(s) NOT audited — ` +
                `agents/.agent-tools.yml deactivates the owning tool, so the generator does ` +
                `not write them in this checkout and their contents cannot be attributed as ` +
                `drift: ${skipped.join(', ')}. CI activates all eight tools.\n`,
        );
    }

    const roots = audited.map((r) => path.join(repoRoot, r));

    const before: Record<string, Record<string, string>> = {};
    for (const r of roots) before[r] = snapshot_tree(r);

    // Both legs are diffs over these snapshots: with no bridge trees on disk
    // there is nothing to diff and nothing to validate, and the check reports a
    // fixpoint it never tested. Thrown, not returned — `errors` is the drift
    // channel, and a dead scope is not drift.
    //
    // No `allowEmpty` twin of the sibling gate's is needed here, and that is a
    // property of the map rather than an omission: `.augment` is maintained
    // unconditionally, so `audited` is never empty and zero entries always means
    // a genuinely dead surface (no `dist/agent-src/` at all), not a deactivated
    // tool. Map `.augment` to a tool and this reasoning stops holding.
    assertScanned({
        gate: 'check_bridge_derivation',
        scanned: Object.values(before).reduce((n, snap) => n + Object.keys(snap).length, 0),
        units: 'bridge entries',
        roots: audited,
    });

    // Regenerate in a child process so MODULE_STATE resolves exactly as the
    // real pipeline does (no partial in-process state). `--generate-tools`
    // covers the host trees; `--project-augment` covers `.augment` (it is
    // projected by the sync path, not by generate-tools).
    for (const flag of ['--generate-tools', '--project-augment']) {
        execFileSync(path.join(repoRoot, 'scripts-run'), ['src/scripts/condense', flag], {
            cwd: repoRoot,
            stdio: 'pipe',
        });
    }

    for (const r of roots) {
        const rel = path.relative(repoRoot, r);
        for (const e of diff_snapshots(before[r] ?? {}, snapshot_tree(r))) {
            errors.push(`${rel}: ${e}`);
        }
        for (const e of validate_symlinks(r, repoRoot)) {
            errors.push(e);
        }
    }
    return errors;
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_HERE);
if (isMain) {
    const idx = process.argv.indexOf('--root');
    const root = idx !== -1 ? (process.argv[idx + 1] ?? REPO_ROOT) : REPO_ROOT;
    let errors: string[];
    try {
        errors = run(root);
    } catch (exc) {
        if (!(exc instanceof DeadScopeError)) throw exc;
        // Exit 1 is this gate's only failure code.
        process.stderr.write(`❌  ${exc.message}\n`);
        process.exit(1);
    }
    if (errors.length > 0) {
        for (const e of errors) process.stderr.write(`❌  ${e}\n`);
        process.exit(1);
    }
    // Name the count rather than "bridge trees": with a tool deactivated the
    // green covers fewer roots than the reader would assume from a bare tick.
    const n = partition_roots(BRIDGE_ROOTS, active_tools_at(root)).audited.length;
    process.stdout.write(
        `✅  ${n}/${BRIDGE_ROOTS.length} bridge roots derive from src/ ` +
            '(symlink targets valid, regeneration is a fixpoint)\n',
    );
    process.exit(0);
}

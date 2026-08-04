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
 * Run AFTER `task generate-tools` (CI: the sync-consistency job). Exit 1 on
 * the first drifted artefact, naming it.
 */
import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

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
    const roots = BRIDGE_ROOTS.map((r) => path.join(repoRoot, r));

    const before: Record<string, Record<string, string>> = {};
    for (const r of roots) before[r] = snapshot_tree(r);

    // Both legs are diffs over these snapshots: with no bridge trees on disk
    // there is nothing to diff and nothing to validate, and the check reports a
    // fixpoint it never tested. Thrown, not returned — `errors` is the drift
    // channel, and a dead scope is not drift.
    assertScanned({
        gate: 'check_bridge_derivation',
        scanned: Object.values(before).reduce((n, snap) => n + Object.keys(snap).length, 0),
        units: 'bridge entries',
        roots: BRIDGE_ROOTS,
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
    process.stdout.write('✅  bridge trees derive from src/ (symlink targets valid, regeneration is a fixpoint)\n');
    process.exit(0);
}

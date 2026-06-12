#!/usr/bin/env tsx
/**
 * Assert the two A/B clones differ only in the agent-config surface.
 *
 * TypeScript twin of `src/scripts/bench_ab_integrity.py` (ADR-090 py2ts
 * Phase 8 / Wave 8d). The CLI contract mirrors the Python original
 * EXACTLY — `--verbose`, exit codes (0 clean / 1 missing-or-divergent /
 * 2 usage), and byte-identical stdout/stderr. No behaviour changes;
 * latent Python bugs are replicated and flagged as divergence
 * candidates.
 *
 * Phase 1 Step 3 of `agents/roadmaps/road-to-package-impact-benchmark.md`.
 *
 * The bench's whole validity hinges on the two clones being identical except for
 * whether the agent-config surface is present. This script enumerates the file
 * trees of both clones and compares byte-by-byte, allowing differences only at
 * the documented surface paths (`.claude/`, `.augment/`, `AGENTS.md`,
 * `CLAUDE.md`) and the variant manifest.
 *
 * Exit code:
 *     0  — clones are identical except at the allowed surface
 *     1  — clone is missing, or a task-target file diverges between variants
 *     2  — usage error
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// Python: Path(__file__).resolve().parents[2] → repo root.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const AB_ROOT = path.join(REPO_ROOT, 'internal', 'bench', 'ab');
const CLONES = path.join(AB_ROOT, 'clones');

// Surfaces where divergence is expected (variant-bearing).
const ALLOWED_DELTA_PATHS: readonly string[] = ['.claude', '.augment', 'AGENTS.md', 'CLAUDE.md'];
// Variant-distinguishing manifest written by bench_ab_clone.
const ALLOWED_DELTA_FILES: readonly string[] = ['.bench-ab-manifest.json'];

export function is_under_allowed_path(rel: string): boolean {
    // Python: Path(rel).parts; head = parts[0].
    const parts = rel.split('/').filter((p) => p !== '');
    if (parts.length === 0) {
        return false;
    }
    const head = parts[0] as string;
    if (ALLOWED_DELTA_PATHS.includes(head)) {
        return true;
    }
    return ALLOWED_DELTA_FILES.includes(rel);
}

export function file_hash(p: string): string {
    const h = createHash('sha256');
    const fd = fs.openSync(p, 'r');
    try {
        const buf = Buffer.alloc(65536);
        let bytesRead = fs.readSync(fd, buf, 0, buf.length, null);
        while (bytesRead > 0) {
            h.update(buf.subarray(0, bytesRead));
            bytesRead = fs.readSync(fd, buf, 0, buf.length, null);
        }
    } finally {
        fs.closeSync(fd);
    }
    return h.digest('hex');
}

/** Return {relpath: sha256} for every regular file under `root`. */
export function index_clone(root: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const p of _rglobSorted(root)) {
        if (!_isFile(p)) {
            continue;
        }
        const rel = path.relative(root, p).split(path.sep).join('/');
        out[rel] = file_hash(p);
    }
    return out;
}

interface ParsedArgs {
    verbose: boolean;
}

export function parse_args(argv: string[]): ParsedArgs {
    let verbose = false;
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i] as string;
        if (arg === '--verbose') {
            verbose = true;
            i += 1;
            continue;
        }
        if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: bench_ab_integrity [-h] [--verbose]\n');
            process.exit(0);
        }
        _argparseError(`unrecognized arguments: ${arg}`);
    }
    return { verbose };
}

function _argparseError(msg: string): never {
    process.stderr.write(`bench_ab_integrity: error: ${msg}\n`);
    process.exit(2);
}

export function main(argv?: string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const with_root = path.join(CLONES, 'with');
    const without_root = path.join(CLONES, 'without');
    for (const [label, root] of [
        ['with', with_root],
        ['without', without_root],
    ] as const) {
        if (!_exists(root)) {
            process.stderr.write(
                `bench_ab_integrity: ${label} clone missing at ${root} — run scripts/bench_ab_clone.py first\n`,
            );
            return 1;
        }
    }

    const with_index = index_clone(with_root);
    const without_index = index_clone(without_root);

    const withKeys = Object.keys(with_index);
    const withoutKeys = Object.keys(without_index);

    // Files only in `with` — must all sit under the allowed surface
    const only_in_with = _sortedDifference(withKeys, withoutKeys);
    const bad_only_with = only_in_with.filter((rel) => !is_under_allowed_path(rel));
    // Files only in `without` — there should be none
    const only_in_without = _sortedDifference(withoutKeys, withKeys);
    const bad_only_without = only_in_without.filter((rel) => !is_under_allowed_path(rel));
    // Files present in both — must match byte-for-byte unless under the surface
    const shared = _sortedIntersection(withKeys, withoutKeys);
    const bad_diff = shared.filter(
        (rel) => with_index[rel] !== without_index[rel] && !is_under_allowed_path(rel),
    );

    if (args.verbose) {
        process.stdout.write(
            `bench_ab_integrity: with=${withKeys.length} files, without=${withoutKeys.length} files, shared=${shared.length}\n`,
        );
    }

    if (bad_only_with.length === 0 && bad_only_without.length === 0 && bad_diff.length === 0) {
        process.stdout.write(
            'bench_ab_integrity: clones differ only at the allowed surface (.claude, .augment, AGENTS.md, CLAUDE.md, manifest).\n',
        );
        return 0;
    }

    process.stderr.write('bench_ab_integrity: INTEGRITY FAILURE\n');
    if (bad_only_with.length > 0) {
        process.stderr.write('  files only in `with` (NOT in allowed surface):\n');
        for (const rel of bad_only_with) {
            process.stderr.write(`    + ${rel}\n`);
        }
    }
    if (bad_only_without.length > 0) {
        process.stderr.write('  files only in `without` (NOT in allowed surface):\n');
        for (const rel of bad_only_without) {
            process.stderr.write(`    - ${rel}\n`);
        }
    }
    if (bad_diff.length > 0) {
        process.stderr.write('  files present in both but byte-divergent:\n');
        for (const rel of bad_diff) {
            process.stderr.write(`    ~ ${rel}\n`);
        }
    }
    return 1;
}

// --- pathlib / Python parity helpers ----------------------------------------

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** sorted(root.rglob("*")) — component-wise (pathlib) order. */
function _rglobSorted(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            out.push(full);
            if (ent.isDirectory()) {
                walk(full);
            }
        }
    };
    walk(root);
    out.sort(_pathPartsCompare);
    return out;
}

function _pathPartsCompare(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i += 1) {
        const x = pa[i] as string;
        const y = pb[i] as string;
        if (x < y) return -1;
        if (x > y) return 1;
    }
    return pa.length - pb.length;
}

/** sorted(set(a) - set(b)) — string sort of the relpaths. */
function _sortedDifference(a: string[], b: string[]): string[] {
    const bSet = new Set(b);
    const diff = a.filter((x) => !bSet.has(x));
    return [...new Set(diff)].sort(_strCmp);
}

/** sorted(set(a) & set(b)) — string sort of the relpaths. */
function _sortedIntersection(a: string[], b: string[]): string[] {
    const bSet = new Set(b);
    const inter = a.filter((x) => bSet.has(x));
    return [...new Set(inter)].sort(_strCmp);
}

function _strCmp(x: string, y: string): number {
    return x < y ? -1 : x > y ? 1 : 0;
}

const _isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isMain) {
    process.exit(main());
}

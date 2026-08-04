#!/usr/bin/env tsx
/**
 * One-off script-location guard (Phase 0a.2 of road-to-rule-hardening).
 *
 * Ported from the retired Python `src/scripts/check_one_off_location.py` (ADR-200,
 * Phase 4 / Wave 4c). The CLI contract is pinned — the
 * `--quiet` flag, exit codes (0 clean, 1 violation, 3 internal error),
 * stdout/stderr split, byte-identical finding messages, and the same
 * scan scope (`src/scripts/**\/_one_off_*.py`) and file ordering. No
 * behaviour changes — historical quirks preserved (consumers pin the exact behaviour).
 *
 * Every `_one_off_*.py` script under `scripts/` must live inside the
 * archive folder `scripts/ai_council/one_off_archive/<YYYY-MM>/`. The
 * guard fails CI if a new probe lands anywhere else in the tree.
 *
 * Rationale: one-off council probes / phase-specific measurements are
 * inherently single-purpose; their durable artefact is the council
 * session under `agents/runtime/council/sessions/`. Keeping them in the
 * archive prevents the `scripts/` root from accumulating noise and
 * makes their lifecycle visible (folder == month archived).
 *
 * Exit codes:
 *     0 = clean
 *     1 = violation (script outside the archive)
 *     3 = internal error
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

// src/scripts/check_one_off_location.ts → two dirs up is the repo root.
// Mirrors the Python `Path(__file__).resolve().parent.parent.parent`.
const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SCRIPTS = path.join(REPO_ROOT, 'src', 'scripts');
const ARCHIVE = path.join(SCRIPTS, 'ai_council', 'one_off_archive');
const ARCHIVE_MONTH_RE = /^\d{4}-\d{2}$/;

/** `true` when `child` is at or below `root` (mirrors `Path.relative_to` not raising). */
function _isUnder(child: string, root: string): boolean {
    const rel = path.relative(root, child);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function _relParts(child: string, root: string): string[] {
    const rel = path.relative(root, child);
    return rel.split(path.sep);
}

/** Sorted recursive glob of `_one_off_*.py` files under SCRIPTS (mirrors `rglob`). */
function _rglobOneOff(root: string): string[] {
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
            if (ent.name.startsWith('_one_off_') && ent.name.endsWith('.py')) {
                out.push(full);
            }
            if (ent.isDirectory()) {
                walk(full);
            }
        }
    };
    walk(root);
    out.sort();
    return out;
}

/** Files the guard's walk visits under `root` — the scope, not the matches. */
function _countFilesUnder(root: string): number {
    let n = 0;
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            if (ent.isDirectory()) {
                walk(path.join(dir, ent.name));
            } else {
                n += 1;
            }
        }
    };
    walk(root);
    return n;
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

export function find_violations(): string[] {
    const violations: string[] = [];
    for (const p of _rglobOneOff(SCRIPTS)) {
        if (!_isFile(p)) {
            continue;
        }
        // Must live under scripts/ai_council/one_off_archive/<YYYY-MM>/
        if (p !== ARCHIVE && !_isUnder(p, ARCHIVE)) {
            violations.push(p);
            continue;
        }
        // rel = "<YYYY-MM>/<name>.py"
        const parts = _relParts(p, ARCHIVE);
        if (parts.length !== 2 || !ARCHIVE_MONTH_RE.test(parts[0] as string)) {
            violations.push(p);
        }
    }
    return violations;
}

interface Args {
    quiet: boolean;
}

function parse_args(argv: readonly string[]): Args {
    let quiet = false;
    for (const arg of argv) {
        if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: check_one_off_location [-h] [--quiet]\n',
            );
            process.exit(0);
        } else {
            process.stderr.write(`check_one_off_location: error: unrecognized arguments: ${arg}\n`);
            process.exit(2);
        }
    }
    return { quiet };
}

export function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    // The unit is every file the walk visits, NOT the `_one_off_*.py` matches:
    // zero matches is the normal clean state (the archive is empty today), so
    // only the unfiltered walk can tell "nothing to move" from "nothing read".
    try {
        assertScanned({
            gate: 'check_one_off_location',
            scanned: _countFilesUnder(SCRIPTS),
            units: 'file(s)',
            roots: ['src/scripts'],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            // 1 = violation (3 is reserved for an internal error below).
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    let violations: string[];
    try {
        violations = find_violations();
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        process.stderr.write(`❌  internal error: ${msg}\n`);
        return 3;
    }

    if (violations.length) {
        process.stderr.write('❌  one-off scripts outside the archive:\n');
        for (const p of violations) {
            const rel = path.relative(REPO_ROOT, p).split(path.sep).join('/');
            process.stderr.write(`    ${rel}\n`);
        }
        process.stderr.write(
            '\n  Move them under ' +
                'src/scripts/ai_council/one_off_archive/<YYYY-MM>/ ' +
                "(see that folder's README.md).\n",
        );
        return 1;
    }

    if (!args.quiet) {
        process.stdout.write('✅  all _one_off_*.py scripts are archived\n');
    }
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

export { REPO_ROOT, SCRIPTS, ARCHIVE, ARCHIVE_MONTH_RE };

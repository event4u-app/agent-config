#!/usr/bin/env tsx
/**
 * Advisory check for `.augmentignore` (road-to-governance-cleanup F6.3).
 *
 * Ported from the retired Python `src/scripts/check_augmentignore.py` (ADR-200,
 * Phase 4 / Wave 4c). CLI contract mirrored EXACTLY — `--quiet` flag,
 * always exits 0, byte-identical advisory messages, same staleness /
 * min-useful-lines thresholds, stdout-only output.
 *
 * Runs as part of `task ci` to surface `/optimize augmentignore` as a
 * periodic reminder. Always exits 0 — this is a warn-only advisory, not
 * a gate. Failures here never block CI.
 *
 * Checks performed:
 *   1. Does `.augmentignore` exist at repo root?
 *   2. Is its mtime older than 90 days? (stale reminder)
 *   3. Is it suspiciously short (<5 non-blank, non-comment lines)?
 *
 * If any check trips, prints a friendly hint and exits 0. If all clean,
 * prints a single-line OK and exits 0.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { asOfMs } from './_lib/as_of.js';
import { assertWatchlistResolves, DeadScopeError } from './_lib/scan_scope.js';

const QUIET = process.argv.slice(2).includes('--quiet');

const STALE_DAYS = 90;
const MIN_USEFUL_LINES = 5;
// src/scripts/check_augmentignore.ts → three dirs up is the repo root.
// Mirrors Python `Path(__file__).resolve().parent.parent.parent`.
const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

function _emit(notes: readonly string[]): void {
    if (notes.length === 0) {
        if (!QUIET) {
            process.stdout.write('✅  .augmentignore advisory: nothing to suggest.\n');
        }
        return;
    }
    process.stdout.write('📒  .augmentignore advisory (non-blocking):\n');
    for (const n of notes) {
        process.stdout.write(`    ${n}\n`);
    }
    process.stdout.write('    (This is a reminder, not a CI failure.)\n');
}

function check(): number {
    const target = path.join(REPO_ROOT, '.augmentignore');
    const notes: string[] = [];

    // The whole scan scope is this one file, so its absence IS the dead-scope
    // case. It used to surface as a scaffolding hint on stdout, which reads the
    // same whether the file was never written or the root moved. The exit code
    // stays 0 because "always exits 0" is this file's pinned contract (advisory,
    // not a gate) — there is no failure code to choose between.
    try {
        assertWatchlistResolves({
            gate: 'check_augmentignore',
            candidates: ['.augmentignore'],
            repoRoot: REPO_ROOT,
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(
                `⚠️  ${exc.message}\n` +
                    '    Run `/optimize augmentignore` to scaffold it.\n',
            );
            return 0;
        }
        throw exc;
    }

    const mtimeMs = fs.statSync(target).mtimeMs;
    const age_days = (asOfMs() - mtimeMs) / 86400000;
    if (age_days > STALE_DAYS) {
        notes.push(
            `ℹ️  .augmentignore is ${Math.trunc(age_days)} days old (threshold: ${STALE_DAYS}) — ` +
                'consider running `/optimize augmentignore` to refresh.',
        );
    }

    // Python `str.splitlines()` splits on \n / \r\n / \r and drops a single
    // trailing newline; useful = lines that are non-blank and don't start
    // with `#` after strip.
    const useful = fs
        .readFileSync(target, 'utf-8')
        .split(/\r\n|\r|\n/)
        .filter((ln) => {
            const s = ln.trim();
            return s !== '' && !s.startsWith('#');
        });
    if (useful.length < MIN_USEFUL_LINES) {
        notes.push(
            `ℹ️  .augmentignore has only ${useful.length} active entries — ` +
                'run `/optimize augmentignore` to detect tech-stack ignores you may be missing.',
        );
    }

    _emit(notes);
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
    process.exit(check());
}

export { REPO_ROOT, STALE_DAYS, MIN_USEFUL_LINES, check };

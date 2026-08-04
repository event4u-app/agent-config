#!/usr/bin/env tsx
/**
 * Phase 5.2 — Detect files that are tracked by git but now ignored
 * (the class of drift where an ignore pattern was added AFTER the file
 * was committed, so the file stays in the index even though git would
 * no longer add it fresh).
 *
 * Reports the exact `git rm --cached <path>` commands to fix the issue.
 * NEVER executes them automatically — git ops are user-owned per the
 * git-ops permission gates (scope-control rule).
 *
 * Exit codes:
 *   0 — no tracked-but-ignored files found
 *   1 — one or more tracked-but-ignored files found
 *   2 — git command failed or not in a git repo
 */
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as path from 'node:path';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);

function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    const quiet = args.includes('--quiet');

    let tracked: string;
    let output: string;
    try {
        // The corpus is the tracked index, not the `-ci` result — that result IS
        // the finding list, so counting it would count violations. Read the index
        // itself: `git ls-files` is path-scoped to the cwd, so running from a
        // subtree with nothing tracked yields an empty index AND an empty `-ci`
        // result, and the gate prints its green line having examined nothing.
        tracked = execSync('git ls-files', { encoding: 'utf-8', cwd: process.cwd() }).trim();
        output = execSync('git ls-files -ci --exclude-standard', {
            encoding: 'utf-8',
            cwd: process.cwd(),
        }).trim();
    } catch {
        process.stdout.write(`❌  git ls-files failed — not in a git repo or git not available\n`);
        return 2;
    }

    try {
        assertScanned({
            gate: 'check_tracked_but_ignored',
            scanned: tracked ? tracked.split('\n').filter(Boolean).length : 0,
            units: 'tracked file(s)',
            roots: ['git ls-files (cwd-scoped index)'],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            // 2 = "this gate could not run" (its git-unavailable code), never 1,
            // which asserts the stronger claim that ignored-but-tracked files exist.
            process.stderr.write(`❌  ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }

    if (!output) {
        if (!quiet) {
            process.stdout.write(`✅  No tracked-but-ignored files found.\n`);
        }
        return 0;
    }

    const files = output.split('\n').filter(Boolean);
    process.stdout.write(
        `❌  ${files.length} file${files.length === 1 ? '' : 's'} are tracked by git but now ignored:\n\n`,
    );
    for (const f of files) {
        process.stdout.write(`  ${f}\n`);
    }
    process.stdout.write(
        `\nTo fix, run:\n\n  git rm --cached \\\n    ` +
            files.join(' \\\n    ') +
            `\n\nThen commit the result. The files stay on disk (only removed from the index).\n`,
    );
    return 1;
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

export { main };

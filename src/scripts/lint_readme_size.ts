#!/usr/bin/env tsx
/**
 * CI guard for README.md line budget.
 *
 * Ported from the retired Python `src/scripts/lint_readme_size.py` (ADR-200, Phase 4 /
 * Wave 4b). The CLI contract is pinned — `--quiet` flag, exit
 * codes (0 within budget, 1 over budget / missing), stdout/stderr split,
 * byte-identical finding messages.
 *
 * The role-first-onboarding roadmap (Phase 2 Step 6) freezes README at
 * its current length: replace, do not grow. Every line added above the
 * fold must displace an existing line. Budget: 750 lines max.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertWatchlistResolves, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);

const README = 'README.md';
const LIMIT = 750;

/**
 * Count splitlines() entries the way Python does — terminal `\n` does NOT
 * yield a trailing empty entry. Universal-newline aware (\r\n / \r / \n).
 */
function _splitlinesCount(text: string): number {
    // Python str.splitlines() splits on \n, \r, \r\n (and more), and does
    // not append a trailing empty element when the string ends with a line
    // boundary. README.md contains only \n / \r\n in practice; we replicate
    // the \n / \r\n / \r families which cover all real inputs.
    if (text === '') {
        return 0;
    }
    // Normalise \r\n and lone \r to \n, then count by splitting and dropping
    // the trailing empty element that a terminal newline produces.
    const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const parts = normalised.split('\n');
    if (parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts.length;
}

function main(): number {
    const quiet = process.argv.slice(2).includes('--quiet');
    // README is this gate's whole scope and resolves against cwd, so a wrong
    // cwd is indistinguishable from a deleted file. Replaces the bare
    // existsSync check: same exit code, but the failure now names the root it
    // looked under. Exit 1 is the only failure code this CLI has (over budget /
    // missing) — here it means "could not run", not "over budget".
    try {
        assertWatchlistResolves({
            gate: 'lint_readme_size',
            candidates: [README],
            repoRoot: process.cwd(),
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            // First line is the pinned py2ts wording; the second names the root.
            process.stderr.write(`error: ${README} not found\n`);
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }
    const text = fs.readFileSync(README, 'utf-8');
    const n = _splitlinesCount(text);
    if (n > LIMIT) {
        process.stdout.write(
            `FAIL  ${README}: ${n} lines (limit ${LIMIT}). Trim before merge.\n`,
        );
        return 1;
    }
    if (!quiet) {
        process.stdout.write(`OK    ${README}: ${n} lines (limit ${LIMIT}).\n`);
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

export { README, LIMIT, main };

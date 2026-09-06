#!/usr/bin/env tsx
/**
 * CI guard for README.md size and time-to-first-command.
 *
 * Ported from the retired Python `src/scripts/lint_readme_size.py` (ADR-200, Phase 4 /
 * Wave 4b). The CLI contract is pinned — `--quiet` flag, exit
 * codes (0 within budget, 1 over budget / missing), stdout/stderr split.
 *
 * The role-first-onboarding roadmap (Phase 2 Step 6) freezes README at
 * its current length: replace, do not grow. Every line added above the
 * fold must displace an existing line.
 *
 * Three budgets, because a line budget alone missed a full regression of this
 * file once already — see WORD_LIMIT below for the measurement and the reason
 * the two newer numbers are not derived from the current file.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { assertWatchlistResolves, DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);

const README = 'README.md';
const LIMIT = 750;

/**
 * Word and first-command budgets, derived from the README as it stood when
 * `readme-and-docs-improvement.md` archived — NOT from the current file.
 *
 * That roadmap reached this same goal and archived complete on 2026-05-18. The
 * file then drifted back, and the line budget above could not see it: lines
 * went 747 -> 638, which is *better*, while words went 4849 -> 5550 and the
 * first executable command moved from line 75 to line 160. A guard measuring
 * only lines stayed green through every step of that, with 112 lines to spare.
 *
 * **This is the third recorded arrival of the same complaint, and nothing in
 * the repository caught any of them.** Two independent external readers raised
 * it again on 2026-09-06, three months after the fix archived as complete. A
 * budget nobody watches is how a fix stops holding, which is why these two
 * numbers are registered in `src/config/gate-coverage.yml` rather than living
 * only here: removing them is then a gate failure rather than a quiet edit.
 *
 * Deriving these two numbers from the current file would make the gate green
 * on day one and ratchet the regression in as the new floor. They come from
 * the archive commit instead, and this command re-derives both:
 *
 *   git show 032a244a3:README.md > /tmp/r.md && \
 *     echo "words=$(wc -w < /tmp/r.md)" \
 *          "first_fence=$(grep -n '^```' /tmp/r.md | head -1 | cut -d: -f1)"
 *   # words=4849 first_fence=75
 */
const WORD_LIMIT = 4849;
const FIRST_COMMAND_LIMIT = 75;

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
    if (process.argv.slice(2).includes('--self-test')) return selfTest();
    const quiet = process.argv.slice(2).includes('--quiet');
    const rootArgIdx = process.argv.indexOf('--root');
    const root = rootArgIdx === -1 ? process.cwd() : (process.argv[rootArgIdx + 1] ?? process.cwd());
    // README is this gate's whole scope and resolves against cwd, so a wrong
    // cwd is indistinguishable from a deleted file. Replaces the bare
    // existsSync check: same exit code, but the failure now names the root it
    // looked under. Exit 1 is the only failure code this CLI has (over budget /
    // missing) — here it means "could not run", not "over budget".
    try {
        assertWatchlistResolves({
            gate: 'lint_readme_size',
            candidates: [README],
            repoRoot: root,
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
    reportScanned({
        gate: 'lint_readme_size',
        scanned: 1,
        units: 'file',
        roots: [README],
    });
    const text = fs.readFileSync(path.join(root, README), 'utf-8');
    const n = _splitlinesCount(text);
    const words = countWords(text);
    const firstCommand = firstCommandLine(text);

    // All three figures print on both paths. The regression this gate missed
    // was visible in two numbers nobody was shown, so reporting only the one
    // that failed would rebuild the blind spot one measurement further along.
    const report =
        `${README}: ${String(n)} lines (limit ${String(LIMIT)}) · ` +
        `${String(words)} words (limit ${String(WORD_LIMIT)}) · ` +
        `first command at line ${firstCommand === null ? 'none' : String(firstCommand)} ` +
        `(limit ${String(FIRST_COMMAND_LIMIT)})`;

    const failures: string[] = [];
    if (n > LIMIT) failures.push(`${String(n)} lines exceeds ${String(LIMIT)}`);
    if (words > WORD_LIMIT) {
        failures.push(`${String(words)} words exceeds ${String(WORD_LIMIT)}`);
    }
    if (firstCommand === null) {
        failures.push('no fenced command block at all');
    } else if (firstCommand > FIRST_COMMAND_LIMIT) {
        failures.push(
            `first command at line ${String(firstCommand)} exceeds ${String(FIRST_COMMAND_LIMIT)}`,
        );
    }

    if (failures.length > 0) {
        process.stdout.write(`FAIL  ${report}\n`);
        for (const f of failures) {
            process.stdout.write(`      - ${f}\n`);
        }
        process.stdout.write('      Trim before merge.\n');
        return 1;
    }
    if (!quiet) {
        process.stdout.write(`OK    ${report}\n`);
    }
    return 0;
}

/** Whitespace-separated tokens, matching `wc -w` (which the budget derives from). */
function countWords(text: string): number {
    const trimmed = text.trim();
    return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/**
 * 1-based line of the first fenced block, or `null` when there is none.
 *
 * The opening fence is what a reader's eye reaches, so the fence line itself
 * is the measurement — not the first line of code inside it.
 */
function firstCommandLine(text: string): number | null {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    for (let i = 0; i < lines.length; i += 1) {
        if (lines[i]!.startsWith('```')) return i + 1;
    }
    return null;
}

/**
 * The gate proving it still DISCRIMINATES, not merely that it ran.
 *
 * One rejecting case per budget, because the failure this gate exists to end
 * was a guard that measured one of the three and stayed green while the other
 * two regressed. A suite that only exercises the line budget would reproduce
 * that blind spot exactly.
 */
function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'readme-selftest-'));
    const write = (name: string, body: string): string => {
        const dir = path.join(tmp, name);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, README), body, 'utf-8');
        return dir;
    };
    const run = (root: string): number =>
        runGateCli(process.cwd(), 'src/scripts/lint_readme_size.ts', ['--root', root], root);

    const fence = '```bash\nnpx thing\n```\n';
    const filler = (n: number): string => `${'word '.repeat(n).trim()}\n`;

    try {
        return runSelfTest({
            gate: 'lint_readme_size',
            minCases: 4,
            minRejectCases: 3,
            cases: [
                {
                    name: 'a README whose first command sits below the budget is rejected',
                    expect: 'reject',
                    run: () =>
                        run(write('late-command', `${'filler\n'.repeat(FIRST_COMMAND_LIMIT + 5)}${fence}`)),
                },
                {
                    name: 'a README over the word budget is rejected',
                    expect: 'reject',
                    run: () => run(write('wordy', `${fence}${filler(WORD_LIMIT + 50)}`)),
                },
                {
                    name: 'a README over the line budget is rejected',
                    expect: 'reject',
                    run: () => run(write('long', `${fence}${'x\n'.repeat(LIMIT + 5)}`)),
                },
                {
                    name: 'a short README with an early command passes',
                    expect: 'accept',
                    run: () => run(write('good', `# Title\n\n${fence}`)),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
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

export { README, LIMIT, WORD_LIMIT, FIRST_COMMAND_LIMIT, countWords, firstCommandLine, main };

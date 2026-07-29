#!/usr/bin/env tsx
/**
 * Safety-floor exclusion linter (Phase 2A.0 of road-to-structural-optimization).
 *
 * Ported from the retired Python `src/scripts/check_safety_floor_untouched.py` (ADR-200,
 * Phase 4 / Wave 4c). The CLI contract is pinned — `--baseline`
 * / `--skip-if-no-baseline` flags, exit codes (0 clean/skipped, 1 floor
 * file modified, 3 internal error), stdout/stderr split, byte-identical
 * messages, the same git plumbing and the same `origin/main` → `main`
 * fallback. Historical quirks are preserved deliberately — tests and downstream consumers pin the exact behaviour.
 *
 * Per Q3=A locked decision (council Round 3, 2026-05-03), the four
 * safety-floor always-rules are out of scope for Phase 2A slimming:
 *   - non-destructive-by-default
 *   - commit-policy
 *   - scope-control
 *   - verify-before-complete
 *
 * Exit codes: 0 = clean (or skipped — see `--skip-if-no-baseline`),
 * 1 = safety-floor file modified, 3 = internal error.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertWatchlistResolves } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
/**
 * Root the four floor rules live under (ADR-051).
 *
 * Until 2026-07-29 this named the retired source container, so the guard
 * compared diffs against paths absent from every commit and reported
 * `✅ Safety-floor untouched (4 rules guarded)` no matter what was edited.
 * `assertWatchlistResolves` below now makes that state a loud failure instead
 * of a clean bill of health.
 *
 * A first pass also kept the legacy path "in case a pre-ADR-051 baseline names
 * it". That was speculative — CI always diffs against current `main` — and it
 * tripped `check_no_new_legacy_path`, which is right: the source of truth is
 * `src/`, and a dead path kept alive for an unmeasured scenario is how the
 * original defect survived.
 */
const RULES_DIR_REL = 'src/rules';
const RULES_DIRS_REL = [RULES_DIR_REL] as const;
const SAFETY_FLOOR = [
    'non-destructive-by-default.md',
    'commit-policy.md',
    'scope-control.md',
    'verify-before-complete.md',
] as const;

/** Every repo-relative path this guard watches, across all known roots. */
function _floor_candidates(): string[] {
    return RULES_DIRS_REL.flatMap((dir) => SAFETY_FLOOR.map((name) => `${dir}/${name}`));
}

/** Which of `changed` are guarded floor files. Pure — the gate's whole decision. */
function _breaches(changed: readonly string[]): string[] {
    const floorPaths = new Set(_floor_candidates());
    return changed.filter((p) => floorPaths.has(p)).sort();
}

function _run_git(args: string[]): [number, string] {
    const proc = spawnSync('git', args, {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
    });
    const code = proc.status === null ? 1 : proc.status;
    return [code, (proc.stdout ?? '') + (proc.stderr ?? '')];
}

function _baseline_exists(ref: string): boolean {
    const [code] = _run_git(['rev-parse', '--verify', '--quiet', ref]);
    return code === 0;
}

/**
 * Files changed between `baseline` and `head`.
 *
 * `head` is parameterised (default `HEAD`) so the guard is verifiable against a
 * real historical range — without it the only way to exercise a breach was to
 * manufacture a commit, which is why this gate shipped untested for months.
 */
function _changed_files(baseline: string, head = 'HEAD'): string[] {
    const [code, output] = _run_git(['diff', '--name-only', `${baseline}...${head}`]);
    if (code !== 0) {
        throw new Error(`git diff failed: ${output}`);
    }
    return output
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

interface ParsedArgs {
    baseline: string;
    head: string;
    skip_if_no_baseline: boolean;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    const args: ParsedArgs = { baseline: 'origin/main', head: 'HEAD', skip_if_no_baseline: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--baseline') {
            const v = argv[++i];
            if (v === undefined) {
                process.stderr.write(
                    'check_safety_floor_untouched: error: argument --baseline: expected one argument\n',
                );
                process.exit(2);
            }
            args.baseline = v;
        } else if (arg.startsWith('--baseline=')) {
            args.baseline = arg.slice('--baseline='.length);
        } else if (arg === '--head') {
            const v = argv[++i];
            if (v === undefined) {
                process.stderr.write(
                    'check_safety_floor_untouched: error: argument --head: expected one argument\n',
                );
                process.exit(2);
            }
            args.head = v;
        } else if (arg.startsWith('--head=')) {
            args.head = arg.slice('--head='.length);
        } else if (arg === '--skip-if-no-baseline') {
            args.skip_if_no_baseline = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: check_safety_floor_untouched [-h] [--baseline BASELINE] [--head HEAD] [--skip-if-no-baseline]\n',
            );
            process.exit(0);
        } else {
            process.stderr.write(
                `check_safety_floor_untouched: error: unrecognized arguments: ${arg}\n`,
            );
            process.exit(2);
        }
    }
    return args;
}

function main(): number {
    const args = parse_args(process.argv.slice(2));

    if (!_baseline_exists(args.baseline)) {
        if (args.skip_if_no_baseline) {
            process.stdout.write(`ℹ️  baseline ${args.baseline} not found — skipped\n`);
            return 0;
        }
        // Fallback: try plain `main`
        if (_baseline_exists('main')) {
            args.baseline = 'main';
        } else {
            process.stderr.write(
                `❌  baseline ${args.baseline} (and \`main\`) not found. ` +
                    'Pass --skip-if-no-baseline to silence in local dev.\n',
            );
            return 3;
        }
    }

    let changed: string[];
    try {
        changed = _changed_files(args.baseline, args.head);
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`❌  ${msg}\n`);
        return 3;
    }

    // Scope assertion BEFORE the comparison: if none of the guarded paths exist
    // on disk, this guard cannot fire and must say so loudly rather than
    // reporting a clean floor it never looked at.
    let guarded: string[];
    try {
        guarded = assertWatchlistResolves({
            gate: 'check_safety_floor_untouched',
            candidates: _floor_candidates(),
            repoRoot: REPO_ROOT,
        });
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`❌  ${msg}\n`);
        return 3;
    }

    const breaches = _breaches(changed);

    if (breaches.length) {
        process.stderr.write(
            '❌  Safety-floor rule(s) modified — Phase 2A is not allowed to ' +
                'touch these (Q3=A locked decision):\n',
        );
        for (const p of breaches) {
            process.stderr.write(`    ${p}\n`);
        }
        process.stderr.write(
            '\n    Lift via the two-gate rollback documented in ' +
                'agents/roadmaps/road-to-structural-optimization.md ' +
                '§ Phase 2A Abort/rollback.\n',
        );
        return 1;
    }

    // Report the RESOLVED count, not the declared one — the old message printed
    // `SAFETY_FLOOR.length` unconditionally, so it claimed 4 guarded rules while
    // guarding zero.
    process.stdout.write(
        `✅  Safety-floor untouched (${guarded.length} rule file(s) guarded ` +
            `vs. ${args.baseline}).\n`,
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

export {
    REPO_ROOT,
    RULES_DIR_REL,
    RULES_DIRS_REL,
    SAFETY_FLOOR,
    _baseline_exists,
    _breaches,
    _changed_files,
    _floor_candidates,
    main,
};

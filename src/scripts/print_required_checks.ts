#!/usr/bin/env tsx
/**
 * Print the expected required-check set for the current branch.
 *
 * TypeScript twin of `src/scripts/print_required_checks.py` (ADR-094,
 * Phase 8 / Wave 8g). Mirrors the Python CLI contract EXACTLY — `--branch`
 * / `--base` flags, PR-shape classification (release / docs-only / feature),
 * exit codes (0 ok, 1 release-shape OUT-OF-SHAPE fallback-to-feature, 2 usage),
 * stdout/stderr split, byte-identical messages. Reuses the release-shape
 * allowlist via `check_release_pr_shape._matches`. No behaviour changes.
 *
 * Contract: `docs/contracts/branch-protection-policy.md`. Per-PR-shape
 * required-check floor — feature PR vs release PR vs docs-only PR. The
 * script resolves the PR shape locally so the maintainer can sanity-check
 * before pushing, without round-tripping through the GitHub UI.
 *
 * Resolution order:
 *
 *   1. `--branch <name>` flag — explicit override.
 *   2. Current git branch — `git rev-parse --abbrev-ref HEAD`.
 *   3. Fail with exit 2 (usage error).
 *
 * PR-shape classification:
 *
 *   release   — branch matches `^release/\d+\.\d+\.\d+$` AND
 *               `check_release_pr_shape._matches` clears the local diff
 *               against `--base` (default `origin/main`).
 *   docs-only — diff vs base is entirely inside `docs/**` or top-level
 *               `.md` files (`README.md`, `CHANGELOG.md`,
 *               `CONTRIBUTING.md`, `AGENTS.md`).
 *   feature   — everything else (default).
 *
 * The script never invokes `gh` and never touches the network — it works
 * offline against the local git index so pre-push previews stay fast.
 *
 * Exit codes:
 *
 *   0 — printed the expected required-check set.
 *   1 — release-PR shape detector reported OUT-OF-SHAPE; falls back to
 *       the feature-PR set, which is also printed, plus a warning.
 *   2 — usage / environment error.
 */

import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { _matches } from './check_release_pr_shape.js';

const _HERE = fileURLToPath(import.meta.url);

const RELEASE_BRANCH_RE = /^release\/\d+\.\d+\.\d+$/;

const DOCS_ONLY_ALLOWED_TOP: ReadonlySet<string> = new Set([
    'README.md',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'AGENTS.md',
    'LICENSE',
    'llms.txt',
]);

const FEATURE_CHECKS = [
    'Consistency',
    'Smoke Contracts',
    'Skill Lint',
    'Tests / install-tests',
    'Tests / install-aux-tests',
    'Tests / python-tests',
    'Tests / node-tests',
    'Public Install Smoke / smoke',
] as const;

const RELEASE_CHECKS = [
    'Consistency',
    'Smoke Contracts',
    'Migration Dry-Run',
    'Release Validation / release-shape',
    'Release Validation / changelog-entry',
    'Release Validation / version-consistency',
    'Release Guard (post-tag)',
] as const;

const DOCS_ONLY_CHECKS = ['Consistency', 'Smoke Contracts'] as const;

/** `git rev-parse --abbrev-ref HEAD`, mirroring `_git(check=True)`. */
function current_branch(): string {
    const out = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        encoding: 'utf8',
    });
    if (out.status !== 0) {
        // Mirror subprocess.run(check=True) raising CalledProcessError; the
        // Python script lets it propagate (uncaught → traceback, exit != 0).
        throw new Error(`git rev-parse --abbrev-ref HEAD failed`);
    }
    return (out.stdout ?? '').trim();
}

/**
 * Files changed vs `base`. Mirrors `diff_files`: try `base...HEAD`, fall
 * back to `HEAD` when the base ref is unknown locally.
 */
function diff_files(base: string): string[] {
    let out = spawnSync('git', ['diff', '--name-only', `${base}...HEAD`], {
        encoding: 'utf8',
    });
    if (out.status !== 0) {
        out = spawnSync('git', ['diff', '--name-only', 'HEAD'], {
            encoding: 'utf8',
        });
    }
    return (out.stdout ?? '').split('\n').filter((line) => line.trim() !== '');
}

function is_docs_only(files: string[]): boolean {
    if (files.length === 0) {
        return false;
    }
    for (const f of files) {
        if (DOCS_ONLY_ALLOWED_TOP.has(f)) {
            continue;
        }
        if (f.startsWith('docs/')) {
            continue;
        }
        return false;
    }
    return true;
}

type Shape = 'feature' | 'release' | 'docs-only';

/** Return [shape, exit_code]. Mirror of `classify`. */
function classify(branch: string, files: string[]): [Shape, number] {
    if (RELEASE_BRANCH_RE.test(branch)) {
        const bad = files.filter((f) => !_matches(f));
        if (bad.length > 0) {
            process.stderr.write(
                `WARNING: branch matches release/X.Y.Z but diff contains ` +
                    `${bad.length} out-of-allowlist file(s):\n`,
            );
            for (const f of bad) {
                process.stderr.write(`  - ${f}\n`);
            }
            process.stderr.write('Falling back to feature-PR required-check set.\n');
            return ['feature', 1];
        }
        return ['release', 0];
    }
    if (is_docs_only(files)) {
        return ['docs-only', 0];
    }
    return ['feature', 0];
}

function print_set(shape_label: Shape, files: string[]): void {
    const table: Record<Shape, readonly string[]> = {
        feature: FEATURE_CHECKS,
        release: RELEASE_CHECKS,
        'docs-only': DOCS_ONLY_CHECKS,
    };
    const checks = table[shape_label];
    process.stdout.write(`PR shape: ${shape_label}  (${files.length} file(s) in diff)\n`);
    process.stdout.write(`Required checks (${checks.length}):\n`);
    for (const name of checks) {
        process.stdout.write(`  - ${name}\n`);
    }
    process.stdout.write('\n');
    process.stdout.write(
        'Contract: docs/contracts/branch-protection-policy.md ' +
            '(per-PR-shape matrix)\n',
    );
}

interface ParsedArgs {
    branch: string | null;
    base: string;
}

function _argparse_error(message: string): never {
    process.stderr.write(`usage: print_required_checks.py [-h] [--branch BRANCH] [--base BASE]\n`);
    process.stderr.write(`print_required_checks.py: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let branch: string | null = null;
    let base = 'origin/main';
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--branch') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --branch: expected one argument');
            }
            branch = v;
        } else if (arg.startsWith('--branch=')) {
            branch = arg.slice('--branch='.length);
        } else if (arg === '--base') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --base: expected one argument');
            }
            base = v;
        } else if (arg.startsWith('--base=')) {
            base = arg.slice('--base='.length);
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: print_required_checks.py [-h] [--branch BRANCH] [--base BASE]\n',
            );
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { branch, base };
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const branch = args.branch || current_branch();
    const files = diff_files(args.base);
    const [shape_label, exit_code] = classify(branch, files);
    process.stdout.write(`Branch: ${branch}\n`);
    process.stdout.write(`Base:   ${args.base}\n`);
    print_set(shape_label, files);
    return exit_code;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}

export {
    RELEASE_BRANCH_RE,
    DOCS_ONLY_ALLOWED_TOP,
    FEATURE_CHECKS,
    RELEASE_CHECKS,
    DOCS_ONLY_CHECKS,
    current_branch,
    diff_files,
    is_docs_only,
    classify,
    print_set,
    main,
};

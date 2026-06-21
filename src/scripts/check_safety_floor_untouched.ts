#!/usr/bin/env tsx
/**
 * Safety-floor exclusion linter (Phase 2A.0 of road-to-structural-optimization).
 *
 * TypeScript twin of `src/scripts/check_safety_floor_untouched.py` (ADR-200,
 * Phase 4 / Wave 4c). The CLI contract is mirrored EXACTLY — `--baseline`
 * / `--skip-if-no-baseline` flags, exit codes (0 clean/skipped, 1 floor
 * file modified, 3 internal error), stdout/stderr split, byte-identical
 * messages, the same git plumbing and the same `origin/main` → `main`
 * fallback. No behaviour changes — latent bugs replicated.
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
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const RULES_DIR_REL = '.agent-src.uncondensed/rules';
const SAFETY_FLOOR = [
    'non-destructive-by-default.md',
    'commit-policy.md',
    'scope-control.md',
    'verify-before-complete.md',
] as const;

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

function _changed_files(baseline: string): string[] {
    const [code, output] = _run_git(['diff', '--name-only', `${baseline}...HEAD`]);
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
    skip_if_no_baseline: boolean;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    const args: ParsedArgs = { baseline: 'origin/main', skip_if_no_baseline: false };
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
        } else if (arg === '--skip-if-no-baseline') {
            args.skip_if_no_baseline = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: check_safety_floor_untouched [-h] [--baseline BASELINE] [--skip-if-no-baseline]\n',
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
        changed = _changed_files(args.baseline);
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`❌  ${msg}\n`);
        return 3;
    }

    const floorPaths = new Set(SAFETY_FLOOR.map((name) => `${RULES_DIR_REL}/${name}`));
    const breaches = changed.filter((p) => floorPaths.has(p)).sort();

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

    process.stdout.write(
        `✅  Safety-floor untouched (${SAFETY_FLOOR.length} rules guarded ` +
            `vs. ${args.baseline}).\n`,
    );
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { REPO_ROOT, RULES_DIR_REL, SAFETY_FLOOR, _baseline_exists, _changed_files, main };

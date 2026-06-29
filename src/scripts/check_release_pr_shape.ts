#!/usr/bin/env tsx
/**
 * Release-PR shape checker — fail-closed gate for
 * `docs/contracts/release-pr-gating.md`.
 *
 * TypeScript twin of `src/scripts/check_release_pr_shape.py` (ADR-200,
 * Phase 4 / Wave 4c). Mirrors the Python CLI contract EXACTLY — mutually
 * exclusive `--pr` / `--files` (one required), `--files` accepts a
 * comma-separated list or `-` (stdin, one per line), exit codes
 * (0 shape-clean, 1 out-of-shape/empty, 2 usage/env), stdout, fnmatch
 * allowlist + ordering, byte-identical finding messages. No behaviour
 * changes.
 *
 * Given a PR number, fetches the file list via `gh pr diff <n> --name-only`
 * and asserts every changed file matches the version-bump allowlist.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

const ALLOWLIST_GLOBS = [
    'package.json',
    'CHANGELOG.md',
    '.claude-plugin/marketplace.json',
    'src/packs/*/pack.yaml',
    'src/packs/*/README.md',
    'src/domains/*/pack.yaml',
    'src/domains/*/README.md',
    'docs/archive/CHANGELOG-pre-*.md',
    // Project-settings template pin — bumped by release.ts set_template_pin and
    // its regenerated dist twin (kept in lockstep with package.json.version).
    'src/agent-src/templates/agents/agent-project-settings.example.yml',
    'dist/agent-src/templates/agents/agent-project-settings.example.yml',
] as const;

/**
 * Translate a Python `fnmatch` shell pattern to a RegExp, mirroring
 * `fnmatch.translate`. fnmatch is case-sensitive on POSIX (fnmatchcase
 * semantics on the normalized path); `*` and `?` do NOT cross path
 * separators is NOT a property of fnmatch — `*` matches everything
 * including `/`. The allowlist relies on that (e.g. nested-file rejection
 * in the test works because none of the globs end with the file).
 */
function _fnmatchToRegExp(pat: string): RegExp {
    // Mirror Python fnmatch.translate: `*` → `.*`, `?` → `.`, `[seq]` kept,
    // everything else escaped. The full pattern is anchored with `(?s:...)\Z`.
    let i = 0;
    const n = pat.length;
    let res = '';
    while (i < n) {
        const c = pat[i]!;
        i += 1;
        if (c === '*') {
            res += '.*';
        } else if (c === '?') {
            res += '.';
        } else if (c === '[') {
            let j = i;
            if (j < n && pat[j] === '!') {
                j += 1;
            }
            if (j < n && pat[j] === ']') {
                j += 1;
            }
            while (j < n && pat[j] !== ']') {
                j += 1;
            }
            if (j >= n) {
                res += '\\[';
            } else {
                let stuff = pat.slice(i, j);
                if (!stuff.includes('-')) {
                    stuff = stuff.replace(/\\/g, '\\\\');
                } else {
                    // Rare; not used by the allowlist. Keep simple escape.
                    stuff = stuff.replace(/\\/g, '\\\\');
                }
                i = j + 1;
                if (stuff.startsWith('!')) {
                    stuff = '^' + stuff.slice(1);
                } else if (stuff.startsWith('^') || stuff.startsWith('[')) {
                    stuff = '\\' + stuff;
                }
                res += '[' + stuff + ']';
            }
        } else {
            res += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
    }
    // Python uses `(?s:%s)\Z` — dotAll + full match.
    return new RegExp(`^(?:${res})$`, 's');
}

const _COMPILED_GLOBS: RegExp[] = ALLOWLIST_GLOBS.map(_fnmatchToRegExp);

function _matches(p: string): boolean {
    return _COMPILED_GLOBS.some((re) => re.test(p));
}

function _gh_diff_files(pr: string): string[] {
    const which = spawnSync('sh', ['-c', 'command -v gh'], { encoding: 'utf-8' });
    if (which.status !== 0 || !which.stdout || which.stdout.trim() === '') {
        process.stderr.write('ERROR: gh CLI not on PATH; cannot fetch PR diff.\n');
        process.exit(2);
    }
    const res = spawnSync('gh', ['pr', 'diff', pr, '--name-only'], { encoding: 'utf-8' });
    if (res.status !== 0) {
        const stderr = (res.stderr ?? '').trim();
        process.stderr.write(`ERROR: gh pr diff ${pr} failed: ${stderr}\n`);
        process.exit(2);
    }
    return (res.stdout ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '');
}

function check(files: readonly string[]): number {
    if (files.length === 0) {
        process.stdout.write(
            'OUT-OF-SHAPE: empty diff — release PR must touch at least one file.\n',
        );
        return 1;
    }
    const bad = files.filter((f) => !_matches(f));
    if (bad.length > 0) {
        for (const f of bad) {
            process.stdout.write(`OUT-OF-SHAPE: ${f}\n`);
        }
        return 1;
    }
    process.stdout.write(
        `SHAPE-CLEAN: ${files.length} file(s) — all within release-PR allowlist.\n`,
    );
    for (const f of files) {
        process.stdout.write(`  ok: ${f}\n`);
    }
    return 0;
}

function _read_files_arg(value: string): string[] {
    if (value === '-') {
        let data = '';
        try {
            data = fs.readFileSync(0, 'utf-8');
        } catch {
            data = '';
        }
        return data
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line !== '');
    }
    return value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v !== '');
}

interface ParsedArgs {
    pr: string | null;
    files: string | null;
}

function _argparse_error(message: string): never {
    process.stderr.write(`check_release_pr_shape: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let pr: string | null = null;
    let files: string | null = null;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--pr') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --pr: expected one argument');
            }
            pr = v;
        } else if (arg.startsWith('--pr=')) {
            pr = arg.slice('--pr='.length);
        } else if (arg === '--files') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --files: expected one argument');
            }
            files = v;
        } else if (arg.startsWith('--files=')) {
            files = arg.slice('--files='.length);
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: check_release_pr_shape [-h] (--pr PR | --files FILES)\n',
            );
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    if (pr !== null && files !== null) {
        _argparse_error('argument --files: not allowed with argument --pr');
    }
    if (pr === null && files === null) {
        _argparse_error('one of the arguments --pr --files is required');
    }
    return { pr, files };
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const files = args.pr !== null ? _gh_diff_files(args.pr) : _read_files_arg(args.files!);
    return check(files);
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { ALLOWLIST_GLOBS, _matches, check, _read_files_arg, main };

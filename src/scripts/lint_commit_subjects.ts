#!/usr/bin/env tsx
/**
 * Commit-subject linter.
 *
 * TypeScript twin of `src/scripts/lint_commit_subjects.py` (ADR-200,
 * Phase 4 / Wave 4b). The CLI contract is mirrored EXACTLY — `--base`
 * / `--head` / `--quiet` flags, exit codes (0 clean / advisory, 1
 * violations), stdout/stderr split, byte-identical finding messages
 * (the issue strings are grepped by tests), and the same git invocation
 * (`git log <base>..<head> --format=%s --no-merges`).
 *
 * `scripts/release.py` reads commit subjects verbatim from
 * `<prev-tag>..HEAD` into `CHANGELOG.md`. A sloppy subject becomes a
 * sloppy public changelog line. This lint is the CI-enforced gate.
 *
 * Rules (range `<base>..<head>`):
 *   - Subject body after the Conventional-Commits prefix must be ≥ 10 chars.
 *   - Subject must not contain blocklist words as whole tokens.
 *
 * Carve-outs: merge commits and revert commits are skipped.
 *
 * No behaviour changes — Python `repr()` of strings + lists is replicated
 * byte-for-byte in the finding messages.
 */

import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

const BLOCKLIST: ReadonlySet<string> = new Set([
    'leftover',
    'leftovers',
    'wip',
    'temp',
    'tmp',
    'fixup',
]);
const MIN_SUBJECT_LEN = 10;

// Conventional Commits prefix — `type(scope)!?: message`.
const CONVENTIONAL_PREFIX =
    /^(feat|fix|chore|docs|refactor|test|perf|style|build|ci|revert)(\([^)]+\))?!?:\s+/i;

// Skip lines — GitHub-generated merge subjects and revert commits.
const SKIP_PREFIXES = [
    'Merge pull request',
    'Merge branch',
    'Merge remote-tracking',
    'Revert "',
] as const;

/** Mirror Python `repr()` for a single string. */
function _pyReprStr(s: string): string {
    // Python prefers single quotes unless the string contains a single
    // quote but no double quote, in which case it uses double quotes.
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
        const code = ch.codePointAt(0)!;
        if (ch === '\\') {
            out += '\\\\';
        } else if (ch === quote) {
            out += '\\' + quote;
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (code < 0x20 || code === 0x7f) {
            out += '\\x' + code.toString(16).padStart(2, '0');
        } else {
            out += ch;
        }
    }
    out += quote;
    return out;
}

/** Mirror Python `repr()` for a list of strings (e.g. `['wip', 'tmp']`). */
function _pyReprStrList(items: readonly string[]): string {
    return '[' + items.map(_pyReprStr).join(', ') + ']';
}

function fetch_subjects(base: string, head: string): string[] {
    const result = spawnSync(
        'git',
        ['log', `${base}..${head}`, '--format=%s', '--no-merges'],
        { encoding: 'utf-8' },
    );
    if (result.status !== 0 || result.error) {
        // CI without a proper base ref (force-push, first commit, weird state).
        // Lint is advisory in that case — never block on git plumbing failures.
        const stderr = (result.stderr ?? '').trim();
        process.stderr.write(`⚠️  git log ${base}..${head} failed: ${stderr}\n`);
        return [];
    }
    const stdout = result.stdout ?? '';
    return stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

function check_subject(subject: string): string[] {
    if (SKIP_PREFIXES.some((p) => subject.startsWith(p))) {
        return [];
    }
    const issues: string[] = [];
    const body = subject.replace(CONVENTIONAL_PREFIX, '');
    if (body.length < MIN_SUBJECT_LEN) {
        issues.push(
            `subject body < ${MIN_SUBJECT_LEN} chars after Conventional-Commits ` +
                `prefix: ${_pyReprStr(subject)}`,
        );
    }
    const tokens = new Set<string>();
    const matches = body.match(/[A-Za-z]+/g) ?? [];
    for (const t of matches) {
        tokens.add(t.toLowerCase());
    }
    const hits = [...tokens].filter((t) => BLOCKLIST.has(t)).sort();
    if (hits.length > 0) {
        issues.push(
            `blocklist token(s) ${_pyReprStrList(hits)} in subject: ${_pyReprStr(subject)}`,
        );
    }
    return issues;
}

interface ParsedArgs {
    base: string;
    head: string;
    quiet: boolean;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let base = 'origin/main';
    let head = 'HEAD';
    let quiet = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--base') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --base: expected one argument');
            }
            base = v;
        } else if (arg.startsWith('--base=')) {
            base = arg.slice('--base='.length);
        } else if (arg === '--head') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --head: expected one argument');
            }
            head = v;
        } else if (arg.startsWith('--head=')) {
            head = arg.slice('--head='.length);
        } else if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: lint_commit_subjects [-h] [--base BASE] [--head HEAD] [--quiet]\n');
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { base, head, quiet };
}

function _argparse_error(message: string): never {
    process.stderr.write(`lint_commit_subjects: error: ${message}\n`);
    process.exit(2);
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const subjects = fetch_subjects(args.base, args.head);
    if (subjects.length === 0) {
        if (!args.quiet) {
            process.stdout.write(
                `✅  No commit subjects to check in ${args.base}..${args.head}.\n`,
            );
        }
        return 0;
    }

    const failures: Array<[string, string]> = [];
    for (const subj of subjects) {
        for (const issue of check_subject(subj)) {
            failures.push([subj, issue]);
        }
    }

    if (failures.length > 0) {
        process.stderr.write(
            `❌  ${failures.length} commit-subject issue(s) in ${args.base}..${args.head}:\n`,
        );
        for (const [, issue] of failures) {
            process.stderr.write(`   - ${issue}\n`);
        }
        process.stderr.write(
            '\nThese subjects feed the auto-generated CHANGELOG.md via ' +
                'src/scripts/release.py — sloppy subjects become sloppy public ' +
                'changelog lines. Per ADR-033 + ' +
                'agents/roadmaps/road-to-distribution-identity.md § Phase 3.\n' +
                'Fix: rewrite the offending commits (e.g. `git rebase -i ' +
                `${args.base}` +
                '` and `r`eword) with descriptive subjects, ' +
                'then re-push.\n',
        );
        return 1;
    }

    if (!args.quiet) {
        process.stdout.write(`✅  ${subjects.length} commit subject(s) clean.\n`);
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    BLOCKLIST,
    MIN_SUBJECT_LEN,
    CONVENTIONAL_PREFIX,
    SKIP_PREFIXES,
    fetch_subjects,
    check_subject,
    main,
    _pyReprStr,
    _pyReprStrList,
};

#!/usr/bin/env tsx
/**
 * Atomic-command linter for the command-collapse policy.
 *
 * TypeScript twin of `src/scripts/lint_no_new_atomic_commands.py`
 * (ADR-094, Phase 4 / Wave 4b). The CLI contract is mirrored EXACTLY —
 * `--baseline` / `--all` flags, exit codes (0 clean, 1 violations,
 * 3 internal error), stdout/stderr split, byte-identical messages, the
 * same git invocations (`git diff --name-only --diff-filter=A
 * <baseline>...HEAD -- <dir>` plus `git status --porcelain`), and the
 * same locked-cluster table parse + frontmatter parse.
 *
 * Only ADDED command files (status A / ?? / AM) are checked; each must
 * declare `cluster:` (a locked name) or `superseded_by:`.
 *
 * No behaviour changes — Python `sorted(set)` is rendered as a list repr.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/lint_no_new_atomic_commands.ts → parent.parent.parent is repo root.
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const COMMANDS_DIR = '.agent-src.uncondensed/commands';
const CLUSTER_CONTRACT = 'docs/contracts/command-clusters.md';

interface Violation {
    file: string;
    reason: string;
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** Mirror Python `repr()` for a single string. */
function _pyReprStr(s: string): string {
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

/** Mirror Python `repr()` for `sorted(clusters)` (a list of strings). */
function _pyReprStrList(items: readonly string[]): string {
    return '[' + items.map(_pyReprStr).join(', ') + ']';
}

function load_locked_clusters(): Set<string> {
    const text = fs.readFileSync(path.join(ROOT, CLUSTER_CONTRACT), 'utf-8');
    let inTable = false;
    const clusters = new Set<string>();
    for (const line of text.split('\n')) {
        if (line.startsWith('## Locked clusters')) {
            inTable = true;
            continue;
        }
        if (inTable && line.startsWith('## ')) {
            break;
        }
        if (inTable) {
            const m = /^\|\s*`([a-z][a-z0-9-]*)`\s*\|/.exec(line);
            if (m) {
                clusters.add(m[1]!);
            }
        }
    }
    if (clusters.size === 0) {
        process.stderr.write(
            `❌  Could not parse locked-clusters table from ${CLUSTER_CONTRACT}\n`,
        );
        process.exit(3);
    }
    return clusters;
}

function added_command_files(baseline: string): string[] {
    const diff = spawnSync(
        'git',
        [
            'diff',
            '--name-only',
            '--diff-filter=A',
            `${baseline}...HEAD`,
            '--',
            COMMANDS_DIR,
        ],
        { cwd: ROOT, encoding: 'utf-8', timeout: 15000 },
    );
    if (diff.error) {
        process.stderr.write(`❌  git diff failed: ${diff.error.message}\n`);
        process.exit(3);
    }
    if (diff.status !== 0) {
        process.stderr.write(
            `❌  git diff exit ${diff.status}: ${diff.stderr ?? ''}\n`,
        );
        process.exit(3);
    }
    const files: string[] = [];
    for (const p of (diff.stdout ?? '').split('\n')) {
        if (p.endsWith('.md') && p !== '' && path.basename(p) !== 'AGENTS.md') {
            files.push(p);
        }
    }
    // Also include untracked (newly added, uncommitted) files.
    const wt = spawnSync(
        'git',
        ['status', '--porcelain', '--', COMMANDS_DIR],
        { cwd: ROOT, encoding: 'utf-8', timeout: 10000 },
    );
    if (!wt.error && wt.status !== null) {
        for (const line of (wt.stdout ?? '').split('\n')) {
            if (line.length < 4) {
                continue;
            }
            const status = line.slice(0, 2);
            if (!['A', '??', 'AM'].includes(status.trim())) {
                continue;
            }
            const rawPath = line.slice(3).trim();
            const parts = rawPath.split(' -> ');
            const p = parts[parts.length - 1]!;
            if (p.endsWith('.md') && path.basename(p) !== 'AGENTS.md') {
                if (!files.includes(p)) {
                    files.push(p);
                }
            }
        }
    }
    return files;
}

/** Recursively list `*.md` files under `dir`, sorted (mirrors sorted(rglob)). */
function _rglobMdSorted(dir: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                out.push(full);
            }
        }
    };
    walk(dir);
    return out.sort();
}

function all_command_files(): string[] {
    return _rglobMdSorted(path.join(ROOT, COMMANDS_DIR)).filter(
        (p) => path.basename(p) !== 'AGENTS.md',
    );
}

function parse_frontmatter(p: string): Record<string, string> {
    const text = fs.readFileSync(p, 'utf-8');
    if (!text.startsWith('---')) {
        return {};
    }
    const end = text.indexOf('\n---', 3);
    if (end === -1) {
        return {};
    }
    const fm: Record<string, string> = {};
    for (const line of text.slice(3, end).split('\n')) {
        if (line.includes(':')) {
            const idx = line.indexOf(':');
            const k = line.slice(0, idx).trim();
            const v = line.slice(idx + 1).trim();
            fm[k] = v;
        }
    }
    return fm;
}

function check_file(p: string, clusters: Set<string>): Violation | null {
    const absPath = path.isAbsolute(p) ? p : path.join(ROOT, p);
    if (!_exists(absPath)) {
        return null; // deleted file, nothing to check
    }
    const fm = parse_frontmatter(absPath);
    if ('superseded_by' in fm) {
        return null; // shim — exempt
    }
    const cluster = fm['cluster'];
    const sortedClusters = _pyReprStrList([...clusters].sort());
    if (!cluster) {
        return {
            file: p,
            reason: 'missing `cluster:` frontmatter ' + `(allowed: ${sortedClusters})`,
        };
    }
    if (!clusters.has(cluster)) {
        return {
            file: p,
            reason:
                `\`cluster: ${cluster}\` is not a locked cluster ` +
                `(allowed: ${sortedClusters})`,
        };
    }
    return null;
}

interface ParsedArgs {
    baseline: string;
    all: boolean;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let baseline = 'main';
    let all = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--baseline') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --baseline: expected one argument');
            }
            baseline = v;
        } else if (arg.startsWith('--baseline=')) {
            baseline = arg.slice('--baseline='.length);
        } else if (arg === '--all') {
            all = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: lint_no_new_atomic_commands [-h] [--baseline BASELINE] [--all]\n');
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { baseline, all };
}

function _argparse_error(message: string): never {
    process.stderr.write(`lint_no_new_atomic_commands: error: ${message}\n`);
    process.exit(2);
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const clusters = load_locked_clusters();
    const targets = args.all ? all_command_files() : added_command_files(args.baseline);
    if (targets.length === 0) {
        process.stdout.write(
            `✅  No new commands added under ${COMMANDS_DIR} ` +
                `(baseline: ${args.baseline}).\n`,
        );
        return 0;
    }

    const violations: Violation[] = [];
    for (const p of targets) {
        const v = check_file(p, clusters);
        if (v !== null) {
            violations.push(v);
        }
    }
    if (violations.length > 0) {
        process.stdout.write(
            `❌  ${violations.length} newly-added atomic command(s) violate ` +
                'the command-cluster policy:\n',
        );
        for (const v of violations) {
            process.stdout.write(`  • ${v.file} — ${v.reason}\n`);
        }
        process.stdout.write(
            '\nSee docs/contracts/command-clusters.md for the locked ' +
                'cluster names and frontmatter contract.\n',
        );
        return 1;
    }
    process.stdout.write(
        `✅  ${targets.length} newly-added command(s) all declare a valid ` +
            '`cluster:` (or `superseded_by:`).\n',
    );
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    type Violation,
    ROOT,
    COMMANDS_DIR,
    CLUSTER_CONTRACT,
    load_locked_clusters,
    added_command_files,
    all_command_files,
    parse_frontmatter,
    check_file,
    main,
};

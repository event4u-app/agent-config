#!/usr/bin/env tsx
/**
 * CI secret-leak gate — the non-bypassable second layer behind the
 * `secret-vcs-guard` behavioral rule.
 *
 * Runs the shared `secret_detector` library (regex rule pack + Shannon entropy +
 * keyword context) over the repository's tracked working tree (or a supplied
 * path set), and FAILS (exit 1) on any `high`-confidence finding that is not
 * suppressed. This is the deterministic enforcing net: a PR cannot merge red,
 * unlike a client-side commit hook (which fires only on agent-initiated bash and
 * is `--no-verify`/GUI/fresh-clone bypassable) — see
 * `src/rules/secret-vcs-guard.md` and `skill:secrets-management` for the
 * layering rationale.
 *
 * Suppression (audited, narrow — never a global mute):
 *   - inline `# secret-allow` / `// secret-allow` / `<!-- secret-allow -->` on a
 *     line (handled inside `secret_detector`);
 *   - a repo-root `.secret-allow` file: one entry per line, `path` or
 *     `path:line`, `#` comments allowed. Each entry SHOULD carry a one-line
 *     justification comment so it is reviewable in the diff.
 *
 * Default excludes (fixtures/tests/examples legitimately hold fake secrets;
 * generated + vendored trees are not source): node_modules, dist, dist-*,
 * .git, .claude, **\/fixtures\/**, *.test.*, *.spec.*, *.example, *.sample,
 * .env.example, lockfiles, *.min.*.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_secret_leak [paths...] [--all] [--base <ref>] [--json]
 *   default → files changed vs origin/main + untracked (shift-left); --all →
 *   whole tracked tree; paths → exactly those (excludes skipped).
 *
 * Exit codes: 0 clean · 1 high-confidence leak found · 2 usage/env error.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { scanText, type SecretFinding } from './_lib/secret_detector.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
// repo root: src/scripts/check_secret_leak.ts → parents[2].
export const REPO_ROOT = path.resolve(_HERE, '..', '..');

const DEFAULT_EXCLUDE: readonly RegExp[] = [
    /(^|\/)node_modules(\/|$)/,
    /(^|\/)dist(\/|$)/,
    /(^|\/)dist-[^/]+(\/|$)/,
    /(^|\/)\.git(\/|$)/,
    /(^|\/)\.claude(\/|$)/,
    /(^|\/)fixtures(\/|$)/,
    /(^|\/)tests(\/|$)/, // test + golden + parity data legitimately holds secret-shaped strings
    /(^|\/)__[a-z_]+__(\/|$)/, // snapshot dirs (e.g. __parity_snapshots__)
    /\.test\.[a-z]+$/,
    /\.spec\.[a-z]+$/,
    /\.example$/,
    /\.sample$/,
    /(^|\/)\.env\.example$/,
    /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|composer\.lock)$/,
    /\.min\.[a-z]+$/,
];

export interface LeakHit extends SecretFinding {
    file: string;
}

interface AllowEntry {
    file: string;
    line: number | null; // null = whole-file allow
}

/** Parse `.secret-allow` (repo-root) into path[:line] entries. */
export function readAllowFile(root: string): AllowEntry[] {
    const p = path.join(root, '.secret-allow');
    if (!fs.existsSync(p)) {
        return [];
    }
    const out: AllowEntry[] = [];
    for (const raw of fs.readFileSync(p, 'utf-8').split(/\r?\n/)) {
        const line = raw.replace(/#.*$/, '').trim();
        if (line === '') {
            continue;
        }
        const m = /^(.*?)(?::(\d+))?$/.exec(line);
        if (m) {
            out.push({ file: m[1] as string, line: m[2] ? parseInt(m[2], 10) : null });
        }
    }
    return out;
}

function isAllowed(rel: string, lineno: number, allow: readonly AllowEntry[]): boolean {
    return allow.some((a) => a.file === rel && (a.line === null || a.line === lineno));
}

function isExcluded(rel: string): boolean {
    return DEFAULT_EXCLUDE.some((rx) => rx.test(rel));
}

/** Fast binary sniff — a NUL byte in the first 8 KiB means "not text". */
function isBinary(abs: string): boolean {
    try {
        const fd = fs.openSync(abs, 'r');
        const buf = Buffer.alloc(8192);
        const n = fs.readSync(fd, buf, 0, 8192, 0);
        fs.closeSync(fd);
        return buf.subarray(0, n).includes(0);
    } catch {
        return true; // unreadable → skip
    }
}

function gitLines(root: string, args: readonly string[]): string[] {
    const res = spawnSync('git', args as string[], { cwd: root, encoding: 'utf-8' });
    if (res.status !== 0) {
        return [];
    }
    return res.stdout.split('\n').filter((l) => l.trim() !== '');
}

export type Mode = 'diff' | 'all' | 'explicit';

/**
 * Resolve the file set.
 *   explicit → the named paths (intent — excludes skipped by the caller).
 *   all      → every tracked file (`git ls-files`).
 *   diff     → files this branch adds or changes vs `base` PLUS untracked files —
 *              the shift-left surface: scan what the change introduces, never the
 *              pre-existing corpus (which floods a mature repo with matches).
 */
export function resolveFiles(
    root: string,
    mode: Mode,
    opts: { explicit?: readonly string[] | undefined; base?: string | undefined } = {},
): string[] {
    if (mode === 'explicit') {
        return (opts.explicit ?? []).map((p) =>
            path.isAbsolute(p) ? path.relative(root, p) : p,
        );
    }
    if (mode === 'all') {
        return gitLines(root, ['ls-files']);
    }
    const base = opts.base ?? 'origin/main';
    const changed = gitLines(root, ['diff', '--name-only', '--diff-filter=ACMR', base]);
    const untracked = gitLines(root, ['ls-files', '--others', '--exclude-standard']);
    return Array.from(new Set([...changed, ...untracked]));
}

export function scanRepo(
    root: string,
    mode: Mode = 'diff',
    opts: { explicit?: readonly string[] | undefined; base?: string | undefined } = {},
): LeakHit[] {
    const allow = readAllowFile(root);
    // Explicit paths express intent — the fixture/test/example excludes (which
    // exist so an auto-discovered scan ignores intentional fake secrets) are
    // skipped only when the caller names paths directly.
    const applyExcludes = mode !== 'explicit';
    const hits: LeakHit[] = [];
    for (const rel of resolveFiles(root, mode, opts)) {
        if (applyExcludes && isExcluded(rel)) {
            continue;
        }
        const abs = path.join(root, rel);
        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile() || isBinary(abs)) {
            continue;
        }
        let text: string;
        try {
            text = fs.readFileSync(abs, 'utf-8');
        } catch {
            continue;
        }
        for (const f of scanText(text, { path: rel })) {
            if (f.confidence !== 'high') {
                continue;
            }
            if (isAllowed(rel, f.line, allow)) {
                continue;
            }
            hits.push({ ...f, file: rel });
        }
    }
    return hits;
}

interface Args {
    json: boolean;
    all: boolean;
    base: string | undefined;
    paths: string[];
}

function parseArgs(argv: readonly string[]): Args {
    const paths: string[] = [];
    let json = false;
    let all = false;
    let base: string | undefined;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--json') {
            json = true;
        } else if (a === '--all') {
            all = true;
        } else if (a === '--base') {
            base = argv[++i];
        } else if (a === '-h' || a === '--help') {
            _stdout(
                'usage: check_secret_leak [paths...] [--all] [--base <ref>] [--json]\n' +
                    '  default → scans files changed vs origin/main + untracked (shift-left).\n' +
                    '  --all   → scans the whole tracked tree.\n' +
                    '  paths   → scans exactly those paths (excludes skipped).\n' +
                    '  Exit 1 on a high-confidence leak.\n',
            );
            process.exit(0);
        } else if (a.startsWith('--')) {
            _stderr(`check_secret_leak: unknown flag ${a}\n`);
            process.exit(2);
        } else {
            paths.push(a);
        }
    }
    return { json, all, base, paths };
}

function _stdout(s: string): void {
    process.stdout.write(s);
}
function _stderr(s: string): void {
    process.stderr.write(s);
}

export function main(argv?: readonly string[]): number {
    const args = parseArgs(argv ?? process.argv.slice(2));
    const mode: Mode = args.paths.length > 0 ? 'explicit' : args.all ? 'all' : 'diff';
    const hits = scanRepo(REPO_ROOT, mode, { explicit: args.paths, base: args.base });

    if (args.json) {
        _stdout(JSON.stringify({ check: 'secret-leak', count: hits.length, hits }, null, 2) + '\n');
    } else if (hits.length === 0) {
        _stdout('✅  check_secret_leak: no high-confidence secret found in the tracked tree.\n');
    } else {
        _stderr(`❌  check_secret_leak: ${hits.length} high-confidence secret finding(s):\n`);
        for (const h of hits) {
            _stderr(`   ${h.file}:${h.line}  ${h.kind}  (${h.masked})\n`);
        }
        _stderr(
            '\nRotate any real credential NOW (a commit does not un-leak it), move it to a\n' +
                'secret store (see skill:secrets-management), or add an audited entry to\n' +
                '.secret-allow / an inline `# secret-allow` marker if this is a false positive.\n',
        );
    }
    return hits.length === 0 ? 0 : 1;
}

// Main-guard (realpath-compared, mirrors the repo convention).
if (process.argv[1] !== undefined) {
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
        if (here === argv1) {
            process.exit(main());
        }
    } catch {
        const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
        if (import.meta.url === argvUrl) {
            process.exit(main());
        }
    }
}

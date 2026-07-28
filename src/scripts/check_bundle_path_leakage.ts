#!/usr/bin/env tsx
/**
 * Guard against build-machine path leakage in the tracked install bundle.
 *
 * road-to-feedback-9.2.0-followups Phase 4.1. Three 9.1 commits
 * (f8752443b, 5933bf1a9, f30adb5a1) each rebuilt `dist/install/install.mjs`
 * solely to strip a leaked build-environment path esbuild had baked into its
 * per-module `// <path>` boundary comments: a worktree-relative `../../../
 * node_modules/...` hop, a repo-relative `../agent-config/node_modules/...`
 * hop, and a full `/Users/<name>/.../node_modules/...` absolute path. Each
 * fix was a manual rebuild-and-diff after the fact; this guard makes the
 * class fail the build instead, so a future leak cannot merge silently.
 *
 * Every pattern below is scoped to avoid flagging legitimate bundle content:
 * the bundle's own emitted runtime strings use relative forms only (e.g.
 * `"./node_modules/@event4u/agent-config/plugin/agent-config"`, a real
 * consumer-facing plugin-manifest path), and esbuild's per-module registry
 * keys are bare `node_modules/<pkg>/...` (no leading `/` or `../`) — neither
 * shape trips any pattern here.
 *
 *   - `macos-linux-home`             — absolute `/Users/<name>/…` or
 *     `/home/<name>/…`, i.e. a real machine's home directory. Requires at
 *     least one path segment after the username so a bare `/Users/` or
 *     `/home/` mention (unlikely, but not impossible in prose) does not
 *     match on its own.
 *   - `private-or-opt-root`          — an absolute `/private/…` (macOS's
 *     `/var` → `/private/var` realpath) or `/opt/…` (common CI-runner tool
 *     root, e.g. GitHub Actions' hostedtoolcache) path.
 *   - `windows-drive`                — an absolute Windows path (`C:\…`).
 *   - `worktree-path`                — a `.claude/worktrees/…` path. This
 *     package's own git-worktree convention (`worktree-lifecycle` skill) —
 *     it can never legitimately appear in a shipped consumer artifact.
 *   - `parent-relative-node-modules`  — any `../`-escaping path that reaches
 *     a `node_modules/` directory, however many hops or intermediate
 *     segments (`../../../node_modules/…`, `../agent-config/node_modules/…`).
 *     A legitimate bundled module reference never needs to climb out of the
 *     repo root via string literals — node's own resolution algorithm
 *     handles that internally, not via baked-in `../` path text.
 *   - `absolute-node-modules`         — any OTHER absolute path (not already
 *     caught by the three rules above) reaching a `node_modules/` directory.
 *     The negative lookbehind excludes `./node_modules/…` and mid-identifier
 *     slashes so a legitimate relative reference is never flagged.
 *   - `absolute-sourcemap`           — a `sourceMappingURL=` comment pointing
 *     at an absolute path instead of a bundle-relative filename (the shape
 *     `.map` files should always use — see `dist/install/*.js.map`, whose
 *     `sources` field is repo-relative, e.g. `../../src/install/atomic.ts`).
 *
 * Usage:
 *     tsx src/scripts/check_bundle_path_leakage.ts
 *     tsx src/scripts/check_bundle_path_leakage.ts --quiet
 *     tsx src/scripts/check_bundle_path_leakage.ts <file> [<file> ...]
 *
 * Exit codes: 0 = clean, 1 = leak found, 2 = usage error.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');

// Tracked directories that may hold a build-generated bundle. Only
// `dist/install/` is force-included in `.gitignore` today (`!/dist/install/`);
// `dist/hooks/` and `dist/mcp/` are listed defensively in case a future
// change tracks them too — `git ls-files` on an untracked directory returns
// nothing, so listing an as-yet-untracked root here is always safe.
const BUNDLE_ROOTS: readonly string[] = ['dist/install', 'dist/hooks', 'dist/mcp'];

interface LeakPattern {
    readonly name: string;
    readonly re: RegExp;
    readonly hint: string;
}

// Every regex carries the `g` flag (all hits scanned, not just the first)
// and excludes `\s'"` )` from its "rest of the path" class so a match never
// swallows past the end of a quoted string / comment / parenthesized call.
const LEAK_PATTERNS: readonly LeakPattern[] = [
    {
        name: 'macos-linux-home',
        re: /\/(?:Users|home)\/[^/\s'"`)]+\/[^\s'"`)]*/g,
        hint: 'rebuild from a clean, non-worktree checkout after a fresh `npm ci`',
    },
    {
        name: 'private-or-opt-root',
        re: /(?:^|[^\w.])\/(?:private|opt)\/[^\s'"`)]*/g,
        hint: 'rebuild in a plain (non-macOS-symlinked, non-CI-tool-cache) tree',
    },
    {
        name: 'windows-drive',
        re: /\b[A-Za-z]:\\[^\s'"`)]*/g,
        hint: 'rebuild on a POSIX runner — the published bundle must not carry a Windows path',
    },
    {
        name: 'worktree-path',
        re: /\.claude\/worktrees\/[^\s'"`)]*/g,
        hint: 'rebuild from the primary checkout, not a `.claude/worktrees/` git worktree',
    },
    {
        name: 'parent-relative-node-modules',
        re: /\.\.\/(?:[^\s'"`)]*\/)*node_modules\//g,
        hint: 'esbuild resolved a dependency outside the repo root (foreign/symlinked node_modules) — rebuild after `npm ci` inside the repo',
    },
    {
        name: 'absolute-node-modules',
        re: /(?<![.\w/])\/(?:[^\s'"`)]*\/)*node_modules\//g,
        hint: 'an absolute path reached a node_modules directory — rebuild from a repo-relative tree',
    },
    {
        name: 'absolute-sourcemap',
        re: /sourceMappingURL=(?:\/|[A-Za-z]:\\)[^\s'"`)]*/g,
        hint: 'the sourcemap comment must reference a bundle-relative filename, not an absolute path',
    },
];

interface Hit {
    readonly file: string;
    readonly pattern: string;
    readonly line: number;
    readonly snippet: string;
}

const MAX_SNIPPET = 140;
const MAX_HITS_SHOWN_PER_GROUP = 5;

/**
 * Redact the username segment of a `/Users/<name>/…`, `/home/<name>/…`, or
 * `C:\Users\<name>\…` match before it reaches a log line — the machine
 * username is incidental PII, not the point of the finding (the finding is
 * "an absolute path leaked", not "whose machine it was").
 */
function mask_snippet(raw: string): string {
    const masked = raw
        .replace(/(\/(?:Users|home)\/)[^/\s'"`)]+/, '$1<masked>')
        .replace(/(:\\Users\\)[^\\'"`)]+/i, '$1<masked>');
    return masked.length > MAX_SNIPPET ? `${masked.slice(0, MAX_SNIPPET)}…` : masked;
}

/** 1-based line number of a character offset, mirroring the other check_* scripts' style. */
function line_of(text: string, index: number): number {
    let line = 1;
    for (let i = 0; i < index; i += 1) {
        if (text.charCodeAt(i) === 0x0a) line += 1;
    }
    return line;
}

/**
 * Pure scan core: every pattern hit in `content`, tagged with the (already
 * relative) file path the caller supplies. No filesystem or git access —
 * tests drive this directly with synthetic strings.
 */
function scan_content(relPath: string, content: string): Hit[] {
    const hits: Hit[] = [];
    for (const pattern of LEAK_PATTERNS) {
        pattern.re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = pattern.re.exec(content))) {
            hits.push({
                file: relPath,
                pattern: pattern.name,
                line: line_of(content, m.index),
                snippet: mask_snippet(m[0]),
            });
            // Zero-width safety net (none of the patterns above can match
            // empty, but this mirrors the other check_* scripts' loop guard).
            if (pattern.re.lastIndex === m.index) pattern.re.lastIndex += 1;
        }
    }
    return hits;
}

function _git(args: readonly string[]): string {
    const res = spawnSync('git', [...args], {
        cwd: REPO,
        encoding: 'utf-8',
        maxBuffer: 256 * 1024 * 1024,
    });
    return res.stdout ?? '';
}

function _splitlines(text: string): string[] {
    return text.split('\n').filter((l) => l.length > 0);
}

/** Every tracked path under the bundle roots, deduped and sorted. */
function tracked_bundle_files(): string[] {
    const seen = new Set<string>();
    for (const root of BUNDLE_ROOTS) {
        for (const rel of _splitlines(_git(['ls-files', root]))) {
            seen.add(rel);
        }
    }
    return [...seen].sort();
}

/**
 * Scan one file from disk. Binary / non-UTF-8 content is skipped (a bundle
 * artifact is always text; a decode failure means this isn't one).
 */
function scan_file(relPath: string): Hit[] {
    // `--file` args accept both repo-relative (the `git ls-files` default
    // target list) and absolute paths (ad hoc / test use) — never silently
    // resolve an already-absolute path underneath REPO.
    const abs = path.isAbsolute(relPath) ? relPath : path.join(REPO, relPath);
    let text: string;
    try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(abs));
    } catch {
        return [];
    }
    return scan_content(relPath, text);
}

function scan_files(relPaths: readonly string[]): Hit[] {
    const hits: Hit[] = [];
    for (const rel of relPaths) hits.push(...scan_file(rel));
    return hits;
}

function format_report(hits: readonly Hit[]): string {
    const groups = new Map<string, Hit[]>();
    for (const hit of hits) {
        const key = `${hit.file}::${hit.pattern}`;
        const group = groups.get(key);
        if (group) group.push(hit);
        else groups.set(key, [hit]);
    }
    const lines: string[] = [
        '❌  check_bundle_path_leakage: build-machine path leakage in the tracked bundle:',
    ];
    for (const [key, group] of groups) {
        const [file, patternName] = key.split('::') as [string, string];
        const pattern = LEAK_PATTERNS.find((p) => p.name === patternName);
        lines.push(`    ${file} [${patternName}] (${group.length} occurrence(s))`);
        for (const hit of group.slice(0, MAX_HITS_SHOWN_PER_GROUP)) {
            lines.push(`        line ${hit.line}: ${hit.snippet}`);
        }
        if (group.length > MAX_HITS_SHOWN_PER_GROUP) {
            lines.push(`        (+${group.length - MAX_HITS_SHOWN_PER_GROUP} more)`);
        }
        if (pattern) lines.push(`        → ${pattern.hint}`);
    }
    return lines.join('\n');
}

interface Options {
    quiet: boolean;
    files: string[];
}

/** Thrown instead of calling `process.exit` directly, so `main()` stays testable. */
class ExitCode extends Error {
    code: number;
    constructor(code: number) {
        super(`exit ${code}`);
        this.code = code;
    }
}

function parse_args(argv: readonly string[]): Options {
    const opts: Options = { quiet: false, files: [] };
    for (const arg of argv) {
        if (arg === '--quiet') {
            opts.quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: check_bundle_path_leakage.ts [--quiet] [<file> ...]\n',
            );
            throw new ExitCode(0);
        } else if (arg.startsWith('--')) {
            process.stderr.write(
                `❌  check_bundle_path_leakage: unrecognized argument: ${arg}\n`,
            );
            throw new ExitCode(2);
        } else {
            opts.files.push(arg);
        }
    }
    return opts;
}

function main(argv: readonly string[] = process.argv.slice(2)): number {
    const opts = parse_args(argv);
    const targets = opts.files.length > 0 ? opts.files : tracked_bundle_files();
    const hits = scan_files(targets);

    if (hits.length > 0) {
        process.stderr.write(`${format_report(hits)}\n`);
        return 1;
    }

    if (!opts.quiet) {
        process.stdout.write(
            `✅  check_bundle_path_leakage: no build-machine path leakage ` +
                `(${targets.length} tracked bundle file(s) scanned).\n`,
        );
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    try {
        process.exit(main());
    } catch (exc) {
        if (exc instanceof ExitCode) {
            process.exit(exc.code);
        }
        throw exc;
    }
}

export {
    REPO,
    BUNDLE_ROOTS,
    LEAK_PATTERNS,
    MAX_SNIPPET,
    MAX_HITS_SHOWN_PER_GROUP,
    mask_snippet,
    scan_content,
    scan_file,
    scan_files,
    tracked_bundle_files,
    format_report,
    parse_args,
    main,
    ExitCode,
};
export type { Hit, LeakPattern, Options };

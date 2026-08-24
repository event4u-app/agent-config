#!/usr/bin/env tsx
/**
 * Guard against build-machine path leakage in the tracked install bundle AND in
 * published Markdown.
 *
 * ## The published-.md scope (road-to-inbox-harvest-2026-08-e-command-surface-legibility Phase 0)
 *
 * The bundle roots below were the original scope. A second population ships the
 * same leak class: every `.md` inside `package.json` `files[]` — 1,079 files —
 * and a `/Users/<name>/…` in a shipped skill is the same defect as one in
 * `install.mjs`.
 *
 * **It is EXTENDED here rather than given a second gate**, deliberately: this one
 * already runs in CI, already carries the patterns, the username masking and the
 * `scan_scope` dead-scope protection, and a sibling gate would duplicate all
 * four.
 *
 * ### Why the floor is ZERO UNAPPROVED and not the measured 11
 *
 * The published-.md baseline measured **11 hits in 8 files, none of them a leak**
 * (`agents/evidence/analysis/published-md-path-leakage-baseline.md`): three
 * documentation examples, six occurrences inside the rules that FORBID the
 * pattern and must quote it, two legitimately absolute paths.
 *
 * A numeric floor of 11 was rejected by both council seats, 2026-08-24, for one
 * reason: it lets an approved hit disappear while a real leak takes its slot, and
 * the count stays 11. So the floor is **0 unapproved matches**, and the eleven are
 * pinned exceptions in `.path-leak-allow` — line-pinned, so an entry that drifts
 * off its line stops matching and the gate REDS, which is the safe direction.
 *
 * ### And why NOT "exempt matches inside backticks"
 *
 * That was the other candidate, and it was rejected on a false-negative argument
 * both seats found decisive: **a real leaked path is commonly formatted as code**,
 * so exempting inline code and fenced blocks opens a channel that hides exactly
 * the defect this gate exists to catch. It would also hide a skill author's
 * accidental real path inside an example block — the contribution path where this
 * class is most likely to arrive.
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

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');

// Tracked directories that may hold a build-generated bundle. Only
// `dist/install/` is force-included in `.gitignore` today (`!/dist/install/`);
// `dist/hooks/`, `dist/mcp/` and `dist/cli-delegate/` are listed defensively
// in case a future change tracks them too — `git ls-files` on an untracked
// directory returns nothing, so listing an as-yet-untracked root here is
// always safe.
const BUNDLE_ROOTS: readonly string[] = [
    'dist/install',
    'dist/hooks',
    'dist/mcp',
    'dist/cli-delegate',
];

/**
 * Published `.md` — the second population, derived from `package.json` `files[]`
 * rather than guessed, so the scope is what the tarball actually ships. Roots
 * only; the per-file filter below keeps it to `.md`.
 */
const PUBLISHED_MD_ROOTS: readonly string[] = [
    'dist/agent-src',
    'docs/guidelines',
    'src/scripts',
    // NOT `src/agent-src` wholesale: `files[]` ships only these two subtrees, and
    // scanning the parent would gate content no consumer receives. Caught by this
    // gate's own test, which asserts every root is inside `files[]`.
    'src/agent-src/scripts',
    'src/agent-src/templates/scripts',
    'agents/templates',
    'src/templates',
    'src/config',
];

/** Named `.md` / text files `files[]` ships individually. */
const PUBLISHED_MD_FILES: readonly string[] = [
    'AGENTS.md',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'MIGRATION.md',
    'README.md',
    'docs/contracts/persona-schema.md',
    'docs/contracts/provider-lifecycle.md',
    'docs/contracts/settings-classes.md',
];

/** Repo-root allow file for audited published-`.md` exceptions. */
const ALLOW_FILE = '.path-leak-allow';

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

/**
 * Parse `.path-leak-allow` into `path:line` keys.
 *
 * Line-pinned on purpose, and the trade-off is the same one `.secret-allow`
 * documents for itself: an entry that drifts off its line stops matching and the
 * gate REDS. That is the safe direction — someone re-audits and moves the pin —
 * whereas a path-only entry would silently allow a real leak anywhere in the
 * file. This tree has already been bitten by the opposite: a `.secret-allow` pin
 * sat one line off on `main` for a day, covering nothing, invisible because that
 * gate is diff-scoped.
 */
export function parse_allow_file(text: string): Set<string> {
    const out = new Set<string>();
    for (const raw of text.split('\n')) {
        const line = raw.replace(/#.*$/, '').trim();
        if (line === '') continue;
        out.add(line);
    }
    return out;
}

function allow_set(): Set<string> {
    try {
        return parse_allow_file(fs.readFileSync(path.join(REPO, ALLOW_FILE), 'utf-8'));
    } catch {
        return new Set();
    }
}

/** Every tracked `.md` inside the published roots, plus the named files. */
function tracked_published_md(): string[] {
    const seen = new Set<string>();
    for (const root of PUBLISHED_MD_ROOTS) {
        for (const rel of _splitlines(_git(['ls-files', root]))) {
            if (rel.endsWith('.md')) seen.add(rel);
        }
    }
    for (const rel of PUBLISHED_MD_FILES) {
        for (const got of _splitlines(_git(['ls-files', rel]))) seen.add(got);
    }
    return [...seen].sort();
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
    const bundle = opts.files.length > 0 ? opts.files : tracked_bundle_files();
    // Published `.md` joins the default target list. With explicit `--file`
    // arguments it does NOT — an ad-hoc single-file run stays a single-file run,
    // which is what the existing tests and the pre-push path rely on.
    const published = opts.files.length > 0 ? [] : tracked_published_md();
    const targets = [...bundle, ...published];

    // `git ls-files <untracked-root>` returns nothing, by design (BUNDLE_ROOTS
    // lists roots that may not be tracked yet). That tolerance is also the
    // failure mode: if `dist/install/` stopped being force-included, every root
    // resolves empty and the gate prints "0 tracked bundle file(s) scanned"
    // with exit 0. Deletion test: a repo that ships an install bundle always
    // tracks at least one bundle file, so 0 is never success here.
    // Exit 2 (usage/env) over 1 (leak found) — a dead scope means the gate
    // could not run, not that it found a leak.
    try {
        assertScanned({
            gate: 'check_bundle_path_leakage',
            scanned: targets.length,
            units: 'bundle + published-md file(s)',
            roots:
                opts.files.length > 0
                    ? ['<explicit file arguments>']
                    : [...BUNDLE_ROOTS, ...PUBLISHED_MD_ROOTS],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }

    const allowed = allow_set();
    const all = scan_files(targets);
    // The floor is ZERO UNAPPROVED, never a count. A pinned exception that has
    // drifted off its line simply stops matching, so the hit resurfaces and the
    // gate reds — deliberately, per the header.
    const hits = all.filter((h) => !allowed.has(`${h.file}:${String(h.line)}`));
    const suppressed = all.length - hits.length;

    if (hits.length > 0) {
        process.stderr.write(`${format_report(hits)}\n`);
        // The per-pattern hints are bundle-shaped ("rebuild from a clean
        // checkout"), which is the wrong instruction for a `.md` hit — nothing is
        // rebuilt to fix prose. Published-md hits get their own line rather than
        // a misleading one.
        if (hits.some((h) => h.file.endsWith('.md'))) {
            process.stderr.write(
                `   NOTE: a \`.md\` hit is not fixed by rebuilding. Either anonymise the path,\n` +
                    `   or — if it IS the pattern being documented — pin it in ${ALLOW_FILE}.\n`,
            );
        }
        if (suppressed > 0) {
            process.stderr.write(
                `   (${suppressed} further match(es) are pinned exceptions in ${ALLOW_FILE})\n`,
            );
        }
        process.stderr.write(
            `   A published-.md match that is the PATTERN BEING DOCUMENTED — a rule quoting\n` +
                `   the shape it forbids, or an anonymised example — belongs in ${ALLOW_FILE}\n` +
                `   as \`<path>:<line>\` with its reason above it. A real path does not.\n`,
        );
        return 1;
    }

    if (!opts.quiet) {
        // A gate that scans nothing and exits green is indistinguishable from a
        // broken one, so the green path names both populations and the
        // suppression count — an exception set that quietly grows is the failure
        // mode a bare "no leakage" line would hide.
        process.stdout.write(
            `✅  check_bundle_path_leakage: no unapproved path leakage ` +
                `(${String(bundle.length)} bundle + ${String(published.length)} published-md ` +
                `file(s) scanned, ${String(suppressed)} pinned exception(s)).\n`,
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
    PUBLISHED_MD_ROOTS,
    PUBLISHED_MD_FILES,
    ALLOW_FILE,
    tracked_published_md,
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

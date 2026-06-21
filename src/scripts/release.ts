#!/usr/bin/env tsx
/**
 * End-to-end release automation for `event4u/agent-config` (TypeScript twin).
 *
 * TypeScript twin of `src/scripts/release.py` (ADR-200, py2ts migration).
 * The CLI contract mirrors the Python original EXACTLY — same flags, same
 * exit codes, same stdout/stderr split, byte-identical emitted output, same
 * subprocess argv/cwd/env. No behaviour changes — latent quirks are
 * replicated and flagged inline, not fixed.
 *
 * Invoked via `task release`. The bump level (major/minor/patch) is
 * auto-detected from Conventional Commits since the last tag; pass
 * `--as {major,minor,patch}` to force, or `--version X.Y.Z` to pin.
 *
 * Pipeline:
 *     1. Preflight         — on main, clean tree, origin in sync, gh available,
 *                            target tag doesn't exist yet.
 *     2. Plan              — compute new version, parse Conventional Commits
 *                            since the last tag, render CHANGELOG section.
 *     3. Confirm           — show preview, ask once (skippable with --yes).
 *     4. Branch + bump     — create `release/X.Y.Z`, update package.json,
 *                            .claude-plugin/marketplace.json, CHANGELOG.md,
 *                            then run `task release-prepare` so pack
 *                            manifests and tool projections pick up the
 *                            new version (otherwise the PR's own consistency
 *                            check fails — see PR #226 post-mortem).
 *     5. Commit + push     — `release: X.Y.Z`, push branch, open PR.
 *     6. Wait for CI       — `gh pr checks --watch` (skippable with --no-wait).
 *     7. Merge             — `gh pr merge --merge --delete-branch`.
 *     8. Tag main          — fast-forward main, tag the merge commit,
 *                            push the tag (this triggers publish-npm.yml).
 *     9. GitHub Release     — `gh release create X.Y.Z --notes <changelog>`.
 *
 * Idempotency: pass `--resume` to recover from a partial failure. Each
 * step then probes existing state (branch, commit, PR, tag, GitHub
 * Release) and skips work that is already done, instead of erroring out.
 * Without `--resume` the pipeline still mutates git/network state, so
 * re-running on a dirty tree needs `--resume` (or a manual cleanup).
 * Each step prints what it's about to do before doing it, so a crash
 * leaves a recoverable trail.
 *
 * Stdlib-only (Python 3.10+). No third-party runtime dependencies.
 *
 * See also:
 *     - docs/contracts/release-pr-gating.md — release-PR shape, cut surface,
 *       kept surface, fail-closed contract.
 *     - docs/contracts/branch-protection-policy.md — per-PR-shape
 *       required-check matrix; `task ci:required-checks` previews it.
 *     - docs/contracts/ci-cost-budget.md — measured baselines + quarterly
 *       review cadence.
 *     - .github/workflows/release-validation.yml — the tight release-PR
 *       validation jobs (release-shape, changelog-entry, version-consistency).
 *
 * --- Parity notes (ADR-200) ---
 *
 * - `die(msg, code=2)` mirrors Python's `print(error) + sys.exit(code)`: it
 *   prints `error: {msg}` to stderr then throws a `SystemExitError(code)`
 *   sentinel caught at the CLI entry guard, which sets `process.exitCode`. We
 *   never call `process.exit()` (per the migration contract).
 * - argparse usage errors (unknown flag, bad `--as` choice) throw
 *   `ArgparseExit(2)`; `-h`/`--help` throws `ArgparseExit(0)` after printing
 *   usage. The argparse `--help` BODY (per-flag descriptions) is a documented
 *   divergence — argparse re-wraps it to the live terminal width; the tests
 *   assert the `usage:` token + exit code, not the body prose.
 * - JSON byte-parity: `set_package_version` uses `json.dumps(data, indent=4)`,
 *   `set_marketplace_version` uses `json.dumps(data, indent=2)`, both `+ "\n"`.
 *   release.py does NOT pass `ensure_ascii`, so CPython defaults to True
 *   (ASCII-escaped non-ASCII). The reused `jsonDumpsIndent` helper (mirrored
 *   from install.ts) is the `ensure_ascii=False` variant. The package's
 *   package.json / marketplace.json are pure-ASCII, so the two are
 *   byte-identical in practice; if a non-ASCII string ever lands in those
 *   files this would diverge (release.py would `\uXXXX`-escape, this twin
 *   would emit the raw codepoint). Documented, not fixed.
 * - subprocess → `spawnSync` with identical argv/cwd/env. `run()` mirrors
 *   `subprocess.run(check, cwd=cwd or REPO_ROOT, text=True, capture_output)`.
 *   On `check && capture && non-zero` → `die("command failed (...)")`. On
 *   `check && !capture && non-zero` → throw `CalledProcessError` (NOT caught
 *   by the entry guard, so it propagates — matches Python letting it raise).
 *   `_count_tests_current` catches FileNotFoundError / TimeoutExpired →
 *   modelled via `res.error` (ENOENT) and the `timeout` option.
 * - `time.sleep(5)` in `watch_pr_checks` ports faithfully (blocking). It is
 *   never reached on any test path (tests never call execute()).
 * - `_date.today().isoformat()` → a `YYYY-MM-DD` local-date helper.
 * - `_lib.changelog_eras` imports resolve to the `.ts` twin, never a `.py`.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type {
    SplitPlan} from './_lib/changelog_eras.js';
import {
    CURRENT_ERA_BODY_CAP,
    current_era_body_size,
    current_era_insertion_point,
    perform_split,
    plan_split,
} from './_lib/changelog_eras.js';

// `__doc__.splitlines()[0]` in `_parse_args` — the argparse description. Kept
// as a referenceable constant so the first docstring line is preserved exactly.
const MODULE_DOC_FIRST_LINE = 'End-to-end release automation for `event4u/agent-config`.';

const _HERE = fileURLToPath(import.meta.url);

// ---------------------------------------------------------------------------
// Python-runtime parity helpers
// ---------------------------------------------------------------------------

/** Mirror of Python `sys.exit(code)` raised by `die()`. Caught at the CLI entry. */
class SystemExitError extends Error {
    constructor(public readonly code: number) {
        super(`system-exit-${code}`);
    }
}

/** argparse usage-error / help exit (code 2 / 0). */
class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

/**
 * Mirror of `subprocess.CalledProcessError`. Thrown by `run()` when a command
 * fails with `check=True` and output is NOT captured — the Python original
 * lets `CalledProcessError` propagate in that path. The CLI entry guard does
 * NOT catch this, so it surfaces (non-zero exit + traceback), matching Python.
 */
class CalledProcessError extends Error {
    constructor(
        public readonly returncode: number,
        public readonly cmd: readonly string[],
    ) {
        super(`Command '${cmd.join(' ')}' returned non-zero exit status ${returncode}.`);
    }
}

// ---------------------------------------------------------------------------
// Module-level constants (release.py:70-84)
// ---------------------------------------------------------------------------

// REPO_ROOT: release.py is at src/scripts/release.py;
// Path(__file__).resolve().parent.parent.parent == src/scripts → src → repo
// root. release.ts lives in the same dir, so _HERE-dir is src/scripts and
// `..`/`..` reaches the repo root (matches changelog_eras.ts's 3-up from
// _lib/ and install.ts's REPO_ROOT computation).
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const PACKAGE_JSON = path.join(REPO_ROOT, 'package.json');
const MARKETPLACE_JSON = path.join(REPO_ROOT, '.claude-plugin', 'marketplace.json');
const CHANGELOG = path.join(REPO_ROOT, 'CHANGELOG.md');
const MAIN_BRANCH = 'main';
const REMOTE = 'origin';
const REPO_SLUG = 'event4u-app/agent-config';

// GitHub rejects bodies over these limits with a GraphQL "Body is too
// long" error. The full entry always lands in CHANGELOG.md (committed in
// the PR diff and attached to the tag), so an oversized body is capped
// with a pointer rather than failing the release — a major bump can
// render hundreds of commit bullets, well past the 65 536 PR-body limit.
const GH_PR_BODY_LIMIT = 65_536; // createPullRequest mutation hard limit
const GH_RELEASE_NOTES_LIMIT = 125_000; // release-notes body limit

// ---------------------------------------------------------------------------
// Parity helpers — code-point length, comma grouping, regex escape, JSON
// ---------------------------------------------------------------------------

/** Python `len(str)` — number of Unicode code points (not UTF-16 units). */
function pyLen(s: string): number {
    return [...s].length;
}

/** Python `text[:n]` on a string — first `n` code points. */
function pySlice(s: string, n: number): string {
    return [...s].slice(0, n).join('');
}

/** Python f-string `{n:,}` — thousands grouping with commas (en-US grouping). */
function commaGroup(n: number): string {
    const neg = n < 0;
    const digits = Math.abs(n).toString();
    let out = '';
    for (let i = 0; i < digits.length; i += 1) {
        if (i > 0 && (digits.length - i) % 3 === 0) out += ',';
        out += digits[i];
    }
    return neg ? '-' + out : out;
}

/** Python `re.escape` — escape regex-special chars in a literal string. */
function reEscape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\#\-]/g, '\\$&');
}

// --- JSON byte-parity (mirrors install.ts; see Parity notes for ensure_ascii). ---

function _jsonStrNoAscii(s: string): string {
    // json.dumps(ensure_ascii=False): escape control chars + " + \, keep >=0x20.
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        switch (ch) {
            case '"':
                out += '\\"';
                break;
            case '\\':
                out += '\\\\';
                break;
            case '\n':
                out += '\\n';
                break;
            case '\r':
                out += '\\r';
                break;
            case '\t':
                out += '\\t';
                break;
            case '\b':
                out += '\\b';
                break;
            case '\f':
                out += '\\f';
                break;
            default:
                if (code < 0x20) {
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else {
                    out += ch;
                }
        }
    }
    return out + '"';
}

function _jsonScalar(value: unknown): string | null {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            if (Number.isNaN(value)) return 'NaN';
            return value > 0 ? 'Infinity' : '-Infinity';
        }
        return String(value);
    }
    if (typeof value === 'string') return _jsonStrNoAscii(value);
    return null;
}

function _dumpIndent(value: unknown, indent: number, depth: number): string {
    const scalar = _jsonScalar(value);
    if (scalar !== null) return scalar;
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => pad + _dumpIndent(v, indent, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj);
        if (keys.length === 0) return '{}';
        const items = keys.map(
            (k) => `${pad}${_jsonStrNoAscii(k)}: ${_dumpIndent(obj[k], indent, depth + 1)}`,
        );
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _jsonStrNoAscii(String(value));
}

/** `json.dumps(data, indent=N)` (sort_keys=False; ensure_ascii — see Parity notes). */
function jsonDumpsIndent(value: unknown, indent: number): string {
    return _dumpIndent(value, indent, 0);
}

/** `_date.today().isoformat()` — local date as `YYYY-MM-DD`. */
function todayIso(now?: Date): string {
    const d = now ?? new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---------------------------------------------------------------------------
// _cap_body (release.py:87-101)
// ---------------------------------------------------------------------------

/**
 * Return `text` unchanged when within `limit` chars; otherwise truncate at
 * the last line boundary that fits and append a pointer to `full_ref` so
 * nothing is silently lost.
 */
function _cap_body(text: string, limit: number, full_ref: string): string {
    if (pyLen(text) <= limit) {
        return text;
    }
    const notice =
        `\n\n> _Changelog truncated to fit GitHub's ` +
        `${commaGroup(limit)}-character body limit — full entry in ${full_ref}._`;
    let head = pySlice(text, limit - pyLen(notice));
    const nl = head.lastIndexOf('\n');
    if (nl > 0) {
        head = head.slice(0, nl);
    }
    return head + notice;
}

// ---------------------------------------------------------------------------
// SECTIONS + commit regexes (release.py:103-120)
// ---------------------------------------------------------------------------

// Conventional Commit types and how they map into CHANGELOG sections.
// Order in this tuple determines order in the rendered entry.
const SECTIONS: ReadonlyArray<readonly [string, string | null, readonly string[]]> = [
    ['Features', 'minor', ['feat']],
    ['Bug Fixes', 'patch', ['fix']],
    ['Performance', 'patch', ['perf']],
    ['Reverts', 'patch', ['revert']],
    ['Documentation', null, ['docs']],
    ['Refactoring', null, ['refactor']],
    ['Tests', null, ['test']],
    ['Build', null, ['build']],
    ['CI', null, ['ci']],
    ['Chores', null, ['chore']],
];

const BREAKING_RE = /^([a-z]+)(\([^)]+\))?!:/;
const CONVENTIONAL_RE = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<bang>!)?: (?<subject>.+)$/;

// ─── dataclasses ──────────────────────────────────────────────────────────────

/** `@dataclass(frozen=True) class Commit`. */
class Commit {
    constructor(
        public readonly sha: string,
        public readonly type: string,
        public readonly scope: string | null,
        public readonly subject: string,
        public readonly breaking: boolean,
    ) {}
}

/** `@dataclass(frozen=True) class Plan`. */
class Plan {
    constructor(
        public readonly current: string,
        public readonly target: string,
        public readonly bump: string, // "major" | "minor" | "patch"
        public readonly commits: readonly Commit[],
        public readonly last_tag: string | null,
        public readonly changelog_body: string, // rendered body (without the heading)
        public readonly changelog_entry: string, // full entry including heading, for CHANGELOG.md
        // Populated only when the release crosses an era boundary AND the
        // current era body has grown past CURRENT_ERA_BODY_CAP. null for
        // patch releases and for minor/major bumps where the era still fits.
        public readonly split_plan: SplitPlan | null = null,
    ) {}
}

// ─── utilities ────────────────────────────────────────────────────────────────

function die(msg: string, code = 2): never {
    process.stderr.write(`error: ${msg}\n`);
    throw new SystemExitError(code);
}

interface RunResult {
    returncode: number;
    stdout: string;
    stderr: string;
}

/**
 * Thin subprocess wrapper with sane defaults.
 *
 * When `check` and `capture` are both True and the command fails, Python's
 * default behaviour swallows stderr — callers only see a CalledProcessError
 * with no hint of what went wrong. We catch that path and die with the actual
 * stderr so release preflight failures are diagnosable without re-running with
 * a debugger.
 */
function run(
    args: readonly string[],
    opts: { check?: boolean; capture?: boolean; cwd?: string | null } = {},
): RunResult {
    const check = opts.check ?? true;
    const capture = opts.capture ?? false;
    const cwd = opts.cwd ?? REPO_ROOT;

    const [cmd, ...rest] = args;
    const res = spawnSync(cmd as string, rest, {
        cwd,
        encoding: 'utf-8',
        // capture_output=True → pipe; else inherit so child writes straight to
        // this process's stdout/stderr (text mode, matching subprocess text=True).
        stdio: capture ? ['ignore', 'pipe', 'pipe'] : ['inherit', 'inherit', 'inherit'],
    });

    if (res.error) {
        // FileNotFoundError analogue (ENOENT) and other spawn failures — Python
        // would raise here; only the explicit catchers (have / _count_tests_current)
        // handle it. Surface as a thrown error.
        throw res.error;
    }

    const returncode = res.status ?? 0;
    const stdout = capture ? res.stdout ?? '' : '';
    const stderr = capture ? res.stderr ?? '' : '';

    if (check && returncode !== 0) {
        if (capture) {
            const cmdStr = args.join(' ');
            const out = (stderr || stdout || '').trim();
            die(`command failed (${returncode}): ${cmdStr}\n${out}`);
        }
        // check && !capture → Python re-raises CalledProcessError; replicate.
        throw new CalledProcessError(returncode, args);
    }

    return { returncode, stdout, stderr };
}

function git(args: readonly string[], opts: { capture?: boolean } = {}): string {
    const capture = opts.capture ?? false;
    const r = run(['git', ...args], { capture });
    return capture ? r.stdout.trim() : '';
}

/**
 * Watch PR checks and tolerate the 'no checks' case.
 *
 * `gh pr checks --watch` exits 1 both on real failures and when no checks are
 * reported at all (no workflow triggered, no required checks configured in
 * branch protection). The latter must not block the release — we warn and
 * continue. Real failures still die.
 *
 * A short grace period gives GitHub time to register workflow runs on a
 * freshly-pushed branch.
 */
function watch_pr_checks(): void {
    // time.sleep(5) — blocking grace period. Never reached on any test path.
    const until = Date.now() + 5000;
    while (Date.now() < until) {
        // busy-wait stand-in for time.sleep(5) without an event-loop yield.
    }
    const proc = spawnSync('gh', ['pr', 'checks', '--watch'], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (proc.error) {
        throw proc.error;
    }
    const output = ((proc.stdout || '') + (proc.stderr || '')).trim();
    const returncode = proc.status ?? 0;
    if (returncode === 0) {
        if (output) {
            process.stdout.write(output + '\n');
        }
        return;
    }
    if (output.toLowerCase().includes('no checks reported')) {
        process.stdout.write(`⚠️  ${output}\n`);
        process.stdout.write(
            '   Continuing without check validation — configure required ' +
                'checks in branch protection to enforce this gate.\n',
        );
        return;
    }
    if (output) {
        process.stderr.write(output + '\n');
    }
    die(`PR checks failed (exit ${returncode})`);
}

function have(bin: string): boolean {
    const res = spawnSync('which', [bin], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (res.error) {
        // FileNotFoundError on `which` itself → treat as not found (returncode != 0).
        return false;
    }
    return (res.status ?? 1) === 0;
}

// ─── resume-mode state probes ────────────────────────────────────────────────

function _branch_exists_local(branch: string): boolean {
    const r = run(['git', 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], {
        check: false,
        capture: true,
    });
    return r.returncode === 0;
}

function _branch_exists_remote(branch: string): boolean {
    const r = run(['git', 'ls-remote', '--exit-code', '--heads', REMOTE, branch], {
        check: false,
        capture: true,
    });
    return r.returncode === 0;
}

function _tag_exists_local(tag: string): boolean {
    return git(['tag', '-l', tag], { capture: true }).split('\n').includes(tag);
}

function _tag_exists_remote(tag: string): boolean {
    const r = run(['git', 'ls-remote', '--exit-code', '--tags', REMOTE, tag], {
        check: false,
        capture: true,
    });
    return r.returncode === 0;
}

/** Most recent PR (any state) with `release/X.Y.Z` as head, or null. */
function _pr_for_branch(branch: string): Record<string, unknown> | null {
    const r = run(
        [
            'gh',
            'pr',
            'list',
            '--head',
            branch,
            '--state',
            'all',
            '--json',
            'number,state,url',
            '--limit',
            '1',
        ],
        { check: false, capture: true },
    );
    if (r.returncode !== 0) {
        return null;
    }
    let items: unknown;
    try {
        items = JSON.parse(r.stdout || '[]');
    } catch {
        return null;
    }
    return Array.isArray(items) && items.length > 0 ? (items[0] as Record<string, unknown>) : null;
}

function _release_exists(tag: string): boolean {
    const r = run(['gh', 'release', 'view', tag], { check: false, capture: true });
    return r.returncode === 0;
}

// ─── version math ─────────────────────────────────────────────────────────────

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

function parse_version(s: string): [number, number, number] {
    const m = SEMVER_RE.exec(s.trim());
    if (!m) {
        // {s!r} → Python repr of a str (single-quoted).
        die(`not a bare semver (X.Y.Z): '${s}'`);
    }
    return [
        Number.parseInt(m[1] as string, 10),
        Number.parseInt(m[2] as string, 10),
        Number.parseInt(m[3] as string, 10),
    ];
}

function bump_version(current: string, kind: string): string {
    const [major, minor, patch] = parse_version(current);
    if (kind === 'major') {
        return `${major + 1}.0.0`;
    }
    if (kind === 'minor') {
        return `${major}.${minor + 1}.0`;
    }
    if (kind === 'patch') {
        return `${major}.${minor}.${patch + 1}`;
    }
    die(`unknown bump kind: ${kind}`);
    return ''; // unreachable
}

// ─── commit parsing + changelog rendering ────────────────────────────────────

/** Return non-merge commits after `tag` (or all of history if tag is null). */
function commits_since(tag: string | null): Commit[] {
    const rev = tag ? `${tag}..HEAD` : 'HEAD';
    const raw = git(['log', rev, '--no-merges', '--format=%H%x1f%s'], { capture: true });
    const out: Commit[] = [];
    for (const line of raw.split('\n')) {
        if (!line.includes('\x1f')) {
            continue;
        }
        // str.split("\x1f", 1) — maxsplit=1: head + remainder.
        const idx = line.indexOf('\x1f');
        const sha = line.slice(0, idx);
        const subject = line.slice(idx + 1);
        const m = CONVENTIONAL_RE.exec(subject);
        if (!m) {
            out.push(new Commit(sha, 'other', null, subject, false));
            continue;
        }
        const breaking = Boolean(m.groups!['bang']) || subject.includes('BREAKING CHANGE');
        out.push(
            new Commit(
                sha,
                m.groups!['type'] as string,
                (m.groups!['scope'] ?? null) as string | null,
                m.groups!['subject'] as string,
                breaking,
            ),
        );
    }
    return out;
}

/** Derive the semver bump from commit types (for preview only). */
function infer_bump(commits: readonly Commit[]): string {
    if (commits.some((c) => c.breaking)) {
        return 'major';
    }
    for (const [, level, types] of SECTIONS) {
        if (level === 'minor' && commits.some((c) => types.includes(c.type))) {
            return 'minor';
        }
    }
    return 'patch';
}

function latest_tag(): string | null {
    const r = run(
        [
            'git',
            'describe',
            '--tags',
            '--abbrev=0',
            '--match',
            '[0-9]*.[0-9]*.[0-9]*',
        ],
        { check: false, capture: true },
    );
    const tag = r.stdout.trim();
    return tag || null;
}

/**
 * Return [heading-aware full entry, body-only for GitHub Release notes].
 *
 * `test_trend_line` — optional pre-computed `Tests: N (+M …)` footer
 * (road-to-feedback-followups P3.2). Computed by the caller so tests don't
 * trigger a recursive pytest collection.
 */
function render_changelog_entry(
    version: string,
    prev: string | null,
    commits: readonly Commit[],
    today: string,
    opts: { test_trend_line?: string | null } = {},
): [string, string] {
    const test_trend_line = opts.test_trend_line ?? null;
    let heading: string;
    if (prev) {
        heading =
            `## [${version}](https://github.com/${REPO_SLUG}/compare/` +
            `${prev}...${version}) (${today})`;
    } else {
        heading = `## ${version} (${today})`;
    }

    // Group by section; commits of unknown type drop into "Other".
    const grouped: Record<string, Commit[]> = {};
    for (const [label] of SECTIONS) {
        grouped[label] = [];
    }
    grouped['BREAKING CHANGES'] = [];
    const other: Commit[] = [];
    for (const c of commits) {
        if (c.breaking) {
            grouped['BREAKING CHANGES']!.push(c);
            continue;
        }
        let placed = false;
        for (const [label, , types] of SECTIONS) {
            if (types.includes(c.type)) {
                grouped[label]!.push(c);
                placed = true;
                break;
            }
        }
        if (!placed) {
            other.push(c);
        }
    }

    const body_lines: string[] = [];
    const ordered_labels = ['BREAKING CHANGES', ...SECTIONS.map(([label]) => label)];
    for (const label of ordered_labels) {
        const bucket = grouped[label] ?? [];
        if (bucket.length === 0) {
            continue;
        }
        body_lines.push('');
        body_lines.push(`### ${label}`);
        body_lines.push('');
        for (const c of bucket) {
            body_lines.push(_changelog_line(c));
        }
    }
    if (other.length > 0) {
        body_lines.push('');
        body_lines.push('### Other');
        body_lines.push('');
        for (const c of other) {
            body_lines.push(_changelog_line(c));
        }
    }

    // Test-count trend footer (road-to-feedback-followups P3.2). Silent on
    // errors — never a release blocker.
    if (test_trend_line) {
        body_lines.push('');
        body_lines.push(test_trend_line);
    }

    // "\n".join(...).lstrip("\n") — strip only leading newlines.
    const body = body_lines.join('\n').replace(/^\n+/u, '');
    const full = heading + '\n\n' + body + '\n';
    return [full, body];
}

function _changelog_line(c: Commit): string {
    const scope = c.scope ? `**${c.scope}:** ` : '';
    const short = c.sha.slice(0, 7);
    const link = `https://github.com/${REPO_SLUG}/commit/${c.sha}`;
    return `* ${scope}${c.subject} ([${short}](${link}))`;
}

// ─── test-count trend (road-to-feedback-followups P3.2) ───────────────────────

const _TEST_COUNT_LINE_RE = /^Tests:\s+(\d+)/m;
const _PYTEST_COLLECTED_RE = /^(\d+)\s+tests?\s+collected/m;

/**
 * Return the count from `pytest --collect-only -q` on the current tree.
 * Returns null when pytest isn't available or collection fails — the trend
 * line is informational, never a release blocker.
 */
function _count_tests_current(): number | null {
    // Release-time pytest-collection probe: python-test-tooling, not package
    // runtime — there is no tsx equivalent of pytest collection. Degrades to
    // null (informational trend line dropped) when python3/pytest is absent.
    const res = spawnSync('python3', ['-m', 'pytest', '--collect-only', '-q'], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120_000,
    });
    if (res.error) {
        // FileNotFoundError (ENOENT) or TimeoutExpired (ETIMEDOUT) → None.
        return null;
    }
    if ((res.status ?? 1) !== 0) {
        return null;
    }
    const match = _PYTEST_COLLECTED_RE.exec(res.stdout ?? '');
    return match ? Number.parseInt(match[1] as string, 10) : null;
}

/**
 * Read CHANGELOG.md and return the most recent `Tests: N` footer under the
 * `prev_tag` heading, or null when not found.
 */
function _previous_test_count_from_changelog(prev_tag: string | null): number | null {
    if (!prev_tag || !fs.existsSync(CHANGELOG)) {
        return null;
    }
    const text = fs.readFileSync(CHANGELOG, 'utf-8');
    const heading_re = new RegExp(`^##\\s+\\[?${reEscape(prev_tag)}\\b`, 'm');
    const m = heading_re.exec(text);
    if (!m) {
        return null;
    }
    const headEnd = m.index + m[0].length;
    const rest = text.slice(headEnd);
    const next_re = /^##\s+\[?\d+\.\d+\.\d+/m;
    const next_heading = next_re.exec(rest);
    const sectionEnd = headEnd + (next_heading ? next_heading.index : rest.length);
    const section = text.slice(headEnd, sectionEnd);
    const count_match = _TEST_COUNT_LINE_RE.exec(section);
    return count_match ? Number.parseInt(count_match[1] as string, 10) : null;
}

/**
 * Return the `Tests: N (+M since X.Y.Z)` footer line, or null when the current
 * count cannot be determined. Silent on collection errors.
 */
function _render_test_trend_line(prev_tag: string | null): string | null {
    const current = _count_tests_current();
    if (current === null) {
        return null;
    }
    const previous = _previous_test_count_from_changelog(prev_tag);
    if (previous === null || !prev_tag) {
        return `Tests: ${current}`;
    }
    const delta = current - previous;
    const sign = delta >= 0 ? '+' : '';
    return `Tests: ${current} (${sign}${delta} since ${prev_tag})`;
}

/**
 * Insert `entry` inside the current era block.
 *
 * Strategy delegates to `current_era_insertion_point` so a fresh era (no
 * version headings yet, just the intro blockquote) places the new entry after
 * the intro instead of appended at end-of-file. When no current era header
 * exists, falls back to the legacy "above the most recent ## [" heuristic for
 * safety.
 */
function prepend_changelog(p: string, entry: string): void {
    const text = fs.readFileSync(p, 'utf-8');
    const lines = _splitlines(text);
    const insert_at = current_era_insertion_point(lines);
    if (insert_at !== null) {
        const before = lines.slice(0, insert_at).join('\n');
        const after = lines.slice(insert_at).join('\n');
        const head = before + (before ? '\n' : '');
        fs.writeFileSync(p, head + entry + '\n' + after + '\n', 'utf-8');
        return;
    }

    // Legacy fallback — no era header present at all.
    const marker_re = /^## \[?\d+\.\d+\.\d+/m;
    const m = marker_re.exec(text);
    if (!m) {
        fs.writeFileSync(p, _rstrip(text) + '\n\n' + entry, 'utf-8');
        return;
    }
    const before = text.slice(0, m.index);
    const after = text.slice(m.index);
    fs.writeFileSync(p, before + entry + '\n' + after, 'utf-8');
}

/** Mirror of Python `str.splitlines()` (no trailing empty for a final newline). */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    const parts = text.split(/\r\n|\r|\n/);
    if (parts.length > 0 && parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

/** Mirror of Python `str.rstrip()` (trailing whitespace). */
function _rstrip(text: string): string {
    return text.replace(/\s+$/u, '');
}

// ─── file mutations ───────────────────────────────────────────────────────────

/** Update the top-level `version` field; preserve 4-space indentation. */
function set_package_version(p: string, version: string): void {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
    data['version'] = version;
    fs.writeFileSync(p, jsonDumpsIndent(data, 4) + '\n', 'utf-8');
}

/** Update `metadata.version`; preserve 2-space indentation + UTF-8. */
function set_marketplace_version(p: string, version: string): void {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
    // data.setdefault("metadata", {})["version"] = version — preserve key order.
    if (!(typeof data['metadata'] === 'object' && data['metadata'] !== null && !Array.isArray(data['metadata']))) {
        data['metadata'] = {};
    }
    (data['metadata'] as Record<string, unknown>)['version'] = version;
    fs.writeFileSync(p, jsonDumpsIndent(data, 2) + '\n', 'utf-8');
}

// ─── preflight ────────────────────────────────────────────────────────────────

/**
 * Fail fast on conditions that would break the release mid-flight.
 *
 * In `--resume` mode two invariants are relaxed:
 *
 * - The starting branch may be `release/{target}` in addition to `main` —
 *   both are valid resume positions (mid-pipeline crash after step 1 leaves
 *   you on the release branch).
 * - The target-tag-exists check is dropped — execute() probes for existing
 *   tags/releases and skips them.
 *
 * Tree cleanliness, gh auth, and `main` in-sync with origin are still
 * enforced, so resuming has the same starting posture as a fresh run; only
 * step-level outcomes differ.
 */
function preflight(target: string, opts: { resume?: boolean } = {}): void {
    const resume = opts.resume ?? false;
    for (const b of ['git', 'gh']) {
        if (!have(b)) {
            die(`'${b}' not found on PATH`);
        }
    }

    // Probe the active token directly via an authenticated API call. `gh auth
    // status` returns non-zero if *any* account in the keyring is broken, even
    // when the active one is fine — so we'd rather ask "does the token the
    // release will actually use work?" than parse multi-account status output.
    const r = run(['gh', 'api', 'user', '--jq', '.login'], { check: false, capture: true });
    if (r.returncode !== 0) {
        die('gh is not authenticated; run `gh auth login` first');
    }

    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true });
    const release_branch = `release/${target}`;
    const allowed = resume ? new Set([MAIN_BRANCH, release_branch]) : new Set([MAIN_BRANCH]);
    if (!allowed.has(branch)) {
        if (resume) {
            die(
                `resume must run from '${MAIN_BRANCH}' or '${release_branch}', ` +
                    `currently on '${branch}'`,
            );
        }
        die(`release must run from '${MAIN_BRANCH}', currently on '${branch}'`);
    }

    const porcelain = git(['status', '--porcelain'], { capture: true });
    if (porcelain) {
        die('working tree is not clean; commit or stash first');
    }

    // --force lets the remote's tag positions win over stale local tags.
    // The release consumes the remote view as source of truth, and we're
    // about to create a new tag anyway — local drift (e.g. from renamed
    // release-please tags) should not block the fetch.
    run(['git', 'fetch', REMOTE, '--tags', '--prune', '--force'], { capture: true });

    // The local-in-sync-with-origin check only applies to main; if we're
    // already on the release branch in resume mode, the relevant invariant
    // is "main hasn't moved beyond what release/X.Y.Z branched off", which
    // `git pull --ff-only` enforces in step 8 anyway.
    if (branch === MAIN_BRANCH) {
        const local = git(['rev-parse', 'HEAD'], { capture: true });
        const remote = git(['rev-parse', `${REMOTE}/${MAIN_BRANCH}`], { capture: true });
        if (local !== remote) {
            die(
                `local ${MAIN_BRANCH} is not in sync with ` +
                    `${REMOTE}/${MAIN_BRANCH}; pull or push first`,
            );
        }
    }

    if (!resume) {
        const tags = git(['tag', '-l', target], { capture: true }).split('\n');
        if (tags.includes(target)) {
            die(`tag '${target}' already exists; nothing to release`);
        }
    }
}

// ─── plan ─────────────────────────────────────────────────────────────────────

function print_preview(plan: Plan): void {
    process.stdout.write('\n');
    process.stdout.write('═'.repeat(72) + '\n');
    process.stdout.write(`  Release preview — ${plan.current} → ${plan.target} (${plan.bump})\n`);
    process.stdout.write('═'.repeat(72) + '\n');
    process.stdout.write('\n');
    process.stdout.write(`Previous tag:   ${plan.last_tag || '(none)'}\n`);
    process.stdout.write(`New tag:        ${plan.target}\n`);
    process.stdout.write(`Commits:        ${plan.commits.length} since ${plan.last_tag || 'start'}\n`);
    const detected = plan.commits.length > 0 ? infer_bump(plan.commits) : 'patch';
    if (detected !== plan.bump) {
        process.stdout.write(
            `NOTE:           commits suggest a '${detected}' bump, ` +
                `you picked '${plan.bump}'\n`,
        );
    }
    process.stdout.write('\n');
    process.stdout.write('Files to change:\n');
    process.stdout.write(`  · ${path.relative(REPO_ROOT, PACKAGE_JSON)}\n`);
    process.stdout.write(`  · ${path.relative(REPO_ROOT, MARKETPLACE_JSON)}\n`);
    process.stdout.write(`  · ${path.relative(REPO_ROOT, CHANGELOG)}\n`);
    process.stdout.write('  · regenerated derived files via `task release-prepare`\n');
    process.stdout.write(
        '    (src/packs/*/pack.yaml + README.md, dist/agent-src/, tool projections)\n',
    );
    if (plan.split_plan !== null) {
        const sp = plan.split_plan;
        process.stdout.write('\n');
        process.stdout.write('Era split (separate commit, before release commit):\n');
        process.stdout.write(`  · archive   → ${path.relative(REPO_ROOT, sp.archive_path)}\n`);
        process.stdout.write(`  · old era   → pre-${sp.boundary} (archived pointer)\n`);
        process.stdout.write(`  · new era   → ${sp.new_era_label} — current (empty body)\n`);
        process.stdout.write(`  · subject   → ${sp.commit_subject}\n`);
    }
    process.stdout.write('\n');
    process.stdout.write('Changelog section:\n');
    process.stdout.write('─'.repeat(72) + '\n');
    process.stdout.write(_rstrip(plan.changelog_entry) + '\n');
    process.stdout.write('─'.repeat(72) + '\n');
    process.stdout.write('\n');
    process.stdout.write('Release-PR CI shape (docs/contracts/release-pr-gating.md):\n');
    process.stdout.write(
        '  will run: Consistency · Smoke Contracts · Migration Dry-Run · ' +
            'Release Validation · Release Guard (post-tag, ~30 s)\n',
    );
    process.stdout.write(
        '  will skip: Tests (install / aux / python / node / windows-lockfile-export) · ' +
            'Public Install Smoke — heavy install matrices cannot be regressed by a release-shape diff\n',
    );
    process.stdout.write('\n');
}

function confirm(prompt: string): boolean {
    const ans = _input(`${prompt} [y/N] `).trim().toLowerCase();
    return ans === 'y' || ans === 'yes';
}

/** Can we prompt at all — is fd 0 a TTY, or is a controlling terminal openable? */
function _canPrompt(): boolean {
    if (process.env.CI) return false; // CI is non-interactive by contract → require --yes
    if (process.stdin.isTTY) return true;
    try {
        const fd = fs.openSync('/dev/tty', 'r');
        fs.closeSync(fd);
        return true;
    } catch {
        return false;
    }
}

/**
 * Mirror of Python `input(prompt)` — write prompt, read one line.
 *
 * Reads from the controlling terminal (`/dev/tty`) when fd 0 is not itself a
 * TTY. `task release` / `./scripts-run` spawn this script with stdin detached
 * from the terminal, so a naive `readSync(0)` hits EOF immediately and the
 * `[y/N]` prompt "auto-aborts" without ever waiting. Falling back to `/dev/tty`
 * keeps the prompt interactive regardless of how the script is invoked.
 */
function _input(prompt: string): string {
    process.stdout.write(prompt);
    let fd = 0;
    let openedTty = false;
    if (!process.stdin.isTTY) {
        try {
            fd = fs.openSync('/dev/tty', 'r');
            openedTty = true;
        } catch {
            return ''; // no controlling terminal (true non-interactive); guarded by _canPrompt upstream.
        }
    }
    try {
        const buf = Buffer.alloc(1);
        const chars: number[] = [];
        while (true) {
            let bytesRead: number;
            try {
                bytesRead = fs.readSync(fd, buf, 0, 1, null);
            } catch {
                break; // EOF / error → EOFError analogue; return what we have.
            }
            if (bytesRead === 0) break;
            const b = buf[0] as number;
            if (b === 0x0a) break; // newline terminates the line (stripped, like input()).
            chars.push(b);
        }
        return Buffer.from(chars).toString('utf-8');
    } finally {
        if (openedTty) fs.closeSync(fd);
    }
}

export interface ConfirmVerdict {
    proceed: boolean;
    /** Message to surface when not proceeding (no trailing newline). */
    message?: string;
    stream?: 'stdout' | 'stderr';
}

/**
 * Resolve the pre-execute confirmation as a pure verdict (no I/O, so it is
 * unit-testable). `--yes` proceeds unprompted; otherwise a terminal must be
 * available — when none is (CI, detached stdin) we surface actionable `--yes`
 * guidance instead of silently aborting; with a terminal, the user must answer
 * `y`. The caller performs the I/O + the `return 1`.
 */
export function confirmGate(target: string, yes: boolean): ConfirmVerdict {
    if (yes) return { proceed: true };
    if (!_canPrompt()) {
        return {
            proceed: false,
            stream: 'stderr',
            message:
                'No terminal available for the [y/N] confirmation (non-interactive shell). ' +
                'Re-run with --yes to confirm, e.g. `task release -- --yes`.',
        };
    }
    if (!confirm(`Proceed with release ${target}?`)) {
        return { proceed: false, stream: 'stdout', message: 'aborted.' };
    }
    return { proceed: true };
}

// ─── orchestration ────────────────────────────────────────────────────────────

function _step(n: number, total: number, msg: string): void {
    process.stdout.write(`[${n}/${total}] ${msg}\n`);
}

function execute(
    plan: Plan,
    opts: { wait_for_checks: boolean; dry_run: boolean; resume?: boolean },
): void {
    const wait_for_checks = opts.wait_for_checks;
    const dry_run = opts.dry_run;
    const resume = opts.resume ?? false;

    const branch = `release/${plan.target}`;
    const total = 10;

    if (dry_run) {
        process.stdout.write('(dry-run) no git/gh mutations will be performed.\n');
        return;
    }

    // Probe the world once at the top so each step skip-decision is cheap.
    const pr_info = resume ? _pr_for_branch(branch) : null;
    const pr_state = pr_info ? pr_info['state'] : undefined;
    const pr_merged = pr_state === 'MERGED';

    // ─── 1. branch ──────────────────────────────────────────────────────────
    if (pr_merged) {
        _step(1, total, `PR for ${branch} already merged — staying on ${MAIN_BRANCH}`);
        if (git(['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true }) !== MAIN_BRANCH) {
            run(['git', 'checkout', MAIN_BRANCH]);
        }
        run(['git', 'pull', '--ff-only', REMOTE, MAIN_BRANCH]);
    } else if (resume && _branch_exists_local(branch)) {
        _step(1, total, `Branch ${branch} exists locally — checkout`);
        run(['git', 'checkout', branch]);
    } else if (resume && _branch_exists_remote(branch)) {
        _step(1, total, `Branch ${branch} exists on ${REMOTE} — fetch + checkout`);
        run(['git', 'fetch', REMOTE, branch]);
        run(['git', 'checkout', '-b', branch, `${REMOTE}/${branch}`]);
    } else {
        _step(1, total, `Create branch ${branch}`);
        run(['git', 'checkout', '-b', branch]);
    }

    // ─── 1b. era split (optional, separate commit) ─────────────────────────
    // Lands as `chore(changelog): split era ...` BEFORE the release commit
    // so the split is reviewable on its own and the release commit only
    // touches the bump + new entry. Idempotent: archive already on disk
    // OR a prior split commit on the branch is treated as already done.
    if (plan.split_plan !== null && !pr_merged) {
        const sp = plan.split_plan;
        const split_already_committed = git(['log', `${MAIN_BRANCH}..HEAD`, '--format=%s'], {
            capture: true,
        })
            .split('\n')
            .includes(sp.commit_subject);
        if (fs.existsSync(sp.archive_path) && split_already_committed) {
            _step(1, total, `Era split for pre-${sp.boundary} already committed — skip`);
        } else if (fs.existsSync(sp.archive_path) && !split_already_committed) {
            die(
                `era archive ${path.relative(REPO_ROOT, sp.archive_path)} exists ` +
                    'but no matching split commit found on this branch — inspect ' +
                    'manually before resuming',
            );
        } else {
            _step(
                1,
                total,
                `Split era ${sp.old_era_label} → pre-${sp.boundary} ` +
                    `(new era ${sp.new_era_label})`,
            );
            perform_split(sp);
            run(['git', 'add', '-A']);
            run(['git', 'commit', '-m', sp.commit_subject]);
        }
    }

    // ─── 2. file mutations ──────────────────────────────────────────────────
    if (pr_merged) {
        _step(2, total, 'PR already merged — skip file bumps');
    } else {
        const current_pkg = (
            JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8')) as Record<string, unknown>
        )['version'];
        if (resume && current_pkg === plan.target) {
            _step(2, total, `Files already at ${plan.target} — skip bump`);
        } else {
            _step(2, total, 'Bump package.json + marketplace.json, prepend CHANGELOG');
            set_package_version(PACKAGE_JSON, plan.target);
            set_marketplace_version(MARKETPLACE_JSON, plan.target);
            prepend_changelog(CHANGELOG, plan.changelog_entry);
        }

        // Regenerate derived files (pack manifests, dist/agent-src/, tool
        // projections) so the PR's own consistency check passes. Without
        // this the bump only lands in package.json + marketplace.json and
        // the Sync + Generate Tools Consistency gate fails on the release
        // PR itself — exactly the failure mode PR #226 hit. `task
        // release-prepare` is idempotent, so resume runs are safe.
        _step(2, total, 'Regenerate derived files (`task release-prepare`)');
        run(['task', 'release-prepare']);
    }

    // ─── 3. commit ──────────────────────────────────────────────────────────
    if (pr_merged) {
        _step(3, total, 'PR already merged — skip commit');
    } else {
        const last_msg = git(['log', '-1', '--format=%s'], { capture: true });
        const porcelain = git(['status', '--porcelain'], { capture: true });
        if (resume && last_msg === `release: ${plan.target}` && !porcelain) {
            _step(3, total, `Last commit already \`release: ${plan.target}\` and tree clean — skip`);
        } else {
            // `git add -A` stages the three primary bump files AND every
            // regenerated derived file (src/packs/*/pack.yaml + README.md,
            // dist/agent-src/, .augment/, tool projections). Listing them
            // explicitly would silently drift the moment a new generated
            // tree is added.
            run(['git', 'add', '-A']);
            // On resume the bump + era-split may already be committed (the
            // era-split lands its own commit, so `last_msg` above no longer
            // equals "release: X" and the skip guard misses). If nothing is
            // staged, the release content is already in history — skipping
            // beats failing `git commit` on an empty index.
            if (git(['diff', '--cached', '--name-only'], { capture: true }).trim()) {
                _step(3, total, `Commit \`release: ${plan.target}\``);
                run(['git', 'commit', '-m', `release: ${plan.target}`]);
            } else {
                _step(3, total, 'Release content already committed — skip empty commit');
            }
        }
    }

    // ─── 4. push ────────────────────────────────────────────────────────────
    if (pr_merged) {
        _step(4, total, 'PR already merged — skip push');
    } else {
        // `git push -u` is naturally idempotent — it prints "Everything
        // up-to-date" when remote already matches. No probe needed.
        _step(4, total, `Push ${branch} to ${REMOTE}`);
        run(['git', 'push', '-u', REMOTE, branch]);
    }

    // ─── 5. PR ──────────────────────────────────────────────────────────────
    if (pr_merged) {
        _step(5, total, `PR #${pr_info!['number']} already merged — skip`);
    } else if (resume && pr_state === 'OPEN') {
        _step(5, total, `PR already open: ${pr_info!['url']}`);
    } else {
        _step(5, total, 'Open pull request');
        const pr_changelog = _cap_body(
            plan.changelog_body,
            GH_PR_BODY_LIMIT - 200, // leave room for the prefix + footer
            '`CHANGELOG.md` in this PR',
        );
        const pr_body =
            `Release ${plan.target}.\n\n` +
            `${pr_changelog}\n\n` +
            'Created by `scripts/release.py`.';
        run([
            'gh',
            'pr',
            'create',
            '--base',
            MAIN_BRANCH,
            '--head',
            branch,
            '--title',
            `release: ${plan.target}`,
            '--body',
            pr_body,
        ]);
    }

    // ─── 6. wait for checks ─────────────────────────────────────────────────
    if (pr_merged) {
        _step(6, total, 'PR already merged — skip checks wait');
    } else if (wait_for_checks) {
        _step(6, total, 'Wait for PR checks');
        watch_pr_checks();
    } else {
        _step(6, total, 'Skip waiting for checks (--no-wait)');
    }

    // ─── 7. merge ───────────────────────────────────────────────────────────
    if (pr_merged) {
        _step(7, total, `PR #${pr_info!['number']} already merged — skip`);
    } else {
        _step(7, total, 'Merge pull request (merge commit) and delete branch');
        run(['gh', 'pr', 'merge', '--merge', '--delete-branch']);
    }

    // ─── 8. tag main + push tag ─────────────────────────────────────────────
    // Always idempotent — even outside resume mode this prevents a mid-flight
    // crash on step 9 from leaving a half-tagged release that subsequent
    // `task release` invocations can't recover from without `--resume`.
    if (git(['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true }) !== MAIN_BRANCH) {
        run(['git', 'checkout', MAIN_BRANCH]);
    }
    run(['git', 'pull', '--ff-only', REMOTE, MAIN_BRANCH]);

    if (_tag_exists_local(plan.target)) {
        if (_tag_exists_remote(plan.target)) {
            _step(8, total, `Tag ${plan.target} already on ${REMOTE} — skip`);
        } else {
            _step(8, total, `Tag ${plan.target} exists locally — push only`);
            run(['git', 'push', REMOTE, plan.target]);
        }
    } else {
        _step(8, total, `Tag merge commit and push ${plan.target}`);
        run(['git', 'tag', plan.target]);
        run(['git', 'push', REMOTE, plan.target]);
    }

    // ─── 9. GitHub Release ──────────────────────────────────────────────────
    if (_release_exists(plan.target)) {
        _step(9, total, `GitHub Release ${plan.target} already exists — skip`);
    } else {
        _step(9, total, 'Create GitHub Release (triggers publish-npm on the tag)');
        const notes = _cap_body(
            plan.changelog_body || `Release ${plan.target}`,
            GH_RELEASE_NOTES_LIMIT,
            '`CHANGELOG.md`',
        );
        run([
            'gh',
            'release',
            'create',
            plan.target,
            '--title',
            plan.target,
            '--notes',
            notes,
        ]);
    }

    // ─── 10. delete the merged release branch (local + remote) ───────────────
    // Branch hygiene: a merged-but-undeleted release/X.Y.Z is what made
    // `--resume` mis-detect an old version. Delete it now so it can never
    // accumulate. Idempotent — skips whatever is already gone. Never touches
    // `main` or any tag.
    if (dry_run) {
        _step(10, total, `Would delete merged branch ${branch} (local + remote)`);
    } else {
        const deleted: string[] = [];
        if (
            _branch_exists_local(branch) &&
            git(['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true }) !== branch
        ) {
            run(['git', 'branch', '-D', branch], { check: false });
            deleted.push('local');
        }
        if (_branch_exists_remote(branch)) {
            run(['git', 'push', REMOTE, '--delete', branch], { check: false });
            deleted.push('remote');
        }
        const where = deleted.length > 0 ? deleted.join(' + ') : 'already gone';
        _step(10, total, `Delete merged branch ${branch} (${where})`);
    }

    process.stdout.write('\n');
    process.stdout.write(`✅  Released ${plan.target}\n`);
    process.stdout.write(`   https://github.com/${REPO_SLUG}/releases/tag/${plan.target}\n`);
    process.stdout.write('   npm publish runs asynchronously via publish-npm.yml on the tag.\n');
}

// ─── entrypoint ───────────────────────────────────────────────────────────────

/** Mirror of `argparse.Namespace` for this CLI. */
interface Args {
    bump_override: string | null;
    explicit: string | null;
    yes: boolean;
    dry_run: boolean;
    no_wait: boolean;
    resume: boolean;
}

const PROG = 'release.py';
// Verbatim argparse usage block (captured shape). The argparse `--help` BODY
// (per-flag descriptions) is a documented divergence — argparse re-wraps it to
// the live terminal width; the tests assert the `usage:` token + exit code,
// not the body prose.
const USAGE =
    `usage: ${PROG} [-h] [--as {major,minor,patch}] [--version EXPLICIT] [--yes]\n` +
    '                  [--dry-run] [--no-wait] [--resume]\n';

function _argError(msg: string): never {
    process.stderr.write(USAGE);
    process.stderr.write(`${PROG}: error: ${msg}\n`);
    throw new ArgparseExit(2);
}

function _parse_args(argv: readonly string[]): Args {
    const args: Args = {
        bump_override: null,
        explicit: null,
        yes: false,
        dry_run: false,
        no_wait: false,
        resume: false,
    };

    const positionals: string[] = [];
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            // argparse prints the full help to stdout; we emit the usage block
            // (the body is COLUMNS-dependent — documented divergence).
            process.stdout.write(USAGE);
            throw new ArgparseExit(0);
        }

        // --flag=value form.
        const eq = a.startsWith('--') ? a.indexOf('=') : -1;
        const flag = eq >= 0 ? a.slice(0, eq) : a;
        const inlineVal = eq >= 0 ? a.slice(eq + 1) : null;

        if (flag === '--as') {
            let value: string;
            if (inlineVal !== null) {
                value = inlineVal;
            } else {
                if (i + 1 >= argv.length) _argError('argument --as: expected one argument');
                value = argv[i + 1] as string;
                i += 1;
            }
            if (!['major', 'minor', 'patch'].includes(value)) {
                _argError(
                    `argument --as: invalid choice: '${value}' ` +
                        "(choose from 'major', 'minor', 'patch')",
                );
            }
            args.bump_override = value;
            i += 1;
            continue;
        }
        if (flag === '--version') {
            let value: string;
            if (inlineVal !== null) {
                value = inlineVal;
            } else {
                if (i + 1 >= argv.length) _argError('argument --version: expected one argument');
                value = argv[i + 1] as string;
                i += 1;
            }
            args.explicit = value;
            i += 1;
            continue;
        }
        if (flag === '--yes' || a === '-y') {
            if (inlineVal !== null) _argError(`argument --yes/-y: ignored explicit argument '${inlineVal}'`);
            args.yes = true;
            i += 1;
            continue;
        }
        if (flag === '--dry-run') {
            if (inlineVal !== null) _argError(`argument --dry-run: ignored explicit argument '${inlineVal}'`);
            args.dry_run = true;
            i += 1;
            continue;
        }
        if (flag === '--no-wait') {
            if (inlineVal !== null) _argError(`argument --no-wait: ignored explicit argument '${inlineVal}'`);
            args.no_wait = true;
            i += 1;
            continue;
        }
        if (flag === '--resume') {
            if (inlineVal !== null) _argError(`argument --resume: ignored explicit argument '${inlineVal}'`);
            args.resume = true;
            i += 1;
            continue;
        }
        if (a.startsWith('-') && a !== '-') {
            _argError(`unrecognized arguments: ${a}`);
        }
        positionals.push(a);
        i += 1;
    }
    if (positionals.length > 0) {
        _argError(`unrecognized arguments: ${positionals.join(' ')}`);
    }
    return args;
}

/** Override wins; otherwise auto-detect from commits (or 'patch' if empty). */
function resolve_bump(override: string | null, commits: readonly Commit[]): string {
    if (override) {
        return override;
    }
    return infer_bump(commits);
}

const _RELEASE_BRANCH_RE = /^release\/(\d+\.\d+\.\d+)$/;

/**
 * Find the in-flight release target — the SOURCE OF TRUTH is package.json.
 *
 * An "in-flight" release is one whose version was already bumped into `main`'s
 * `package.json` (and possibly merged) but whose tag has not yet been pushed —
 * i.e. the publish step never completed. The canonical anchor is therefore
 * `package.json` version `V` **with no matching tag `V`**, NOT the set of
 * `release/X.Y.Z` branches.
 *
 * Why not the branch set: merged release branches are frequently left
 * undeleted on the remote, so "highest existing release/* branch" can resolve
 * to an OLD, already-published version (e.g. picking 5.4.0 while 5.8.0 is the
 * real in-flight target) and tag a downgrade. The package.json version cannot
 * lie that way — it is the version main currently claims to be, and an
 * untagged claim is exactly an incomplete release.
 *
 * Resolution order:
 *   1. If HEAD is on a `release/X.Y.Z` branch, that explicit checkout wins.
 *   2. Else: read `package.json` version `V`. If tag `V` does not exist
 *      (local or remote), `V` is the in-flight target. If it is already
 *      tagged, the release is complete → return null (regular bump path).
 *
 * Stale `release/*` branches are never used for version detection.
 */
function _detect_in_flight_target(): string | null {
    const head = git(['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true });
    const m = _RELEASE_BRANCH_RE.exec(head);
    if (m) {
        return m[1] as string;
    }

    let version: string;
    try {
        const data = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8')) as Record<string, unknown>;
        if (!('version' in data)) {
            return null; // KeyError analogue.
        }
        version = data['version'] as string;
    } catch {
        return null; // OSError / JSONDecodeError analogue.
    }
    try {
        parse_version(version);
    } catch {
        return null;
    }

    // An already-tagged version is a completed release, not in-flight.
    if (_tag_exists_local(version) || _tag_exists_remote(version)) {
        return null;
    }
    return version;
}

function main(argv: readonly string[] | null = null): number {
    const args = _parse_args(argv === null ? process.argv.slice(2) : argv);

    const current = (
        JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8')) as Record<string, unknown>
    )['version'] as string;
    parse_version(current);

    const prev = latest_tag();
    const commits = commits_since(prev);
    const bump = resolve_bump(args.bump_override, commits);

    // Resume mode: prefer an existing `release/X.Y.Z` over computed bump,
    // so we don't accidentally start a 1.16.0 release while 1.15.0 is
    // still in flight. Explicit --version still wins.
    const in_flight = args.resume ? _detect_in_flight_target() : null;
    let target: string;
    if (args.explicit) {
        target = args.explicit;
    } else if (in_flight) {
        target = in_flight;
        process.stdout.write(
            `(resume) in-flight target ${in_flight} (package.json version with no tag yet)\n`,
        );
    } else {
        target = bump_version(current, bump);
    }
    parse_version(target);

    if (!args.dry_run) {
        preflight(target, { resume: args.resume });
    }

    const today = todayIso();
    const test_trend_line = _render_test_trend_line(prev);
    const [full, body] = render_changelog_entry(target, prev, commits, today, {
        test_trend_line,
    });

    // Era-split planning: only crosses the gate when the current era body
    // has grown past the drift cap AND the release crosses a minor/major
    // boundary. Patch overflow is caught by the drift test (red CI), not
    // by an auto-split into a nonsensical "pre-X.Y.Z" archive.
    let split: SplitPlan | null = null;
    const body_size = current_era_body_size();
    if (body_size > CURRENT_ERA_BODY_CAP) {
        const candidate = plan_split(target);
        if (candidate === null) {
            die(
                `current era body is ${body_size} lines (cap ` +
                    `${CURRENT_ERA_BODY_CAP}) but release ${target} is a patch ` +
                    `within the same era — split needs a minor/major bump. ` +
                    'Cut a minor release or split CHANGELOG.md manually first.',
            );
        }
        split = candidate;
    }

    const plan = new Plan(current, target, bump, commits, prev, body, full, split);
    print_preview(plan);
    if (args.resume) {
        process.stdout.write('(resume) probing existing state — completed steps will be skipped.\n');
    }

    if (args.dry_run) {
        return 0;
    }

    const verdict = confirmGate(plan.target, args.yes);
    if (!verdict.proceed) {
        if (verdict.message) {
            const sink = verdict.stream === 'stderr' ? process.stderr : process.stdout;
            sink.write(`${verdict.message}\n`);
        }
        return 1;
    }

    execute(plan, {
        wait_for_checks: !args.no_wait,
        dry_run: false,
        resume: args.resume,
    });
    return 0;
}

// ─── CLI entry (release.py:1090-1091 `raise SystemExit(main())`) ──────────────

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        // main() can return an int directly OR throw SystemExitError via die();
        // both flow into process.exitCode. CalledProcessError is intentionally
        // NOT caught here, so it propagates (non-zero + traceback), matching the
        // Python original letting subprocess.CalledProcessError raise.
        process.exitCode = main(process.argv.slice(2));
    } catch (e) {
        if (e instanceof SystemExitError || e instanceof ArgparseExit) {
            process.exitCode = e.code;
        } else {
            throw e;
        }
    }
}

export {
    main,
    _parse_args,
    parse_version,
    bump_version,
    commits_since,
    infer_bump,
    render_changelog_entry,
    _changelog_line,
    _cap_body,
    prepend_changelog,
    set_package_version,
    set_marketplace_version,
    resolve_bump,
    _detect_in_flight_target,
    print_preview,
    latest_tag,
    _render_test_trend_line,
    _previous_test_count_from_changelog,
    Commit,
    Plan,
    SystemExitError,
    ArgparseExit,
    CalledProcessError,
    die,
    BREAKING_RE,
    CONVENTIONAL_RE,
    SEMVER_RE,
    _RELEASE_BRANCH_RE,
    MODULE_DOC_FIRST_LINE,
};
export type { Args };

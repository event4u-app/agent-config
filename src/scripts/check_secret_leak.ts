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

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
import { runSelfTest } from './_lib/gate_self_test.js';
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
    // R2 review-input packages: a VERBATIM copy of the branch diff, written by
    // `dispatch_r2_reviewer`. Every byte in it already exists in the branch and
    // is scanned at its own path under its own exclusions, so scanning the copy
    // adds no coverage — and it DEFEATS the two carve-outs above by
    // construction: a secret-shaped string that is legal in a test fixture gets
    // laundered into a scanned path the moment a completion review runs. That
    // is not hypothetical; it red this gate on the PR that added this line.
    // What the exclusion cannot lose: content present only in the copy and
    // nowhere else in the branch. The package is machine-generated from
    // `git diff` and cannot invent content, and `--verify-current` re-derives
    // its hashes, so a hand-edit is detectable rather than silent.
    /(^|\/)[^/]+\.review-input(\/|$)/,
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

/** `dist/` — excluded everywhere EXCEPT the pack scope. See `isExcluded`. */
const DIST_EXCLUDE: RegExp = /(^|\/)dist(\/|$)/;

function isExcluded(rel: string, mode: Mode = 'diff'): boolean {
    return DEFAULT_EXCLUDE.some((rx) => {
        // The `dist/` exclusion is the SECOND reason this gate could not see
        // what ships, and it fires regardless of mode. Mode enumeration was the
        // first: every git-backed mode walks the git tree, and `dist/cli/**` is
        // gitignored while `dist/` is a `files[]` root. Adding the pack scope
        // alone fixed nothing measurable — the payload resolved and then this
        // filter threw away exactly the paths the scope exists to reach.
        // Verified: a key-shaped string planted at `dist/zzcanary/leak.txt`
        // (`git check-ignore -v` names `.gitignore:206`, and `npm pack` ships
        // it) was missed by the new mode until this branch existed.
        //
        // Kept for every OTHER mode, because there the exclusion is right:
        // `dist/` is a byte-for-byte projection of `src/`, which is scanned at
        // its own path, so scanning the copy adds no coverage. In the pack scope
        // the question is different — not "is this content somewhere else in the
        // repo" but "does this content SHIP" — and for an untracked shipped path
        // there is no other path to have scanned it at.
        //
        // The cost is a duplicate finding for a TRACKED dist file. That is not a
        // false positive: a projection is byte-identical to its source, so a
        // finding there is a finding in `src/` too.
        if (mode === 'pack' && rx.source === DIST_EXCLUDE.source) return false;
        return rx.test(rel);
    });
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

export type Mode = 'diff' | 'all' | 'explicit' | 'pack';

/**
 * `pack` exists because the other three cannot see a large part of what ships.
 *
 * Every one of them enumerates the GIT tree — `git diff`, `git ls-files`, or an
 * explicit path list a caller derived from one. `dist/` is a `files[]` root and
 * `dist/cli/**` is gitignored (`.gitignore:206` is `/dist/*`, and
 * `git check-ignore -v dist/cli/agent-config.js` names that line), so those
 * paths are shipped and untracked at the same time and this gate could not
 * reach them **by construction** — not by misconfiguration.
 *
 * Additive on purpose: no existing caller changes behaviour, and the three
 * git-backed modes are untouched.
 */
export function packPayloadFiles(root: string): string[] {
    const out = spawnSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], {
        cwd: root,
        encoding: 'utf-8',
        maxBuffer: 64 * 1024 * 1024,
    });
    if (out.status !== 0 || typeof out.stdout !== 'string') {
        // Returning [] would hand the scope assertion an empty set, which it
        // already treats as a gate that could not run — the right verdict, and
        // reached without inventing a second failure path.
        return [];
    }
    const i = out.stdout.indexOf('[');
    if (i < 0) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(out.stdout.slice(i));
    } catch {
        return [];
    }
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    const first = parsed[0] as { files?: { path?: unknown }[] };
    const files = Array.isArray(first.files) ? first.files : [];
    return files
        .map((f) => (typeof f.path === 'string' ? f.path : ''))
        .filter((pth) => pth !== '');
}

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
    if (mode === 'pack') {
        return packPayloadFiles(root);
    }
    const base = opts.base ?? 'origin/main';
    // An unresolvable base is a scan of NOTHING, not a clean scan.
    //
    // `git diff <missing-ref>` yields no lines, so the changed-set silently
    // became empty and the gate reported "no high-confidence secret found in the
    // tracked tree" while examining zero files. That is the shape a shallow CI
    // checkout produces by default — verified: with an unresolvable base this
    // function returned 0 paths. A secret gate that passes green on an empty
    // scan is worse than no gate, because it is believed.
    const probe = spawnSync('git', ['-C', root, 'rev-parse', '--verify', '--quiet', `${base}^{commit}`], {
        encoding: 'utf-8',
    });
    if ((probe.status ?? 1) !== 0) {
        throw new Error(
            `check_secret_leak: baseline ref '${base}' does not resolve, so the changed-set would be empty ` +
                `and the scan would examine no files. Fetch the branch (CI: actions/checkout with fetch-depth: 0), ` +
                `pass --base <ref>, or use --all to scan the whole tracked tree.`,
        );
    }
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
        if (applyExcludes && isExcluded(rel, mode)) {
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
    pack: boolean;
    base: string | undefined;
    paths: string[];
}

function parseArgs(argv: readonly string[]): Args {
    const paths: string[] = [];
    let json = false;
    let all = false;
    let pack = false;
    let base: string | undefined;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--json') {
            json = true;
        } else if (a === '--all') {
            all = true;
        } else if (a === '--pack') {
            pack = true;
        } else if (a === '--base') {
            base = argv[++i];
        } else if (a === '-h' || a === '--help') {
            _stdout(
                'usage: check_secret_leak [paths...] [--all] [--pack] [--base <ref>] [--json]\n' +
                    '  default → scans files changed vs origin/main + untracked (shift-left).\n' +
                    '  --all   → scans the whole tracked tree.\n' +
                    '  --pack  → scans the npm pack payload, INCLUDING shipped-but-gitignored\n' +
                    '            paths the three git-backed modes cannot reach.\n' +
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
    return { json, all, pack, base, paths };
}

function _stdout(s: string): void {
    process.stdout.write(s);
}
function _stderr(s: string): void {
    process.stderr.write(s);
}

/**
 * Discrimination, over the one property this branch added.
 *
 * The pack scope's whole value is that it reaches paths the git-backed modes
 * cannot, and it was measurably INERT when first written: the mode resolved the
 * payload and `DEFAULT_EXCLUDE`'s `dist/` rule then filtered away exactly those
 * paths. A self-test over `isExcluded` is therefore not a formality here — it
 * pins the difference between the mode working and the mode existing.
 *
 * Deliberately over the pure predicate rather than over a spawned `npm pack`:
 * the canary in `gate-coverage.yml` already drives the real binary end to end
 * with a real plant, and duplicating that here would add a pack run per case
 * for no additional evidence.
 */
function selfTest(): number {
    return runSelfTest({
        gate: 'check_secret_leak',
        minCases: 7,
        minRejectCases: 3,
        cases: [
            {
                name: 'pack scope does NOT exclude dist/ — the blind spot it exists for',
                expect: 'reject',
                run: () => (isExcluded('dist/cli/agent-config.js', 'pack') ? 0 : 1),
            },
            {
                name: 'diff scope DOES exclude dist/ — a projection scanned at its source',
                expect: 'accept',
                run: () => (isExcluded('dist/cli/agent-config.js', 'diff') ? 0 : 1),
            },
            {
                name: 'all scope also still excludes dist/ — untouched by this change',
                expect: 'accept',
                run: () => (isExcluded('dist/agent-src/rules/x.md', 'all') ? 0 : 1),
            },
            {
                // The exclusion carve-out is `dist/` ONLY. If it leaked into the
                // other rules the pack scope would start reading test fixtures,
                // which legitimately hold secret-shaped strings.
                name: 'pack scope still excludes tests/ — the carve-out is dist-only',
                expect: 'accept',
                run: () => (isExcluded('tests/fixtures/x.txt', 'pack') ? 0 : 1),
            },
            {
                name: 'pack scope still excludes node_modules/',
                expect: 'accept',
                run: () => (isExcluded('node_modules/x/index.js', 'pack') ? 0 : 1),
            },
            {
                name: 'pack scope reaches a second dist subtree, not just dist/cli',
                expect: 'reject',
                run: () => (isExcluded('dist/hooks/dispatch.js', 'pack') ? 0 : 1),
            },
            {
                name: 'a shipped non-dist path is scanned in every mode',
                expect: 'reject',
                run: () => (isExcluded('src/scripts/x.ts', 'pack') || isExcluded('src/scripts/x.ts', 'diff') ? 0 : 1),
            },
        ],
    });
}

export function main(argv?: readonly string[]): number {
    const rawArgv = argv ?? process.argv.slice(2);
    if (rawArgv.includes('--self-test')) return selfTest();
    const args = parseArgs(rawArgv);
    const mode: Mode = args.pack ? 'pack' : args.paths.length > 0 ? 'explicit' : args.all ? 'all' : 'diff';

    // Scope assertion, deliberately here and not inside `scanRepo`: that export
    // is called directly by tests and other callers against arbitrary roots, and
    // a secret gate is the last place to widen a throw. The cost is one extra
    // `resolveFiles` (a `git ls-files` / `git diff`); the file reads are not
    // repeated. Assert the RESOLVED set, before the exclude/binary filters —
    // those legitimately drop everything (a diff touching only `tests/`), so
    // filtering to zero is not the same signal as resolving to zero.
    // Exit 2 (usage/env) over 1 (leak found) — a dead scope means the gate could
    // not run. `resolveFiles` already hard-throws on an unresolvable base, so
    // that case never arrives here as a quiet zero; a non-DeadScopeError is
    // re-thrown untouched to preserve it.
    try {
        const targets = resolveFiles(REPO_ROOT, mode, { explicit: args.paths, base: args.base });
        // The coverage register requires an enforced gate to report what it
        // inspected. Printed before the assertion so a dead scope still tells
        // the reader the number it died on, which is the one number that
        // distinguishes "resolved nothing" from "resolved and filtered".
        _stdout(`scanned: ${String(targets.length)}\n`);
        assertScanned({
            gate: 'check_secret_leak',
            scanned: targets.length,
            units: 'candidate file(s)',
            roots:
                mode === 'all'
                    ? ['git ls-files']
                    : mode === 'explicit'
                      ? ['<explicit path arguments>']
                      : mode === 'pack'
                        ? ['npm pack --dry-run --ignore-scripts payload (package.json files[])']
                        : [`git diff --name-only --diff-filter=ACMR ${args.base ?? 'origin/main'}`, 'git ls-files --others --exclude-standard'],
            // `all`, `explicit` and `pack` carry no reason: zero tracked files,
            // zero named paths, or an empty pack payload is blindness in a repo
            // that has content. `pack` inherits the strict path by omission
            // rather than by a new branch — an empty payload means a botched
            // `files[]` or a pack that resolved nothing, which is the loudest
            // possible signal and the opposite of a clean bill.
            ...(mode === 'diff'
                ? {
                      allowEmpty:
                          'EMPTY_VALID: shift-left mode scans what the change introduces, and a ' +
                          'branch identical to its base with no untracked files introduces nothing ' +
                          '— an absent question, not an empty corpus. Deletion test: wiping the ' +
                          'tracked tree would show up here as changed paths, and an unresolvable ' +
                          'base (the dangerous zero, which shallow CI produces) already throws in ' +
                          'resolveFiles above rather than reaching this line.',
                  }
                : {}),
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            _stderr(`❌  ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }

    const hits = scanRepo(REPO_ROOT, mode, { explicit: args.paths, base: args.base });

    if (args.json) {
        _stdout(JSON.stringify({ check: 'secret-leak', count: hits.length, hits }, null, 2) + '\n');
    } else if (hits.length === 0) {
        _stdout(
            `✅  check_secret_leak: no high-confidence secret found in ${mode === 'pack' ? 'the npm pack payload' : 'the tracked tree'}.\n`,
        );
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

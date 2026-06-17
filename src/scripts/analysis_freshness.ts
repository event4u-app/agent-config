#!/usr/bin/env tsx
/**
 * Project-analysis freshness loop — a cheap *heuristic* staleness signal.
 *
 * TypeScript twin of `src/scripts/analysis_freshness.py` (ADR-200,
 * Python→TypeScript migration). The CLI contract is mirrored EXACTLY — the
 * required mutually-exclusive group (`--stamp FILE | --stamp-all | --check FILE
 * | --check-all`), the argparse usage banner + error text (missing required
 * group → exit 2, conflicting args → exit 2, missing value → exit 2,
 * `-h`/`--help` → exit 0), the git probe (`git -C REPO_ROOT … check=False`,
 * stdout stripped), the freshness-header regex + path-token regex, the
 * staleness bands, `sorted(ANALYSIS_DIR.glob("*.md"))`, and byte-identical
 * stdout. snake_case kept.
 *
 * `project-analyzer` output under ``agents/evidence/analysis/*.md`` is rich but
 * has no signal for *"is this still current?"*. This script adds a one-line
 * freshness header and a probe that tells the agent whether a high-tier
 * re-analysis is likely worth it. File-first, no runtime.
 *
 * Header shape (top of each analysis file):
 *
 *     <!-- analyzed: 2026-06-15 | commit: 57588489 | files: 4 -->
 *
 * Usage:
 *   python3 src/scripts/analysis_freshness.py --stamp agents/evidence/analysis/foo.md
 *   python3 src/scripts/analysis_freshness.py --stamp-all
 *   python3 src/scripts/analysis_freshness.py --check agents/evidence/analysis/foo.md
 *   python3 src/scripts/analysis_freshness.py --check-all
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = path.resolve(fileURLToPath(import.meta.url));
// _HERE = Path(__file__).resolve().parent ; REPO_ROOT = _HERE.parent.parent
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
// Mutable binding so tests can sandbox the scan target (mirrors the pytest
// monkeypatch.setattr seam used by sibling lint twins).
let ANALYSIS_DIR = path.join(REPO_ROOT, 'agents', 'evidence', 'analysis');

function _setAnalysisDirForTest(p: string): void {
    ANALYSIS_DIR = p;
}

// _HEADER_RE = re.compile(
//   r"<!--\s*analyzed:\s*(?P<date>[\d-]+)\s*\|\s*commit:\s*(?P<commit>[0-9a-f]+)"
//   r"\s*\|\s*files:\s*(?P<files>\d+)\s*-->")
const _HEADER_RE =
    /<!--[\s]*analyzed:[\s]*(?<date>[\d-]+)[\s]*\|[\s]*commit:[\s]*(?<commit>[0-9a-f]+)[\s]*\|[\s]*files:[\s]*(?<files>\d+)[\s]*-->/;
// _PATH_RE = re.compile(r"`(?P<p>(?:src|docs|agents|scripts|tests)/[\w./-]+)`")
const _PATH_RE = /`(?<p>(?:src|docs|agents|scripts|tests)\/[\w./-]+)`/g;

// Heuristic staleness bands by count of changed files over the analyzed paths.
const _AGING = 1;
const _STALE = 8;

/**
 * subprocess.run(["git", "-C", REPO_ROOT, *args], capture_output=True,
 * text=True, check=False).stdout.strip()
 *
 * Python `str.strip()` removes leading + trailing whitespace; `text=True`
 * decodes stdout as UTF-8. On a non-zero exit, stdout is still returned
 * (check=False), and a failure to spawn yields "" (mirrors empty stdout).
 */
function _git(...args: string[]): string {
    const res = spawnSync('git', ['-C', REPO_ROOT, ...args], { encoding: 'utf8' });
    const out = res.stdout ?? '';
    return _pyStrip(out);
}

/** Python str.strip() — strips the ASCII + Unicode whitespace set Python uses. */
function _pyStrip(s: string): string {
    // Python str.strip() default whitespace: spaces, \t \n \r \v \f and a set
    // of Unicode whitespace. For git output the ASCII set is sufficient; mirror
    // \s plus the explicit C0 set Python treats as whitespace.
    return s.replace(/^[\s ]+/, '').replace(/[\s ]+$/, '');
}

function _head_short(): string {
    return _git('rev-parse', '--short', 'HEAD') || 'unknown';
}

/** Best-effort: repo paths the doc cites (deduped, existing only). */
function _referenced_paths(text: string): string[] {
    const seen: string[] = [];
    _PATH_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = _PATH_RE.exec(text)) !== null) {
        const p = m.groups?.p as string;
        if (!seen.includes(p) && _exists(path.join(REPO_ROOT, p))) {
            seen.push(p);
        }
    }
    return seen;
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function cmd_stamp(p: string): number {
    const text = fs.readFileSync(p, 'utf-8');
    const paths = _referenced_paths(text);
    // Backfill the analyzed date from the file's own last commit (honest for
    // retro-stamps); go-forward stamps land on today via a fresh re-stamp.
    const date = _git('log', '-1', '--format=%cs', '--', p) || _git('log', '-1', '--format=%cs');
    const header = `<!-- analyzed: ${date} | commit: ${_head_short()} | files: ${paths.length} -->`;
    const body = _HEADER_RE.test(text)
        ? _lstripNewlines(_subFirst(_HEADER_RE, text, ''))
        : text;
    fs.writeFileSync(p, header + '\n' + body, 'utf-8');
    process.stdout.write(`  stamped ${_relToRoot(p)} → ${header}\n`);
    return 0;
}

/** re.sub(pattern, "", text, count=1) — replace first match only. */
function _subFirst(re: RegExp, text: string, repl: string): string {
    const m = re.exec(text);
    if (!m) {
        return text;
    }
    return text.slice(0, m.index) + repl + text.slice(m.index + m[0].length);
}

/** str.lstrip("\n") — strip leading newlines only. */
function _lstripNewlines(s: string): string {
    return s.replace(/^\n+/, '');
}

function _relToRoot(p: string): string {
    return path.relative(REPO_ROOT, p).split(path.sep).join('/');
}

function cmd_check(p: string): number {
    const text = fs.readFileSync(p, 'utf-8');
    const m = _HEADER_RE.exec(text);
    if (!m) {
        process.stdout.write(`  ⚠️  ${_relToRoot(p)} — no freshness header (run --stamp)\n`);
        return 0;
    }
    const commit = m.groups?.commit as string;
    const paths = _referenced_paths(text);
    const scope = paths.length ? paths : ['.'];
    let changed = _git('diff', '--name-only', `${commit}..HEAD`, '--', ...scope).split('\n');
    changed = changed.filter((c) => _pyStrip(c) !== '');
    const n = changed.length;
    const band =
        n === 0 ? 'fresh' : n < _STALE ? 'aging' : 'STALE — re-analysis likely worth it';
    let verdict: string;
    if (n >= _AGING) {
        verdict = n >= _STALE ? `⚠️  ${band}` : `·  ${band}`;
    } else {
        verdict = '✅  fresh';
    }
    process.stdout.write(
        `  ${verdict} — ${_relToRoot(p)}: ${n} changed file(s) ` +
            `over ${scope.length} analyzed path(s) since ${commit}\n`,
    );
    return 0;
}

/** sorted(ANALYSIS_DIR.glob("*.md")). */
function _iter_analysis(): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(ANALYSIS_DIR, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const ent of entries) {
        // glob("*.md") matches files + dirs ending in .md, non-recursively.
        if (ent.name.endsWith('.md')) {
            out.push(path.join(ANALYSIS_DIR, ent.name));
        }
    }
    out.sort();
    return out;
}

// ---------------------------------------------------------------------------
// argparse-faithful CLI
// ---------------------------------------------------------------------------

const _PROG = 'analysis_freshness.py';
const _USAGE =
    `usage: ${_PROG} [-h]\n` +
    `                             (--stamp FILE | --stamp-all | --check FILE | --check-all)\n`;

interface Args {
    stamp: string | null;
    stamp_all: boolean;
    check: string | null;
    check_all: boolean;
}

class ArgError {
    constructor(public readonly code: number) {}
}

function _argError(msg: string): never {
    process.stderr.write(_USAGE + `${_PROG}: error: ${msg}\n`);
    throw new ArgError(2);
}

function _parseArgs(argv: readonly string[]): Args {
    // Mirror argparse's parse_args precedence for this parser:
    //   1. -h/--help  → print + exit 0 (fires immediately on encounter).
    //   2. missing value (--stamp / --check with no following token) → exit 2.
    //   3. mutex conflict (two group members) → exit 2 (during parse).
    //   4. required-group-not-satisfied → exit 2 (end of parse_known_args).
    //   5. unrecognized extras → exit 2 (after parse_known_args returns,
    //      only when 4 passed). Extras are collected, then reported together.
    let stamp: string | null = null;
    let stamp_all = false;
    let check: string | null = null;
    let check_all = false;
    let firstSeen: string | null = null;
    const extras: string[] = [];

    const conflict = (current: string): void => {
        if (firstSeen !== null && firstSeen !== current) {
            _argError(`argument ${current}: not allowed with argument ${firstSeen}`);
        }
        if (firstSeen === null) {
            firstSeen = current;
        }
    };

    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            // argparse prints full help (usage + description + options) and
            // exits 0. Tests do NOT byte-compare help prose; print the usage
            // banner (deterministic head) and exit 0.
            process.stdout.write(_USAGE);
            throw new ArgError(0);
        }
        if (a === '--stamp') {
            const v = argv[i + 1];
            if (v === undefined) {
                _argError('argument --stamp: expected one argument');
            }
            conflict('--stamp');
            stamp = v as string;
            i += 2;
            continue;
        }
        if (a === '--check') {
            const v = argv[i + 1];
            if (v === undefined) {
                _argError('argument --check: expected one argument');
            }
            conflict('--check');
            check = v as string;
            i += 2;
            continue;
        }
        if (a === '--stamp-all') {
            conflict('--stamp-all');
            stamp_all = true;
            i += 1;
            continue;
        }
        if (a === '--check-all') {
            conflict('--check-all');
            check_all = true;
            i += 1;
            continue;
        }
        // Unknown token: collect, defer error to after the required-group check.
        extras.push(a);
        i += 1;
    }

    // 4. Required mutex group must be satisfied (fires before the extras check).
    if (firstSeen === null) {
        _argError('one of the arguments --stamp --stamp-all --check --check-all is required');
    }

    // 5. Now report any unrecognized extras (group was satisfied).
    if (extras.length) {
        _argError(`unrecognized arguments: ${extras.join(' ')}`);
    }

    return { stamp, stamp_all, check, check_all };
}

function main(argv?: readonly string[]): number {
    let args: Args;
    try {
        args = _parseArgs(argv ?? process.argv.slice(2));
    } catch (exc) {
        if (exc instanceof ArgError) {
            return exc.code;
        }
        throw exc;
    }

    if (args.stamp !== null) {
        return cmd_stamp(args.stamp);
    }
    if (args.check !== null) {
        return cmd_check(args.check);
    }
    if (args.stamp_all) {
        for (const p of _iter_analysis()) {
            cmd_stamp(p);
        }
        return 0;
    }
    if (args.check_all) {
        for (const p of _iter_analysis()) {
            cmd_check(p);
        }
        return 0;
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}

export {
    REPO_ROOT,
    ANALYSIS_DIR,
    _setAnalysisDirForTest,
    cmd_stamp,
    cmd_check,
    main,
};

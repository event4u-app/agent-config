#!/usr/bin/env tsx
/**
 * Fail the build on leftover merge/stash conflict state.
 *
 * TypeScript twin of `src/scripts/check_no_conflict_markers.py` (ADR-096). The
 * CLI contract is mirrored EXACTLY — the `--quiet` flag (argparse, so
 * `-h`/`--help` exit 0 with a usage line, an unrecognized arg exits 2), exit
 * codes (0 = clean, 1 = conflicted index OR markers found, 2 = allowlist over
 * cap / usage error), the stdout/stderr split (success on stdout, findings on
 * stderr), byte-identical finding text (the `❌  check_no_conflict_markers: …`
 * lines + the `    <path>` indents + the `    → …` hint lines), the
 * `git ls-files -u` / `git ls-files` walks, the start/end/base marker regexes
 * (`re.match`, anchored), the `conflict-marker-check: ignore` per-line skip,
 * the allowlist load + cap, and the scanned-file count in the success line.
 *
 * Two signals, either of which fails:
 *
 * 1. **Unmerged index entries** (`git ls-files -u`) — a conflicted working
 *    tree (the exact state a botched `git stash pop` / merge / rebase leaves).
 *    Zero false positives.
 * 2. **Conflict markers in tracked files** — a file carrying both a
 *    `<<<<<<< ` line and a `>>>>>>> ` line (the diff2/diff3 conflict
 *    envelope), so a resolved-but-not-cleaned file can never be committed or
 *    merged silently.
 *
 * Why this exists: a `git stash pop` used as a throwaway probe conflicted on
 * stale generated files, its output was suppressed, and the conflicted state
 * went unnoticed until review (conflict-marker-guard, 2026-06-15).
 * A content/state guard makes that class structurally un-mergeable.
 *
 * Files that legitimately document conflict markers (the merge-conflict skill,
 * git-workflow docs) can be allowlisted in
 * `check_no_conflict_markers_allowlist.json` or carry a per-line
 * `conflict-marker-check: ignore` comment.
 *
 * Usage:
 *     node scripts/check_no_conflict_markers.ts
 *     node scripts/check_no_conflict_markers.ts --quiet
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// Path(__file__).resolve().parents[2] — repo root, two dirs up from src/scripts.
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
// Path(__file__).resolve().parent / "check_no_conflict_markers_allowlist.json"
const ALLOWLIST = path.join(path.dirname(_HERE), 'check_no_conflict_markers_allowlist.json');
const ALLOWLIST_CAP = 20;

// Python: re.compile(r"^<{7}( |$)") etc. — re.match anchors at start only.
const START_RE = /^<{7}( |$)/;
const END_RE = /^>{7}( |$)/;
const BASE_RE = /^\|{7}( |$)/;
const IGNORE = 'conflict-marker-check: ignore';

/** Thrown to mirror Python `raise SystemExit(2)` (int arg → exit 2, no extra msg). */
class ExitCode extends Error {
    code: number;
    constructor(code: number) {
        super(`exit ${code}`);
        this.code = code;
    }
}

function _git(args: readonly string[]): string {
    // subprocess.run(check=False) — never raises; returns stdout (empty on error).
    const res = spawnSync('git', [...args], {
        cwd: REPO,
        encoding: 'utf-8',
        maxBuffer: 256 * 1024 * 1024,
    });
    return res.stdout ?? '';
}

function load_allowlist(): Set<string> {
    if (!_isFile(ALLOWLIST)) {
        return new Set();
    }
    const data = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf-8')) as { files?: unknown };
    const entries = Array.isArray(data.files) ? (data.files as string[]) : [];
    if (entries.length > ALLOWLIST_CAP) {
        process.stderr.write(
            `❌  check_no_conflict_markers: allowlist has ${entries.length} entries ` +
                `(> ${ALLOWLIST_CAP}) — tighten the guard, do not grow the allowlist.\n`,
        );
        throw new ExitCode(2);
    }
    return new Set(entries);
}

function unmerged_paths(): string[] {
    const out = _git(['ls-files', '-u']);
    // sorted({line.split("\t", 1)[1] for line in out.splitlines() if "\t" in line})
    const seen = new Set<string>();
    for (const line of _splitlines(out)) {
        const tab = line.indexOf('\t');
        if (tab !== -1) {
            seen.add(line.slice(tab + 1));
        }
    }
    return [...seen].sort(_pyStrCmp);
}

function tracked_text_files(): string[] {
    return _splitlines(_git(['ls-files'])).filter((p) => p);
}

function scan_markers(allow: Set<string>): string[] {
    const hits: string[] = [];
    for (const rel of tracked_text_files()) {
        if (allow.has(rel)) {
            continue;
        }
        const p = path.join(REPO, rel);
        let text: string;
        try {
            // Python: read_text(encoding="utf-8") with the default errors="strict"
            // — raises UnicodeDecodeError on a binary / non-UTF-8 file, which the
            // except (UnicodeDecodeError, OSError) clause skips. TextDecoder with
            // fatal:true reproduces the strict-decode raise so the skip matches.
            const buf = fs.readFileSync(p);
            text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
        } catch {
            continue; // binary / unreadable — not a conflict-marker surface
        }
        let hasStart = false;
        let hasEnd = false;
        for (const line of _splitlines(text)) {
            if (line.includes(IGNORE)) {
                continue;
            }
            if (START_RE.test(line) || BASE_RE.test(line)) {
                hasStart = true;
            } else if (END_RE.test(line)) {
                hasEnd = true;
            }
        }
        if (hasStart && hasEnd) {
            hits.push(rel);
        }
    }
    return hits;
}

interface Args {
    quiet: boolean;
}

function parse_args(argv: readonly string[]): Args {
    let quiet = false;
    for (const arg of argv) {
        if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            // argparse prog = os.path.basename(sys.argv[0]) → the .py basename.
            process.stdout.write('usage: check_no_conflict_markers.py [-h] [--quiet]\n');
            throw new ExitCode(0);
        } else {
            process.stderr.write(
                'usage: check_no_conflict_markers.py [-h] [--quiet]\n' +
                    `check_no_conflict_markers.py: error: unrecognized arguments: ${arg}\n`,
            );
            throw new ExitCode(2);
        }
    }
    return { quiet };
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const allow = load_allowlist();
    const unmerged = unmerged_paths();
    const markerHits = scan_markers(allow);

    if (unmerged.length || markerHits.length) {
        if (unmerged.length) {
            process.stderr.write(
                '❌  check_no_conflict_markers: unmerged (conflicted) paths in the index:\n',
            );
            for (const p of unmerged) {
                process.stderr.write(`    ${p}\n`);
            }
            process.stderr.write(
                '    → resolve the conflict (`git checkout HEAD -- <file>` or finish the ' +
                    'merge), then re-stage.\n',
            );
        }
        if (markerHits.length) {
            process.stderr.write(
                '❌  check_no_conflict_markers: conflict markers in tracked files:\n',
            );
            for (const p of markerHits) {
                process.stderr.write(`    ${p}\n`);
            }
            process.stderr.write(
                '    → remove the <<<<<<< / ======= / >>>>>>> envelope, or allowlist a ' +
                    'doc that documents markers (capped at 20).\n',
            );
        }
        return 1;
    }

    if (!args.quiet) {
        process.stdout.write(
            `✅  check_no_conflict_markers: no conflicted index entries, no markers ` +
                `(${tracked_text_files().length} tracked files scanned).\n`,
        );
    }
    return 0;
}

// --- helpers --------------------------------------------------------------

/** Python `str.splitlines()` over the body (no trailing-empty element). */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    const lines: string[] = [];
    let current = '';
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i] as string;
        const code = text.charCodeAt(i);
        if (ch === '\r') {
            lines.push(current);
            current = '';
            if (text[i + 1] === '\n') {
                i += 1;
            }
            continue;
        }
        if (
            ch === '\n' ||
            code === 0x0b ||
            code === 0x0c ||
            code === 0x1c ||
            code === 0x1d ||
            code === 0x1e ||
            code === 0x85 ||
            code === 0x2028 ||
            code === 0x2029
        ) {
            lines.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    if (current !== '') {
        lines.push(current);
    }
    return lines;
}

/** Python-string ordering (codepoint), for `sorted(...)` parity. */
function _pyStrCmp(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
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
    ALLOWLIST,
    ALLOWLIST_CAP,
    main,
    parse_args,
    load_allowlist,
    unmerged_paths,
    tracked_text_files,
    scan_markers,
    ExitCode,
};

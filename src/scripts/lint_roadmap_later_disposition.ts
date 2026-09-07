#!/usr/bin/env tsx
/**
 * CI guard for the `later/` roadmap disposition.
 *
 * Ported from the retired Python `src/scripts/lint_roadmap_later_disposition.py` (ADR-200,
 * Python→TypeScript migration). The CLI contract is pinned — the
 * `--json` flag, the argparse usage / error text (`-h`/`--help` → exit 0,
 * unknown arg → exit 2), the scan order (`sorted(root.rglob("*.md"))` —
 * pathlib component-wise), byte-identical human + `--json` output
 * (`json.dumps(..., indent=2)`), and exit codes (0 clean / 1 violations).
 * The Python `re` flags (MULTILINE / IGNORECASE), the `status.lower()`, the
 * `read_text(errors="ignore")` lenient decode, and the `relative_to(REPO_ROOT)`
 * path shape are all reproduced. snake_case kept.
 *
 * A roadmap with open work that **cannot proceed now** (blocked on an external
 * trigger or a decision) but **will resume** belongs in
 * `agents/roadmaps/later/` — distinct from `archive/` (work done, none planned)
 * and `skipped/` (decided against). This guard makes that disposition a
 * first-class, enforced contract instead of an informal convention:
 *
 *   A. A roadmap whose frontmatter declares ``status: later`` MUST live under
 *      ``agents/roadmaps/later/`` (and nowhere else). A ``status: later`` file
 *      sitting in the active tree silently counts as backlog the dashboard and
 *      ``/roadmap:process-*`` would try to execute.
 *
 *   B. Every parked roadmap MUST record a **wake
 *      condition** so it never rots without a "when does it come back".
 *
 *      Until 2026-09-07 this rule short-circuited on the frontmatter STATUS
 *      word: ``if (status !== 'later' && !RESUME_RE.test(body))``, so a file
 *      whose frontmatter said ``status: later`` passed with no resume text
 *      present at all. Measured over the tree at that date, 63 of 82 parked
 *      roadmaps passed on the status word alone, 8 on a real ``Blocked until``
 *      / ``Resume when``, and 11 on the bare word ``trigger`` — so 74 of 82
 *      carried no machine-readable wake condition. The word ``trigger`` was
 *      the second hole: a body that merely mentions it in passing ("the
 *      trigger fires on push") satisfied a governance gate.
 *
 *      The corrected contract, in force regardless of ``status``:
 *
 *        1. **Structured** — an ``entry_condition:`` MAPPING in the
 *           frontmatter with three non-empty parts:
 *
 *             entry_condition:
 *               what: what would change the decision
 *               when: when that could arrive
 *               who:  who would have to act (``none`` is a legal answer)
 *
 *           A condition that cannot be observed is a deferral wearing a
 *           condition's clothes, which is why all three are required and why
 *           blankness is not the same answer as ``none``.
 *
 *        2. **Legacy** — a body line matching ``Blocked until`` /
 *           ``Resume when`` / ``blocked-until`` / ``resume-when``. Kept so the
 *           ratchet below has a floor to walk DOWN toward rather than a tree
 *           to fail on the day it lands.
 *
 *      A malformed ``entry_condition`` (scalar, or missing a part) is a HARD
 *      finding and is never baselined: it is a defect the author introduced in
 *      the change that wrote it, not inherited debt.
 *
 *   C. Every parked roadmap MUST carry ``review_by``
 *      in its frontmatter. Ratcheted from the measured count, same reasoning.
 *
 *      Both ratchets live in ``src/config/gate-violation-baselines.json`` under
 *      ``lint_roadmap_later_disposition:wake-condition`` and
 *      ``…:review-by``: the count may fall and never rise.
 *
 * Rationale: "roadmaps with open tasks deferred for later are always moved to
 * ``later/``" (user directive 2026-06-16). The active tree holds only roadmaps
 * that are actually workable now; everything blocked-for-later is parked in
 * ``later/`` with its resume condition, ready to be picked back up.
 *
 * Exit codes: 0 = clean, 1 = violations found, 2 = internal error.
 *
 * Usage:
 *     python3 scripts/lint_roadmap_later_disposition.py
 *     python3 scripts/lint_roadmap_later_disposition.py --json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { checkRatchet } from './_lib/gate_baseline.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);

// REPO_ROOT = Path(__file__).resolve().parent.parent.parent
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
// Mutable bindings so tests can sandbox the scan target (mirrors the pytest
// monkeypatch.setattr seam used by sibling lint twins).
let ROADMAP_ROOT = path.join(REPO_ROOT, 'agents', 'roadmaps');
let LATER_DIR = path.join(ROADMAP_ROOT, 'later');

function _setRoadmapRootForTest(p: string): void {
    ROADMAP_ROOT = p;
    LATER_DIR = path.join(ROADMAP_ROOT, 'later');
}

// FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
const FRONTMATTER_RE = /^---[ \t\f\v]*\n([\s\S]*?)\n---[ \t\f\v]*\n/;
// STATUS_RE = re.compile(r"^status:\s*([A-Za-z0-9_-]+)\s*$", re.MULTILINE)
const STATUS_RE = /^status:[ \t\f\v\r\n]*([A-Za-z0-9_-]+)[ \t\f\v\r]*$/m;
// The four UNAMBIGUOUS phrases. `trigger` was dropped 2026-09-07: it matched
// any prose mention of the word, so 11 of 82 parked roadmaps satisfied a
// governance gate on a sentence about something else entirely.
const RESUME_RE = /\b(blocked until|resume when|blocked-until|resume-when)\b/i;

/** Ratchet keys in `src/config/gate-violation-baselines.json`. */
export const WAKE_GATE = 'lint_roadmap_later_disposition:wake-condition';
export const REVIEW_BY_GATE = 'lint_roadmap_later_disposition:review-by';

/** The three parts a structured `entry_condition` must name. */
export const ENTRY_CONDITION_PARTS = ['what', 'when', 'who'] as const;

// Non-roadmap files that live in the tree but are not roadmaps.
const EXCLUDE_NAMES: ReadonlySet<string> = new Set([
    'template.md',
    'README.md',
    'progress.md',
    'roadmaps-progress.md',
]);
const EXCLUDE_PREFIXES: readonly string[] = ['open-questions'];

interface Violation {
    file: string;
    reason: string;
    /**
     * `hard` fails immediately; `wake` and `review-by` are ratcheted against a
     * committed baseline. A hard finding is one the AUTHOR introduced (a
     * malformed structured field, a misplaced `status: later`); a ratcheted one
     * is debt the corrected gate revealed.
     */
    cls: 'hard' | 'wake' | 'review-by';
}

/**
 * The three-part reading of a structured `entry_condition`.
 *
 * Deliberately parsed from the raw frontmatter text rather than through a YAML
 * loader: this gate's contract is byte-pinned against a retired Python
 * implementation and must not acquire a parser dependency whose error
 * behavior differs. The shape is fixed and shallow, so a line reader is
 * sufficient and its failure mode is legible.
 */
export function entryConditionParts(frontmatter: string): {
    present: boolean;
    scalar: boolean;
    parts: Record<string, string>;
} {
    const lines = frontmatter.split('\n');
    const idx = lines.findIndex((l) => /^entry_condition:/.test(l));
    if (idx === -1) {
        return { present: false, scalar: false, parts: {} };
    }
    const head = (lines[idx] as string).slice('entry_condition:'.length).trim();
    if (head !== '') {
        // `entry_condition: "…"` — the pre-contract scalar form.
        return { present: true, scalar: true, parts: {} };
    }
    const parts: Record<string, string> = {};
    for (let i = idx + 1; i < lines.length; i++) {
        const line = lines[i] as string;
        if (!/^\s+\S/.test(line)) break;
        const m = /^\s+([a-z_]+):\s*(.*)$/.exec(line);
        if (m === null) continue;
        parts[m[1] as string] = _unquote((m[2] as string).trim());
    }
    return { present: true, scalar: false, parts };
}

function _unquote(v: string): string {
    if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
        return v.slice(1, -1).trim();
    }
    return v.trim();
}

/** Missing / empty part names, `[]` when the field satisfies the contract. */
export function entryConditionProblems(frontmatter: string): string[] {
    const read = entryConditionParts(frontmatter);
    if (!read.present) return ['absent'];
    if (read.scalar) return ['scalar'];
    const missing: string[] = [];
    for (const part of ENTRY_CONDITION_PARTS) {
        if ((read.parts[part] ?? '').trim() === '') missing.push(part);
    }
    return missing;
}

function _is_roadmap(p: string): boolean {
    const name = path.basename(p);
    if (EXCLUDE_NAMES.has(name)) {
        return false;
    }
    return !EXCLUDE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function _frontmatter(text: string): string {
    const m = FRONTMATTER_RE.exec(text);
    return m ? (m[1] as string) : '';
}

function _status(text: string): string | null {
    const m = STATUS_RE.exec(_frontmatter(text));
    return m ? (m[1] as string).toLowerCase() : null;
}

/** sorted(root.rglob("*.md")) — pathlib component-wise; only files. */
function _rglobMdSorted(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                walk(full);
            } else if (ent.isSymbolicLink() && _isDir(full)) {
                walk(full);
            } else if (ent.name.endsWith('.md')) {
                out.push(full);
            }
        }
    };
    walk(root);
    out.sort();
    return out;
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** `LATER_DIR in path.parents` — strict-ancestor check. */
function _underLater(p: string): boolean {
    const rel = path.relative(LATER_DIR, p);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function check(root: string): Violation[] {
    const out: Violation[] = [];
    if (!_isDir(root)) {
        return out;
    }
    for (const p of _rglobMdSorted(root)) {
        if (!_isFile(p) || !_is_roadmap(p)) {
            continue;
        }
        // str(path.relative_to(REPO_ROOT)) — POSIX-separated.
        const rel = path.relative(REPO_ROOT, p).split(path.sep).join('/');
        // read_text(encoding="utf-8", errors="ignore"): drop undecodable bytes.
        const text = _readTextIgnore(p);
        const status = _status(text);
        const in_later = _underLater(p);

        // Rule A — status: later must live under later/.
        if (status === 'later' && !in_later) {
            out.push({
                file: rel,
                cls: 'hard',
                reason:
                    'frontmatter `status: later` but file is not under ' +
                    '`agents/roadmaps/later/` — a blocked-for-later roadmap ' +
                    'must be parked in `later/` (move it there), not left in ' +
                    'the active backlog.',
            });
        }

        if (!in_later) {
            continue;
        }

        const fm = _frontmatter(text);
        const body = text.slice(fm.length);
        const problems = entryConditionProblems(fm);
        const structured = problems.length === 0;

        // Rule B(1) — a PRESENT entry_condition must satisfy the contract.
        // Hard, never ratcheted: a malformed field is authored, not inherited.
        if (!structured && problems[0] !== 'absent') {
            out.push({
                file: rel,
                cls: 'hard',
                reason:
                    problems[0] === 'scalar'
                        ? '`entry_condition` is a scalar string — it must be a mapping naming ' +
                          '`what` (what would change the decision), `when` (when it could ' +
                          'arrive) and `who` (who would have to act; `none` is a legal answer).'
                        : '`entry_condition` is missing or blank in: ' +
                          problems.join(', ') +
                          '. A condition that cannot be observed is a deferral wearing a ' +
                          "condition's clothes; `none` is a legal answer for `who` and " +
                          'blankness is not.',
            });
        }

        // Rule B(2) — a wake condition is required REGARDLESS of `status`.
        if (!structured && !RESUME_RE.test(body)) {
            out.push({
                file: rel,
                cls: 'wake',
                reason:
                    'roadmap under `agents/roadmaps/later/` has no wake condition — the ' +
                    'frontmatter `status` word no longer satisfies this gate, and neither ' +
                    'does the bare word `trigger`. Add a structured `entry_condition` ' +
                    '(`what` / `when` / `who`) or a `Blocked until` / `Resume when` line.',
            });
        }

        // Rule C — review_by in the frontmatter of every parked roadmap.
        if (!/^review_by:\s*\S/m.test(fm)) {
            out.push({
                file: rel,
                cls: 'review-by',
                reason:
                    'roadmap under `agents/roadmaps/later/` has no `review_by:` in its ' +
                    'frontmatter — a park with no review date is indistinguishable from ' +
                    'an abandonment.',
            });
        }
    }
    return out;
}

/** read_text(encoding="utf-8", errors="ignore"): UTF-8 decode, drop invalid bytes. */
function _readTextIgnore(p: string): string {
    const buf = fs.readFileSync(p);
    return new TextDecoder('utf-8', { fatal: false }).decode(buf);
}

/**
 * json.dumps(value, indent=2) — Python default separators with indent are
 * (',', ': '), keys in insertion order, ensure_ascii=True.
 */
function _jsonDumpsIndent2(value: unknown): string {
    return _dump(value, 0);
}

function _dump(value: unknown, depth: number): string {
    const pad = '  '.repeat(depth + 1);
    const closePad = '  '.repeat(depth);
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return String(value);
    }
    if (typeof value === 'string') {
        return _jsonStr(value);
    }
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => pad + _dump(v, depth + 1));
        return '[\n' + items.join(',\n') + '\n' + closePad + ']';
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
        return '{}';
    }
    const items = keys.map((k) => pad + _jsonStr(k) + ': ' + _dump(obj[k], depth + 1));
    return '{\n' + items.join(',\n') + '\n' + closePad + '}';
}

/** json.dumps string with ensure_ascii=True (non-ASCII → \uXXXX). */
function _jsonStr(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') {
            out += '\\"';
        } else if (ch === '\\') {
            out += '\\\\';
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (ch === '\b') {
            out += '\\b';
        } else if (ch === '\f') {
            out += '\\f';
        } else if (code < 0x20) {
            out += '\\u' + code.toString(16).padStart(4, '0');
        } else if (code < 0x7f) {
            out += ch;
        } else if (code <= 0xffff) {
            out += '\\u' + code.toString(16).padStart(4, '0');
        } else {
            // Astral: encode as a UTF-16 surrogate pair (Python json does this).
            const c = code - 0x10000;
            const hi = 0xd800 + (c >> 10);
            const lo = 0xdc00 + (c & 0x3ff);
            out += '\\u' + hi.toString(16).padStart(4, '0');
            out += '\\u' + lo.toString(16).padStart(4, '0');
        }
    }
    return out + '"';
}

interface Args {
    json: boolean;
}

const _PROG = 'lint_roadmap_later_disposition.py';

function _usage(): string {
    return `usage: ${_PROG} [-h] [--json]\n`;
}

function _parseArgs(argv: readonly string[]): { args?: Args; exitCode?: number } {
    let json = false;
    const unrecognized: string[] = [];
    for (const arg of argv) {
        if (arg === '-h' || arg === '--help') {
            process.stdout.write(_usage());
            return { exitCode: 0 };
        }
        if (arg === '--json') {
            json = true;
        } else {
            unrecognized.push(arg);
        }
    }
    if (unrecognized.length) {
        process.stderr.write(
            _usage() + `${_PROG}: error: unrecognized arguments: ${unrecognized.join(' ')}\n`,
        );
        return { exitCode: 2 };
    }
    return { args: { json } };
}

function main(argv?: readonly string[]): number {
    const parsed = _parseArgs(argv ?? process.argv.slice(2));
    if (parsed.exitCode !== undefined) {
        return parsed.exitCode;
    }
    const args = parsed.args as Args;

    // `check` walks the whole tree already, but returns only violations, and it
    // opens with `if (!_isDir(root)) return []` — a moved root reads as "every
    // blocked-for-later roadmap is parked correctly". Assert the unfiltered
    // walk here rather than inside `check`, which is exercised against empty
    // sandbox roots. Exit 2 is this CLI's internal-error slot; 1 stays
    // "disposition violations found".
    try {
        assertScanned({
            gate: 'lint_roadmap_later_disposition',
            scanned: _rglobMdSorted(ROADMAP_ROOT).length,
            units: 'roadmap file(s)',
            roots: ['agents/roadmaps'],
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 2;
        }
        throw e;
    }

    const violations = check(ROADMAP_ROOT);
    const hard = violations.filter((v) => v.cls === 'hard');
    const wake = violations.filter((v) => v.cls === 'wake');
    const reviewBy = violations.filter((v) => v.cls === 'review-by');

    if (args.json) {
        // The `file` / `reason` pair is the pinned shape; `cls` is additive, so
        // a consumer reading the two original keys is unaffected.
        const payload = violations.map((v) => ({ file: v.file, reason: v.reason, cls: v.cls }));
        process.stdout.write(_jsonDumpsIndent2(payload) + '\n');
        // A JSON consumer wants the findings, not the ratchet verdict; the exit
        // code still carries it.
        return _verdict(hard, wake, reviewBy, true);
    }

    if (hard.length) {
        process.stdout.write('❌  later/ disposition violations:\n');
        for (const v of hard) {
            process.stdout.write(`   • ${v.file}\n       ${v.reason}\n`);
        }
    }
    return _verdict(hard, wake, reviewBy, false);
}

/**
 * Ratcheted verdict. The two revealed-debt classes print their findings either
 * way — at baseline they are the backlog this gate is walking down, and
 * printing them is what makes the next lowering possible.
 */
function _verdict(
    hard: readonly Violation[],
    wake: readonly Violation[],
    reviewBy: readonly Violation[],
    quiet: boolean,
): number {
    let failed = hard.length > 0;
    for (const [gate, found] of [
        [WAKE_GATE, wake],
        [REVIEW_BY_GATE, reviewBy],
    ] as const) {
        const verdict = checkRatchet({ gate, actual: found.length, repoRoot: REPO_ROOT });
        if (!verdict.ok) {
            failed = true;
            if (!quiet) {
                for (const v of found) {
                    process.stderr.write(`   • ${v.file}\n       ${v.reason}\n`);
                }
                process.stderr.write(`❌  ${verdict.message}\n`);
            }
        } else if (!quiet) {
            process.stdout.write(`✅  ${verdict.message}\n`);
        }
    }
    if (!failed && !quiet) {
        process.stdout.write(
            '✅  later/ disposition: every blocked-for-later roadmap is parked ' +
                'correctly, and both wake-condition ratchets hold.\n',
        );
    }
    return failed ? 1 : 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exitCode = main();
}

export {
    REPO_ROOT,
    ROADMAP_ROOT,
    type Violation,
    LATER_DIR,
    FRONTMATTER_RE,
    STATUS_RE,
    RESUME_RE,
    _setRoadmapRootForTest,
    _is_roadmap,
    _frontmatter,
    _status,
    check,
    main,
};

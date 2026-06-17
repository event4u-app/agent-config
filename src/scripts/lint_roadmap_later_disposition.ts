#!/usr/bin/env tsx
/**
 * CI guard for the `later/` roadmap disposition.
 *
 * TypeScript twin of `src/scripts/lint_roadmap_later_disposition.py` (ADR-200,
 * Python→TypeScript migration). The CLI contract is mirrored EXACTLY — the
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
 *   B. Every roadmap under ``agents/roadmaps/later/`` MUST record a **resume
 *      condition** so it never rots without a "when does it come back": either
 *      ``status: later`` frontmatter, or a body line matching
 *      ``Blocked until`` / ``Resume when`` / ``Trigger`` (case-insensitive).
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
// RESUME_RE = re.compile(r"\b(blocked until|resume when|trigger|blocked-until|resume-when)\b", re.IGNORECASE)
const RESUME_RE = /\b(blocked until|resume when|trigger|blocked-until|resume-when)\b/i;

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
                reason:
                    'frontmatter `status: later` but file is not under ' +
                    '`agents/roadmaps/later/` — a blocked-for-later roadmap ' +
                    'must be parked in `later/` (move it there), not left in ' +
                    'the active backlog.',
            });
        }

        // Rule B — every later/ roadmap records a resume condition.
        if (in_later) {
            const body = text.slice(_frontmatter(text).length);
            if (status !== 'later' && !RESUME_RE.test(body)) {
                out.push({
                    file: rel,
                    reason:
                        'roadmap under `agents/roadmaps/later/` has no resume ' +
                        'condition — add `status: later` to the frontmatter or a ' +
                        '`Blocked until` / `Resume when` / `Trigger` line so it ' +
                        'records when the work comes back.',
                });
            }
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

    const violations = check(ROADMAP_ROOT);

    if (args.json) {
        // json.dumps([asdict(v) for v in violations], indent=2)
        const payload = violations.map((v) => ({ file: v.file, reason: v.reason }));
        process.stdout.write(_jsonDumpsIndent2(payload) + '\n');
    } else if (violations.length) {
        process.stdout.write('❌  later/ disposition violations:\n');
        for (const v of violations) {
            process.stdout.write(`   • ${v.file}\n       ${v.reason}\n`);
        }
    } else {
        process.stdout.write(
            '✅  later/ disposition: every blocked-for-later roadmap is parked ' +
                'correctly with a resume condition.\n',
        );
    }

    return violations.length ? 1 : 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}

export {
    REPO_ROOT,
    ROADMAP_ROOT,
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

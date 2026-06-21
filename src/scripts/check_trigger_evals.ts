#!/usr/bin/env tsx
/**
 * Trigger-eval freshness + structural smoke gate (road-to-contract-integrity F4).
 *
 * TypeScript twin of `src/scripts/check_trigger_evals.py` (ADR-200). The CLI
 * contract is mirrored EXACTLY — `--today YYYY-MM-DD` / `--quiet` flags, exit
 * codes (0 fresh+valid, 1 regression(s), 2 bad --today / usage), the
 * stdout/stderr split (the ✅ summary on stdout, every ❌ on stderr),
 * byte-identical finding messages, the same glob (sorted), the same two
 * supported shapes, and the same ISO-date / age logic. No behaviour changes —
 * latent bugs replicated.
 *
 * `triggers.json` files encode each skill's behavioural intent; the surrounding
 * repo context drifts, so trigger sets need regression-locking. This gate is
 * the regression lock.
 *
 * For every `src/skills/*\/evals/triggers.json` it asserts:
 *   1. **Freshness** — a top-level `last_eval` ISO date (`YYYY-MM-DD`) present
 *      and no older than `MAX_AGE_DAYS` (90).
 *   2. **Structural smoke** (offline) — `queries` is a non-empty list; every
 *      entry has a non-empty `q` and a boolean `trigger`; both classes are
 *      represented (≥1 should-trigger and ≥1 should-not-trigger).
 *
 * `--today YYYY-MM-DD` overrides the reference date (tests / reproducible runs).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GLOB = 'src/skills/*/evals/triggers.json';
const MAX_AGE_DAYS = 90;

/**
 * A calendar date with proleptic-Gregorian ordinal arithmetic, mirroring
 * Python's `datetime.date`. `null` mirrors the Python `None` failure sentinel.
 */
interface PyDate {
    year: number;
    month: number;
    day: number;
}

/**
 * Mirror `date.fromisoformat(value)` — strict `YYYY-MM-DD` (Python 3.11+ also
 * accepts other ISO forms, but the values here are date-only; this matches the
 * date-only contract). Returns null on ValueError / TypeError (non-string).
 */
function _parse_iso(value: unknown): PyDate | null {
    if (typeof value !== 'string') {
        return null;
    }
    // date.fromisoformat is strict about `YYYY-MM-DD` for plain dates.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!m) {
        return null;
    }
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12) {
        return null;
    }
    const dim = _days_in_month(year, month);
    if (day < 1 || day > dim) {
        return null;
    }
    return { year, month, day };
}

function _is_leap(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function _days_in_month(year: number, month: number): number {
    const lengths = [31, _is_leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return lengths[month - 1]!;
}

/** Proleptic-Gregorian ordinal (days), matching date.toordinal() differences. */
function _to_ordinal(d: PyDate): number {
    const y = d.year - 1;
    let days = y * 365 + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400);
    const cumulative = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    days += cumulative[d.month - 1]!;
    if (d.month > 2 && _is_leap(d.year)) {
        days += 1;
    }
    days += d.day;
    return days;
}

/** `(a - b).days` matching Python date subtraction. */
function _days_between(a: PyDate, b: PyDate): number {
    return _to_ordinal(a) - _to_ordinal(b);
}

/** Today's local date, matching `date.today()`. */
function _today_local(): PyDate {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

/** Python `repr()` for the values that reach the `{raw!r}` / `{args.today!r}` slots. */
function _pyRepr(value: unknown): string {
    if (value === undefined || value === null) {
        return 'None';
    }
    if (typeof value === 'string') {
        // Python prefers single quotes; escape backslash and single quote.
        const esc = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `'${esc}'`;
    }
    if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
    }
    if (typeof value === 'number') {
        return String(value);
    }
    return String(value);
}

/** True iff `v` is a non-empty (truthy) string after the `q.get("q")` lookup. */
function _truthyStr(v: unknown): v is string {
    return typeof v === 'string' && v.length > 0;
}

function _check_one(p: string, today: PyDate): string[] {
    const rel = _relPosix(REPO_ROOT, p);
    let data: unknown;
    try {
        data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        return [`${rel}: unreadable JSON (${msg})`];
    }

    const errors: string[] = [];
    const obj = _asObject(data);

    const raw = obj ? obj['last_eval'] : undefined;
    const when = typeof raw === 'string' ? _parse_iso(raw) : null;
    if (when === null) {
        errors.push(`${rel}: missing or non-ISO \`last_eval\` (got ${_pyRepr(raw)})`);
    } else {
        const age = _days_between(today, when);
        if (age > MAX_AGE_DAYS) {
            errors.push(
                `${rel}: \`last_eval\` ${raw as string} is ${age}d old (> ${MAX_AGE_DAYS}d) ` +
                    '— re-run skill_trigger_eval.py and bump it',
            );
        }
    }

    // Two supported shapes: a single `queries` list of {q, trigger:bool}, or
    // split `should_trigger` / `should_not_trigger` lists of query strings.
    let pos = 0;
    let neg = 0;
    if (obj && 'queries' in obj) {
        const queries = obj['queries'];
        if (!Array.isArray(queries) || queries.length === 0) {
            errors.push(`${rel}: \`queries\` must be a non-empty list`);
            return errors;
        }
        for (let i = 0; i < queries.length; i++) {
            const q = queries[i];
            const qObj = _asObject(q);
            if (!qObj || !_pyTruthy(qObj['q'])) {
                errors.push(`${rel}: query #${i} missing non-empty \`q\``);
                continue;
            }
            const trig = qObj['trigger'];
            if (typeof trig !== 'boolean') {
                errors.push(`${rel}: query #${i} \`trigger\` must be a boolean`);
                continue;
            }
            pos += trig ? 1 : 0;
            neg += trig ? 0 : 1;
        }
    } else if (obj && ('should_trigger' in obj || 'should_not_trigger' in obj)) {
        for (const [key, sign] of [
            ['should_trigger', 1],
            ['should_not_trigger', -1],
        ] as const) {
            const items = obj[key];
            if (!Array.isArray(items) || items.length === 0) {
                errors.push(`${rel}: \`${key}\` must be a non-empty list`);
                continue;
            }
            for (let i = 0; i < items.length; i++) {
                const it = items[i];
                const itObj = _asObject(it);
                const q = itObj ? itObj['q'] : it;
                if (!(typeof q === 'string') || q.trim().length === 0) {
                    errors.push(`${rel}: \`${key}\` #${i} is not a non-empty query`);
                    continue;
                }
                pos += sign > 0 ? 1 : 0;
                neg += sign < 0 ? 1 : 0;
            }
        }
    } else {
        errors.push(`${rel}: no \`queries\` nor \`should_trigger\`/\`should_not_trigger\``);
        return errors;
    }

    if (pos === 0 || neg === 0) {
        errors.push(
            `${rel}: needs both classes (have ${pos} should-trigger, ` +
                `${neg} should-not-trigger)`,
        );
    }
    return errors;
}

/** Python `dict` ⇒ plain object; arrays / scalars are not dicts. */
function _asObject(v: unknown): Record<string, unknown> | null {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        return v as Record<string, unknown>;
    }
    return null;
}

/** Python truthiness for the `q.get("q")` non-empty check (`not q.get("q")`). */
function _pyTruthy(v: unknown): boolean {
    if (v === undefined || v === null || v === false) {
        return false;
    }
    if (typeof v === 'string') {
        return v.length > 0;
    }
    if (typeof v === 'number') {
        return v !== 0;
    }
    if (Array.isArray(v)) {
        return v.length > 0;
    }
    if (typeof v === 'object') {
        return Object.keys(v).length > 0;
    }
    return Boolean(v);
}

/** POSIX-style relative path (Path.relative_to(...).as_posix()). */
function _relPosix(base: string, target: string): string {
    return path.relative(base, target).split(path.sep).join('/');
}

/** Sorted matches of `src/skills/*\/evals/triggers.json` (single-level `*`). */
function _glob_triggers(root: string): string[] {
    const skillsDir = path.join(root, 'src', 'skills');
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const ent of entries) {
        // `*` matches a single path component; dirs and symlinked dirs both
        // match Python's glob (which follows symlinks for `*`).
        const candidate = path.join(skillsDir, ent.name, 'evals', 'triggers.json');
        if (_isFile(candidate)) {
            out.push(candidate);
        }
    }
    out.sort(_pathSort);
    return out;
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Component-wise path comparison matching PosixPath ordering. */
function _pathSort(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
        if (pa[i] !== pb[i]) {
            return pa[i]! < pb[i]! ? -1 : 1;
        }
    }
    return pa.length - pb.length;
}

interface ParsedArgs {
    today: string | null;
    quiet: boolean;
}

/**
 * Minimal argparse-compatible flag parsing. Mirrors the Python
 * `--today` (one argument) / `--quiet` (flag) contract, including the argparse
 * error surface (exit 2 + `usage:` on stderr) for unknown flags / missing args.
 */
function parse_args(argv: readonly string[]): ParsedArgs {
    let today: string | null = null;
    let quiet = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--today') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --today: expected one argument');
            }
            today = v;
        } else if (arg.startsWith('--today=')) {
            today = arg.slice('--today='.length);
        } else if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(`usage: ${_PROG} [-h] [--today TODAY] [--quiet]\n`);
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { today, quiet };
}

// argparse defaults prog to os.path.basename(sys.argv[0]) — the .py basename.
const _PROG = 'check_trigger_evals.py';

function _argparse_error(message: string): never {
    process.stderr.write(`usage: ${_PROG} [-h] [--today TODAY] [--quiet]\n`);
    process.stderr.write(`${_PROG}: error: ${message}\n`);
    process.exit(2);
}

function main(): number {
    const args = parse_args(process.argv.slice(2));

    const today = args.today ? _parse_iso(args.today) : _today_local();
    if (today === null) {
        process.stderr.write(`❌ check-trigger-evals: bad --today ${_pyRepr(args.today)}\n`);
        return 2;
    }

    const files = _glob_triggers(REPO_ROOT);
    const errors: string[] = [];
    for (const p of files) {
        errors.push(..._check_one(p, today));
    }

    if (errors.length) {
        process.stderr.write('❌ check-trigger-evals: trigger-set regression(s):\n');
        for (const e of errors) {
            process.stderr.write(`   - ${e}\n`);
        }
        return 1;
    }

    if (!args.quiet) {
        process.stdout.write(
            `✅ check-trigger-evals: ${files.length} trigger set(s) fresh + valid\n`,
        );
    }
    return 0;
}

const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { MAX_AGE_DAYS, GLOB, _parse_iso, _check_one, parse_args, main };

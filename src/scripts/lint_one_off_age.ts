#!/usr/bin/env tsx
/**
 * One-off-script age linter.
 *
 * TypeScript twin of `src/scripts/lint_one_off_age.py` (ADR-200, Phase 4 /
 * Wave 4b). Mirrors the CLI contract EXACTLY — `--format {text,json}` /
 * `--root` argparse flags, exit codes (0 clean incl. warnings, 1 hard
 * fail, 3 internal error), stdout/stderr split, byte-identical finding
 * messages, the same scan tree (`<root>/scripts/_one_off`) and ordering
 * (sorted iterdir). No behaviour changes — latent quirks replicated
 * (e.g. `scan` walks `scripts/_one_off`, NOT the module-level
 * `ONE_OFF_DIR = src/scripts/_one_off`, which is unused).
 *
 * Scans `scripts/_one_off/<YYYY-MM>/_one_off_*.py` and enforces the TTL
 * policy from `docs/contracts/one-off-script-lifecycle.md`:
 *
 *   * Age ≤ 60 days   → active, silent.
 *   * 60 < Age ≤ 90   → warning, exit 0.
 *   * Age > 90        → hard fail, exit 1 (purge candidate).
 *
 * Scripts MAY extend their TTL once via a `ttl_extended_until:` frontmatter
 * block, honoured up to 180 days past the month-directory date.
 *
 * Exit codes: 0 = clean (incl. warnings), 1 = hard fail, 3 = internal error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
// Mirrors the (scan-unused) module constant; kept for export parity.
const ONE_OFF_DIR = path.join(ROOT, 'src', 'scripts', '_one_off');

const NAME_RE = /^_one_off_[a-z0-9-]+\.py$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
// re.compile(r"---\s*\n\s*ttl_extended_until:\s*(\d{4}-\d{2}-\d{2})\s*\n", re.MULTILINE)
const TTL_RE = /---\s*\n\s*ttl_extended_until:\s*(\d{4}-\d{2}-\d{2})\s*\n/;

const WARN_DAYS = 60;
const HARD_DAYS = 90;
const EXTEND_CAP_DAYS = 180;

export interface Finding {
    path: string;
    age_days: number;
    severity: string; // "warn" | "fail"
    reason: string;
}

/** A UTC date as `{ y, m, d }`, the granularity Python's `date` uses here. */
interface SimpleDate {
    y: number;
    m: number;
    d: number;
}

function _today_utc(): SimpleDate {
    const now = new Date();
    return {
        y: now.getUTCFullYear(),
        m: now.getUTCMonth() + 1,
        d: now.getUTCDate(),
    };
}

/** Difference in whole days `(a - b)`, mirroring `(date - date).days`. */
function _dayDiff(a: SimpleDate, b: SimpleDate): number {
    const ta = Date.UTC(a.y, a.m - 1, a.d);
    const tb = Date.UTC(b.y, b.m - 1, b.d);
    return Math.round((ta - tb) / 86_400_000);
}

/** date(y, m, 1) for a valid YYYY-MM month dir; null otherwise. */
function _month_anchor(month_dir: string): SimpleDate | null {
    if (!MONTH_RE.test(month_dir)) {
        return null;
    }
    const [ys, ms] = month_dir.split('-');
    const y = Number.parseInt(ys as string, 10);
    const m = Number.parseInt(ms as string, 10);
    if (!_valid_date(y, m, 1)) {
        return null;
    }
    return { y, m, d: 1 };
}

/** True if (y, m, d) is a real calendar date (mirrors Python `date()` ValueError). */
function _valid_date(y: number, m: number, d: number): boolean {
    if (m < 1 || m > 12 || d < 1) {
        return false;
    }
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate(); // last day of month m
    return d <= dim;
}

function _parse_iso_date(s: string): SimpleDate | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) {
        return null;
    }
    const y = Number.parseInt(m[1] as string, 10);
    const mo = Number.parseInt(m[2] as string, 10);
    const d = Number.parseInt(m[3] as string, 10);
    if (!_valid_date(y, mo, d)) {
        return null;
    }
    return { y, m: mo, d };
}

function _read_extension(p: string): SimpleDate | null {
    let head: string;
    try {
        head = fs.readFileSync(p, 'utf-8').slice(0, 1024);
    } catch {
        return null;
    }
    const m = TTL_RE.exec(head);
    if (!m) {
        return null;
    }
    // datetime.strptime(..., "%Y-%m-%d").date() → ValueError tolerated as null.
    return _parse_iso_date(m[1] as string);
}

/** POSIX relative path of `target` under `root` (str(Path.relative_to)). */
function _relTo(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

/** sorted(p.iterdir()) — absolute child paths sorted by POSIX string. */
function _iterdirSorted(p: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(p);
    } catch {
        return [];
    }
    const out = names.map((n) => path.join(p, n));
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

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

export function scan(root: string, today?: SimpleDate): Finding[] {
    const day = today ?? _today_utc();
    const base = path.join(root, 'scripts', '_one_off');
    if (!_exists(base)) {
        return [];
    }
    const out: Finding[] = [];
    for (const month_dir of _iterdirSorted(base)) {
        if (!_isDir(month_dir)) {
            continue;
        }
        const monthName = path.basename(month_dir);
        const anchor = _month_anchor(monthName);
        if (anchor === null) {
            out.push({
                path: _relTo(month_dir, root),
                age_days: -1,
                severity: 'fail',
                reason: 'invalid month directory name (expect YYYY-MM)',
            });
            continue;
        }
        for (const f of _iterdirSorted(month_dir)) {
            const fname = path.basename(f);
            if (fname === 'README.md' || _isDir(f)) {
                continue;
            }
            if (!NAME_RE.test(fname)) {
                out.push({
                    path: _relTo(f, root),
                    age_days: -1,
                    severity: 'fail',
                    reason: 'filename does not match _one_off_<slug>.py',
                });
                continue;
            }
            const age = _dayDiff(day, anchor);
            const extension = _read_extension(f);
            if (extension !== null) {
                const cap = _dayDiff(extension, anchor);
                if (cap > EXTEND_CAP_DAYS) {
                    out.push({
                        path: _relTo(f, root),
                        age_days: age,
                        severity: 'fail',
                        reason: `ttl_extended_until exceeds 180-day cap (${cap}d)`,
                    });
                    continue;
                }
                if (age <= cap) {
                    continue; // extension still valid, silent
                }
            }
            if (age > HARD_DAYS) {
                out.push({
                    path: _relTo(f, root),
                    age_days: age,
                    severity: 'fail',
                    reason: `age ${age}d exceeds ${HARD_DAYS}-day hard limit`,
                });
            } else if (age > WARN_DAYS) {
                out.push({
                    path: _relTo(f, root),
                    age_days: age,
                    severity: 'warn',
                    reason: `age ${age}d in soft window (${WARN_DAYS}–${HARD_DAYS}d)`,
                });
            }
        }
    }
    return out;
}

export function format_text(findings: Finding[]): string {
    if (findings.length === 0) {
        return '✅  No one-off-script age violations.';
    }
    const lines: string[] = [];
    const fails = findings.filter((f) => f.severity === 'fail');
    const warns = findings.filter((f) => f.severity === 'warn');
    if (fails.length > 0) {
        lines.push(`❌  ${fails.length} one-off script(s) past hard limit:`);
        for (const f of fails) {
            lines.push(`  🔴 ${f.path}  →  ${f.reason}`);
        }
    }
    if (warns.length > 0) {
        lines.push(`⚠️  ${warns.length} one-off script(s) in soft window:`);
        for (const f of warns) {
            lines.push(`  🟡 ${f.path}  →  ${f.reason}`);
        }
    }
    lines.push('\nPurge candidates per docs/contracts/one-off-script-lifecycle.md.');
    return lines.join('\n');
}

interface ParsedArgs {
    format: 'text' | 'json';
    root: string;
}

function _argparse_error(message: string): never {
    process.stderr.write(
        'usage: lint_one_off_age.py [-h] [--format {text,json}] [--root ROOT]\n',
    );
    process.stderr.write(`lint_one_off_age.py: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let format: 'text' | 'json' = 'text';
    let root = ROOT;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--format') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --format: expected one argument');
            }
            if (v !== 'text' && v !== 'json') {
                _argparse_error(
                    `argument --format: invalid choice: '${v}' (choose from 'text', 'json')`,
                );
            }
            format = v;
        } else if (arg.startsWith('--format=')) {
            const v = arg.slice('--format='.length);
            if (v !== 'text' && v !== 'json') {
                _argparse_error(
                    `argument --format: invalid choice: '${v}' (choose from 'text', 'json')`,
                );
            }
            format = v;
        } else if (arg === '--root') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --root: expected one argument');
            }
            root = v;
        } else if (arg.startsWith('--root=')) {
            root = arg.slice('--root='.length);
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: lint_one_off_age.py [-h] [--format {text,json}] [--root ROOT]\n',
            );
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { format, root };
}

export function main(): number {
    const args = parse_args(process.argv.slice(2));
    let findings: Finding[];
    try {
        findings = scan(args.root);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        process.stderr.write(`Internal error: ${msg}\n`);
        return 3;
    }
    if (args.format === 'json') {
        // json.dumps([asdict(f) for f in findings], indent=2) — keys keep the
        // dataclass declaration order (path, age_days, severity, reason).
        const payload = findings.map((f) => ({
            path: f.path,
            age_days: f.age_days,
            severity: f.severity,
            reason: f.reason,
        }));
        process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    } else {
        process.stdout.write(format_text(findings) + '\n');
    }
    return findings.some((f) => f.severity === 'fail') ? 1 : 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { ROOT, ONE_OFF_DIR, NAME_RE, MONTH_RE, TTL_RE, WARN_DAYS, HARD_DAYS, EXTEND_CAP_DAYS, type SimpleDate };

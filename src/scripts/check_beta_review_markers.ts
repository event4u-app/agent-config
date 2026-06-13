#!/usr/bin/env tsx
/**
 * Beta-review-marker checker for `docs/contracts/`.
 *
 * TypeScript twin of `src/scripts/check_beta_review_markers.py` (ADR-094,
 * Phase 4 / Wave 4c). The CLI contract is mirrored EXACTLY — `--json`
 * flag, exit codes (0 clean, 1 violations, 3 internal error), stdout/stderr
 * split, byte-identical messages, the same scan order and the same date
 * arithmetic (`keep-beta-until` ≤ today + 90 days). No behaviour changes —
 * latent bugs replicated.
 *
 * Every contract whose frontmatter declares `stability: beta` MUST carry
 * exactly one of `promote-to: stable` | `keep-beta-until: YYYY-MM-DD` |
 * `superseded-by: <contract-id>`.
 *
 * Exit codes: 0 = clean, 1 = violations found, 3 = internal error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CONTRACTS_DIR = 'docs/contracts';

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n/;
const STABILITY_RE = /^stability:\s*(\w+)\s*$/m;
const PROMOTE_RE = /^promote-to:\s*stable\s*$/m;
const KEEP_RE = /^keep-beta-until:\s*(\d{4}-\d{2}-\d{2})\s*$/m;
const SUPERSEDED_RE = /^superseded-by:\s*\S+\s*$/m;

const MAX_REVIEW_WINDOW_DAYS = 90;

interface Violation {
    file: string;
    reason: string;
    severity: 'error' | 'warning';
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _relPosix(child: string, root: string): string {
    return path.relative(root, child).split(path.sep).join('/');
}

function _globMdSorted(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out = names
        .filter((n) => n.endsWith('.md'))
        .map((n) => path.join(dir, n))
        .filter((p) => {
            try {
                return fs.statSync(p).isFile();
            } catch {
                return false;
            }
        });
    out.sort();
    return out;
}

function read_frontmatter(p: string): string | null {
    if (!_exists(p)) {
        return null;
    }
    const txt = fs.readFileSync(p, 'utf-8');
    const m = FRONTMATTER_RE.exec(txt);
    return m ? m[1]! : null;
}

/** Days as an integer ordinal (proleptic Gregorian, like Python date.toordinal). */
function _dateOrdinal(year: number, month: number, day: number): number {
    // Use UTC epoch days; arithmetic difference is what matters, not the origin.
    return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function _parseISODate(s: string): [number, number, number] {
    const [y, m, d] = s.split('-').map((x) => Number(x));
    return [y!, m!, d!];
}

/** Format an ordinal-day count back to YYYY-MM-DD (zero-padded). */
function _ordinalToISO(ordinal: number): string {
    const dt = new Date(ordinal * 86400000);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function check_one(p: string, todayOrdinal: number): Violation[] {
    const fm = read_frontmatter(p);
    if (fm === null) {
        return [];
    }
    const sm = STABILITY_RE.exec(fm);
    if (!sm || sm[1] !== 'beta') {
        return [];
    }
    const markers: Array<[string, boolean]> = [
        ['promote-to', PROMOTE_RE.test(fm)],
        ['keep-beta-until', KEEP_RE.test(fm)],
        ['superseded-by', SUPERSEDED_RE.test(fm)],
    ];
    const setMarkers = markers.filter(([, present]) => present).map(([name]) => name);
    const rel = _relPosix(p, ROOT);
    if (setMarkers.length === 0) {
        return [
            {
                file: rel,
                reason:
                    'stability=beta but no review marker; add one of ' +
                    '`promote-to: stable` | `keep-beta-until: <date>` | ' +
                    '`superseded-by: <id>` (see STABILITY.md § Beta-review markers)',
                severity: 'error',
            },
        ];
    }
    if (setMarkers.length > 1) {
        return [
            {
                file: rel,
                reason:
                    `multiple beta-review markers set (${setMarkers.join(', ')}); ` +
                    'exactly one is allowed',
                severity: 'error',
            },
        ];
    }
    const km = KEEP_RE.exec(fm);
    if (km) {
        const [ry, rm, rd] = _parseISODate(km[1]!);
        const reviewOrdinal = _dateOrdinal(ry, rm, rd);
        const maxOrdinal = todayOrdinal + MAX_REVIEW_WINDOW_DAYS;
        if (reviewOrdinal > maxOrdinal) {
            return [
                {
                    file: rel,
                    reason:
                        `keep-beta-until=${_ordinalToISO(reviewOrdinal)} exceeds the ` +
                        `${MAX_REVIEW_WINDOW_DAYS}-day window (max: ${_ordinalToISO(maxOrdinal)})`,
                    severity: 'error',
                },
            ];
        }
    }
    return [];
}

interface ParsedArgs {
    json: boolean;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    const args: ParsedArgs = { json: false };
    for (const arg of argv) {
        if (arg === '--json') {
            args.json = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: check_beta_review_markers [-h] [--json]\n');
            process.exit(0);
        } else {
            process.stderr.write(
                `check_beta_review_markers: error: unrecognized arguments: ${arg}\n`,
            );
            process.exit(2);
        }
    }
    return args;
}

/** Today's date as an ordinal, in local time (mirrors date.today()). */
function _todayOrdinal(): number {
    const now = new Date();
    return _dateOrdinal(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function main(): number {
    const args = parse_args(process.argv.slice(2));
    const todayOrdinal = _todayOrdinal();
    const violations: Violation[] = [];
    for (const p of _globMdSorted(path.join(ROOT, CONTRACTS_DIR))) {
        violations.push(...check_one(p, todayOrdinal));
    }
    if (args.json) {
        process.stdout.write(JSON.stringify({ violations }, null, 2) + '\n');
    } else {
        if (violations.length === 0) {
            process.stdout.write('✅  All beta contracts carry a valid review marker.\n');
        } else {
            for (const v of violations) {
                const icon = v.severity === 'error' ? '❌' : '⚠️ ';
                process.stdout.write(`${icon}  ${v.file}: ${v.reason}\n`);
            }
            process.stdout.write(`\n${violations.length} violation(s).\n`);
        }
    }
    return violations.some((v) => v.severity === 'error') ? 1 : 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exit(main());
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`internal error: ${msg}\n`);
        process.exit(3);
    }
}

export {
    type Violation,
    ROOT,
    CONTRACTS_DIR,
    MAX_REVIEW_WINDOW_DAYS,
    read_frontmatter,
    check_one,
    main,
};

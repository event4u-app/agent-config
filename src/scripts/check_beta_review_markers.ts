#!/usr/bin/env tsx
/**
 * Beta-review-marker checker for `docs/contracts/`.
 *
 * Ported from the retired Python `src/scripts/check_beta_review_markers.py` (ADR-200,
 * Phase 4 / Wave 4c). The CLI contract is pinned — `--json`
 * flag, exit codes (0 clean, 1 violations, 3 internal error), stdout/stderr
 * split, byte-identical messages, the same scan order and the same date
 * arithmetic (`keep-beta-until` ≤ today + 90 days). No behaviour changes —
 * historical quirks preserved (consumers pin the exact behaviour).
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

import { asOf } from './_lib/as_of.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CONTRACTS_DIR = 'docs/contracts';

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n/;
const STABILITY_RE = /^stability:\s*(\w+)\s*$/m;
const PROMOTE_RE = /^promote-to:\s*stable\s*$/m;
const KEEP_RE = /^keep-beta-until:\s*(\d{4}-\d{2}-\d{2})\s*$/m;

/**
 * The frozen no-growth baseline of contracts already lapsed at 2026-08-25.
 *
 * AI council 2/2 (2026-08-25) chose a **ratchet** over both a flat report and a
 * flat error. The shape, and each clause is load-bearing:
 *
 *   - a lapsed contract **in** the baseline  -> warning (inherited debt)
 *   - a lapsed contract **not** in it        -> ERROR   (a fresh lapse, today)
 *
 * So new work is enforced immediately while the 86-contract cohort does not red
 * an arbitrary future PR whose author caused none of it. The cohort is real:
 * 44 of the 86 lapsed on the same day and 64 within four days, which is one past
 * session's uniform window expiring at once rather than 86 lapses of discipline.
 *
 * **The list may not grow, and an entry may not be re-added.** Both are the
 * ratchet, and both fall out of the rule above rather than needing their own
 * check: anything not already in the file errors.
 *
 * **Removal is derived from the contract's own state, never from editing this
 * file.** An entry stops mattering because the contract stopped being a lapsed
 * beta — promoted, recorded unmaintained, superseded, or given a reviewed new
 * deadline. One seat asked for exactly this qualification, on the ground that an
 * allowlist whose entries can simply be deleted is cosmetic.
 */
const BASELINE_REL = 'src/config/lapsed-beta-baseline.json';

interface LapsedBaseline {
    contracts: string[];
}

let _baselineCache: Set<string> | null = null;

export function loadLapsedBaseline(root: string = ROOT): Set<string> {
    if (_baselineCache !== null) {
        return _baselineCache;
    }
    const p = path.join(root, BASELINE_REL);
    if (!fs.existsSync(p)) {
        // The baseline reaching zero is the SUCCESS state: the file is deleted
        // in the same change that flips the severity. An absent file therefore
        // means "no inherited debt", i.e. every lapse is fresh and errors.
        _baselineCache = new Set<string>();
        return _baselineCache;
    }
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as LapsedBaseline;
    _baselineCache = new Set(parsed.contracts);
    return _baselineCache;
}

/** Test seam — the module-level cache would otherwise outlive a fixture. */
export function _resetLapsedBaseline(): void {
    _baselineCache = null;
}

/**
 * Severity of the LAPSED-deadline finding — `keep-beta-until` in the past.
 *
 * `warning` on purpose, and this constant exists so that promoting it is a
 * one-word, reviewable change rather than an edit buried in a branch.
 *
 * Until 2026-08-25 the gate compared `keep-beta-until` ONLY against
 * `today + MAX_REVIEW_WINDOW_DAYS` and errored when the date was too far in the
 * FUTURE. There was no floor, so a date arbitrarily far in the PAST passed and
 * the gate printed "All beta contracts carry a valid review marker" while 86 of
 * the 121 beta contracts were lapsed. The gate enforced the ceiling of the
 * review window and never its expiry.
 *
 * It ships as a report rather than an error because the backlog is a COHORT:
 * 44 of those 86 lapsed on the same day (2026-08-12) and 64 within four days,
 * which is one past session's uniform window expiring en masse rather than 86
 * independent lapses. Erroring on a cohort artifact produces one loud failure on
 * an arbitrary future PR whose author did nothing wrong — the way a gate gets
 * waived instead of adopted. The inventory and its dispositions are
 * `agents/evidence/analysis/lapsed-beta-inventory-2026-08-25.md`; the decision on
 * whether this becomes an error is that roadmap's step 0.2 and is not taken here.
 */
const LAPSED_SEVERITY_IN_BASELINE: 'error' | 'warning' = 'warning';
const LAPSED_SEVERITY_FRESH: 'error' | 'warning' = 'error';
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
        // Lower bound — the deadline has passed. Checked BEFORE the upper
        // bound because a lapsed date can never also exceed the forward window,
        // so the order is a readability choice rather than a precedence one.
        if (reviewOrdinal < todayOrdinal) {
            const inherited = loadLapsedBaseline().has(rel);
            const age = todayOrdinal - reviewOrdinal;
            return [
                {
                    file: rel,
                    reason:
                        `keep-beta-until=${_ordinalToISO(reviewOrdinal)} has LAPSED ` +
                        `(${age} day(s) ago); review the contract and ` +
                        'promote it, extend the window with a reason, or record it as superseded' +
                        (inherited
                            ? ' [inherited: in the frozen 2026-08-25 baseline, clear by 2026-11-23]'
                            : ' [FRESH lapse — not in the frozen baseline, which may not grow]'),
                    severity: inherited ? LAPSED_SEVERITY_IN_BASELINE : LAPSED_SEVERITY_FRESH,
                },
            ];
        }
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
    const now = asOf();
    return _dateOrdinal(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function main(): number {
    const args = parse_args(process.argv.slice(2));
    const todayOrdinal = _todayOrdinal();
    const violations: Violation[] = [];
    const contracts = _globMdSorted(path.join(ROOT, CONTRACTS_DIR));
    for (const p of contracts) {
        violations.push(...check_one(p, todayOrdinal));
    }
    // Count every contract read, not the `stability: beta` subset: over a moved
    // `docs/contracts/` "no beta contracts" and "no contracts at all" produce
    // the same clean line, and only the second is a dead gate. Exit 1 is the
    // violation code; 3 stays reserved for the internal-error handler below.
    try {
        assertScanned({
            gate: 'check_beta_review_markers',
            scanned: contracts.length,
            units: 'contract file(s)',
            roots: [CONTRACTS_DIR],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
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

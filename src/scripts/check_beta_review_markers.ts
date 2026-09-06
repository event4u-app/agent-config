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
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { asOf } from './_lib/as_of.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

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

// Keyed by root: an unkeyed cache returns the REPO baseline for a fixture root
// whenever the repo was read first, which silently judges a fixture against
// production data and is invisible in the result.
const _baselineCache = new Map<string, Set<string>>();

export function loadLapsedBaseline(root: string = ROOT): Set<string> {
    const hit = _baselineCache.get(root);
    if (hit !== undefined) {
        return hit;
    }
    const p = path.join(root, BASELINE_REL);
    if (!fs.existsSync(p)) {
        // The baseline reaching zero is the SUCCESS state: the file is deleted
        // in the same change that flips the severity. An absent file therefore
        // means "no inherited debt", i.e. every lapse is fresh and errors.
        const empty = new Set<string>();
        _baselineCache.set(root, empty);
        return empty;
    }
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as LapsedBaseline;
    const loaded = new Set(parsed.contracts);
    _baselineCache.set(root, loaded);
    return loaded;
}

/** Test seam — the module-level cache would otherwise outlive a fixture. */
export function _resetLapsedBaseline(): void {
    _baselineCache.clear();
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

/**
 * Forward horizon for the upcoming-lapse report.
 *
 * The gate reports a contract on the day it lapses, which is the day it is
 * already too late to decide anything: a FRESH lapse errors, and every pull
 * request in the repository reds until someone edits a contract under time
 * pressure. The horizon names the set that is ABOUT to enter that branch.
 *
 * The number is bounded on both sides: too wide and the report names most of
 * the forward-dated corpus on every run, which is the same as naming none; too
 * narrow and it arrives after the decision needed to be made.
 */
const HORIZON_DAYS = 14;

interface Violation {
    file: string;
    reason: string;
    severity: 'error' | 'warning';
}

/**
 * A contract whose window closes within {@link HORIZON_DAYS} and which is NOT
 * in the frozen baseline — i.e. one that will enter the ERROR branch, not the
 * inherited-warning one.
 *
 * Deliberately NOT a {@link Violation}: it carries no severity and never moves
 * the exit code. A third severity class printed into the same stream as the 84
 * standing warnings is the way this work changes nothing (risk 1 on the
 * roadmap's own register), so the horizon is a separate, clearly-labelled
 * section and the exit code stays a function of real violations alone.
 */
interface Upcoming {
    file: string;
    date: string;
    daysOut: number;
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

function check_one(p: string, todayOrdinal: number, root: string = ROOT): Violation[] {
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
    const rel = _relPosix(p, root);
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
            const inherited = loadLapsedBaseline(root).has(rel);
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

/**
 * The upcoming-lapse finding for one contract, or `null`.
 *
 * Baselined contracts are excluded EXPLICITLY rather than by relying on the
 * fact that a baselined contract is already lapsed and so cannot also carry a
 * future date. That implication holds today and is not a property anything
 * enforces; a guard that is merely vacuous cannot be distinguished from a
 * guard that is absent, and the difference shows up the first time a baseline
 * entry is re-dated forward.
 */
export function upcoming_one(
    p: string,
    todayOrdinal: number,
    horizonDays: number = HORIZON_DAYS,
    root: string = ROOT,
): Upcoming | null {
    const fm = read_frontmatter(p);
    if (fm === null || !/^stability:\s*beta\s*$/m.test(fm)) return null;
    const km = KEEP_RE.exec(fm);
    if (!km) return null;
    const rel = _relPosix(p, root);
    if (loadLapsedBaseline(root).has(rel)) return null;
    const [ry, rm, rd] = _parseISODate(km[1]!);
    const reviewOrdinal = _dateOrdinal(ry, rm, rd);
    const daysOut = reviewOrdinal - todayOrdinal;
    if (daysOut < 0 || daysOut > horizonDays) return null;
    return { file: rel, date: _ordinalToISO(reviewOrdinal), daysOut };
}

/**
 * STABILITY.md's own re-audit condition, as a command instead of as prose.
 *
 * `STABILITY.md`:
 *
 *   "The audit is repeated whenever the `keep-beta-until` date passes for
 *    >= 25 % of beta contracts, or at the start of any roadmap phase that
 *    touches the contract surface."
 *
 * That condition was met at 71.1 % and nothing noticed, which is the defect
 * `road-to-contract-review-deadlines` D2 records. A trigger nobody can run is
 * how a threshold gets crossed by a factor of three in silence — so the
 * percentage is computed here, next to the data, and printed.
 *
 * Deliberately a REPORT, not a gate: the enforcement half is the frozen
 * baseline plus the fresh-lapse error above. A second failing check over the
 * same population would red the same PRs twice for one cause.
 */
export const REAUDIT_TRIGGER_PCT = 25;

export interface TriggerVerdict {
    betaContracts: number;
    lapsed: number;
    pct: number;
    fired: boolean;
}

export function evaluateTrigger(violations: readonly Violation[], betaContracts: number): TriggerVerdict {
    const lapsed = violations.filter((v) => v.reason.includes('has LAPSED')).length;
    const pct = betaContracts === 0 ? 0 : (lapsed / betaContracts) * 100;
    return { betaContracts, lapsed, pct, fired: pct >= REAUDIT_TRIGGER_PCT };
}

interface ParsedArgs {
    json: boolean;
    trigger: boolean;
    /** Fixture root, for `--self-test`. A fixture is never judged against the repo baseline. */
    root: string | null;
    horizon: number;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    const args: ParsedArgs = {
        json: false,
        trigger: false,
        root: null,
        horizon: HORIZON_DAYS,
    };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i] as string;
        if (arg === '--json') {
            args.json = true;
        } else if (arg === '--root') {
            args.root = argv[i + 1] ?? null;
            i += 1;
        } else if (arg === '--horizon') {
            const raw = argv[i + 1] ?? '';
            const n = Number.parseInt(raw, 10);
            if (!/^\d+$/.test(raw) || Number.isNaN(n)) {
                process.stderr.write(
                    `check_beta_review_markers: error: --horizon needs a non-negative integer, got: ${raw || '(nothing)'}\n`,
                );
                process.exit(2);
            }
            args.horizon = n;
            i += 1;
        } else if (arg === '--trigger') {
            args.trigger = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: check_beta_review_markers [-h] [--json] [--trigger] [--horizon N]\n' +
                    '  --trigger  print the lapsed percentage and whether STABILITY.md\n' +
                    '             re-audit condition (>= 25 %) has fired. Reports; never fails.\n' +
                    '  --root DIR judge a fixture tree instead of the repo (self-test seam).\n' +
                    `  --horizon N  days ahead to report upcoming fresh lapses (default ${String(HORIZON_DAYS)}).\n` +
                    '             Advisory: never changes the exit code.\n',
            );
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


/**
 * Self-test — the gate proving it still DISCRIMINATES, not merely that it ran.
 *
 * A `scanned:` floor proves a gate read something; only a rejecting case proves
 * the reading changes the verdict. All four cases shell out to the real CLI
 * through a fixture `docs/contracts/`, because an in-process call cannot catch
 * an argv parser or an entry guard that silently no-ops.
 */
export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'beta-selftest-'));
    const write = (name: string, body: string): string => {
        const dir = path.join(tmp, name, 'docs', 'contracts');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'sample.md'), body, 'utf-8');
        return path.join(tmp, name);
    };
    const run = (root: string): number =>
        runGateCli(ROOT, 'src/scripts/check_beta_review_markers.ts', ['--root', root], root);

    try {
        return runSelfTest({
            gate: 'check_beta_review_markers',
            minCases: 4,
            minRejectCases: 2,
            cases: [
                {
                    name: 'a lapsed deadline outside the frozen baseline is rejected',
                    expect: 'reject',
                    run: () => run(write('lapsed', '---\nstability: beta\nkeep-beta-until: 2020-01-01\n---\n')),
                },
                {
                    name: 'a beta contract with NO marker at all is rejected',
                    expect: 'reject',
                    run: () => run(write('nomarker', '---\nstability: beta\n---\n')),
                },
                {
                    name: 'a beta contract inside its window passes',
                    expect: 'accept',
                    run: () => run(write('fresh', `---\nstability: beta\nkeep-beta-until: ${_ordinalToISO(_todayOrdinal() + 30)}\n---\n`)),
                },
                {
                    name: 'a stable contract needs no marker and passes',
                    expect: 'accept',
                    run: () => run(write('stable', '---\nstability: stable\n---\n')),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

function main(): number {
    if (process.argv.slice(2).includes('--self-test')) return selfTest();
    const args = parse_args(process.argv.slice(2));
    const todayOrdinal = _todayOrdinal();
    const violations: Violation[] = [];
    const scanRoot = args.root ?? ROOT;
    const contracts = _globMdSorted(path.join(scanRoot, CONTRACTS_DIR));
    let betaContracts = 0;
    const upcoming: Upcoming[] = [];
    for (const p of contracts) {
        const fm = read_frontmatter(p);
        if (fm !== null && /^stability:\s*beta\s*$/m.test(fm)) betaContracts += 1;
        violations.push(...check_one(p, todayOrdinal, scanRoot));
        const due = upcoming_one(p, todayOrdinal, args.horizon, scanRoot);
        if (due !== null) upcoming.push(due);
    }
    upcoming.sort((a, b) => a.daysOut - b.daysOut || a.file.localeCompare(b.file));
    // Count every contract read, not the `stability: beta` subset: over a moved
    // `docs/contracts/` "no beta contracts" and "no contracts at all" produce
    // the same clean line, and only the second is a dead gate. Exit 1 is the
    // violation code; 3 stays reserved for the internal-error handler below.
    try {
        // `reportScanned`, not `assertScanned`: the gate-coverage manifest's
        // rule 1 requires exactly one machine-readable `scanned: <N>` line, and
        // asserting without printing satisfies the scope guard while leaving the
        // census blind — which is the same "green over nothing" shape both
        // mechanisms exist to end. Emitted on the RED path too, so the gate
        // cannot report its coverage only when it passes.
        reportScanned({
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
    if (args.trigger) {
        const t = evaluateTrigger(violations, betaContracts);
        const line =
            `beta contracts: ${String(t.betaContracts)} · lapsed: ${String(t.lapsed)} · ` +
            `${t.pct.toFixed(1)} % · STABILITY.md re-audit trigger (>= ${String(REAUDIT_TRIGGER_PCT)} %): ` +
            (t.fired ? 'FIRED' : 'not fired');
        if (args.json) {
            process.stdout.write(JSON.stringify({ trigger: t }, null, 2) + '\n');
        } else {
            process.stdout.write(`${line}\n`);
        }
        // A report never fails a build. The enforcement half is the frozen
        // baseline plus the fresh-lapse error; failing here too would red the
        // same pull request twice for one cause.
        return 0;
    }
    if (args.json) {
        process.stdout.write(
            JSON.stringify({ violations, upcoming, horizonDays: args.horizon }, null, 2) + '\n',
        );
    } else {
        if (violations.length === 0) {
            process.stdout.write('✅  All beta contracts carry a valid review marker.\n');
        } else {
            for (const v of violations) {
                const icon = v.severity === 'error' ? '❌' : '⚠️ ';
                process.stdout.write(`${icon}  ${v.file}: ${v.reason}\n`);
            }
            // Both counts, and the relationship between them, because a
            // violation count alone cannot answer "how many contracts is this".
            // Today they are equal — check_one returns at most one finding per
            // contract — and printing only one of them hides the fact that it
            // is the size of the decision, not just the size of the output.
            const distinct = new Set(violations.map((v) => v.file)).size;
            const baselineSize = loadLapsedBaseline(scanRoot).size;
            const reportedInherited = violations.filter((v) =>
                loadLapsedBaseline(scanRoot).has(v.file),
            ).length;
            process.stdout.write(
                `\n${String(violations.length)} violation(s) across ` +
                    `${String(distinct)} distinct contract(s) — one line per finding, so the ` +
                    'two differ only where a contract carries more than one.\n',
            );
            process.stdout.write(
                `Frozen baseline: ${String(baselineSize)} entries · ` +
                    `${String(reportedInherited)} still reported as lapsed · ` +
                    `${String(baselineSize - reportedInherited)} inert ` +
                    '(left the lapsed set by promotion, supersession, or re-dating).\n',
            );
        }
        if (upcoming.length > 0) {
            process.stdout.write(
                `\nUpcoming FRESH lapses within ${String(args.horizon)} day(s) — advisory, ` +
                    'exit code unchanged. These are absent from the frozen baseline, so each\n' +
                    'becomes an ERROR on its date rather than an inherited warning:\n',
            );
            for (const u of upcoming) {
                process.stdout.write(
                    `   ${u.file}: keep-beta-until=${u.date} in ${String(u.daysOut)} day(s) [fresh]\n`,
                );
            }
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
    type Upcoming,
    ROOT,
    CONTRACTS_DIR,
    MAX_REVIEW_WINDOW_DAYS,
    HORIZON_DAYS,
    read_frontmatter,
    check_one,
    main,
};

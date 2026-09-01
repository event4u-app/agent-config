#!/usr/bin/env node
/**
 * Read-only query: which roadmap stubs are overdue for a read, and which
 * decisions are sitting on the owner.
 *
 * WHY THIS EXISTS, AND WHY IT LANDS BEFORE THE DATES DO.
 * `agents/roadmaps/stubs/` holds 77 files that are, by construction, not active
 * work — the directory listing IS the inventory (the index tables were deleted
 * on 2026-08-21 and `check_no_stub_inventory_table` keeps them deleted). Giving
 * each stub a `review_by:` date without giving anyone a way to READ those dates
 * would be strictly worse than adding nothing: the repository would carry a
 * field certifying attention it does not pay, and a stale date reads as
 * evidence. An AI council (2026-08-26, 2/2) made the ordering a rule — the
 * reader lands first, the backfill second. This is the reader.
 *
 * WHAT IT IS NOT. It is not a gate: it always exits 0, because "three stubs are
 * overdue" is a state of the world, not a defect in a diff. It is not an
 * inventory table: it prints to stdout on demand and writes nothing, least of
 * all into `agents/roadmaps/stubs/`, so the guard that deleted the tables stays
 * green and un-weakened. `agent-config roadmap:progress` consumes only its two
 * COUNTS for the dashboard header — two integers, no rows, nothing to grow an
 * index back from.
 *
 * THE TWO SHAPES HAVE DIFFERENT CLOCKS, and the cadence follows the shape, not
 * the file. A drain-run transfer is capability-gated: an environment can appear
 * at any moment, so it is re-probed every 30 days. An org-mode stub is
 * demand-gated: customer recruitment and audit funding move slowly, so its
 * demand question is re-asked every 120 days. Both numbers, and the reason 120
 * was taken over 180, are recorded in `agents/roadmaps/stubs/README.md`
 * § Frontmatter contract.
 *
 * OWNER DECISIONS are counted from two deterministic markers, because "the text
 * routes a decision to the owner" needs to be readable by a script and not only
 * by a person: an `## Unresolved decision` heading, and an open `### blocker:`
 * whose owner is the maintainer. A stub can carry both.
 *
 * CLI contract: always exit 0.
 *   ./scripts-run src/scripts/stubs_due
 *   ./scripts-run src/scripts/stubs_due --json
 *   ./scripts-run src/scripts/stubs_due --counts   # the two integers only
 *   ./scripts-run src/scripts/stubs_due --today 2026-12-01   # pin "now"
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const STUB_DIR = path.join('agents', 'roadmaps', 'stubs');

/** Cadence in days, per stub shape. Source of truth: the README section above. */
export const CADENCE_DAYS = { transfer: 30, orgmode: 120 } as const;

/** The marker that identifies a drain-run transfer in a stub body. */
const TRANSFER_MARKER = 'drain-run transfer';

const _HERE = path.resolve(fileURLToPath(import.meta.url));

export type StubShape = 'transfer' | 'orgmode';

export interface StubRecord {
    file: string;
    shape: StubShape;
    review_by: string | null;
    reviewed_at: string | null;
    probe_none: boolean;
    has_probe_heading: boolean;
    owner_decisions: number;
    overdue: boolean;
    days_overdue: number | null;
    /** Frontmatter `design_validated:` — a citation, or null when absent. */
    design_validated: string | null;
    /** Frontmatter `capability_gap:` — `none` means the stub declares no gap. */
    capability_gap: string | null;
    /** Frontmatter `blocker_class:` — `estate` | `budget` | `product`. */
    blocker_class: string | null;
    /** Frontmatter `blocker_opened:` — ISO date the hold began, or null. */
    blocker_opened: string | null;
    /** Releases published since `blocker_opened`, or null when it is absent. */
    releases_since_blocked: number | null;
    /** All three membership conditions hold. See {@link BLOCKED_QUICKWIN_FIELDS}. */
    blocked_quickwin: boolean;
}

/**
 * The three frontmatter keys that decide fourth-bucket membership.
 *
 * Read as SCALARS, never as substrings of the body. A substring match over
 * prose is what put a validated fix and a waiting preference into one bucket
 * in the first place; doing it with three substrings instead of one would be
 * worse, not better. A stub missing any of the three is not a member and falls
 * through to the OWNER bucket exactly as before — absence is never a member.
 */
export const BLOCKED_QUICKWIN_FIELDS = ['design_validated', 'capability_gap', 'blocker_class'] as const;

/** Blocker classes that make a stub a BLOCKED QUICK-WIN rather than a product wait. */
export const QUICKWIN_BLOCKER_CLASSES = ['estate', 'budget'] as const;

/**
 * All three conditions, read from frontmatter only.
 *
 * A recorded design validation, an explicit `capability_gap: none`, and an open
 * blocker that is an estate or budget decision rather than a product one.
 */
export function is_blocked_quickwin(
    design_validated: string | null,
    capability_gap: string | null,
    blocker_class: string | null,
): boolean {
    if (design_validated === null || design_validated === '') return false;
    if (capability_gap !== 'none') return false;
    return (QUICKWIN_BLOCKER_CLASSES as readonly string[]).includes(blocker_class ?? '');
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** Walk up from CWD until a dir containing `agents/roadmaps/stubs` is found. */
export function repo_root(start?: string): string {
    let cur = start ?? process.cwd();
    const chain = [cur];
    for (;;) {
        const parent = path.dirname(cur);
        if (parent === cur) break;
        chain.push(parent);
        cur = parent;
    }
    for (const candidate of chain) {
        if (_isDir(path.join(candidate, STUB_DIR))) {
            return candidate;
        }
    }
    return start ?? process.cwd();
}

/**
 * The frontmatter block, as raw lines. Returns [] when the file does not open
 * with `---` — a stub without frontmatter simply has no fields, which the
 * caller reports rather than crashing on.
 */
function _frontmatter(text: string): string[] {
    const lines = text.split('\n');
    if (lines[0]?.trim() !== '---') {
        return [];
    }
    const out: string[] = [];
    for (const line of lines.slice(1)) {
        if (line.trim() === '---') {
            return out;
        }
        out.push(line);
    }
    return [];
}

function _scalar(front: string[], key: string): string | null {
    const prefix = `${key}:`;
    for (const line of front) {
        if (line.startsWith(prefix)) {
            return line.slice(prefix.length).trim().replace(/^["']|["']$/g, '');
        }
    }
    return null;
}

/**
 * Owner-routed decisions in one stub body. Two markers, unioned:
 *  - an `## Unresolved decision …` heading — the shape
 *    `road-to-owner-authority-decisions.md` already uses;
 *  - an open `### blocker:` whose Owner line names the maintainer.
 * Counting the union rather than one of them is deliberate: a stub can carry
 * both, and either alone would under-report.
 */
export function count_owner_decisions(text: string): number {
    const lines = text.split('\n');
    let n = 0;
    for (const line of lines) {
        if (/^#{2,4}\s+Unresolved decision\b/.test(line)) {
            n += 1;
        }
    }
    // Open maintainer-owned blockers. Scan each `### blocker:` section for the
    // two field lines; a blocker missing either is not counted, because an
    // unstated owner is not an owner decision.
    let inBlocker = false;
    let ownerIsMaintainer = false;
    let statusOpen = false;
    const flush = (): void => {
        if (inBlocker && ownerIsMaintainer && statusOpen) {
            n += 1;
        }
        inBlocker = false;
        ownerIsMaintainer = false;
        statusOpen = false;
    };
    for (const line of lines) {
        if (/^#{2,4}\s+(blocker:|b-)/.test(line.trim()) || /^#{2,4}\s+\S+ — /.test(line)) {
            if (/blocker:/.test(line) || /^#{2,4}\s+b-/.test(line.trim())) {
                flush();
                inBlocker = true;
                continue;
            }
        }
        if (!inBlocker) continue;
        if (/^#{1,4}\s/.test(line)) {
            flush();
            continue;
        }
        if (/^-\s+\*\*Owner:\*\*\s*maintainer\b/i.test(line)) ownerIsMaintainer = true;
        if (/^-\s+\*\*Status:\*\*\s*open\b/i.test(line)) statusOpen = true;
    }
    flush();
    return n;
}

/** ISO date (UTC) N days after `from`. */
function _addDays(from: Date, days: number): string {
    const d = new Date(from.getTime() + days * 86_400_000);
    return d.toISOString().slice(0, 10);
}

function _parseIso(s: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(`${s}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Read every stub and classify it. `today` is injectable so tests are stable. */
export function scan(root: string, today: string): StubRecord[] {
    return scan_dir(path.join(root, STUB_DIR), today, release_dates(root));
}

/**
 * Changelog files that carry released sections, newest era first.
 *
 * BOTH are read, and that is the whole point of the pair. The era split moved
 * older releases into the archive, so a count taken over the current file alone
 * silently reports zero for anything before the split — measured: 14.11.0 lives
 * only in the archive, and grepping `CHANGELOG.md` for it returns nothing.
 */
export const CHANGELOG_ERAS = ['CHANGELOG.md', 'docs/archive/CHANGELOG-pre-14.12.0.md'] as const;

/** `## [x.y.z](…) (YYYY-MM-DD)` — a released section heading with its date. */
const RELEASE_HEADING = /^## \[\d+\.\d+\.\d+\][^\n]*\((\d{4}-\d{2}-\d{2})\)\s*$/gm;

/** Every released section's date across both eras, unsorted. */
export function release_dates(root: string): string[] {
    const out: string[] = [];
    for (const rel of CHANGELOG_ERAS) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(root, rel), 'utf8');
        } catch {
            continue;
        }
        for (const m of text.matchAll(RELEASE_HEADING)) {
            if (m[1] !== undefined) out.push(m[1]);
        }
    }
    return out;
}

/**
 * Releases published strictly AFTER the day the hold began.
 *
 * Strictly after, because a release cut on the same day cannot have carried a
 * fix the hold was blocking — counting it would inflate the figure the
 * council's falsifier is read against.
 */
export function releases_since(opened: string, dates: readonly string[]): number {
    return dates.filter((d) => d > opened).length;
}

/**
 * Same, but addressed by the stub DIRECTORY rather than the repo root.
 * `update_roadmap_progress` already holds `agents/roadmaps` and would otherwise
 * have to walk back up two levels to hand this function a root it would
 * immediately re-join — a fragile round trip past exactly the directory both
 * callers care about.
 */
export function scan_dir(
    base: string,
    today: string,
    releaseDates: readonly string[] = [],
): StubRecord[] {
    if (!_isDir(base)) return [];
    const now = _parseIso(today);
    const out: StubRecord[] = [];
    let names: string[];
    try {
        names = fs
            .readdirSync(base)
            .filter((n) => n.endsWith('.md') && n !== 'README.md')
            .sort();
    } catch {
        return [];
    }
    for (const name of names) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(base, name), 'utf8');
        } catch {
            continue;
        }
        const front = _frontmatter(text);
        const review_by = _scalar(front, 'review_by');
        const reviewed_at = _scalar(front, 'reviewed_at');
        const probeVal = _scalar(front, 'probe');
        const design_validated = _scalar(front, 'design_validated');
        const capability_gap = _scalar(front, 'capability_gap');
        const blocker_class = _scalar(front, 'blocker_class');
        const blocker_opened = _scalar(front, 'blocker_opened');
        const shape: StubShape = text.includes(TRANSFER_MARKER) ? 'transfer' : 'orgmode';
        let overdue = false;
        let days_overdue: number | null = null;
        if (review_by !== null && now !== null) {
            const due = _parseIso(review_by);
            if (due !== null && due.getTime() < now.getTime()) {
                overdue = true;
                days_overdue = Math.round((now.getTime() - due.getTime()) / 86_400_000);
            }
        }
        out.push({
            file: `${STUB_DIR}/${name}`,
            shape,
            review_by,
            reviewed_at,
            probe_none: probeVal === 'none',
            has_probe_heading: /^#{1,4} *(Probe|Promotion)/m.test(text),
            owner_decisions: count_owner_decisions(text),
            overdue,
            days_overdue,
            design_validated,
            capability_gap,
            blocker_class,
            blocker_opened,
            releases_since_blocked:
                blocker_opened === null ? null : releases_since(blocker_opened, releaseDates),
            blocked_quickwin: is_blocked_quickwin(design_validated, capability_gap, blocker_class),
        });
    }
    return out;
}

export interface Counts {
    overdue: number;
    owner_decisions: number;
    missing_review_by: number;
    /** ADDITIVE 2026-09-01. Existing keys are unchanged in name, type and meaning. */
    blocked_quickwin: number;
    total: number;
}

export function counts(records: StubRecord[]): Counts {
    return {
        overdue: records.filter((r) => r.overdue).length,
        owner_decisions: records.reduce((s, r) => s + r.owner_decisions, 0),
        missing_review_by: records.filter((r) => r.review_by === null).length,
        blocked_quickwin: records.filter((r) => r.blocked_quickwin).length,
        total: records.length,
    };
}

/** Suggested `review_by:` for a stub of this shape, dated from `from`. */
export function due_date(shape: StubShape, from: string): string {
    const d = _parseIso(from) ?? new Date();
    return _addDays(d, CADENCE_DAYS[shape]);
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const asJson = argv.includes('--json');
    const countsOnly = argv.includes('--counts');
    const todayIdx = argv.indexOf('--today');
    const today =
        todayIdx >= 0 && argv[todayIdx + 1] !== undefined
            ? (argv[todayIdx + 1] as string)
            : new Date().toISOString().slice(0, 10);

    const root = repo_root();
    const records = scan(root, today);
    const c = counts(records);

    if (countsOnly) {
        process.stdout.write(`${c.overdue} ${c.owner_decisions}\n`);
        return 0;
    }
    if (asJson) {
        process.stdout.write(`${JSON.stringify({ today, counts: c, stubs: records }, null, 2)}\n`);
        return 0;
    }

    process.stdout.write(`stubs:due · ${today} · ${c.total} stub(s) under ${STUB_DIR}/\n\n`);

    const overdue = records.filter((r) => r.overdue).sort((a, b) => (b.days_overdue ?? 0) - (a.days_overdue ?? 0));
    if (overdue.length === 0) {
        process.stdout.write('  ✅  no stub is past its review date.\n');
    } else {
        process.stdout.write(`  ⚠️   ${overdue.length} overdue:\n`);
        for (const r of overdue) {
            process.stdout.write(
                `      ${r.file}  (${r.shape}, due ${r.review_by}, ${r.days_overdue}d late)\n`,
            );
        }
    }

    if (c.missing_review_by > 0) {
        process.stdout.write(
            `\n  ⚠️   ${c.missing_review_by} stub(s) carry no \`review_by:\` — see ` +
                `${STUB_DIR}/README.md § Frontmatter contract:\n`,
        );
        for (const r of records.filter((x) => x.review_by === null)) {
            process.stdout.write(
                `      ${r.file}  (${r.shape}, suggested ${due_date(r.shape, today)})\n`,
            );
        }
    }

    const withDecisions = records.filter((r) => r.owner_decisions > 0);
    process.stdout.write(`\n  ${c.owner_decisions} decision(s) routed to the owner`);
    if (withDecisions.length === 0) {
        process.stdout.write('.\n');
    } else {
        process.stdout.write(':\n');
        for (const r of withDecisions) {
            process.stdout.write(`      ${r.file}  (${r.owner_decisions})\n`);
        }
    }

    const quickwins = records.filter((r) => r.blocked_quickwin);
    if (quickwins.length > 0) {
        process.stdout.write(
            `\n  🔓  ${quickwins.length} BLOCKED QUICK-WIN(S) — design validated, no capability gap,\n` +
                '      held by an estate or budget decision rather than a product one:\n',
        );
        for (const r of quickwins) {
            const since =
                r.releases_since_blocked === null
                    ? 'no `blocker_opened:`'
                    : `${String(r.releases_since_blocked)} release(s) since ${r.blocker_opened}`;
            process.stdout.write(`      ${r.file}  (${r.blocker_class}, ${since})\n`);
        }
    }

    const noProbe = records.filter((r) => !r.probe_none && !r.has_probe_heading);
    if (noProbe.length > 0) {
        process.stdout.write(
            `\n  ⚠️   ${noProbe.length} stub(s) name no promoting probe and do not say ` +
                '`probe: none`:\n',
        );
        for (const r of noProbe) {
            process.stdout.write(`      ${r.file}\n`);
        }
    }

    process.stdout.write('\n  Read-only. This command writes nothing.\n');
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
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

/**
 * The dashboard header fragment: two integers and a pointer, or `''` when both
 * are zero.
 *
 * Lives here rather than in `update_roadmap_progress` deliberately. That file
 * sits on the wrong side of the 1,500-line source-size ratchet, so every line
 * added to it is charged; this one is 365 lines and is charged nothing. The
 * generator gets a one-line call, and the rule that a count is not an inventory
 * — no row, no per-stub link, nothing for the deleted index tables to grow back
 * from — is enforced in one place instead of two.
 *
 * Failure-tolerant by construction: a tree with no `agents/roadmaps/stubs/`
 * yields `''` rather than throwing. This runs in consumer installs that carry no
 * stub directory at all, so a throwing read here would break their dashboard.
 */
export function headerFragment(stubsDir: string, today?: string): string {
    let overdue = 0;
    let decisions = 0;
    try {
        const c = counts(scan_dir(stubsDir, today ?? new Date().toISOString().slice(0, 10)));
        overdue = c.overdue;
        decisions = c.owner_decisions;
    } catch {
        return '';
    }
    if (overdue === 0 && decisions === 0) {
        return '';
    }
    return (
        ` · **${overdue}** overdue stub${overdue !== 1 ? 's' : ''}` +
        `, **${decisions}** owner decision${decisions !== 1 ? 's' : ''}` +
        ' → `agent-config stubs:due`'
    );
}

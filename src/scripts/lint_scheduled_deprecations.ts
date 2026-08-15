#!/usr/bin/env node
/**
 * Gate: the scheduled-deprecations table in `docs/MIGRATION.md` is checked by
 * arithmetic, not by somebody remembering to read it.
 *
 * WHY THIS EXISTS. The table records commitments due at a *future* major, and
 * the release runbook's pre-flight sends the releaser to it with a manual
 * checkbox whose own text says "A row left unread is how a removal commitment
 * becomes folklore". The row for the `code_graph` engine committed its removal
 * to the major after the one after 9.x — 11.0 — and `package.json` reads
 * 12.0.0. The row existed, was correct, and was missed anyway. So the defect is
 * the absence of a check, not the absence of a row, and a second manual reminder
 * would repeat the failure at a higher frequency.
 *
 * WHAT IT DOES NOT DO. It never removes anything. Acting on an overdue row is a
 * public-surface change gated by `downstream-changes` and `scope-control` and
 * lands at a major cut; this gate reports and, at a cut, refuses. It also does
 * not invent a due version: a cell it cannot resolve is reported as
 * *unresolved* and reds, because a table whose format drifted silently is
 * exactly the shape "a gate that scans nothing exits green" describes.
 *
 * EXIT CONTRACT
 *   0  nothing due, or due surfaces reported on an ordinary branch
 *   1  a row could not be parsed / resolved, the table is missing or empty, or
 *      a due surface was found while `--cutting <version>` was passed
 *   2  usage error
 *
 * `--cutting <X.Y.Z>` is the major-cut switch: an ordinary branch gets the
 * report, a release gets the refusal. That asymmetry is deliberate — an overdue
 * row can be a considered deferral, and a hard refusal on every branch would
 * turn a judgement into an outage. A deliberate deferral is expressible in the
 * table itself (a `permanent keep` row), which is what keeps the refusal honest
 * at the cut.
 *
 * **THE COMPARAND IS THE TARGET, NOT THE SHIPPED VERSION, AND THE DIFFERENCE IS
 * THE WHOLE POINT.** An earlier version of this gate compared against
 * `package.json` in both modes. At the cut to N, `package.json` still reads
 * N-1, so a row committed to N resolved to "one major early" and passed — the
 * refusal could only ever fire on a row that was ALREADY a major late, which is
 * precisely the lateness this gate exists to prevent. `--cutting` takes the
 * target so the cut that would CREATE the miss is the one that gets refused.
 *
 * SCOPE BOUND, stated because the runbook checkbox above it is wider: only the
 * **Removal due** column is compared. The Deprecation-notice-due cell is parsed
 * solely as the anchor for a relative removal cell and is never checked against
 * anything, because a shipped notice is written as a date rather than a version
 * and has no comparand. The "ship the notice" half of the pre-flight obligation
 * therefore remains a human read.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const MIGRATION_PATH = path.join('docs', 'MIGRATION.md');
const PACKAGE_PATH = 'package.json';

/** The heading the table lives under. Matched case-insensitively on the stem. */
const SECTION_MARKER = /^##\s+scheduled deprecations\b/i;

/**
 * A row whose removal date is deliberately not pinned. The marker is the
 * table's own wording, so a maintainer-owned removal date stays expressible
 * without becoming an unresolved parse.
 */
const UNPINNED_MARKER = /not pinned/i;

/** A row explicitly recorded as staying — the "documented keep" state. */
const PERMANENT_KEEP_MARKER = /permanent keep|no removal scheduled/i;

export interface DeprecationRow {
    /** Raw first cell — the surface, as written. */
    surface: string;
    /** Short name for reporting: the first backticked token, else a truncation. */
    name: string;
    /** Raw "Deprecation notice due" cell. */
    noticeDueRaw: string;
    /** Raw "Removal due" cell. */
    removalDueRaw: string;
    /** Path-shaped tokens found in the surface cell (contain a `/`). */
    paths: string[];
    /** 1-based row number within the table, for error messages. */
    index: number;
}

export type Resolution =
    | { kind: 'major'; major: number }
    | { kind: 'unpinned' }
    | { kind: 'keep' }
    | { kind: 'unresolved'; cell: string };

/**
 * Resolve a due-version cell to a concrete major.
 *
 * The grammar is deliberately small, and every form below appears in the table
 * today. A form outside it resolves to `unresolved` and reds rather than being
 * guessed at — an invented due version is worse than a parse failure, because
 * it would silently move a commitment.
 *
 *   `11.0` / `11.0.0` / `11`        → 11
 *   `next major after 9.x`          → 10
 *   `the major after that`          → (notice major) + 1
 *   `next major after the notice`   → (notice major) + 1
 *   `… not pinned …`                → unpinned  (maintainer-owned date)
 *   `… permanent keep …`            → keep      (documented, not scheduled)
 *
 * @param cell        the raw table cell
 * @param noticeMajor the already-resolved notice major, when one exists — the
 *                    relative forms are only resolvable against it
 */
export function resolveDueMajor(cell: string, noticeMajor?: number): Resolution {
    const text = cell.trim();
    if (text === '') return { kind: 'unresolved', cell };

    // Checked before the relative forms on purpose: the unpinned row also
    // contains the words "next major after the notice", and the explicit
    // not-pinned statement is the load-bearing half of that cell.
    if (UNPINNED_MARKER.test(text)) return { kind: 'unpinned' };
    if (PERMANENT_KEEP_MARKER.test(text)) return { kind: 'keep' };

    const relativeAfterVersion = /next major after\s+(?:v)?(\d+)(?:\.(?:x|\d+))?/i.exec(text);
    const relativeToNotice = /(?:the major after that|next major after the notice)/i.test(text);

    if (relativeAfterVersion) {
        return { kind: 'major', major: Number(relativeAfterVersion[1]) + 1 };
    }
    if (relativeToNotice) {
        if (noticeMajor === undefined) return { kind: 'unresolved', cell };
        return { kind: 'major', major: noticeMajor + 1 };
    }
    // ANCHORED, not "a digit run somewhere in the cell". The loose form matched
    // any number and so resolved `shipped 2026-07-29 — dormant by default` to
    // major 2026 — a confidently wrong commitment, which is the one outcome the
    // contract at the top of this file rules out. The whole cell (bare of
    // markdown emphasis) must BE a version, or the cell is unresolved.
    const explicit = /^\**\s*v?(\d+)(?:\.(?:\d+|x)){0,2}\s*\**$/.exec(text);
    if (explicit) {
        return { kind: 'major', major: Number(explicit[1]) };
    }
    return { kind: 'unresolved', cell };
}

/**
 * The table's header no longer carries a `Removal due` column.
 *
 * Its own error, rather than N per-row "cell not resolvable" findings: a
 * renamed column has exactly one cause and one fix, and reporting it per row
 * buries that under noise proportional to the table's length.
 */
export class HeaderMismatchError extends Error {
    constructor(readonly header: readonly string[]) {
        super(
            'lint_scheduled_deprecations: the scheduled-deprecations table has no ' +
                `"Removal due" column — header reads [${header.join(' | ')}]. Either the ` +
                'column was renamed (update this gate in the same change) or the heading ' +
                'now sits above a different table.',
        );
        this.name = 'HeaderMismatchError';
    }
}

/** Split one markdown table line into trimmed cells, dropping the outer pipes. */
function splitRow(line: string): string[] {
    const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    return trimmed.split('|').map((c) => c.trim());
}

/** A separator line — `|---|---|` and its alignment variants. */
function isSeparator(line: string): boolean {
    return /^\|?[\s:|-]+\|[\s:|-]*$/.test(line.trim()) && line.includes('-');
}

/**
 * Extract the scheduled-deprecations table from a `MIGRATION.md` body.
 *
 * Reads only the first table under the section heading and stops at the next
 * `##`, so the version sections below it — every one of which records a change
 * that already shipped — can never be parsed as commitments.
 */
export function parseRows(markdown: string): DeprecationRow[] {
    const lines = markdown.split('\n');
    let inSection = false;
    let header: string[] | undefined;
    // Resolved ONCE when the header row is read, not per data row. Recomputing
    // them inside the loop made a renamed column red every row independently
    // with an empty cell quoted, burying the one true cause — a header that no
    // longer matches — under N identical findings.
    let idxNotice = -1;
    let idxRemoval = -1;
    const rows: DeprecationRow[] = [];

    for (const line of lines) {
        // ANY heading closes the span, not just a sibling `## `. The table now
        // has a `### Row status` subsection under it; with a `^##\s` close the
        // span ran past it, so a table added there would have been appended as
        // data rows with its header parsed as one.
        if (/^#{1,6}\s/.test(line)) {
            if (inSection) break;
            inSection = SECTION_MARKER.test(line);
            continue;
        }
        if (!inSection) continue;
        if (!line.trim().startsWith('|')) continue;
        if (isSeparator(line)) continue;

        const cells = splitRow(line);
        if (header === undefined) {
            header = cells.map((c) => c.toLowerCase());
            idxNotice = header.findIndex((h) => h.includes('notice due'));
            idxRemoval = header.findIndex((h) => h.includes('removal due'));
            if (idxRemoval < 0) {
                throw new HeaderMismatchError(header);
            }
            continue;
        }

        const surface = cells[0] ?? '';
        const backticked = [...surface.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? '');

        rows.push({
            surface,
            name: backticked[0] ?? surface.slice(0, 60),
            noticeDueRaw: idxNotice >= 0 ? (cells[idxNotice] ?? '') : '',
            removalDueRaw: idxRemoval >= 0 ? (cells[idxRemoval] ?? '') : '',
            paths: backticked.filter((t) => t.includes('/')),
            index: rows.length + 1,
        });
    }
    return rows;
}

export interface Finding {
    row: DeprecationRow;
    /**
     * `overdue` — the removal is due at or before the comparand major.
     * `unresolved` — the removal-due cell could not be resolved to a version.
     */
    kind: 'overdue' | 'unresolved';
    /**
     * `comparand − dueMajor`. Positive = late by that many majors; **zero =
     * due exactly at the major being cut**, which is a refusal at a cut and
     * silent on an ordinary branch, since a row due at the shipped major is
     * being acted on right now rather than missed.
     */
    overdueBy: number;
    /** Path tokens from the row that still exist on disk. */
    livePaths: string[];
}

/**
 * Compare every row's removal-due major against `comparand`.
 *
 * `comparand` is the SHIPPED major on an ordinary branch and the TARGET major
 * at a cut — the distinction the gate's header paragraph explains, and the
 * reason this parameter is not simply read from `package.json` in here.
 */
export function evaluate(
    rows: readonly DeprecationRow[],
    comparand: number,
    root: string,
    ledger?: GateLedger,
    /**
     * `>= 0` at a cut (a row due AT the target must be acted on now), `> 0` on
     * an ordinary branch (a row due at the shipped major is being worked, not
     * missed). Without the split, a row committed to the current major warned
     * on every branch and every CI run for a whole release cycle — a standing
     * notice for something nobody is late on, which is the habituation this
     * gate exists to avoid producing.
     */
    dueAtComparandCounts = false,
): Finding[] {
    const findings: Finding[] = [];
    ledger?.plan(rows.map((r) => `row-${String(r.index)}:${r.name}`));

    for (const row of rows) {
        const key = `row-${String(row.index)}:${row.name}`;
        const notice = resolveDueMajor(row.noticeDueRaw);
        const noticeMajor = notice.kind === 'major' ? notice.major : undefined;
        const removal = resolveDueMajor(row.removalDueRaw, noticeMajor);

        if (removal.kind === 'unpinned' || removal.kind === 'keep') {
            // A tracked state, which is the outcome the table exists to record.
            ledger?.complete(key);
            continue;
        }
        if (removal.kind === 'unresolved') {
            findings.push({ row, kind: 'unresolved', overdueBy: 0, livePaths: [] });
            ledger?.fail(key, `removal-due cell not resolvable: ${removal.cell}`);
            continue;
        }

        const overdueBy = comparand - removal.major;
        if (overdueBy > 0 || (overdueBy === 0 && dueAtComparandCounts)) {
            const livePaths = row.paths.filter((p) => fs.existsSync(path.join(root, p)));
            findings.push({ row, kind: 'overdue', overdueBy, livePaths });
            ledger?.fail(
                key,
                `removal due at ${String(removal.major)}.0, comparand major is ${String(comparand)}`,
            );
            continue;
        }
        ledger?.complete(key);
    }
    return findings;
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** Walk up from CWD until a dir containing `docs/MIGRATION.md` is found. */
function repoRoot(): string {
    let cur = process.cwd();
    const chain = [cur];
    for (;;) {
        const parent = path.dirname(cur);
        if (parent === cur) break;
        chain.push(parent);
        cur = parent;
    }
    for (const candidate of chain) {
        if (_isDir(path.join(candidate, 'docs')) && fs.existsSync(path.join(candidate, MIGRATION_PATH))) {
            return candidate;
        }
    }
    return process.cwd();
}

/** The major from `package.json`'s `version`. */
export function shippedMajor(root: string): number {
    const raw = fs.readFileSync(path.join(root, PACKAGE_PATH), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    const version =
        typeof parsed === 'object' && parsed !== null && 'version' in parsed
            ? (parsed as { version?: unknown }).version
            : undefined;
    if (typeof version !== 'string') {
        throw new Error(`${PACKAGE_PATH}: no string \`version\` field`);
    }
    const major = /^(\d+)\./.exec(version);
    if (!major) {
        throw new Error(`${PACKAGE_PATH}: version "${version}" has no leading major`);
    }
    return Number(major[1]);
}

/** Floors for `--self-test`, declared here so a truncation is a visible diff. */
const SELF_TEST_MIN_CASES = 9;
const SELF_TEST_MIN_REJECT = 6;

/**
 * Prove, on demand, that this gate's rejections still fire against its own CLI.
 *
 * The unit suite covers the same ground against imported functions; this covers
 * the binary a contributor actually runs, including argv parsing and the entry
 * guard — the layers that have silently no-opped in this repository before.
 */
function selfTest(): number {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lsd-selftest-'));
    const repo = repoRoot();
    const script = path.join('src', 'scripts', 'lint_scheduled_deprecations.ts');

    const header = [
        '# Migration Guide',
        '',
        '## Scheduled deprecations (forward-looking)',
        '',
        '| Surface | Committed | Deprecation notice due | Removal due | Reversal condition |',
        '|---|---|---|---|---|',
    ].join('\n');

    /** Build a fixture tree and run the real CLI against it. */
    const fixture = (name: string, major: number, table: string, args: string[] = []): number => {
        const dir = path.join(root, name);
        fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'package.json'),
            JSON.stringify({ name: 'fixture', version: `${String(major)}.0.0` }),
            'utf8',
        );
        fs.writeFileSync(path.join(dir, 'docs', 'MIGRATION.md'), `${header}\n${table}\n`, 'utf8');
        return runGateCli(repo, script, args, dir);
    };

    const cases: SelfTestCase[] = [
        {
            name: 'overdue row at a major cut is refused',
            expect: 'reject',
            run: () =>
                fixture(
                    'overdue',
                    12,
                    '| `legacy` | 2026-01-01 | 10.0 | 11.0 | none |',
                    ['--cutting', '13.0.0'],
                ),
        },
        {
            // THE CASE THE FIRST VERSION OF THIS GATE MISSED. A row committed
            // to the major being cut is due NOW; measured against the shipped
            // version it reads as one major early and passes, so the cut that
            // creates the miss goes through. This case is what pins the
            // comparand to the target.
            name: 'a row due AT the major being cut is refused, not waved through',
            expect: 'reject',
            run: () =>
                fixture(
                    'due-at-cut',
                    12,
                    '| `due_now` | 2026-01-01 | 12.0 | 13.0 | none |',
                    ['--cutting', '13.0.0'],
                ),
        },
        {
            name: 'the same row is silent on an ordinary branch — it is not late yet',
            expect: 'accept',
            run: () => fixture('due-at-cut-branch', 12, '| `due_now` | 2026-01-01 | 12.0 | 13.0 | none |'),
        },
        {
            // due == SHIPPED, which is the case the contract calls silent on a
            // branch and neither the earlier fixtures nor the self-test covered
            // (both used due 13 against shipped 12, i.e. due == TARGET).
            name: 'a row due at the SHIPPED major is silent on an ordinary branch',
            expect: 'accept',
            run: () => fixture('due-at-shipped', 12, '| `due_at_shipped` | 2026-01-01 | 11.0 | 12.0 | none |'),
        },
        {
            name: 'the same row IS refused at the very next cut',
            expect: 'reject',
            run: () =>
                fixture(
                    'due-at-shipped-cut',
                    12,
                    '| `due_at_shipped` | 2026-01-01 | 11.0 | 12.0 | none |',
                    ['--cutting', '13.0.0'],
                ),
        },
        {
            name: 'a header with no Removal due column reds once, naming the header',
            expect: 'reject',
            run: () => {
                const dir = path.join(root, 'renamed-header');
                fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
                fs.writeFileSync(
                    path.join(dir, 'package.json'),
                    JSON.stringify({ name: 'fixture', version: '12.0.0' }),
                    'utf8',
                );
                fs.writeFileSync(
                    path.join(dir, 'docs', 'MIGRATION.md'),
                    `${header.replace('| Removal due ', '| Retirement date ')}\n` +
                        '| `a` | 2026-01-01 | 10.0 | 11.0 | none |\n' +
                        '| `b` | 2026-01-01 | 10.0 | 11.0 | none |\n',
                    'utf8',
                );
                return runGateCli(repo, script, [], dir);
            },
        },
        {
            name: 'unresolvable removal-due cell reds on an ordinary branch',
            expect: 'reject',
            run: () => fixture('vague', 12, '| `vague` | 2026-01-01 | soon | eventually | none |'),
        },
        {
            name: 'a table parsing to zero rows reds rather than exiting green',
            expect: 'reject',
            run: () => {
                const dir = path.join(root, 'dead');
                fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
                fs.writeFileSync(
                    path.join(dir, 'package.json'),
                    JSON.stringify({ name: 'fixture', version: '12.0.0' }),
                    'utf8',
                );
                fs.writeFileSync(
                    path.join(dir, 'docs', 'MIGRATION.md'),
                    '# Migration Guide\n\n## Planned removals\n\n| Surface | Removal due |\n|---|---|\n| `x` | 1.0 |\n',
                    'utf8',
                );
                return runGateCli(repo, script, [], dir);
            },
        },
        {
            name: 'a future-dated row passes at a major cut',
            expect: 'accept',
            run: () =>
                fixture(
                    'future',
                    12,
                    '| `later` | 2026-01-01 | 13.0 | 14.0 | none |',
                    ['--cutting', '13.0.0'],
                ),
        },
    ];

    try {
        return runSelfTest({
            gate: 'lint_scheduled_deprecations',
            cases,
            minCases: SELF_TEST_MIN_CASES,
            minRejectCases: SELF_TEST_MIN_REJECT,
        });
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

export function main(argv: readonly string[]): number {
    if (argv.includes('--self-test')) return selfTest();
    const quiet = argv.includes('--quiet');
    const root = repoRoot();

    // `--cutting <X.Y.Z>` — the version being released. Present = refusal mode.
    const cutIdx = argv.indexOf('--cutting');
    let cutting: string | undefined;
    if (cutIdx >= 0) {
        cutting = argv[cutIdx + 1];
        if (cutting === undefined || cutting.startsWith('--')) {
            process.stderr.write('usage: lint_scheduled_deprecations [--cutting <X.Y.Z>] [--quiet]\n');
            return 2;
        }
    }

    // Shape-checked BEFORE any file work: a usage error cannot need the tree,
    // and validating it after the parse let a HeaderMismatchError mask it with
    // exit 1 where the caller had simply mistyped the version.
    let cutMajor: number | undefined;
    if (cutting !== undefined) {
        const m = /^v?(\d+)\./.exec(cutting.trim());
        if (!m) {
            process.stderr.write(
                `usage: --cutting expects a bare version (X.Y.Z), got "${cutting}"\n`,
            );
            return 2;
        }
        cutMajor = Number(m[1]);
    }

    const migration = path.join(root, MIGRATION_PATH);
    if (!fs.existsSync(migration)) {
        process.stderr.write(`❌  lint_scheduled_deprecations: ${MIGRATION_PATH} not found under ${root}\n`);
        return 1;
    }

    let rows: DeprecationRow[];
    try {
        rows = parseRows(fs.readFileSync(migration, 'utf-8'));
    } catch (exc) {
        if (exc instanceof HeaderMismatchError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    // A missing or malformed package.json is an environment error, not a
    // finding: without it the gate has no comparand at all. Reported as exit 2
    // per the contract at the top of this file, rather than as an unlisted
    // code and a stack trace.
    let shipped: number;
    try {
        shipped = shippedMajor(root);
    } catch (exc) {
        process.stderr.write(
            `❌  lint_scheduled_deprecations: cannot read the shipped major — ` +
                `${exc instanceof Error ? exc.message : String(exc)}\n`,
        );
        return 2;
    }
    const comparand = cutMajor ?? shipped;

    const ledger = new GateLedger('lint_scheduled_deprecations');
    const findings = evaluate(rows, comparand, root, ledger, cutting !== undefined);
    const tally = ledger.finalize();

    // Anti-vacuity. Zero rows means the heading moved or the table's format
    // drifted — the failure this gate is about, so it is never a pass. No
    // `allowEmpty`: an empty scheduled-deprecations table is not a success
    // state while `MIGRATION.md` itself instructs that a promise without a row
    // is untracked.
    try {
        reportScanned({
            gate: 'lint_scheduled_deprecations',
            scanned: tally.planned,
            units: 'scheduled-deprecation row(s)',
            roots: [MIGRATION_PATH],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    const unresolved = findings.filter((f) => f.kind === 'unresolved');
    const overdue = findings.filter((f) => f.kind === 'overdue');

    for (const f of unresolved) {
        process.stderr.write(
            `❌  lint_scheduled_deprecations: row ${String(f.row.index)} (${f.row.name}) — ` +
                `removal-due cell not resolvable: "${f.row.removalDueRaw}"\n` +
                '    The grammar is documented at the top of this gate. Either write a\n' +
                '    concrete major, or record the row as not pinned / a permanent keep.\n',
        );
    }

    const against =
        cutting === undefined
            ? `shipped ${String(shipped)}.x`
            : `the ${String(comparand)}.0 cut (shipped is ${String(shipped)}.x)`;

    for (const f of overdue) {
        const late =
            f.overdueBy === 0
                ? 'comes due AT'
                : `is ${String(f.overdueBy)} major(s) overdue against`;
        process.stdout.write(
            `⚠️  lint_scheduled_deprecations: ${f.row.name} — removal ${late} ${against}\n` +
                `      removal due: ${f.row.removalDueRaw}\n`,
        );
        if (f.livePaths.length > 0) {
            for (const p of f.livePaths) {
                process.stdout.write(`      still on disk: ${p}\n`);
            }
        } else {
            process.stdout.write(
                '      no path token in the row — the surface is named but its runtime\n' +
                    '      paths are not, so this gate cannot say whether they still ship.\n',
            );
        }
    }

    if (unresolved.length > 0) return 1;

    if (overdue.length > 0) {
        if (cutting !== undefined) {
            process.stderr.write(
                `\n❌  lint_scheduled_deprecations: ${String(overdue.length)} surface(s) due at or before ` +
                    `the ${String(comparand)}.0 cut.\n` +
                    '    Act on each row: perform the removal in its own change, or revise the\n' +
                    "    row's commitment and record why the surface stays. A deliberate\n" +
                    '    deferral belongs in the table, not in a release decision nobody can read.\n',
            );
            return 1;
        }
        if (!quiet) {
            process.stdout.write(
                '\n   Reported, not refused — this is an ordinary branch. `--cutting <X.Y.Z>`\n' +
                    '   turns the same finding into a refusal, measured against the TARGET major.\n',
            );
        }
        return 0;
    }

    if (!quiet) {
        ledger.report();
        process.stdout.write(
            `✅  lint_scheduled_deprecations: ${String(tally.planned)} row(s), none due against ${against}\n`,
        );
    }
    return 0;
}

function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (isCliEntry()) {
    process.exitCode = main(process.argv.slice(2));
}

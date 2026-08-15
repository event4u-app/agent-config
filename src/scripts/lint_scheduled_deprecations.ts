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
 *   0  no overdue surface, or overdue surfaces reported on an ordinary branch
 *   1  a row could not be parsed / resolved, the table is missing or empty, or
 *      an overdue surface was found while `--release-major` was passed
 *   2  usage error
 *
 * `--release-major` is the major-cut switch: an ordinary branch gets the
 * report, a release gets the refusal. That asymmetry is deliberate — an overdue
 * row can be a considered deferral, and a hard refusal on every branch would
 * turn a judgement into an outage. A deliberate deferral is expressible in the
 * table itself (a `permanent keep` row), which is what keeps the refusal honest
 * at the cut.
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

    const explicit = /(?:^|[^\d.])(\d+)(?:\.\d+){0,2}\b/.exec(text);
    const relativeAfterVersion = /next major after\s+(?:v)?(\d+)(?:\.(?:x|\d+))?/i.exec(text);
    const relativeToNotice = /(?:the major after that|next major after the notice)/i.test(text);

    if (relativeAfterVersion) {
        return { kind: 'major', major: Number(relativeAfterVersion[1]) + 1 };
    }
    if (relativeToNotice) {
        if (noticeMajor === undefined) return { kind: 'unresolved', cell };
        return { kind: 'major', major: noticeMajor + 1 };
    }
    if (explicit) {
        return { kind: 'major', major: Number(explicit[1]) };
    }
    return { kind: 'unresolved', cell };
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
    const rows: DeprecationRow[] = [];

    for (const line of lines) {
        if (/^##\s/.test(line)) {
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
            continue;
        }

        const idxNotice = header.findIndex((h) => h.includes('notice due'));
        const idxRemoval = header.findIndex((h) => h.includes('removal due'));
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
    /** `overdue` = removal was due at an earlier major than the shipped one. */
    kind: 'overdue' | 'unresolved';
    /** How many majors late; 0 for `unresolved`. */
    overdueBy: number;
    /** Path tokens from the row that still exist on disk. */
    livePaths: string[];
}

/** Compare every row against the shipped major and return what is wrong. */
export function evaluate(
    rows: readonly DeprecationRow[],
    currentMajor: number,
    root: string,
    ledger?: GateLedger,
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

        const overdueBy = currentMajor - removal.major;
        if (overdueBy > 0) {
            const livePaths = row.paths.filter((p) => fs.existsSync(path.join(root, p)));
            findings.push({ row, kind: 'overdue', overdueBy, livePaths });
            ledger?.fail(key, `removal due at ${String(removal.major)}.0, shipped major is ${String(currentMajor)}`);
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
const SELF_TEST_MIN_CASES = 4;
const SELF_TEST_MIN_REJECT = 3;

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
                    ['--release-major'],
                ),
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
                    ['--release-major'],
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
    const releaseMajor = argv.includes('--release-major');
    const root = repoRoot();

    const migration = path.join(root, MIGRATION_PATH);
    if (!fs.existsSync(migration)) {
        process.stderr.write(`❌  lint_scheduled_deprecations: ${MIGRATION_PATH} not found under ${root}\n`);
        return 1;
    }

    const rows = parseRows(fs.readFileSync(migration, 'utf-8'));
    const currentMajor = shippedMajor(root);
    const ledger = new GateLedger('lint_scheduled_deprecations');
    const findings = evaluate(rows, currentMajor, root, ledger);
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

    for (const f of overdue) {
        process.stdout.write(
            `⚠️  lint_scheduled_deprecations: ${f.row.name} — removal is ` +
                `${String(f.overdueBy)} major(s) overdue against shipped ${String(currentMajor)}.x\n` +
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
        if (releaseMajor) {
            process.stderr.write(
                `\n❌  lint_scheduled_deprecations: ${String(overdue.length)} overdue surface(s) at a major cut.\n` +
                    '    Act on each row: perform the removal in its own change, or revise the\n' +
                    "    row's commitment and record why the surface stays. A deliberate\n" +
                    '    deferral belongs in the table, not in a release decision nobody can read.\n',
            );
            return 1;
        }
        if (!quiet) {
            process.stdout.write(
                `\n   Reported, not refused — this is an ordinary branch. \`--release-major\`\n` +
                    '   turns the same finding into a refusal at the cut.\n',
            );
        }
        return 0;
    }

    if (!quiet) {
        ledger.report();
        process.stdout.write(
            `✅  lint_scheduled_deprecations: ${String(tally.planned)} row(s), none overdue ` +
                `against shipped ${String(currentMajor)}.x\n`,
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

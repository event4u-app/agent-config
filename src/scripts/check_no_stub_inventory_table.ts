#!/usr/bin/env tsx
/**
 * Stub-inventory-table guard.
 *
 * `agents/roadmaps/stubs/README.md` carried a hand-maintained index of the stub
 * files sitting beside it: two tables, 6 demand-gated rows and 27 transfer rows,
 * appended by hand by every roadmap-transfer session. It was the largest
 * *authored* merge-conflict path in the repository — everything above it in the
 * ranking is generated — and every row duplicated facts already in the stub it
 * pointed at. `3793855b3` deleted it on 2026-08-21, after the AI council chose
 * deletion over building a generator (both seats) and after all 33 rows were
 * checked cell by cell against their stub file.
 *
 * It came back on 2026-08-22. A merge (`28ba2f592`, PR #1505) reintroduced a
 * 12-row version; both parents of that merge lacked the table, so it was not a
 * mis-resolved `modify/delete` but a deliberate restore — taken against a note
 * in `agents/evidence/notes/drain-run-handoff.md` written in the same change as
 * the deletion for the express purpose of preventing one. Three further rows
 * were then appended by later sessions.
 *
 * That is the whole reason this gate exists rather than another paragraph: the
 * paragraph was tried, and it lost to a merge. Prose cannot refuse.
 *
 * WHAT IT REJECTS — the structure, never "tables"
 * ----------------------------------------------
 * Two signatures, both keyed to an inventory of the guarded file's own
 * directory:
 *
 *   1. a table header row whose first cell is `Stub` — the header both
 *      historical tables used (`| Stub | Transferred from | … |` and
 *      `| Stub | Triggers org-mode surface | Gates |`);
 *   2. a table body row whose FIRST cell links to a `.md` file in the SAME
 *      directory — an inventory row by construction.
 *
 * A `../`-prefixed or otherwise pathed link does not match: a prose table that
 * cites parent roadmaps is not an index of this directory. A future two-column
 * glossary, a decision matrix, or any table that does not enumerate the
 * neighbouring stubs is unaffected. This narrowness is deliberate and was asked
 * for by review: a blanket ban on markdown tables in the file would block
 * legitimate documentation to stop one specific regression.
 *
 * WHY A WATCH LIST AND NOT A TREE WALK
 * ------------------------------------
 * The guarded set is one known file, so there is no corpus to count, and a
 * one-path guard is exactly the shape that rots into a permanent pass when the
 * path moves — `check_safety_floor_untouched` announced "4 rules guarded" while
 * guarding none for months. `assertWatchlistResolves` refuses to report clean when its
 * targets do not resolve, so a rename reds this gate instead of retiring it
 * silently.
 *
 * Exit codes: 0 clean · 1 findings or a dead watch list.
 */
// ledger-exempt: the scope is ONE watch-list file, not a collected population — there is
// no per-target accounting to publish, and the empty path is already refused by
// assertWatchlistResolves rather than skipped. Same shape as check_branch_freshness.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { assertWatchlistResolves, DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/**
 * Self-test floors. Below these, `--self-test` fails instead of printing success —
 * deleting cases would otherwise be the cheapest route to a green self-test.
 */
const SELF_TEST_MIN_CASES = 5;
const SELF_TEST_MIN_REJECT = 3;

/** This script's repo-relative path, for the self-test's CLI invocations. */
const SELF = 'src/scripts/check_no_stub_inventory_table.ts';

/** Files whose inventory tables are banned. Repo-relative. */
export const GUARDED: readonly string[] = ['agents/roadmaps/stubs/README.md'];

/**
 * A header row that opens with the literal `Stub` column.
 *
 * Both deleted tables used it, and it is not a phrase a prose table reaches for
 * by accident: a first cell of exactly `Stub` announces a per-stub listing.
 */
const INVENTORY_HEADER = /^\|\s*Stub\s*\|/;

/**
 * A body row whose first cell links to a `.md` file in the same directory.
 *
 * `[^)/]*` is the load-bearing part: it excludes `../road-to-x.md` and any other
 * pathed target, so only a link to a sibling of the guarded file matches. That
 * is what makes this an inventory signature rather than a link count.
 */
const INVENTORY_ROW = /^\|\s*\[`?[^\]]*`?\]\([^)/]*\.md\)/;

export interface Finding {
    readonly file: string;
    readonly line: number;
    readonly kind: 'inventory-header' | 'inventory-row';
    readonly text: string;
}

export function scan_file(rel: string, text: string): Finding[] {
    const findings: Finding[] = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (INVENTORY_HEADER.test(line)) {
            findings.push({ file: rel, line: i + 1, kind: 'inventory-header', text: line.trim() });
        } else if (INVENTORY_ROW.test(line)) {
            findings.push({ file: rel, line: i + 1, kind: 'inventory-row', text: line.trim() });
        }
    }
    return findings;
}

/**
 * Read `--root <path>` / `--root=<path>` out of argv.
 *
 * Parsed by NAME, never by position. `lint_handoffs` took `args[0]` as its scan
 * root, and the Taskfile injects `--quiet` first — so the flag became the root,
 * the scan found nothing, and the gate was red under the argv CI runs while
 * green under a bare probe. A named flag cannot make that mistake.
 */
export function parseRoot(argv: readonly string[], fallback: string): string {
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!;
        if (a.startsWith('--root=')) return path.resolve(a.slice('--root='.length));
        if (a === '--root' && argv[i + 1] !== undefined) return path.resolve(argv[i + 1]!);
    }
    return fallback;
}

export function main(argv: readonly string[] = process.argv.slice(2), root?: string): number {
    const QUIET = argv.includes('--quiet');
    root = root ?? parseRoot(argv, ROOT);
    let present: readonly string[];
    try {
        present = assertWatchlistResolves({
            gate: 'check_no_stub_inventory_table',
            candidates: GUARDED,
            repoRoot: root,
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stdout.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    const findings: Finding[] = [];
    for (const rel of present) {
        findings.push(...scan_file(rel, fs.readFileSync(path.join(root, rel), 'utf-8')));
    }

    // Outside the --quiet guard on purpose: CI passes --quiet, and a gate whose
    // count disappears under the real argv reads as `silent` to the coverage guard.
    reportScanned({
        gate: 'check_no_stub_inventory_table',
        scanned: present.length,
        units: 'guarded file(s)',
        roots: GUARDED,
    });

    if (findings.length === 0) {
        if (!QUIET) process.stdout.write('✅  No stub-inventory table in the guarded file(s).\n');
        return 0;
    }

    process.stdout.write(
        `❌  Stub-inventory table reintroduced — ${String(findings.length)} row(s):\n`,
    );
    for (const f of findings) {
        process.stdout.write(`    ${f.file}:${String(f.line)}: ${f.kind} — ${f.text.slice(0, 100)}\n`);
    }
    process.stdout.write(
        '\nThe stub files ARE the inventory; `ls agents/roadmaps/stubs/*.md` lists them.\n' +
            'If you reached this while resolving a merge conflict, the resolution\n' +
            'WITHOUT a table is the correct one — the table was deleted deliberately\n' +
            '(3793855b3, AI council 2026-08-21) and restored once by a merge already.\n' +
            'If you need a per-stub fact, it is in that stub; all 33 rows were verified\n' +
            'against their stub file before deletion and all 15 again before the second.\n',
    );
    return 1;
}

/**
 * Build a fixture repository holding one guarded file with `body`, or none at all
 * when `body` is null (the dead-watch-list case).
 */
function _fixture(body: string | null): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stub-inv-self-'));
    if (body !== null) {
        const target = path.join(dir, GUARDED[0]!);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, body);
    }
    return dir;
}

/**
 * Prove the gate's rejections still fire, through the CLI a contributor runs.
 *
 * The three rejecting cases are the sabotage probes this gate was verified with
 * by hand before it landed; keeping them here is what stops the verification
 * from being a one-time claim in a commit message.
 */
export function selfTest(): number {
    const cases: SelfTestCase[] = [
        {
            name: 'rejects a restored transfer table (header + rows)',
            expect: 'reject',
            run: () =>
                runGateCli(
                    ROOT,
                    SELF,
                    ['--quiet', '--root', _fixture(
                        '| Stub | Transferred from |\n|---|---|\n' +
                            '| [`road-to-a.md`](road-to-a.md) | p |\n',
                    )],
                    ROOT,
                ),
        },
        {
            name: 'rejects the inventory header on its own',
            expect: 'reject',
            run: () => runGateCli(ROOT, SELF, ['--quiet', '--root', _fixture('| Stub | Gates |\n')], ROOT),
        },
        {
            name: 'rejects a dead watch list rather than reporting clean',
            expect: 'reject',
            run: () => runGateCli(ROOT, SELF, ['--quiet', '--root', _fixture(null)], ROOT),
        },
        {
            name: 'accepts a guarded file with no inventory table',
            expect: 'accept',
            run: () =>
                runGateCli(
                    ROOT,
                    SELF,
                    ['--quiet', '--root', _fixture('# Stubs\n\nThe directory is the index.\n')],
                    ROOT,
                ),
        },
        {
            name: 'accepts a glossary table and a table citing parent roadmaps',
            expect: 'accept',
            run: () =>
                runGateCli(
                    ROOT,
                    SELF,
                    ['--quiet', '--root', _fixture(
                        '| Term | Meaning |\n|---|---|\n| capability-gated | env missing |\n\n' +
                            '| Parent | Phase |\n|---|---|\n' +
                            '| [`road-to-x.md`](../archive/road-to-x.md) | 2.1 |\n',
                    )],
                    ROOT,
                ),
        },
    ];
    return runSelfTest({
        gate: 'check_no_stub_inventory_table',
        cases,
        minCases: SELF_TEST_MIN_CASES,
        minRejectCases: SELF_TEST_MIN_REJECT,
    });
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    const argv = process.argv.slice(2);
    if (argv.includes('--self-test') && process.env['GATE_SELF_TEST_CHILD'] !== '1') {
        process.exit(selfTest());
    }
    process.exit(main(argv));
}

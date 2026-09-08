#!/usr/bin/env node
/**
 * `check_continuity_surface` — the continuity estate walks DOWN, and a new
 * continuity mechanism pays for itself.
 *
 * WHY THIS EXISTS
 * ---------------
 * Twelve archived roadmaps built this package's continuity layers and not one
 * retired the layer before it. `road-to-one-continuity-record` recorded that as
 * its own Risk 1 — "the record is added and nothing is retired" — and stated
 * its success as five numbers rather than a sentence:
 *
 *     public continuity commands:       0
 *     session resume pickers:           0
 *     persistent continuity artefacts:  1
 *     continuity schemas:               1
 *     normal-path manual actions:       0
 *
 * A number nobody derives is a number nobody can be wrong about. Until this
 * gate there was no command in the tree that produced those five figures: a
 * grep for `end-state` over `src/scripts/` returned one unrelated hit, and a
 * grep for `continuity` returned implementation prose and an unrelated
 * AI-video seam. So "re-derived by command rather than asserted" was an
 * obligation with no instrument.
 *
 * WHY IT PUBLISHES AN INVENTORY AND NOT ONLY FIVE NUMBERS
 * ------------------------------------------------------
 * The AI council of 2026-09-07 (2 seats, both present) found the failure mode
 * before it happened: the five numbers are gameable by NAMING. Position 3 can
 * be made to read `1` with nothing retired, simply by classifying an artefact
 * as something other than "continuity". Both seats required the inventory rule
 * to be behavioural instead —
 *
 *     Any persisted state written for later session/run recovery,
 *     verification, or context restoration must be listed, whether or not it
 *     is labeled "continuity."
 *
 * — and required exclusions to stay legitimate AND stay visible. This gate
 * therefore DISCOVERS its artefact corpus from behaviour (every distinct leaf
 * under `agents/runtime/state/` that any source file names) rather than from
 * vocabulary, requires the committed inventory to dispose of every one of them,
 * and prints the exclusions with their reasons on every run — including the one
 * the council named as the worked example, `checkpoints/`.
 *
 * THREE CHECKS, ONE GATE
 * ----------------------
 * T1 — inventory validity. Every discovered leaf is disposed of, every row's
 * `locus` still resolves, every row carries a reason. A retirement is performed
 * by DELETING a row, so a row left standing over a deleted surface reddens: the
 * count cannot claim a subtraction the tree did not make.
 *
 * T2 — the ratchet. No axis may read HIGHER than it reads on the base ref. The
 * floor is measured, not stored, from the base ref's own copy of the inventory
 * — a single file, so `git show` rather than a materialised subtree, the same
 * reasoning `check_estate_count` records for its concern axis. A count BELOW
 * the floor is a drawdown and passes.
 *
 * T3 — the rule is stated where the check fails. The roadmap requires that a
 * reader who trips this gate learns the rule without going to find it, so the
 * failure text carries it verbatim rather than a pointer.
 *
 * WHAT THIS GATE DELIBERATELY DOES NOT DO
 * ---------------------------------------
 * It does not fail when an axis is above target. The targets are the roadmap's
 * destination, not this gate's admission criterion: failing on them would red
 * the tree on every branch until the whole retirement lands, which is the
 * "gate that fails its own tree on debt the landing change did not cause"
 * this repository reverts rather than adopts. Distance-to-target is REPORTED
 * on every run and ratcheted downward; closing it is the roadmap's job.
 *
 *     ./scripts-run src/scripts/check_continuity_surface
 *     ./scripts-run src/scripts/check_continuity_surface --json
 *     ./scripts-run src/scripts/check_continuity_surface --base origin/main
 *     ./scripts-run src/scripts/check_continuity_surface --self-test
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    AXES,
    INVENTORY_POSIX,
    TARGETS,
    countAxes,
    discoverStateLeaves,
    readInventory,
    validateInventory,
    type Axis,
    type Inventory,
    type InventoryRow,
    type SurfaceCounts,
} from './_lib/continuity_surface.js';
import { resolveBaseRef } from './_lib/ratchet_base_ref.js';
import { runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const GATE = 'check_continuity_surface';

/**
 * Built by concatenation on purpose. The self-test below has to write fixture
 * files that LOOK like real state paths, and a contiguous literal would be
 * discovered by this gate's own walk — the gate would then red on its own
 * fixtures. Excluding this file from the walk was the other option and is
 * strictly worse: an excluded file is a blind spot, and the one file guaranteed
 * to be edited by whoever wants to weaken this gate is this one.
 */
const _STATE_PREFIX = 'agents/runtime/' + 'state/';

/**
 * The rule the ratchet encodes, verbatim from the parent roadmap. Printed at
 * the point of failure, per that roadmap's own verify line: "the rule is stated
 * where the check fails, not only here".
 */
const RULE =
    'A new continuity mechanism may be introduced only if it replaces an existing one, or\n' +
    'demonstrably covers a capability the one record cannot.';

function repoRootFrom(start: string): string {
    let cur = path.resolve(start);
    for (;;) {
        if (fs.existsSync(path.join(cur, INVENTORY_POSIX))) return cur;
        const parent = path.dirname(cur);
        if (parent === cur) return path.resolve(start);
        cur = parent;
    }
}

function gitShow(repoRoot: string, ref: string, rel: string): string | null {
    const res = spawnSync('git', ['show', `${ref}:${rel}`], {
        cwd: repoRoot,
        encoding: 'utf-8',
        maxBuffer: 64 * 1024 * 1024,
    });
    if (res.status !== 0 || typeof res.stdout !== 'string') return null;
    return res.stdout;
}

function countsAt(repoRoot: string, ref: string): SurfaceCounts | null {
    const raw = gitShow(repoRoot, ref, INVENTORY_POSIX);
    if (raw === null) return null;
    try {
        const parsed = JSON.parse(raw) as { rows?: unknown };
        const rows = Array.isArray(parsed.rows) ? (parsed.rows as InventoryRow[]) : [];
        return countAxes({ rows });
    } catch {
        return null;
    }
}

function renderInventory(inv: Inventory, write: (s: string) => void): void {
    for (const axis of AXES) {
        const rows = inv.rows.filter((r) => r.axis === axis);
        const counted = rows.filter((r) => r.disposition === 'counted');
        const excluded = rows.filter((r) => r.disposition === 'excluded');
        write(`\n  ${axis} — counted ${String(counted.length)}, target ${String(TARGETS[axis])}\n`);
        for (const row of counted) {
            write(`    ▸ ${row.id}  (${row.locus})\n`);
        }
        if (excluded.length > 0) {
            write(`    excluded (${String(excluded.length)}) — visible by contract, never silent:\n`);
            for (const row of excluded) {
                write(`      · ${row.id}  (${row.locus})\n`);
                write(`        ${row.reason}\n`);
            }
        }
    }
}

export interface RunOptions {
    repoRoot?: string;
    baseRef?: string | null;
    json?: boolean;
    quiet?: boolean;
    write?: (s: string) => void;
}

export function run(opts: RunOptions = {}): number {
    const write = opts.write ?? ((s: string) => void process.stdout.write(s));
    const repoRoot = opts.repoRoot ?? repoRootFrom(process.cwd());

    let inv: Inventory;
    try {
        inv = readInventory(repoRoot);
    } catch (exc) {
        write(`❌  ${GATE}: cannot read ${INVENTORY_POSIX} — ${String(exc)}\n`);
        return 1;
    }

    const discovered = discoverStateLeaves(repoRoot);
    try {
        reportScanned(
            {
                gate: GATE,
                scanned: discovered.length + inv.rows.length,
                units: 'inventory row(s) + discovered state leaf/leaves',
                roots: [INVENTORY_POSIX, 'src/scripts', 'src/agent-src/scripts', 'src/cli'],
            },
            (chunk: string) => {
                write(String(chunk));
                return true;
            },
        );
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    const findings = validateInventory(repoRoot, inv, discovered);
    const counts = countAxes(inv);

    const baseRef = opts.baseRef === undefined ? resolveBaseRef(repoRoot) : opts.baseRef;
    const floor = baseRef === null ? null : countsAt(repoRoot, baseRef);
    const grew: Array<{ axis: Axis; floor: number; live: number }> = [];
    if (floor !== null) {
        for (const axis of AXES) {
            if (counts[axis] > floor[axis]) {
                grew.push({ axis, floor: floor[axis], live: counts[axis] });
            }
        }
    }

    if (opts.json === true) {
        write(
            JSON.stringify(
                {
                    gate: GATE,
                    counts,
                    targets: TARGETS,
                    base_ref: baseRef,
                    floor,
                    grew,
                    findings,
                    discovered_leaves: discovered.length,
                    inventory_rows: inv.rows.length,
                },
                null,
                2,
            ) + '\n',
        );
        return findings.length > 0 || grew.length > 0 ? 1 : 0;
    }

    if (opts.quiet !== true) {
        write(`\n${GATE}: the five end-state numbers, derived from ${INVENTORY_POSIX}\n`);
        renderInventory(inv, write);
        write('\n  ');
        write(AXES.map((a) => String(counts[a])).join(' / '));
        write('   (target ');
        write(AXES.map((a) => String(TARGETS[a])).join(' / '));
        write(')\n');
        const remaining = AXES.filter((a) => counts[a] !== TARGETS[a]);
        if (remaining.length === 0) {
            write('  ✅  every axis is at target.\n');
        } else {
            write(
                `  ·  ${String(remaining.length)} axis/axes above target — reported, not failed: ` +
                    'the targets are the roadmap destination, not this gate\'s admission criterion.\n',
            );
        }
        if (floor === null) {
            write(
                `  ·  no floor: ${baseRef === null ? 'no base ref resolved' : `${baseRef} carries no ${INVENTORY_POSIX}`} — ` +
                    'the ratchet did not run this time.\n',
            );
        } else {
            write(`  ·  floor from ${String(baseRef)}: ${AXES.map((a) => String(floor[a])).join(' / ')}\n`);
        }
    }

    if (findings.length === 0 && grew.length === 0) {
        if (opts.quiet !== true) {
            write(`✅  ${GATE}: inventory describes the tree, and no axis grew.\n`);
        }
        return 0;
    }

    if (grew.length > 0) {
        write(`\n❌  ${GATE}: a continuity axis grew above the base ref.\n\n`);
        for (const g of grew) {
            write(`      ${g.axis}: ${String(g.floor)} → ${String(g.live)}\n`);
        }
        write('\n   The rule this ratchet encodes:\n\n');
        for (const line of RULE.split('\n')) write(`      ${line}\n`);
        write(
            '\n   So: retire one in the same change (delete its row — that is the subtraction),\n' +
                '   or state in the row\'s `reason` which capability the one record cannot cover.\n',
        );
    }

    if (findings.length > 0) {
        write(`\n❌  ${GATE}: ${String(findings.length)} inventory finding(s).\n\n`);
        for (const f of findings) {
            write(`      [${f.kind}] ${f.detail}\n`);
        }
        write(
            `\n   The inventory is ${INVENTORY_POSIX}. It is behavioural by contract: every\n` +
                '   persisted-state leaf under agents/runtime/state/ that any source names must be\n' +
                '   disposed of there, because a count keyed on the WORD "continuity" is gameable by\n' +
                '   renaming — which is the defect this gate exists to make impossible.\n',
        );
    }
    return 1;
}

function _mkRepo(dir: string, rows: unknown[]): void {
    fs.mkdirSync(path.join(dir, 'src', 'config'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'src', 'scripts'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, INVENTORY_POSIX),
        JSON.stringify({ targets: TARGETS, rows }, null, 2),
    );
}

function _row(over: Partial<InventoryRow> = {}): InventoryRow {
    return {
        id: 'placeholder.json',
        axis: 'persistent_continuity_artefacts',
        disposition: 'excluded',
        locus: INVENTORY_POSIX,
        reason: 'a reason long enough to clear the substance floor this gate enforces',
        ...over,
    };
}


function selfTest(): number {
    const mk = (): string => fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'ccs-'));
    const silent = (): void => {};

    const cases: SelfTestCase[] = [
        {
            name: 'a persisted-state leaf the inventory does not dispose of → reject',
            expect: 'reject',
            run: () => {
                const dir = mk();
                _mkRepo(dir, []);
                fs.writeFileSync(
                    path.join(dir, 'src', 'scripts', 'newthing.ts'),
                    `const P = '${_STATE_PREFIX}brand-new-cache.json';\n`,
                );
                return run({ repoRoot: dir, baseRef: null, quiet: true, write: silent });
            },
        },
        {
            name: 'a row whose locus no longer resolves → reject (a claimed retirement the tree did not make)',
            expect: 'reject',
            run: () => {
                const dir = mk();
                _mkRepo(dir, [_row({ id: 'ghost', locus: 'src/scripts/deleted_thing.ts' })]);
                return run({ repoRoot: dir, baseRef: null, quiet: true, write: silent });
            },
        },
        {
            name: 'a counted axis above the base-ref floor → reject',
            expect: 'reject',
            run: () => {
                const dir = mk();
                _mkRepo(dir, [
                    _row({ id: 'a', disposition: 'counted' }),
                    _row({ id: 'b', disposition: 'counted' }),
                ]);
                const git = (args: string[]): void => {
                    spawnSync('git', args, { cwd: dir, encoding: 'utf-8' });
                };
                git(['init', '-q']);
                git(['config', 'user.email', 'g@example.com']);
                git(['config', 'user.name', 'g']);
                // Base carries ONE counted row; HEAD carries two.
                _mkRepo(dir, [_row({ id: 'a', disposition: 'counted' })]);
                git(['add', '-A']);
                git(['commit', '-qm', 'base']);
                const base = spawnSync('git', ['rev-parse', 'HEAD'], {
                    cwd: dir,
                    encoding: 'utf-8',
                }).stdout.trim();
                _mkRepo(dir, [
                    _row({ id: 'a', disposition: 'counted' }),
                    _row({ id: 'b', disposition: 'counted' }),
                ]);
                return run({ repoRoot: dir, baseRef: base, quiet: true, write: silent });
            },
        },
        {
            name: 'a row with no reason of substance → reject',
            expect: 'reject',
            run: () => {
                const dir = mk();
                _mkRepo(dir, [_row({ id: 'terse', reason: 'because' })]);
                return run({ repoRoot: dir, baseRef: null, quiet: true, write: silent });
            },
        },
        {
            name: 'a leaf named only inside a *.test.ts fixture is not a surface → accept',
            expect: 'accept',
            run: () => {
                const dir = mk();
                // A real leaf as well, so the corpus is non-empty and the case
                // isolates the ONE property under test: the `.test.ts` leaf is
                // not flagged. Without it the gate would refuse an empty scan
                // and the case would pass for the wrong reason.
                _mkRepo(dir, [_row({ id: 'real-cache.json' })]);
                fs.writeFileSync(
                    path.join(dir, 'src', 'scripts', 'thing.ts'),
                    `const P = '${_STATE_PREFIX}real-cache.json';\n`,
                );
                fs.writeFileSync(
                    path.join(dir, 'src', 'scripts', 'thing.test.ts'),
                    `const P = '${_STATE_PREFIX}fixture-only.json';\n`,
                );
                return run({ repoRoot: dir, baseRef: null, quiet: true, write: silent });
            },
        },
        {
            name: 'a disposed leaf plus a resolving locus, no growth → accept',
            expect: 'accept',
            run: () => {
                const dir = mk();
                _mkRepo(dir, [_row({ id: 'real-cache.json' })]);
                fs.writeFileSync(
                    path.join(dir, 'src', 'scripts', 'thing.ts'),
                    `const P = '${_STATE_PREFIX}real-cache.json';\n`,
                );
                return run({ repoRoot: dir, baseRef: null, quiet: true, write: silent });
            },
        },
        {
            name: 'the shipped inventory describes the shipped tree → accept',
            expect: 'accept',
            run: () =>
                run({
                    repoRoot: repoRootFrom(path.dirname(fileURLToPath(import.meta.url))),
                    baseRef: null,
                    quiet: true,
                    write: silent,
                }),
        },
    ];

    return runSelfTest({ gate: GATE, cases, minCases: 6, minRejectCases: 4 });
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) return selfTest();
    const baseIdx = argv.indexOf('--base');
    const baseRef = baseIdx >= 0 ? (argv[baseIdx + 1] ?? null) : undefined;
    return run({
        json: argv.includes('--json'),
        quiet: argv.includes('--quiet'),
        ...(baseRef !== undefined ? { baseRef } : {}),
    });
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}

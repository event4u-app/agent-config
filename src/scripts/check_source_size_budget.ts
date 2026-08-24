#!/usr/bin/env tsx
/**
 * check_source_size_budget — a growth ratchet over oversized TypeScript sources.
 *
 * ## The gap
 *
 * Every other size budget in this suite guards prose. Rules carry a char cap
 * (`lint_load_context.cap_for`). Skills carry a token budget class
 * (`lint_token_budget_discipline`). The always-loaded set carries two budgets
 * (`check_always_budget`). The on-demand depth layer carries a per-file char
 * ceiling (`check_depth_budget`). The 1,063 hand-written `.ts` files this
 * package ships carry **none** — which is where the largest artefacts sit:
 * `install.ts` at 5,461 lines, `skill_linter.ts` at 4,742, `council_cli.ts` at
 * 4,058.
 *
 * Fifteen files are over 1,500 lines. Nothing measured that, so nothing stopped
 * it, and nothing would notice a sixteenth.
 *
 * ## Why a ratchet BEFORE a split — the ordering is the decision
 *
 * The obvious move is to split the god-files. Doing that first is how a refactor
 * becomes unreviewable: a 5,461-line file broken into six is a diff nobody can
 * read, with nothing asserting it improved anything. A ratchet freezes the
 * number where it is, which makes every later split a **lowering commit** whose
 * gain is visible in one integer. That ordering is the deliberate call carried
 * from the roadmap this gate closes, not an implementation detail.
 *
 * ## What the ratchet counts, and why it is NOT a file count
 *
 * The metric is **total lines above the ceiling**, summed across the tree:
 *
 *     Σ max(0, lines(f) − CEILING)   for every .ts under src/
 *
 * A file *count* was the obvious shape and it is the weak one: `install.ts`
 * could grow 5,461 → 9,000 and the count of over-ceiling files would not move,
 * so the gate would stay green while the exact defect it exists for got worse.
 * That objection was raised against the count shape and it is correct. Summing
 * the excess costs the same one integer and closes it:
 *
 * - a listed file growing by one line raises the total → **regressed**, fails;
 * - a new file over the ceiling raises the total → **regressed**, fails;
 * - splitting any god-file lowers the total → **improved**, tighten the ratchet;
 * - the 56-day expiry in `_lib/gate_baseline` fails a total that never drops,
 *   so "freeze it and forget it" is not a stable state.
 *
 * That last clause is the one that separates a control from a number that feels
 * like progress. A ceiling with no forcing function would leave these fifteen
 * files at these fifteen sizes indefinitely with the gate green the whole time.
 *
 * ## What the ceiling is — and what it is NOT
 *
 * 1,500 lines is a **growth ratchet, not a quality threshold**, and the same
 * honesty its sibling `check_depth_budget` states applies here: nothing claims a
 * 1,499-line module is comprehensible and a 1,501-line one is not. The number
 * was chosen by measurement of this tree and of the ledger it produces — 15
 * files over 1,500, versus 44 over 1,000 and 75 over 800. A ceiling that lists
 * 75 files is an allowlist, and this repository's own rules call an allowlist
 * past 20 entries evidence that the linter is wrong. 1,500 is the tightest
 * ceiling whose ledger stays signal.
 *
 * Exit codes: 0 = at or under baseline, 1 = the excess grew (or the baseline
 * went stale), 2 = usage.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { asOf } from './_lib/as_of.js';
import { checkRatchet } from './_lib/gate_baseline.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REAL_REPO_ROOT = path.dirname(path.dirname(SCRIPTS_DIR));

/**
 * The ceiling, in lines.
 *
 * Lines rather than chars — unlike the prose layers, a source file's reviewable
 * unit is the line, and a line count is what every reader, editor and diff
 * already reports.
 */
export const SOURCE_CEILING_LINES = 1_500;

/** The root this gate walks. */
export const SOURCE_ROOTS = ['src'] as const;

export interface SourceFile {
    readonly file: string;
    readonly lines: number;
}

function* walk(dir: string): Generator<string> {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === 'node_modules') continue;
            yield* walk(full);
        } else if (e.isFile() && e.name.endsWith('.ts')) {
            // Same two exclusions this repository's own gate-population
            // classifier makes (`_lib/gate_population.ts`), for the same stated
            // reasons: a type declaration has no runtime behaviour, and a test
            // file is not the reviewable code this ceiling is aimed at. Latent
            // rather than cosmetic — a GENERATED `.d.ts` over the ceiling would
            // otherwise red a ratchet that exists to bound hand-written code.
            if (e.name.endsWith('.d.ts') || e.name.endsWith('.test.ts')) continue;
            yield full;
        }
    }
}

export function collectSourceFiles(repoRoot: string): string[] {
    const out: string[] = [];
    for (const root of SOURCE_ROOTS) {
        for (const f of walk(path.join(repoRoot, root))) {
            out.push(f);
        }
    }
    return [...new Set(out)].sort();
}

/**
 * Count lines the way `wc -l` does — newline characters.
 *
 * Stated rather than left implicit: a file with no trailing newline reads one
 * lower than an editor would show. Every file in this tree ends with one, and
 * pinning the convention to `wc -l` means a contributor can reproduce the
 * gate's number with a command they already know.
 */
export function countLines(text: string): number {
    let n = 0;
    for (let i = 0; i < text.length; i += 1) {
        if (text[i] === '\n') n += 1;
    }
    return n;
}

export function measure(repoRoot: string, files: readonly string[]): SourceFile[] {
    const out: SourceFile[] = [];
    for (const f of files) {
        // Deliberately NOT wrapped in a try/catch that `continue`s. A file this
        // walker just enumerated and cannot read is a real problem, and a bare
        // `continue` is the silent skip `_lib/gate_ledger` exists to catch: the
        // target is already planned, so swallowing the error only defers the
        // failure into an `UnaccountedTargetsError` naming a file whose read
        // nobody can connect to it. Letting the read throw names the file and
        // the reason. The ledger's skip vocabulary carries no code for
        // "unreadable", and widening that shared union is not this change.
        const text = fs.readFileSync(f, 'utf-8');
        out.push({ file: path.relative(repoRoot, f).split(path.sep).join('/'), lines: countLines(text) });
    }
    return out;
}

/** Lines a single file carries above the ceiling; 0 when it is within budget. */
export function excessOf(file: SourceFile, ceiling: number = SOURCE_CEILING_LINES): number {
    return Math.max(0, file.lines - ceiling);
}

/** The ratchet value: total lines above the ceiling across the whole tree. */
export function totalExcess(
    files: readonly SourceFile[],
    ceiling: number = SOURCE_CEILING_LINES,
): number {
    let sum = 0;
    for (const f of files) sum += excessOf(f, ceiling);
    return sum;
}

interface Args {
    readonly json: boolean;
    readonly quiet: boolean;
}

function parseArgs(argv: readonly string[]): Args {
    let json = false;
    let quiet = false;
    for (const arg of argv) {
        if (arg === '--json') { json = true; }
        else if (arg === '--quiet') { quiet = true; }
        else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: check_source_size_budget [--json] [--quiet]\n');
            process.exit(0);
        } else {
            process.stderr.write(`check_source_size_budget: unrecognized argument: ${arg}\n`);
            process.exit(2);
        }
    }
    return { json, quiet };
}

export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cssb-selftest-'));
    const mkRepo = (bodies: Record<string, number>, baseline?: number): string => {
        const root = fs.mkdtempSync(path.join(tmp, 'repo-'));
        for (const [rel, lines] of Object.entries(bodies)) {
            const p = path.join(root, rel);
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, '//\n'.repeat(lines), 'utf-8');
        }
        const cfg = path.join(root, 'src', 'config');
        fs.mkdirSync(cfg, { recursive: true });
        // Absent baseline ⇒ any excess is a violation, which is the
        // discrimination most cases need. A supplied baseline is how the
        // per-file-growth case proves the metric is not a file count.
        const gates =
            baseline === undefined
                ? {}
                : {
                      check_source_size_budget: {
                          count: baseline,
                          landed: asOf().toISOString().slice(0, 10),
                          note: 'self-test fixture',
                      },
                  };
        fs.writeFileSync(
            path.join(cfg, 'gate-violation-baselines.json'),
            JSON.stringify({ gates }),
            'utf-8',
        );
        return root;
    };
    const run = (root: string): number => {
        process.env['CHECK_SOURCE_SIZE_BUDGET_ROOT'] = root;
        try {
            return runGateCli(
                REAL_REPO_ROOT,
                'src/scripts/check_source_size_budget.ts',
                ['--quiet'],
                root,
            );
        } finally {
            delete process.env['CHECK_SOURCE_SIZE_BUDGET_ROOT'];
        }
    };

    try {
        const over = mkRepo({ 'src/big.ts': SOURCE_CEILING_LINES + 1 });
        const under = mkRepo({ 'src/ok.ts': SOURCE_CEILING_LINES - 1 });
        const exact = mkRepo({ 'src/edge.ts': SOURCE_CEILING_LINES });
        const empty = mkRepo({ 'README.md': 10 });
        // The discriminator against a file-count ratchet: ONE over-ceiling file
        // in both trees, so a count would read 1 = 1 and pass. The excess grew
        // by 100 lines, so this metric fails.
        const grown = mkRepo({ 'src/big.ts': SOURCE_CEILING_LINES + 200 }, 100);
        const shrunk = mkRepo({ 'src/big.ts': SOURCE_CEILING_LINES + 50 }, 100);
        return runSelfTest({
            gate: 'check_source_size_budget',
            minCases: 4,
            minRejectCases: 3,
            cases: [
                {
                    name: 'a file one line over the ceiling is rejected',
                    expect: 'reject',
                    run: () => run(over),
                },
                {
                    name: 'a file one line under the ceiling passes',
                    expect: 'accept',
                    run: () => run(under),
                },
                {
                    name: 'the ceiling itself is inclusive — exactly at the limit passes',
                    expect: 'accept',
                    run: () => run(exact),
                },
                {
                    name: 'a dead scan root is rejected, not reported as clean',
                    expect: 'reject',
                    run: () => run(empty),
                },
                {
                    name: 'an existing over-ceiling file that GREW is rejected — the metric is excess lines, not a file count',
                    expect: 'reject',
                    run: () => run(grown),
                },
                {
                    name: 'an over-ceiling file that shrank passes and asks for a tighter ratchet',
                    expect: 'accept',
                    run: () => run(shrunk),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv?: readonly string[]): number {
    const raw = argv ?? process.argv.slice(2);
    if (raw.includes('--self-test')) {
        return selfTest();
    }
    const args = parseArgs(raw);
    // Root derived from this file's own location, so the gate is robust to the
    // cwd a wrapper or hook invokes it from. The env override exists so the
    // self-test can drive the REAL binary against a synthetic tree; deliberately
    // NOT a cwd fallback, because a "fall back to the real repo when the given
    // root looks empty" rule would make the dead-scan-root case silently pass.
    const root = process.env['CHECK_SOURCE_SIZE_BUDGET_ROOT'] ?? REAL_REPO_ROOT;

    const files = collectSourceFiles(root);
    const ledger = new GateLedger('check_source_size_budget');
    ledger.plan(files.map((f) => path.relative(root, f).split(path.sep).join('/')));

    const measured = measure(root, files);
    const over = measured
        .filter((m) => excessOf(m) > 0)
        .sort((a, b) => b.lines - a.lines);
    const overSet = new Set(over.map((o) => o.file));
    for (const m of measured) {
        if (overSet.has(m.file)) {
            ledger.fail(
                m.file,
                `${String(m.lines)} lines, ${String(excessOf(m))} over ceiling ${String(SOURCE_CEILING_LINES)}`,
            );
        } else {
            ledger.complete(m.file);
        }
    }
    const tally = ledger.finalize();
    const excess = totalExcess(measured);

    // `--json` must emit JSON and nothing else, so a caller can pipe it to a
    // JSON reader. Both of the calls below normally append prose to the same
    // stdout, which would make the document unparseable — so under `--json` the
    // scan report is routed to a no-op writer (the `assertScanned` dead-root
    // check inside it still runs, it just does not print) and the ratchet
    // verdict is carried as a FIELD rather than as a trailing paragraph.
    if (args.json) {
        reportScanned(
            {
                gate: 'check_source_size_budget',
                scanned: measured.length,
                units: 'source file(s)',
                roots: [...SOURCE_ROOTS],
            },
            () => true,
        );
        const verdict = checkRatchet({
            gate: 'check_source_size_budget',
            actual: excess,
            repoRoot: root,
        });
        process.stdout.write(
            `${JSON.stringify(
                {
                    version: 1,
                    ceiling: SOURCE_CEILING_LINES,
                    excess_lines: excess,
                    over: over.map((o) => ({ ...o, excess: excessOf(o) })),
                    scanned: measured.length,
                    ledger: tally,
                    verdict: {
                        status: verdict.status,
                        ok: verdict.ok,
                        baseline: verdict.baseline,
                        message: verdict.message,
                    },
                },
                null,
                2,
            )}\n`,
        );
        return verdict.ok ? 0 : 1;
    }

    if (!args.quiet && over.length > 0) {
        process.stdout.write(
            `\nOver the ${String(SOURCE_CEILING_LINES)}-line source ceiling ` +
                '(a growth ratchet, NOT a measured quality threshold):\n',
        );
        for (const o of over) {
            process.stdout.write(
                `  ${String(o.lines).padStart(6, ' ')}  (+${String(excessOf(o)).padStart(5, ' ')})  ${o.file}\n`,
            );
        }
        process.stdout.write(`  ${'—'.repeat(6)}\n  total excess: ${String(excess)} line(s)\n`);
    }

    reportScanned({
        gate: 'check_source_size_budget',
        scanned: measured.length,
        units: 'source file(s)',
        roots: [...SOURCE_ROOTS],
    });

    const verdict = checkRatchet({
        gate: 'check_source_size_budget',
        actual: excess,
        repoRoot: root,
    });
    if (verdict.ok) {
        process.stdout.write(`\n⚠️   ${verdict.message}\n`);
        return 0;
    }
    process.stderr.write(`\n❌  ${verdict.message}\n`);
    return 1;
}

const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
        return true;
    }
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
    process.exit(main());
}

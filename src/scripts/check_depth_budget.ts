#!/usr/bin/env tsx
/**
 * check_depth_budget — a per-file ceiling on the on-demand depth layer.
 *
 * ## The gap
 *
 * Rules carry a char cap (`lint_load_context.cap_for`). Skills carry a token
 * budget class (`lint_token_budget_discipline`). The always-loaded set carries
 * two budgets (`check_always_budget`). The 161 context and guideline files those
 * rules and skills *route to* carry none — which is where the budget the other
 * three gates defend leaks back in as on-demand bloat.
 *
 * The existence proof is in the corpus and is self-documenting:
 * `contexts/execution/roadmap-process-loop.md` states **"Size budget: ≤ 4,000
 * chars"** in its own header and is over 20,000. It declared a budget, nothing
 * measured it, and it went 5× over.
 *
 * ## What this number is — and what it is NOT
 *
 * 16,000 chars is a **growth ratchet, not a quality threshold.** Say it plainly
 * because the temptation to dress it up is exactly the failure this suite
 * records elsewhere: a published measurement over 7,308 trajectories was used
 * two days ago to set a *skill* ceiling at 3,500 tokens, and that measurement
 * does not transfer here. Skills are procedural and load together; depth files
 * are declarative and load one or two at a time. Applying the skill number to
 * this layer would be a percentile wearing a study's clothes.
 *
 * So the honest claim is narrow: 16,000 sits just above the current p99, it
 * makes the four existing outliers visible, and it stops a fifth from arriving
 * unnoticed. Nothing here claims a reader comprehends 15,999 chars and fails at
 * 16,001. If someone later measures comprehension degradation on *this* layer,
 * that measurement replaces this number and this paragraph.
 *
 * ## Why a ratchet rather than advisory
 *
 * The plan said advisory-until-classified. Advisory is right when a new gate
 * would land as an unfixable blocker — but it has a second-order cost this
 * repository has already paid: an advisory line in a gate that exits 0 is a
 * number nobody is obliged to move, and the four outliers would still be four
 * outliers a year from now.
 *
 * The ratchet gives both halves. The four current over-ceiling files are
 * recorded as a baseline and do not block; a fifth does. Shrink-only, so the
 * count may fall and never rise. That is enforcement without a flag day, and it
 * is the mechanism this suite already uses for exactly this shape.
 *
 * Exit codes: 0 = at or under baseline, 1 = a new over-ceiling file, 2 = usage.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { checkRatchet } from './_lib/gate_baseline.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REAL_REPO_ROOT = path.dirname(path.dirname(SCRIPTS_DIR));

/**
 * The ceiling, in characters.
 *
 * Deliberately expressed in chars, not tokens: every sibling budget in this
 * suite that must be cheap to check uses chars, and a char count is the one
 * measure that cannot drift with a tokenizer version.
 */
export const DEPTH_CEILING_CHARS = 16_000;

/** The two roots that make up the on-demand depth layer. */
export const DEPTH_ROOTS = ['src/agent-src/contexts', 'docs/guidelines'] as const;

export interface DepthFile {
    readonly file: string;
    readonly chars: number;
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
            yield* walk(full);
        } else if (e.isFile() && e.name.endsWith('.md')) {
            yield full;
        }
    }
}

export function collectDepthFiles(repoRoot: string): string[] {
    const out: string[] = [];
    for (const root of DEPTH_ROOTS) {
        for (const f of walk(path.join(repoRoot, root))) {
            out.push(f);
        }
    }
    // A file reachable from both roots would be counted twice; dedupe on the
    // resolved path so the published `scanned:` count is the number of distinct
    // artefacts judged.
    return [...new Set(out)].sort();
}

export function measure(repoRoot: string, files: readonly string[]): DepthFile[] {
    const out: DepthFile[] = [];
    for (const f of files) {
        let chars: number;
        try {
            chars = fs.readFileSync(f, 'utf-8').length;
        } catch {
            continue;
        }
        out.push({ file: path.relative(repoRoot, f).split(path.sep).join('/'), chars });
    }
    return out;
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
            process.stdout.write('usage: check_depth_budget [--json] [--quiet]\n');
            process.exit(0);
        } else {
            process.stderr.write(`check_depth_budget: unrecognized argument: ${arg}\n`);
            process.exit(2);
        }
    }
    return { json, quiet };
}

export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cdb-selftest-'));
    const mkRepo = (bodies: Record<string, number>): string => {
        const root = fs.mkdtempSync(path.join(tmp, 'repo-'));
        for (const [rel, size] of Object.entries(bodies)) {
            const p = path.join(root, rel);
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, 'x'.repeat(size), 'utf-8');
        }
        // A baseline of 0 makes any over-ceiling file a violation, which is the
        // discrimination the self-test needs to prove.
        const cfg = path.join(root, 'src', 'config');
        fs.mkdirSync(cfg, { recursive: true });
        fs.writeFileSync(
            path.join(cfg, 'gate-violation-baselines.json'),
            JSON.stringify({ gates: {} }),
            'utf-8',
        );
        return root;
    };
    const run = (root: string): number => {
        // `runGateCli` forwards the parent env, so this is how the child is
        // pointed at the synthetic tree.
        process.env['CHECK_DEPTH_BUDGET_ROOT'] = root;
        try {
            return runGateCli(REAL_REPO_ROOT, 'src/scripts/check_depth_budget.ts', ['--quiet'], root);
        } finally {
            delete process.env['CHECK_DEPTH_BUDGET_ROOT'];
        }
    };

    try {
        const over = mkRepo({ 'docs/guidelines/big.md': DEPTH_CEILING_CHARS + 1 });
        const under = mkRepo({ 'docs/guidelines/ok.md': DEPTH_CEILING_CHARS - 1 });
        const exact = mkRepo({ 'docs/guidelines/edge.md': DEPTH_CEILING_CHARS });
        const empty = mkRepo({ 'README.md': 10 });
        return runSelfTest({
            gate: 'check_depth_budget',
            minCases: 3,
            minRejectCases: 2,
            cases: [
                { name: 'a file one char over the ceiling is rejected', expect: 'reject', run: () => run(over) },
                { name: 'a file one char under the ceiling passes', expect: 'accept', run: () => run(under) },
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
    // Default to the root derived from this file's own location — robust to
    // whatever cwd a wrapper or hook invokes the gate from. The env override
    // exists so the self-test can drive the REAL binary against a synthetic
    // tree; deliberately NOT a cwd fallback, because a "use the real repo when
    // the given root looks empty" rule would make the dead-scan-root case
    // silently pass by scanning the wrong corpus — the exact failure the
    // `assertScanned` contract exists to catch.
    const root = process.env['CHECK_DEPTH_BUDGET_ROOT'] ?? REAL_REPO_ROOT;

    const files = collectDepthFiles(root);
    const ledger = new GateLedger('check_depth_budget');
    ledger.plan(files.map((f) => path.relative(root, f).split(path.sep).join('/')));

    const measured = measure(root, files);
    const over = measured.filter((m) => m.chars > DEPTH_CEILING_CHARS)
        .sort((a, b) => b.chars - a.chars);
    const overSet = new Set(over.map((o) => o.file));
    for (const m of measured) {
        if (overSet.has(m.file)) {
            ledger.fail(m.file, `${String(m.chars)} chars > ceiling ${String(DEPTH_CEILING_CHARS)}`);
        } else {
            ledger.complete(m.file);
        }
    }
    const tally = ledger.finalize();

    if (args.json) {
        process.stdout.write(
            `${JSON.stringify(
                { version: 1, ceiling: DEPTH_CEILING_CHARS, over, scanned: measured.length, ledger: tally },
                null,
                2,
            )}\n`,
        );
    } else if (!args.quiet && over.length > 0) {
        process.stdout.write(
            `\nOver the ${String(DEPTH_CEILING_CHARS)}-char depth ceiling ` +
                '(a growth ratchet, NOT a measured quality threshold):\n',
        );
        for (const o of over) {
            process.stdout.write(`  ${String(o.chars).padStart(7, ' ')}  ${o.file}\n`);
        }
    }

    reportScanned({
        gate: 'check_depth_budget',
        scanned: measured.length,
        units: 'depth file(s)',
        roots: [...DEPTH_ROOTS],
    });

    const verdict = checkRatchet({
        gate: 'check_depth_budget',
        actual: over.length,
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

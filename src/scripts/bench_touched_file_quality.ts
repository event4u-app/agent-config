#!/usr/bin/env node
/**
 * bench_touched_file_quality — what the shadow quality pass costs at stop.
 *
 * `road-to-touched-files-that-pass-their-own-tools` 1.4: record the `shadow`
 * variant's p95 over a five-file TypeScript fixture BEFORE any default moves.
 * Risk 1 of that roadmap is that a quality pass makes stop the slowest hook in
 * the chain, and 2.3 defers the `shadow → warn` flip to the owner. Neither
 * decision should be taken on an estimate.
 *
 * CORRECTED FROM REPRODUCTION — the step's premise was wrong, and the
 * correction is why this is a file rather than a patch.
 *
 * The step reads "the per-concern bench already measures `verify-before-complete`
 * at default". It does not. `bench_hook_latency.perConcernRows` is fed by
 * `blockingConcerns()`, which filters `hook_manifest.yaml` to
 * `severity: blocking`; `verify-before-complete` is declared `severity: advisory`
 * (manifest line ~122), so it has never had a per-concern row and there was no
 * `default` reading to add a `shadow` variant beside. Adding the concern to that
 * filter would have changed what "blocking" means in a report whose consumer
 * (step 3.3 of the kernel-plumbing roadmap) derives per-concern TIMEOUTS from it
 * — a timeout for an advisory concern is a different decision, and smuggling it
 * in through a measurement would have been the wrong place to take it.
 *
 * So this measures the pass directly, which is also the number the two open
 * decisions actually need: the slot p95 in `docs/hook-latency.json` is dominated
 * by spawn + bundle load, and what 1.4 asks about is the DELTA the pass adds.
 *
 * METHOD, pinned so the number reproduces:
 *   - A throwaway consumer-shaped project: `package.json` declaring `typescript`
 *     and `eslint`, five TypeScript files, a flat ESLint config, `git init`, and
 *     a `minimal-safe-diff.json` naming all five as this turn's touched files.
 *   - `node_modules` is SYMLINKED to this repository's, so `npx eslint` resolves
 *     a real, installed linter and runs offline. The measurement is therefore of
 *     a real tool over real files, not of a stub.
 *   - N iterations (default 20, `--runs N`) of `collectTouchedFileQuality` — the
 *     exact function the stop path calls — measured with `performance.now()`.
 *     That covers the recorder read, `git status`, `resolve_toolchain`, and every
 *     spawn the plan produced.
 *   - The `off` baseline is measured too, by the same loop with the pass skipped,
 *     so the row reports a DELTA rather than an absolute whose floor is unknown.
 *
 * WHAT THE NUMBER IS NOT. It is one machine's reading, and the dominant term is
 * whichever tools the fixture's resolver happens to emit — a consumer whose
 * toolchain resolves `phpstan` over a large tree will measure something else
 * entirely. It bounds the decision for THIS shape; it is not a budget.
 *
 * Exit codes: 0 measured · 2 the fixture could not be built.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectTouchedFileQuality } from './before_complete_hook.js';

const REPO_ROOT = path.resolve(path.dirname(path.resolve(fileURLToPath(import.meta.url))), '..', '..');

/** Files in the fixture. Five, per the step. */
export const FIXTURE_FILE_COUNT = 5;

const SESSION = 'bench-touched-file-quality';

export function percentile(samples: readonly number[], p: number): number {
    if (samples.length === 0) return 0;
    const sorted = [...samples].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[Math.max(0, idx)] as number;
}

/**
 * Build the throwaway consumer project and return its root.
 *
 * Deliberately NOT inside the repository: a fixture under `src/` or `agents/`
 * would be picked up by the tree's own gates, and one that `git init`s inside an
 * existing worktree would report the repository's status rather than its own.
 */
export function buildFixture(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tfq-bench-'));

    fs.writeFileSync(
        path.join(root, 'package.json'),
        JSON.stringify(
            { name: 'tfq-bench-fixture', private: true, devDependencies: { typescript: '*', eslint: '*' } },
            null,
            2,
        ),
        'utf-8',
    );
    // A flat config with no rules: eslint still parses every file, which is the
    // cost being measured, without a rule set that would make the number a
    // statement about this repository's lint configuration.
    fs.writeFileSync(path.join(root, 'eslint.config.mjs'), 'export default [];\n', 'utf-8');

    for (let i = 0; i < FIXTURE_FILE_COUNT; i += 1) {
        fs.writeFileSync(
            path.join(root, `mod${String(i)}.ts`),
            `export interface Row${String(i)} { id: number; name: string }\n` +
                `export function build${String(i)}(n: number): Row${String(i)}[] {\n` +
                `    return Array.from({ length: n }, (_, j) => ({ id: j, name: 'r' + String(j) }));\n` +
                `}\n`,
            'utf-8',
        );
    }

    try {
        fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(root, 'node_modules'), 'dir');
    } catch {
        // Left absent on a platform that refuses the link: `npx eslint` then
        // resolves to nothing and the pass records `skipped: absent`, which the
        // report states rather than hides.
    }

    spawnSync('git', ['init', '-q'], { cwd: root });

    fs.mkdirSync(path.join(root, 'agents', 'state'), { recursive: true });
    fs.writeFileSync(
        path.join(root, 'agents', 'state', 'minimal-safe-diff.json'),
        JSON.stringify({
            session_id: SESSION,
            files_touched_this_turn: Array.from(
                { length: FIXTURE_FILE_COUNT },
                (_, i) => `mod${String(i)}.ts`,
            ),
        }),
        'utf-8',
    );

    return root;
}

export interface BenchRow {
    readonly concern: string;
    readonly mode: 'off' | 'shadow';
    readonly runs: number;
    readonly p50_ms: number;
    readonly p95_ms: number;
    readonly max_ms: number;
    /** What the pass actually did, so a row of zeros is never mistaken for speed. */
    readonly commands: readonly string[];
    readonly skipped: readonly string[];
}

export function measure(root: string, iterations: number): { off: BenchRow; shadow: BenchRow } {
    const offSamples: number[] = [];
    const shadowSamples: number[] = [];
    let commands: string[] = [];
    let skipped: string[] = [];

    // One warm-up outside the samples: the first `npx` resolution pays a cost no
    // subsequent stop pays, and reporting it inside the p95 would describe a
    // session's first stop as if it were every stop.
    collectTouchedFileQuality(root, SESSION);

    for (let i = 0; i < iterations; i += 1) {
        const t0 = performance.now();
        const result = collectTouchedFileQuality(root, SESSION);
        shadowSamples.push(performance.now() - t0);
        if (i === 0 && result !== null) {
            commands = result.runs.filter((r) => r.skipped === null).map((r) => r.command);
            skipped = result.runs
                .filter((r) => r.skipped !== null)
                .map((r) => `${r.source_command} → ${String(r.skipped)}`);
        }

        // `off` is not "the same loop with a flag" — on the off path the stop
        // handler never reaches this function at all, so the baseline is the
        // empty interval, measured to keep the harness's own overhead visible.
        const t1 = performance.now();
        offSamples.push(performance.now() - t1);
    }

    const row = (mode: 'off' | 'shadow', xs: number[]): BenchRow => ({
        concern: 'verify-before-complete',
        mode,
        runs: xs.length,
        p50_ms: Math.round(percentile(xs, 50) * 1000) / 1000,
        p95_ms: Math.round(percentile(xs, 95) * 1000) / 1000,
        max_ms: Math.round(Math.max(...xs, 0) * 1000) / 1000,
        commands: mode === 'shadow' ? commands : [],
        skipped: mode === 'shadow' ? skipped : [],
    });

    return { off: row('off', offSamples), shadow: row('shadow', shadowSamples) };
}

export function render(rows: { off: BenchRow; shadow: BenchRow }): string {
    const line = (r: BenchRow): string =>
        `| ${r.concern} | ${r.mode} | ${String(r.runs)} | ${r.p50_ms.toFixed(3)} | ` +
        `${r.p95_ms.toFixed(3)} | ${r.max_ms.toFixed(3)} |`;
    const out: string[] = [
        '',
        `fixture: ${String(FIXTURE_FILE_COUNT)} TypeScript files, consumer-shaped project`,
        '',
        '| concern | mode | runs | p50_ms | p95_ms | max_ms |',
        '|---|---|---|---|---|---|',
        line(rows.off),
        line(rows.shadow),
        '',
        `delta p95 (shadow − off): ${(rows.shadow.p95_ms - rows.off.p95_ms).toFixed(3)} ms`,
        '',
        `commands executed: ${rows.shadow.commands.length === 0 ? '(none)' : rows.shadow.commands.join(' · ')}`,
        `skipped: ${rows.shadow.skipped.length === 0 ? '(none)' : rows.shadow.skipped.join(' · ')}`,
        '',
    ];
    return out.join('\n');
}

export function main(argv: readonly string[]): number {
    const runsIdx = argv.indexOf('--runs');
    const parsed = runsIdx === -1 ? NaN : Number(argv[runsIdx + 1]);
    const iterations = Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 20;
    const asJson = argv.includes('--json');

    let root: string;
    try {
        root = buildFixture();
    } catch (err) {
        process.stderr.write(`bench_touched_file_quality: could not build the fixture — ${String(err)}\n`);
        return 2;
    }

    const rows = measure(root, iterations);
    process.stdout.write(asJson ? `${JSON.stringify(rows, null, 2)}\n` : render(rows));

    try {
        fs.rmSync(root, { recursive: true, force: true });
    } catch {
        // A leftover temp directory is not a failed measurement.
    }
    return 0;
}

const _entry = process.argv[1];
if (_entry !== undefined && path.resolve(_entry) === path.resolve(fileURLToPath(import.meta.url))) {
    process.exit(main(process.argv.slice(2)));
}

#!/usr/bin/env node
/**
 * bench_artifact_selftest — every artifact task's primary grader must separate
 * its planted good reference from its planted bad one before it scores an arm;
 * a grader that cannot tell them apart does not get to score anything.
 *
 * Usage: bench_artifact_selftest [--task <id>] [--swap] [--json] [--corpus <yaml>] [--oracle-root <dir>]
 *   --swap   grade the bad reference as "good" and vice versa; a working grader
 *            must then FAIL — the proof the self-test can go red.
 *
 * Exit codes: 0 = every runnable grader separates (toolchain-less ones are
 * reported `skipped(<reason>)`), 1 = at least one grader fails to separate,
 * 2 = usage / corpus error.
 */
import * as path from 'node:path';
import process from 'node:process';

import { load_artifact_corpus } from './_lib/bench_artifact_corpus.js';
import { REPO_ROOT } from './_lib/bench_artifact_graders.js';
import { render_rows, selftest_task, type SelfTestRow } from './_lib/bench_artifact_selftest.js';

function flag(argv: string[], name: string): string | undefined {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
}

export async function main(argv: string[]): Promise<number> {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write('usage: bench_artifact_selftest [--task <id>] [--swap] [--json] [--corpus <yaml>] [--oracle-root <dir>]\n');
        return 0;
    }
    const corpus = flag(argv, '--corpus') ?? path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'ab-artifact-v2.yaml');
    let tasks;
    try {
        tasks = load_artifact_corpus(corpus);
    } catch (e) {
        process.stderr.write(`bench_artifact_selftest: ${(e as Error).message}\n`);
        return 2;
    }
    const only = flag(argv, '--task');
    if (only !== undefined) tasks = tasks.filter((t) => t.id === only);
    if (tasks.length === 0) {
        process.stderr.write('bench_artifact_selftest: no task selected — a self-test that graded nothing is not green\n');
        return 2;
    }
    const oracle = flag(argv, '--oracle-root');
    const rows: SelfTestRow[] = [];
    for (const t of tasks) rows.push(await selftest_task(t, { swap: argv.includes('--swap'), ...(oracle ? { oracle_root: path.resolve(oracle) } : {}) }));
    const failing = rows.filter((r) => r.verdict === 'fails').length;
    if (argv.includes('--json')) {
        process.stdout.write(JSON.stringify({ rows, failing }, null, 2) + '\n');
    } else {
        process.stdout.write(`bench_artifact_selftest — ${rows.length} grader(s)${argv.includes('--swap') ? ' (SWAPPED references)' : ''}\n`);
        process.stdout.write(render_rows(rows));
        const skipped = rows.filter((r) => r.verdict === 'skipped').length;
        process.stdout.write(`${rows.length - failing - skipped} separate, ${skipped} skipped, ${failing} fail\n`);
    }
    return failing > 0 ? 1 : 0;
}

if (process.argv[1] !== undefined && /bench_artifact_selftest\.(ts|js)$/.test(process.argv[1])) {
    main(process.argv.slice(2)).then(
        (code) => process.exit(code),
        (e: unknown) => {
            process.stderr.write(`bench_artifact_selftest: ${(e as Error).message}\n`);
            process.exit(2);
        },
    );
}

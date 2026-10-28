#!/usr/bin/env tsx
/**
 * Score every bench:ab v2 fixture task in synthetic arms that did no work —
 * `nop`, `touch`, `verifier-exit`, `source-exit`, `noise-ask` — plus a mutation
 * catalogue, and the task's reference patch under `internal/bench/ab/oracle-v2/`.
 *
 * Without `--gate` it prints the census table and exits 0. With `--gate` it
 * exits 1 when any synthetic arm or mutation passes a capability oracle, or a
 * reference is missing, does not apply, touches a verifier, or is red.
 *
 * Usage: check_bench_task_validity [--gate] [--json] [--quiet] [--task <id>] [--corpus <yaml>]
 *        [--ab-root <dir>] [--oracle-root <dir>] | --self-test
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stringify as toYaml } from 'yaml';

import {
    AB_ROOT,
    CORPUS_PATH,
    ORACLE_ROOT,
    censusRow,
    gateFindings,
    loadTasks,
    renderTable,
    summarise,
    type TaskRow,
} from './_lib/bench_task_validity.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);

interface Args {
    gate: boolean;
    json: boolean;
    quiet: boolean;
    task: string | null;
    corpus: string;
    abRoot: string;
    oracleRoot: string;
}

function parseArgs(argv: readonly string[]): Args | null {
    const out: Args = { gate: false, json: false, quiet: false, task: null, corpus: CORPUS_PATH, abRoot: AB_ROOT, oracleRoot: ORACLE_ROOT };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        const next = (): string => {
            const v = argv[i + 1];
            if (v === undefined) throw new Error(`${a} expects a value`);
            i += 1;
            return v;
        };
        if (a === '--gate') out.gate = true;
        else if (a === '--json') out.json = true;
        else if (a === '--quiet') out.quiet = true;
        else if (a === '--task') out.task = next();
        else if (a === '--corpus') out.corpus = path.resolve(next());
        else if (a === '--ab-root') out.abRoot = path.resolve(next());
        else if (a === '--oracle-root') out.oracleRoot = path.resolve(next());
        else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: check_bench_task_validity [--gate] [--json] [--quiet] [--task <id>] [--corpus <yaml>] [--ab-root <dir>] [--oracle-root <dir>]\n',
            );
            return null;
        } else throw new Error(`unrecognized argument: ${a}`);
    }
    return out;
}

/**
 * Seeds one copy of a committed task beside a fresh corpus and runs the real
 * CLI on it: the committed task with its reference passes; without the
 * reference, or with an oracle that matches the untouched fixture, it fails.
 */
function selfTest(): number {
    const repoRoot = path.resolve(path.dirname(_HERE), '..', '..');
    const source = loadTasks().find((t) => t['id'] === 'trapA-overeng-01');
    if (source === undefined) {
        process.stderr.write('check_bench_task_validity --self-test: seed task trapA-overeng-01 is gone\n');
        return 1;
    }
    const seeded = (oracle: Record<string, unknown> | null, withReference: boolean): number => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-validity-self-'));
        try {
            const ab = path.join(root, 'ab');
            fs.cpSync(path.join(AB_ROOT, 'fixtures-v2', 'trapA-overeng-01'), path.join(ab, 'fixtures-v2', 'seed-01'), { recursive: true });
            const oracles = path.join(root, 'oracle');
            fs.mkdirSync(oracles);
            if (withReference) {
                fs.copyFileSync(path.join(ORACLE_ROOT, 'trapA-overeng-01.patch'), path.join(oracles, 'seed-01.patch'));
            }
            const task = { ...source, id: 'seed-01', fixture: 'fixtures-v2/seed-01', ...(oracle ? { capability_oracle: oracle } : {}) };
            const corpus = path.join(root, 'corpus.yaml');
            fs.writeFileSync(corpus, toYaml({ tasks: [task] }));
            return runGateCli(repoRoot, 'src/scripts/check_bench_task_validity.ts', ['--gate', '--quiet', '--corpus', corpus, '--ab-root', ab, '--oracle-root', oracles], root);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    };
    const loose = { target_file_modified: 'src/paginate.ts', regex_in_target: 'pageSize' };
    return runSelfTest({
        gate: 'check_bench_task_validity',
        minCases: 3,
        minRejectCases: 2,
        cases: [
            { name: 'committed task with its reference', expect: 'accept', run: () => seeded(null, true) },
            { name: 'task without a reference', expect: 'reject', run: () => seeded(null, false) },
            { name: 'oracle matching the untouched fixture', expect: 'reject', run: () => seeded(loose, true) },
        ],
    });
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) return selfTest();
    let args: Args | null;
    try {
        args = parseArgs(argv);
    } catch (exc) {
        process.stderr.write(`check_bench_task_validity: ${(exc as Error).message}\n`);
        return 2;
    }
    if (args === null) return 0;
    const tasks = loadTasks(args.corpus).filter((t) => args.task === null || t['id'] === args.task);
    const rows: TaskRow[] = [];
    for (const task of tasks) {
        const row = censusRow(task, { abRoot: args.abRoot, oracleRoot: args.oracleRoot });
        if (row !== null) rows.push(row);
    }
    if (args.json) {
        process.stdout.write(JSON.stringify({ summary: summarise(rows), rows }, null, 2) + '\n');
    } else if (!args.quiet) {
        process.stdout.write(renderTable(rows));
    }
    if (!args.gate) return 0;
    try {
        reportScanned({ gate: 'check_bench_task_validity', scanned: rows.length, units: 'fixture tasks', roots: [path.relative(process.cwd(), args.corpus)] });
    } catch (exc) {
        process.stderr.write(`${(exc as Error).message}\n`);
        return 1;
    }
    const findings = gateFindings(rows);
    for (const f of findings) process.stderr.write(`check_bench_task_validity: ${f}\n`);
    return findings.length > 0 ? 1 : 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}

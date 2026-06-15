#!/usr/bin/env node
/**
 * Cache-aware dispatch for `task bench:ab` arms.
 *
 * TypeScript twin of `src/scripts/bench_ab_cache_dispatch.py` (ADR-096
 * Python→TS migration, Phase 8 / Wave 8d). Mirrors the CLI contract EXACTLY:
 * positional `corpus` (`tracka` / `trackb`), the `REMAINDER` `extra` args
 * forwarded to the underlying runner, exit codes (1 corpus missing, else the
 * underlying runner's return code), and byte-identical stdout/stderr.
 *
 * The Python original shells out via `sys.executable <runner>.py …`; this twin
 * mirrors that by invoking the SAME `.py` runners through `python3` (those
 * runners are referenced as runtime subprocesses, not imported logic).
 *
 * Phase 5 supporting helper. Wraps the Phase 2 cache lookup so the Taskfile
 * entries can stay readable. Given a corpus name (`tracka` / `trackb`),
 * checks whether the cached `without` report is fresh; if so, runs only the
 * `with` arm of the corresponding runner. Otherwise runs both.
 *
 * Cost-saving math: a daily `task bench:ab` re-runs only the `with` arm
 * when the corpus, claude CLI version, and target shape haven't changed.
 * That halves the wall-time + cost of the daily run.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as bench_ab_cache from './_lib/bench_ab_cache.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/bench_ab_cache_dispatch.ts → parents[2] is the repo root.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// corpus -> [runner script path, corpus filename]. Insertion order mirrors the
// Python dict literal (used for the positional `choices` tuple order).
const RUNNER_FOR: Array<[string, [string, string]]> = [
    ['tracka', [path.join(REPO_ROOT, 'src', 'scripts', 'bench_ab_tracka_run.py'), 'ab-tracka.yaml']],
    ['trackb', [path.join(REPO_ROOT, 'src', 'scripts', 'bench_ab_task_runner.py'), 'ab-trackb.yaml']],
];

const CHOICES = RUNNER_FOR.map(([c]) => c);

interface Args {
    corpus: string;
    extra: string[];
}

function parse_args(argv: string[]): Args {
    // argparse: positional `corpus` (choices) + `extra` (REMAINDER). REMAINDER
    // captures the first positional onward once `corpus` is consumed, including
    // any leading dashes — everything after the corpus token is `extra`.
    if (argv.length === 0) {
        _argError('the following arguments are required: corpus');
    }
    const corpus = argv[0]!;
    if (!CHOICES.includes(corpus)) {
        const choicesStr = CHOICES.map((c) => `'${c}'`).join(', ');
        _argError(`argument corpus: invalid choice: '${corpus}' (choose from ${choicesStr})`);
    }
    const extra = argv.slice(1);
    return { corpus, extra };
}

function _argError(msg: string): never {
    process.stderr.write(`bench_ab_cache_dispatch: error: ${msg}\n`);
    process.exitCode = 2;
    throw new ArgExit();
}

class ArgExit extends Error {}

export function main(argv: string[] | null = null): number {
    const rawArgv = argv ?? process.argv.slice(2);
    const args = parse_args(rawArgv);
    const entry = RUNNER_FOR.find(([c]) => c === args.corpus)!;
    const [runner, corpusName] = entry[1];
    const corpusPath = path.join(REPO_ROOT, 'internal', 'bench', 'corpora', corpusName);
    if (!fs.existsSync(corpusPath)) {
        process.stderr.write(`bench_ab_cache_dispatch: corpus missing at ${corpusPath}\n`);
        return 1;
    }
    const lookup = bench_ab_cache.lookup(corpusPath);
    let variants: string[];
    if (lookup.fresh && lookup.report_path !== null) {
        process.stdout.write(
            `bench_ab_cache_dispatch (${args.corpus}): reusing fresh without baseline ` +
                `(${path.basename(lookup.report_path)}) — running with-arm only\n`,
        );
        variants = ['with'];
    } else {
        process.stdout.write(
            `bench_ab_cache_dispatch (${args.corpus}): cache ${lookup.reason} — running both arms\n`,
        );
        variants = ['with', 'without'];
    }
    // Python: cmd = [sys.executable, runner, "--variant", variants[0]] + extra
    //         if len(variants) == 2: cmd = [..., "--variant", "both"] + extra
    let cmd = ['--variant', variants[0]!, ...args.extra];
    if (variants.length === 2) {
        cmd = ['--variant', 'both', ...args.extra];
    }
    const result = spawnSync('python3', [runner, ...cmd], { stdio: 'inherit' });
    // subprocess.run(...).returncode — null status (signal) maps to non-zero
    // in Python via the signal-encoded returncode; here surface 1 on a null
    // status to avoid claiming success when the child was killed.
    return result.status ?? 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    try {
        process.exitCode = main();
    } catch (e) {
        if (e instanceof ArgExit) {
            process.exitCode = process.exitCode ?? 2;
        } else {
            throw e;
        }
    }
}

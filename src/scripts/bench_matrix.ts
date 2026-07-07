#!/usr/bin/env tsx
/**
 * Bench matrix runner — road-to-flow-learnings Phase 3.
 *
 * Declares one matrix (task-family × host × arm) in a YAML file and expands
 * it into the EXISTING `bench_ab_v2_run.ts` invocations — no new runner, no
 * new science. The paired design is preserved by construction: all arms of a
 * cell run inside ONE runner invocation (pairing happens per task inside the
 * runner), so a cell = (host × family) and the arm axis rides along.
 *
 * Matrix YAML shape:
 *
 *   families: [trapE, capH]        # archetype values from the corpus
 *   hosts: [claude, codex]
 *   arms: [vanilla, package]
 *   seeds: 3
 *   model: claude-haiku-4-5
 *   budget: 1.0
 *
 * `--expand` (default) prints the deterministic invocation plan — one line
 * per cell — and never spends. `--run` executes the cells sequentially
 * (live API spend; operator-gated).
 *
 * Exit: 0 ok · 1 a live cell failed · 2 config error.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { ARMS, CODEX_VALID_ARMS } from './bench_ab_v2_run.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DEFAULT_CORPUS = path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'ab-trackb-v2.yaml');
const RUNNER = path.join(REPO_ROOT, 'src', 'scripts', 'bench_ab_v2_run.ts');

type Dict = Record<string, unknown>;

const VALID_HOSTS = ['claude', 'codex'] as const;

export interface MatrixSpec {
    readonly families: readonly string[];
    readonly hosts: readonly string[];
    readonly arms: readonly string[];
    readonly seeds: number;
    readonly model: string;
    readonly budget: number;
    readonly timeout: number;
}

export class MatrixConfigError extends Error {}

function strList(obj: Dict, key: string): string[] {
    const raw = obj[key];
    if (!Array.isArray(raw) || raw.length === 0 || !raw.every((v) => typeof v === 'string')) {
        throw new MatrixConfigError(`\`${key}\` must be a non-empty string list`);
    }
    return raw as string[];
}

/** Parse + validate the matrix YAML against the runner's own registries. */
export function parseMatrixSpec(text: string): MatrixSpec {
    let raw: unknown;
    try {
        raw = parseYaml(text);
    } catch (exc) {
        throw new MatrixConfigError(`matrix config does not parse: ${(exc as Error).message}`);
    }
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new MatrixConfigError('matrix config must be a mapping');
    }
    const obj = raw as Dict;
    const spec: MatrixSpec = {
        families: strList(obj, 'families'),
        hosts: strList(obj, 'hosts'),
        arms: strList(obj, 'arms'),
        seeds: typeof obj['seeds'] === 'number' ? (obj['seeds'] as number) : 3,
        model: typeof obj['model'] === 'string' ? (obj['model'] as string) : 'claude-haiku-4-5',
        budget: typeof obj['budget'] === 'number' ? (obj['budget'] as number) : 1.0,
        timeout: typeof obj['timeout'] === 'number' ? (obj['timeout'] as number) : 180,
    };
    for (const h of spec.hosts) {
        if (!VALID_HOSTS.includes(h as (typeof VALID_HOSTS)[number])) {
            throw new MatrixConfigError(`unknown host '${h}' (valid: ${VALID_HOSTS.join(', ')})`);
        }
    }
    for (const a of spec.arms) {
        if (!(a in ARMS)) {
            throw new MatrixConfigError(`unknown arm '${a}' (valid: ${Object.keys(ARMS).join(', ')})`);
        }
    }
    if (spec.hosts.includes('codex')) {
        for (const a of spec.arms) {
            if (!CODEX_VALID_ARMS.includes(a)) {
                throw new MatrixConfigError(
                    `arm '${a}' is not valid for host codex (valid: ${CODEX_VALID_ARMS.join(', ')})`,
                );
            }
        }
    }
    if (!Number.isInteger(spec.seeds) || spec.seeds < 1) {
        throw new MatrixConfigError('`seeds` must be a positive integer');
    }
    return spec;
}

/** Group corpus task ids by archetype (the family axis). */
export function familyTaskIds(corpusText: string): Map<string, string[]> {
    const corpus = parseYaml(corpusText, { version: '1.1' }) as Dict | null;
    const tasks = Array.isArray(corpus?.['tasks']) ? (corpus?.['tasks'] as Dict[]) : [];
    const out = new Map<string, string[]>();
    for (const t of tasks) {
        const family = String(t['archetype'] ?? '');
        const id = String(t['id'] ?? '');
        if (!family || !id) continue;
        const list = out.get(family) ?? [];
        list.push(id);
        out.set(family, list);
    }
    return out;
}

/** One expanded cell — a single runner invocation covering all matrix arms. */
export interface MatrixCell {
    readonly host: string;
    readonly family: string;
    readonly taskIds: readonly string[];
    readonly argv: readonly string[];
}

/**
 * Deterministic expansion: cells in (host, family) document order. Throws
 * {@link MatrixConfigError} when a family matches zero corpus tasks — a
 * silent empty cell would read as coverage that never ran.
 */
export function expandMatrix(spec: MatrixSpec, corpusText: string, mode: 'dry-run' | 'live'): MatrixCell[] {
    const byFamily = familyTaskIds(corpusText);
    const cells: MatrixCell[] = [];
    for (const host of spec.hosts) {
        for (const family of spec.families) {
            const taskIds = byFamily.get(family) ?? [];
            if (taskIds.length === 0) {
                throw new MatrixConfigError(
                    `family '${family}' matches no corpus task (known: ${[...byFamily.keys()].join(', ')})`,
                );
            }
            cells.push({
                host,
                family,
                taskIds,
                argv: [
                    RUNNER,
                    '--arms', spec.arms.join(','),
                    '--tasks', taskIds.join(','),
                    '--seeds', String(spec.seeds),
                    '--model', spec.model,
                    '--budget', String(spec.budget),
                    '--timeout', String(spec.timeout),
                    '--host', host,
                    '--mode', mode,
                ],
            });
        }
    }
    return cells;
}

/** One line per cell — the snapshot-tested plan format. */
export function planLines(cells: readonly MatrixCell[]): string[] {
    return cells.map(
        (c) =>
            `cell host=${c.host} family=${c.family} tasks=${c.taskIds.length} :: ` +
            `bench_ab_v2_run ${c.argv.slice(1).join(' ')}`,
    );
}

const USAGE =
    'usage: bench_matrix [-h] --config matrix.yaml [--corpus PATH] [--expand | --run]\n';

export function main(argv: string[] | null = null): number {
    const args = argv !== null ? Array.from(argv) : process.argv.slice(2);
    let configPath: string | null = null;
    let corpusPath = DEFAULT_CORPUS;
    let run = false;
    let i = 0;
    while (i < args.length) {
        const a = args[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(USAGE);
            return 0;
        }
        if (a === '--run') {
            run = true;
        } else if (a === '--expand') {
            run = false;
        } else if (a === '--config' || a.startsWith('--config=')) {
            configPath = a.includes('=') ? a.slice(a.indexOf('=') + 1) : String(args[(i += 1)] ?? '');
        } else if (a === '--corpus' || a.startsWith('--corpus=')) {
            corpusPath = a.includes('=') ? a.slice(a.indexOf('=') + 1) : String(args[(i += 1)] ?? '');
        } else {
            process.stderr.write(USAGE);
            process.stderr.write(`bench_matrix: error: unrecognized argument ${a}\n`);
            return 2;
        }
        i += 1;
    }
    if (!configPath || !fs.existsSync(configPath)) {
        process.stderr.write(USAGE);
        process.stderr.write('bench_matrix: error: --config path missing or not found\n');
        return 2;
    }
    if (!fs.existsSync(corpusPath)) {
        process.stderr.write(`bench_matrix: error: corpus not found: ${corpusPath}\n`);
        return 2;
    }
    let cells: MatrixCell[];
    try {
        const spec = parseMatrixSpec(fs.readFileSync(configPath, 'utf-8'));
        cells = expandMatrix(spec, fs.readFileSync(corpusPath, 'utf-8'), run ? 'live' : 'dry-run');
    } catch (exc) {
        if (exc instanceof MatrixConfigError) {
            process.stderr.write(`bench_matrix: error: ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }

    for (const line of planLines(cells)) {
        process.stdout.write(`${line}\n`);
    }
    if (!run) {
        process.stdout.write(`bench_matrix: EXPAND — ${cells.length} cell(s). No spend.\n`);
        return 0;
    }
    // Live execution: sequential by design — the runner already parallelises
    // nothing internally, and live bench spend must stay easy to abort.
    for (const [idx, cell] of cells.entries()) {
        process.stderr.write(`bench_matrix: [${idx + 1}/${cells.length}] host=${cell.host} family=${cell.family}\n`);
        const proc = spawnSync(process.execPath, ['--import', 'tsx', ...cell.argv], {
            stdio: 'inherit',
            cwd: REPO_ROOT,
        });
        if (proc.status !== 0) {
            process.stderr.write(
                `bench_matrix: cell failed (exit ${proc.status}) — aborting remaining cells\n`,
            );
            return 1;
        }
    }
    process.stdout.write(`bench_matrix: ${cells.length} cell(s) complete.\n`);
    return 0;
}

// --- CLI entry ---

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main(process.argv.slice(2));
}

#!/usr/bin/env tsx
/**
 * compile_hook_manifest — writes `src/scripts/hook_manifest.json` from
 * `src/scripts/hook_manifest.yaml`.
 *
 * WHY the compiled sibling exists: `dispatch_hook._load_yaml` runs on EVERY
 * hook dispatch, and parsing the ~61 kB YAML manifest measured 12 ms plus 8 ms
 * to load the `yaml` module — a fifth of a ~103 ms dispatch spent re-deriving a
 * table that does not change between runs. The compiled form is the same data
 * with comments stripped (~15 kB) and parses in under a millisecond. Measured
 * effect on `pre_tool_use` p50, one machine, n=50: 103 ms → 81 ms.
 *
 * The `fingerprint` field is what makes the fast path SAFE rather than merely
 * fast, and it is deliberately content-derived. The first version compared
 * mtimes and that was a measured defect: on a fresh `actions/checkout` both
 * files carry the checkout timestamp in whatever order git wrote them, so
 * whether the optimisation applied was a coin flip — it won on a PR run
 * (p95 129 ms) and lost on the trunk (p95 186 ms) for the same commit.
 *
 * The fingerprint helper is IMPORTED from the reader rather than reimplemented
 * here, so the writer and the reader cannot drift apart.
 *
 * Run after editing the manifest:
 *     ./scripts-run src/scripts/compile_hook_manifest
 *
 * `--out <path>` writes the compiled bytes THERE and leaves the tree alone. It
 * exists for `check_generator_sync`, whose contract is that a triple regenerates
 * into a temp dir the gate owns and never into the working tree — a gate that
 * repaired the artefact it is measuring would turn every staleness into a silent
 * green plus an unexplained dirty file. Anything that wants to compare against
 * the committed JSON uses this flag; anything that wants to FIX it omits it.
 *
 * `tests/hooks/hook_manifest_compiled.test.ts` fails if the committed JSON
 * stops matching the YAML, so a forgotten run is caught rather than shipped —
 * but only against the COMMITTED blob in CI. Locally that same test reads the
 * working tree, so a recompile that was run and never committed makes it pass
 * over a defect that is still on the branch. See the discriminator in
 * `check_generator_sync`'s header.
 *
 * Exit codes: 0 written (or already current) · 2 internal error or usage.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { tableFingerprint } from './hooks/table_fingerprint.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

/**
 * The plumbing tables that carry a compiled sibling, keyed by `--table`.
 *
 * `key` is the wrapper field the reader looks under, and it differs per table
 * because each reader already had one: `dispatch_hook._load_yaml` reads
 * `manifest`, `host_lowering.loadHostLowering` reads `table`. Renaming either
 * would be a plumbing change for cosmetics, so the writer follows the readers.
 *
 * `yamlVersion` is 1.1 for the manifest and default for the lowering table,
 * again because that is what each READER passes. A compiler that parsed with
 * different settings than the fallback path would produce a fast path that
 * disagrees with its own slow path on `yes`/`no`/`on`/`off` scalars — a
 * divergence no fingerprint can catch, because both files would be current.
 */
const TABLES = {
    manifest: {
        yaml: path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'),
        json: path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.json'),
        key: 'manifest',
        yamlVersion: '1.1' as const,
    },
    'host-lowering': {
        yaml: path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'host_lowering.yaml'),
        json: path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'host_lowering.json'),
        key: 'table',
        yamlVersion: undefined,
    },
} as const;

export type TableName = keyof typeof TABLES;

export function compile(yamlText: string, table: TableName = 'manifest'): string {
    const spec = TABLES[table];
    const doc = (spec.yamlVersion === undefined
        ? parseYaml(yamlText)
        : parseYaml(yamlText, { version: spec.yamlVersion })) as unknown;
    return JSON.stringify({ fingerprint: tableFingerprint(yamlText), [spec.key]: doc });
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let outPath: string | null = null;
    let table: TableName = 'manifest';
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--table') {
            const next = argv[i + 1];
            if (next === undefined || !(next in TABLES)) {
                process.stderr.write(
                    `compile_hook_manifest: --table needs one of ${Object.keys(TABLES).join(', ')}\n`,
                );
                return 2;
            }
            table = next as TableName;
            i += 1;
            continue;
        }
        if (a === '--out') {
            const next = argv[i + 1];
            if (next === undefined || next.startsWith('--')) {
                process.stderr.write('compile_hook_manifest: --out needs a path\n');
                return 2;
            }
            outPath = next;
            i += 1;
            continue;
        }
        process.stderr.write(
            `compile_hook_manifest: unknown argument ${JSON.stringify(a)}\n` +
                `usage: compile_hook_manifest [--table ${Object.keys(TABLES).join('|')}] [--out <path>]\n`,
        );
        return 2;
    }

    const spec = TABLES[table];
    const text = fs.readFileSync(spec.yaml, 'utf-8');
    const next = compile(text, table);

    if (outPath !== null) {
        // Comparison copy. No `already current` short-circuit: the caller asked
        // for the bytes, and an unwritten file would read as a generator that
        // silently did nothing.
        fs.writeFileSync(outPath, next);
        return 0;
    }

    const current = fs.existsSync(spec.json) ? fs.readFileSync(spec.json, 'utf-8') : null;
    if (current === next) {
        process.stdout.write(`compile_hook_manifest: ${table} already current\n`);
        return 0;
    }
    fs.writeFileSync(spec.json, next);
    process.stdout.write(
        `compile_hook_manifest: wrote ${path.relative(REPO_ROOT, spec.json)} ` +
            `(${String(next.length)} bytes, fingerprint ${tableFingerprint(text)})\n`,
    );
    return 0;
}

if (process.argv[1] !== undefined && fs.realpathSync(process.argv[1]).includes('compile_hook_manifest')) {
    process.exit(main());
}

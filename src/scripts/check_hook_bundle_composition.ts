#!/usr/bin/env tsx
/**
 * Composition gate for the self-hosted hook bundle: which npm packages are in
 * it, and one wide byte backstop.
 *
 * WHY THIS EXISTS — measured, not hypothetical.
 *
 * Every concern is inlined into one `dist/hooks/dispatch.js` that every hook
 * event loads, so a dependency added for ONE concern is paid by all of them on
 * every dispatch. On 2026-10-01 the bundle carried two YAML parsers: `yaml` and
 * `js-yaml`, the second pulled by one call site — 95,846 bytes that reached a
 * release as a review finding rather than as a red check.
 *
 * WHAT IT CHECKS
 *
 *   1. Every npm package contributing bytes to the bundle is on the committed
 *      `allowed_packages` list. A new package — a second YAML reader included —
 *      is a red check with one line to add, reviewed like any dependency. This
 *      replaces the closed list of YAML package names the gate used to count
 *      over, which could not see a parser under a name nobody listed.
 *   2. The bundle's byte count is at or under `max_bytes`, a backstop with real
 *      headroom against slow creep.
 *
 * WHAT IT NO LONGER DOES (owner directive 2026-11-20, D1). It held the ceiling
 * a few bytes above the reading with `shrink_only`, a `raise_log` obligation and
 * 18 per-chunk ceilings, so it fired on every in-bundle feature rather than on
 * regressions: 28 raises in six weeks, the smallest 94 bytes. Own-code growth is
 * what features are. Chunk sizes are printed, not gated.
 *
 * WHY IT BUILDS RATHER THAN READS. `dist/hooks/` is untracked, so this builds
 * its own bundle with `--metafile` from `package.json`'s `build:hooks` script
 * (only `--outfile=` rewritten, via `rewriteOutfile`), and measures that.
 *
 * WHAT IT DOES NOT DO. It says nothing about LATENCY
 * (`src/config/hook-latency-budget.json`), and nothing about a module loaded at
 * RUNTIME outside the bundle — a `createRequire` call esbuild leaves alone
 * contributes 0 bytes here; `tests/scripts/hook_load_set.test.ts` catches that class.
 *
 * Usage:
 *     ./scripts-run src/scripts/check_hook_bundle_composition
 *     ./scripts-run src/scripts/check_hook_bundle_composition --metafile <path>
 *     ./scripts-run src/scripts/check_hook_bundle_composition --self-test
 *
 * Exit codes: 0 = within budget · 1 = over the backstop or an unlisted package ·
 * 2 = the build or the budget file failed.
 */
// ledger-exempt: single-artefact transaction — one bundle build yielding one
// aggregate verdict. The per-source accounting lives in
// check_hook_bundle_freshness, which carries the ledger.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';
import { buildScript } from './check_hook_bundle_content.js';
import { parseGateArgs, USAGE_EXIT } from './_lib/gate_args.js';
import { buildChunk, HOOK_CHUNKS } from './hook_chunks.mjs';
import { rewriteOutfile } from './rebuild_hook_bundle.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(_HERE, '..', '..');
export const SELF_REL = path.join('src', 'scripts', 'check_hook_bundle_composition.ts');
export const BUDGET_REL = path.join('src', 'config', 'hook-bundle-budget.json');
const LIVE_REL = path.join('dist', 'hooks', 'dispatch.js');

export interface Budget {
    readonly maxBytes: number;
    readonly allowedPackages: readonly string[];
}

export interface Analysis {
    /** Bytes of the bundle esbuild produced. */
    readonly bytes: number;
    /** Modules that contributed to it — the unit `scanned:` reports. */
    readonly modules: number;
    /** Bytes in the output, summed per owning npm package (zero-byte packages omitted). */
    readonly packageBytes: ReadonlyMap<string, number>;
}

/**
 * The npm package a bundled module path belongs to, or `null` for this tree's
 * own sources.
 *
 * Reads the INNERMOST `node_modules/` segment: a transitively nested copy
 * (`node_modules/a/node_modules/yaml/…`) is still `yaml`'s bytes, and
 * attributing it to `a` would let a second parser hide one level down.
 */
export function owningPackage(modulePath: string): string | null {
    const marker = 'node_modules/';
    const at = modulePath.lastIndexOf(marker);
    if (at < 0) return null;
    const parts = modulePath.slice(at + marker.length).split('/');
    const head = parts[0] ?? '';
    if (head === '') return null;
    return head.startsWith('@') ? `${head}/${parts[1] ?? ''}` : head;
}

/** Parse an esbuild metafile and attribute its one entry-point output. */
export function analyzeMetafile(json: string): Analysis {
    const meta = JSON.parse(json) as {
        outputs?: Record<string, { entryPoint?: string; bytes?: number; inputs?: Record<string, { bytesInOutput?: number }> }>;
    };
    const outputs = Object.values(meta.outputs ?? {});
    const out = outputs.find((o) => typeof o.entryPoint === 'string');
    if (out === undefined) {
        throw new Error(
            'metafile carries no entry-point output — refusing to report a composition for a build that produced nothing',
        );
    }
    const packageBytes = new Map<string, number>();
    const inputs = out.inputs ?? {};
    for (const [p, v] of Object.entries(inputs)) {
        const pkg = owningPackage(p);
        const bytes = v.bytesInOutput ?? 0;
        if (pkg === null || bytes <= 0) continue;
        packageBytes.set(pkg, (packageBytes.get(pkg) ?? 0) + bytes);
    }
    return { bytes: out.bytes ?? 0, modules: Object.keys(inputs).length, packageBytes };
}

/** Packages contributing bytes that the budget does not list, sorted. */
export function unlistedPackages(a: Analysis, budget: Budget): string[] {
    const allowed = new Set(budget.allowedPackages);
    return [...a.packageBytes.keys()].filter((p) => !allowed.has(p)).sort();
}

/**
 * Build the chunk for `entry` from the one chunk definition (`hook_chunks.mjs`,
 * which `build:hook-chunks` runs) to a throwaway path, and return its size.
 * Throws when no chunk is defined for the entry.
 */
export function buildChunkBytes(root: string, entry: string): number {
    if (!HOOK_CHUNKS.some((c) => c.entry === entry)) {
        throw new Error(`hook_chunks.mjs defines no chunk built from ${entry}`);
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-chunk-composition-'));
    const out = path.join(dir, 'chunk.cjs');
    try {
        buildChunk(root, entry, out);
        return fs.statSync(out).size;
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

/** Read the committed budget. Throws rather than defaulting — a guessed ceiling bounds nothing. */
export function readBudget(root: string): Budget {
    const raw = JSON.parse(fs.readFileSync(path.join(root, BUDGET_REL), 'utf-8')) as Record<string, unknown>;
    const maxBytes = raw['max_bytes'];
    const allowed = raw['allowed_packages'];
    if (typeof maxBytes !== 'number' || !Number.isInteger(maxBytes) || maxBytes <= 0) {
        throw new Error(`${BUDGET_REL}: max_bytes must be a positive integer, got ${JSON.stringify(maxBytes)}`);
    }
    if (!Array.isArray(allowed) || !allowed.every((p) => typeof p === 'string' && p !== '')) {
        throw new Error(`${BUDGET_REL}: allowed_packages must be a list of package names, got ${JSON.stringify(allowed)}`);
    }
    return { maxBytes, allowedPackages: allowed as string[] };
}

/** Findings, one line each. Empty means within budget. */
export function verdict(a: Analysis, budget: Budget): string[] {
    const findings: string[] = [];
    const unlisted = unlistedPackages(a, budget);
    if (unlisted.length > 0) {
        const detail = unlisted.map((p) => `${p} (${String(a.packageBytes.get(p) ?? 0)} B)`).join(', ');
        findings.push(
            `npm package(s) in the bundle that ${BUDGET_REL} does not list: ${detail}. Every dispatch loads ` +
                'them. Use a package the bundle already carries, load it lazily outside the bundle, or add it to ' +
                '`allowed_packages` as a reviewed dependency decision.',
        );
    }
    if (a.bytes > budget.maxBytes) {
        findings.push(
            `bundle is ${String(a.bytes)} bytes, backstop is ${String(budget.maxBytes)} ` +
                `(over by ${String(a.bytes - budget.maxBytes)}). Look at what grew before moving max_bytes in ${BUDGET_REL}.`,
        );
    }
    return findings;
}

/**
 * Build the hook bundle to a throwaway path and return its metafile JSON.
 *
 * Throws on any failure rather than returning a sentinel: a composition read off
 * a build that did not happen is the silent-green this gate exists to replace.
 */
export function buildMetafile(root: string): string {
    const script = buildScript(root);
    if (script === null) {
        throw new Error('package.json has no `build:hooks` script — refusing to guess the flag set');
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-bundle-composition-'));
    const outFile = path.join(dir, 'dispatch.js');
    const metaFile = path.join(dir, 'meta.json');
    try {
        const rewritten = rewriteOutfile(script, outFile);
        if (rewritten === null) {
            throw new Error(`\`build:hooks\` no longer writes ${LIVE_REL} — refusing to build to a guessed path`);
        }
        // Strip the steps after esbuild (digest sidecar, chunk build): they would
        // write beside a probe bundle nobody executes.
        const esbuildOnly = rewritten.split('&& node ')[0] ?? rewritten;
        const built = spawnSync('sh', ['-c', `${esbuildOnly.trim()} --metafile=${metaFile}`], {
            cwd: root,
            encoding: 'utf-8',
            maxBuffer: 64 * 1024 * 1024,
            env: {
                ...process.env,
                PATH: `${path.join(root, 'node_modules', '.bin')}:${process.env['PATH'] ?? ''}`,
            },
        });
        if (built.status !== 0 || !fs.existsSync(metaFile)) {
            throw new Error(`esbuild failed (exit ${String(built.status)})\n${built.stderr ?? ''}`);
        }
        return fs.readFileSync(metaFile, 'utf-8');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function selfTest(): number {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-bundle-composition-selftest-'));
    const write = (name: string, body: unknown): string => {
        const p = path.join(dir, name);
        fs.writeFileSync(p, JSON.stringify(body));
        return p;
    };
    const meta = (bytes: number, inputs: Record<string, number>): unknown => ({
        inputs: {},
        outputs: {
            'dist/hooks/dispatch.js': {
                entryPoint: 'src/scripts/hooks/dispatch_entry.ts',
                bytes,
                inputs: Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, { bytesInOutput: v }])),
            },
        },
    });
    const budget = readBudget(REPO_ROOT);
    const listed = budget.allowedPackages[0] ?? 'yaml';
    const clean = write('clean.json', meta(budget.maxBytes, { [`node_modules/${listed}/dist/index.js`]: 10 }));
    const secondReader = write(
        'second-reader.json',
        meta(1000, { [`node_modules/${listed}/dist/index.js`]: 600, 'node_modules/js-yaml/dist/js-yaml.mjs': 400 }),
    );
    const oneOver = write('one-over.json', meta(budget.maxBytes + 1, { 'src/x.ts': 1 }));
    const empty = write('empty.json', { inputs: {}, outputs: {} });

    const drive = (fixture: string): number => runGateCli(REPO_ROOT, SELF_REL, ['--metafile', fixture], REPO_ROOT);

    try {
        return runSelfTest({
            gate: 'check_hook_bundle_composition',
            minCases: 4,
            minRejectCases: 3,
            cases: [
                { name: 'listed packages only, exactly at the backstop → accepted', expect: 'accept', run: () => drive(clean) },
                { name: 'an unlisted package (a second YAML reader) → rejected', expect: 'reject', run: () => drive(secondReader) },
                { name: 'one byte over the backstop → rejected', expect: 'reject', run: () => drive(oneOver) },
                {
                    name: 'a metafile with no entry-point output → rejected, never reported as 0 bytes',
                    expect: 'reject',
                    run: () => drive(empty),
                },
            ],
        });
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

export function main(argv: readonly string[] = process.argv.slice(2), root: string = REPO_ROOT): number {
    const parsed = parseGateArgs('check_hook_bundle_composition', argv, {
        'self-test': { type: 'boolean' },
        metafile: { type: 'string' },
    });
    if (!parsed.ok) {
        process.stderr.write(`${parsed.message}\n`);
        return USAGE_EXIT;
    }
    if (parsed.values['self-test'] === true) {
        return selfTest();
    }
    const fixture = parsed.values.metafile;

    let budget: Budget;
    let json: string;
    try {
        budget = readBudget(root);
        json = fixture === undefined ? buildMetafile(root) : fs.readFileSync(fixture, 'utf-8');
    } catch (e) {
        process.stderr.write(`check_hook_bundle_composition: ${String(e instanceof Error ? e.message : e)}\n`);
        return 2;
    }

    let analysis: Analysis;
    try {
        analysis = analyzeMetafile(json);
    } catch (e) {
        process.stderr.write(`check_hook_bundle_composition: ${String(e instanceof Error ? e.message : e)}\n`);
        return 1;
    }

    const findings = verdict(analysis, budget);
    const chunkSizes = new Map<string, number>();
    if (fixture === undefined) {
        try {
            for (const c of HOOK_CHUNKS) chunkSizes.set(c.entry, buildChunkBytes(root, c.entry));
        } catch (e) {
            process.stderr.write(`check_hook_bundle_composition: ${String(e instanceof Error ? e.message : e)}\n`);
            return 2;
        }
    }
    // Reported on BOTH paths, red included: a census that goes quiet exactly
    // when the gate fires is the shape `reportScanned` exists to prevent.
    reportScanned({
        gate: 'check_hook_bundle_composition',
        scanned: analysis.modules,
        units: 'bundled module(s)',
        roots: [LIVE_REL],
    });

    const packages = [...analysis.packageBytes].map(([p, b]) => `${p} ${String(b)} B`).join(', ');
    if (findings.length === 0) {
        process.stdout.write(
            `✅  hook bundle: ${String(analysis.bytes)} B / ${String(budget.maxBytes)} B backstop, ` +
                `packages [${packages}], ${String(analysis.modules)} modules\n`,
        );
        for (const [entry, bytes] of chunkSizes) process.stdout.write(`    chunk ${entry}: ${String(bytes)} B (reported, not gated)\n`);
        return 0;
    }
    process.stderr.write('❌  hook bundle composition is out of budget\n');
    for (const f of findings) process.stderr.write(`    - ${f}\n`);
    process.stderr.write(`    Budget: ${BUDGET_REL}\n`);
    return 1;
}

function _isCliEntry(): boolean {
    const argv1 = process.argv[1];
    if (argv1 === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(argv1)).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(argv1));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}

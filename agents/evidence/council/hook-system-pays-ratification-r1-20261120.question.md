<!-- evidence-type: analysis -->

# Ratification review — the hook-bundle budget becomes an allowlist and a backstop, and three per-dispatch fixed costs leave the dispatcher — round 1

You are an independent reviewer for a change in the `event4u/agent-config` repository. Five of its files are on the ratification gate's list (`check_kernel_edit_ratified`): the gate itself, the dispatcher `hooks/dispatch_hook.ts`, two new modules the dispatcher imports (`hooks/concern_env.ts`, `hooks/feedback_policy.ts`) and the budget file `src/config/hook-bundle-budget.json`. Under ADR-268 § 4 an agent may change them but may not ratify its own change, so the change needs a two-provider verdict.

subject: fd83bd065985d20ffba9701ade188f71b6b691a53511767179aa4677dc80f9a8

(The digest is the one the BASE revision's gate computes — CI runs the base copy — over `.github/workflows/consistency.yml`, `src/config/hook-bundle-budget.json`, `src/scripts/check_kernel_edit_ratified.ts`, `src/scripts/hooks/concern_env.ts`, `src/scripts/hooks/dispatch_hook.ts` and `src/scripts/hooks/feedback_policy.ts` at commit `21ee5a25c8`. The head's own gate no longer lists the budget file and computes `6437f02e19d041c5d8e51276da858dd45cf48a05304274ad3be5f9291212ff2b` over the other five; same content.)

## Background

Every hook event starts one node process that loads `dist/hooks/dispatch.js` (1.6 MB, 75 concerns: 9 blocking, 66 advisory). Its byte budget was a ceiling held a few bytes above the reading (`shrink_only`), raised 28 times in six weeks with a `raise_log` entry and a council ratification each, and it blocked feature work at 11 bytes of headroom. It missed the largest cost: `telemetry/settings.ts` loaded `yaml` through `createRequire(import.meta.url)`, which esbuild does not bundle, so every dispatch loaded a second YAML copy (72 files) from `node_modules`. The repository owner asked for the ratchet to go (recorded in `agents/evidence/owner-directives/2026-11-20-hook-bundle-budget-and-hook-economy.md`: keep one overall ceiling with generous headroom, drop per-chunk ceilings, `shrink_only` and the ratification requirement for the budget file, keep the parser check).

## What the change does

1. **Budget file** (`hook-bundle-budget.json`, full new content below). `allowed_packages: ["yaml"]` replaces `max_yaml_packages: 1` over a closed list of four YAML names; `max_bytes` 1,915,000 (the 1,595,089 reading plus about 20 %); `shrink_only`, `raise_log`, `chunks`, `chunk_groups` removed (history summarised in `agents/evidence/analysis/hook-bundle-budget-retired-2026-11-20.md`).
2. **Composition gate** (`check_hook_bundle_composition.ts`, not gated itself; new content below). Fails on any npm package contributing bytes that the allowlist does not list, and on the backstop. Chunk sizes are printed, not gated. The base-revision raise rule is gone with the ratchet.
3. **Ratification gate** (`check_kernel_edit_ratified.ts`). `PLUMBING_SOURCE_RE` drops `bundle` from `hook-(?:token|latency|bundle)-budget.json`; token and latency budgets stay watched. Tests pin that the latency budget is still gated and a dispatcher diff still needs a record.
4. **Dispatcher.** (a) The hardened environment in-process concerns run under is built once per dispatch (`concern_env.ts`): one scope before the concern loop, closed after it; after each concern the environment is compared with the hardened copy and reset only on drift, so a variable one concern sets, changes or deletes never reaches the next. Outside an open scope the old per-concern save/harden/restore runs. (b) A per-concern feedback file is written only when the outcome is not a quiet allow (`feedback_policy.ts`); `summary.json` keeps every entry and now also carries `raw_exit_code`; `hooks_doctor` falls back to the summary for its "last feedback" line. No verdict, exit code, severity reduction, fail-closed resolution or host emission changes.
5. **One YAML copy.** `settings.ts` imports `yaml` statically; a new `hooks/bundled_yaml.ts` (imported by `dispatch_entry.ts`) puts the bundle's copy on `globalThis.__acBundledYaml`, and the chunk banner in `hook_chunks.mjs` makes an external `require('yaml')` return it, falling back to a real `require` when absent.
6. **Launcher.** `agent-config dispatch:hook` enables node's compile cache (fail-open) before importing the bundle, so the bundle itself is cached on that path.

Verified locally: hook, dispatcher and gate suites green (112 files / 2,280 tests for the dispatcher-feedback set; 42 ratification-gate tests); a new `tests/scripts/hook_load_set.test.ts` builds a fresh bundle and chunks and fails when a hot event loads anything from `node_modules` — red on all four hot events with the old `createRequire` line restored. Measured on darwin, interleaved n = 40: `pre_tool_use` 81.9 → 66.4 ms p50, `post_tool_use` 89.6 → 74.3 ms.

## What to answer

1. Does any of this weaken a guarantee the dispatcher gives — a fail-closed guard, an exit-code contract, the environment hardening of a concern's child processes, or the isolation between concerns? Name file and line.
2. Does removing `hook-bundle-budget.json` from the watched set, or the allowlist replacing the YAML cap, open a path by which authority expands or a dependency enters every dispatch unreviewed?
3. Is there a defect in `concern_env.ts` (drift detection, nesting, an exception between open and close), in the chunk banner's `require` replacement, or in the feedback policy?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## New files, full content


### `src/config/hook-bundle-budget.json`

````
{
    "_comment": "Package allowlist and one wide backstop for the self-hosted hook bundle (dist/hooks/dispatch.js). Read by src/scripts/check_hook_bundle_composition.ts, which builds the bundle from source with --metafile. WHY: every concern is inlined into one bundle that every hook event loads, so a DEPENDENCY added for one concern is paid by all of them on every dispatch. The incident this exists for was a second YAML parser (95,846 bytes) that reached a release unseen. A new npm package in the bundle is now a red check with one line to add here, reviewed like any dependency. Own-code growth is what features are; it is not gated per byte.",
    "schema_version": 2,
    "registered_at": "2026-10-01",
    "owner": "maintainer",
    "review_by": "2027-10-01",
    "allowed_packages": ["yaml"],
    "allowed_packages_note": "The npm packages allowed to contribute bytes to the bundle. Adding one is a reviewed dependency decision, not a ceiling raise. A second YAML reader is refused by the same rule: only `yaml` is listed.",
    "max_bytes": 1915000,
    "max_bytes_note": "A backstop against slow creep, not a ratchet: the reading on 2026-11-20 (1,595,089 B) plus about 20 %, rounded (owner directive agents/evidence/owner-directives/2026-11-20-hook-bundle-budget-and-hook-economy.md, D1). Expected to fire a few times a year at most; when it does, look at what grew before moving the number. There is no shrink-only rule, no raise log and no per-chunk ceiling any more; the retired file is kept in git at 2eef08c00b and summarised in agents/evidence/analysis/hook-bundle-budget-retired-2026-11-20.md.",
    "what_this_does_not_bound": "Latency: src/config/hook-latency-budget.json owns the wall-clock axis, and a module loaded at runtime outside the bundle is caught by tests/scripts/hook_load_set.test.ts, not here. Nor does it bound dist/install/install.mjs or dist/mcp/server.mjs, which carry their own module graphs."
}
````

### `src/scripts/hooks/concern_env.ts`

````
/**
 * concern_env — the hardened environment in-process concerns run under, built
 * ONCE per dispatch instead of once per concern.
 *
 * In-process concerns may spawn their own children (git, dashboard regen), which
 * inherit `process.env`, so they run under the same hardened copy the spawn path
 * applies (`hardenedSpawnEnv`). The dispatcher used to copy the environment,
 * rebuild the hardened copy, delete and reassign, then restore — per concern.
 * Measured 0.2 ms per concern at 40 variables and up to 2 ms at 235, with 15 to
 * 20 concerns on a tool event (road-to-a-hook-system-that-pays-for-what-it-does
 * 2.3).
 *
 * Now: the dispatch opens one scope before its concern loop (saved environment
 * plus hardened copy, applied once) and closes it after. Each concern leaves
 * through {@link enterConcernEnv}'s release, which compares the environment
 * against the hardened copy and resets it only when the concern changed it —
 * so a variable one concern sets never reaches the next, which is the isolation
 * the per-concern rebuild bought.
 *
 * Outside an open scope (a direct call, a test) `enterConcernEnv` falls back to
 * the old per-concern save, harden and restore, so no caller depends on the
 * scope existing.
 */
import { hardenedSpawnEnv } from '../_lib/spawn_env.js';

interface Scope {
    readonly prev: NodeJS.ProcessEnv;
    readonly hardened: NodeJS.ProcessEnv;
}

let active: Scope | null = null;

/** Make `process.env` equal `target`: drop keys it lacks, set the ones that differ. */
function replaceEnv(target: NodeJS.ProcessEnv): void {
    for (const k of Object.keys(process.env)) {
        if (!(k in target)) delete process.env[k];
    }
    for (const [k, v] of Object.entries(target)) {
        if (v !== undefined && process.env[k] !== v) process.env[k] = v;
    }
}

function drifted(target: NodeJS.ProcessEnv): boolean {
    const keys = Object.keys(process.env);
    if (keys.length !== Object.keys(target).length) return true;
    for (const k of keys) {
        if (process.env[k] !== target[k]) return true;
    }
    return false;
}

/**
 * Open the dispatch-wide scope. Returns the close function, which restores the
 * environment the dispatch started with. A nested open is a no-op.
 */
export function openConcernEnvScope(packageRoot: string): () => void {
    if (active !== null) return () => undefined;
    const prev = { ...process.env };
    const hardened = hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: packageRoot });
    replaceEnv(hardened);
    const scope: Scope = { prev, hardened };
    active = scope;
    return () => {
        if (active !== scope) return;
        replaceEnv(scope.prev);
        active = null;
    };
}

/** Enter the environment for one concern; call the returned function when it has run. */
export function enterConcernEnv(packageRoot: string): () => void {
    const scope = active;
    if (scope === null) return openConcernEnvScope(packageRoot);
    return () => {
        if (drifted(scope.hardened)) replaceEnv(scope.hardened);
    };
}
````

### `src/scripts/hooks/feedback_policy.ts`

````
/**
 * feedback_policy — which concern outcomes get their own feedback file.
 *
 * The dispatcher's per-session `summary.json` carries every concern's entry.
 * A per-concern `<concern>.json` used to be written for every concern on every
 * dispatch: about 16 locked atomic writes per tool event, each overwritten by
 * the next dispatch (road-to-a-hook-system-that-pays-for-what-it-does 2.4).
 * Only an outcome worth looking at on its own keeps a file now; `hooks_doctor`
 * falls back to the summary for the rest.
 */
import { EXIT_ALLOW } from './exit_codes.js';

/** An entry that allowed, was not resolved from a crash, and gave no reason. */
export function isQuietAllow(entry: Readonly<Record<string, unknown>>): boolean {
    return (
        entry['exit_code'] === EXIT_ALLOW &&
        entry['raw_exit_code'] === EXIT_ALLOW &&
        entry['decision'] === 'allow' &&
        (entry['reason'] ?? null) === null
    );
}
````

### `src/scripts/hooks/bundled_yaml.ts`

````
/**
 * bundled_yaml — hands the dispatch bundle's own `yaml` copy to the lazy chunks.
 *
 * Chunks keep `yaml` external (`hook_chunks.mjs`) so a 258 KB parser is not
 * shipped twice. Without this, their `require('yaml')` loaded a SECOND copy from
 * `node_modules` at runtime on every event that loads such a chunk — 72 files
 * read on `post_tool_use`, `user_prompt_submit` and `stop` (load trace,
 * 2026-11-20). The chunk banner in `hook_chunks.mjs` reads this global first and
 * falls back to a real `require` when it is absent, so a chunk loaded outside
 * the bundle (a test, the spawn fallback) behaves exactly as before.
 *
 * The value is the package's CommonJS `module.exports`, which is what a plain
 * `require('yaml')` returns — so the chunk sees the same object shape either way.
 */
import * as yamlNamespace from 'yaml';

export const BUNDLED_YAML_GLOBAL = '__acBundledYaml';

const ns = yamlNamespace as unknown as { default?: unknown };
(globalThis as Record<string, unknown>)[BUNDLED_YAML_GLOBAL] = ns.default ?? yamlNamespace;
````

### `src/scripts/check_hook_bundle_composition.ts`

````
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
````

## The diff of the other changed files (`git diff origin/main...HEAD`)

````diff
diff --git a/.github/workflows/consistency.yml b/.github/workflows/consistency.yml
index db12c9d2ac..623c340e1d 100644
--- a/.github/workflows/consistency.yml
+++ b/.github/workflows/consistency.yml
@@ -249,14 +249,13 @@ jobs:
       - name: Verify the host table's format column names only emitted paths
         run: ./scripts-run src/scripts/check_host_format_column --quiet
 
-      # One YAML reader in the hook bundle, and a byte ceiling on it. Unlike its
-      # two siblings (`check_hook_bundle_freshness` / `_content`) this one is NOT
-      # local-only: it builds its own bundle from source with `--metafile`
-      # instead of reading the untracked `dist/hooks/dispatch.js`, so what it
-      # bounds is a property of the commit rather than of one machine. That is
-      # the whole reason it can fail a pull request, which is where the second
-      # YAML parser it exists to catch would have been caught.
-      - name: Verify the hook bundle carries one YAML reader and stays under its byte ceiling
+      # Only allowlisted npm packages in the hook bundle, and a wide byte
+      # backstop. Unlike its two siblings (`check_hook_bundle_freshness` /
+      # `_content`) this one is NOT local-only: it builds its own bundle from
+      # source with `--metafile`, so what it bounds is a property of the commit
+      # rather than of one machine. That is why it can fail a pull request,
+      # which is where the second YAML parser it exists to catch belongs.
+      - name: Verify the hook bundle carries only allowlisted packages and stays under its backstop
         run: ./scripts-run src/scripts/check_hook_bundle_composition
 
       - name: Verify README size, word and time-to-first-command budgets
diff --git a/src/cli/agent-config.ts b/src/cli/agent-config.ts
index c253de67d1..c0d3e93165 100644
--- a/src/cli/agent-config.ts
+++ b/src/cli/agent-config.ts
@@ -18,6 +18,8 @@ import { createRequire } from 'node:module';
 import { fileURLToPath, pathToFileURL } from 'node:url';
 import { dirname, join } from 'node:path';
 
+import { enableCompileCacheFailOpen } from '../scripts/_lib/compile_cache.js';
+
 const require = createRequire(import.meta.url);
 
 // Hook hot path (road-to-hook-latency-repair Phase 2): `dispatch:hook` runs
@@ -46,6 +48,10 @@ if (_argv[0] === 'dispatch:hook' && !_argv.includes('--config-root')) {
     }
     if (bundle !== null && existsSync(bundle)) {
         _dispatchHotPathTaken = true;
+        // Before the import, not inside the bundle: the cache covers modules
+        // compiled AFTER the call, so a call inside the bundle never caches the
+        // bundle itself (`_lib/compile_cache.ts`). Fail-open.
+        enableCompileCacheFailOpen();
         void import(pathToFileURL(bundle).href)
             .then((mod) => {
                 const code = (mod as { main: (argv?: string[]) => number }).main(_argv.slice(1));
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index fb1713f367..2e9b229479 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -34,7 +34,7 @@
  * `host_lowering.yaml`, their compiled siblings `hook_manifest.json` and
  * `host_lowering.json`, the dispatcher `hooks/dispatch_hook.ts`, the
  * kernel-rule list `_lib/kernel_rules.ts`, a `*-dispatcher.sh`, the token,
- * latency and bundle budget files (see `PLUMBING_SOURCE_RE`), and every module
+ * and latency budget files (see `PLUMBING_SOURCE_RE`), and every module
  * the dispatcher imports that decides an exit code (derived at run time, see
  * `derivedPlumbing`) — a rule of the high-consequence class beyond the kernel
  * (the members of `rule-consequence-class.json`, see `CONSEQUENCE_CLASS_PATH`)
@@ -307,7 +307,7 @@ const GOVERNANCE_HOOK_RE = /^src\/scripts\/hooks\/block_[a-z0-9_]+\.ts$/;
  * is the diff where only the JSON moves.
  */
 const PLUMBING_SOURCE_RE =
-    /^(?:src\/scripts\/hook_manifest\.(?:yaml|json)|src\/scripts\/hooks\/host_lowering\.(?:yaml|json)|src\/scripts\/hooks\/dispatch_hook\.ts|src\/scripts\/_lib\/kernel_rules\.ts|src\/scripts\/hooks\/[a-z0-9-]+-dispatcher\.sh|src\/config\/hook-(?:token|latency|bundle)-budget\.json)$/;
+    /^(?:src\/scripts\/hook_manifest\.(?:yaml|json)|src\/scripts\/hooks\/host_lowering\.(?:yaml|json)|src\/scripts\/hooks\/dispatch_hook\.ts|src\/scripts\/_lib\/kernel_rules\.ts|src\/scripts\/hooks\/[a-z0-9-]+-dispatcher\.sh|src\/config\/hook-(?:token|latency)-budget\.json)$/;
 
 /**
  * The derived half of the plumbing set: every module in the static import
@@ -324,9 +324,11 @@ const PLUMBING_SOURCE_RE =
  * Concerns stay outside: the walk stops at the concern table, and a governance
  * concern is already gated by `GOVERNANCE_HOOK_RE`.
  *
- * `hook-bundle-budget.json` joins the pattern for D3: its ceiling was raised on
- * its own registration day, and a raised ceiling is a looser budget reached one
- * file earlier than the bundle it bounds.
+ * `hook-bundle-budget.json` joined the pattern for D3 (2026-10) and LEFT it on
+ * 2026-11-20 (owner directive `2026-11-20-hook-bundle-budget-and-hook-economy`,
+ * D2): the file now holds a package allowlist and a wide backstop rather than a
+ * shrink-only ceiling, so a change to it is a reviewed dependency decision, not
+ * a loosened kernel budget. The token and latency budgets stay watched.
  */
 let _repoDerived: readonly string[] | null = null;
 export function derivedPlumbing(root: string = REPO): readonly string[] {
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index 3af068f203..b4a539fb7c 100644
--- a/src/scripts/hook_chunks.mjs
+++ b/src/scripts/hook_chunks.mjs
@@ -163,7 +163,11 @@ export const CHUNK_OPTIONS = Object.freeze({
     banner: {
         js:
             "const __acChunkMetaUrl = require('node:url').pathToFileURL(__filename).href; " +
-            'const __acChunkMeta = { url: __acChunkMetaUrl, dirname: __dirname, filename: __filename };',
+            'const __acChunkMeta = { url: __acChunkMetaUrl, dirname: __dirname, filename: __filename }; ' +
+            // An external `yaml` resolves to the copy the dispatch bundle already
+            // carries (`hooks/bundled_yaml.ts`) instead of loading a second one
+            // from node_modules; absent that global, a real require as before.
+            'require = ((r) => Object.assign((id) => (id === "yaml" && globalThis.__acBundledYaml !== undefined ? globalThis.__acBundledYaml : r(id)), r))(require);',
     },
 });
 
diff --git a/src/scripts/hooks/dispatch_entry.ts b/src/scripts/hooks/dispatch_entry.ts
index 53b706678a..15ae460fad 100644
--- a/src/scripts/hooks/dispatch_entry.ts
+++ b/src/scripts/hooks/dispatch_entry.ts
@@ -12,6 +12,7 @@
 import * as path from 'node:path';
 import { fileURLToPath } from 'node:url';
 
+import './bundled_yaml.js';
 import { enableCompileCacheFailOpen } from '../_lib/compile_cache.js';
 import { withDispatchSnapshotScope } from '../_lib/stop_snapshot.js';
 import { main as dispatchMain } from './dispatch_hook.js';
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index 16ac1faf33..ec91c09d56 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -73,6 +73,8 @@ import { _fallback_yaml } from './fallback_yaml.js';
 import { detectSurface } from '../_lib/surface.js';
 import { recordCapture, recordOpportunity } from "../_lib/collector_denominator.js";
 import { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN, EXIT_USAGE } from './exit_codes.js';
+import { enterConcernEnv, openConcernEnvScope } from './concern_env.js';
+import { isQuietAllow } from './feedback_policy.js';
 export { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN };
 export { _fallback_yaml } from './fallback_yaml.js';
 
@@ -621,11 +623,11 @@ function _run_concern_inproc(
   const prevStderrWrite = process.stderr.write;
   const prevArgv = process.argv;
   const prevCwd = process.cwd();
-  const prevEnv = { ...process.env };
 
   const started = performance.now();
   let rc = 0;
   setHookStdinOverride(_compactJsonDumps(envelope));
+  const leaveEnv = enterConcernEnv(REPO_ROOT);
   process.stdout.write = makeCapture((s) => {
     out += s;
   });
@@ -634,13 +636,7 @@ function _run_concern_inproc(
   });
   try {
     process.argv = [prevArgv[0] as string, scriptAbs, ...argsList];
-    // Same env-hardening the spawn path applied — concerns may spawn their
-    // own children (dashboard regen, git), which inherit process.env.
-    const hardened = hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: REPO_ROOT });
-    for (const k of Object.keys(process.env)) {
-      if (!(k in hardened)) delete process.env[k];
-    }
-    Object.assign(process.env, hardened);
+    // Hardened once per dispatch, reset only if this concern changed it: concern_env.ts.
     if (workspace !== prevCwd && _isDir(workspace)) {
       process.chdir(workspace);
     }
@@ -661,10 +657,7 @@ function _run_concern_inproc(
     process.stdout.write = prevStdoutWrite;
     process.stderr.write = prevStderrWrite;
     process.argv = prevArgv;
-    for (const k of Object.keys(process.env)) {
-      if (!(k in prevEnv)) delete process.env[k];
-    }
-    Object.assign(process.env, prevEnv);
+    leaveEnv();
     try {
       if (process.cwd() !== prevCwd) process.chdir(prevCwd);
     } catch {
@@ -822,6 +815,7 @@ function _write_feedback(
     return;
   }
   for (const entry of entries) {
+    if (isQuietAllow(entry)) continue; // summary.json carries it: feedback_policy.ts
     const target = path.join(fb_dir, `${entry["concern"]}.json`);
     try {
       atomic_write_json(target, entry);
@@ -835,6 +829,7 @@ function _write_feedback(
   const SUMMARY_KEYS = new Set([
     "concern",
     "exit_code",
+    "raw_exit_code",
     "severity",
     "decision",
     "reason",
@@ -1297,6 +1292,7 @@ export function main(argv?: string[]): number {
     keep_by_concern.map(([, keep]) => keep),
     egress.placeholder,
   );
+  const closeConcernEnv = openConcernEnvScope(REPO_ROOT);
   for (const [concern, keep_classes] of keep_by_concern) {
     if (!_concern_matches_tool(concern, tool_name)) {
       continue;
@@ -1401,6 +1397,7 @@ export function main(argv?: string[]): number {
       payload_stubs: stubs_served,
     });
   }
+  closeConcernEnv();
   const final_rc = _reduce(rcs);
   writeConcernTimings(String(envelope["event"] ?? ""), String(envelope["platform"] ?? ""), timing_samples);
   _write_feedback(envelope, session_id, feedback_entries, final_rc, started_at);
diff --git a/src/scripts/hooks_doctor.ts b/src/scripts/hooks_doctor.ts
index 72182e9580..e84fb93aa5 100644
--- a/src/scripts/hooks_doctor.ts
+++ b/src/scripts/hooks_doctor.ts
@@ -125,6 +125,9 @@ function _concern_state_file(state_dir: string, concern: string): string | null
 /**
  * Return the most-recent dispatcher feedback file for the concern,
  * walking `agents/runtime/state/.dispatcher/<session>/<concern>.json`.
+ * Since 2026-11-20 a concern that only ever allowed quietly has no file of its
+ * own (`hooks/feedback_policy.ts`); its last run is then the newest session
+ * `summary.json` that lists it.
  */
 function _latest_feedback(state_dir: string, concern: string): string | null {
   const dispatcher_dir = path.join(state_dir, ".dispatcher");
@@ -144,10 +147,20 @@ function _latest_feedback(state_dir: string, concern: string): string | null {
       const st = fs.statSync(candidate);
       if (st.isFile()) {
         candidates.push({ p: candidate, mtime: st.mtimeMs });
+        continue;
       }
     } catch {
       /* not a file */
     }
+    const summary = path.join(dispatcher_dir, sess, "summary.json");
+    try {
+      const st = fs.statSync(summary);
+      if (st.isFile() && _summary_lists(summary, concern)) {
+        candidates.push({ p: summary, mtime: st.mtimeMs });
+      }
+    } catch {
+      /* no summary */
+    }
   }
   if (candidates.length === 0) {
     return null;
@@ -156,6 +169,15 @@ function _latest_feedback(state_dir: string, concern: string): string | null {
   return candidates[0]!.p;
 }
 
+function _summary_lists(summary: string, concern: string): boolean {
+  try {
+    const doc = JSON.parse(fs.readFileSync(summary, "utf-8")) as { invocations?: Array<{ concerns?: Array<{ concern?: unknown }> }> };
+    return (doc.invocations ?? []).some((inv) => (inv.concerns ?? []).some((c) => c.concern === concern));
+  } catch {
+    return false;
+  }
+}
+
 function _rel(p: string | null, root: string): string | null {
   if (p === null) {
     return null;
diff --git a/tests/scripts/check_kernel_edit_ratified_import_closure.test.ts b/tests/scripts/check_kernel_edit_ratified_import_closure.test.ts
index f4e013fa68..6db9ac95e6 100644
--- a/tests/scripts/check_kernel_edit_ratified_import_closure.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified_import_closure.test.ts
@@ -98,14 +98,15 @@ describe('the fence follows the dispatcher import closure', () => {
         expect(evaluate([UNRELATED_CONCERN], root, 2).exitCode).toBe(0);
     });
 
-    it('the stdin-failure policy and the bundle budget are watched too', () => {
+    it('the stdin-failure policy and the latency budget are watched; the bundle budget is not', () => {
         const gated = classifyPaths([
             'src/scripts/hooks/stdin_failure_policy.ts',
+            'src/config/hook-latency-budget.json',
             'src/config/hook-bundle-budget.json',
         ]);
         expect(gated.plumbing).toEqual([
             'src/scripts/hooks/stdin_failure_policy.ts',
-            'src/config/hook-bundle-budget.json',
+            'src/config/hook-latency-budget.json',
         ]);
     });
 
diff --git a/tests/scripts/check_kernel_edit_ratified_local_base.test.ts b/tests/scripts/check_kernel_edit_ratified_local_base.test.ts
index 1d6b19ed9d..a4a509c5f8 100644
--- a/tests/scripts/check_kernel_edit_ratified_local_base.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified_local_base.test.ts
@@ -215,7 +215,7 @@ describe('a module joining the dispatcher closure', () => {
 
     it('a plumbing file matched by name, outside any closure, is gated in both shapes', () => {
         const base = buildChange();
-        const budget = 'src/config/hook-bundle-budget.json';
+        const budget = 'src/config/hook-latency-budget.json';
         write(budget, '{ "ceiling": 1 }\n');
         commitAll(root, 'budget');
         git(['worktree', 'add', '--detach', baseDir, base]);
````

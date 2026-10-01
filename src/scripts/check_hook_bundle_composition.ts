#!/usr/bin/env tsx
/**
 * Composition gate for the self-hosted hook bundle: ONE YAML reader, and a
 * byte ceiling.
 *
 * WHY THIS EXISTS — measured, not hypothetical.
 *
 * Every concern is inlined into one `dist/hooks/dispatch.js` that every hook
 * event loads, so a dependency added for ONE concern is paid by all of them on
 * every dispatch. On 2026-10-01 the bundle carried two YAML parsers: `yaml`,
 * pulled by six modules including the dispatcher itself, and `js-yaml`, pulled
 * by one call site in `block_config_weakening.ts` — 95,846 bytes, 6.13 % of a
 * 1,564,211-byte bundle. Beside it, `host_lowering.ts`'s own header said the
 * `yaml` reader was "the ONLY remaining YAML reader on that path".
 *
 * Nothing in this tree could see either fact. The freshness gate compares
 * mtimes, the content gate compares digests, and neither has an opinion about
 * what is INSIDE the bundle. So the second parser reached a release and was
 * found by an external rescore counting bytes — a review finding where it
 * should have been a red check. This gate is that red check.
 *
 * WHAT IT CHECKS
 *
 *   1. At most `max_yaml_packages` YAML packages contribute bytes to the
 *      bundle. The package set is {@link YAML_PACKAGES} — a closed list, so a
 *      third parser arriving under a name nobody listed is NOT caught here, and
 *      that limit is stated rather than implied.
 *   2. The bundle's byte count is at or under `max_bytes`.
 *
 * Both bounds live in `src/config/hook-bundle-budget.json`, never in this file:
 * a number a reviewer has to read a script to find is a number nobody reviews.
 *
 * WHY IT BUILDS RATHER THAN READS. `dist/hooks/` is untracked, so a gate that
 * read the bundle on disk would be local-only like `check_hook_bundle_content`
 * — and the thing being bounded is what the SOURCE produces, which is a
 * property of the commit rather than of a machine. So this builds its own
 * bundle with `--metafile` and measures that. It runs identically in CI and
 * locally, and it never touches the live bundle.
 *
 * The esbuild invocation is NOT duplicated here: it is read from
 * `package.json`'s `build:hooks` script with only `--outfile=` rewritten, via
 * the same `rewriteOutfile` helper `rebuild_hook_bundle` and
 * `check_hook_bundle_content` use, so the flag set has exactly one home. The
 * trailing `&& node src/scripts/write_bundle_digest.mjs` is stripped — this
 * gate must not write a sidecar for a probe bundle nobody executes.
 *
 * WHAT IT DOES NOT DO. It says nothing about LATENCY. A smaller bundle is not
 * a measured speed-up; `src/config/hook-latency-budget.json` owns that axis and
 * no number here is derived from it. It says nothing about the install or MCP
 * bundles, which carry their own module graphs.
 *
 * Usage:
 *     ./scripts-run src/scripts/check_hook_bundle_composition
 *     ./scripts-run src/scripts/check_hook_bundle_composition --metafile <path>
 *     ./scripts-run src/scripts/check_hook_bundle_composition --self-test
 *
 * Exit codes: 0 = within budget · 1 = over the ceiling or a second reader ·
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
import { rewriteOutfile } from './rebuild_hook_bundle.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(_HERE, '..', '..');
export const SELF_REL = path.join('src', 'scripts', 'check_hook_bundle_composition.ts');
export const BUDGET_REL = path.join('src', 'config', 'hook-bundle-budget.json');
const LIVE_REL = path.join('dist', 'hooks', 'dispatch.js');

/**
 * The YAML readers this tree has ever carried, by package name.
 *
 * A CLOSED LIST, and the consequence is worth stating: a fourth parser arriving
 * under a name not listed here contributes bytes the ceiling catches and the
 * parser cap does not. The alternative — treating any package whose name
 * contains "yaml" as a reader — would match a YAML-adjacent utility that is not
 * a parser, and a cap that fires on the wrong package is worse than one that
 * misses an unlisted one, because the first teaches people to raise the cap.
 */
export const YAML_PACKAGES: readonly string[] = ['yaml', 'js-yaml', 'yaml-js', 'yamljs'];

export interface Budget {
    readonly maxBytes: number;
    readonly maxYamlPackages: number;
}

export interface Analysis {
    /** Bytes of the bundle esbuild produced. */
    readonly bytes: number;
    /** Modules that contributed to it — the unit `scanned:` reports. */
    readonly modules: number;
    /** Bytes in the output, summed per owning npm package. */
    readonly packageBytes: ReadonlyMap<string, number>;
    /** Listed YAML packages contributing more than zero bytes, sorted. */
    readonly yamlPackages: readonly string[];
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
        if (pkg === null) continue;
        packageBytes.set(pkg, (packageBytes.get(pkg) ?? 0) + (v.bytesInOutput ?? 0));
    }
    const yamlPackages = YAML_PACKAGES.filter((p) => (packageBytes.get(p) ?? 0) > 0).sort();
    return {
        bytes: out.bytes ?? 0,
        modules: Object.keys(inputs).length,
        packageBytes,
        yamlPackages,
    };
}

/** Read the committed budget. Throws rather than defaulting — a guessed ceiling bounds nothing. */
export function readBudget(root: string): Budget {
    const abs = path.join(root, BUDGET_REL);
    const raw = JSON.parse(fs.readFileSync(abs, 'utf-8')) as Record<string, unknown>;
    const maxBytes = raw['max_bytes'];
    const maxYaml = raw['max_yaml_packages'];
    if (typeof maxBytes !== 'number' || !Number.isInteger(maxBytes) || maxBytes <= 0) {
        throw new Error(`${BUDGET_REL}: max_bytes must be a positive integer, got ${JSON.stringify(maxBytes)}`);
    }
    if (typeof maxYaml !== 'number' || !Number.isInteger(maxYaml) || maxYaml < 1) {
        throw new Error(
            `${BUDGET_REL}: max_yaml_packages must be an integer >= 1, got ${JSON.stringify(maxYaml)}`,
        );
    }
    return { maxBytes, maxYamlPackages: maxYaml };
}

/** Findings, one line each. Empty means within budget. */
export function verdict(a: Analysis, budget: Budget): string[] {
    const findings: string[] = [];
    if (a.yamlPackages.length > budget.maxYamlPackages) {
        const detail = a.yamlPackages
            .map((p) => `${p} (${String(a.packageBytes.get(p) ?? 0)} B)`)
            .join(', ');
        findings.push(
            `${String(a.yamlPackages.length)} YAML readers in the bundle, cap is ` +
                `${String(budget.maxYamlPackages)}: ${detail}. Every dispatch loads all of them. ` +
                'Move the odd caller onto the reader the dispatcher already uses.',
        );
    }
    if (a.bytes > budget.maxBytes) {
        findings.push(
            `bundle is ${String(a.bytes)} bytes, ceiling is ${String(budget.maxBytes)} ` +
                `(over by ${String(a.bytes - budget.maxBytes)}). Shrink the bundle, or raise ` +
                `max_bytes in ${BUDGET_REL} WITH an entry in its raise_log naming what was added.`,
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
        // Strip the digest sidecar step: it would write `dispatch.sha256` beside
        // a probe bundle nobody executes, and on failure it would mask the build
        // error with a file-not-found.
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
                inputs: Object.fromEntries(
                    Object.entries(inputs).map(([k, v]) => [k, { bytesInOutput: v }]),
                ),
            },
        },
    });
    const budget = readBudget(REPO_ROOT);
    const clean = write('clean.json', meta(budget.maxBytes, { 'node_modules/yaml/dist/index.js': 10 }));
    const twoReaders = write(
        'two-readers.json',
        meta(1000, {
            'node_modules/yaml/dist/index.js': 600,
            'node_modules/js-yaml/dist/js-yaml.mjs': 400,
        }),
    );
    const oneOver = write('one-over.json', meta(budget.maxBytes + 1, { 'src/x.ts': 1 }));
    const empty = write('empty.json', { inputs: {}, outputs: {} });

    const drive = (fixture: string): number =>
        runGateCli(REPO_ROOT, SELF_REL, ['--metafile', fixture], REPO_ROOT);

    try {
        return runSelfTest({
            gate: 'check_hook_bundle_composition',
            minCases: 4,
            minRejectCases: 3,
            cases: [
                {
                    name: 'one YAML reader, exactly at the ceiling → accepted',
                    expect: 'accept',
                    run: () => drive(clean),
                },
                {
                    name: 'a second YAML reader → rejected',
                    expect: 'reject',
                    run: () => drive(twoReaders),
                },
                {
                    name: 'one byte over the ceiling → rejected',
                    expect: 'reject',
                    run: () => drive(oneOver),
                },
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
    if (argv.includes('--self-test')) {
        return selfTest();
    }
    const at = argv.indexOf('--metafile');
    const fixture = at >= 0 ? argv[at + 1] : undefined;

    let budget: Budget;
    try {
        budget = readBudget(root);
    } catch (e) {
        process.stderr.write(`check_hook_bundle_composition: ${String(e instanceof Error ? e.message : e)}\n`);
        return 2;
    }

    let json: string;
    try {
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
    // Reported on BOTH paths, red included: a census that goes quiet exactly
    // when the gate fires is the shape `reportScanned` exists to prevent.
    reportScanned({
        gate: 'check_hook_bundle_composition',
        scanned: analysis.modules,
        units: 'bundled module(s)',
        roots: [LIVE_REL],
    });

    if (findings.length === 0) {
        process.stdout.write(
            `✅  hook bundle: ${String(analysis.bytes)} B / ${String(budget.maxBytes)} B ceiling, ` +
                `${String(analysis.yamlPackages.length)} YAML reader(s) ` +
                `[${analysis.yamlPackages.join(', ')}], ${String(analysis.modules)} modules\n`,
        );
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

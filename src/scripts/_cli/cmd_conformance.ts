/**
 * `agent-config conformance` — consumer conformance contract
 * (road-to-flow-learnings Phase 0).
 *
 * Thin orchestrator over `cmd_doctor`'s exported check runner plus five
 * consumer-facing checks that answer ONE question deterministically:
 * "is agent-config installed AND firing in this repo?"
 *
 *   (a) txlog-clean          — install log tail carries no abandoned run
 *   (b) router-pointers      — dist/router.json ids + routes_to resolve on disk
 *   (c) hook-dispatcher      — dispatcher answers synthetic session_start/stop
 *   (d) lean-projection      — lean_projection.mode matches projected artifacts
 *   (e) host-manifest        — subagents.host_capabilities parses strictly
 *
 * All checks are deterministic — no LLM, no network. Exit contract:
 *   0 = every check ok/skipped (warns allowed) and doctor --ci green
 *   1 = at least one check failed (or doctor drift / doctor check fail)
 *   2 = environment unresolvable (no project root, internal error)
 *
 * Every run appends ONE JSONL report line (txlog shape) to
 * `~/.event4u/agent-config/conformance-log.jsonl` (override:
 * `AGENT_CONFIG_CONFORMANCE_LOG`) so fleet runs can aggregate results.
 *
 * Contract page: docs/contracts/conformance.md
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as YAML from 'yaml';

import * as installed_tools from '../_lib/installed_tools.js';
import { atomicAppendLine } from '../../install/atomic.js';
import { readRecentEntries } from '../../install/txlog.js';
import { detectToolPresence } from '../../install/detect.js';
import {
    _classify,
    _collect_manifest_entries,
    _foreign_records,
    _jsonDumpsIndentAscii,
    _resolve_project_root,
    _run_checks,
    _run_checks_no_manifest,
    _scan_foreign,
    ArgparseExit,
    BRIDGE_MARKER_RELATIVE,
    STATUS_SYMBOLS,
} from './cmd_doctor.js';

type Dict = Record<string, unknown>;

const _HERE = fileURLToPath(import.meta.url);

/** Package root — two levels above `src/scripts/_cli/`. */
export const PACKAGE_ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');

/** Ordered registry of conformance check identifiers. */
export const CONFORMANCE_CHECK_IDS = [
    'txlog-clean',
    'router-pointers',
    'hook-dispatcher',
    'lean-projection',
    'host-manifest',
] as const;

/** Marker emitted by `project_thin_rules.thin_entry()` — the thin-stub signature. */
export const THIN_STUB_MARKER = 'Routed rule — load the body on trigger-match';

function print(s = ''): void {
    process.stdout.write(`${s}\n`);
}

function eprint(s = ''): void {
    process.stderr.write(`${s}\n`);
}

/** Default JSONL report path (mirrors the install txlog directory). */
export function conformanceLogPath(): string {
    const override = process.env['AGENT_CONFIG_CONFORMANCE_LOG'];
    if (override && override.trim().length > 0) {
        return override;
    }
    return path.join(os.homedir(), '.event4u', 'agent-config', 'conformance-log.jsonl');
}

/** Default install txlog path (kept in sync with `src/install/txlog.ts` docs). */
export function installLogPath(): string {
    const override = process.env['AGENT_CONFIG_INSTALL_LOG'];
    if (override && override.trim().length > 0) {
        return override;
    }
    return path.join(os.homedir(), '.event4u', 'agent-config', 'install-log.jsonl');
}

// ---------------------------------------------------------------------------
// Check (a) — txlog tail clean.
// ---------------------------------------------------------------------------

export function _check_txlog_clean(logPath: string = installLogPath()): Dict {
    if (!fs.existsSync(logPath)) {
        return {
            id: 'txlog-clean',
            status: 'ok',
            message: 'no install transaction log — nothing to recover',
            remedy: '',
        };
    }
    const entries = readRecentEntries(logPath);
    if (entries.length === 0) {
        return {
            id: 'txlog-clean',
            status: 'ok',
            message: 'install transaction log is empty',
            remedy: '',
        };
    }
    const last = entries[entries.length - 1] as { kind: string; ts: string; note?: string };
    if (last.kind === 'abort') {
        return {
            id: 'txlog-clean',
            status: 'fail',
            message:
                `install log tail is an abandoned run (abort at ${last.ts}` +
                `${last.note ? `: ${last.note}` : ''})`,
            remedy: 're-run `agent-config init` (recovery reverse-applies the aborted tail)',
        };
    }
    return {
        id: 'txlog-clean',
        status: 'ok',
        message: `install log tail clean (${entries.length} recent entries, last: ${last.kind})`,
        remedy: '',
    };
}

// ---------------------------------------------------------------------------
// Check (b) — router pointers resolve against the installed package tree.
// ---------------------------------------------------------------------------

/**
 * Map one `routes_to` target (`<kind>:<id>`) to its candidate
 * package-relative paths. The FIRST existing candidate wins.
 *
 * `contract:` has two legitimate homes in the shipped tree: the public
 * contract pages under `docs/contracts/` (per the rule-router contract)
 * and the agent-facing contract contexts under
 * `dist/agent-src/contexts/contracts/` (e.g. artifact-engagement-flow).
 */
export function routeTargetPaths(target: string): string[] {
    const sep = target.indexOf(':');
    if (sep <= 0) return [];
    const kind = target.slice(0, sep);
    const id = target.slice(sep + 1);
    if (!id) return [];
    switch (kind) {
        case 'skill':
            return [path.join('dist', 'agent-src', 'skills', id, 'SKILL.md')];
        case 'command':
            return [path.join('dist', 'agent-src', 'commands', `${id}.md`)];
        case 'guideline':
            return [path.join('docs', 'guidelines', `${id}.md`)];
        case 'contract':
            return [
                path.join('docs', 'contracts', `${id}.md`),
                path.join('dist', 'agent-src', 'contexts', 'contracts', `${id}.md`),
            ];
        default:
            return [];
    }
}

export function _check_router_pointers(packageRoot: string = PACKAGE_ROOT): Dict {
    const routerPath = path.join(packageRoot, 'dist', 'router.json');
    if (!fs.existsSync(routerPath)) {
        return {
            id: 'router-pointers',
            status: 'fail',
            message: `router index missing: ${routerPath}`,
            remedy: 'reinstall the package (dist/router.json ships with every release)',
        };
    }
    let router: Dict;
    try {
        router = JSON.parse(fs.readFileSync(routerPath, 'utf8')) as Dict;
    } catch (exc) {
        return {
            id: 'router-pointers',
            status: 'fail',
            message: `router index does not parse: ${(exc as Error).message}`,
            remedy: 'reinstall the package — dist/router.json is corrupt',
        };
    }
    const rulesDir = path.join(packageRoot, 'dist', 'agent-src', 'rules');
    const broken: string[] = [];
    let ids = 0;
    let targets = 0;

    for (const kernelId of (router['kernel'] as string[] | undefined) ?? []) {
        ids += 1;
        if (!fs.existsSync(path.join(rulesDir, `${kernelId}.md`))) {
            broken.push(`kernel:${kernelId} → rules/${kernelId}.md missing`);
        }
    }
    for (const tier of ['tier_1', 'tier_2']) {
        for (const entry of (router[tier] as Dict[] | undefined) ?? []) {
            const ruleId = String(entry['id'] ?? '');
            ids += 1;
            if (!fs.existsSync(path.join(rulesDir, `${ruleId}.md`))) {
                broken.push(`${tier}:${ruleId} → rules/${ruleId}.md missing`);
            }
            for (const target of (entry['routes_to'] as string[] | undefined) ?? []) {
                targets += 1;
                const candidates = routeTargetPaths(String(target));
                if (candidates.length === 0) {
                    broken.push(`${ruleId} → unparseable routes_to ${JSON.stringify(target)}`);
                    continue;
                }
                if (!candidates.some((rel) => fs.existsSync(path.join(packageRoot, rel)))) {
                    broken.push(`${ruleId} → ${target} (${candidates[0]} missing)`);
                }
            }
        }
    }
    if (broken.length > 0) {
        const sample = broken.slice(0, 5).join('; ');
        return {
            id: 'router-pointers',
            status: 'fail',
            message: `${broken.length} unresolved router pointer(s): ${sample}`,
            remedy: 'reinstall the package; if this is a dev tree, run the compile/condense pipeline',
        };
    }
    return {
        id: 'router-pointers',
        status: 'ok',
        message: `router index parses; ${ids} rule ids + ${targets} routes_to targets resolve`,
        remedy: '',
    };
}

// ---------------------------------------------------------------------------
// Check (c) — hook dispatcher answers synthetic session_start / stop.
// ---------------------------------------------------------------------------

/** Detected platform for the dispatcher smoke — first match wins. */
export function detectSmokePlatform(projectRoot: string): string {
    const presence = detectToolPresence(projectRoot);
    if (presence.claude) return 'claude';
    if (presence.cursor) return 'cursor';
    if (presence.augment) return 'augment';
    if (presence.windsurf) return 'windsurf';
    if (presence.cline) return 'cline';
    return 'claude';
}

/** Resolve the dispatcher runner: local tsx binary, else `npx tsx`. */
function dispatcherRunner(packageRoot: string): string[] {
    const localTsx = path.join(packageRoot, 'node_modules', '.bin', 'tsx');
    const script = path.join(packageRoot, 'src', 'scripts', 'hooks', 'dispatch_hook.ts');
    if (fs.existsSync(localTsx)) {
        return [localTsx, script];
    }
    return ['npx', 'tsx', script];
}

export interface DispatcherSmokeOptions {
    /** Full argv override (tests) — payload is still piped on stdin. */
    readonly runner?: readonly string[];
    readonly platform?: string;
    readonly timeoutMs?: number;
}

export function _check_hook_dispatcher(
    projectRoot: string,
    packageRoot: string = PACKAGE_ROOT,
    opts: DispatcherSmokeOptions = {},
): Dict {
    const platform = opts.platform ?? detectSmokePlatform(projectRoot);
    const runner = opts.runner ?? dispatcherRunner(packageRoot);
    const results: string[] = [];
    for (const event of ['session_start', 'stop'] as const) {
        const payload = JSON.stringify({
            session_id: 'conformance-smoke',
            cwd: projectRoot,
            platform_hint: platform,
            ...(event === 'stop' ? { stop_reason: 'conformance-smoke' } : { source: 'startup' }),
        });
        const argv = [...runner, '--platform', platform, '--event', event];
        const proc = spawnSync(argv[0] as string, argv.slice(1), {
            input: payload,
            cwd: projectRoot,
            encoding: 'utf8',
            timeout: opts.timeoutMs ?? 30_000,
        });
        if (proc.error) {
            return {
                id: 'hook-dispatcher',
                status: 'fail',
                message: `dispatcher spawn failed for ${event}: ${proc.error.message}`,
                remedy: 'verify the package install (node_modules present) and re-run',
            };
        }
        // Dispatcher exit vocabulary: 0 allow · 1 block · 2 warn. A smoke
        // envelope must never block; allow/warn both count as "firing".
        if (proc.status !== 0 && proc.status !== 2) {
            const tail = (proc.stderr ?? '').trim().split('\n').slice(-2).join(' | ');
            return {
                id: 'hook-dispatcher',
                status: 'fail',
                message: `dispatcher returned exit ${proc.status} for synthetic ${event} (${tail || 'no stderr'})`,
                remedy: 'run `agent-config doctor --check offline-readiness` and check hook_manifest.yaml',
            };
        }
        results.push(`${event}=${proc.status}`);
    }
    return {
        id: 'hook-dispatcher',
        status: 'ok',
        message: `dispatcher (platform: ${platform}) answered ${results.join(', ')}`,
        remedy: '',
    };
}

// ---------------------------------------------------------------------------
// Check (d) — lean_projection.mode consistent with projected artifacts.
// ---------------------------------------------------------------------------

function readSettingsMode(projectRoot: string): string {
    const settingsPath = path.join(projectRoot, '.agent-settings.yml');
    if (!fs.existsSync(settingsPath)) {
        return 'eager-all';
    }
    try {
        const parsed = YAML.parse(fs.readFileSync(settingsPath, 'utf8')) as Dict | null;
        const lean = (parsed?.['lean_projection'] ?? null) as Dict | null;
        const mode = lean?.['mode'];
        return typeof mode === 'string' && mode.length > 0 ? mode : 'eager-all';
    } catch {
        return 'eager-all';
    }
}

function kernelIdsFromRouter(packageRoot: string): Set<string> {
    try {
        const router = JSON.parse(
            fs.readFileSync(path.join(packageRoot, 'dist', 'router.json'), 'utf8'),
        ) as Dict;
        return new Set(((router['kernel'] as string[] | undefined) ?? []).map(String));
    } catch {
        return new Set();
    }
}

export function _check_lean_projection(
    projectRoot: string,
    packageRoot: string = PACKAGE_ROOT,
    projectedRulesDir?: string,
): Dict {
    const mode = readSettingsMode(projectRoot);
    if (mode !== 'eager-all' && mode !== 'thin') {
        return {
            id: 'lean-projection',
            status: 'fail',
            message: `lean_projection.mode has unknown value ${JSON.stringify(mode)}`,
            remedy: "set lean_projection.mode to 'eager-all' or 'thin' in .agent-settings.yml",
        };
    }
    const rulesDir = projectedRulesDir ?? path.join(projectRoot, '.augment', 'rules');
    if (!fs.existsSync(rulesDir)) {
        return {
            id: 'lean-projection',
            status: 'skipped',
            message: `no projected rules dir at ${rulesDir} — projection consistency not applicable`,
            remedy: '',
        };
    }
    const kernel = kernelIdsFromRouter(packageRoot);
    const files = fs
        .readdirSync(rulesDir)
        .filter((f) => f.endsWith('.md') && f !== 'INDEX.md')
        .sort();
    const nonKernel = files.filter((f) => !kernel.has(f.replace(/\.md$/, '')));
    if (nonKernel.length === 0) {
        return {
            id: 'lean-projection',
            status: 'skipped',
            message: 'no non-kernel projected rules found — nothing to compare',
            remedy: '',
        };
    }
    const inconsistent: string[] = [];
    for (const f of nonKernel) {
        let text = '';
        try {
            text = fs.readFileSync(path.join(rulesDir, f), 'utf8');
        } catch {
            continue; // dangling symlink etc. — not this check's concern
        }
        const isStub = text.includes(THIN_STUB_MARKER);
        if (mode === 'thin' && !isStub) {
            inconsistent.push(`${f} (full body under thin mode)`);
        }
        if (mode === 'eager-all' && isStub) {
            inconsistent.push(`${f} (thin stub under eager-all mode)`);
        }
    }
    if (inconsistent.length > 0) {
        const sample = inconsistent.slice(0, 3).join('; ');
        return {
            id: 'lean-projection',
            status: 'fail',
            message:
                `${inconsistent.length}/${nonKernel.length} projected rules contradict ` +
                `lean_projection.mode=${mode}: ${sample}`,
            remedy: 're-run the install/sync so the projection matches the configured mode',
        };
    }
    return {
        id: 'lean-projection',
        status: 'ok',
        message: `mode=${mode} consistent across ${nonKernel.length} non-kernel projected rules`,
        remedy: '',
    };
}

// ---------------------------------------------------------------------------
// Check (e) — host-capability manifest parses strictly + matches detection.
// ---------------------------------------------------------------------------

const HOST_MANIFEST_KEYS = new Set([
    'schema_version',
    'subagent_spawn',
    'parallel_spawn',
    'status_polling',
    'separate_quota_pool',
]);

export function _check_host_manifest(projectRoot: string): Dict {
    const detected = Object.entries(detectToolPresence(projectRoot))
        .filter(([, v]) => v === true)
        .map(([k]) => k);
    const detectedNote =
        detected.length > 0 ? `detected surfaces: ${detected.join(', ')}` : 'no surfaces detected';

    const settingsPath = path.join(projectRoot, '.agent-settings.yml');
    if (!fs.existsSync(settingsPath)) {
        return {
            id: 'host-manifest',
            status: 'ok',
            message: `no .agent-settings.yml — safe-default manifest applies (${detectedNote})`,
            remedy: '',
        };
    }
    let parsed: Dict | null = null;
    try {
        parsed = YAML.parse(fs.readFileSync(settingsPath, 'utf8')) as Dict | null;
    } catch (exc) {
        return {
            id: 'host-manifest',
            status: 'fail',
            message: `.agent-settings.yml does not parse: ${(exc as Error).message}`,
            remedy: 'fix the YAML syntax, or run `agent-config settings:check`',
        };
    }
    const subagents = (parsed?.['subagents'] ?? null) as Dict | null;
    const manifest = subagents?.['host_capabilities'];
    if (manifest === undefined || manifest === null) {
        return {
            id: 'host-manifest',
            status: 'ok',
            message: `no host_capabilities override — safe-default manifest applies (${detectedNote})`,
            remedy: '',
        };
    }
    if (typeof manifest !== 'object' || Array.isArray(manifest)) {
        return {
            id: 'host-manifest',
            status: 'fail',
            message: 'subagents.host_capabilities is not a mapping',
            remedy: 'use the four boolean fields from the host-capability manifest contract',
        };
    }
    const problems: string[] = [];
    for (const [key, value] of Object.entries(manifest as Dict)) {
        if (!HOST_MANIFEST_KEYS.has(key)) {
            problems.push(`unknown key '${key}'`);
            continue;
        }
        if (key === 'schema_version') {
            if (value !== 1) problems.push(`schema_version must be 1 (got ${JSON.stringify(value)})`);
            continue;
        }
        if (typeof value !== 'boolean') {
            problems.push(`'${key}' must be boolean (got ${JSON.stringify(value)})`);
        }
    }
    if (problems.length > 0) {
        return {
            id: 'host-manifest',
            status: 'fail',
            message: `host_capabilities malformed: ${problems.slice(0, 4).join('; ')}`,
            remedy: 'only schema_version:1 + four boolean capability fields are valid',
        };
    }
    return {
        id: 'host-manifest',
        status: 'ok',
        message: `host_capabilities override parses strictly (${detectedNote})`,
        remedy: '',
    };
}

// ---------------------------------------------------------------------------
// Orchestration.
// ---------------------------------------------------------------------------

export interface ConformanceRunOptions {
    readonly projectRoot?: string;
    readonly packageRoot?: string;
    /** Skip the dispatcher spawn (unit tests / no-node sandboxes). */
    readonly skipDispatcher?: boolean;
}

export function runConformanceChecks(opts: ConformanceRunOptions = {}): Dict[] {
    const projectRoot = opts.projectRoot ?? process.cwd();
    const packageRoot = opts.packageRoot ?? PACKAGE_ROOT;
    const checks: Dict[] = [];
    checks.push(_check_txlog_clean());
    checks.push(_check_router_pointers(packageRoot));
    if (opts.skipDispatcher === true) {
        checks.push({
            id: 'hook-dispatcher',
            status: 'skipped',
            message: 'dispatcher smoke skipped by flag',
            remedy: '',
        });
    } else {
        checks.push(_check_hook_dispatcher(projectRoot, packageRoot));
    }
    checks.push(_check_lean_projection(projectRoot, packageRoot));
    checks.push(_check_host_manifest(projectRoot));
    return checks;
}

/** One JSONL report line, mirroring the txlog entry shape. */
export function appendConformanceReport(
    checks: readonly Dict[],
    projectRoot: string,
    logPath: string = conformanceLogPath(),
): void {
    const fails = checks.filter((c) => c['status'] === 'fail').map((c) => String(c['id']));
    const ok = checks.filter((c) => c['status'] === 'ok').length;
    const entry = {
        ts: new Date().toISOString(),
        kind: 'conformance',
        path: projectRoot,
        sha256: null,
        note: `${ok}/${checks.length} ok; fails: ${fails.length > 0 ? fails.join(',') : 'none'}`,
    };
    try {
        atomicAppendLine(logPath, JSON.stringify(entry));
    } catch {
        // Report emission must never break the exit contract.
    }
}

const USAGE =
    'usage: agent-config conformance [-h] [--project PROJECT] [--json]\n' +
    '                                [--skip-dispatcher]\n';

interface Options {
    project: string | null;
    json: boolean;
    skip_dispatcher: boolean;
}

function _parse(argv: string[]): Options {
    const opts: Options = { project: null, json: false, skip_dispatcher: false };
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(USAGE);
            throw new ArgparseExit(0);
        }
        if (a === '--json') {
            opts.json = true;
        } else if (a === '--skip-dispatcher') {
            opts.skip_dispatcher = true;
        } else if (a === '--project' || a.startsWith('--project=')) {
            if (a.includes('=')) {
                opts.project = a.slice(a.indexOf('=') + 1);
            } else {
                if (i + 1 >= argv.length) {
                    process.stderr.write(USAGE);
                    process.stderr.write('agent-config conformance: error: --project expects a value\n');
                    throw new ArgparseExit(2);
                }
                opts.project = argv[i + 1] as string;
                i += 1;
            }
        } else {
            process.stderr.write(USAGE);
            process.stderr.write(`agent-config conformance: error: unrecognized argument ${a}\n`);
            throw new ArgparseExit(2);
        }
        i += 1;
    }
    return opts;
}

function main(argv: string[] | null = null): number {
    const opts = _parse(argv !== null ? Array.from(argv) : process.argv.slice(2));

    let project_root: string;
    try {
        [project_root] = _resolve_project_root(opts.project);
    } catch (exc) {
        eprint(`❌  conformance: ${(exc as Error).message}`);
        return 2;
    }

    // Leg 1 — doctor's own drift + checks (the --ci contract, in-process).
    const manifest_pth = installed_tools.manifest_path(project_root);
    const manifest = installed_tools.read_manifest(manifest_pth);
    let doctorChecks: Dict[];
    let drift: Record<string, Dict[]> = { missing: [], modified: [], foreign: [], tag_drift: [] };
    if (manifest === null) {
        const bridge_present = fs.existsSync(path.join(project_root, BRIDGE_MARKER_RELATIVE));
        doctorChecks = _run_checks_no_manifest(project_root, bridge_present, null);
    } else {
        const [records, known] = _collect_manifest_entries(project_root, manifest);
        const [missing, modified, tag_drift] = _classify(records);
        const foreign = _foreign_records(
            project_root,
            _scan_foreign(project_root, manifest, known),
        );
        drift = { missing, modified, foreign, tag_drift };
        doctorChecks = _run_checks(project_root, manifest, drift, null);
    }

    // Leg 2 — the five conformance checks.
    const conformanceChecks = runConformanceChecks({
        projectRoot: project_root,
        skipDispatcher: opts.skip_dispatcher,
    });

    const allChecks = [...doctorChecks, ...conformanceChecks];
    const driftCount =
        drift['missing']!.length +
        drift['modified']!.length +
        drift['foreign']!.length +
        drift['tag_drift']!.length;
    const failed = allChecks.some((c) => c['status'] === 'fail') || driftCount > 0;

    appendConformanceReport(conformanceChecks, project_root);

    if (opts.json) {
        print(
            _jsonDumpsIndentAscii(
                {
                    project_root,
                    drift,
                    doctor_checks: doctorChecks,
                    conformance_checks: conformanceChecks,
                    status: failed ? 'fail' : 'ok',
                },
                2,
            ),
        );
    } else {
        print(`  📍  project_root: ${project_root}`);
        print('conformance:');
        for (const c of allChecks) {
            const sym = STATUS_SYMBOLS[c['status'] as string] ?? '?';
            print(`  ${sym} ${c['id']}: ${c['message']}`);
            if (c['status'] !== 'ok' && c['remedy']) {
                print(`      fix: ${c['remedy']}`);
            }
        }
        if (driftCount > 0) {
            print(`  ❌ drift: ${driftCount} drifted file(s) — run \`agent-config doctor\` for detail`);
        }
        print('');
        print(
            failed
                ? '❌  conformance: red — the OS is not fully installed/firing here'
                : '✅  conformance: green — installed and firing',
        );
    }
    return failed ? 1 : 0;
}

// --- CLI entry ---

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (e) {
        if (e instanceof ArgparseExit) {
            process.exitCode = e.code;
        } else {
            throw e;
        }
    }
}

export { main, _parse };
export type { Options as ConformanceOptions };

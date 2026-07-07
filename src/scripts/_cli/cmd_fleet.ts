/**
 * `agent-config init --fleet fleet.yaml` — multi-repo rollout
 * (road-to-flow-learnings Phase 1).
 *
 * Config-driven fleet install on the existing substrate:
 *
 *   - `fleet.yaml` lists repo paths (each optionally with a tool
 *     selection); one global `max_concurrency` (default 3) bounds the
 *     rollout — a concurrency bound only, no resource theater.
 *   - Per-repo isolation: every repo runs its own pre-flight →
 *     install → conformance pipeline in its own child process; one
 *     repo failing NEVER aborts the siblings.
 *   - Aggregate report: one JSON summary (per repo: status, findings,
 *     duration, conformance result) + a human table on stdout.
 *
 * ADR-020 / ADR-088 framing: this installs agent-config itself across
 * repos. The default per-repo command is the global-only consumer
 * bridge step (`agent-config refresh --project`); the fleet runner
 * never bridges to or drives another tool's runtime.
 *
 * Exit contract: 0 = every repo ok · 1 = at least one repo failed ·
 * 2 = config / environment error.
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as YAML from 'yaml';

import { runPreflight, hasBlockingFinding, type PreflightFinding } from '../../install/preflight.js';
import type { ConflictPolicy } from '../../install/types.js';

const _HERE = fileURLToPath(import.meta.url);
const PACKAGE_ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');

/** One fleet target, parsed from `fleet.yaml`. */
export interface FleetRepo {
    readonly path: string;
    /** Optional per-repo tool selection forwarded to the install command. */
    readonly tools?: string;
}

/** Parsed fleet config. */
export interface FleetSpec {
    readonly repos: readonly FleetRepo[];
    readonly maxConcurrency: number;
}

/** Terminal status of one repo's pipeline. */
export type FleetRepoStatus =
    | 'ok'
    | 'preflight-failed'
    | 'install-failed'
    | 'conformance-failed';

/** Per-repo result in the aggregate report. */
export interface FleetRepoResult {
    readonly path: string;
    readonly status: FleetRepoStatus;
    readonly findings: readonly PreflightFinding[];
    readonly durationMs: number;
    /** Conformance summary — exit code + the JSONL-style note, when it ran. */
    readonly conformance: { exit: number; note: string } | null;
}

/** The aggregate report — `schema_version` pins the JSON shape. */
export interface FleetReport {
    readonly schema_version: 1;
    readonly ts: string;
    readonly max_concurrency: number;
    readonly repos: readonly FleetRepoResult[];
    readonly status: 'ok' | 'fail';
}

export class FleetConfigError extends Error {}

/** Parse + validate `fleet.yaml`. Throws {@link FleetConfigError} on shape errors. */
export function parseFleetSpec(text: string, baseDir: string): FleetSpec {
    let raw: unknown;
    try {
        raw = YAML.parse(text);
    } catch (exc) {
        throw new FleetConfigError(`fleet config does not parse: ${(exc as Error).message}`);
    }
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new FleetConfigError('fleet config must be a mapping with a `repos:` list');
    }
    const obj = raw as Record<string, unknown>;
    const reposRaw = obj['repos'];
    if (!Array.isArray(reposRaw) || reposRaw.length === 0) {
        throw new FleetConfigError('`repos:` must be a non-empty list');
    }
    const repos: FleetRepo[] = [];
    for (const [i, entry] of reposRaw.entries()) {
        if (typeof entry === 'string') {
            repos.push({ path: path.resolve(baseDir, entry) });
            continue;
        }
        if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
            const e = entry as Record<string, unknown>;
            const p = e['path'];
            if (typeof p !== 'string' || p.length === 0) {
                throw new FleetConfigError(`repos[${i}] is missing a non-empty \`path\``);
            }
            const tools = e['tools'];
            if (tools !== undefined && typeof tools !== 'string') {
                throw new FleetConfigError(`repos[${i}].tools must be a comma-separated string`);
            }
            repos.push({
                path: path.resolve(baseDir, p),
                ...(typeof tools === 'string' ? { tools } : {}),
            });
            continue;
        }
        throw new FleetConfigError(`repos[${i}] must be a path string or a {path, tools} mapping`);
    }
    const mcRaw = obj['max_concurrency'];
    let maxConcurrency = 3;
    if (mcRaw !== undefined) {
        if (typeof mcRaw !== 'number' || !Number.isInteger(mcRaw) || mcRaw < 1) {
            throw new FleetConfigError('`max_concurrency` must be a positive integer');
        }
        maxConcurrency = mcRaw;
    }
    return { repos, maxConcurrency };
}

/** Validate a parsed aggregate report against the schema (used by tests + CI). */
export function validateFleetReport(obj: unknown): string[] {
    const problems: string[] = [];
    if (obj === null || typeof obj !== 'object') return ['report is not an object'];
    const r = obj as Record<string, unknown>;
    if (r['schema_version'] !== 1) problems.push('schema_version must be 1');
    if (typeof r['ts'] !== 'string' || Number.isNaN(Date.parse(String(r['ts'])))) {
        problems.push('ts must be an ISO timestamp');
    }
    if (typeof r['max_concurrency'] !== 'number') problems.push('max_concurrency must be a number');
    if (r['status'] !== 'ok' && r['status'] !== 'fail') problems.push("status must be 'ok'|'fail'");
    if (!Array.isArray(r['repos'])) {
        problems.push('repos must be an array');
        return problems;
    }
    const statuses = new Set(['ok', 'preflight-failed', 'install-failed', 'conformance-failed']);
    for (const [i, item] of (r['repos'] as unknown[]).entries()) {
        const e = item as Record<string, unknown>;
        if (typeof e['path'] !== 'string') problems.push(`repos[${i}].path must be a string`);
        if (!statuses.has(String(e['status']))) problems.push(`repos[${i}].status invalid`);
        if (!Array.isArray(e['findings'])) problems.push(`repos[${i}].findings must be an array`);
        if (typeof e['durationMs'] !== 'number') problems.push(`repos[${i}].durationMs must be a number`);
        if (e['conformance'] !== null) {
            const c = e['conformance'] as Record<string, unknown> | null;
            if (c === null || typeof c !== 'object' || typeof c['exit'] !== 'number') {
                problems.push(`repos[${i}].conformance must be null or {exit, note}`);
            }
        }
    }
    return problems;
}

/** Command factory — injectable so tests never spawn the real installer. */
export interface FleetCommands {
    /** argv for the per-repo install step (cwd = repo path). */
    installArgv(repo: FleetRepo): string[];
    /** argv for the per-repo conformance step (cwd = repo path). */
    conformanceArgv(repo: FleetRepo): string[];
}

/** Default commands — the ADR-020 global-only consumer pipeline. */
export function defaultFleetCommands(packageRoot: string = PACKAGE_ROOT): FleetCommands {
    const entry = path.join(packageRoot, 'src', 'scripts', 'agent-config');
    return {
        installArgv: () => ['bash', entry, 'refresh', '--project'],
        conformanceArgv: () => ['bash', entry, 'conformance'],
    };
}

function spawnInRepo(
    argv: readonly string[],
    cwd: string,
    timeoutMs: number,
): Promise<{ exit: number; stdout: string; stderr: string }> {
    return new Promise((resolvePromise) => {
        const child = spawn(argv[0] as string, argv.slice(1), {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: timeoutMs,
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d: Buffer) => {
            stdout += d.toString('utf8');
        });
        child.stderr.on('data', (d: Buffer) => {
            stderr += d.toString('utf8');
        });
        child.on('error', (err) => {
            resolvePromise({ exit: 127, stdout, stderr: `${stderr}${err.message}` });
        });
        child.on('close', (code) => {
            resolvePromise({ exit: code ?? 1, stdout, stderr });
        });
    });
}

const PREFLIGHT_POLICY: ConflictPolicy = {
    force: false,
    interactive: false,
    knownPaths: new Set<string>(),
    knownPointers: new Set<string>(),
    defaultStrategy: 'skip',
};

async function runOneRepo(
    repo: FleetRepo,
    commands: FleetCommands,
    timeoutMs: number,
): Promise<FleetRepoResult> {
    const started = Date.now();
    // Stage 1 — pre-flight (typed findings; blocking finding stops THIS repo only).
    let findings: PreflightFinding[];
    if (!fs.existsSync(repo.path) || !fs.statSync(repo.path).isDirectory()) {
        findings = [
            {
                id: 'permissions',
                severity: 'blocking',
                path: repo.path,
                message: 'repo path does not exist or is not a directory',
                remedy: 'fix the path in fleet.yaml (or clone the repo first)',
            },
        ];
    } else {
        findings = runPreflight({
            target: 'project',
            root: repo.path,
            sources: [],
            policy: PREFLIGHT_POLICY,
        });
    }
    if (hasBlockingFinding(findings)) {
        return {
            path: repo.path,
            status: 'preflight-failed',
            findings,
            durationMs: Date.now() - started,
            conformance: null,
        };
    }
    // Stage 2 — install (own child process; failure isolated to this repo).
    const install = await spawnInRepo(commands.installArgv(repo), repo.path, timeoutMs);
    if (install.exit !== 0) {
        return {
            path: repo.path,
            status: 'install-failed',
            findings,
            durationMs: Date.now() - started,
            conformance: null,
        };
    }
    // Stage 3 — conformance (Phase-0 contract; its note feeds the aggregate).
    const conf = await spawnInRepo(commands.conformanceArgv(repo), repo.path, timeoutMs);
    const lastLine = conf.stdout.trim().split('\n').filter(Boolean).slice(-1)[0] ?? '';
    return {
        path: repo.path,
        status: conf.exit === 0 ? 'ok' : 'conformance-failed',
        findings,
        durationMs: Date.now() - started,
        conformance: { exit: conf.exit, note: lastLine.slice(0, 200) },
    };
}

/** Bounded-concurrency pool — the only "resource management" a rollout needs. */
async function pool<T, R>(
    items: readonly T[],
    limit: number,
    fn: (item: T) => Promise<R>,
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    async function worker(): Promise<void> {
        while (next < items.length) {
            const i = next;
            next += 1;
            results[i] = await fn(items[i] as T);
        }
    }
    const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
}

export interface RunFleetOptions {
    readonly commands?: FleetCommands;
    readonly timeoutMs?: number;
}

/** Run the whole fleet. Never throws for per-repo problems. */
export async function runFleet(spec: FleetSpec, opts: RunFleetOptions = {}): Promise<FleetReport> {
    const commands = opts.commands ?? defaultFleetCommands();
    const timeoutMs = opts.timeoutMs ?? 10 * 60 * 1000;
    const results = await pool(spec.repos, spec.maxConcurrency, (repo) =>
        runOneRepo(repo, commands, timeoutMs),
    );
    return {
        schema_version: 1,
        ts: new Date().toISOString(),
        max_concurrency: spec.maxConcurrency,
        repos: results,
        status: results.every((r) => r.status === 'ok') ? 'ok' : 'fail',
    };
}

function humanTable(report: FleetReport): string {
    const lines: string[] = [];
    lines.push(`fleet: ${report.repos.length} repo(s) · max_concurrency ${report.max_concurrency}`);
    for (const r of report.repos) {
        const sym = r.status === 'ok' ? '✅' : '❌';
        const dur = `${Math.round(r.durationMs / 100) / 10}s`;
        lines.push(`  ${sym} ${r.path} — ${r.status} (${dur})`);
        for (const f of r.findings.filter((x) => x.severity === 'blocking')) {
            lines.push(`      ${f.id}: ${f.message}`);
        }
        if (r.conformance && r.status === 'conformance-failed') {
            lines.push(`      conformance exit ${r.conformance.exit}: ${r.conformance.note}`);
        }
    }
    lines.push(report.status === 'ok' ? '✅  fleet: all green' : '❌  fleet: at least one repo failed');
    return lines.join('\n');
}

const USAGE = 'usage: cmd_fleet [-h] --config fleet.yaml [--json]\n';

export async function main(argv: string[] | null = null): Promise<number> {
    const args = argv !== null ? Array.from(argv) : process.argv.slice(2);
    let configPath: string | null = null;
    let json = false;
    let i = 0;
    while (i < args.length) {
        const a = args[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(USAGE);
            return 0;
        }
        if (a === '--json') {
            json = true;
        } else if (a === '--config' || a.startsWith('--config=')) {
            if (a.includes('=')) {
                configPath = a.slice(a.indexOf('=') + 1);
            } else {
                configPath = String(args[i + 1] ?? '');
                i += 1;
            }
        } else {
            process.stderr.write(USAGE);
            process.stderr.write(`cmd_fleet: error: unrecognized argument ${a}\n`);
            return 2;
        }
        i += 1;
    }
    if (!configPath || !fs.existsSync(configPath)) {
        process.stderr.write(USAGE);
        process.stderr.write(`cmd_fleet: error: --config path missing or not found\n`);
        return 2;
    }
    let spec: FleetSpec;
    try {
        spec = parseFleetSpec(fs.readFileSync(configPath, 'utf8'), path.dirname(path.resolve(configPath)));
    } catch (exc) {
        if (exc instanceof FleetConfigError) {
            process.stderr.write(`cmd_fleet: error: ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }
    const report = await runFleet(spec);
    if (json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
        process.stdout.write(`${humanTable(report)}\n`);
    }
    return report.status === 'ok' ? 0 : 1;
}

// --- CLI entry ---

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    main(process.argv.slice(2)).then(
        (code) => {
            process.exitCode = code;
        },
        (err) => {
            process.stderr.write(`cmd_fleet: fatal: ${(err as Error).message}\n`);
            process.exitCode = 2;
        },
    );
}

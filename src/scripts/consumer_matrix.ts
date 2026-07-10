#!/usr/bin/env tsx
/**
 * Consumer-proof release matrix — road-to-proof-under-real-conditions Phase 1.
 *
 * Exercises the PUBLISHED TARBALL the way a consumer does: pack → fresh
 * global install (isolated prefix) → `init` into a fresh project → doctor →
 * conformance → MCP stdio handshake → hook health → projection presence →
 * uninstall. Optional upgrade leg: install the last published minor from the
 * registry, then upgrade to the packed tarball and assert doctor stays green.
 *
 * Why this exists: the release-PR gate skips source-level matrices (soundly —
 * a version-bump diff cannot regress source behaviour), but nothing between
 * merge and tag exercised the tarball shape. Two published minors shipped
 * without `src/install/` while published code imported from it; `tsx` was
 * missing from the published package; each manifested only at publish time.
 * Every leg here asserts exit code + an expected artifact, no LLM calls.
 *
 * Usage:
 *   npx tsx src/scripts/consumer_matrix.ts [--tarball <path>] [--only leg1,leg2]
 *       [--skip-registry] [--keep-tmp] [--json]
 *
 * Without --tarball the script runs `npm pack` itself (requires a built
 * tree — `npm ci && npm run build` first; CI does this, local carve-out
 * runs do it once).
 *
 * Exit codes: 0 all requested legs green · 1 leg failure · 2 usage/env.
 */

import { spawnSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const PKG_NAME = '@event4u/agent-config';

interface Ctx {
    tmpRoot: string;
    prefix: string; // isolated npm global prefix
    projectDir: string; // fresh consumer project
    tarball: string;
    bin: string; // installed agent-config binary
    keepTmp: boolean;
    skipRegistry: boolean;
    results: LegResult[];
}

interface LegResult {
    leg: string;
    ok: boolean;
    detail: string;
    durationMs: number;
}

function log(msg: string): void {
    process.stderr.write(`${msg}\n`);
}

function run(
    cmd: string,
    args: string[],
    opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): { status: number; stdout: string; stderr: string } {
    const r = spawnSync(cmd, args, {
        cwd: opts.cwd ?? REPO_ROOT,
        env: { ...process.env, ...opts.env },
        encoding: 'utf8',
        timeout: opts.timeoutMs ?? 600_000,
        maxBuffer: 32 * 1024 * 1024,
    });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function fail(msg: string): never {
    log(`❌  consumer-matrix: ${msg}`);
    process.exit(1);
}

/**
 * Env for running the installed binary against the isolated prefix.
 * HOME is redirected into the tmp root so the simulation is a FRESH
 * MACHINE even on a maintainer host: without this, an existing global
 * install (~/.event4u, ~/.claude, …) trips the cross-scope drift guard
 * inside `init` and the leg fails on developer machines while passing
 * on clean CI runners — the opposite of what a consumer gate is for.
 */
function binEnv(ctx: Ctx): NodeJS.ProcessEnv {
    const home = path.join(ctx.tmpRoot, 'home');
    fs.mkdirSync(home, { recursive: true });
    return {
        PATH: `${path.join(ctx.prefix, 'bin')}${path.delimiter}${process.env.PATH ?? ''}`,
        npm_config_prefix: ctx.prefix,
        npm_config_cache: path.join(ctx.tmpRoot, 'npm-cache'),
        HOME: home,
        // Never let a maintainer checkout leak into the consumer simulation.
        AGENT_CONFIG_DEV_MODE: '',
    };
}

// ── legs ────────────────────────────────────────────────────────────

function legPack(ctx: Ctx): string {
    if (ctx.tarball) {
        if (!fs.existsSync(ctx.tarball)) fail(`--tarball not found: ${ctx.tarball}`);
        return `reused ${path.basename(ctx.tarball)}`;
    }
    const r = run('npm', ['pack', '--ignore-scripts', '--silent', '--pack-destination', ctx.tmpRoot]);
    if (r.status !== 0) throw new Error(`npm pack failed: ${r.stderr.slice(-400)}`);
    const name = r.stdout.trim().split('\n').pop() ?? '';
    ctx.tarball = path.join(ctx.tmpRoot, name);
    if (!fs.existsSync(ctx.tarball)) throw new Error(`packed tarball missing: ${ctx.tarball}`);
    return path.basename(ctx.tarball);
}

function legFreshInstall(ctx: Ctx): string {
    const r = run('npm', ['install', '-g', '--prefix', ctx.prefix, ctx.tarball], { timeoutMs: 900_000 });
    if (r.status !== 0) throw new Error(`global install failed: ${r.stderr.slice(-600)}`);
    ctx.bin = path.join(ctx.prefix, 'bin', 'agent-config');
    if (!fs.existsSync(ctx.bin)) throw new Error(`installed binary missing at ${ctx.bin}`);
    const v = run(ctx.bin, ['--version'], { env: binEnv(ctx) });
    if (v.status !== 0) throw new Error(`--version failed (missing runtime dep in tarball?): ${v.stderr.slice(-400)}`);
    return `bin ok, version ${v.stdout.trim()}`;
}

function legInit(ctx: Ctx): string {
    fs.mkdirSync(ctx.projectDir, { recursive: true });
    run('git', ['init', '-q', '.'], { cwd: ctx.projectDir });
    // --scope=auto is the working headless consumer invocation. The bare
    // default ('project default for backward compatibility') hard-fails on
    // a fresh machine with '--scope=project is reserved for maintainers'
    // (ADR-020) — a real trap this matrix documents; see
    // docs/distribution/consumer-matrix.md § Headless default-scope trap.
    const r = run(ctx.bin, ['init', '--tools=claude-code,cursor,windsurf', '--scope=auto', '--yes'], {
        cwd: ctx.projectDir,
        env: binEnv(ctx),
        timeoutMs: 600_000,
    });
    if (r.status !== 0) throw new Error(`init failed: ${(r.stderr + r.stdout).slice(-600)}`);
    // ADR-020: consumer installs are GLOBAL-only — assert the global trees.
    const home = path.join(ctx.tmpRoot, 'home');
    for (const p of ['.claude', '.cursor', '.codeium/windsurf', '.event4u']) {
        if (!fs.existsSync(path.join(home, p))) throw new Error(`init did not write ~/${p}`);
    }
    return 'init --scope=auto wrote global ~/.claude, ~/.cursor, ~/.codeium/windsurf, ~/.event4u';
}

function legConformance(ctx: Ctx): string {
    const r = run(ctx.bin, ['conformance'], { cwd: ctx.projectDir, env: binEnv(ctx) });
    if (r.status !== 0) throw new Error(`conformance exit ${r.status}: ${(r.stdout + r.stderr).slice(-600)}`);
    return 'conformance green (embeds doctor --ci + installed-and-firing checks)';
}

async function legMcpHandshake(ctx: Ctx): Promise<string> {
    // Newline-delimited JSON-RPC per src/cli/mcp/stdio.ts.
    return await new Promise<string>((resolve, reject) => {
        const child = spawn(ctx.bin, ['mcp-server'], {
            cwd: ctx.projectDir,
            env: { ...process.env, ...binEnv(ctx) },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let out = '';
        const timer = setTimeout(() => {
            child.kill();
            reject(new Error(`no initialize response within 20s; stdout so far: ${out.slice(0, 300)}`));
        }, 20_000);
        child.stdout.on('data', (d: Buffer) => {
            out += d.toString();
            const line = out.split('\n').find((l) => l.trim().startsWith('{'));
            if (line) {
                try {
                    const msg = JSON.parse(line) as { id?: number; result?: unknown; error?: unknown };
                    clearTimeout(timer);
                    child.kill();
                    if (msg.id === 1 && msg.result && !msg.error) {
                        resolve('initialize handshake ok');
                    } else {
                        reject(new Error(`unexpected first message: ${line.slice(0, 300)}`));
                    }
                } catch {
                    /* partial line — keep buffering */
                }
            }
        });
        child.on('error', (e) => {
            clearTimeout(timer);
            reject(e);
        });
        child.on('exit', (code) => {
            if (out === '') {
                clearTimeout(timer);
                reject(new Error(`mcp-server exited (${code}) before responding`));
            }
        });
        child.stdin.write(
            `${JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2025-03-26',
                    capabilities: {},
                    clientInfo: { name: 'consumer-matrix', version: '0' },
                },
            })}\n`,
        );
    });
}

function legHooks(ctx: Ctx): string {
    const r = run(ctx.bin, ['hooks:doctor'], { cwd: ctx.projectDir, env: binEnv(ctx) });
    if (r.status !== 0) throw new Error(`hooks:doctor exit ${r.status}: ${(r.stdout + r.stderr).slice(-600)}`);
    return 'hooks:doctor green';
}

function legProjections(ctx: Ctx): string {
    const home = path.join(ctx.tmpRoot, 'home');
    const missing = ['.cursor/rules', '.codeium/windsurf', '.claude/skills']
        .filter((p) => !fs.existsSync(path.join(home, p)))
        .join(', ');
    if (missing) throw new Error(`global projection trees missing: ${missing}`);
    return 'cursor + windsurf + claude projection trees present in global scope';
}

function legUninstall(ctx: Ctx): string {
    const r = run(ctx.bin, ['uninstall', '--global', '--tools=claude-code,cursor,windsurf', '--force'], {
        cwd: ctx.projectDir,
        env: binEnv(ctx),
    });
    if (r.status !== 0) throw new Error(`uninstall exit ${r.status}: ${(r.stdout + r.stderr).slice(-600)}`);
    const lock = path.join(ctx.tmpRoot, 'home', '.event4u', 'agent-config', 'installed.lock');
    if (fs.existsSync(lock)) throw new Error(`global lockfile still present after uninstall: ${lock}`);
    return 'uninstall --global green, lockfile removed';
}

function legUpgrade(ctx: Ctx): string {
    if (ctx.skipRegistry) return 'skipped (--skip-registry)';
    // Last published version from the registry (network).
    const view = run('npm', ['view', PKG_NAME, 'version'], { timeoutMs: 120_000 });
    if (view.status !== 0) throw new Error(`npm view failed: ${view.stderr.slice(-300)}`);
    const published = view.stdout.trim();
    const upPrefix = path.join(ctx.tmpRoot, 'prefix-upgrade');
    const upProject = path.join(ctx.tmpRoot, 'project-upgrade');
    fs.mkdirSync(upProject, { recursive: true });
    const upHome = path.join(ctx.tmpRoot, 'home-upgrade');
    fs.mkdirSync(upHome, { recursive: true });
    const env = {
        PATH: `${path.join(upPrefix, 'bin')}${path.delimiter}${process.env.PATH ?? ''}`,
        npm_config_prefix: upPrefix,
        npm_config_cache: path.join(ctx.tmpRoot, 'npm-cache'),
        HOME: upHome,
        AGENT_CONFIG_DEV_MODE: '',
    };
    let r = run('npm', ['install', '-g', '--prefix', upPrefix, `${PKG_NAME}@${published}`], { timeoutMs: 900_000 });
    if (r.status !== 0) throw new Error(`registry install of ${published} failed: ${r.stderr.slice(-400)}`);
    const bin = path.join(upPrefix, 'bin', 'agent-config');
    r = run(bin, ['init', '--tools=claude-code', '--scope=auto', '--yes'], { cwd: upProject, env, timeoutMs: 600_000 });
    if (r.status !== 0) throw new Error(`init on ${published} failed: ${(r.stderr + r.stdout).slice(-400)}`);
    // Upgrade: overwrite the global install with the packed tarball.
    r = run('npm', ['install', '-g', '--prefix', upPrefix, ctx.tarball], { timeoutMs: 900_000 });
    if (r.status !== 0) throw new Error(`tarball upgrade failed: ${r.stderr.slice(-400)}`);
    r = run(bin, ['conformance'], { cwd: upProject, env });
    if (r.status !== 0) {
        throw new Error(`conformance red after ${published} → tarball upgrade: ${(r.stdout + r.stderr).slice(-600)}`);
    }
    return `upgrade ${published} → packed tarball, conformance green`;
}

// ── main ────────────────────────────────────────────────────────────

const LEGS: Array<{ name: string; fn: (ctx: Ctx) => string | Promise<string> }> = [
    { name: 'pack', fn: legPack },
    { name: 'fresh-install', fn: legFreshInstall },
    { name: 'init', fn: legInit },
    { name: 'conformance', fn: legConformance },
    { name: 'mcp-handshake', fn: legMcpHandshake },
    { name: 'hooks', fn: legHooks },
    { name: 'projections', fn: legProjections },
    { name: 'uninstall', fn: legUninstall },
    { name: 'upgrade', fn: legUpgrade },
];

async function main(): Promise<number> {
    const argv = process.argv.slice(2);
    const getOpt = (flag: string): string | undefined => {
        const i = argv.indexOf(flag);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const only = getOpt('--only')?.split(',').map((s) => s.trim());
    const unknownLeg = only?.find((l) => !LEGS.some((x) => x.name === l));
    if (unknownLeg) {
        log(`❌  unknown leg '${unknownLeg}'. Legs: ${LEGS.map((l) => l.name).join(', ')}`);
        return 2;
    }

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'consumer-matrix-'));
    const ctx: Ctx = {
        tmpRoot,
        prefix: path.join(tmpRoot, 'prefix'),
        projectDir: path.join(tmpRoot, 'project'),
        tarball: getOpt('--tarball') ?? '',
        bin: '',
        keepTmp: argv.includes('--keep-tmp'),
        skipRegistry: argv.includes('--skip-registry'),
        results: [],
    };
    fs.mkdirSync(ctx.prefix, { recursive: true });
    log(`consumer-matrix · tmp ${tmpRoot} · node ${process.version}`);

    let failed = false;
    for (const leg of LEGS) {
        if (only && !only.includes(leg.name)) continue;
        // Legs after a hard dependency failure cannot run meaningfully.
        if (failed) {
            ctx.results.push({ leg: leg.name, ok: false, detail: 'skipped (earlier leg failed)', durationMs: 0 });
            continue;
        }
        const t0 = Date.now();
        try {
            const detail = await leg.fn(ctx);
            ctx.results.push({ leg: leg.name, ok: true, detail, durationMs: Date.now() - t0 });
            log(`  ✅  ${leg.name} — ${detail}`);
        } catch (err) {
            ctx.results.push({
                leg: leg.name,
                ok: false,
                detail: (err as Error).message,
                durationMs: Date.now() - t0,
            });
            log(`  ❌  ${leg.name} — ${(err as Error).message}`);
            failed = true;
        }
    }

    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify({ ok: !failed, results: ctx.results }, null, 2)}\n`);
    }
    if (!ctx.keepTmp) {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    } else {
        log(`kept tmp: ${tmpRoot}`);
    }
    return failed ? 1 : 0;
}

main().then(
    (code) => process.exit(code),
    (err) => {
        log(`❌  consumer-matrix crashed: ${(err as Error).stack ?? err}`);
        process.exit(2);
    },
);

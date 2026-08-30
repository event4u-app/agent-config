#!/usr/bin/env tsx
/**
 * Consumer-proof release matrix — road-to-proof-under-real-conditions Phase 1.
 *
 * Exercises the PUBLISHED TARBALL the way a consumer does: pack → fresh
 * global install (isolated prefix) → `init` into a fresh project → doctor →
 * conformance → MCP stdio handshake → hook health → hook lifecycle →
 * projection presence → uninstall. Optional upgrade leg: install the last
 * published minor from the registry, then upgrade to the packed tarball and
 * assert doctor stays green.
 *
 * Why this exists: the release-PR gate skips source-level matrices (soundly —
 * a version-bump diff cannot regress source behaviour), but nothing between
 * merge and tag exercised the tarball shape. Two published minors shipped
 * without `src/install/` while published code imported from it; `tsx` was
 * missing from the published package; each manifested only at publish time.
 * A third bug (missing `dist/install/rule_scope.js`) shipped past every leg
 * because none of them fired a REAL installed hook command — `conformance`'s
 * dispatcher smoke calls `dispatch_hook.ts` directly via `tsx`, bypassing the
 * `agent-config` binary (and its ESM import graph) entirely. The `hooks`
 * (static doctor) and `hook-lifecycle` (this file's live leg, below) legs
 * close that gap: the latter runs the EXACT shell command Claude installed in
 * `~/.claude/settings.json`, so a crash anywhere in the binary's load path —
 * including a missing compiled sibling module — fails the leg with the
 * culprit's stderr, not silently at publish time.
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
import { fileURLToPath, pathToFileURL } from 'node:url';

import { MANAGED_SIGNATURE } from './_lib/claude_settings_hooks.js';

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
    /** fn ran to completion (a declared skip or an after-failure skip is NOT executed). */
    executed: boolean;
}

function log(msg: string): void {
    process.stderr.write(`${msg}\n`);
}

function run(
    cmd: string,
    args: string[],
    opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number; input?: string } = {},
): { status: number; stdout: string; stderr: string } {
    const r = spawnSync(cmd, args, {
        cwd: opts.cwd ?? REPO_ROOT,
        env: { ...process.env, ...opts.env },
        encoding: 'utf8',
        timeout: opts.timeoutMs ?? 600_000,
        maxBuffer: 32 * 1024 * 1024,
        input: opts.input,
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

// ── hook-lifecycle leg ─────────────────────────────────────────────
//
// `hooks:doctor` (above) is a read-only static report — it never runs
// anything. `conformance`'s dispatcher smoke calls `dispatch_hook.ts`
// directly via `tsx`, bypassing the installed `agent-config` binary (and
// its ESM import graph) entirely. Neither exercises what a real Claude
// Code SessionStart/PreToolUse/PostToolUse/Stop event actually invokes:
// the exact shell command the installer registered in
// `~/.claude/settings.json`. This leg does — plus a deterministic
// completeness check on the compiled entrypoint's module graph, so a
// missing sibling `.js` (the historical `dist/install/rule_scope.js` bug)
// fails with the exact culprit instead of a live crash.

interface HookCommandEntry {
    /** Native platform event name, e.g. `SessionStart`, `PreToolUse`. */
    nativeEvent: string;
    /** The exact managed shell command string installed for this event. */
    command: string;
}

/**
 * Read every agent-config-managed hook command out of an installed Claude
 * settings file, keyed by native event. Mirrors the shape
 * `ensure_managed_hooks` (src/scripts/_lib/claude_settings_hooks.ts) writes;
 * a group is "managed" iff one of its commands contains `MANAGED_SIGNATURE`
 * — the same identity check the installer itself uses, so this can never
 * drift from what actually got registered.
 */
export function readInstalledClaudeHookCommands(settingsPath: string): HookCommandEntry[] {
    if (!fs.existsSync(settingsPath)) return [];
    const raw = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as {
        hooks?: Record<string, Array<{ hooks?: Array<{ command?: unknown }> }>>;
    };
    const hooks = raw.hooks ?? {};
    const out: HookCommandEntry[] = [];
    for (const [nativeEvent, groups] of Object.entries(hooks)) {
        if (!Array.isArray(groups)) continue;
        for (const group of groups) {
            for (const h of group.hooks ?? []) {
                if (typeof h.command === 'string' && h.command.includes(MANAGED_SIGNATURE)) {
                    out.push({ nativeEvent, command: h.command });
                }
            }
        }
    }
    return out;
}

/** A representative Claude Code event envelope, shaped per native event. */
export function buildHookEnvelope(nativeEvent: string, projectDir: string): string {
    const base = {
        session_id: 'consumer-matrix-fixture',
        transcript_path: '',
        cwd: projectDir,
        hook_event_name: nativeEvent,
    };
    switch (nativeEvent) {
        case 'PreToolUse':
            return JSON.stringify({
                ...base,
                tool_name: 'Read',
                tool_input: { file_path: path.join(projectDir, 'README.md') },
            });
        case 'PostToolUse':
            return JSON.stringify({
                ...base,
                tool_name: 'Read',
                tool_input: { file_path: path.join(projectDir, 'README.md') },
                tool_response: { success: true },
            });
        case 'Stop':
            return JSON.stringify({ ...base, stop_hook_active: false });
        case 'UserPromptSubmit':
            return JSON.stringify({ ...base, prompt: 'consumer-matrix smoke prompt' });
        case 'SessionEnd':
            return JSON.stringify({ ...base, reason: 'exit' });
        case 'SessionStart':
        default:
            return JSON.stringify({ ...base, source: 'startup' });
    }
}

/**
 * Run one installed hook command exactly as the platform would — a shell
 * invocation with the event envelope piped to stdin — and report whether it
 * exited clean.
 */
export function invokeHookCommand(
    entry: HookCommandEntry,
    opts: { cwd: string; env: NodeJS.ProcessEnv; projectDir: string; timeoutMs?: number },
): { ok: boolean; status: number; stderrTail: string } {
    const payload = buildHookEnvelope(entry.nativeEvent, opts.projectDir);
    const r = run('bash', ['-c', entry.command], {
        cwd: opts.cwd,
        env: opts.env,
        timeoutMs: opts.timeoutMs ?? 30_000,
        input: payload,
    });
    const stderrTail = r.stderr.trim().split('\n').slice(-5).join(' | ');
    return { ok: r.status === 0, status: r.status, stderrTail };
}

interface MissingModule {
    from: string;
    spec: string;
    resolved: string;
}

/**
 * Extract relative (`./`, `../`) ESM specifiers from a compiled `.js` file —
 * static `from "..."`, bare `import "...";`, and dynamic `import("...")`.
 * Regex, not a full parser: good enough for tsc's fixed output shape, and
 * deliberately ignores bare package specifiers (`from 'commander'`) so the
 * walk never leaves the package's own `dist/` tree.
 */
/**
 * Strip comments before scanning for import specifiers.
 *
 * A doc comment can contain a perfectly well-formed `export { X } from './X'`
 * as an EXAMPLE, and the scanner had no way to tell one from a real import —
 * `src/cli/commands/uiAudit.ts` carries exactly that line, and the built output
 * keeps it, so the gate reported `commands/uiAudit.js → missing ./X` for a
 * module nobody imports. That is a false red on a completeness gate, which is
 * the worst kind: it says the shipped tarball is broken when it is not.
 *
 * ## Why the string state resets at every newline
 *
 * The first version carried quote state across the whole file, and it did not
 * survive contact with that very comment: prose says `module's body`, and an
 * apostrophe inside a comment is only inert while the lexer KNOWS it is inside
 * one. One desync — a regex literal, an unpaired apostrophe reached in the
 * wrong mode — and every subsequent `/*` reads as string content, so the doc
 * comment is scanned as code and the false red survives the fix. Measured: the
 * fix shipped, CI stayed red on the identical message.
 *
 * So block-comment state is tracked ACROSS lines (a block comment is the thing
 * being removed) while quote state is tracked WITHIN one line and discarded at
 * the newline. A desync then costs the remainder of one line instead of the
 * remainder of the file. A multi-line template literal containing a relative
 * specifier would be read as code — a false red, the same direction the gate
 * already errs, and no such literal exists in the compiled output this walks.
 */
export function stripComments(source: string): string {
    const out: string[] = [];
    let inBlock = false;
    for (const rawLine of source.split('\n')) {
        let line = '';
        let i = 0;
        let quote: string | null = null;
        while (i < rawLine.length) {
            const c = rawLine[i] as string;
            const next = rawLine[i + 1];
            if (inBlock) {
                if (c === '*' && next === '/') {
                    inBlock = false;
                    i += 2;
                    continue;
                }
                i += 1;
                continue;
            }
            if (quote !== null) {
                line += c;
                if (c === '\\' && next !== undefined) {
                    line += next;
                    i += 2;
                    continue;
                }
                if (c === quote) quote = null;
                i += 1;
                continue;
            }
            if (c === '/' && next === '/') break;
            if (c === '/' && next === '*') {
                inBlock = true;
                i += 2;
                continue;
            }
            if (c === "'" || c === '"' || c === '`') quote = c;
            line += c;
            i += 1;
        }
        out.push(line);
    }
    return out.join('\n');
}

export function parseRelativeSpecifiers(rawSource: string): string[] {
    const source = stripComments(rawSource);
    const out = new Set<string>();
    const patterns = [
        /\bfrom\s*["']([^"']+)["']/g,
        /^\s*import\s*["']([^"']+)["']\s*;/gm,
        /\bimport\(\s*["']([^"']+)["']\s*\)/g,
    ];
    for (const re of patterns) {
        let m: RegExpExecArray | null;
        while ((m = re.exec(source)) !== null) {
            const spec = m[1];
            if (spec && (spec.startsWith('./') || spec.startsWith('../'))) out.add(spec);
        }
    }
    return [...out];
}

/**
 * Walk the compiled ESM module graph reachable from `entryFile`, following
 * every relative import/export/dynamic-import specifier, and report any
 * resolved target that does not exist on disk — the deterministic twin of
 * "does this crash at require time", without spawning a process.
 */
export function walkEsmModuleGraph(entryFile: string): { visited: string[]; missing: MissingModule[] } {
    const visited = new Set<string>();
    const missing: MissingModule[] = [];
    const stack: string[] = [entryFile];
    while (stack.length > 0) {
        const file = stack.pop() as string;
        if (visited.has(file)) continue;
        visited.add(file);
        let source: string;
        try {
            source = fs.readFileSync(file, 'utf8');
        } catch {
            missing.push({ from: '(entry)', spec: file, resolved: file });
            continue;
        }
        for (const spec of parseRelativeSpecifiers(source)) {
            const resolved = path.resolve(path.dirname(file), spec);
            if (!fs.existsSync(resolved)) {
                missing.push({ from: file, spec, resolved });
                continue;
            }
            if (!visited.has(resolved)) stack.push(resolved);
        }
    }
    return { visited: [...visited], missing };
}

/** Dist-manifest completeness gate — every module the entrypoint can reach exists. */
export function checkDistManifestCompleteness(entryFile: string): { ok: boolean; message: string } {
    const { visited, missing } = walkEsmModuleGraph(entryFile);
    if (missing.length > 0) {
        const detail = missing
            .slice(0, 5)
            .map((m) => `${path.relative(path.dirname(entryFile), m.from)} → missing ${m.spec}`)
            .join('; ');
        return { ok: false, message: `dist-manifest incomplete: ${missing.length} missing module(s): ${detail}` };
    }
    return {
        ok: true,
        message: `dist-manifest complete — ${visited.length} module(s) reachable from ${path.basename(entryFile)}`,
    };
}

function legHookLifecycle(ctx: Ctx): string {
    const settingsPath = path.join(ctx.tmpRoot, 'home', '.claude', 'settings.json');
    const entries = readInstalledClaudeHookCommands(settingsPath);
    if (entries.length === 0) {
        throw new Error(`no managed Claude hook commands found in ${settingsPath} (did init register hooks?)`);
    }

    const entryScript = fs.realpathSync(ctx.bin);
    const manifestCheck = checkDistManifestCompleteness(entryScript);
    if (!manifestCheck.ok) throw new Error(manifestCheck.message);

    const env = { ...binEnv(ctx), CLAUDE_PROJECT_DIR: ctx.projectDir };
    const fired: string[] = [];
    for (const entry of entries) {
        const result = invokeHookCommand(entry, { cwd: ctx.projectDir, env, projectDir: ctx.projectDir });
        if (!result.ok) {
            throw new Error(`hook '${entry.nativeEvent}' exited ${result.status}: ${result.stderrTail}`);
        }
        fired.push(`${entry.nativeEvent}=${result.status}`);
    }
    return `${manifestCheck.message}; fired ${fired.length} live event(s): ${fired.join(', ')}`;
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
    { name: 'hook-lifecycle', fn: legHookLifecycle },
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
            ctx.results.push({
                leg: leg.name,
                ok: false,
                detail: 'skipped (earlier leg failed)',
                durationMs: 0,
                executed: false,
            });
            continue;
        }
        const t0 = Date.now();
        try {
            const detail = await leg.fn(ctx);
            const executed = !detail.startsWith('skipped');
            ctx.results.push({ leg: leg.name, ok: true, detail, durationMs: Date.now() - t0, executed });
            log(`  ✅  ${leg.name} — ${detail}`);
        } catch (err) {
            ctx.results.push({
                leg: leg.name,
                ok: false,
                detail: (err as Error).message,
                durationMs: Date.now() - t0,
                executed: true,
            });
            log(`  ❌  ${leg.name} — ${(err as Error).message}`);
            failed = true;
        }
    }

    // Leg-completeness gate (road-to-fable-feedback-5 Phase 6a): a full run
    // (no --only) must have EXECUTED every expected leg — a silently-skipped
    // leg can no longer ride a green workflow. The only declared skip is
    // `upgrade` under an explicit --skip-registry flag.
    if (!only && !failed) {
        const declaredSkips = new Set(ctx.skipRegistry ? ['upgrade'] : []);
        const missing = LEGS.filter((l) => {
            const r = ctx.results.find((x) => x.leg === l.name);
            return r === undefined || (!r.executed && !declaredSkips.has(l.name));
        }).map((l) => l.name);
        if (missing.length > 0) {
            log(`❌  leg-completeness gate: expected leg(s) did not execute: ${missing.join(', ')}`);
            failed = true;
        }
    }

    const manifestPath = getOpt('--manifest');
    if (manifestPath) {
        const manifest = {
            ok: !failed,
            node: process.version,
            skipRegistry: ctx.skipRegistry,
            expected: LEGS.map((l) => l.name),
            results: ctx.results,
        };
        fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
        log(`leg manifest written: ${manifestPath}`);
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

// Entry guard (mirrors src/scripts/hooks/dispatch_hook.ts): a test file
// imports the pure helpers above (readInstalledClaudeHookCommands,
// checkDistManifestCompleteness, invokeHookCommand, …) without wanting a
// full `npm pack` + global-install run to fire as a side effect of the
// import. `main()` only runs when this file is the process's actual entry
// point (`npx tsx src/scripts/consumer_matrix.ts …`).
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    main().then(
        (code) => process.exit(code),
        (err) => {
            log(`❌  consumer-matrix crashed: ${(err as Error).stack ?? err}`);
            process.exit(2);
        },
    );
}

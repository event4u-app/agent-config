/**
 * `agent-config upgrade --unattended` — the safety envelope around the global
 * upgrade, for a run nobody is watching.
 *
 * It installs only when every gate in `_lib/unattended_gates` passes, only one
 * run at a time (a lock with a TTL and an owner PID), and only on the global
 * surfaces: the binary, the global projection, the global settings file. It
 * never reads the working directory, so it cannot move a project's
 * `agent_config_version` pin or write into a repository.
 *
 * Any failed step restores the version that was installed before and reports
 * the reason; the run then counts as a notification, not an install. `EACCES`
 * prints the exact command for the user to run and never escalates.
 *
 * The production wiring never swaps today: `ACTIVATION_BLOCKED` stands until a
 * global live-session register exists, because the measured mid-session swap
 * breaks running hooks. Gates, lock
 * and restore are exercised through the injected seams and by `--dry-run`.
 *
 * Exit codes: `0` installed or nothing newer · `3` refused (a gate, the lock, the
 * registry) · `1` a step failed and the previous version was restored · `4` a
 * step failed and the restore did not reach the previous version.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

import { read_candidate, unattended_decision, type RegistryCandidate } from '../_lib/unattended_gates.js';
import type { InstallOrigin } from '../_lib/classify_update.js';
import * as installed_lock from '../_lib/installed_lock.js';
import { classify_install_origin } from '../_lib/update_check.js';
import { event4u_root, write_target } from '../_lib/user_global_paths.js';
import { resolvePackageRoot } from '../_lib/package_root.js';
import { _is_source_repo } from './cmd_refresh.js';

export const PACKAGE_NAME = '@event4u/agent-config';
export const PACKUMENT_URL = `https://registry.npmjs.org/${PACKAGE_NAME}`;
export const LOCK_TTL_MS = 30 * 60 * 1000;
export const EXIT_REFUSED = 3;
export const EXIT_RESTORE_FAILED = 4;
export const LOCK_FILE = 'upgrade-unattended.lock';
export const SKIP_FILE = 'upgrade-skip.json';
/**
 * The production wiring's answer until a global live-session register exists:
 * the mid-session swap probe of 2026-10-18 recorded hook failures, so no
 * unattended swap is safe without knowing that no session is running.
 */
export const ACTIVATION_BLOCKED =
    'swapping the global install under a running session breaks its hooks, and no global ' +
    'live-session register exists yet to say none is running — run `agent-config upgrade` ' +
    'yourself once no session is open';

interface OutSink {
    write(text: string): void;
}

export interface StepResult {
    readonly rc: number;
    readonly stderr: string;
}

export type Packument = { readonly ok: true; readonly doc: unknown } | { readonly ok: false; readonly reason: string };

export interface UnattendedDeps {
    readonly fetchPackument: () => Promise<Packument>;
    readonly run: (cmd: string[]) => StepResult;
    /** The version recorded in `installed.lock`; `''` when unknown. */
    readonly readInstalled: () => string;
    readonly origin: InstallOrigin;
    readonly agentConfigBin: string;
    /** Existing GLOBAL settings files only — never a project file. */
    readonly globalSettings: readonly string[];
    readonly lockPath: string;
    readonly skipPath: string;
    readonly env: { readonly ci: boolean; readonly noUpdateCheck: boolean; readonly nodeVersion: string };
    readonly now: () => Date;
    readonly pid: number;
    readonly isAlive: (pid: number) => boolean;
    readonly dryRun: boolean;
    /**
     * Why the swap may not happen now, or `null` when it may. A global install
     * swapped under a live session breaks that session's hooks (Phase 1 probe),
     * so activation waits until a register can say no session is live.
     */
    readonly activationBlocked: string | null;
    readonly out: OutSink;
    readonly err: OutSink;
}

const PREFIX = 'agent-config upgrade --unattended';

function say(sink: OutSink, line: string): void {
    sink.write(line + '\n');
}

// --- skip list -------------------------------------------------------------

export function read_skips(skipPath: string): string[] {
    try {
        const data: unknown = JSON.parse(fs.readFileSync(skipPath, 'utf-8'));
        const list = (data as { skip?: unknown } | null)?.skip;
        return Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string') : [];
    } catch {
        return [];
    }
}

export function record_skip(skipPath: string, version: string): void {
    const skips = read_skips(skipPath);
    if (!skips.includes(version)) skips.push(version);
    fs.mkdirSync(path.dirname(skipPath), { recursive: true });
    fs.writeFileSync(skipPath, JSON.stringify({ skip: skips.sort() }, null, 2) + '\n', 'utf-8');
}

// --- single-flight lock ------------------------------------------------------

interface LockRecord {
    readonly pid: number;
    readonly started_at: string;
    readonly ttl_ms: number;
}

/** `null` when the lock is ours now; otherwise the reason it is not. */
export function acquire_lock(deps: Pick<UnattendedDeps, 'lockPath' | 'pid' | 'now' | 'isAlive'>): string | null {
    const record: LockRecord = { pid: deps.pid, started_at: deps.now().toISOString(), ttl_ms: LOCK_TTL_MS };
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            fs.mkdirSync(path.dirname(deps.lockPath), { recursive: true });
            fs.writeFileSync(deps.lockPath, JSON.stringify(record) + '\n', { flag: 'wx' });
            return null;
        } catch (exc) {
            if ((exc as NodeJS.ErrnoException).code !== 'EEXIST') return `cannot write the lock: ${String(exc)}`;
        }
        let held: Partial<LockRecord> = {};
        try {
            held = JSON.parse(fs.readFileSync(deps.lockPath, 'utf-8')) as Partial<LockRecord>;
        } catch {
            // An unreadable lock is treated as stale, never as ours.
        }
        const age = deps.now().getTime() - Date.parse(String(held.started_at));
        const live = typeof held.pid === 'number' && deps.isAlive(held.pid) && age >= 0 && age < (held.ttl_ms ?? LOCK_TTL_MS);
        if (live) return `another unattended upgrade holds the lock (pid ${held.pid})`;
        try {
            fs.unlinkSync(deps.lockPath);
        } catch {
            // Raced with another caller clearing it; the retry decides.
        }
    }
    return 'the lock could not be taken';
}

function release_lock(deps: Pick<UnattendedDeps, 'lockPath' | 'pid'>): void {
    try {
        const held = JSON.parse(fs.readFileSync(deps.lockPath, 'utf-8')) as Partial<LockRecord>;
        if (held.pid === deps.pid) fs.unlinkSync(deps.lockPath);
    } catch {
        // Nothing to release.
    }
}

// --- the run -----------------------------------------------------------------

function install_steps(version: string, deps: UnattendedDeps): string[][] {
    return [
        ['npm', 'install', '-g', `${PACKAGE_NAME}@${version}`],
        [deps.agentConfigBin, 'global', '--no-ui'],
        ...deps.globalSettings.map((target) => [deps.agentConfigBin, 'settings:sync', '--path', target]),
    ];
}

function run_steps(steps: string[][], deps: UnattendedDeps): { ok: true } | { ok: false; cmd: string[]; result: StepResult } {
    for (const cmd of steps) {
        say(deps.out, '→ ' + cmd.join(' '));
        const result = deps.run(cmd);
        if (result.rc !== 0) return { ok: false, cmd, result };
    }
    return { ok: true };
}

function restore(previous: string, deps: UnattendedDeps): number {
    const back = run_steps(install_steps(previous, deps).slice(0, 2), deps);
    const now = deps.readInstalled();
    if (back.ok && now === previous) {
        say(deps.err, `${PREFIX}: restored ${previous}. Run \`agent-config upgrade\` to retry by hand.`);
        return 1;
    }
    if (now === previous) {
        say(
            deps.err,
            `⚠️  ${PREFIX}: installed.lock still records ${previous}, but a restore step failed — ` +
                'run `agent-config doctor` before trusting this install.',
        );
        return 1;
    }
    say(
        deps.err,
        `❌  ${PREFIX}: the restore did not reach ${previous} (installed: ${now || 'unknown'}). ` +
            `Run \`npm install -g ${PACKAGE_NAME}@${previous}\` then \`agent-config global --no-ui\`.`,
    );
    return EXIT_RESTORE_FAILED;
}

async function decide(installed: string, deps: UnattendedDeps): Promise<{ candidate: RegistryCandidate } | { refused: string[] }> {
    const fetched = await deps.fetchPackument();
    if (!fetched.ok) return { refused: [`registry unavailable: ${fetched.reason}`] };
    const candidate = read_candidate(fetched.doc);
    if (candidate === null) return { refused: ['registry document carries no latest version'] };
    const decision = unattended_decision({
        installed,
        candidate,
        origin: deps.origin,
        skipped: read_skips(deps.skipPath),
        env: { ...deps.env, now: deps.now().toISOString() },
    });
    return decision.install ? { candidate } : { refused: [...decision.reasons] };
}

/** Contexts where even the registry fetch and the lock file are side effects nobody asked for. */
function quiet_context(deps: UnattendedDeps): string | null {
    if (deps.env.ci) return 'suppressed: CI';
    if (deps.env.noUpdateCheck) return 'suppressed: AGENT_CONFIG_NO_UPDATE_CHECK=1';
    if (deps.origin === 'source-checkout') return 'suppressed: source checkout';
    return null;
}

export async function run_unattended(deps: UnattendedDeps): Promise<number> {
    const quiet = quiet_context(deps);
    if (quiet !== null) {
        say(deps.out, `ℹ️  ${PREFIX}: not installing — ${quiet}.`);
        return EXIT_REFUSED;
    }
    const previous = deps.readInstalled();
    if (previous === '') {
        say(deps.err, `${PREFIX}: not installing — the installed version is unknown, so nothing could be restored.`);
        return EXIT_REFUSED;
    }
    const locked = acquire_lock(deps);
    if (locked !== null) {
        say(deps.err, `${PREFIX}: not installing — ${locked}.`);
        return EXIT_REFUSED;
    }
    try {
        const verdict = await decide(previous, deps);
        if ('refused' in verdict) {
            say(deps.out, `ℹ️  ${PREFIX}: not installing (installed: ${previous}) — ${verdict.refused.join('; ')}.`);
            return EXIT_REFUSED;
        }
        const target = verdict.candidate.version;
        const steps = install_steps(target, deps);
        if (deps.dryRun) {
            say(deps.out, `${PREFIX} — dry run, every gate passed for ${target}; would execute:`);
            for (const cmd of steps) say(deps.out, '  ' + cmd.join(' '));
            return 0;
        }
        if (deps.activationBlocked !== null) {
            say(deps.out, `ℹ️  ${PREFIX}: every gate passed for ${target}, but not installing — ${deps.activationBlocked}.`);
            return EXIT_REFUSED;
        }
        const ran = run_steps(steps, deps);
        if (ran.ok) {
            say(deps.out, `✅  agent-config upgraded unattended: ${previous} → ${target}.`);
            return 0;
        }
        const what = `${ran.cmd.join(' ')} (exit ${ran.result.rc})`;
        if (/\bEACCES\b/.test(ran.result.stderr)) {
            say(
                deps.err,
                `❌  ${PREFIX}: permission denied on ${what}. agent-config never runs sudo; ` +
                    `run this yourself with the right permissions: npm install -g ${PACKAGE_NAME}@${target}`,
            );
            if (deps.readInstalled() === previous) return 1;
            return restore(previous, deps);
        }
        say(deps.err, `❌  ${PREFIX}: step failed: ${what} — restoring ${previous}.`);
        return restore(previous, deps);
    } finally {
        release_lock(deps);
    }
}

// --- production wiring ---------------------------------------------------------

export async function fetch_packument(fetch_impl: typeof fetch = fetch, timeoutMs = 10_000): Promise<Packument> {
    try {
        const resp = await fetch_impl(PACKUMENT_URL, {
            headers: { Accept: 'application/json', 'User-Agent': 'agent-config-upgrade-unattended' },
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (!resp.ok) return { ok: false, reason: `HTTP ${resp.status}` };
        return { ok: true, doc: await resp.json() };
    } catch (exc) {
        return { ok: false, reason: exc instanceof Error ? exc.message : String(exc) };
    }
}

export function default_run(cmd: string[], err: OutSink): StepResult {
    const r = spawnSync(cmd[0] as string, cmd.slice(1), { stdio: ['ignore', 'inherit', 'pipe'], encoding: 'utf-8' });
    const stderr = r.stderr ?? '';
    if (stderr) err.write(stderr);
    if (r.error) return { rc: 127, stderr: stderr + String(r.error) };
    return { rc: r.status ?? (r.signal === 'SIGTERM' ? 143 : 1), stderr };
}

export function is_alive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (exc) {
        return (exc as NodeJS.ErrnoException).code === 'EPERM';
    }
}

function running_origin(): InstallOrigin {
    const root = resolvePackageRoot(import.meta.url);
    if (_is_source_repo(root)) return 'source-checkout';
    return classify_install_origin({ package_root: root, project_pin: null, latest: null, is_global_consumer: false });
}

/** `upgrade --skip <version>` — never install that version unattended. */
export function skip_version(version: string, out: OutSink): number {
    record_skip(write_target(SKIP_FILE), version);
    say(out, `ℹ️  agent-config upgrade --unattended will never install ${version}.`);
    return 0;
}

export async function run_unattended_default(options: {
    dryRun: boolean;
    out: OutSink;
    err: OutSink;
    agentConfigBin: string;
}): Promise<number> {
    const globalSettings = path.join(event4u_root(), 'settings', '.agent-settings.yml');
    return run_unattended({
        fetchPackument: () => fetch_packument(),
        run: (cmd) => default_run(cmd, options.err),
        readInstalled: () => {
            const v = installed_lock.read_lockfile()?.agent_config_version;
            return typeof v === 'string' ? v.trim().replace(/^v+/, '') : '';
        },
        origin: running_origin(),
        agentConfigBin: options.agentConfigBin,
        globalSettings: fs.existsSync(globalSettings) ? [globalSettings] : [],
        lockPath: write_target(LOCK_FILE),
        skipPath: write_target(SKIP_FILE),
        env: {
            ci: Boolean(process.env['CI']),
            noUpdateCheck: process.env['AGENT_CONFIG_NO_UPDATE_CHECK'] === '1',
            nodeVersion: process.version,
        },
        now: () => new Date(),
        pid: process.pid,
        isAlive: is_alive,
        dryRun: options.dryRun,
        activationBlocked: ACTIVATION_BLOCKED,
        out: options.out,
        err: options.err,
    });
}

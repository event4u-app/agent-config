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
 * The production wiring refuses the swap while the machine-wide live-session
 * register reports a running session (`activation_blocked_reason`), because the
 * measured mid-session swap breaks running hooks. With no session live, every
 * other gate still has to pass before anything installs.
 *
 * Exit codes: `0` installed, a dry run whose gates all passed, or `--skip`
 * recorded · `3` refused (a gate — including no newer version — the lock, the
 * registry, a live session) · `1` a step failed and the previous version was
 * restored · `4` a step failed and the restore did not reach the previous version.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

import { type ReleaseToVerify, verify_release_provenance } from '../_lib/sigstore_provenance.js';
import { read_candidate, unattended_decision, type RegistryCandidate } from '../_lib/unattended_gates.js';
import type { InstallOrigin } from '../_lib/classify_update.js';
import * as installed_lock from '../_lib/installed_lock.js';
import { any_live_session, global_register_dir } from '../_lib/session_register.js';
import { type EnvMap, event4u_root, write_target } from '../_lib/user_global_paths.js';
import { resolvePackageRoot } from '../_lib/package_root.js';
import { originForPackageRoot } from './doctor_install_mode.js';

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
    'swapping the global install under a running session breaks its hooks — a session is ' +
    'live on this machine right now; run `agent-config upgrade` yourself once none is open';

/**
 * Why the swap may not happen now, read from the machine-wide session register,
 * or `null` when it may.
 *
 * Replaces the standing constant this file shipped until 2026-10-20. That
 * constant was passed unconditionally by the production wiring, so the
 * unattended run refused whether or not a session was live — correct while no
 * register could answer the question, and a permanent `no` once one can.
 *
 * **Machine-wide, not repository-wide, and that is the whole point.** The swap
 * replaces the global binary, so it breaks the hooks of every running session
 * regardless of which checkout it is standing in. A repository-scoped register
 * would clear the gate while a session in a sibling clone was mid-turn, which
 * is exactly the failure the 2026-10-18 probe measured (490 failed hook
 * invocations of 4,190 across four swap rounds).
 *
 * **Fails open on an unreadable register, deliberately and not silently.**
 * `any_live_session` drops a record it cannot parse, so a corrupt directory
 * reads as "nobody is live" and this returns `null`. The swap is not left
 * unguarded by that: the lock with its owner PID, the 72 h release age, the
 * provenance and `deprecated` checks all still stand, and each is independent
 * of this one. The alternative — fail closed on any unreadable file — makes a
 * single stale byte in the global root an unattended upgrade that can never
 * run again on that machine, with no signal to the user that it stopped.
 */
export function activation_blocked_reason(env?: EnvMap | null): string | null {
    return any_live_session(global_register_dir(env)) ? ACTIVATION_BLOCKED : null;
}

interface OutSink {
    write(text: string): void;
}

export interface StepResult {
    readonly rc: number;
    readonly stderr: string;
}

export type Packument = { readonly ok: true; readonly doc: unknown } | { readonly ok: false; readonly reason: string };

/** A verified tarball on disk, the only thing the install step may install — or why there is none. */
export type Provenance = { readonly ok: true; readonly tarball: string } | { readonly ok: false; readonly reason: string };

export interface UnattendedDeps {
    readonly fetchPackument: () => Promise<Packument>;
    /** Download the candidate, verify its attestations against it, and hand back the verified file. */
    readonly verifyProvenance: (candidate: RegistryCandidate) => Promise<Provenance>;
    readonly run: (cmd: string[]) => StepResult;
    /** The version recorded in `installed.lock`; `''` when unknown. */
    readonly readInstalled: () => string;
    /** The version of the global package on disk; `''` when unreadable or half-written. */
    readonly readBinary: () => string;
    /** True once this process received SIGTERM; checked after every step. */
    readonly interrupted: () => boolean;
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

function read_text(p: string): string | null {
    try {
        return fs.readFileSync(p, 'utf-8');
    } catch {
        return null;
    }
}

/**
 * `null` when the lock is ours now; otherwise the reason it is not.
 *
 * The lock is created by hard-linking a private file into place, which fails
 * when any lock exists. A live owner holds it whatever its age — the TTL only
 * names how long a run is expected to take, it never hands a running swap's
 * lock to a second caller. A dead owner's lock is moved aside by rename, and
 * the moved file is compared with the one judged stale: if it is not the same
 * record, another caller took over in between, and its lock is put back.
 */
export function acquire_lock(deps: Pick<UnattendedDeps, 'lockPath' | 'pid' | 'now' | 'isAlive'>): string | null {
    const record: LockRecord = { pid: deps.pid, started_at: deps.now().toISOString(), ttl_ms: LOCK_TTL_MS };
    const mine = `${deps.lockPath}.${deps.pid}.${process.hrtime.bigint()}`;
    try {
        fs.mkdirSync(path.dirname(deps.lockPath), { recursive: true });
        fs.writeFileSync(mine, JSON.stringify(record) + '\n', { flag: 'wx' });
    } catch (exc) {
        return `cannot write the lock: ${String(exc)}`;
    }
    try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                fs.linkSync(mine, deps.lockPath);
                return null;
            } catch (exc) {
                if ((exc as NodeJS.ErrnoException).code !== 'EEXIST') return `cannot write the lock: ${String(exc)}`;
            }
            const judged = read_text(deps.lockPath);
            let held: Partial<LockRecord> = {};
            try {
                held = JSON.parse(judged ?? '') as Partial<LockRecord>;
            } catch {
                // An unreadable lock is treated as stale, never as ours.
            }
            if (typeof held.pid === 'number' && deps.isAlive(held.pid)) {
                const age = deps.now().getTime() - Date.parse(String(held.started_at));
                const overdue = age >= (held.ttl_ms ?? LOCK_TTL_MS) ? ` for longer than its ${LOCK_TTL_MS / 60_000} min TTL` : '';
                return `another unattended upgrade holds the lock (pid ${held.pid})${overdue}`;
            }
            const tomb = `${mine}.stale`;
            try {
                fs.renameSync(deps.lockPath, tomb);
            } catch {
                continue;
            }
            if (read_text(tomb) !== judged) {
                try {
                    fs.linkSync(tomb, deps.lockPath);
                } catch {
                    // A third caller holds it now; either way it is not ours.
                }
                fs.rmSync(tomb, { force: true });
                return 'another unattended upgrade took the lock over first';
            }
            fs.rmSync(tomb, { force: true });
        }
        return 'the lock could not be taken';
    } finally {
        fs.rmSync(mine, { force: true });
    }
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

/** `spec` is the verified tarball for an upgrade, and `<package>@<version>` only for a restore. */
function install_steps(spec: string, deps: UnattendedDeps): string[][] {
    return [
        ['npm', 'install', '-g', spec],
        [deps.agentConfigBin, 'global', '--no-ui'],
        ...deps.globalSettings.map((target) => [deps.agentConfigBin, 'settings:sync', '--path', target]),
    ];
}

function run_steps(steps: string[][], deps: UnattendedDeps, honourSignal = true): { ok: true } | { ok: false; cmd: string[]; result: StepResult } {
    for (const cmd of steps) {
        say(deps.out, '→ ' + cmd.join(' '));
        const result = deps.run(cmd);
        if (result.rc !== 0) return { ok: false, cmd, result };
        if (honourSignal && deps.interrupted()) return { ok: false, cmd, result: { rc: 143, stderr: 'SIGTERM received' } };
    }
    return { ok: true };
}

/** Restored means both the binary and `installed.lock` read the previous version again. */
function restore(previous: string, deps: UnattendedDeps): number {
    const back = run_steps(install_steps(`${PACKAGE_NAME}@${previous}`, deps).slice(0, 2), deps, false);
    const lock = deps.readInstalled();
    const binary = deps.readBinary();
    if (back.ok && lock === previous && binary === previous) {
        say(deps.err, `${PREFIX}: restored ${previous}. Run \`agent-config upgrade\` to retry by hand.`);
        return 1;
    }
    say(
        deps.err,
        `❌  ${PREFIX}: the restore did not reach ${previous} (installed.lock: ${lock || 'unknown'}, ` +
            `binary: ${binary || 'unreadable'}). ` +
            `Run \`npm install -g ${PACKAGE_NAME}@${previous}\` then \`agent-config global --no-ui\`.`,
    );
    return EXIT_RESTORE_FAILED;
}

async function decide(
    installed: string,
    deps: UnattendedDeps,
): Promise<{ candidate: RegistryCandidate; tarball: string } | { refused: string[] }> {
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
    if (!decision.install) return { refused: [...decision.reasons] };
    // `decision` accepted an attestation that EXISTS and carries an SLSA
    // predicate, which any workflow with `id-token: write` can produce; the
    // tarball is verified here against pinned roots before anything installs.
    const provenance = await deps.verifyProvenance(candidate);
    if (!provenance.ok) return { refused: [provenance.reason] };
    return { candidate, tarball: provenance.tarball };
}

/** Largest tarball the unattended path downloads; a release is about 16 MB. */
export const MAX_TARBALL_BYTES = 64 * 1024 * 1024;

/**
 * Download the candidate's tarball, check it against the packument's integrity
 * and against both attestations, and write exactly those bytes to a private
 * temp file — the file the install step installs. Returns that file, or why
 * there is none.
 *
 * The bytes verified and the bytes installed are one buffer: installing by
 * `<package>@<version>` would let the registry serve different bytes to the
 * second request than to the first.
 *
 * Every URL comes from the packument, so each must be on the registry's own
 * origin; a hostile answer would otherwise choose both the host fetched and the
 * document verified. A fetch that fails REFUSES rather than passing: an
 * unreachable attestation is exactly what an attacker serving a tarball without
 * one produces.
 */
export async function verify_provenance_default(
    candidate: RegistryCandidate,
    fetch_impl: typeof fetch = fetch,
    timeoutMs = 60_000,
    verify: (release: ReleaseToVerify) => Promise<string | null> = (r) => verify_release_provenance(r),
): Promise<Provenance> {
    const v = candidate.version;
    const registry = new URL(PACKUMENT_URL).origin;
    const refuse = (reason: string): Provenance => ({ ok: false, reason: `${v}: ${reason}` });
    for (const [what, url] of [
        ['attestation bundle', candidate.attestationsUrl],
        ['tarball', candidate.tarballUrl],
    ] as const) {
        if (url === null) return refuse(`the registry names no ${what} to verify`);
        let origin = '';
        try {
            origin = new URL(url).origin;
        } catch {
            // an unparsable URL is refused below like a foreign one
        }
        if (origin !== registry) return refuse(`the ${what} url is not on ${registry}`);
    }
    const integrity = /^sha512-([A-Za-z0-9+/=]+)$/.exec(candidate.integrity ?? '');
    if (integrity === null) return refuse('the registry records no sha512 integrity for the tarball');

    const get = async (url: string): Promise<Response> => {
        const resp = await fetch_impl(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp;
    };
    let attestations: unknown;
    let bytes: Buffer;
    try {
        attestations = await (await get(candidate.attestationsUrl as string)).json();
        const resp = await get(candidate.tarballUrl as string);
        if (Number(resp.headers.get('content-length') ?? 0) > MAX_TARBALL_BYTES) return refuse('the tarball is larger than allowed');
        bytes = Buffer.from(await resp.arrayBuffer());
    } catch (err) {
        return refuse(`download failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (bytes.length > MAX_TARBALL_BYTES) return refuse('the tarball is larger than allowed');
    const digest = crypto.createHash('sha512').update(bytes).digest();
    if (!digest.equals(Buffer.from(integrity[1] as string, 'base64'))) {
        return refuse('the downloaded tarball does not match the integrity the registry records');
    }
    const reason = await verify({ version: v, tarballSha512Hex: digest.toString('hex'), attestations });
    if (reason !== null) return refuse(reason);

    try {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-upgrade-'));
        const tarball = path.join(dir, `agent-config-${v}.tgz`);
        fs.writeFileSync(tarball, bytes, { mode: 0o600, flag: 'wx' });
        return { ok: true, tarball };
    } catch (err) {
        return refuse(`cannot write the verified tarball: ${err instanceof Error ? err.message : String(err)}`);
    }
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
    let verified: string | null = null;
    try {
        const verdict = await decide(previous, deps);
        if ('refused' in verdict) {
            say(deps.out, `ℹ️  ${PREFIX}: not installing (installed: ${previous}) — ${verdict.refused.join('; ')}.`);
            return EXIT_REFUSED;
        }
        verified = verdict.tarball;
        const target = verdict.candidate.version;
        const steps = install_steps(verified, deps);
        if (deps.activationBlocked !== null) {
            const how = deps.dryRun ? 'dry run: a real run would not install' : 'not installing';
            say(deps.out, `ℹ️  ${PREFIX}: every gate passed for ${target}, but ${how} — ${deps.activationBlocked}.`);
            return EXIT_REFUSED;
        }
        if (deps.dryRun) {
            say(deps.out, `${PREFIX} — dry run, every gate passed for ${target}; would execute:`);
            for (const cmd of steps) say(deps.out, '  ' + cmd.join(' '));
            return 0;
        }
        const ran = run_steps(steps, deps);
        if (ran.ok) {
            say(deps.out, `✅  agent-config upgraded unattended: ${previous} → ${target}.`);
            return 0;
        }
        const what = `${ran.cmd.join(' ')} (exit ${ran.result.rc})`;
        if (/\bEACCES\b/.test(ran.result.stderr)) {
            // The verified file is removed when this run ends, so the command a
            // person can still run names the version instead.
            const manual = ran.cmd === steps[0] ? ['npm', 'install', '-g', `${PACKAGE_NAME}@${target}`] : ran.cmd;
            say(
                deps.err,
                `❌  ${PREFIX}: permission denied on ${what}. agent-config never runs sudo; ` +
                    `run this yourself with the right permissions: ${manual.join(' ')}`,
            );
            // Denied on the very first write, npm changed nothing; any later step leaves a mixed install.
            const untouched = ran.cmd === steps[0] && deps.readInstalled() === previous && deps.readBinary() === previous;
            if (untouched) return 1;
            return restore(previous, deps);
        }
        say(deps.err, `❌  ${PREFIX}: step failed: ${what} — restoring ${previous}.`);
        return restore(previous, deps);
    } finally {
        if (verified !== null) fs.rmSync(path.dirname(verified), { recursive: true, force: true });
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

export { originForPackageRoot } from './doctor_install_mode.js';

function running_origin(): InstallOrigin {
    return originForPackageRoot(resolvePackageRoot(import.meta.url));
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
    const packageJson = path.join(resolvePackageRoot(import.meta.url), 'package.json');
    let terminated = false;
    const onTerm = (): void => {
        terminated = true;
    };
    process.on('SIGTERM', onTerm);
    try {
        return await run_unattended_wired(options, globalSettings, packageJson, () => terminated);
    } finally {
        process.off('SIGTERM', onTerm);
    }
}

function run_unattended_wired(
    options: { dryRun: boolean; out: OutSink; err: OutSink; agentConfigBin: string },
    globalSettings: string,
    packageJson: string,
    interrupted: () => boolean,
): Promise<number> {
    return run_unattended({
        readBinary: () => {
            try {
                const v = (JSON.parse(fs.readFileSync(packageJson, 'utf-8')) as { version?: unknown }).version;
                return typeof v === 'string' ? v : '';
            } catch {
                return '';
            }
        },
        interrupted,
        fetchPackument: () => fetch_packument(),
        verifyProvenance: (c) => verify_provenance_default(c),
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
            ci: !['', '0', 'false'].includes((process.env['CI'] ?? '').trim().toLowerCase()),
            noUpdateCheck: process.env['AGENT_CONFIG_NO_UPDATE_CHECK'] === '1',
            nodeVersion: process.version,
        },
        now: () => new Date(),
        pid: process.pid,
        isAlive: is_alive,
        dryRun: options.dryRun,
        activationBlocked: activation_blocked_reason(),
        out: options.out,
        err: options.err,
    });
}

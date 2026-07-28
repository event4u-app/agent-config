/**
 * Tool probe — five-state health classification for an upstream CLI backend
 * (road-to-internet-reach Phase 2, step 1).
 *
 * The reach layer never wraps or proxies a tool; it only answers "is this
 * backend usable right now, and if not, what does the human run to fix it?".
 * This module is that answer for exactly ONE backend descriptor. Iterating a
 * registry, rendering a table and choosing an active backend all belong to the
 * caller (`reach_doctor.ts`), which follows the `hooks_doctor.ts` payload /
 * exit-code conventions.
 *
 * Taxonomy (the whole contract):
 *
 *   ok      — the binary resolves AND the side-effect-free probe exits 0.
 *   missing — the binary does not resolve on PATH at all.
 *   broken  — the binary resolves but the probe fails in a way that means a
 *             damaged install: exit 126 / 127, an `EACCES` on a path that
 *             passed the executable check, or a resolvable shim whose
 *             interpreter is gone (the **stale-shim** case: resolution finds
 *             the file, executing it fails `ENOENT`).
 *   timeout — the probe exceeded its per-probe deadline.
 *   error   — anything else, captured and attributed to this descriptor only
 *             (including a probe that ran and exited non-zero with a code
 *             other than 126 / 127 — the tool is installed but disagrees).
 *
 * Non-negotiables:
 *
 *   - **Every spawn goes through `hardenedSpawnEnv()`** (ADR-123): the probe
 *     runs external binaries, so the loader / git-config / runtime-auto-exec
 *     injection vectors are scrubbed from the child env. PATH resolution walks
 *     the *same* hardened env, so "what we resolved" and "what we executed"
 *     can never diverge.
 *   - **Side-effect-free probes only.** The caller supplies the args
 *     (`--version`, `--help`, a status subcommand). This module never invents
 *     args and never runs an install / update / login / write command.
 *   - **Retry applies to `timeout` ONLY** — exactly one retry, never for
 *     `missing`, `broken` or `error`. A missing binary will still be missing.
 *   - **Never throws.** A malformed descriptor, an invalid arg, a hostile
 *     filesystem — all become a returned `error` result. One bad backend must
 *     not take down a caller iterating over many.
 *   - **No network, no config reading.** The descriptor is passed in; the
 *     `fix` prescription is echoed from it. This module invents no install
 *     command of its own.
 *
 * Child stdio is fully ignored: the verdict is the exit status, capturing
 * output would risk pulling credentials / fetched content into a report, and
 * an ignored stdio cannot hang on a grandchild holding the pipe open after a
 * timeout kill.
 */

import { spawnSync } from 'node:child_process';
import type { SpawnSyncOptions } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { hardenedSpawnEnv } from './spawn_env.js';

/** The five states. Nothing else is representable. */
export type ToolProbeStatus = 'ok' | 'missing' | 'broken' | 'timeout' | 'error';

/**
 * A platform-keyed prescription, e.g.
 * `{ darwin: 'brew install gh@2.62.0', default: 'see docs/…' }`.
 * Resolved by `process.platform`, falling back to `default`. The strings are
 * the caller's — this module only selects and echoes.
 */
export type FixPrescription = string | Readonly<Record<string, string>>;

/** One backend to probe. Registry-shaped (snake_case), never guessed. */
export interface ToolProbeDescriptor {
    /** Stable id echoed into the result (channel / backend name). */
    name: string;
    /** Binary name resolved on PATH, or an explicit absolute / relative path. */
    bin: string;
    /** Side-effect-free probe args. Empty means "run the bare binary". */
    probe_args?: readonly string[];
    /** Per-probe deadline. Defaults to {@link DEFAULT_TIMEOUT_MS}. */
    timeout_ms?: number;
    /** Human-run prescription echoed on `missing` / `broken`. */
    fix?: FixPrescription;
    /** Env overrides handed to `hardenedSpawnEnv()` (e.g. a scoped PATH). */
    env?: Readonly<Record<string, string>>;
    /** Working directory for the probe. Defaults to the caller's cwd. */
    cwd?: string;
}

/** JSON-serialisable verdict for exactly one descriptor. */
export interface ToolProbeResult {
    name: string;
    bin: string;
    status: ToolProbeStatus;
    /** Resolved binary path, or `null` when resolution failed. */
    path: string | null;
    /** Child exit code, or `null` when the child never reported one. */
    exit_code: number | null;
    /** Terminating signal, or `null`. `SIGTERM` accompanies a timeout kill. */
    signal: string | null;
    /** Probe invocations actually performed (2 only on the timeout retry). */
    attempts: number;
    /** Deadline applied per attempt. */
    timeout_ms: number;
    /** Short, output-free explanation of the verdict. */
    diagnostic: string;
    /** Echoed prescription — populated for `missing` / `broken` only. */
    fix: string | null;
}

/** Default per-probe deadline: generous for a cold `--version`, still bounded. */
export const DEFAULT_TIMEOUT_MS = 5_000;

/** Exit codes that mean "resolvable but damaged" rather than "disagrees". */
const BROKEN_EXIT_CODES: ReadonlySet<number> = new Set([126, 127]);

/** Resolve the platform-appropriate prescription; `null` when none was given. */
function resolveFix(fix: FixPrescription | undefined): string | null {
    if (fix === undefined) return null;
    if (typeof fix === 'string') return fix.trim() === '' ? null : fix;
    const exact = fix[process.platform];
    if (typeof exact === 'string' && exact.trim() !== '') return exact;
    const fallback = fix['default'];
    if (typeof fallback === 'string' && fallback.trim() !== '') return fallback;
    return null;
}

function isExecutableFile(candidate: string): boolean {
    try {
        if (!fs.statSync(candidate).isFile()) return false;
    } catch {
        return false;
    }
    if (process.platform === 'win32') {
        // X_OK is not meaningful on Windows; extension carries executability.
        return true;
    }
    try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

function looksLikePath(bin: string): boolean {
    return bin.includes('/') || (process.platform === 'win32' && bin.includes('\\'));
}

/**
 * PATH resolution over the **hardened** env — the same env the probe will run
 * under. Returns the resolved path, or `null` for `missing`.
 */
function resolveBinary(bin: string, env: NodeJS.ProcessEnv): string | null {
    if (bin.trim() === '') return null;
    if (looksLikePath(bin)) {
        const direct = path.resolve(bin);
        return isExecutableFile(direct) ? direct : null;
    }
    const pathValue = env['PATH'] ?? env['Path'] ?? '';
    const extensions =
        process.platform === 'win32'
            ? (env['PATHEXT'] ?? '.COM;.EXE;.BAT;.CMD').split(';').filter((e) => e !== '')
            : [''];
    for (const dir of pathValue.split(path.delimiter)) {
        if (dir === '') continue;
        for (const ext of extensions) {
            const candidate = path.join(dir, `${bin}${ext}`);
            if (isExecutableFile(candidate)) return candidate;
        }
    }
    return null;
}

interface Attempt {
    status: number | null;
    signal: string | null;
    errorCode: string | null;
    timedOut: boolean;
}

function runOnce(
    resolved: string,
    args: readonly string[],
    timeoutMs: number,
    env: NodeJS.ProcessEnv,
    cwd: string | undefined,
): Attempt {
    const options: SpawnSyncOptions = {
        env,
        timeout: timeoutMs,
        // See the module header: verdict is the exit status, never the output.
        stdio: ['ignore', 'ignore', 'ignore'],
        windowsHide: true,
    };
    if (cwd !== undefined) options.cwd = cwd;
    const result = spawnSync(resolved, [...args], options);
    // Node attaches the libuv code (`ENOENT` / `EACCES` / `ETIMEDOUT`) to the
    // spawn error; it is not part of the declared `Error` shape.
    const raw = result.error as (Error & { code?: unknown }) | undefined;
    const errorCode = typeof raw?.code === 'string' ? raw.code : null;
    return {
        status: result.status ?? null,
        signal: result.signal ?? null,
        errorCode,
        // Node reports a deadline kill as ETIMEDOUT; the SIGTERM+no-status
        // shape is the belt-and-braces reading for hosts that omit the code.
        timedOut:
            errorCode === 'ETIMEDOUT' ||
            (result.status === null && result.signal === 'SIGTERM' && errorCode === null),
    };
}

function classify(resolved: string, attempt: Attempt, timeoutMs: number, attempts: number): {
    status: ToolProbeStatus;
    diagnostic: string;
} {
    if (attempt.timedOut) {
        return {
            status: 'timeout',
            diagnostic: `probe exceeded the ${timeoutMs}ms deadline after ${attempts} attempt(s)`,
        };
    }
    if (attempt.errorCode === 'ENOENT') {
        // Resolution found the file, exec said it is not there → the shebang
        // interpreter is gone. This is the stale-shim case.
        return {
            status: 'broken',
            diagnostic: `resolved at ${resolved} but exec failed ENOENT — stale shim (interpreter missing)`,
        };
    }
    if (attempt.errorCode === 'EACCES') {
        return {
            status: 'broken',
            diagnostic: `resolved at ${resolved} but exec failed EACCES — not executable as installed`,
        };
    }
    if (attempt.errorCode !== null) {
        return {
            status: 'error',
            diagnostic: `probe spawn failed ${attempt.errorCode}`,
        };
    }
    if (attempt.status === 0) {
        return { status: 'ok', diagnostic: `probe exited 0 (${resolved})` };
    }
    if (attempt.status !== null && BROKEN_EXIT_CODES.has(attempt.status)) {
        return {
            status: 'broken',
            diagnostic: `probe exited ${attempt.status} — damaged install (command not found / not executable inside the wrapper)`,
        };
    }
    if (attempt.status !== null) {
        return { status: 'error', diagnostic: `probe exited ${attempt.status}` };
    }
    return {
        status: 'error',
        diagnostic: `probe reported no exit status${attempt.signal !== null ? ` (signal ${attempt.signal})` : ''}`,
    };
}

/**
 * Probe one backend. Returns a verdict; **never throws**.
 *
 * @param descriptor the backend to probe. Everything the probe needs —
 *   binary, side-effect-free args, deadline, and the `fix` prescription echoed
 *   on `missing` / `broken` — comes from here. No config or network read.
 */
export function probeTool(descriptor: ToolProbeDescriptor): ToolProbeResult {
    // Types are a compile-time promise, not a runtime one: a descriptor built
    // from a YAML registry can carry anything (or be nullish), so every read
    // below is defensive and the whole body is inside the never-throw guard.
    let timeoutMs = DEFAULT_TIMEOUT_MS;
    const base: ToolProbeResult = {
        name: '(unnamed)',
        bin: '',
        status: 'error',
        path: null,
        exit_code: null,
        signal: null,
        attempts: 0,
        timeout_ms: timeoutMs,
        diagnostic: 'probe did not run',
        fix: null,
    };

    try {
        const name = typeof descriptor?.name === 'string' ? descriptor.name : '(unnamed)';
        const bin = typeof descriptor?.bin === 'string' ? descriptor.bin : '';
        base.name = name;
        base.bin = bin;

        const requested = descriptor.timeout_ms;
        if (typeof requested === 'number' && Number.isFinite(requested) && requested > 0) {
            timeoutMs = Math.floor(requested);
        }
        base.timeout_ms = timeoutMs;
        const fix = resolveFix(descriptor.fix);

        if (bin.trim() === '') {
            return {
                ...base,
                status: 'error',
                diagnostic: 'descriptor carries no binary to probe',
            };
        }

        const env = hardenedSpawnEnv({ ...(descriptor.env ?? {}) });
        const resolved = resolveBinary(bin, env);
        if (resolved === null) {
            return {
                ...base,
                status: 'missing',
                diagnostic: `'${bin}' does not resolve on PATH`,
                fix,
            };
        }

        const args = descriptor.probe_args ?? [];
        const cwd = descriptor.cwd;

        let attempts = 0;
        let attempt = runOnce(resolved, args, timeoutMs, env, cwd);
        attempts += 1;
        // Retry ONLY a timeout, and only once. `missing` / `broken` / `error`
        // are stable verdicts — retrying them just burns the deadline twice.
        if (attempt.timedOut) {
            attempt = runOnce(resolved, args, timeoutMs, env, cwd);
            attempts += 1;
        }

        const verdict = classify(resolved, attempt, timeoutMs, attempts);
        return {
            ...base,
            status: verdict.status,
            path: resolved,
            exit_code: attempt.status,
            signal: attempt.signal,
            attempts,
            diagnostic: verdict.diagnostic,
            fix: verdict.status === 'missing' || verdict.status === 'broken' ? fix : null,
        };
    } catch (err) {
        // The never-throw guarantee. An invalid arg, a RangeError deadline, a
        // filesystem that lies — all land here as this descriptor's `error`.
        const message = err instanceof Error ? err.message : String(err);
        return {
            ...base,
            status: 'error',
            timeout_ms: timeoutMs,
            diagnostic: `probe raised unexpectedly: ${message}`,
        };
    }
}

/**
 * Probe many descriptors, isolating failures: one hostile descriptor becomes
 * its own `error` row and every other backend is still reported.
 */
export function probeTools(descriptors: readonly ToolProbeDescriptor[]): ToolProbeResult[] {
    return descriptors.map((descriptor) => probeTool(descriptor));
}

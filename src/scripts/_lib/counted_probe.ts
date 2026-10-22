/**
 * Bounded shell-out for probes that parse a count or a list out of stdout.
 *
 * `spawnSync` buffers the child's whole stdout in memory and fails with
 * `ENOBUFS` past `maxBuffer`, whose default is 1 MiB. A probe that treats that
 * failure as "no output" reports **zero** — and zero, for a counting probe, is
 * indistinguishable from a clean result. That is how a release shipped without
 * its `Tests:` footer: the `vitest list` output had grown to 1,254,812 bytes,
 * the probe degraded silently, and the omission surfaced only as a red gate
 * downstream.
 *
 * Raising the buffer alone just moves the cliff. The invariant this module
 * enforces is the other half: **a truncated read is an error, never a zero.**
 *
 * The distinction that matters:
 *
 * - `ENOBUFS` — the command *succeeded* and we lost its output. There is no
 *   honest count to report, so this throws.
 * - `ENOENT` / non-zero exit — the command did not run, or ran and failed.
 *   The caller may legitimately degrade (a dev box without `npx`), so these
 *   are reported as a typed outcome rather than thrown.
 *
 * Scope note: this is deliberately not a general exec wrapper. It covers the
 * counting/listing class, where a short read silently manufactures a passing
 * result.
 */
import { spawn, spawnSync, type SpawnSyncReturns } from 'node:child_process';

/**
 * Default ceiling: 64 MiB.
 *
 * ~50× the largest listing this repository currently produces, at no cost
 * when the output is small — `maxBuffer` is a ceiling, not an allocation.
 */
export const DEFAULT_PROBE_MAX_BUFFER = 64 * 1024 * 1024;

/** Raised when a probe's output exceeded the buffer, so its count is unknowable. */
export class ProbeOverflowError extends Error {
    constructor(
        readonly command: string,
        readonly maxBuffer: number,
    ) {
        super(
            `probe \`${command}\` exceeded its ${Math.round(maxBuffer / (1024 * 1024))} MiB ` +
                'output buffer — the read was truncated, so any count derived from it ' +
                'would be wrong. This is an error rather than a zero on purpose: a ' +
                'counting probe that degrades to zero reports a clean result it never ' +
                'measured. Raise the buffer or narrow the command.',
        );
        this.name = 'ProbeOverflowError';
    }
}

export interface ProbeOptions {
    readonly cwd?: string;
    readonly maxBuffer?: number;
    readonly timeout?: number;
    readonly env?: NodeJS.ProcessEnv;
}

export interface ProbeResult {
    /** True when the command ran and exited 0. */
    readonly ok: boolean;
    readonly stdout: string;
    readonly stderr: string;
    readonly status: number | null;
    /** Populated when the command could not be run or failed; never set for overflow (that throws). */
    readonly failure: string | null;
}

/**
 * Run a command and capture stdout with an explicit buffer ceiling.
 *
 * @throws {ProbeOverflowError} when the child's output exceeded `maxBuffer`.
 */
export function runCountedProbe(
    command: string,
    args: readonly string[],
    opts: ProbeOptions = {},
): ProbeResult {
    const maxBuffer = opts.maxBuffer ?? DEFAULT_PROBE_MAX_BUFFER;
    const res: SpawnSyncReturns<string> = spawnSync(command, [...args], {
        cwd: opts.cwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer,
        ...(opts.timeout === undefined ? {} : { timeout: opts.timeout }),
        ...(opts.env === undefined ? {} : { env: opts.env }),
    });
    return interpretProbeResult(res, `${command} ${args.join(' ')}`.trim(), maxBuffer);
}

/**
 * `runCountedProbe` without blocking the event loop, so a caller can run several
 * probes at once. Same contract: the per-stream `maxBuffer` mirrors `spawnSync`,
 * and an overflow kills the child and throws rather than resolving to a short read.
 *
 * @throws {ProbeOverflowError} (as a rejection) when a stream exceeded `maxBuffer`.
 */
export function runCountedProbeAsync(
    command: string,
    args: readonly string[],
    opts: ProbeOptions = {},
): Promise<ProbeResult> {
    const maxBuffer = opts.maxBuffer ?? DEFAULT_PROBE_MAX_BUFFER;
    const label = `${command} ${args.join(' ')}`.trim();
    return new Promise((resolve, reject) => {
        const child = spawn(command, [...args], {
            cwd: opts.cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            ...(opts.env === undefined ? {} : { env: opts.env }),
        });
        const out: Buffer[] = [];
        const err: Buffer[] = [];
        let outBytes = 0;
        let errBytes = 0;
        let error: (Error & { code?: string }) | undefined;
        const fail = (code: string): void => {
            if (error !== undefined) return;
            error = Object.assign(new Error(code), { code });
            child.kill('SIGTERM');
        };
        const timer =
            opts.timeout === undefined ? undefined : setTimeout(() => fail('ETIMEDOUT'), opts.timeout);
        child.stdout.on('data', (chunk: Buffer) => {
            outBytes += chunk.length;
            if (outBytes > maxBuffer) fail('ENOBUFS');
            else out.push(chunk);
        });
        child.stderr.on('data', (chunk: Buffer) => {
            errBytes += chunk.length;
            if (errBytes > maxBuffer) fail('ENOBUFS');
            else err.push(chunk);
        });
        child.on('error', (e: Error & { code?: string }) => {
            error ??= e;
        });
        child.on('close', (status: number | null) => {
            if (timer !== undefined) clearTimeout(timer);
            try {
                resolve(
                    interpretProbeResult(
                        {
                            error,
                            status: error === undefined ? status : null,
                            stdout: Buffer.concat(out).toString('utf-8'),
                            stderr: Buffer.concat(err).toString('utf-8'),
                        },
                        label,
                        maxBuffer,
                    ),
                );
            } catch (e) {
                reject(e as Error);
            }
        });
    });
}

/**
 * Classify a finished spawn. Split out from `runCountedProbe` so the failure
 * modes are unit-testable without spawning a real, slow, large-output child.
 *
 * @throws {ProbeOverflowError} on `ENOBUFS`.
 */
export function interpretProbeResult(
    res: {
        error?: (Error & { code?: string }) | undefined;
        status: number | null;
        stdout: string | null;
        stderr?: string | null;
    },
    command: string,
    maxBuffer: number = DEFAULT_PROBE_MAX_BUFFER,
): ProbeResult {
    const stdout = res.stdout ?? '';
    const stderr = res.stderr ?? '';
    if (res.error) {
        if (res.error.code === 'ENOBUFS') {
            throw new ProbeOverflowError(command, maxBuffer);
        }
        return {
            ok: false,
            stdout,
            stderr,
            status: res.status,
            failure: `${res.error.code ?? res.error.message}`,
        };
    }
    if ((res.status ?? 1) !== 0) {
        return {
            ok: false,
            stdout,
            stderr,
            status: res.status,
            failure: `exited ${res.status ?? '(null)'}`,
        };
    }
    return { ok: true, stdout, stderr, status: res.status, failure: null };
}

/** Non-empty, trimmed lines of a successful probe — the usual "list" shape. */
export function probeLines(result: ProbeResult): string[] {
    if (!result.ok) return [];
    return result.stdout
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
}

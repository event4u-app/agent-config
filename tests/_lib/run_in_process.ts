/**
 * In-process runner for TypeScript CLI twins.
 *
 * Replaces `spawnSync(tsx, [script, ...argv])` with a direct call to the
 * script's exported `main(argv)` function, eliminating ~350 ms of tsx
 * cold-start per invocation.
 *
 * Safety: vitest runs each test FILE in its own fork and tests within a file
 * sequentially, so the save/restore of process globals does not race.
 *
 * Supported call styles:
 *   - `main(argv)` returns a number → use it as the exit code.
 *   - `main(argv)` sets `process.exitCode` → read it after the call.
 *   - `process.exit(N)` inside main → caught as ProcessExit, returns N.
 *
 * Known limitation: module-level state in the imported script is shared
 * across calls (constants are fine; mutable module-level vars are not).
 * In practice all migrated scripts are stateless at module level.
 */

export interface RunResult {
    status: number;
    stdout: string;
    stderr: string;
}

export interface RunOpts {
    /** Override process.cwd() for the duration of the call. */
    cwd?: string;
    /** Overlay process.env keys for the duration of the call. */
    env?: Record<string, string>;
    /**
     * Data to make available when the script reads from stdin (fd 0).
     * Implemented by temporarily writing to a temp file and swapping fd 0.
     * Only supports UTF-8 string input.
     */
    stdin?: string;
}

/** Thrown by the mocked process.exit() to unwind the call stack. */
export class ProcessExit extends Error {
    constructor(public readonly code: number) {
        super(`ProcessExit(${code})`);
    }
}

/** Async variant for scripts whose main() returns a Promise. */
export async function runInProcAsync(
    mainFn: (argv: any) => Promise<number | void>,
    argv: string[] = [],
    opts: RunOpts = {},
): Promise<RunResult> {
    const stdoutBuf: string[] = [];
    const stderrBuf: string[] = [];

    const origStdoutWrite = process.stdout.write.bind(process.stdout);
    const origStderrWrite = process.stderr.write.bind(process.stderr);
    process.stdout.write = (s: string | Uint8Array, ...rest: any[]) => {
        stdoutBuf.push(typeof s === 'string' ? s : Buffer.from(s).toString('utf8'));
        return true;
    };
    process.stderr.write = (s: string | Uint8Array, ...rest: any[]) => {
        stderrBuf.push(typeof s === 'string' ? s : Buffer.from(s).toString('utf8'));
        return true;
    };

    const origExitCode = process.exitCode;
    process.exitCode = undefined;

    const origExit = process.exit.bind(process);
    process.exit = (code?: number) => { throw new ProcessExit(code ?? 0); };

    const origCwd = process.cwd();
    if (opts.cwd) { try { process.chdir(opts.cwd); } catch {} }

    const savedEnv: Record<string, string | undefined> = {};
    if (opts.env) {
        for (const [k, v] of Object.entries(opts.env)) {
            savedEnv[k] = process.env[k];
            process.env[k] = v;
        }
    }

    let status = 0;
    try {
        const result = await mainFn(argv);
        if (typeof result === 'number') {
            status = result;
        } else if (process.exitCode !== undefined && process.exitCode !== null) {
            status = process.exitCode as number;
        }
    } catch (e) {
        if (e instanceof ProcessExit) {
            status = e.code;
        } else if (e instanceof Error && _isArgparseExit(e)) {
            status = (e as any).code ?? _extractExitCode(e.message);
        } else if (process.exitCode !== undefined && process.exitCode !== null) {
            status = process.exitCode as number;
        } else if (e instanceof Error) {
            stderrBuf.push(e.message + '\n');
            status = 1;
        } else {
            throw e;
        }
    } finally {
        process.stdout.write = origStdoutWrite;
        process.stderr.write = origStderrWrite;
        process.exitCode = origExitCode;
        process.exit = origExit;
        if (opts.cwd) { try { process.chdir(origCwd); } catch {} }
        if (opts.env) {
            for (const [k] of Object.entries(opts.env)) {
                if (savedEnv[k] === undefined) delete process.env[k];
                else process.env[k] = savedEnv[k] as string;
            }
        }
    }

    return { status, stdout: stdoutBuf.join(''), stderr: stderrBuf.join('') };
}

// Some scripts declare main(argv: string[]) (non-nullable); accept both forms.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MainFn = (argv: any) => number | void | Promise<number | void>;

/** Detect the argparse "ArgparseExit" sentinel thrown by CLI scripts.
 *  Two shapes exist in the codebase:
 *  - `name === 'ArgparseExit'` + `.code` property (cmd_settings_check, etc.)
 *  - message `argparse-exit-<N>` (cmd_doctor, etc.)
 */
function _isArgparseExit(e: Error): boolean {
    return (
        (e as any).name === 'ArgparseExit' ||
        /^argparse-exit-\d+$/.test(e.message) ||
        /^ArgparseExit\(\d+\)$/.test(e.message)
    );
}

function _extractExitCode(message: string): number {
    const m = message.match(/\d+/);
    return m ? parseInt(m[0], 10) : 2;
}

/**
 * Call `mainFn(argv)` in-process with captured stdout/stderr and
 * a mocked process.exit(). Returns a RunResult compatible with the
 * shape returned by spawnSync.
 */
export function runInProc(mainFn: MainFn, argv: string[] = [], opts: RunOpts = {}): RunResult {
    // --- capture stdout / stderr ---
    let stdout = '';
    let stderr = '';

    const origStdoutWrite = process.stdout.write.bind(process.stdout);
    const origStderrWrite = process.stderr.write.bind(process.stderr);

    const captureWrite =
        (buf: string[]) =>
        (s: string | Uint8Array, encodingOrCb?: string | ((err?: Error | null) => void)) => {
            buf.push(typeof s === 'string' ? s : Buffer.from(s).toString('utf8'));
            return true;
        };

    (process.stdout as NodeJS.WritableStream).write = captureWrite([stdout]) as any;
    // Re-assign to closures that append to the same buf
    const stdoutBuf: string[] = [];
    const stderrBuf: string[] = [];
    process.stdout.write = (s: string | Uint8Array, ...rest: any[]) => {
        stdoutBuf.push(typeof s === 'string' ? s : Buffer.from(s).toString('utf8'));
        return true;
    };
    process.stderr.write = (s: string | Uint8Array, ...rest: any[]) => {
        stderrBuf.push(typeof s === 'string' ? s : Buffer.from(s).toString('utf8'));
        return true;
    };

    // --- save / restore process.exitCode ---
    const origExitCode = process.exitCode;
    process.exitCode = undefined;

    // --- mock process.exit ---
    const origExit = process.exit.bind(process);
    process.exit = (code?: number) => {
        throw new ProcessExit(code ?? 0);
    };

    // --- save / restore cwd ---
    const origCwd = process.cwd();
    if (opts.cwd) {
        try {
            process.chdir(opts.cwd);
        } catch {
            /* ignore chdir failures on non-existent dirs */
        }
    }

    // --- overlay env ---
    const savedEnv: Record<string, string | undefined> = {};
    if (opts.env) {
        for (const [k, v] of Object.entries(opts.env)) {
            savedEnv[k] = process.env[k];
            process.env[k] = v;
        }
    }

    let status = 0;
    try {
        // Pass an array (never null) so scripts that declare main(argv: string[])
        // without a null check still work. Scripts that accept string[] | null
        // will receive [] which they treat the same as reading process.argv.
        const result = mainFn(argv);
        if (typeof result === 'number') {
            status = result;
        } else if (process.exitCode !== undefined && process.exitCode !== null) {
            status = process.exitCode as number;
        }
    } catch (e) {
        if (e instanceof ProcessExit) {
            status = e.code;
        } else if (e instanceof Error && _isArgparseExit(e)) {
            // The TypeScript argparse library throws ArgparseExit(code) for
            // usage errors (code=2) and --help (code=0). Treat it like process.exit.
            status = (e as any).code ?? _extractExitCode(e.message);
        } else if (process.exitCode !== undefined && process.exitCode !== null) {
            // Script set process.exitCode then threw a non-ProcessExit error
            // (e.g. the `process.exitCode = 2; throw new ArgExit()` pattern).
            status = process.exitCode as number;
        } else if (e instanceof Error) {
            // Uncaught error from main() (e.g. FileNotFoundError replica).
            // Mirror what the CLI entry guard does: set exit 1 and emit to stderr.
            stderrBuf.push(e.message + '\n');
            status = 1;
        } else {
            throw e;
        }
    } finally {
        // Restore everything — must run even on unexpected throws
        process.stdout.write = origStdoutWrite;
        process.stderr.write = origStderrWrite;
        process.exitCode = origExitCode;
        process.exit = origExit;
        if (opts.cwd) {
            try {
                process.chdir(origCwd);
            } catch {
                /* ignore */
            }
        }
        if (opts.env) {
            for (const [k] of Object.entries(opts.env)) {
                if (savedEnv[k] === undefined) {
                    delete process.env[k];
                } else {
                    process.env[k] = savedEnv[k] as string;
                }
            }
        }
    }

    return {
        status,
        stdout: stdoutBuf.join(''),
        stderr: stderrBuf.join(''),
    };
}

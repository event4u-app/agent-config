// Compiled safety envelope for MCP shell-exec tools.
//
// Lives OUTSIDE src/scripts/mcp_server/ on purpose: the A0 contract bans
// direct child_process imports in mcp_server modules; approved exec-tier
// tools lazy-import this module instead (same transitive pattern as the
// roadmap_archive handler's git effects — accepted by the 2026-07-07
// council verdict, agents/decisions/mcp-write-exec-cut-2026-07-07.md).
//
// The envelope is compiled policy, not configuration (council Decision 2):
//   - argv array, never a shell string — caller-supplied values cannot be
//     interpolated into a command line;
//   - hard timeout — the child is killed, never awaited indefinitely;
//   - output cap per stream — a runaway process cannot flood the MCP
//     response;
//   - long-running policy is synchronous truncation (roadmap Phase 5
//     Step 4): no job queue, no polling — a call that exceeds the timeout
//     returns timed_out: true with whatever output was captured.
//
// Network isolation is NOT promised here: a spawned test runner executes
// arbitrary project test code, which may itself use the network. The
// envelope constrains the spawn surface (no shell, bounded time, bounded
// output), not the semantics of the tool under test — stated explicitly
// in the A0 amendment.

import { execFile } from 'node:child_process';

export interface EnvelopeSpec {
    /** argv[0] is the executable; the rest are literal arguments. No shell. */
    readonly argv: readonly string[];
    /** Working directory for the child (the consumer root). */
    readonly cwd: string;
    /** Hard kill deadline in milliseconds. */
    readonly timeout_ms: number;
    /** Per-stream output cap in bytes; excess is truncated, flagged. */
    readonly max_output_bytes: number;
}

export interface EnvelopeResult {
    exit_code: number | null;
    timed_out: boolean;
    stdout: string;
    stdout_truncated: boolean;
    stderr: string;
    stderr_truncated: boolean;
    duration_ms: number;
    argv: string[];
}

function _truncate(text: string, cap: number): [string, boolean] {
    const buf = Buffer.from(text, 'utf8');
    if (buf.byteLength <= cap) {
        return [text, false];
    }
    return [buf.subarray(0, cap).toString('utf8'), true];
}

/**
 * Run `spec.argv` under the compiled envelope and resolve with a
 * structured result. Never rejects for child failure — a non-zero exit,
 * timeout, or spawn error all surface inside the result object so the
 * MCP handler can return them as data.
 */
export function run_enveloped(spec: EnvelopeSpec): Promise<EnvelopeResult> {
    const started = Date.now();
    const [cmd, ...args] = spec.argv;
    if (cmd === undefined) {
        throw new Error('envelope argv must not be empty');
    }
    return new Promise((resolve) => {
        execFile(
            cmd,
            args,
            {
                cwd: spec.cwd,
                timeout: spec.timeout_ms,
                killSignal: 'SIGKILL',
                windowsHide: true,
                // Cap the in-memory buffer a little above the reported cap so
                // truncation is ours (flagged), not execFile's (thrown).
                maxBuffer: spec.max_output_bytes + 64 * 1024,
                encoding: 'utf8',
            },
            (error, stdout, stderr) => {
                const timedOut = Boolean(error && 'killed' in error && error.killed === true);
                let exitCode: number | null = 0;
                if (error) {
                    const code = (error as NodeJS.ErrnoException & { code?: unknown }).code;
                    exitCode = typeof code === 'number' ? code : null;
                }
                const [out, outTrunc] = _truncate(String(stdout ?? ''), spec.max_output_bytes);
                const [err, errTrunc] = _truncate(String(stderr ?? ''), spec.max_output_bytes);
                resolve({
                    exit_code: timedOut ? null : exitCode,
                    timed_out: timedOut,
                    stdout: out,
                    stdout_truncated: outTrunc,
                    stderr: err,
                    stderr_truncated: errTrunc,
                    duration_ms: Date.now() - started,
                    argv: [...spec.argv],
                });
            },
        );
    });
}

// Unit tests for the compiled safety envelope backing MCP shell-exec
// tools (src/scripts/mcp_exec/safety_envelope.ts). The envelope is the
// Phase 5 pilot's entire safety story — fixed argv, hard timeout,
// per-stream output caps — so every property is asserted directly.

import { describe, expect, it } from 'vitest';

import { run_enveloped } from '../../src/scripts/mcp_exec/safety_envelope.js';

const NODE = process.execPath;

describe('mcp_exec — safety envelope', () => {
    it('captures stdout/stderr and the zero exit code', async () => {
        const result = await run_enveloped({
            argv: [NODE, '-e', 'console.log("out"); console.error("err");'],
            cwd: process.cwd(),
            timeout_ms: 10_000,
            max_output_bytes: 64 * 1024,
        });
        expect(result.exit_code).toBe(0);
        expect(result.timed_out).toBe(false);
        expect(result.stdout).toContain('out');
        expect(result.stderr).toContain('err');
        expect(result.stdout_truncated).toBe(false);
        expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('surfaces a non-zero exit code without throwing', async () => {
        const result = await run_enveloped({
            argv: [NODE, '-e', 'process.exit(3);'],
            cwd: process.cwd(),
            timeout_ms: 10_000,
            max_output_bytes: 64 * 1024,
        });
        expect(result.exit_code).toBe(3);
        expect(result.timed_out).toBe(false);
    });

    it('kills on timeout and flags timed_out', async () => {
        const result = await run_enveloped({
            argv: [NODE, '-e', 'setTimeout(() => {}, 60000);'],
            cwd: process.cwd(),
            timeout_ms: 500,
            max_output_bytes: 64 * 1024,
        });
        expect(result.timed_out).toBe(true);
        expect(result.exit_code).toBeNull();
    }, 15_000);

    it('truncates output at the cap and flags it', async () => {
        const result = await run_enveloped({
            argv: [NODE, '-e', 'process.stdout.write("x".repeat(10000));'],
            cwd: process.cwd(),
            timeout_ms: 10_000,
            max_output_bytes: 1024,
        });
        expect(result.stdout_truncated).toBe(true);
        expect(Buffer.byteLength(result.stdout, 'utf8')).toBeLessThanOrEqual(1024);
    });

    it('passes argv literally — no shell interpolation', async () => {
        const hostile = '$(touch /tmp/pwned); `echo hi`; && || > file';
        const result = await run_enveloped({
            argv: [NODE, '-e', 'console.log(process.argv[1]);', hostile],
            cwd: process.cwd(),
            timeout_ms: 10_000,
            max_output_bytes: 64 * 1024,
        });
        expect(result.exit_code).toBe(0);
        // The hostile string arrives verbatim as one argv element.
        expect(result.stdout.trim()).toBe(hostile);
    });

    it('rejects an empty argv', () => {
        expect(() =>
            run_enveloped({
                argv: [],
                cwd: process.cwd(),
                timeout_ms: 1000,
                max_output_bytes: 1024,
            }),
        ).toThrow(/argv must not be empty/);
    });
});

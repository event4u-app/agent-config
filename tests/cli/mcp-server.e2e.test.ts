/**
 * End-to-end smoke for `agent-config mcp-server` (road-to-mcp-stdio Phase 2,
 * the carve-out new-gate-verification).
 *
 * Spawns the compiled binary, drives a real MCP stdio handshake
 * (initialize → prompts/list → resources/list → tools/list), and asserts:
 *   1. valid JSON-RPC responses over stdio,
 *   2. the read-only surface (prompts + resources present, tools empty),
 *   3. **stdout purity** — every stdout line is JSON-RPC; the readiness note
 *      and all diagnostics land on stderr (the ADR-085 fatal-flaw guard).
 *
 * This is the "runs end-to-end over stdio with no repo knowledge" check:
 * the client speaks only the documented `mcp-server` command + stdin/stdout.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { execa } from 'execa';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const CLI = resolve(process.cwd(), 'dist/cli/agent-config.js');

// Newline-delimited JSON-RPC requests fed on stdin; execa closes stdin after,
// which ends the server cleanly (exit 0).
const REQUESTS = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    { jsonrpc: '2.0', id: 2, method: 'prompts/list' },
    { jsonrpc: '2.0', id: 3, method: 'resources/list' },
    { jsonrpc: '2.0', id: 4, method: 'tools/list' },
    { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'memory_store' } },
]
    .map((r) => JSON.stringify(r))
    .join('\n') + '\n';

interface Result { stdout: string; stderr: string; exitCode: number | undefined }
let res: Result;

beforeAll(async () => {
    if (!existsSync(CLI)) return; // guarded by the first test
    const r = await execa('node', [CLI, 'mcp-server'], {
        input: REQUESTS,
        reject: false,
        timeout: 30_000,
    });
    res = { stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode };
}, 40_000);

function responses(): Record<string, unknown>[] {
    return res.stdout
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((l) => JSON.parse(l) as Record<string, unknown>);
}

describe('agent-config mcp-server (stdio e2e)', () => {
    it('the build artefact exists', () => {
        expect(existsSync(CLI)).toBe(true);
    });

    it('exits cleanly when stdin closes', () => {
        expect(res.exitCode).toBe(0);
    });

    it('stdout is PURE JSON-RPC — every non-empty line parses (ADR-085 guard)', () => {
        const lines = res.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
        expect(lines.length).toBe(5);
        for (const l of lines) {
            expect(l[0]).toBe('{');
            expect(() => JSON.parse(l)).not.toThrow();
        }
    });

    it('the readiness note + diagnostics go to stderr, never stdout', () => {
        expect(res.stderr).toContain('[mcp-server]');
        expect(res.stdout).not.toContain('[mcp-server]');
    });

    it('initialize returns serverInfo + protocolVersion', () => {
        const init = responses().find((r) => r.id === 1)!;
        const result = init.result as { serverInfo: { name: string }; protocolVersion: string };
        expect(result.serverInfo.name).toBe('agent-config-mcp');
        expect(typeof result.protocolVersion).toBe('string');
    });

    it('prompts/list returns wire-named prompts', () => {
        const list = responses().find((r) => r.id === 2)!;
        const prompts = (list.result as { prompts: { name: string }[] }).prompts;
        expect(prompts.length).toBeGreaterThan(0);
        expect(prompts.every((p) => p.name.startsWith('skill.') || p.name.startsWith('command.'))).toBe(true);
    });

    it('resources/list returns rule/guideline uris', () => {
        const list = responses().find((r) => r.id === 3)!;
        const resources = (list.result as { resources: { uri: string }[] }).resources;
        expect(resources.length).toBeGreaterThan(0);
        expect(resources.every((r) => r.uri.startsWith('rule://') || r.uri.startsWith('guideline://'))).toBe(true);
    });

    it('tools/list is empty + tools/call is not_implemented (read-only)', () => {
        const tools = responses().find((r) => r.id === 4)!;
        expect((tools.result as { tools: unknown[] }).tools).toEqual([]);
        const call = responses().find((r) => r.id === 5)!;
        const data = (call.error as { data: { code: string } }).data;
        expect(data.code).toBe('not_implemented');
    });
});

/**
 * Client-compatibility falsification spike — Leg A (Phase 3 of
 * road-to-credible-install § MCP hygiene).
 *
 * Question: does the FULL local stdio server's prompt/resource surface
 * actually get consumed the way an MCP client consumes it — a real
 * `initialize` handshake, `prompts/list` returning entries, `prompts/get`
 * on a real name returning content, `resources/list` returning entries,
 * `resources/read` on a real uri returning content — over the SAME wire
 * transport (newline-delimited JSON-RPC over stdio) a client speaks?
 *
 * This is the MACHINE-CHECKABLE half of "does the surface get consumed".
 * It proves the wire contract is real and reachable; it does NOT prove any
 * specific MCP client (Claude Desktop, Zed, Continue, …) actually drives it
 * correctly in a live session — that interpretive half is a manual
 * per-client smoke, not something a CI process can assert.
 *
 * Re-run: `npx vitest run tests/contracts/mcp_client_compat_stdio.test.ts`
 * (spawns `dist/mcp/server.mjs` when built — `npm run build:mcp-bundle` —
 * falling back to `tsx src/scripts/mcp_server/__main__.ts` otherwise, so the
 * spike stays runnable without a build step).
 *
 * Targets the FULL local kernel server (`scripts/mcp_server/`, bundled as
 * `dist/mcp/server.mjs` / invoked via `agent-config mcp:run`) — NOT the
 * turnkey read-only `agent-config mcp-server` CLI command
 * (`src/cli/commands/mcpServer.ts`), which serves prompts + resources only
 * (tools/list is always empty there by design). See docs/mcp-client-compat.md.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execa } from 'execa';
import { beforeAll, describe, expect, it } from 'vitest';

import { REPO_ROOT } from '../scripts/_mcp_server.js';
import { load_all_prompts, to_mcp_prompt_meta } from '../../src/scripts/mcp_server/prompts.js';
import { load_all_resources } from '../../src/scripts/mcp_server/resources.js';

const BUNDLE = resolve(REPO_ROOT, 'dist/mcp/server.mjs');
const ENTRY = resolve(REPO_ROOT, 'src/scripts/mcp_server/__main__.ts');
const TSX_BIN = resolve(REPO_ROOT, 'node_modules/.bin/tsx');

// Pick a real target name/uri from the SAME loaders the server itself
// drives its caches from — not a guess, the actual current content.
const [prompts] = load_all_prompts(REPO_ROOT);
const [resources] = load_all_resources(REPO_ROOT);
const TARGET_PROMPT = prompts.length > 0 ? (to_mcp_prompt_meta(prompts[0]!).name as string) : null;
const TARGET_RESOURCE_URI = resources.length > 0 ? resources[0]!.uri : null;

const REQUESTS = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'client-compat-probe', version: '0' } } },
    { jsonrpc: '2.0', id: 2, method: 'prompts/list' },
    { jsonrpc: '2.0', id: 3, method: 'prompts/get', params: { name: TARGET_PROMPT } },
    { jsonrpc: '2.0', id: 4, method: 'resources/list' },
    { jsonrpc: '2.0', id: 5, method: 'resources/read', params: { uri: TARGET_RESOURCE_URI } },
]
    .map((r) => JSON.stringify(r))
    .join('\n') + '\n';

interface Result {
    stdout: string;
    stderr: string;
    exitCode: number | undefined;
    ranBundle: boolean;
}
let res: Result;

beforeAll(async () => {
    if (TARGET_PROMPT === null) {
        throw new Error('leg A: no prompts found under dist/agent-src — cannot pick a prompts/get target');
    }
    if (TARGET_RESOURCE_URI === null) {
        throw new Error('leg A: no resources found under dist/agent-src — cannot pick a resources/read target');
    }

    const useBundle = existsSync(BUNDLE);
    const [cmd, args] = useBundle ? ['node', [BUNDLE]] : [TSX_BIN, [ENTRY]];
    const r = await execa(cmd, args, {
        input: REQUESTS,
        reject: false,
        timeout: 30_000,
    });
    res = { stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode, ranBundle: useBundle };
}, 40_000);

function responses(): Record<string, unknown>[] {
    return res.stdout
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((l) => JSON.parse(l) as Record<string, unknown>);
}

describe('mcp client-compat — leg A: stdio prompts/resources are actually consumable', () => {
    it('exits cleanly when stdin closes', () => {
        expect(res.exitCode).toBe(0);
    });

    it('stdout is pure JSON-RPC — every non-empty line parses (ADR-085 guard)', () => {
        const lines = res.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
        expect(lines.length).toBe(5);
        for (const l of lines) {
            expect(l[0]).toBe('{');
            expect(() => JSON.parse(l)).not.toThrow();
        }
    });

    it('initialize returns a real serverInfo + protocolVersion', () => {
        const init = responses().find((r) => r.id === 1)!;
        const result = init.result as { serverInfo: { name: string }; protocolVersion: string };
        // Full local kernel server identity (`index.ts` SERVER_NAME) — distinct
        // from the turnkey `agent-config mcp-server` CLI's "agent-config-mcp".
        expect(result.serverInfo.name).toBe('agent-config');
        expect(typeof result.protocolVersion).toBe('string');
    });

    it('prompts/list returns > 0 wire-named prompts', () => {
        const list = responses().find((r) => r.id === 2)!;
        const promptsOut = (list.result as { prompts: { name: string }[] }).prompts;
        expect(promptsOut.length).toBeGreaterThan(0);
        expect(promptsOut.every((p) => p.name.startsWith('skill.') || p.name.startsWith('command.'))).toBe(true);
    });

    it('prompts/get on the first listed prompt returns real content', () => {
        const get = responses().find((r) => r.id === 3)!;
        expect(get.error).toBeUndefined();
        const result = get.result as { messages: { content: { text: string } }[] };
        expect(result.messages.length).toBeGreaterThan(0);
        expect(result.messages[0]!.content.text.trim().length).toBeGreaterThan(0);
    });

    it('resources/list returns > 0 rule/guideline/context uris', () => {
        const list = responses().find((r) => r.id === 4)!;
        const resourcesOut = (list.result as { resources: { uri: string }[] }).resources;
        expect(resourcesOut.length).toBeGreaterThan(0);
        expect(
            resourcesOut.every(
                (r) => r.uri.startsWith('rule://') || r.uri.startsWith('guideline://') || r.uri.startsWith('context://'),
            ),
        ).toBe(true);
    });

    it('resources/read on the first listed resource returns real content', () => {
        const read = responses().find((r) => r.id === 5)!;
        expect(read.error).toBeUndefined();
        const result = read.result as { contents: { text: string }[] };
        expect(result.contents.length).toBeGreaterThan(0);
        expect(result.contents[0]!.text.trim().length).toBeGreaterThan(0);
    });
});

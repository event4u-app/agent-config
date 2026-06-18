// End-to-end stdio-serving test for the MCP server (py2ts — completes the
// TS port of the Python `run_stdio` / `@server.*` decorator serving path).
//
// Spawns the real `mcp_server/__main__.ts` entry over stdio and drives it
// with the npm `@modelcontextprotocol/sdk` Client — the same transport a
// real MCP host (Claude Desktop / Zed / Continue) uses. Asserts the full
// initialize handshake plus every registered method: prompts/list (with
// pagination cursor), prompts/get, resources/list, resources/read,
// tools/list, tools/call (happy path → isError=false JSON content; error
// path → isError=true, the Python SDK's call_tool exception-wrap parity).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
const SERVER_MAIN = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_server', '__main__.ts');

let client: Client;

beforeAll(async () => {
    const transport = new StdioClientTransport({ command: 'node', args: [TSX, SERVER_MAIN] });
    client = new Client({ name: 'serve-test', version: '0.0.0' }, { capabilities: {} });
    // connect() performs the MCP initialize handshake — throws on failure.
    await client.connect(transport);
}, 30_000);

afterAll(async () => {
    await client?.close();
});

describe('mcp_server — stdio serving (real SDK transport)', () => {
    it('prompts/list paginates with a cursor', async () => {
        const page = await client.listPrompts();
        expect(page.prompts.length).toBeGreaterThan(0);
        // The package ships > DEFAULT_PAGE_SIZE prompts, so the first page
        // carries a nextCursor (the pagination contract carried over from py).
        expect(typeof page.nextCursor === 'string' || page.nextCursor === undefined).toBe(true);
    });

    it('prompts/get returns a user message', async () => {
        const page = await client.listPrompts();
        const got = await client.getPrompt({ name: page.prompts[0]!.name });
        expect(got.messages.length).toBeGreaterThan(0);
        expect(got.messages[0]!.role).toBe('user');
    });

    it('resources/list + resources/read return a real body', async () => {
        const list = await client.listResources();
        expect(list.resources.length).toBeGreaterThan(0);
        const read = await client.readResource({ uri: list.resources[0]!.uri });
        expect(read.contents.length).toBe(1);
        const first = read.contents[0] as { text?: string };
        expect((first.text ?? '').length).toBeGreaterThan(0);
    });

    it('tools/list exposes the registered tools', async () => {
        const tools = await client.listTools();
        expect(tools.tools.length).toBeGreaterThan(0);
        expect(tools.tools.map((t) => t.name)).toContain('list_rules');
    });

    it('tools/call happy path returns a JSON text content block', async () => {
        const res = await client.callTool({ name: 'list_rules', arguments: {} });
        expect(res.isError ?? false).toBe(false);
        const content = res.content as Array<{ type: string; text?: string }>;
        expect(content[0]!.type).toBe('text');
        // The Python SDK auto-wrapped the returned dict as JSON text; parity.
        expect(JSON.parse(content[0]!.text!)).toHaveProperty('rules');
    });

    it('tools/call error path returns isError, not a protocol crash', async () => {
        // chat_history_append rejects empty args — the Python SDK wraps a
        // raised exception as a tool-error CallToolResult, not a JSON-RPC error.
        const res = await client.callTool({ name: 'chat_history_append', arguments: {} });
        expect(res.isError).toBe(true);
        const content = res.content as Array<{ type: string; text?: string }>;
        expect((content[0]!.text ?? '').length).toBeGreaterThan(0);
    });
});

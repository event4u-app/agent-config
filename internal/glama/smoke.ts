#!/usr/bin/env tsx
// Glama-parity smoke test for the stdio MCP server.
//
// TypeScript replacement for smoke.py. Boots the server exactly as glama does
// — `bash /app/internal/glama/run` — then asserts it speaks MCP: `initialize`
// succeeds and `prompts/list` returns at least one prompt. A zero-prompt result
// is the canonical content-root failure (a `.dockerignore` that dropped
// `dist/agent-src/`, or a build/run path bug).
//
// Runs INSIDE the container via `node node_modules/.bin/tsx
// /app/internal/glama/smoke.ts`. No Python venv needed.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
    command: 'bash',
    args: ['/app/internal/glama/run'],
});

const client = new Client({ name: 'glama-smoke', version: '0.0.0' }, { capabilities: {} });

try {
    await client.connect(transport);

    const init = client.getServerVersion();
    const promptsPage = await client.listPrompts();

    let resourceCount = 0;
    try {
        resourceCount = (await client.listResources()).resources.length;
    } catch {
        // resources are optional for the smoke verdict
    }

    console.log(`server:    ${init?.name ?? 'unknown'} v${init?.version ?? 'unknown'}`);
    console.log(`prompts:   ${promptsPage.prompts.length} (first page)`);
    console.log(`resources: ${resourceCount} (first page)`);

    if (promptsPage.prompts.length === 0) {
        console.log(
            'FAIL: prompts/list returned 0 — content root missing. ' +
                'Check .dockerignore kept dist/agent-src/ and that ' +
                'internal/glama/{build,run} resolve src/scripts/mcp_server.',
        );
        process.exit(1);
    }

    console.log('OK: MCP initialize + prompts/list succeeded');
    process.exit(0);
} catch (err) {
    console.error(`smoke: unexpected error — ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
} finally {
    await client.close().catch(() => undefined);
}

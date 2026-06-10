/**
 * `agent-config mcp-server` — the turnkey end-user stdio MCP server (ADR-085).
 *
 * Launches a read-only, pure-Node stdio-lite MCP server over the bundled
 * `dist/agent-src/` content. **No repo clone, no PYTHONPATH, no venv, no
 * module name** — the whole point of Phase 2: an end-user who installed
 * `@event4u/agent-config` (npm) configures their client to run
 * `agent-config mcp-server` and gets the governance content as MCP prompts +
 * resources.
 *
 * Read-only by design (execution deferred — ADR-085 § Phase-2 trigger).
 *
 * stdout is reserved for JSON-RPC; every diagnostic here goes to stderr.
 */

import { readFileSync } from 'node:fs';
import { PACKAGE_ROOT, PACKAGE_JSON } from '../paths.js';
import { loadContentTree } from '../mcp/content.js';
import { runStdioServer } from '../mcp/stdio.js';
import type { ServerIdentity } from '../mcp/dispatch.js';

const SERVER_NAME = 'agent-config-mcp';

function readVersion(): string {
    try {
        const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as { version?: unknown };
        return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
    } catch {
        return '0.0.0';
    }
}

/**
 * Boot the stdio server. Resolves when stdin closes (client disconnect).
 * Returns the intended process exit code.
 */
export async function runMcpServer(): Promise<number> {
    let tree;
    try {
        tree = loadContentTree(PACKAGE_ROOT);
    } catch (err) {
        process.stderr.write(`[mcp-server] failed to load content: ${(err as Error).message}\n`);
        return 1;
    }

    const count = Object.keys(tree.uris).length;
    if (count === 0) {
        process.stderr.write(
            '[mcp-server] no content found under dist/agent-src/ or docs/guidelines/ — ' +
                'is the package built? Refusing to serve an empty surface.\n',
        );
        return 1;
    }

    const identity: ServerIdentity = { name: SERVER_NAME, version: readVersion() };
    // Readiness note → stderr only (never stdout — that stream is JSON-RPC).
    process.stderr.write(
        `[mcp-server] ${SERVER_NAME} v${identity.version} ready — ${count} entries, read-only (stdio).\n`,
    );

    await runStdioServer(tree, identity);
    return 0;
}

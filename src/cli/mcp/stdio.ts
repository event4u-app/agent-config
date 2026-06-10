/**
 * stdio transport for the local MCP server (ADR-085, A2×B1).
 *
 * MCP stdio framing: newline-delimited JSON-RPC. Each inbound line is one
 * request; each response is one `JSON.stringify(...) + "\n"` on stdout.
 *
 * INVARIANT — stdout is PURE JSON-RPC. Nothing else is ever written to
 * stdout (no banners, no logs, no progress). Any diagnostic goes to stderr.
 * This is the whole reason ADR-085 chose pure-Node over a Node→Python shim:
 * a single stray stdout byte breaks the JSON-RPC stream for the client.
 *
 * Notifications (no `id`) receive no response, per JSON-RPC 2.0.
 */

import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import type { ContentTree } from './content.js';
import {
    dispatch,
    rpcError,
    RPC_PARSE_ERROR,
    RPC_INVALID_REQUEST,
    type JsonRpcRequest,
    type JsonRpcResponse,
    type ServerIdentity,
} from './dispatch.js';

export interface StdioOptions {
    input?: Readable;
    output?: Writable;
}

function isNotification(value: unknown): boolean {
    return typeof value === 'object' && value !== null && !('id' in value);
}

/**
 * Run the stdio server until `input` ends. Returns a promise that resolves on
 * stream close. `tree` + `identity` are captured once; each line dispatches
 * purely against them.
 */
export function runStdioServer(
    tree: ContentTree,
    identity: ServerIdentity,
    opts: StdioOptions = {},
): Promise<void> {
    const input = opts.input ?? process.stdin;
    const output = opts.output ?? process.stdout;

    const write = (resp: JsonRpcResponse): void => {
        output.write(`${JSON.stringify(resp)}\n`);
    };

    const rl = createInterface({ input, crlfDelay: Infinity });

    return new Promise<void>((resolveClose) => {
        rl.on('line', (line: string) => {
            const trimmed = line.trim();
            if (!trimmed) return; // blank keep-alive line — ignore

            let parsed: unknown;
            try {
                parsed = JSON.parse(trimmed);
            } catch {
                write(rpcError(null, RPC_PARSE_ERROR, 'Parse error'));
                return;
            }

            // Notifications get no response (JSON-RPC 2.0).
            if (isNotification(parsed)) return;

            if (
                typeof parsed !== 'object' ||
                parsed === null ||
                typeof (parsed as JsonRpcRequest).method !== 'string'
            ) {
                const id = (parsed as { id?: string | number | null }).id ?? null;
                write(rpcError(id, RPC_INVALID_REQUEST, 'Invalid Request'));
                return;
            }

            write(dispatch(tree, identity, parsed as JsonRpcRequest));
        });

        rl.on('close', () => {
            // Drain any buffered stdout before resolving — on macOS a pipe write
            // is async and resolving (→ process exit) too early truncates the
            // last responses. Resolve only once the write buffer is empty.
            if (output.writableLength === 0) {
                resolveClose();
            } else {
                output.once('drain', () => resolveClose());
            }
        });
    });
}

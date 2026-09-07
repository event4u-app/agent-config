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
 *
 * This shell is also where call telemetry is emitted (roadmap step 4.1):
 * `dispatch` is pure — no I/O, no clock — and stays that way, so the one row
 * per `tools/call` is written here, from the impure side, after the response
 * has been produced. The recorder is default-off and never throws; see
 * `./telemetry.js` for the gate and the closed host vocabulary.
 */

import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import type { ContentTree } from './content.js';
import {
    dispatch,
    isLiteTool,
    rpcError,
    RPC_PARSE_ERROR,
    RPC_INVALID_REQUEST,
    type JsonRpcRequest,
    type JsonRpcResponse,
    type ServerIdentity,
} from './dispatch.js';
import { HOST_UNKNOWN, normalizeHost, recordLiteCall } from './telemetry.js';

export interface StdioOptions {
    input?: Readable;
    output?: Writable;
    /**
     * Root the telemetry sink is resolved against. Defaults to the process CWD,
     * which is the consumer project the client launched the server in. Present
     * so a test can point the sink at a scratch directory without chdir.
     */
    consumerRoot?: string;
    /** Settings file the telemetry gate is read from. Defaults to `<cwd>/.agent-settings.yml`. */
    settingsPath?: string;
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

    // The client's own name, learned at `initialize` and resolved onto the
    // closed host vocabulary. A client that calls a tool before initializing
    // records `unknown` — which is the truth, not a guess.
    let host = HOST_UNKNOWN;

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

            const req = parsed as JsonRpcRequest;
            if (req.method === 'initialize') {
                const p = (req.params ?? {}) as Record<string, unknown>;
                const info = (p.clientInfo ?? {}) as Record<string, unknown>;
                host = normalizeHost(info.name);
            }

            write(dispatch(tree, identity, req));

            // Exactly one row per `tools/call` that named a tool. A call with
            // no `name` is a malformed request, not a call to a tool, and has
            // nothing to attribute a row to.
            if (req.method === 'tools/call') {
                const p = (req.params ?? {}) as Record<string, unknown>;
                const name = typeof p.name === 'string' ? p.name : '';
                recordLiteCall({
                    toolName: name,
                    isLiteTool: isLiteTool(name),
                    host,
                    consumerRoot: opts.consumerRoot,
                    settingsPath: opts.settingsPath,
                });
            }
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

#!/usr/bin/env node
// A stand-in `agent-switch` for the link tests. Behaviour is chosen by env:
//   FAKE_AS_LINK = on | off | contract2 | garbled | exit1   (default on)
//   FAKE_AS_MCP  = ok | broken                             (default ok)
//   FAKE_AS_LIMITS = <json>   the limits report, over MCP and over `limits --json`
//   FAKE_AS_SWITCH_FILE = <path>  a JSON switch request: `switch request` answers
//                       {request, created}, `switch show` answers it; a missing
//                       file makes both exit 1 (no candidate / unknown id)
//   FAKE_AS_LOG = <path>  every argv is appended to it as one JSON line
// `mcp serve` speaks line-delimited JSON-RPC like the real server; every other
// verb echoes its argv so a test can assert the CLI fallback's mapping.
import { appendFileSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const argv = process.argv.slice(2);
const link = process.env.FAKE_AS_LINK ?? 'on';
const mcp = process.env.FAKE_AS_MCP ?? 'ok';
const limits = process.env.FAKE_AS_LIMITS;
const switchFile = process.env.FAKE_AS_SWITCH_FILE;
if (process.env.FAKE_AS_LOG) appendFileSync(process.env.FAKE_AS_LOG, `${JSON.stringify(argv)}\n`);
const out = (v) => process.stdout.write(`${JSON.stringify(v)}\n`);

if (argv[0] === 'link' && argv[1] === 'status') {
    if (link === 'exit1') {
        process.stderr.write('boom\n');
        process.exit(1);
    }
    if (link === 'garbled') {
        process.stdout.write('not json\n');
        process.exit(0);
    }
    out({
        enabled: link !== 'off',
        version: '2.13.0',
        contract: link === 'contract2' ? 2 : 1,
        mcp: { command: 'agent-switch', args: ['mcp', 'serve'] },
    });
    process.exit(0);
}

if (argv[0] === 'mcp' && argv[1] === 'serve') {
    if (mcp === 'broken') process.exit(3);
    const rl = createInterface({ input: process.stdin });
    rl.on('line', (line) => {
        const msg = JSON.parse(line);
        if (msg.id === undefined) return;
        if (msg.method === 'initialize') {
            out({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                    protocolVersion: msg.params.protocolVersion,
                    capabilities: { tools: { listChanged: false } },
                    serverInfo: { name: 'agent-switch', version: '2.13.0' },
                },
            });
        } else if (msg.method === 'tools/call') {
            const { name, arguments: args } = msg.params;
            const result =
                name === 'switch_list'
                    ? [{ id: 'r1', via: 'mcp' }]
                    : name === 'limits_get' && limits !== undefined
                      ? JSON.parse(limits)
                      : { via: 'mcp', tool: name, args };
            out({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                    content: [{ type: 'text', text: JSON.stringify(result) }],
                    structuredContent: Array.isArray(result) ? { items: result } : result,
                    isError: name === 'limits_get' && args?.provider === 'antigravity',
                },
            });
        } else {
            out({ jsonrpc: '2.0', id: msg.id, result: {} });
        }
    });
} else if (argv[0] === 'limits' && limits !== undefined) {
    process.stdout.write(`${limits}\n`);
} else if (argv[0] === 'switch' && switchFile !== undefined && (argv[1] === 'request' || argv[1] === 'show')) {
    let req;
    try {
        req = JSON.parse(readFileSync(switchFile, 'utf-8'));
    } catch {
        process.stderr.write('no such request\n');
        process.exit(1);
    }
    out(argv[1] === 'request' ? { request: req, created: true } : req);
} else {
    out({ via: 'cli', argv });
}

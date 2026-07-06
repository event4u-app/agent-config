// CLI-contract test for src/scripts/mcp_parity_smoke.ts (ADR-094).
//
// The tsx twin is the source of truth (the python original was deleted in the
// teardown). The smoke script is itself a parity harness; here we assert its
// own wire contract against a Node mock Worker.
//
// Surfaces covered:
//   * argparse error paths (exit 2): no args, unknown flag, missing value,
//     stray positional.
//   * `--node-stdio` skip path (exit 0): the `dist/cli/agent-config.js` binary
//     is not built in CI, so the tool prints the skip note and "parity OK".
//   * `--target` HTTP drift path (exit 1): a local mock Worker returns empty
//     lists, so the tool emits the full drift diff against the REAL local loaders.
//
// The mock Worker runs in a SEPARATE Node process (blocking spawnSync in the
// tool run would starve an in-process server's event loop). It binds 127.0.0.1
// on an ephemeral port. `--help` asserts exit 0 only.
import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import * as net from 'node:net';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { REPO_ROOT } from './_mcp_server.js';

const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_parity_smoke.ts');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

interface RunResult {
    status: number;
    stdout: string;
    stderr: string;
}

function runTs(args: string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
        maxBuffer: 64 * 1024 * 1024,
    });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('mcp_parity_smoke — CLI contract (tsx twin)', () => {
    describe('argparse error paths (exit 2)', () => {
        it('no args → error', () => {
            expect(runTs([]).status).toBe(2);
        });
        it('unknown flag → error', () => {
            expect(runTs(['--bogus']).status).toBe(2);
        });
        it('--target with no value → error', () => {
            expect(runTs(['--target']).status).toBe(2);
        });
        it('stray positional → error', () => {
            expect(runTs(['extra']).status).toBe(2);
        });
    });

    describe('--node-stdio skip path (exit 0)', () => {
        it('bare flag resolves the default cli, exit 0 (skip or parity-OK)', () => {
            // dist/cli/agent-config.js may or may not be built; both the skip
            // path and the parity-OK path exit 0.
            expect(runTs(['--node-stdio']).status).toBe(0);
        });

        it('explicit (unbuilt) cli path also skips', () => {
            expect(runTs(['--node-stdio', '/tmp/agent-config-not-built.js']).status).toBe(0);
        });
    });

    describe('--target HTTP drift path (exit 1)', () => {
        let mock: ChildProcess;
        let target = '';

        // Mock Worker as a SEPARATE Node process: every JSON-RPC method returns
        // empty lists, so the local loaders (real repo data) diff as drift
        // against an empty remote — exercising the full drift branch.
        const MOCK_JS = [
            'const http = require("node:http");',
            'const port = Number(process.argv[1]);',
            'const body = JSON.stringify({ jsonrpc: "2.0", id: 1, result: { prompts: [], resources: [], tools: [] } });',
            'http.createServer((req, res) => {',
            '    req.on("data", () => {});',
            '    req.on("end", () => {',
            '        res.writeHead(200, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });',
            '        res.end(body);',
            '    });',
            '}).listen(port, "127.0.0.1");',
        ].join('\n');

        async function freePort(): Promise<number> {
            return new Promise<number>((resolve, reject) => {
                const srv = net.createServer();
                srv.once('error', reject);
                srv.listen(0, '127.0.0.1', () => {
                    const addr = srv.address();
                    if (addr === null || typeof addr === 'string') {
                        reject(new Error('no TCP port'));
                        return;
                    }
                    const { port } = addr;
                    srv.close(() => resolve(port));
                });
            });
        }

        async function waitListening(port: number, deadlineMs = 5000): Promise<void> {
            const start = Date.now();
            for (;;) {
                const ok = await new Promise<boolean>((resolve) => {
                    const sock = net.connect(port, '127.0.0.1');
                    sock.once('connect', () => {
                        sock.destroy();
                        resolve(true);
                    });
                    sock.once('error', () => resolve(false));
                });
                if (ok) return;
                if (Date.now() - start > deadlineMs) {
                    throw new Error('mock worker did not start listening in time');
                }
                await new Promise((r) => setTimeout(r, 50));
            }
        }

        beforeAll(async () => {
            const port = await freePort();
            mock = spawn(process.execPath, ['-e', MOCK_JS, String(port)], { stdio: 'ignore' });
            await waitListening(port);
            target = `http://127.0.0.1:${port}`;
        });

        afterAll(() => {
            mock.kill('SIGKILL');
        });

        it('full drift diff against an empty mock Worker (exit 1)', () => {
            const ts = runTs(['--target', target]);
            expect(ts.status).toBe(1);
            expect(ts.stdout).toContain('❌  prompts/list: drift');
            expect(ts.stdout).toContain('surface(s) drifted');
        });
    });

    describe('--help', () => {
        it('exits 0', () => {
            expect(runTs(['--help']).status).toBe(0);
        });
    });
});

// Golden-parity test for src/scripts/mcp_parity_smoke.{py,ts} (ADR-094).
//
// Runs the Python original and the TS twin via subprocess with IDENTICAL args
// and asserts byte-identical stdout + stderr + exit code. The smoke script is
// itself a parity harness, so its own output is a hard wire contract.
//
// Surfaces covered:
//   * argparse error paths (exit 2): no args, unknown flag, missing value,
//     stray positional — the usage line + `prog: error: …` text is byte-exact.
//   * `--node-stdio` skip path (exit 0): the `dist/cli/agent-config.js` binary
//     is not built in CI, so both legs print the ⏭️ skip note and "parity OK".
//   * `--target` HTTP drift path (exit 1): a local mock Worker returns empty
//     lists, so both legs emit the full ❌ drift diff against the REAL local
//     loaders — exercising _normalize_*, the json.dumps(sort_keys=True) keying
//     (default separators + ensure_ascii), code-point sorting, and the
//     `(+N local, +N remote more)` overflow line.
//
// Determinism notes:
//   * `prog` is pinned to `mcp_parity_smoke.py` in BOTH twins, so the usage /
//     error banner is identical regardless of the .ts launcher path.
//   * `--node-stdio` with no value resolves DEFAULT_NODE_CLI from the script
//     dir in both runtimes → the same absolute path in the skip note.
//   * The HTTP leg's mock Worker runs in a SEPARATE process (an inline python3
//     http.server) — never in-process: `spawnSync` blocks the Node event loop,
//     so an in-process mock would never accept the connection. It binds
//     127.0.0.1 on an ephemeral port handed to BOTH legs, so the trailing
//     `against <target>` line matches.
//   * `--help` is intentionally NOT a byte-parity contract: argparse's banner
//     is Python-version-dependent (3.9 "optional arguments:" vs ≥3.10
//     "options:") and width-wrapped. We assert only that both exit 0.
import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import * as net from 'node:net';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { REPO_ROOT, hasPython3 } from './_mcp_server.js';

const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_parity_smoke.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_parity_smoke.ts');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

interface RunResult {
    status: number;
    stdout: string;
    stderr: string;
}

// The Python script does `sys.path.insert(0, <scripts dir>)` then imports the
// `mcp_server` package — so PYTHONPATH must carry src/scripts (not src/).
const PY_ENV = { ...process.env, PYTHONPATH: path.join(REPO_ROOT, 'src', 'scripts') };

function runPy(args: string[]): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
        env: PY_ENV,
        maxBuffer: 64 * 1024 * 1024,
    });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
        maxBuffer: 64 * 1024 * 1024,
    });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Assert byte-identical stdout + stderr + exit code across the two twins. */
function expectParity(args: string[]): void {
    const py = runPy(args);
    const ts = runTs(args);
    expect(ts.stdout).toBe(py.stdout);
    expect(ts.stderr).toBe(py.stderr);
    expect(ts.status).toBe(py.status);
}

const py3 = hasPython3();
const describeMaybe = py3 ? describe : describe.skip;

describeMaybe('mcp_parity_smoke parity (py ↔ ts)', () => {
    describe('argparse error paths (exit 2)', () => {
        it('no args → "at least one of --target or --node-stdio is required"', () => {
            const py = runPy([]);
            expect(py.status).toBe(2);
            expectParity([]);
        });

        it('unknown flag → "unrecognized arguments: --bogus"', () => {
            expectParity(['--bogus']);
        });

        it('--target with no value → "expected one argument"', () => {
            expectParity(['--target']);
        });

        it('stray positional → "unrecognized arguments: extra"', () => {
            expectParity(['extra']);
        });
    });

    describe('--node-stdio skip path (exit 0)', () => {
        it('bare flag resolves the default cli, prints the ⏭️ skip note', () => {
            const py = runPy(['--node-stdio']);
            // dist/cli/agent-config.js is not built in CI → skip path, exit 0.
            expect(py.status).toBe(0);
            expect(py.stdout).toContain('not built');
            expectParity(['--node-stdio']);
        });

        it('explicit (unbuilt) cli path also skips identically', () => {
            expectParity(['--node-stdio', '/tmp/agent-config-not-built.js']);
        });
    });

    describe('--target HTTP drift path (exit 1)', () => {
        let mock: ChildProcess;
        let target = '';

        // Mock Worker as a SEPARATE process: every JSON-RPC method returns empty
        // lists, so the local loaders (real repo data) diff as drift against an
        // empty remote — exercising the full ❌ diff branch deterministically.
        // It must be out-of-process because the parity runs use blocking
        // spawnSync, which would starve an in-process server's event loop.
        const MOCK_PY = [
            'import http.server, json, socketserver, sys',
            'class H(http.server.BaseHTTPRequestHandler):',
            '    def log_message(self, *a): pass',
            '    def do_POST(self):',
            '        n = int(self.headers.get("content-length", 0)); self.rfile.read(n)',
            '        body = json.dumps({"jsonrpc": "2.0", "id": 1, "result": {"prompts": [], "resources": [], "tools": []}}).encode()',
            '        self.send_response(200)',
            '        self.send_header("content-type", "application/json")',
            '        self.send_header("content-length", str(len(body)))',
            '        self.end_headers(); self.wfile.write(body)',
            'port = int(sys.argv[1])',
            'with socketserver.TCPServer(("127.0.0.1", port), H) as s:',
            '    s.serve_forever()',
        ].join('\n');

        /** Grab a free TCP port by binding :0 and reading the assignment. */
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

        /** Poll until the mock accepts a connection (server boot is async). */
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
            mock = spawn('python3', ['-c', MOCK_PY, String(port)], { stdio: 'ignore' });
            await waitListening(port);
            target = `http://127.0.0.1:${port}`;
        });

        afterAll(() => {
            mock.kill('SIGKILL');
        });

        it('full drift diff against an empty mock Worker is byte-identical', () => {
            const py = runPy(['--target', target]);
            expect(py.status).toBe(1);
            // Sanity: the drift branch actually fired.
            expect(py.stdout).toContain('❌  prompts/list: drift');
            expect(py.stdout).toContain('surface(s) drifted');
            expectParity(['--target', target]);
        });
    });

    describe('--help', () => {
        it('exits 0 on both (argparse banner is not a byte-parity contract)', () => {
            // Python-version-dependent label + width-wrapped docstring; assert
            // only the stable surface, matching the convention in the sibling
            // check_condensation parity test.
            expect(runPy(['--help']).status).toBe(0);
            expect(runTs(['--help']).status).toBe(0);
        });
    });
});

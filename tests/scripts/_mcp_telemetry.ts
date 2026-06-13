// Shared golden-parity harness for the mcp_telemetry_* twins (py2ts).
//
// Committed helper (never an untracked import). The three telemetry CLIs
// (store / query / health) all take `--consumer-root <dir>` and emit that
// resolved root inside their output, so a py run and a tsx run cannot share
// a root (the store would clobber the other's DB). Each runner gets its own
// temp root; `normalizeRoot` rewrites the realpath'd root to a stable token
// so the two outputs are byte-comparable.
//
// node:sqlite gating: store + query need Node's built-in SQLite module
// (`node:sqlite`, stable from Node 22.5). `@types/node@20` ships no typings
// and Node 20 has no module, so the sqlite-touching golden suites are
// `skipIf(!hasNodeSqlite())` — mirroring the `hasPython3` skipIf precedent.
// health needs no sqlite and always runs.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

export const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

export interface RunResult {
    status: number;
    stdout: string;
    stderr: string;
}

/** python3 with the mcp_server package importable on PYTHONPATH=src/. */
export function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/** Whether Node's built-in `node:sqlite` module loads in this runtime. */
export function hasNodeSqlite(): boolean {
    const probe = spawnSync(
        process.execPath,
        ['-e', "try{require('node:sqlite');process.exit(0)}catch{process.exit(1)}"],
        { encoding: 'utf8' },
    );
    return probe.status === 0;
}

/** Run the Python original with `src/` on PYTHONPATH (for mcp_server.*). */
export function runPy(script: string, args: string[]): RunResult {
    const env = { ...process.env, PYTHONPATH: path.join(REPO_ROOT, 'src') };
    const r = spawnSync('python3', [script, ...args], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
        env,
        maxBuffer: 64 * 1024 * 1024,
    });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Run the TS twin via tsx. */
export function runTs(script: string, args: string[]): RunResult {
    const r = spawnSync(TSX_BIN, [script, ...args], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
        maxBuffer: 64 * 1024 * 1024,
    });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Fresh temp consumer-root; caller cleans up. */
export function makeRoot(prefix = 'mcp-tel-'): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Write the per-consumer JSONL sink under a consumer root. */
export function writeSink(root: string, lines: string[]): void {
    const dir = path.join(root, 'agents', 'runtime', 'mcp-telemetry');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'calls.jsonl'), lines.join('\n') + (lines.length > 0 ? '\n' : ''), 'utf-8');
}

/**
 * Rewrite a runner's realpath'd consumer root to a stable token so a py
 * run (under one root) and a tsx run (under another) compare byte-for-byte.
 * Both `root` and its realpath are normalized (macOS `/var` → `/private/var`).
 */
export function normalizeRoot(text: string, root: string): string {
    let out = text;
    let real = root;
    try {
        real = fs.realpathSync(root);
    } catch {
        /* root may already be gone */
    }
    for (const r of new Set([real, root])) {
        out = out.split(r).join('<ROOT>');
    }
    return out;
}

/** Deterministic 4-record fixture exercising implemented / stub / latent. */
export const FIXTURE_LINES: readonly string[] = [
    '{"tool_name":"audit_mcp_tools","client_id_hash":"aaa111","ts":"2026-06-13T10:00:00Z","transport":"stdio","outcome":"implemented"}',
    '{"tool_name":"audit_mcp_tools","client_id_hash":"bbb222","ts":"2026-06-13T11:00:00Z","transport":"worker","outcome":"stub"}',
    '{"tool_name":"made_up_tool","client_id_hash":"aaa111","ts":"2026-06-13T12:00:00Z","transport":"stdio","outcome":"latent_demand"}',
    'this line is not valid json',
    '{"tool_name":"made_up_tool","client_id_hash":"ccc333","ts":"2026-06-13T09:00:00Z","transport":"worker","outcome":"latent_demand"}',
];

// Tests for src/scripts/memory_status.ts — backend detection.
//
// 1:1 port of tests/test_memory_status.py (pytest → vitest, ADR-092 parity
// contract). The pytest suite monkeypatches `_find_cli`, `_CACHE_FILE`, and
// `_HEALTH_TIMEOUT_SECONDS` on the module; the TS twin exposes the same
// override surface via setter seams (ESM `export let` is read-only to
// importers). A trailing golden-parity block runs python3 + tsx on the
// real (absent) probe and asserts byte-identical output, skipped without
// python3.
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as ms from '../../src/scripts/memory_status.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'memory_status.ts');
const PY_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'memory_status.py');

function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = pythonAvailable();

let tmp: string;

// autouse fixture analog: clean cache (env + file) + raised timeout.
beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'memstat-'));
    delete process.env[ms._CACHE_ENV];
    ms._setCacheFile(join(tmp, '.agent-memory', 'status.cache'));
    ms._setHealthTimeout(30.0);
});
afterEach(() => {
    ms._setFindCli(null);
    ms._setHealthTimeout(2.0);
    delete process.env[ms._CACHE_ENV];
    rmSync(tmp, { recursive: true, force: true });
});

/** Create an executable fake CLI emitting the given health output. */
function fakeHealthCli(stdout: string, stderr = '', exitCode = 0): string {
    const fake = join(tmp, 'agent-memory');
    let body = '#!/bin/sh\n';
    if (stderr) {
        body += `printf '%s\\n' ${JSON.stringify(stderr)} >&2\n`;
    }
    if (stdout) {
        body += `cat <<'EOF'\n${stdout}\nEOF\n`;
    }
    body += `exit ${exitCode}\n`;
    writeFileSync(fake, body);
    chmodSync(fake, 0o755);
    return fake;
}

describe('memory_status.ts — status()', () => {
    it('absent when no cli', () => {
        ms._setFindCli(() => '');
        const r = ms.status(true);
        expect(r.status).toBe('absent');
        expect(r.backend).toBe('file');
    });

    it('present when cli healthy', () => {
        const fake = join(tmp, 'agent-memory');
        writeFileSync(fake, '#!/bin/sh\nexit 0\n');
        chmodSync(fake, 0o755);
        ms._setFindCli(() => fake);
        const r = ms.status(true);
        expect(r.status).toBe('present');
        expect(r.backend).toBe('package');
        expect(r.cli_path).toBe(fake);
    });

    it('misconfigured when health fails', () => {
        const fake = join(tmp, 'agent-memory');
        writeFileSync(fake, "#!/bin/sh\necho 'DB down' >&2\nexit 3\n");
        chmodSync(fake, 0o755);
        ms._setFindCli(() => fake);
        const r = ms.status(true);
        expect(r.status).toBe('misconfigured');
        expect(r.backend).toBe('file');
        expect(r.reason).toContain('health()');
    });

    it('cache hit via env', () => {
        const payload = JSON.stringify({
            status: 'present',
            backend: 'package',
            reason: 'ok',
            elapsed_ms: 42,
            cli_path: '/x',
        });
        process.env[ms._CACHE_ENV] = payload;
        // A failing finder would surface if cache were ignored.
        ms._setFindCli(() => '');
        const r = ms.status(false);
        expect(r.status).toBe('present');
        expect(r.elapsed_ms, 'cache hits must report 0ms elapsed').toBe(0);
    });

    it('refresh bypasses cache', () => {
        process.env[ms._CACHE_ENV] = JSON.stringify({
            status: 'present',
            backend: 'package',
            reason: 'stale',
            elapsed_ms: 1,
            cli_path: '/x',
        });
        ms._setFindCli(() => '');
        const r = ms.status(true);
        expect(r.status, 'refresh=true must re-probe').toBe('absent');
    });

    // --- health envelope parsing -----------------------------------------

    it('parse health envelope clean json', () => {
        const payload = JSON.stringify({
            contract_version: 1,
            status: 'ok',
            backend_version: '0.1.0',
            features: ['a', 'b'],
        });
        const env = ms._parse_health_envelope(payload);
        expect(env).not.toBeNull();
        expect((env as Record<string, unknown>)['backend_version']).toBe('0.1.0');
    });

    it('parse health envelope skips log pollution', () => {
        const body = [
            '{"level":30,"msg":"connecting"}',
            JSON.stringify({ contract_version: 1, status: 'ok', backend_version: '0.1.0', features: [] }),
            '{"level":30,"msg":"disconnected"}',
        ].join('\n');
        const env = ms._parse_health_envelope(body);
        expect(env).not.toBeNull();
        expect((env as Record<string, unknown>)['contract_version']).toBe(1);
        expect((env as Record<string, unknown>)['backend_version']).toBe('0.1.0');
    });

    it('parse health envelope empty', () => {
        expect(ms._parse_health_envelope('')).toBeNull();
        expect(ms._parse_health_envelope('   \n  ')).toBeNull();
    });

    it('parse health envelope no envelope in logs', () => {
        const body = ['{"level":30,"msg":"hi"}', '{"level":30,"msg":"bye"}'].join('\n');
        expect(ms._parse_health_envelope(body)).toBeNull();
    });

    it('status present populates backend_version and features', () => {
        const fake = fakeHealthCli(
            JSON.stringify({ contract_version: 1, status: 'ok', backend_version: '1.2.3', features: ['trust-scoring', 'decay'] }),
        );
        ms._setFindCli(() => fake);
        const r = ms.status(true);
        expect(r.status).toBe('present');
        expect(r.backend_version).toBe('1.2.3');
        expect([...r.features]).toEqual(['trust-scoring', 'decay']);
    });

    it('status present tolerates old cli without envelope', () => {
        const fake = fakeHealthCli('');
        ms._setFindCli(() => fake);
        const r = ms.status(true);
        expect(r.status).toBe('present');
        expect(r.backend_version).toBe('');
        expect([...r.features]).toEqual([]);
    });

    it('health v1 uses real features when present', () => {
        const fake = fakeHealthCli(
            JSON.stringify({ contract_version: 1, status: 'ok', backend_version: '0.1.0', features: ['trust-scoring', 'quarantine'] }),
        );
        ms._setFindCli(() => fake);
        const env = ms.health(true);
        expect(env['status']).toBe('ok');
        expect(env['backend_version']).toBe('0.1.0');
        expect(env['features']).toEqual(['trust-scoring', 'quarantine']);
        expect((env['features'] as string[]).includes('file-fallback')).toBe(false);
    });

    it('health v1 falls back to file when absent', () => {
        ms._setFindCli(() => '');
        const env = ms.health(true);
        expect(env['status']).toBe('ok'); // absent maps to ok per contract
        expect(env['backend_version']).toBe(ms._FILE_BACKEND_VERSION);
        expect((env['features'] as string[]).includes('file-fallback')).toBe(true);
    });
});

// --- golden parity vs python3 --------------------------------------------

describe.skipIf(!HAVE_PYTHON)('memory_status — golden parity', () => {
    let goldenTmp: string;
    let emptyPathDir: string;
    beforeEach(() => {
        goldenTmp = mkdtempSync(join(tmpdir(), 'memstat-gold-'));
        // A PATH dir with node + python3 symlinks but NO `memory`-family CLI,
        // so both implementations resolve the deterministic `absent` probe.
        emptyPathDir = mkdtempSync(join(tmpdir(), 'memstat-path-'));
        const nodeBin = process.execPath;
        // Resolve python3 without a shell (avoids the shell-args deprecation).
        const py = spawnSync('which', ['python3'], { encoding: 'utf8' }).stdout.trim();
        spawnSync('ln', ['-s', nodeBin, join(emptyPathDir, 'node')]);
        if (py) {
            spawnSync('ln', ['-s', py, join(emptyPathDir, 'python3')]);
        }
    });
    afterEach(() => {
        rmSync(goldenTmp, { recursive: true, force: true });
        rmSync(emptyPathDir, { recursive: true, force: true });
    });

    function envParity(args: readonly string[]): { ts: ReturnType<typeof spawnSync>; py: ReturnType<typeof spawnSync> } {
        const env = { HOME: process.env['HOME'] ?? '', PATH: emptyPathDir, AGENT_MEMORY_STATUS: '' };
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: goldenTmp, encoding: 'utf8', env });
        const py = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: goldenTmp, encoding: 'utf8', env });
        return { ts, py };
    }

    it('text output (absent) parity', () => {
        const { ts, py } = envParity(['--refresh']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('json output (absent) parity', () => {
        const { ts, py } = envParity(['--refresh', '--format', 'json']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('--health (absent) parity', () => {
        const { ts, py } = envParity(['--health', '--refresh']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('bad --format choice (exit 2) parity', () => {
        const { ts, py } = envParity(['--format', 'xml']);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
    });
});

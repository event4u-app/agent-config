/**
 * SSE-hardening tests for `POST /api/v1/wizard/apply` (real-apply path).
 *
 * road-to-wizard-sse-hardening — closes the verified test gap on the
 * install stream's FAILURE paths. The happy path + WIZARD_READY handshake
 * are covered elsewhere; this file pins the four edge cases the council
 * (claude-sonnet-4-5 + gpt-4o, 2026-05-27, analysis lens) flagged:
 *
 *   P0 — abort-on-disconnect kills the spawned child (no orphaned install.py).
 *   P0 — CSRF/auth rejection before any installer process spawns.
 *   P2 — malformed NDJSON does not tear the SSE stream down.
 *   P2 — installer exits 0 with no terminal frame → synthetic `done` emitted.
 *
 * Harness: the apply endpoint spawns `<packageRoot>/scripts/install.py`.
 * Each test overrides `packageRoot` to a temp dir holding a fake installer
 * whose behaviour the test fully controls, then drives a real listening
 * server with `fetch` (the only way to exercise the real
 * disconnect → reply.raw 'close' → AbortController → SIGTERM chain).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:net';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import type { FastifyInstance } from 'fastify';

import { createApp } from '../../src/server/app.js';

const TOKEN = 's'.repeat(64);

async function findFreePort(): Promise<number> {
    return await new Promise<number>((res, rej) => {
        const srv = createServer();
        srv.unref();
        srv.on('error', rej);
        srv.listen(0, '127.0.0.1', () => {
            const addr = srv.address();
            if (addr === null || typeof addr === 'string') {
                rej(new Error('no address'));
                return;
            }
            const port = addr.port;
            srv.close(() => res(port));
        });
    });
}

const delay = (ms: number): Promise<void> => new Promise<void>((r) => setTimeout(r, ms));

async function waitForFile(path: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (existsSync(path)) return;
        await delay(25);
    }
    throw new Error(`timeout waiting for ${path}`);
}

interface SseBoot {
    app: FastifyInstance;
    baseUrl: string;
    host: string;
    packageRoot: string;
    baseTmp: string;
    cleanup: () => Promise<void>;
}

/** Boot a real listening server whose apply endpoint spawns a fake installer. */
async function bootSseApp(): Promise<SseBoot> {
    const baseTmp = mkdtempSync(join(tmpdir(), 'agent-config-sse-'));
    const packageRoot = join(baseTmp, 'pkg');
    const writeRoot = join(baseTmp, 'write');
    const uiDir = join(baseTmp, 'ui');
    mkdirSync(join(packageRoot, 'src', 'scripts'), { recursive: true });
    mkdirSync(writeRoot, { recursive: true });
    mkdirSync(uiDir, { recursive: true });
    writeFileSync(join(uiDir, 'index.html'), '<!doctype html><html><body>ok</body></html>');

    const port = await findFreePort();
    const app = await createApp({
        writeRoot,
        projectRoot: writeRoot,
        uiDistDir: uiDir,
        token: TOKEN,
        expectedPort: port,
        logLevel: 'fatal',
        skipReplay: true,
        extendedSteps: true,
        packageRoot,
    });
    await app.listen({ host: '127.0.0.1', port });

    const cleanup = async (): Promise<void> => {
        await app.close();
        rmSync(baseTmp, { recursive: true, force: true });
    };

    return { app, baseUrl: `http://127.0.0.1:${port}`, host: `127.0.0.1:${port}`, packageRoot, baseTmp, cleanup };
}

/** Write the fake `scripts/install.py` body the apply endpoint will spawn. */
function writeInstaller(packageRoot: string, body: string): void {
    writeFileSync(join(packageRoot, 'src', 'scripts', 'install.py'), body, { mode: 0o755 });
}

function authHeaders(host: string): Record<string, string> {
    return { host, authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' };
}

/** Minimal valid installer-v1 apply payload (no `tools` → no writeSelectedTools side effect). */
const APPLY_BODY = JSON.stringify({ schema_version: 'installer-v1', ai_tools: ['claude'], configs: {} });

/** Drain an SSE response to completion, returning every parsed `data:` frame. */
async function collectFrames(body: ReadableStream<Uint8Array> | null): Promise<Array<Record<string, unknown>>> {
    if (body === null) throw new Error('response has no body');
    const frames: Array<Record<string, unknown>> = [];
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    const flush = (raw: string): void => {
        for (const line of raw.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '') continue;
            frames.push(JSON.parse(payload) as Record<string, unknown>);
        }
    };
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let sep = buf.indexOf('\n\n');
        while (sep !== -1) {
            flush(buf.slice(0, sep));
            buf = buf.slice(sep + 2);
            sep = buf.indexOf('\n\n');
        }
    }
    if (buf.trim() !== '') flush(buf);
    return frames;
}

describe('POST /api/v1/wizard/apply — P0 failure paths', () => {
    let boot: SseBoot;

    afterEach(async () => {
        if (boot) await boot.cleanup();
    });

    // Finding #24 — the abort handler exists so a browser that drops the SSE
    // connection mid-install does not leave an orphaned `install.py` child.
    // This test pins the full disconnect → reply.raw 'close' → AbortController
    // → child SIGTERM chain end-to-end.
    it('aborts the spawned installer (SIGTERM) when the client drops the connection', async () => {
        boot = await bootSseApp();
        const readyPath = join(boot.baseTmp, 'child-ready');
        const markerPath = join(boot.baseTmp, 'child-sigterm');
        // Fake installer: install a SIGTERM handler, signal readiness (atomic
        // write+rename so the poller never sees a half-written file), then
        // sleep without emitting any terminal NDJSON frame.
        writeInstaller(boot.packageRoot, [
            'import os, sys, signal, time',
            `READY = r"${readyPath}"`,
            `MARKER = r"${markerPath}"`,
            'def _on_term(signum, frame):',
            '    tmp = MARKER + ".tmp"',
            '    with open(tmp, "w") as f:',
            '        f.write("sigterm")',
            '    os.replace(tmp, MARKER)',
            '    sys.exit(0)',
            'signal.signal(signal.SIGTERM, _on_term)',
            'tmp = READY + ".tmp"',
            'with open(tmp, "w") as f:',
            '    f.write(str(os.getpid()))',
            'os.replace(tmp, READY)',
            'time.sleep(30)',
            '',
        ].join('\n'));

        const ac = new AbortController();
        const res = await fetch(`${boot.baseUrl}/api/v1/wizard/apply`, {
            method: 'POST',
            headers: { ...authHeaders(boot.host), accept: 'text/event-stream' },
            body: APPLY_BODY,
            signal: ac.signal,
        });
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('text/event-stream');

        // Wait until the child has spawned AND installed its SIGTERM handler.
        await waitForFile(readyPath, 6_000);
        const childPid = Number.parseInt(readFileSync(readyPath, 'utf8').trim(), 10);
        expect(Number.isInteger(childPid)).toBe(true);

        // Drop the connection — the server must propagate this to SIGTERM.
        ac.abort();

        // Primary evidence: the child's SIGTERM handler ran.
        await waitForFile(markerPath, 6_000);
        expect(existsSync(markerPath)).toBe(true);

        // Secondary evidence: the process is actually gone (grace for reaping).
        let gone = false;
        const deadline = Date.now() + 3_000;
        while (Date.now() < deadline) {
            try {
                process.kill(childPid, 0);
            } catch {
                gone = true;
                break;
            }
            await delay(25);
        }
        expect(gone).toBe(true);
    }, 20_000);

    // The loopback GUI substrate's security floor: a real-install POST without
    // a valid bearer token (the CSRF defence-in-depth gate) must be rejected
    // before any installer process is spawned.
    it('rejects an unauthenticated real-install POST before spawning the installer', async () => {
        boot = await bootSseApp();
        const spawnMarker = join(boot.baseTmp, 'spawned');
        // If this body ever runs, the marker proves a spawn happened.
        writeInstaller(boot.packageRoot, [
            'import os',
            `SPAWN = r"${spawnMarker}"`,
            'tmp = SPAWN + ".tmp"',
            'with open(tmp, "w") as f:',
            '    f.write("spawned")',
            'os.replace(tmp, SPAWN)',
            '',
        ].join('\n'));

        const res = await fetch(`${boot.baseUrl}/api/v1/wizard/apply`, {
            method: 'POST',
            // No Authorization header — the app-level bearer gate must reject.
            headers: { host: boot.host, 'content-type': 'application/json', accept: 'text/event-stream' },
            body: APPLY_BODY,
        });
        expect(res.status).toBe(401);
        expect(res.headers.get('content-type')).not.toContain('text/event-stream');

        // Give any (erroneously) spawned child time to write its marker.
        await delay(300);
        expect(existsSync(spawnMarker)).toBe(false);
    });
});

describe('POST /api/v1/wizard/apply — P2 stream robustness', () => {
    let boot: SseBoot;

    afterEach(async () => {
        if (boot) await boot.cleanup();
    });

    // A malformed NDJSON line from the installer must not tear the SSE stream
    // down: the valid frames around it still arrive and the stream terminates
    // cleanly.
    it('survives a malformed NDJSON line and still delivers the terminal frame', async () => {
        boot = await bootSseApp();
        writeInstaller(boot.packageRoot, [
            'import sys, json',
            'sys.stdout.write(json.dumps({"type":"file","file":"a.txt","status":"written","written":1,"total":2}) + "\\n")',
            'sys.stdout.flush()',
            'sys.stdout.write("THIS IS NOT JSON {oops\\n")',
            'sys.stdout.flush()',
            'sys.stdout.write(json.dumps({"type":"done"}) + "\\n")',
            'sys.stdout.flush()',
            '',
        ].join('\n'));

        const res = await fetch(`${boot.baseUrl}/api/v1/wizard/apply`, {
            method: 'POST',
            headers: { ...authHeaders(boot.host), accept: 'text/event-stream' },
            body: APPLY_BODY,
        });
        expect(res.status).toBe(200);
        const frames = await collectFrames(res.body);
        const types = frames.map((f) => f.type);
        // The malformed line was dropped, not surfaced — the valid progress and
        // done frames flank it, proving the stream did not tear down.
        expect(types).toContain('progress');
        expect(types).toContain('done');
        expect(types).not.toContain('error');
        expect(types.indexOf('progress')).toBeLessThan(types.indexOf('done'));
    });

    // When install.py exits 0 without a terminal `done`/`error` line, the
    // `sawTerminal` guard must emit a synthetic `done` so the SPA never hangs.
    it('emits a synthetic done frame when the installer exits 0 with no terminal frame', async () => {
        boot = await bootSseApp();
        writeInstaller(boot.packageRoot, [
            'import sys, json',
            'sys.stdout.write(json.dumps({"type":"file","file":"a.txt","status":"written","written":1,"total":2}) + "\\n")',
            'sys.stdout.flush()',
            'sys.exit(0)',
            '',
        ].join('\n'));

        const res = await fetch(`${boot.baseUrl}/api/v1/wizard/apply`, {
            method: 'POST',
            headers: { ...authHeaders(boot.host), accept: 'text/event-stream' },
            body: APPLY_BODY,
        });
        expect(res.status).toBe(200);
        const frames = await collectFrames(res.body);
        const doneFrames = frames.filter((f) => f.type === 'done');
        // The fake emitted no `done` NDJSON — the only done frame is synthetic.
        expect(doneFrames).toHaveLength(1);
        expect(frames.some((f) => f.type === 'progress')).toBe(true);
        const summary = doneFrames[0]?.summary as { written?: number; total?: number } | undefined;
        expect(summary).toBeDefined();
        expect(summary?.written).toBe(1);
        expect(summary?.total).toBe(2);
    });

    // The error-frame branch (Phase 2 Step 3 exit gate): a valid `{type:"error"}`
    // NDJSON line from the installer is mapped to a structured SSE error frame —
    // distinct from a malformed line, which is dropped silently.
    it('surfaces a structured error frame when the installer emits a valid error line', async () => {
        boot = await bootSseApp();
        writeInstaller(boot.packageRoot, [
            'import sys, json',
            'sys.stdout.write(json.dumps({"type":"error","code":"E_DISK","message":"disk full"}) + "\\n")',
            'sys.stdout.flush()',
            'sys.exit(1)',
            '',
        ].join('\n'));

        const res = await fetch(`${boot.baseUrl}/api/v1/wizard/apply`, {
            method: 'POST',
            headers: { ...authHeaders(boot.host), accept: 'text/event-stream' },
            body: APPLY_BODY,
        });
        expect(res.status).toBe(200);
        const frames = await collectFrames(res.body);
        const errorFrames = frames.filter((f) => f.type === 'error');
        // The installer emitted exactly one terminal error line → exactly one
        // error frame (the sawTerminal guard must NOT also synthesise one).
        expect(errorFrames).toHaveLength(1);
        expect(errorFrames[0]?.code).toBe('E_DISK');
        expect(errorFrames[0]?.message).toBe('disk full');
        expect(errorFrames[0]?.recoverable).toBe(false);
        expect(frames.some((f) => f.type === 'done')).toBe(false);
    });
});

describe('POST /api/v1/wizard/apply — spawn environment', () => {
    let boot: SseBoot;

    afterEach(async () => {
        if (boot) await boot.cleanup();
    });

    // Regression for the browser-wizard "Finish writes nothing" bug: the
    // wizard spawns install.py with no PYTHONPATH, so the package-qualified
    // `scripts._cli.cmd_migrate` import failed → migrate-to-global aborted →
    // empty install. The spawn helpers MUST seed PYTHONPATH=<packageRoot>/src
    // (parity with _dispatch.bash) so `scripts.*` resolves in the child.
    it('seeds PYTHONPATH=<packageRoot>/src on the spawned installer', async () => {
        boot = await bootSseApp();
        const envPath = join(boot.baseTmp, 'child-pythonpath');
        // Fake installer: record the PYTHONPATH it received (atomic write so
        // the reader never sees a partial file), then emit a terminal frame.
        writeInstaller(boot.packageRoot, [
            'import os, sys, json',
            `ENVF = r"${envPath}"`,
            'tmp = ENVF + ".tmp"',
            'with open(tmp, "w") as f:',
            '    f.write(os.environ.get("PYTHONPATH", ""))',
            'os.replace(tmp, ENVF)',
            'sys.stdout.write(json.dumps({"type":"done"}) + "\\n")',
            'sys.stdout.flush()',
            '',
        ].join('\n'));

        const res = await fetch(`${boot.baseUrl}/api/v1/wizard/apply`, {
            method: 'POST',
            headers: { ...authHeaders(boot.host), accept: 'text/event-stream' },
            body: APPLY_BODY,
        });
        expect(res.status).toBe(200);
        await collectFrames(res.body);

        await waitForFile(envPath, 6_000);
        const pythonPath = readFileSync(envPath, 'utf8');
        const expectedSrc = join(boot.packageRoot, 'src');
        expect(pythonPath.split(delimiter)).toContain(expectedSrc);
    });
});

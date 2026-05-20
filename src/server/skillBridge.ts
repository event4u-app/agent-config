/**
 * `/onboard` ↔ wizard IPC handshake — discovery-file lifecycle.
 *
 * Contract: `docs/contracts/onboard-skill-wizard-bridge.md` §§ 3, 5.
 *
 * Three sibling files under `<projectRoot>/.agent-config/` track a
 * live headless server instance:
 *
 *   skill-bridge.port   — ASCII decimal port, no trailing newline
 *   skill-bridge.token  — URL-safe bearer token, no trailing newline
 *   skill-bridge.pid    — server PID, ASCII decimal, no trailing newline
 *
 * All three are written at 0600 via temp+rename (see `atomicWrite`),
 * then chmod again post-rename because some platforms / umasks ignore
 * the open() mode. The parent directory is created at 0700 if absent.
 *
 * Boot probe: any existing files are checked via the recorded port +
 * token (GET /api/v1/ping) AND a `os.kill(pid, 0)` liveness check. A
 * 200 + alive PID means another bridge owns these files and the caller
 * MUST refuse to start; any other outcome means the files are stale
 * and SHALL be unlinked.
 */

import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { writeAtomic } from './io/atomicWrite.js';
import { DEFAULT_PORT_RANGE } from './port.js';

export interface DiscoveryPaths {
    dir: string;
    port: string;
    token: string;
    pid: string;
}

export function discoveryPaths(projectRoot: string): DiscoveryPaths {
    const dir = resolve(projectRoot, '.agent-config');
    return {
        dir,
        port: join(dir, 'skill-bridge.port'),
        token: join(dir, 'skill-bridge.token'),
        pid: join(dir, 'skill-bridge.pid'),
    };
}

async function readTrim(path: string): Promise<string | null> {
    try {
        const raw = await fs.readFile(path, 'utf8');
        const trimmed = raw.trim();
        return trimmed.length === 0 ? null : trimmed;
    } catch {
        return null;
    }
}

async function unlinkAll(paths: DiscoveryPaths): Promise<void> {
    await Promise.all([
        fs.unlink(paths.port).catch(() => undefined),
        fs.unlink(paths.token).catch(() => undefined),
        fs.unlink(paths.pid).catch(() => undefined),
    ]);
}

function pidAlive(pid: number): boolean {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch (err) {
        // EPERM = process exists but cannot be signalled; ESRCH = gone.
        return (err as NodeJS.ErrnoException).code === 'EPERM';
    }
}

async function probePing(port: number, token: string, timeoutMs: number): Promise<boolean> {
    const ac = new AbortController();
    const timer = setTimeout(() => { ac.abort(); }, timeoutMs);
    try {
        const res = await fetch(`http://127.0.0.1:${port}/api/v1/ping`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: ac.signal,
        });
        return res.status === 200;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

export interface StaleProbeResult {
    /** 'clean' = no live bridge, safe to bind. */
    /** 'live'  = another bridge owns these files; caller MUST refuse. */
    status: 'clean' | 'live';
    livePid?: number;
    livePort?: number;
}

export async function probeStaleBridge(projectRoot: string): Promise<StaleProbeResult> {
    const paths = discoveryPaths(projectRoot);
    const portStr = await readTrim(paths.port);
    if (portStr === null) return { status: 'clean' };

    const port = Number.parseInt(portStr, 10);
    if (!Number.isInteger(port) || port < DEFAULT_PORT_RANGE.min || port > DEFAULT_PORT_RANGE.max) {
        // Out-of-range or corrupted — treat as hostile, sweep, continue.
        await unlinkAll(paths);
        return { status: 'clean' };
    }

    const token = await readTrim(paths.token);
    const pidStr = await readTrim(paths.pid);
    const pid = pidStr === null ? null : Number.parseInt(pidStr, 10);

    if (token !== null && pid !== null && pidAlive(pid)) {
        const live = await probePing(port, token, 500);
        if (live) {
            return { status: 'live', livePid: pid, livePort: port };
        }
    }

    await unlinkAll(paths);
    return { status: 'clean' };
}

export interface WriteDiscoveryInput {
    projectRoot: string;
    port: number;
    token: string;
    pid: number;
}

export async function writeDiscoveryFiles(input: WriteDiscoveryInput): Promise<DiscoveryPaths> {
    const paths = discoveryPaths(input.projectRoot);
    await fs.mkdir(paths.dir, { recursive: true, mode: 0o700 });
    await fs.chmod(paths.dir, 0o700).catch(() => undefined);
    await writeAtomic(paths.port, String(input.port), { mode: 0o600 });
    await writeAtomic(paths.token, input.token, { mode: 0o600 });
    await writeAtomic(paths.pid, String(input.pid), { mode: 0o600 });
    return paths;
}

export async function unlinkDiscoveryFiles(projectRoot: string): Promise<void> {
    await unlinkAll(discoveryPaths(projectRoot));
}

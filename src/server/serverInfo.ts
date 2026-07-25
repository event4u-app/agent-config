/**
 * On-disk record of the currently-running local server, so a fresh
 * `agent-config init` (via `scripts/install.py`) can find and terminate a
 * previous instance before starting a new one — guaranteeing a single live
 * server and a fresh wizard that re-enters at step 1.
 *
 * Written next to the bearer token at
 * `~/.event4u/agent-config/local-server.json` on boot (real-serve only) and
 * removed on graceful shutdown. A stale file (process already gone) is
 * harmless: the reader checks liveness before signalling.
 */

import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { event4u_root } from '../scripts/_lib/user_global_paths.js';

export interface ServerInfo {
    pid: number;
    port: number;
    url: string;
    startedAt: string;
}

function infoDir(): string {
    // Follows a host-supplied config root (EVENT4U_CONFIG_HOME / --config-root)
    // so a profile-scoped server records its liveness under its own root
    // instead of clobbering the shared default. Byte-identical to
    // `~/.event4u/agent-config` when no override is set.
    return event4u_root();
}

export function serverInfoPath(): string {
    return resolve(infoDir(), 'local-server.json');
}

export function writeServerInfo(info: ServerInfo): string {
    const dir = infoDir();
    const path = serverInfoPath();
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(path, `${JSON.stringify(info, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    return path;
}

export function readServerInfo(): ServerInfo | null {
    try {
        const raw = readFileSync(serverInfoPath(), 'utf8');
        const parsed = JSON.parse(raw) as Partial<ServerInfo>;
        if (typeof parsed.pid === 'number' && typeof parsed.port === 'number') {
            return {
                pid: parsed.pid,
                port: parsed.port,
                url: typeof parsed.url === 'string' ? parsed.url : '',
                startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : '',
            };
        }
    } catch {
        // Missing / malformed — treat as "no server recorded".
    }
    return null;
}

export function clearServerInfo(): void {
    try {
        rmSync(serverInfoPath(), { force: true });
    } catch {
        // Best-effort.
    }
}

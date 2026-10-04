#!/usr/bin/env tsx
// Test fixture concern — gets the SPAWNED process killed by a signal, so the
// dispatcher sees `status === null` with `signal` set and no `proc.error`.
//
// The third no-verdict shape, and the one `proc.status ?? 0` silently read as
// exit 0 / ALLOW. `concern_exits_3.ts` exits in the error band and
// `concern_throws.ts` exits 1; neither produces a null status.
//
// It signals its PARENT rather than itself, and that is the whole point of the
// fixture. `node_modules/.bin/tsx` is a node wrapper that runs the script as a
// SEPARATE child, so a self-kill here is converted by the wrapper into exit
// 137 — a status, not a signal, and not the case under test. The wrapper IS
// the process `spawnSync` is holding, so killing it reproduces what an OOM
// kill or a supervisor SIGTERM does to a spawned concern.
import { readFileSync } from 'node:fs';

try {
    if (!process.stdin.isTTY) {
        readFileSync(0, 'utf-8');
    }
} catch {
    // ignore — draining is best-effort
}
process.kill(process.ppid, 'SIGKILL');
// Keep this process alive briefly so the parent dies first; without it the
// script can exit and let the wrapper report a status before the signal lands.
setTimeout(() => process.exit(0), 1500);

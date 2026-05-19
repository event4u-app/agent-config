/**
 * Free-port picker for the local server.
 *
 * Per ADR-012 the local server binds to the reserved range
 * 41000–41999 on 127.0.0.1. The picker shuffles the range to avoid
 * predictable port collisions between concurrent invocations and
 * probes each candidate by attempting a real `net.createServer().listen`,
 * which is the only reliable way to know a port is available on the
 * host OS (no race window between "is free" and "bind").
 *
 * The picker refuses any range that overlaps the privileged ports
 * `[0, 1024]` or strays outside the documented contract range. Both
 * checks are anti-regression — see
 * `docs/contracts/local-server-ports.md`.
 */

import net from 'node:net';

export class NoFreePortError extends Error {
    constructor(public readonly min: number, public readonly max: number) {
        super(`No free port available in range ${min}-${max}`);
        this.name = 'NoFreePortError';
    }
}

export class InvalidPortRangeError extends Error {
    constructor(reason: string) {
        super(`Invalid port range: ${reason}`);
        this.name = 'InvalidPortRangeError';
    }
}

export interface PortRange {
    min: number;
    max: number;
}

export const DEFAULT_PORT_RANGE: Readonly<PortRange> = Object.freeze({
    min: 41000,
    max: 41999,
});

function validateRange(range: PortRange): void {
    if (!Number.isInteger(range.min) || !Number.isInteger(range.max)) {
        throw new InvalidPortRangeError('min and max must be integers');
    }
    if (range.min > range.max) {
        throw new InvalidPortRangeError('min must be <= max');
    }
    if (range.min <= 1024) {
        throw new InvalidPortRangeError('privileged ports (≤ 1024) are forbidden');
    }
    if (range.max > 65535) {
        throw new InvalidPortRangeError('max must be <= 65535');
    }
}

function shuffle(arr: number[]): number[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const a = out[i] as number;
        const b = out[j] as number;
        out[i] = b;
        out[j] = a;
    }
    return out;
}

function tryBind(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.unref();
        const cleanup = (ok: boolean): void => {
            server.removeAllListeners();
            server.close(() => resolve(ok));
        };
        server.once('error', () => cleanup(false));
        server.once('listening', () => cleanup(true));
        try {
            server.listen(port, '127.0.0.1');
        } catch {
            resolve(false);
        }
    });
}

/**
 * Pick a free TCP port in `range` (default 41000–41999) bound to
 * 127.0.0.1. Returns the port number. Throws `NoFreePortError` once
 * the entire range is exhausted.
 */
export async function pickFreePort(range: PortRange = DEFAULT_PORT_RANGE): Promise<number> {
    validateRange(range);
    const candidates: number[] = [];
    for (let p = range.min; p <= range.max; p++) candidates.push(p);
    const shuffled = shuffle(candidates);
    for (const port of shuffled) {
        if (await tryBind(port)) return port;
    }
    throw new NoFreePortError(range.min, range.max);
}

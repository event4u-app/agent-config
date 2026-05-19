/**
 * Tests for src/server/port.ts — free-port picker contract.
 *
 * Roadmap Phase 3 acceptance: the picker must refuse privileged ports
 * and ranges outside the documented contract, must shuffle the range
 * to avoid predictable collisions, and must throw NoFreePortError when
 * the entire range is exhausted.
 */
import { afterEach, describe, expect, it } from 'vitest';
import net from 'node:net';
import {
    DEFAULT_PORT_RANGE,
    InvalidPortRangeError,
    NoFreePortError,
    pickFreePort,
} from '../../src/server/port.js';

function listen(port: number): Promise<net.Server> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.once('listening', () => resolve(server));
        server.listen(port, '127.0.0.1');
    });
}

describe('pickFreePort', () => {
    const holders: net.Server[] = [];

    afterEach(async () => {
        for (const s of holders) {
            await new Promise<void>((resolve) => s.close(() => resolve()));
        }
        holders.length = 0;
    });

    it('returns a port inside the default range bound to 127.0.0.1', async () => {
        const port = await pickFreePort();
        expect(port).toBeGreaterThanOrEqual(DEFAULT_PORT_RANGE.min);
        expect(port).toBeLessThanOrEqual(DEFAULT_PORT_RANGE.max);
        const server = await listen(port);
        holders.push(server);
        expect(server.listening).toBe(true);
    });

    it('skips an already-bound port', async () => {
        // Bind one port deterministically, then verify the picker doesn't pick it.
        const taken = await pickFreePort({ min: 41100, max: 41110 });
        holders.push(await listen(taken));
        const next = await pickFreePort({ min: 41100, max: 41110 });
        expect(next).not.toBe(taken);
        holders.push(await listen(next));
    });

    it('throws NoFreePortError when the range is fully bound', async () => {
        const min = 41200;
        const max = 41201;
        for (let p = min; p <= max; p++) {
            holders.push(await listen(p));
        }
        await expect(pickFreePort({ min, max })).rejects.toBeInstanceOf(NoFreePortError);
    });

    it('refuses privileged port ranges (≤ 1024)', async () => {
        await expect(pickFreePort({ min: 80, max: 90 })).rejects.toBeInstanceOf(InvalidPortRangeError);
        await expect(pickFreePort({ min: 1024, max: 41000 })).rejects.toBeInstanceOf(InvalidPortRangeError);
    });

    it('refuses inverted ranges (min > max)', async () => {
        await expect(pickFreePort({ min: 50000, max: 49000 })).rejects.toBeInstanceOf(InvalidPortRangeError);
    });

    it('refuses non-integer endpoints', async () => {
        await expect(
            pickFreePort({ min: 41000.5, max: 41100 }),
        ).rejects.toBeInstanceOf(InvalidPortRangeError);
    });

    it('refuses max > 65535', async () => {
        await expect(pickFreePort({ min: 41000, max: 70000 })).rejects.toBeInstanceOf(InvalidPortRangeError);
    });
});

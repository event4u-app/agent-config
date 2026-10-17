/**
 * Steps 5.2 and 5.3 of `road-to-unknowns-that-say-so`, and AC-5.
 *
 * Two halves, because the guard has two mechanisms and a test of one says
 * nothing about the other: an in-process `fetch` is refused by the wrapper,
 * and a spawned `curl` is refused by the proxy variables it inherits. The
 * second is the one that matters most here — the metered council transport is
 * a `curl` subprocess, so an in-process-only guard would have left the one
 * path that can spend money wide open.
 *
 * THE PUBLIC ADDRESS IS NEVER REACHED, in either direction. A refusal is
 * asserted; nothing in this file depends on `example.com` resolving, being up,
 * or answering, so the suite stays offline whether the guard works or not.
 * `example.com` is used as a name that is unambiguously not loopback, not as a
 * host.
 *
 * WHAT EACH CASE ACTUALLY PROVES, because the obvious reading is wrong and was
 * measured wrong. This file IMPORTS the guard, and importing it runs its side
 * effects in this worker — so the `fetch` and proxy cases stay green even with
 * the guard removed from `vitest.config.ts`. They prove the MECHANISM, never
 * the WIRING. Unwiring it was tried: six of these seven cases stayed green and
 * only `is actually installed as a setup file` went red. That one case is the
 * whole wiring proof, which is why it reads the config rather than the
 * environment, and why it is not a redundant extra.
 */
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import {
    ALLOW_NETWORK_VAR,
    CLOSED_PROXY,
    NetworkRefused,
    assertLiveFlagsHaveOptIn,
    isLoopback,
    liveTestFlagsSet,
    networkIsOpen,
} from './network-guard.js';

const PUBLIC = 'https://example.com/';

describe('network-guard', () => {
    it('in-process-fetch-is-refused', async () => {
        // A REJECTION, and asserting the shape is half the point. The guard
        // refuses before a socket is opened, so it would be cheaper to throw
        // synchronously — and that is exactly what the first version did, and
        // it broke three unrelated suites: the real `fetch` returns a promise
        // on every path, so a synchronous throw escapes every
        // `fetch(...).catch(...)` its callers wrote. The guard keeps the
        // API's shape.
        await expect(fetch(PUBLIC)).rejects.toBeInstanceOf(NetworkRefused);
        await expect(fetch(new URL(PUBLIC))).rejects.toThrow(/is not loopback/);
    });

    it('lets a loopback origin through, so the suite keeps its own servers', () => {
        // The polarity partner. A guard that refused everything would pass the
        // case above and break every test that binds a local port, and nothing
        // in that case could tell the two apart.
        expect(isLoopback('http://127.0.0.1:8080/x')).toBe(true);
        expect(isLoopback('http://localhost:3000')).toBe(true);
        expect(isLoopback('http://[::1]:9/x')).toBe(true);
        expect(isLoopback(PUBLIC)).toBe(false);
        expect(isLoopback('https://registry.npmjs.org/foo')).toBe(false);
    });

    it('spawned-curl-cannot-reach-a-public-address', () => {
        const curl = spawnSync('curl', ['-sS', '--max-time', '5', '-o', '/dev/null', PUBLIC], {
            encoding: 'utf8',
        });

        if (curl.error && (curl.error as NodeJS.ErrnoException).code === 'ENOENT') {
            // skip-reason: curl is absent on this machine, so there is no child
            // to observe. The proxy variables are still asserted below, which is
            // the part of the mechanism this environment can see.
            expect(process.env.http_proxy).toBe(CLOSED_PROXY);
            return;
        }

        expect(curl.status, `curl reached ${PUBLIC}: ${curl.stdout}`).not.toBe(0);
        // Named, not merely non-zero: a non-zero that came from a typo in the
        // argv would pass an exit-code-only assertion while proving nothing.
        expect(`${curl.stderr}`).toMatch(/proxy|Connection refused|Failed to connect|Received HTTP\/0\.9/i);
    });

    it('hands every spawned child the closed proxy, in both spellings', () => {
        // curl reads the lower-case `http_proxy` and ignores the upper-case
        // one; other tools read only the upper-case. Setting one spelling is
        // the quiet half-failure this case exists to catch.
        for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY']) {
            expect(process.env[name], name).toBe(CLOSED_PROXY);
            expect(process.env[name.toLowerCase()], name.toLowerCase()).toBe(CLOSED_PROXY);
        }
        expect(process.env.NO_PROXY).toContain('127.0.0.1');
        expect(process.env.no_proxy).toContain('127.0.0.1');
    });

    it('a live test ran without the network opt-in', () => {
        // Step 5.3's case. It is an assertion over a CONSTRUCTED environment,
        // never over this worker's own: setting a real live flag here would
        // either throw in a later import or be unobservable, and a case that
        // has to be skipped to be written is what Phase 5 exists to remove.
        expect(() => assertLiveFlagsHaveOptIn({ LIVE: '1' })).toThrow(/live test ran without the network opt-in/);
        expect(() => assertLiveFlagsHaveOptIn({ AGENT_CONFIG_LIVE_COUNCIL: '1' })).toThrow(/AGENT_CONFIG_LIVE_COUNCIL/);

        // Three ways it must NOT throw, so the refusal is about the opt-in and
        // not about the variable merely existing.
        expect(() => assertLiveFlagsHaveOptIn({})).not.toThrow();
        expect(() => assertLiveFlagsHaveOptIn({ LIVE: '0' })).not.toThrow();
        expect(() => assertLiveFlagsHaveOptIn({ LIVE: '1', [ALLOW_NETWORK_VAR]: '1' })).not.toThrow();
    });

    it('reads the opt-in and the live flags the way the setup file does', () => {
        expect(networkIsOpen({})).toBe(false);
        expect(networkIsOpen({ [ALLOW_NETWORK_VAR]: '1' })).toBe(true);
        expect(networkIsOpen({ [ALLOW_NETWORK_VAR]: 'true' })).toBe(true);
        expect(networkIsOpen({ [ALLOW_NETWORK_VAR]: '0' })).toBe(false);

        expect(liveTestFlagsSet({ LIVE: '1', PATH: '/usr/bin' })).toEqual(['LIVE']);
        expect(liveTestFlagsSet({ LIVELY: '1' })).toEqual([]);
        expect(liveTestFlagsSet({ AGENT_CONFIG_LIVE_X: '1', LIVE: '1' })).toEqual(['AGENT_CONFIG_LIVE_X', 'LIVE']);
    });

    it('is actually installed as a setup file, not merely present', () => {
        // The guard is a file nobody imports. If it falls out of
        // `vitest.config.ts` the four cases above keep passing — the two that
        // read `process.env` would go red, but only because of the assertions,
        // and the wiring itself would be unasserted. This reads the config.
        const config = spawnSync('node', ['-e', 'process.stdout.write(require("fs").readFileSync("vitest.config.ts","utf8"))'], {
            encoding: 'utf8',
        });
        expect(config.stdout).toContain('tests/_lib/network-guard.ts');
    });
});

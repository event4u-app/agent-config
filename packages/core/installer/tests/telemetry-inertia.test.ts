/**
 * Inertia tests — the install-funnel telemetry SDK must stay silent on
 * every default consumer install. Gates required for traffic:
 *   1. caller `optedIn === true`
 *   2. `workerBaseUrl`, `flagsUrl`, `hmacSecret` all non-empty
 *   3. remote kill-switch resolves `enabled: true`
 *   4. `AGENT_CONFIG_NO_TELEMETRY=1` is absent
 *
 * These tests intercept `globalThis.fetch` so any missed gate would
 * surface as an unexpected call.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildTelemetryConfig } from '../src/telemetry/bootstrap.js';
import { emit, initSession, resetTelemetry } from '../src/telemetry/index.js';
import { resetKillSwitchCache } from '../src/telemetry/kill-switch.js';

const BASE_ENV = {
    AGENT_CONFIG_TELEMETRY_WORKER_URL: 'https://telemetry.example.test',
    AGENT_CONFIG_TELEMETRY_FLAGS_URL: 'https://telemetry.example.test/flags.json',
    AGENT_CONFIG_TELEMETRY_HMAC_NPX: 'npx-secret',
    AGENT_CONFIG_TELEMETRY_HMAC_CURL: 'curl-secret',
    AGENT_CONFIG_TELEMETRY_HMAC_GUI: 'gui-secret',
} as const;

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    resetTelemetry();
    resetKillSwitchCache();
});

afterEach(() => {
    vi.restoreAllMocks();
    resetTelemetry();
    resetKillSwitchCache();
});

describe('buildTelemetryConfig', () => {
    it('produces an inert config when env is empty', () => {
        const cfg = buildTelemetryConfig({ entryPath: 'npx', optedIn: true, env: {} });
        expect(cfg.workerBaseUrl).toBe('');
        expect(cfg.flagsUrl).toBe('');
        expect(cfg.hmacSecret).toBe('');
    });

    it('forces opt-in to false when AGENT_CONFIG_NO_TELEMETRY=1', () => {
        const cfg = buildTelemetryConfig({
            entryPath: 'npx',
            optedIn: true,
            env: { ...BASE_ENV, AGENT_CONFIG_NO_TELEMETRY: '1' },
        });
        expect(cfg.optedIn).toBe(false);
    });

    it('selects the entry-specific HMAC secret', () => {
        const cfgGui = buildTelemetryConfig({ entryPath: 'gui', optedIn: true, env: BASE_ENV });
        expect(cfgGui.hmacSecret).toBe('gui-secret');
        const cfgCurl = buildTelemetryConfig({ entryPath: 'curl', optedIn: true, env: BASE_ENV });
        expect(cfgCurl.hmacSecret).toBe('curl-secret');
    });
});

describe('initSession + emit — inert by default', () => {
    it('stays silent when optedIn is false', async () => {
        const cfg = buildTelemetryConfig({ entryPath: 'npx', optedIn: false, env: BASE_ENV });
        const live = await initSession(cfg);
        expect(live).toBe(false);
        await emit({ stage: 'started' });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('stays silent when workerBaseUrl is empty', async () => {
        const cfg = buildTelemetryConfig({
            entryPath: 'npx',
            optedIn: true,
            env: { ...BASE_ENV, AGENT_CONFIG_TELEMETRY_WORKER_URL: '' },
        });
        const live = await initSession(cfg);
        expect(live).toBe(false);
        await emit({ stage: 'started' });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('stays silent when flagsUrl is empty', async () => {
        const cfg = buildTelemetryConfig({
            entryPath: 'npx',
            optedIn: true,
            env: { ...BASE_ENV, AGENT_CONFIG_TELEMETRY_FLAGS_URL: '' },
        });
        const live = await initSession(cfg);
        expect(live).toBe(false);
        await emit({ stage: 'started' });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('stays silent when hmacSecret is empty', async () => {
        const cfg = buildTelemetryConfig({
            entryPath: 'npx',
            optedIn: true,
            env: { ...BASE_ENV, AGENT_CONFIG_TELEMETRY_HMAC_NPX: '' },
        });
        const live = await initSession(cfg);
        expect(live).toBe(false);
        await emit({ stage: 'started' });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('stays silent when kill-switch resolves enabled=false', async () => {
        fetchSpy.mockResolvedValueOnce(
            new Response(JSON.stringify({ enabled: false, schema_version: '1' }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            }),
        );
        const cfg = buildTelemetryConfig({ entryPath: 'npx', optedIn: true, env: BASE_ENV });
        const live = await initSession(cfg);
        expect(live).toBe(false);
        // The flags endpoint MAY be queried, but no install-event POST.
        await emit({ stage: 'started' });
        const eventPosts = fetchSpy.mock.calls.filter((c) =>
            typeof c[0] === 'string' && c[0].includes('/install-event'),
        );
        expect(eventPosts).toHaveLength(0);
    });

    it('emit is a no-op when initSession was never called', async () => {
        await emit({ stage: 'started' });
        await emit({ stage: 'applied' });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('emit is a no-op after a failed initSession (opt-out)', async () => {
        const cfg = buildTelemetryConfig({ entryPath: 'gui', optedIn: false, env: BASE_ENV });
        await initSession(cfg);
        await emit({ stage: 'packs_selected', packCategories: ['engineering'] });
        await emit({ stage: 'applied' });
        await emit({ stage: 'errored', errorClass: 'network' });
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});

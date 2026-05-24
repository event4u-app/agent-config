/**
 * Remote kill-switch — reads the feature-flag JSON before any session is
 * opened. Defaults to `enabled: false` if the flag URL is unset, the
 * fetch fails, the response is non-2xx, or the body does not parse.
 *
 * The flag is cached for 1 hour per process. The SDK is short-lived
 * (one install run), so this is effectively "fetched once".
 */

import type { TelemetryFlags } from './types.js';

interface CacheEntry {
    readonly enabled: boolean;
    readonly fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
let cache: CacheEntry | null = null;

export interface KillSwitchOptions {
    readonly flagsUrl: string;
    readonly requestTimeoutMs: number;
    readonly now?: () => number;
    readonly fetchImpl?: typeof fetch;
}

export async function isTelemetryEnabled(opts: KillSwitchOptions): Promise<boolean> {
    if (opts.flagsUrl.length === 0) {
        return false;
    }
    const now = opts.now ?? (() => Date.now());
    if (cache !== null && now() - cache.fetchedAt < CACHE_TTL_MS) {
        return cache.enabled;
    }
    const enabled = await fetchFlag(opts);
    cache = { enabled, fetchedAt: now() };
    return enabled;
}

async function fetchFlag(opts: KillSwitchOptions): Promise<boolean> {
    const fetchImpl = opts.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.requestTimeoutMs);
    try {
        const response = await fetchImpl(opts.flagsUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: { accept: 'application/json' },
        });
        if (!response.ok) return false;
        const body = (await response.json()) as unknown;
        if (!isTelemetryFlags(body)) return false;
        return body.enabled;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

function isTelemetryFlags(value: unknown): value is TelemetryFlags {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string, unknown>;
    return typeof v['enabled'] === 'boolean' && v['schema_version'] === '1';
}

/** Test hook — clears the per-process cache. */
export function resetKillSwitchCache(): void {
    cache = null;
}

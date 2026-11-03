/**
 * prompt_cache_reading — the host's status-line `prompt_cache` object, reduced
 * to what a cold-return notice needs (road-to-a-return-that-names-its-price 1.1).
 *
 * Kept out of `quota_ledger.ts` on purpose: that module sits in the dispatch
 * bundle, every event pays its bytes, and only the status-line tap writes this.
 *
 * PII-exclusion-by-construction: two enums, two numbers. The host's free-text
 * `last_miss_cause` is never kept — it is the one field that could carry content.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { k, overThreshold } from './cold_return.js';
import { clock } from './pressure.js';
import { hashSessionId, quotaStateDir, snapshotFromStatusPayload, type QuotaSnapshot } from './quota_ledger.js';
import type { EnvMap } from './user_global_paths.js';

export interface CacheReading {
    readonly warm?: boolean;
    readonly ttl?: '5m' | '1h';
    /** Epoch milliseconds. */
    readonly expires_at?: number;
    readonly recache_tokens_if_cold?: number;
}

function epochMs(raw: unknown): number | undefined {
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw > 1e12 ? Math.trunc(raw) : Math.trunc(raw * 1000);
    if (typeof raw === 'string' && raw !== '') {
        const parsed = Date.parse(raw);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

export function readCache(raw: unknown): CacheReading | undefined {
    if (raw === null || typeof raw !== 'object') return undefined;
    const o = raw as Record<string, unknown>;
    const ttl = o['ttl'] === '5m' || o['ttl'] === '1h' ? o['ttl'] : undefined;
    const expires_at = epochMs(o['expires_at']);
    const recache = o['recache_tokens_if_cold'];
    const out: CacheReading = {
        ...(typeof o['warm'] === 'boolean' ? { warm: o['warm'] } : {}),
        ...(ttl ? { ttl } : {}),
        ...(expires_at !== undefined ? { expires_at } : {}),
        ...(typeof recache === 'number' && Number.isFinite(recache) && recache >= 0 ? { recache_tokens_if_cold: recache } : {}),
    };
    return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * The tap's snapshot: the quota snapshot plus the cache subset and this
 * project's measured `/clear` start; `null` when the payload carries neither
 * quota nor cache.
 */
export function snapshotWithCache(payload: unknown, now: number = Date.now(), env?: EnvMap | null): QuotaSnapshot | null {
    const base = snapshotFromStatusPayload(payload, now);
    const p = payload !== null && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const cache = readCache(p['prompt_cache']);
    if (cache === undefined) return base;
    const transcript = p['transcript_path'];
    const start = typeof transcript === 'string' && transcript !== '' ? clearStart(path.dirname(transcript), now, env) : null;
    return {
        ...(base ?? { ts: now, session: hashSessionId(p['session_id']) }),
        cache,
        ...(start !== null ? { clear_start: start } : {}),
    };
}

/** How many recent sessions the start median reads. */
const START_SESSIONS = 20;
/** The median is recomputed at most this often per project. */
const START_REFRESH_MS = 60 * 60 * 1000;
/** The first response sits near the top of a transcript; a session start is never this deep. */
const HEAD_BYTES = 256 * 1024;

/**
 * Billable input of the first main-chain response in a transcript — what that
 * session's start cost: system prompt, tools, project instructions, AC's
 * session-start injections and, after `/clear`, the continuity record.
 */
export function firstRequestTokens(file: string): number | null {
    try {
        const fd = fs.openSync(file, 'r');
        const buf = Buffer.alloc(HEAD_BYTES);
        const read = fs.readSync(fd, buf, 0, HEAD_BYTES, 0);
        fs.closeSync(fd);
        for (const line of buf.subarray(0, read).toString('utf-8').split('\n')) {
            let r: Record<string, unknown>;
            try {
                r = JSON.parse(line) as Record<string, unknown>;
            } catch {
                continue;
            }
            if (r['type'] !== 'assistant' || r['isSidechain'] === true) continue;
            const u = (r['message'] as { usage?: Record<string, unknown> } | undefined)?.usage;
            if (u === undefined) continue;
            const n = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
            return n(u['input_tokens']) + n(u['cache_read_input_tokens']) + n(u['cache_creation_input_tokens']);
        }
    } catch {
        // unreadable transcript: not a sample
    }
    return null;
}

/** Median of the numbers, or `null` for none. */
export function median(xs: readonly number[]): number | null {
    if (xs.length === 0) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 === 1 ? (s[m] as number) : Math.round(((s[m - 1] as number) + (s[m] as number)) / 2);
}

/**
 * Median first-request size over the newest sessions of one transcript store,
 * cached per store for an hour (`clear-start.json`, keyed by a hash of the
 * store path so no path is written). `null` when no session yields a sample:
 * the notice then says "not measured yet" rather than guessing.
 */
export function clearStart(storeDir: string, now: number, env?: EnvMap | null): number | null {
    const file = path.join(quotaStateDir(env), 'clear-start.json');
    const key = hashSessionId(storeDir);
    let cached: Record<string, { median: number | null; at: number }> = {};
    try {
        cached = JSON.parse(fs.readFileSync(file, 'utf-8')) as typeof cached;
    } catch {
        cached = {};
    }
    const hit = cached[key];
    if (hit !== undefined && now - hit.at < START_REFRESH_MS) return hit.median;
    let samples: number[] = [];
    try {
        samples = fs
            .readdirSync(storeDir)
            .filter((f) => f.endsWith('.jsonl'))
            .map((f) => path.join(storeDir, f))
            .map((f) => ({ f, m: fs.statSync(f).mtimeMs }))
            .sort((a, b) => b.m - a.m)
            .slice(0, START_SESSIONS)
            .map(({ f }) => firstRequestTokens(f))
            .filter((x): x is number => x !== null && x > 0);
    } catch {
        samples = [];
    }
    const value = median(samples);
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
        fs.writeFileSync(file, JSON.stringify({ ...cached, [key]: { median: value, at: now } }), { mode: 0o600 });
    } catch {
        // the measurement is a cache; the line still prints
    }
    return value;
}

/**
 * The cache part of the tap's AC line (D3: an absolute clock, not a
 * countdown — the host re-runs the line at `expires_at`, not in between).
 * Empty below the D4 threshold, so a small session never shows it.
 */
export function cacheSegment(snap: QuotaSnapshot | null, now: number): string {
    const c = snap?.cache;
    if (c?.expires_at === undefined || c.recache_tokens_if_cold === undefined) return '';
    if (!overThreshold(c.recache_tokens_if_cold, snap?.clear_start)) return '';
    return now < c.expires_at ? `cache warm until ${clock(c.expires_at)}` : `cache cold · continue ≈${k(c.recache_tokens_if_cold)}`;
}
